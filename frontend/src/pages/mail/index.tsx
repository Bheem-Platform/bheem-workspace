/**
 * Bheem Mail - Main Page
 * Gmail-like UI with Categories, Tabs, Snooze, and more
 */
import { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import { useHotkeys } from 'react-hotkeys-hook';
import AppSwitcherBar from '@/components/shared/AppSwitcherBar';
import MailHeader from '@/components/mail/MailHeader';
import GmailSidebar from '@/components/mail/GmailSidebar';
import MailList from '@/components/mail/MailList';
import MailViewer from '@/components/mail/MailViewer';
import ConversationView from '@/components/mail/ConversationView';
import ComposeModal from '@/components/mail/ComposeModal';
import MailLoginOverlay from '@/components/mail/MailLoginOverlay';
import MailSettings from '@/components/mail/MailSettings';
import AdvancedSearchModal from '@/components/mail/AdvancedSearchModal';
import SharedMailboxPanel from '@/components/mail/SharedMailboxPanel';
import { UndoSendToastManager } from '@/components/mail/UndoSendToast';
import { useMailStore } from '@/stores/mailStore';
import { useCredentialsStore, useRequireMailAuth } from '@/stores/credentialsStore';
import { useRequireAuth } from '@/stores/authStore';
import { useMailWebSocket } from '@/hooks/useMailWebSocket';
import type { Email } from '@/types/mail';

export default function MailPage() {
  const { isAuthenticated: isLoggedIn, isLoading: authLoading } = useRequireAuth();
  const { isAuthenticated: isMailAuth } = useRequireMailAuth();
  const { isMailAuthenticated, mailSession, checkMailSession, destroyMailSession } = useCredentialsStore();

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
    viewMode,
    setViewMode,
    searchEmails,
    currentFolder,
    setCurrentFolder,
    // Conversation/threading support
    selectedConversation,
    selectConversation,
    fetchConversations,
    conversations,
  } = useMailStore();

  const [showLoginOverlay, setShowLoginOverlay] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showSharedMailbox, setShowSharedMailbox] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'labels' | 'filters' | 'signatures' | 'templates' | 'vacation'>('labels');
  const [sessionVerified, setSessionVerified] = useState(false);

  // Gmail-like category and label state
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeLabel, setActiveLabel] = useState<string | null>(null);

  // Handle category change - fetch emails for the selected category
  const handleCategoryChange = useCallback(async (category: string, preserveLabel: boolean = false) => {
    setActiveCategory(category);
    // Only clear label if not preserving it (e.g., when user clicks category tab directly)
    if (!preserveLabel) {
      setActiveLabel(null);
    }
    console.log('[Mail] Category changed to:', category);

    // For 'all', fetch all inbox emails
    // For specific categories, we'll filter in MailList
    if (category === 'all') {
      setCurrentFolder('INBOX');
    }
    fetchEmails();
  }, [setCurrentFolder, fetchEmails]);

  // Handle label change
  const handleLabelChange = useCallback((label: string | null) => {
    setActiveLabel(label);
    if (label) {
      console.log('[Mail] Label changed to:', label);
      // Fetch emails for the new view
      fetchEmails();
    } else {
      console.log('[Mail] Label cleared');
    }
  }, [fetchEmails]);

  // WebSocket for real-time updates
  const { isConnected, subscribeFolder, unsubscribeFolder } = useMailWebSocket({
    onNewEmail: (folder) => {
      // Refresh the email list when new email arrives
      fetchEmails();
    },
    onEmailUpdated: (emailId, updateType) => {
      // Handle email updates (read status, star, etc.)
    },
    onFolderUpdated: (folder, unreadCount) => {
      // Handle folder count updates
      fetchFolders();
    },
  });

  // Verify session with backend on mount and when auth state changes
  useEffect(() => {
    const verifySession = async () => {
      if (!authLoading && isLoggedIn) {
        if (!isMailAuthenticated) {
          setShowLoginOverlay(true);
          setSessionVerified(true);
        } else {
          // Verify session with backend before proceeding
          try {
            const isValid = await checkMailSession();
            if (isValid) {
              // Session is valid, fetch data
              fetchFolders();
              fetchEmails();
              // Subscribe to INBOX for real-time updates
              subscribeFolder('INBOX');
            } else {
              // Session invalid, show login overlay
              setShowLoginOverlay(true);
            }
          } catch (error) {
            console.error('Session verification failed:', error);
            // Clear invalid session and show login
            destroyMailSession();
            setShowLoginOverlay(true);
          }
          setSessionVerified(true);
        }
      }
    };

    verifySession();
  }, [authLoading, isLoggedIn, isMailAuthenticated]);

  // Keyboard shortcuts
  useHotkeys('c', () => openCompose(), { enabled: !isComposeOpen });
  useHotkeys('j', () => navigateEmail('next'), { enabled: !isComposeOpen });
  useHotkeys('k', () => navigateEmail('prev'), { enabled: !isComposeOpen });
  useHotkeys('r', () => handleReply(), { enabled: !!selectedEmail && !isComposeOpen });
  useHotkeys('s', () => selectedEmail && toggleStar(selectedEmail.id), { enabled: !!selectedEmail });
  useHotkeys('delete', () => selectedEmail && deleteEmail(selectedEmail.id), { enabled: !!selectedEmail });
  useHotkeys('escape', () => closeCompose(), { enabled: isComposeOpen });
  useHotkeys('/', () => setShowAdvancedSearch(true), { enabled: !isComposeOpen });
  useHotkeys('g+s', () => setShowSettings(true), { enabled: !isComposeOpen });
  useHotkeys('g+t', () => setShowSharedMailbox(true), { enabled: !isComposeOpen });

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

  const handleAdvancedSearch = useCallback((params: any) => {
    searchEmails(params);
  }, [searchEmails]);

  const handleToggleViewMode = () => {
    setViewMode(viewMode === 'list' ? 'threaded' : 'list');
  };

  // Show loading while checking auth or verifying session
  if (authLoading || (!sessionVerified && isMailAuthenticated)) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto" />
          <p className="mt-4 text-gray-600 text-sm">Verifying mail session...</p>
        </div>
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
        <MailHeader
          onOpenAdvancedSearch={() => setShowAdvancedSearch(true)}
          onOpenSettings={() => setShowSettings(true)}
          onOpenSharedMailbox={() => setShowSharedMailbox(true)}
          onToggleViewMode={handleToggleViewMode}
          viewMode={viewMode}
        />

        {/* Main Content - offset by header (56px) and app switcher (60px) */}
        <div className="flex h-[calc(100vh-56px)] pt-14 ml-[60px]">
          {/* Gmail-like Sidebar - Categories, Labels, Bheem Apps */}
          <div className="w-64 flex-shrink-0 bg-white border-r border-gray-200 h-full overflow-hidden">
            <GmailSidebar
              onCompose={() => openCompose()}
              activeCategory={activeCategory}
              onCategoryChange={handleCategoryChange}
              activeLabel={activeLabel}
              onLabelChange={handleLabelChange}
            />
          </div>

          {/* Email List */}
          <div className="w-[400px] flex-shrink-0 bg-white border-r border-gray-200 h-full overflow-hidden">
            <MailList
              onSelectEmail={handleSelectEmail}
              selectedEmailId={selectedEmail?.id}
              activeCategory={activeCategory}
              activeLabel={activeLabel}
            />
          </div>

          {/* Email Viewer / Conversation View */}
          <div className="flex-1 min-w-0 bg-gray-50 h-full overflow-hidden">
            {viewMode === 'threaded' && selectedConversation ? (
              <ConversationView
                conversation={selectedConversation}
                onClose={() => selectConversation(null)}
              />
            ) : (
              <MailViewer email={selectedEmail} />
            )}
          </div>
        </div>

        {/* Compose Modal */}
        {isComposeOpen && <ComposeModal onClose={closeCompose} />}

        {/* Settings Modal */}
        <MailSettings
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          initialTab={settingsTab}
        />

        {/* Advanced Search Modal */}
        <AdvancedSearchModal
          isOpen={showAdvancedSearch}
          onClose={() => setShowAdvancedSearch(false)}
          onSearch={handleAdvancedSearch}
        />

        {/* Shared Mailbox Panel */}
        <SharedMailboxPanel
          isOpen={showSharedMailbox}
          onClose={() => setShowSharedMailbox(false)}
          onSelectMailbox={(id) => {
            console.log('Selected shared mailbox:', id);
            setShowSharedMailbox(false);
          }}
        />

        {/* Undo Send Toast Manager */}
        <UndoSendToastManager />

        {/* WebSocket Connection Status - hidden when WebSocket is disabled */}
        {/* TODO: Re-enable when WebSocket infrastructure is ready
        {!isConnected && isMailAuthenticated && (
          <div className="fixed bottom-4 right-4 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg text-sm flex items-center gap-2 shadow-lg">
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
            Reconnecting to real-time updates...
          </div>
        )}
        */}
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
