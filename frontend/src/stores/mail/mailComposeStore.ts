/**
 * Mail Compose Store - Email composition and sending
 */
import { create } from 'zustand';
import * as mailApi from '@/lib/mailApi';
import { checkSession, handleApiError } from './mailHelpers';
import type { ComposeEmail, Email } from './mailTypes';

interface MailComposeState {
  // UI State
  isComposeOpen: boolean;
  composeData: Partial<ComposeEmail>;

  // Loading
  loading: {
    send: boolean;
  };

  // Error
  error: string | null;

  // Actions
  sendEmail: (email: ComposeEmail) => Promise<boolean>;
  openCompose: (prefill?: Partial<ComposeEmail>) => void;
  closeCompose: () => void;
  updateComposeData: (data: Partial<ComposeEmail>) => void;
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  isComposeOpen: false,
  composeData: {} as Partial<ComposeEmail>,
  loading: {
    send: false,
  },
  error: null as string | null,
};

export const useMailComposeStore = create<MailComposeState>((set, get) => ({
  ...initialState,

  // ===========================================
  // Send email
  // ===========================================
  sendEmail: async (email: ComposeEmail) => {
    if (!checkSession()) {
      set({ error: 'Mail session expired. Please login again.' });
      return false;
    }

    set((state) => ({ loading: { ...state.loading, send: true }, error: null }));

    try {
      await mailApi.sendEmail({
        to: email.to,
        cc: email.cc,
        bcc: email.bcc,
        subject: email.subject,
        body: email.body,
        isHtml: email.isHtml,
        inReplyTo: email.inReplyTo,
      });

      set({ isComposeOpen: false, composeData: {} });
      return true;
    } catch (error: any) {
      set({ error: handleApiError(error) });
      return false;
    } finally {
      set((state) => ({ loading: { ...state.loading, send: false } }));
    }
  },

  // ===========================================
  // Open compose
  // ===========================================
  openCompose: (prefill?: Partial<ComposeEmail>) => {
    set({
      isComposeOpen: true,
      composeData: prefill || {},
    });
  },

  // ===========================================
  // Close compose
  // ===========================================
  closeCompose: () => {
    set({ isComposeOpen: false, composeData: {} });
  },

  // ===========================================
  // Update compose data
  // ===========================================
  updateComposeData: (data: Partial<ComposeEmail>) => {
    set((state) => ({
      composeData: { ...state.composeData, ...data },
    }));
  },

  // ===========================================
  // Clear error
  // ===========================================
  clearError: () => {
    set({ error: null });
  },

  // ===========================================
  // Reset
  // ===========================================
  reset: () => {
    set(initialState);
  },
}));

// ===========================================
// Hooks for common compose operations
// ===========================================

/**
 * Hook to create a reply to an email
 */
export function useReplyToEmail(email: Email) {
  const { openCompose } = useMailComposeStore();

  return () => {
    openCompose({
      to: [email.from.email],
      subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
      inReplyTo: email.messageId,
      replyType: 'reply',
      originalEmail: email,
    });
  };
}

/**
 * Hook to create a reply-all to an email
 */
export function useReplyAllToEmail(email: Email, currentUserEmail?: string) {
  const { openCompose } = useMailComposeStore();

  return () => {
    const allRecipients = [
      email.from.email,
      ...email.to.map((t) => t.email),
    ].filter((e) => e !== currentUserEmail);

    openCompose({
      to: allRecipients,
      cc: email.cc?.map((c) => c.email),
      subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
      inReplyTo: email.messageId,
      replyType: 'replyAll',
      originalEmail: email,
    });
  };
}

/**
 * Hook to forward an email
 */
export function useForwardEmail(email: Email) {
  const { openCompose } = useMailComposeStore();

  return () => {
    openCompose({
      subject: email.subject.startsWith('Fwd:') ? email.subject : `Fwd: ${email.subject}`,
      body: `\n\n---------- Forwarded message ---------\nFrom: ${email.from.name} <${email.from.email}>\nDate: ${new Date(email.date).toLocaleString()}\nSubject: ${email.subject}\n\n${email.body}`,
      replyType: 'forward',
      originalEmail: email,
    });
  };
}
