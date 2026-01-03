import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useHotkeys } from 'react-hotkeys-hook';
import AppSwitcherBar from '@/components/shared/AppSwitcherBar';
import MailHeader from '@/components/mail/MailHeader';
import MailSidebar from '@/components/mail/MailSidebar';
import MailList from '@/components/mail/MailList';
import MailViewer from '@/components/mail/MailViewer';
import ComposeModal from '@/components/mail/ComposeModal';
import MailLoginOverlay from '@/components/mail/MailLoginOverlay';
import { useMailStore } from '@/stores/mailStore';
import { useCredentialsStore, useRequireMailAuth } from '@/stores/credentialsStore';
import { useRequireAuth } from '@/stores/authStore';
import type { Email } from '@/types/mail';

export default function MailPage() {
  const { isAuthenticated: isLoggedIn, isLoading: authLoading } = useRequireAuth();
  const { isAuthenticated: isMailAuth } = useRequireMailAuth();
  const { isMailAuthenticated } = useCredentialsStore();

  const {
    selectedEmail,
    selectEmail,
    isComposeOpen,
    openCompose,
    closeCompose,
    fetchFolders,
    fetchEmails,
    emails,
    deleteEmail,
    toggleStar,
  } = useMailStore();

  const [showLoginOverlay, setShowLoginOverlay] = useState(false);

  // Check if mail credentials exist
  useEffect(() => {
    if (!authLoading && isLoggedIn) {
      if (!isMailAuthenticated) {
        setShowLoginOverlay(true);
      } else {
        // Fetch data if authenticated
        fetchFolders();
        fetchEmails();
      }
    }
  }, [authLoading, isLoggedIn, isMailAuthenticated]);

  // Keyboard shortcuts
  useHotkeys('c', () => openCompose(), { enabled: !isComposeOpen });
  useHotkeys('j', () => navigateEmail('next'), { enabled: !isComposeOpen });
  useHotkeys('k', () => navigateEmail('prev'), { enabled: !isComposeOpen });
  useHotkeys('r', () => handleReply(), { enabled: !!selectedEmail && !isComposeOpen });
  useHotkeys('s', () => selectedEmail && toggleStar(selectedEmail.id), { enabled: !!selectedEmail });
  useHotkeys('delete', () => selectedEmail && deleteEmail(selectedEmail.id), { enabled: !!selectedEmail });
  useHotkeys('escape', () => closeCompose(), { enabled: isComposeOpen });

  const navigateEmail = (direction: 'next' | 'prev') => {
    if (!selectedEmail || emails.length === 0) return;

    const currentIndex = emails.findIndex((e) => e.id === selectedEmail.id);
    if (currentIndex === -1) return;

    const newIndex = direction === 'next'
      ? Math.min(currentIndex + 1, emails.length - 1)
      : Math.max(currentIndex - 1, 0);

    selectEmail(emails[newIndex]);
  };

  const handleReply = () => {
    if (!selectedEmail) return;
    openCompose({
      to: [selectedEmail.from.email],
      subject: selectedEmail.subject.startsWith('Re:')
        ? selectedEmail.subject
        : `Re: ${selectedEmail.subject}`,
      inReplyTo: selectedEmail.messageId,
      replyType: 'reply',
      originalEmail: selectedEmail,
    });
  };

  const handleSelectEmail = (email: Email) => {
    selectEmail(email);
  };

  const handleLoginSuccess = () => {
    setShowLoginOverlay(false);
    fetchFolders();
    fetchEmails();
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  // Show login overlay if not mail-authenticated
  if (showLoginOverlay || !isMailAuthenticated) {
    return <MailLoginOverlay onSuccess={handleLoginSuccess} />;
  }

  return (
    <>
      <Head>
        <title>Inbox | Bheem Mail</title>
      </Head>

      <div className="h-screen bg-gray-50">
        {/* App Switcher Bar (60px) */}
        <AppSwitcherBar activeApp="mail" />

        {/* Header */}
        <MailHeader />

        {/* Main Content - offset by header (56px) and app switcher (60px) */}
        <div className="flex h-[calc(100vh-56px)] mt-14 ml-[60px]">
          {/* Mail Sidebar - Folders */}
          <div className="w-60 flex-shrink-0 bg-white border-r border-gray-200">
            <MailSidebar onCompose={() => openCompose()} />
          </div>

          {/* Email List */}
          <div className="w-[400px] flex-shrink-0 bg-white border-r border-gray-200">
            <MailList
              onSelectEmail={handleSelectEmail}
              selectedEmailId={selectedEmail?.id}
            />
          </div>

          {/* Email Viewer */}
          <div className="flex-1 min-w-0 bg-gray-50">
            <MailViewer email={selectedEmail} />
          </div>
        </div>

        {/* Compose Modal */}
        {isComposeOpen && <ComposeModal onClose={closeCompose} />}
      </div>

      {/* Custom scrollbar styles */}
      <style jsx global>{`
        .mail-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .mail-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .mail-scrollbar::-webkit-scrollbar-thumb {
          background-color: #d1d5db;
          border-radius: 3px;
        }
        .mail-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #9ca3af;
        }
      `}</style>
    </>
  );
}
