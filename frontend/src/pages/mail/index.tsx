/**
 * Bheem Mail - Main Page
 * Gmail-like UI with Categories, Tabs, Snooze, and more
 * Updated with brand colors and responsive design
 */
import { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import { motion, AnimatePresence } from 'framer-motion';
import { useHotkeys } from 'react-hotkeys-hook';
import WorkspaceLayout from '@/components/workspace/WorkspaceLayout';
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
import * as mailApi from '@/lib/mailApi';
import type { Email } from '@/types/mail';

// Brand Colors
const BRAND = {
  pink: '#FFCCF2',
  purple: '#977DFF',
  blue: '#0033FF',
  gradient: 'from-[#FFCCF2] via-[#977DFF] to-[#0033FF]',
};

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showEmailViewer, setShowEmailViewer] = useState(false);

  // Gmail-like category and label state
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeLabel, setActiveLabel] = useState<string | null>(null);

  // Handle category change - fetch emails for the selected category
  const handleCategoryChange = useCallback(async (category: string, preserveLabel: boolean = false) => {
    setActiveCategory(category);
    if (!preserveLabel) {
      setActiveLabel(null);
    }
    console.log('[Mail] Category changed to:', category);

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
      fetchEmails();
    } else {
      console.log('[Mail] Label cleared');
    }
  }, [fetchEmails]);

  // WebSocket for real-time updates
  const { isConnected, subscribeFolder, unsubscribeFolder } = useMailWebSocket({
    onNewEmail: (folder) => {
      fetchEmails();
    },
    onEmailUpdated: (emailId, updateType) => {
      // Handle email updates (read status, star, etc.)
    },
    onFolderUpdated: (folder, unreadCount) => {
      fetchFolders();
    },
  });

  // Verify session with backend on mount and when auth state changes
  useEffect(() => {
    const verifySession = async () => {
      if (!authLoading && isLoggedIn) {
        try {
          const status = await mailApi.getMailSessionStatus();

          if (status.active && status.email && status.session_id) {
            console.log('[Mail] Found active backend session for:', status.email);

            const expiresAt = new Date(
              Date.now() + (status.expires_in_seconds || 86400) * 1000
            ).toISOString();

            useCredentialsStore.setState({
              mailSession: {
                email: status.email,
                sessionId: status.session_id,
                expiresAt,
                active: true,
              },
              isMailAuthenticated: true,
              error: null,
            });

            fetchFolders();
            fetchEmails();
            subscribeFolder('INBOX');
            setShowLoginOverlay(false);
          } else {
            console.log('[Mail] No active backend session, showing login');
            setShowLoginOverlay(true);
          }
        } catch (error) {
          console.error('[Mail] Session check failed:', error);
          destroyMailSession();
          setShowLoginOverlay(true);
        }
        setSessionVerified(true);
      }
    };

    verifySession();
  }, [authLoading, isLoggedIn]);

  // Keyboard shortcuts
  useHotkeys('c', () => openCompose(), { enabled: !isComposeOpen });
  useHotkeys('j', () => navigateEmail('next'), { enabled: !isComposeOpen });
  useHotkeys('k', () => navigateEmail('prev'), { enabled: !isComposeOpen });
  useHotkeys('r', () => handleReply(), { enabled: !!selectedEmail && !isComposeOpen });
  useHotkeys('s', () => selectedEmail && toggleStar(selectedEmail.id), { enabled: !!selectedEmail });
  useHotkeys('delete', () => selectedEmail && deleteEmail(selectedEmail.id), { enabled: !!selectedEmail });
  useHotkeys('escape', () => {
    if (isComposeOpen) closeCompose();
    else if (showEmailViewer) setShowEmailViewer(false);
  }, { enabled: isComposeOpen || showEmailViewer });
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
    // On mobile, show email viewer
    if (window.innerWidth < 1024) {
      setShowEmailViewer(true);
    }
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <motion.div
            className={`w-12 h-12 rounded-full border-2 border-transparent bg-gradient-to-r ${BRAND.gradient} mx-auto mb-4`}
            style={{ padding: '2px' }}
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          >
            <div className="w-full h-full rounded-full bg-gray-50" />
          </motion.div>
          <p className="text-gray-600 text-sm">Verifying mail session...</p>
        </div>
      </div>
    );
  }

  // Show login overlay if session verification determined we need login
  if (showLoginOverlay) {
    return <MailLoginOverlay onSuccess={handleLoginSuccess} />;
  }

  // Gmail sidebar component
  const gmailSidebar = (
    <GmailSidebar
      onCompose={() => openCompose()}
      activeCategory={activeCategory}
      onCategoryChange={handleCategoryChange}
      activeLabel={activeLabel}
      onLabelChange={handleLabelChange}
      isOpen={sidebarOpen}
      onClose={() => setSidebarOpen(false)}
    />
  );

  // Custom mail header
  const mailHeader = (
    <MailHeader
      onOpenAdvancedSearch={() => setShowAdvancedSearch(true)}
      onOpenSettings={() => setShowSettings(true)}
      onOpenSharedMailbox={() => setShowSharedMailbox(true)}
      onToggleViewMode={handleToggleViewMode}
      onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      viewMode={viewMode}
    />
  );

  return (
    <>
      <Head>
        <title>Inbox | Bheem Mail</title>
      </Head>

      <WorkspaceLayout
        title="Mail"
        secondarySidebar={gmailSidebar}
        secondarySidebarWidth={264}
        customHeader={mailHeader}
      >
        {/* Main Content - Email List + Viewer */}
        <div className="flex h-full bg-gray-50">
          {/* Email List - Full width on mobile, fixed width on desktop */}
          <div className={`
            ${showEmailViewer ? 'hidden lg:block' : 'w-full'}
            lg:w-[380px] xl:w-[420px] flex-shrink-0 bg-white border-r border-gray-200 h-full overflow-hidden
          `}>
            <MailList
              onSelectEmail={handleSelectEmail}
              selectedEmailId={selectedEmail?.id}
              activeCategory={activeCategory}
              activeLabel={activeLabel}
            />
          </div>

          {/* Email Viewer / Conversation View */}
          <AnimatePresence mode="wait">
            {/* Desktop: Always show viewer panel */}
            <div className="hidden lg:block flex-1 min-w-0 h-full overflow-hidden">
              {viewMode === 'threaded' && selectedConversation ? (
                <ConversationView
                  conversation={selectedConversation}
                  onClose={() => selectConversation(null)}
                />
              ) : (
                <MailViewer email={selectedEmail} />
              )}
            </div>

            {/* Mobile: Show viewer as overlay */}
            {showEmailViewer && (
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="lg:hidden fixed inset-0 z-30 bg-white"
              >
                {/* Mobile viewer header */}
                <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
                  <button
                    onClick={() => setShowEmailViewer(false)}
                    className="p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <span className="text-sm font-medium text-gray-900 truncate flex-1">
                    {selectedEmail?.subject || 'Email'}
                  </span>
                </div>
                <div className="h-[calc(100%-57px)] overflow-auto">
                  {viewMode === 'threaded' && selectedConversation ? (
                    <ConversationView
                      conversation={selectedConversation}
                      onClose={() => {
                        selectConversation(null);
                        setShowEmailViewer(false);
                      }}
                    />
                  ) : (
                    <MailViewer email={selectedEmail} />
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
      </WorkspaceLayout>

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
