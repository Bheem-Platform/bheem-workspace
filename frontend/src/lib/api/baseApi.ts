/**
 * Base API Utilities
 *
 * Provides a unified, type-safe API client with:
 * - Consistent error handling
 * - Automatic token management
 * - Request/response interceptors
 * - Retry logic for failed requests
 * - Request cancellation support
 */

// ===========================================
// Types
// ===========================================

export interface ApiError {
  status: number;
  message: string;
  code?: string;
  details?: Record<string, any>;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Headers;
}

export interface RequestConfig {
  headers?: HeadersInit;
  params?: Record<string, string | number | boolean | undefined>;
  timeout?: number;
  retries?: number;
  signal?: AbortSignal;
  withCredentials?: boolean;
}

export interface UploadConfig extends RequestConfig {
  onProgress?: (progress: number) => void;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// ===========================================
// Constants
// ===========================================

const API_BASE = '/api/v1';
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_RETRIES = 0;

// ===========================================
// Token Management
// ===========================================

let authToken: string | null = null;

/**
 * Get the current auth token
 */
export function getAuthToken(): string | null {
  if (authToken) return authToken;
  if (typeof window !== 'undefined') {
    authToken = localStorage.getItem('auth_token');
  }
  return authToken;
}

/**
 * Set the auth token
 */
export function setAuthToken(token: string | null): void {
  authToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }
}

/**
 * Clear the auth token
 */
export function clearAuthToken(): void {
  setAuthToken(null);
}

// ===========================================
// Request/Response Interceptors
// ===========================================

type RequestInterceptor = (config: RequestInit & { url: string }) => RequestInit & { url: string };
type ResponseInterceptor = (response: Response, data: any) => any;
type ErrorInterceptor = (error: ApiError) => void;

const requestInterceptors: RequestInterceptor[] = [];
const responseInterceptors: ResponseInterceptor[] = [];
const errorInterceptors: ErrorInterceptor[] = [];

/**
 * Add a request interceptor
 */
export function addRequestInterceptor(interceptor: RequestInterceptor): () => void {
  requestInterceptors.push(interceptor);
  return () => {
    const index = requestInterceptors.indexOf(interceptor);
    if (index > -1) requestInterceptors.splice(index, 1);
  };
}

/**
 * Add a response interceptor
 */
export function addResponseInterceptor(interceptor: ResponseInterceptor): () => void {
  responseInterceptors.push(interceptor);
  return () => {
    const index = responseInterceptors.indexOf(interceptor);
    if (index > -1) responseInterceptors.splice(index, 1);
  };
}

/**
 * Add an error interceptor
 */
export function addErrorInterceptor(interceptor: ErrorInterceptor): () => void {
  errorInterceptors.push(interceptor);
  return () => {
    const index = errorInterceptors.indexOf(interceptor);
    if (index > -1) errorInterceptors.splice(index, 1);
  };
}

// ===========================================
// Helper Functions
// ===========================================

/**
 * Build URL with query parameters
 */
function buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

  if (!params) return url;

  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `${url}?${queryString}` : url;
}

/**
 * Get default headers with auth token
 */
function getDefaultHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Parse API error from response
 */
async function parseApiError(response: Response): Promise<ApiError> {
  let message = `Request failed with status ${response.status}`;
  let details: Record<string, any> | undefined;
  let code: string | undefined;

  try {
    const data = await response.json();
    message = data.detail || data.message || data.error || message;
    details = data.details || data.errors;
    code = data.code;
  } catch {
    // Response body is not JSON
  }

  return {
    status: response.status,
    message,
    code,
    details,
  };
}

/**
 * Sleep for a given duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable
 */
function isRetryable(status: number): boolean {
  // Retry on server errors and rate limiting
  return status >= 500 || status === 429;
}

// ===========================================
// Core Request Function
// ===========================================

/**
 * Make an API request with automatic retries and error handling
 */
async function request<T>(
  method: HttpMethod,
  endpoint: string,
  data?: unknown,
  config: RequestConfig = {}
): Promise<T> {
  const {
    headers: customHeaders,
    params,
    timeout = DEFAULT_TIMEOUT,
    retries = DEFAULT_RETRIES,
    signal,
    withCredentials = true,
  } = config;

  const url = buildUrl(endpoint, params);
  const headers = { ...getDefaultHeaders(), ...customHeaders };

  let requestConfig: RequestInit & { url: string } = {
    url,
    method,
    headers,
    credentials: withCredentials ? 'include' : 'same-origin',
    signal,
  };

  // Add body for methods that support it
  if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
    requestConfig.body = JSON.stringify(data);
  }

  // Apply request interceptors
  for (const interceptor of requestInterceptors) {
    requestConfig = interceptor(requestConfig);
  }

  // Create timeout controller if needed
  let timeoutId: NodeJS.Timeout | undefined;
  let controller: AbortController | undefined;

  if (!signal && timeout > 0) {
    controller = new AbortController();
    requestConfig.signal = controller.signal;
    timeoutId = setTimeout(() => controller!.abort(), timeout);
  }

  let lastError: ApiError | undefined;
  let attempt = 0;

  try {
    while (attempt <= retries) {
      try {
        const response = await fetch(requestConfig.url, requestConfig);

        if (!response.ok) {
          const error = await parseApiError(response);

          // Check if we should retry
          if (attempt < retries && isRetryable(response.status)) {
            attempt++;
            // Exponential backoff: 1s, 2s, 4s, etc.
            await sleep(Math.pow(2, attempt - 1) * 1000);
            continue;
          }

          // Call error interceptors
          for (const interceptor of errorInterceptors) {
            interceptor(error);
          }

          throw error;
        }

        // Parse response
        let responseData: T;
        const contentType = response.headers.get('content-type');

        if (contentType?.includes('application/json')) {
          responseData = await response.json();
        } else if (contentType?.includes('text/')) {
          responseData = await response.text() as unknown as T;
        } else {
          responseData = undefined as unknown as T;
        }

        // Apply response interceptors
        for (const interceptor of responseInterceptors) {
          responseData = interceptor(response, responseData);
        }

        return responseData;
      } catch (error: any) {
        // Handle abort/timeout
        if (error.name === 'AbortError') {
          throw {
            status: 0,
            message: 'Request timeout',
            code: 'TIMEOUT',
          } as ApiError;
        }

        // Handle network errors
        if (!error.status) {
          throw {
            status: 0,
            message: 'Network error',
            code: 'NETWORK_ERROR',
          } as ApiError;
        }

        lastError = error;
        throw error;
      }
    }

    throw lastError;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

// ===========================================
// HTTP Methods
// ===========================================

/**
 * Make a GET request
 */
export function get<T>(endpoint: string, config?: RequestConfig): Promise<T> {
  return request<T>('GET', endpoint, undefined, config);
}

/**
 * Make a POST request
 */
export function post<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
  return request<T>('POST', endpoint, data, config);
}

