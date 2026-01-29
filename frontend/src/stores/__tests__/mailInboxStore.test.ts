/**
 * Mail Inbox Store Tests
 */

import { act, renderHook } from '@testing-library/react';
import { useMailInboxStore } from '../mail/mailInboxStore';
import * as mailApi from '@/lib/mailApi';

// Mock the mail API
jest.mock('@/lib/mailApi');
const mockMailApi = mailApi as jest.Mocked<typeof mailApi>;

// Mock credentials store
jest.mock('../credentialsStore', () => ({
  useCredentialsStore: {
    getState: () => ({
      isMailAuthenticated: true,
      isSessionValid: () => true,
      destroyMailSession: jest.fn(),
    }),
  },
}));

// ===========================================
// Setup
// ===========================================

beforeEach(() => {
  // Reset store state
  useMailInboxStore.setState({
    folders: [],
    emails: [],
    selectedEmail: null,
    currentFolder: 'INBOX',
    selectedEmails: [],
    pagination: {
      page: 1,
      limit: 50,
      total: 0,
      hasMore: false,
    },
    loading: {
      folders: false,
      emails: false,
      email: false,
      action: false,
    },
    error: null,
  });

  jest.clearAllMocks();
});

// ===========================================
// Tests
// ===========================================

describe('Mail Inbox Store', () => {
  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useMailInboxStore());

      expect(result.current.folders).toEqual([]);
      expect(result.current.emails).toEqual([]);
      expect(result.current.selectedEmail).toBeNull();
      expect(result.current.currentFolder).toBe('INBOX');
      expect(result.current.error).toBeNull();
    });
  });

  describe('fetchFolders', () => {
    it('should fetch and set folders', async () => {
      mockMailApi.getFolders.mockResolvedValue({
        folders: ['INBOX', 'Sent', 'Drafts', 'Trash'],
      });

      const { result } = renderHook(() => useMailInboxStore());

      await act(async () => {
        await result.current.fetchFolders();
      });

      expect(result.current.folders).toHaveLength(4);
      expect(result.current.folders[0]).toMatchObject({
        id: 'INBOX',
        name: 'INBOX',
        type: 'inbox',
      });
    });

    it('should set loading state while fetching', async () => {
      let resolvePromise: (value: any) => void;
      mockMailApi.getFolders.mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
      );

      const { result } = renderHook(() => useMailInboxStore());

      act(() => {
        result.current.fetchFolders();
      });

      expect(result.current.loading.folders).toBe(true);

      await act(async () => {
        resolvePromise!({ folders: ['INBOX'] });
      });

      expect(result.current.loading.folders).toBe(false);
    });

    it('should handle errors', async () => {
      mockMailApi.getFolders.mockRejectedValue({
        response: { data: { detail: 'Failed to fetch' } },
      });

      const { result } = renderHook(() => useMailInboxStore());

      await act(async () => {
        await result.current.fetchFolders();
      });

      expect(result.current.error).toBe('Failed to fetch');
    });
  });

  describe('fetchEmails', () => {
    it('should fetch and set emails', async () => {
      const mockEmails = [
        {
          id: '1',
          message_id: '1',
          from: 'test@example.com',
          to: ['recipient@example.com'],
          subject: 'Test Email',
          body: 'Test body',
          date: '2024-01-01T00:00:00Z',
          is_read: false,
        },
      ];

      mockMailApi.getMessages.mockResolvedValue({
        messages: mockEmails,
        total: 1,
      });

      mockMailApi.bulkCategorizeEmails.mockResolvedValue({});

      const { result } = renderHook(() => useMailInboxStore());

      await act(async () => {
        await result.current.fetchEmails('INBOX');
      });

      expect(result.current.emails).toHaveLength(1);
      expect(result.current.emails[0]).toMatchObject({
        id: '1',
        subject: 'Test Email',
      });
    });

    it('should update currentFolder', async () => {
      mockMailApi.getMessages.mockResolvedValue({ messages: [], total: 0 });

      const { result } = renderHook(() => useMailInboxStore());

      await act(async () => {
        await result.current.fetchEmails('Sent');
      });

      expect(result.current.currentFolder).toBe('Sent');
    });
  });

  describe('selectEmail', () => {
    it('should select an email', async () => {
      const mockEmail = {
        id: '1',
        messageId: '1',
        from: { name: 'Test', email: 'test@example.com' },
        to: [{ name: 'Recipient', email: 'recipient@example.com' }],
        cc: [],
        subject: 'Test Email',
        body: 'Test body',
        bodyHtml: '',
        date: '2024-01-01T00:00:00Z',
        isRead: true,
        isStarred: false,
        isFlagged: false,
        hasAttachments: false,
        attachments: [],
        folder: 'INBOX',
        labels: [],
      };

      mockMailApi.getMessage.mockResolvedValue(mockEmail);

      const { result } = renderHook(() => useMailInboxStore());

      await act(async () => {
        result.current.selectEmail(mockEmail);
      });

      expect(result.current.selectedEmail).toMatchObject({
        id: '1',
        subject: 'Test Email',
      });
    });

    it('should clear selection when null is passed', () => {
      const { result } = renderHook(() => useMailInboxStore());

      act(() => {
        result.current.selectEmail(null);
      });

      expect(result.current.selectedEmail).toBeNull();
    });
  });

  describe('toggleStar', () => {
    it('should toggle star optimistically', async () => {
      mockMailApi.toggleStar.mockResolvedValue({});

      const { result } = renderHook(() => useMailInboxStore());

      // Set up initial email
      act(() => {
        useMailInboxStore.setState({
          emails: [
            {
              id: '1',
              messageId: '1',
              from: { name: 'Test', email: 'test@example.com' },
              to: [],
              cc: [],
              subject: 'Test',
              body: '',
              bodyHtml: '',
              date: '',
              isRead: false,
              isStarred: false,
              isFlagged: false,
              hasAttachments: false,
              attachments: [],
              folder: 'INBOX',
              labels: [],
            },
          ],
        });
      });

      await act(async () => {
        await result.current.toggleStar('1');
      });

      expect(result.current.emails[0]?.isStarred).toBe(true);
    });

    it('should revert on API failure', async () => {
      mockMailApi.toggleStar.mockRejectedValue(new Error('Failed'));

      const { result } = renderHook(() => useMailInboxStore());

      act(() => {
        useMailInboxStore.setState({
          emails: [
            {
              id: '1',
              messageId: '1',
              from: { name: 'Test', email: 'test@example.com' },
              to: [],
              cc: [],
              subject: 'Test',
              body: '',
              bodyHtml: '',
              date: '',
              isRead: false,
              isStarred: false,
              isFlagged: false,
              hasAttachments: false,
              attachments: [],
              folder: 'INBOX',
              labels: [],
            },
          ],
        });
      });

      await act(async () => {
        await result.current.toggleStar('1');
      });

      expect(result.current.emails[0]?.isStarred).toBe(false);
    });
  });

  describe('Selection Actions', () => {
    it('should select multiple emails', () => {
      const { result } = renderHook(() => useMailInboxStore());

      act(() => {
        result.current.selectMultipleEmails(['1', '2', '3']);
      });

      expect(result.current.selectedEmails).toEqual(['1', '2', '3']);
    });

    it('should toggle email selection', () => {
      const { result } = renderHook(() => useMailInboxStore());

      act(() => {
        result.current.toggleEmailSelection('1');
      });
      expect(result.current.selectedEmails).toContain('1');

      act(() => {
        result.current.toggleEmailSelection('1');
      });
      expect(result.current.selectedEmails).not.toContain('1');
    });

    it('should clear selection', () => {
      const { result } = renderHook(() => useMailInboxStore());

      act(() => {
        result.current.selectMultipleEmails(['1', '2']);
        result.current.clearSelection();
      });

      expect(result.current.selectedEmails).toEqual([]);
    });
  });

  describe('reset', () => {
    it('should reset store to initial state', () => {
      const { result } = renderHook(() => useMailInboxStore());

      act(() => {
        useMailInboxStore.setState({
          currentFolder: 'Sent',
          error: 'Some error',
          selectedEmails: ['1', '2'],
        });
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.currentFolder).toBe('INBOX');
      expect(result.current.error).toBeNull();
      expect(result.current.selectedEmails).toEqual([]);
    });
  });
});
