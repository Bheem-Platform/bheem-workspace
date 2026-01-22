/**
 * Migration API Client
 * One-click migration from Google Workspace / Microsoft 365
 */

import { api } from './api';

// ==================== TYPES ====================

export interface MigrationConnection {
  id: string;
  provider: 'google' | 'microsoft' | 'imap';
  email: string;
  name?: string;
  created_at: string;
}

export interface MigrationPreview {
  email_count: number;
  contact_count: number;
  drive_file_count: number;
  drive_size_bytes: number;
  email_folders: string[];
}

export interface MigrationJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress_percent: number;
  current_task: string;

  email_status: string;
  email_progress: number;
  email_total: number;
  email_processed: number;

  contacts_status: string;
  contacts_progress: number;
  contacts_total: number;
  contacts_processed: number;

  drive_status: string;
  drive_progress: number;
  drive_total: number;
  drive_processed: number;
  bytes_transferred: number;

  errors: Array<{ error: string }>;
}

export interface StartMigrationRequest {
  connection_id: string;
  migrate_email: boolean;
  migrate_contacts: boolean;
  migrate_drive: boolean;
  email_folders?: string[];
  drive_folders?: string[];
}

// ==================== API FUNCTIONS ====================

/**
 * Get Google OAuth URL to connect account
 */
export const connectGoogle = async (): Promise<string> => {
  const response = await api.post<{ auth_url: string }>('/migration/connect/google', {});
  return response.data.auth_url;
};

/**
 * Get Microsoft OAuth URL to connect account
 */
export const connectMicrosoft = async (): Promise<string> => {
  const response = await api.post<{ auth_url: string }>('/migration/connect/microsoft', {});
  return response.data.auth_url;
};

/**
 * Connect via IMAP (for non-Google/Microsoft accounts)
 */
export const connectIMAP = async (data: {
  host: string;
  port: number;
  username: string;
  password: string;
  use_ssl: boolean;
}) => {
  const response = await api.post('/migration/connect/imap', data);
  return response.data;
};

/**
 * List connected migration accounts
 */
export const getConnections = async (): Promise<MigrationConnection[]> => {
  const response = await api.get<MigrationConnection[]>('/migration/connections');
  return response.data;
};

/**
 * Delete/disconnect a migration connection
 */
export const deleteConnection = async (connectionId: string): Promise<void> => {
  await api.delete(`/migration/connections/${connectionId}`);
};

/**
 * Get migration preview (counts and sizes)
 */
export const getPreview = async (connectionId: string): Promise<MigrationPreview> => {
  const response = await api.get<MigrationPreview>(`/migration/preview/${connectionId}`);
  return response.data;
};

/**
 * Start migration job
 */
export const startMigration = async (data: StartMigrationRequest): Promise<{ job_id: string }> => {
  const response = await api.post<{ job_id: string }>('/migration/start', data);
  return response.data;
};

/**
 * Get migration job status
 */
export const getJobStatus = async (jobId: string): Promise<MigrationJob> => {
  const response = await api.get<MigrationJob>(`/migration/jobs/${jobId}`);
  return response.data;
};

/**
 * Cancel a running migration job
 */
export const cancelJob = async (jobId: string): Promise<void> => {
  await api.post(`/migration/jobs/${jobId}/cancel`);
};

/**
 * List migration jobs
 */
export const getJobs = async (status?: string): Promise<MigrationJob[]> => {
  const params = status ? { status } : {};
  const response = await api.get<{ jobs: MigrationJob[] }>('/migration/jobs', { params });
  return response.data.jobs;
};

/**
 * Format bytes to human readable string
 */
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};
