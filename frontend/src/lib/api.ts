import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Always use relative URL for client-side requests
// This ensures API calls go through the same origin and get proxied correctly
const API_BASE = '/api/v1';

// Bheem Passport URL for token refresh
const PASSPORT_URL = process.env.NEXT_PUBLIC_PASSPORT_URL || 'https://platform.bheem.co.uk';

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,  // Send cookies with requests (required for SSO session)
});

// Track if we're currently refreshing to prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  config: InternalAxiosRequestConfig;
}> = [];

// Background refresh interval ID
let backgroundRefreshInterval: NodeJS.Timeout | null = null;

// Process queued requests after token refresh
const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      // Update the token in the config and retry
      if (token && prom.config.headers) {
        prom.config.headers.Authorization = `Bearer ${token}`;
      }
      prom.resolve(api(prom.config));
    }
  });
  failedQueue = [];
};

// Decode JWT token payload
const decodeToken = (token: string): { exp?: number } | null => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
};

// Check if token is expiring soon (within 5 minutes)
const isTokenExpiringSoon = (token: string): boolean => {
  const payload = decodeToken(token);
  if (!payload?.exp) return true; // No expiration, assume expired
  const expiresAt = payload.exp * 1000;
  const fiveMinutes = 5 * 60 * 1000;
  return expiresAt - Date.now() < fiveMinutes;
};