/**
 * Make a PUT request
 */
export function put<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
  return request<T>('PUT', endpoint, data, config);
}

/**
 * Make a PATCH request
 */
export function patch<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
  return request<T>('PATCH', endpoint, data, config);
}

/**
 * Make a DELETE request
 */
export function del<T>(endpoint: string, config?: RequestConfig): Promise<T> {
  return request<T>('DELETE', endpoint, undefined, config);
}

// ===========================================
// File Upload
// ===========================================

/**
 * Upload a file with progress tracking
 */
export function uploadFile<T>(
  endpoint: string,
  file: File,
  additionalData?: Record<string, string>,
  config?: UploadConfig
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = buildUrl(endpoint, config?.params);

    xhr.open('POST', url);

    // Set auth header
    const token = getAuthToken();
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    // Set custom headers (except Content-Type, which is set by FormData)
    if (config?.headers) {
      Object.entries(config.headers).forEach(([key, value]) => {
        if (key.toLowerCase() !== 'content-type') {
          xhr.setRequestHeader(key, value as string);
        }
      });
    }

    // Set credentials
    xhr.withCredentials = config?.withCredentials ?? true;

    // Set timeout
    xhr.timeout = config?.timeout ?? DEFAULT_TIMEOUT;

    // Progress handler
    if (config?.onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          config.onProgress!(progress);
        }
      };
    }

    // Success handler
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data);
        } catch {
          resolve(xhr.responseText as unknown as T);
        }
      } else {
        let error: ApiError;
        try {
          const data = JSON.parse(xhr.responseText);
          error = {
            status: xhr.status,
            message: data.detail || data.message || `Upload failed with status ${xhr.status}`,
            details: data.details,
          };
        } catch {
          error = {
            status: xhr.status,
            message: `Upload failed with status ${xhr.status}`,
          };
        }

        // Call error interceptors
        for (const interceptor of errorInterceptors) {
          interceptor(error);
        }

        reject(error);
      }
    };

    // Error handler
    xhr.onerror = () => {
      reject({
        status: 0,
        message: 'Network error during upload',
        code: 'NETWORK_ERROR',
      } as ApiError);
    };

    // Timeout handler
    xhr.ontimeout = () => {
      reject({
        status: 0,
        message: 'Upload timeout',
        code: 'TIMEOUT',
      } as ApiError);
    };

    // Abort handler
    if (config?.signal) {
      config.signal.addEventListener('abort', () => {
        xhr.abort();
        reject({
          status: 0,
          message: 'Upload cancelled',
          code: 'ABORTED',
        } as ApiError);
      });
    }

    // Build form data
    const formData = new FormData();
    formData.append('file', file);

    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }

    xhr.send(formData);
  });
}

// ===========================================
// Download
// ===========================================

/**
 * Download a file
 */
export async function downloadFile(
  endpoint: string,
  filename: string,
  config?: RequestConfig
): Promise<void> {
  const url = buildUrl(endpoint, config?.params);
  const headers = { ...getDefaultHeaders(), ...config?.headers };
  delete (headers as Record<string, string>)['Content-Type'];

  const response = await fetch(url, {
    method: 'GET',
    headers,
    credentials: config?.withCredentials ? 'include' : 'same-origin',
    signal: config?.signal,
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw error;
  }

  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
}

// ===========================================
// Utility Functions
// ===========================================

/**
 * Create a cancellation token
 */
export function createCancelToken(): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  return {
    signal: controller.signal,
    cancel: () => controller.abort(),
  };
}

/**
 * Check if an error is an API error
 */
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    'message' in error
  );
}

/**
 * Check if error is an authentication error
 */
export function isAuthError(error: unknown): boolean {
  return isApiError(error) && error.status === 401;
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  return isApiError(error) && error.code === 'NETWORK_ERROR';
}

/**
 * Check if error is a timeout
 */
export function isTimeoutError(error: unknown): boolean {
  return isApiError(error) && error.code === 'TIMEOUT';
}

// ===========================================
// Default Export
// ===========================================

export default {
  get,
  post,
  put,
  patch,
  delete: del,
  uploadFile,
  downloadFile,
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  addRequestInterceptor,
  addResponseInterceptor,
  addErrorInterceptor,
  createCancelToken,
  isApiError,
  isAuthError,
  isNetworkError,
  isTimeoutError,
};
