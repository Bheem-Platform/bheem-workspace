/**
 * API Module - Unified API utilities
 *
 * Usage:
 * ```typescript
 * import { api } from '@/lib/api';
 *
 * // GET request
 * const data = await api.get<User[]>('/users');
 *
 * // POST request
 * const user = await api.post<User>('/users', { name: 'John' });
 *
 * // With query params
 * const results = await api.get<SearchResult[]>('/search', {
 *   params: { q: 'test', limit: 10 }
 * });
 *
 * // File upload with progress
 * const file = await api.uploadFile<FileResponse>('/files/upload', file, {
 *   description: 'My file'
 * }, {
 *   onProgress: (progress) => console.log(`${progress}%`)
 * });
 *
 * // With cancellation
 * const { signal, cancel } = api.createCancelToken();
 * api.get('/long-request', { signal }).catch(err => {
 *   if (err.code === 'ABORTED') console.log('Cancelled');
 * });
 * // Later: cancel();
 * ```
 */

export {
  // HTTP methods
  get,
  post,
  put,
  patch,
  del as delete,

  // File operations
  uploadFile,
  downloadFile,

  // Token management
  getAuthToken,
  setAuthToken,
  clearAuthToken,

  // Interceptors
  addRequestInterceptor,
  addResponseInterceptor,
  addErrorInterceptor,

  // Utilities
  createCancelToken,
  isApiError,
  isAuthError,
  isNetworkError,
  isTimeoutError,

  // Types
  type ApiError,
  type ApiResponse,
  type RequestConfig,
  type UploadConfig,
} from './baseApi';

// Default export for convenience
export { default as api } from './baseApi';
