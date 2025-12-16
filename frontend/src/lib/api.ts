import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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
