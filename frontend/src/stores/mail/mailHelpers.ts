/**
 * Shared helper functions for mail stores
 */
import { useCredentialsStore } from '../credentialsStore';
import type { MailFolder } from './mailTypes';

/**
 * Check if mail session is valid before API calls.
 * Returns true if authenticated, false otherwise.
 */
export function checkSession(): boolean {
  const { isMailAuthenticated, isSessionValid } = useCredentialsStore.getState();
  return isMailAuthenticated && isSessionValid();
}

/**
 * Get folder type from folder name
 */
export function getFolderType(name: string): MailFolder['type'] {
  const lower = name.toLowerCase();
  if (lower === 'inbox') return 'inbox';
  if (lower === 'sent' || lower.includes('sent')) return 'sent';
  if (lower === 'drafts' || lower.includes('draft')) return 'drafts';
  if (lower === 'spam' || lower === 'junk') return 'spam';
  if (lower === 'trash' || lower.includes('deleted')) return 'trash';
  if (lower === 'archive') return 'archive';
  return 'custom';
}

/**
 * Check if folder is a system folder
 */
export function isSystemFolder(name: string): boolean {
  const systemFolders = ['inbox', 'sent', 'drafts', 'spam', 'junk', 'trash', 'archive'];
  return systemFolders.includes(name.toLowerCase());
}

/**
 * Parse email address from various formats
 */
export function parseEmailAddress(input: any): { name: string; email: string } {
  if (!input) return { name: '', email: '' };

  if (typeof input === 'object' && input.email) {
    return { name: input.name || '', email: input.email };
  }

  if (typeof input === 'string') {
    const match = input.match(/^(.+?)\s*<(.+?)>$/);
    if (match) {
      return { name: match[1].trim(), email: match[2].trim() };
    }
    return { name: '', email: input.trim() };
  }

  return { name: '', email: '' };
}

/**
 * Handle API errors and return appropriate message
 */
export function handleApiError(error: any): string {
  if (error.response?.status === 401) {
    useCredentialsStore.getState().destroyMailSession();
    return 'Mail session expired. Please login again.';
  }
  return error.response?.data?.detail || error.message || 'An error occurred';
}