// Refresh the access token
export const refreshAccessToken = async (): Promise<string | null> => {
  if (typeof window === 'undefined') return null;
  if (isRefreshing) return null; // Already refreshing

  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) {
    console.log('[API] No refresh token available');
    return null;
  }

  isRefreshing = true;

  try {
    console.log('[API] Refreshing access token...');
    const response = await fetch(`${PASSPORT_URL}/api/v1/auth/refresh?refresh_token=${encodeURIComponent(refreshToken)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] Token refresh failed:', response.status, errorText);
      isRefreshing = false;
      return null;
    }

    const data = await response.json();
    const { access_token, refresh_token: newRefreshToken } = data;

    if (!access_token) {
      console.error('[API] No access token in refresh response');
      isRefreshing = false;
      return null;
    }

    // Store new tokens
    localStorage.setItem('auth_token', access_token);
    if (newRefreshToken) {
      localStorage.setItem('refresh_token', newRefreshToken);
    }

    // Store token refresh timestamp for debugging
    localStorage.setItem('token_refreshed_at', new Date().toISOString());

    const payload = decodeToken(access_token);
    const expiresAt = payload?.exp ? new Date(payload.exp * 1000) : 'unknown';
    console.log('[API] Token refreshed successfully, expires at:', expiresAt);

    isRefreshing = false;
    return access_token;
  } catch (error) {
    console.error('[API] Token refresh error:', error);
    isRefreshing = false;
    return null;
  }
};

// Proactively refresh token if expiring soon
const proactiveRefresh = async (): Promise<void> => {
  if (typeof window === 'undefined') return;

  const token = localStorage.getItem('auth_token');
  const refreshToken = localStorage.getItem('refresh_token');

  if (!token || !refreshToken) return;

  if (isTokenExpiringSoon(token)) {
    console.log('[API] Token expiring soon, proactively refreshing...');
    await refreshAccessToken();
  }
};

// Start background token refresh check (runs every 2 minutes)
export const startBackgroundRefresh = () => {
  if (typeof window === 'undefined') return;

  // Clear existing interval
  if (backgroundRefreshInterval) {
    clearInterval(backgroundRefreshInterval);
  }

  // Check immediately
  proactiveRefresh();

  // Then check every 2 minutes
  backgroundRefreshInterval = setInterval(() => {
    proactiveRefresh();
  }, 2 * 60 * 1000);

  // Also refresh when tab becomes visible again
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      console.log('[API] Tab became visible, checking token...');
      proactiveRefresh();
    }
  });

  console.log('[API] Background token refresh started');
};

// Stop background refresh
export const stopBackgroundRefresh = () => {
  if (backgroundRefreshInterval) {
    clearInterval(backgroundRefreshInterval);
    backgroundRefreshInterval = null;
  }
};

// Redirect to login page
const redirectToLogin = () => {
  if (typeof window !== 'undefined') {
    // Stop background refresh
    stopBackgroundRefresh();

    // Clear tokens
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('token_refreshed_at');

    // Redirect to login
    const currentPath = window.location.pathname;
    if (currentPath !== '/login' && currentPath !== '/') {
      window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
    }
  }
};

// Add auth token to requests and proactively refresh if needed
api.interceptors.request.use(async (config) => {
  if (typeof window === 'undefined') return config;

  let token = localStorage.getItem('auth_token');

  // Proactively refresh if token is expiring soon
  if (token && isTokenExpiringSoon(token)) {
    console.log('[API] Token expiring soon, refreshing before request...');
    const newToken = await refreshAccessToken();
    if (newToken) {
      token = newToken;
    }
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors and refresh token
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Only handle 401 errors
    if (error.response?.status !== 401 || !originalRequest) {
      return Promise.reject(error);
    }

    // Don't retry if we already tried
    if (originalRequest._retry) {
      console.log('[API] Token refresh already attempted, redirecting to login');
      redirectToLogin();
      return Promise.reject(error);
    }

    // Check if we have a refresh token
    const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;
    if (!refreshToken) {
      console.log('[API] No refresh token, redirecting to login');
      redirectToLogin();
      return Promise.reject(error);
    }

    // If we're already refreshing, queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject, config: originalRequest });
      });
    }

    originalRequest._retry = true;

    try {
      const newToken = await refreshAccessToken();

      if (newToken) {
        // Update the original request with new token
        originalRequest.headers.Authorization = `Bearer ${newToken}`;

        // Process any queued requests
        processQueue(null, newToken);

        // Retry the original request
        return api(originalRequest);
      } else {
        // Refresh failed
        processQueue(new Error('Token refresh failed'), null);
        redirectToLogin();
        return Promise.reject(error);
      }
    } catch (refreshError) {
      processQueue(refreshError as Error, null);
      redirectToLogin();
      return Promise.reject(refreshError);
    }
  }
);

// Auto-start background refresh when this module is loaded in browser
if (typeof window !== 'undefined') {
  // Start after a short delay to allow the app to initialize
  setTimeout(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      startBackgroundRefresh();
    }
  }, 1000);
}

// API Functions

// Workspace Dashboard
export const getDashboard = (tenantId: string) =>
  api.get(`/workspace/dashboard?tenant_id=${tenantId}`);

export const getRecentActivity = (tenantId: string, limit = 20) =>
  api.get(`/workspace/activity?tenant_id=${tenantId}&limit=${limit}`);

export const getQuickActions = (tenantId: string) =>
  api.get(`/workspace/quick-actions?tenant_id=${tenantId}`);

export const getUpcomingMeetings = (tenantId: string, userId?: string) =>
  api.get(`/workspace/upcoming-meetings?tenant_id=${tenantId}${userId ? `&user_id=${userId}` : ''}`);

export const searchWorkspace = (tenantId: string, query: string, types?: string[]) =>
  api.get(`/workspace/search?tenant_id=${tenantId}&query=${query}${types ? `&types=${types.join(',')}` : ''}`);

// Meet
export const createMeeting = (data: { tenant_id: string; title: string; host_id: string; scheduled_start?: string }) =>
  api.post('/meet/rooms', data);

export const joinMeeting = (data: { room_name: string; user_id: string; user_name: string; tenant_id: string }) =>
  api.post('/meet/join', data);

export const getMeetings = (tenantId: string) =>
  api.get(`/meet/rooms?tenant_id=${tenantId}`);

export const getMeeting = (meetingId: string) =>
  api.get(`/meet/rooms/${meetingId}`);

export const endMeeting = (roomName: string) =>
  api.post(`/meet/rooms/${roomName}/end`);

// Docs
export const listFiles = (tenantId: string, path = '/') =>
  api.get(`/docs/files?tenant_id=${tenantId}&path=${encodeURIComponent(path)}`);

export const createFolder = (tenantId: string, path: string) =>
  api.post('/docs/folders', { tenant_id: tenantId, path });

export const uploadFile = (tenantId: string, path: string, file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post(`/docs/upload?tenant_id=${tenantId}&path=${encodeURIComponent(path)}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const deleteFile = (tenantId: string, path: string) =>
  api.delete(`/docs/files?tenant_id=${tenantId}&path=${encodeURIComponent(path)}`);

export const createShare = (path: string, shareType = 3, permissions = 1) =>
  api.post('/docs/share', { path, share_type: shareType, permissions });

export const getOnlyOfficeConfig = (tenantId: string, path: string, userId: string, userName: string, mode = 'edit') =>
  api.get(`/docs/onlyoffice/config?tenant_id=${tenantId}&path=${encodeURIComponent(path)}&user_id=${userId}&user_name=${userName}&mode=${mode}`);

// Mail
export const getMailboxes = (domain?: string) =>
  api.get(`/mail/mailboxes${domain ? `?domain=${domain}` : ''}`);

export const createMailbox = (data: { email: string; password: string; name: string; tenant_id: string }) =>
  api.post('/mail/mailboxes', data);

export const getDomains = (tenantId?: string) =>
  api.get(`/mail/domains${tenantId ? `?tenant_id=${tenantId}` : ''}`);

export const createDomain = (data: { domain: string; tenant_id: string }) =>
  api.post('/mail/domains', data);

// Recordings
export const getRecordings = (tenantId: string, meetingId?: string) =>
  api.get(`/recordings?tenant_id=${tenantId}${meetingId ? `&meeting_id=${meetingId}` : ''}`);

export const startRecording = (data: { meeting_id: string; tenant_id: string; user_id: string }) =>
  api.post('/recordings/start', data);

export const stopRecording = (recordingId: string) =>
  api.post(`/recordings/${recordingId}/stop`);

export const grantRecordingAccess = (recordingId: string, data: { user_id: string; user_email: string; expires_hours?: number; max_views?: number }) =>
  api.post(`/recordings/${recordingId}/access`, data);

// Tenants
export const getTenants = () =>
  api.get('/tenants');

export const getTenant = (tenantId: string) =>
  api.get(`/tenants/${tenantId}`);

export const createTenant = (data: { name: string; slug: string; owner_email: string; owner_name: string; plan?: string }) =>
  api.post('/tenants', data);

export const updateTenant = (tenantId: string, data: Partial<{ name: string; plan: string; max_users: number }>) =>
  api.put(`/tenants/${tenantId}`, data);

export const getTenantUsers = (tenantId: string) =>
  api.get(`/tenants/${tenantId}/users`);

export const addTenantUser = (tenantId: string, data: { email: string; name: string; role?: string }) =>
  api.post(`/tenants/${tenantId}/users`, data);

export const getTenantStats = (tenantId: string) =>
  api.get(`/tenants/${tenantId}/stats`);

export const getPlans = () =>
  api.get('/tenants/plans');
