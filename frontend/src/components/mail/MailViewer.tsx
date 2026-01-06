import { useState, useEffect } from 'react';
import {
  Reply,
  ReplyAll,
  Forward,
  Trash2,
  Archive,
  Star,
  MoreHorizontal,
  Paperclip,
  Download,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Printer,
  Tag,
  Mail,
  Eye,
  Sparkles,
  FileText,
  Loader2,
} from 'lucide-react';
import * as mailApi from '@/lib/mailApi';
import { useMailStore } from '@/stores/mailStore';
import EmptyState from '@/components/shared/EmptyState';
import CalendarEventDetector, { ICSAttachment } from './CalendarEventDetector';
import AttachmentPreview from './AttachmentPreview';
import type { Email, Attachment } from '@/types/mail';

interface MailViewerProps {
  email: Email | null;
}

export default function MailViewer({ email }: MailViewerProps) {
  const { deleteEmail, moveEmail, toggleStar, markAsRead, openCompose, currentFolder } = useMailStore();
  const [showDetails, setShowDetails] = useState(false);
  const [showImages, setShowImages] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<{ attachment: Attachment; index: number } | null>(null);

  // AI Features state
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [summary, setSummary] = useState<{ summary: string; key_points: string[]; action_items: string[]; sentiment: string } | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  // Fetch smart replies when email changes
  useEffect(() => {
    if (email) {
      setSmartReplies([]);
      setSummary(null);
      setShowSummary(false);
      fetchSmartReplies();
    }
  }, [email?.id]);

  const fetchSmartReplies = async () => {
    if (!email) return;
    setLoadingReplies(true);
    try {
      const result = await mailApi.aiSmartReplies(
        email.bodyHtml || email.body || email.bodyText || '',
        email.from.name || email.from.email,
        3
      );
      setSmartReplies(result.replies || []);
    } catch (error) {
      console.error('Failed to fetch smart replies:', error);
    } finally {
      setLoadingReplies(false);
    }
  };

  const fetchSummary = async () => {
    if (!email) return;
    setLoadingSummary(true);
    try {
      const result = await mailApi.aiSummarizeEmail(
        email.bodyHtml || email.body || email.bodyText || ''
      );
      setSummary(result);
      setShowSummary(true);
    } catch (error) {
      console.error('Failed to summarize email:', error);
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleSmartReply = (reply: string) => {
    if (!email) return;
    openCompose({
      to: [email.from.email],
      subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
      body: reply,
      inReplyTo: email.messageId,
      replyType: 'reply',
      originalEmail: email,
    });
  };

  // Handle reply/forward - must be defined before any conditional returns
  const handleReply = () => {
    if (!email) return;
    openCompose({
      to: [email.from.email],
      subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
      inReplyTo: email.messageId,
      replyType: 'reply',
      originalEmail: email,
    });
  };

  const handleReplyAll = () => {
    if (!email) return;
    const allRecipients = [
      email.from.email,
      ...email.to.map(t => t.email),
      ...(email.cc?.map(c => c.email) || []),
    ];
    // Remove duplicates
    const uniqueRecipients = Array.from(new Set(allRecipients));
    openCompose({
      to: uniqueRecipients,
      subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
      inReplyTo: email.messageId,
      replyType: 'replyAll',
      originalEmail: email,
    });
  };

  const handleForward = () => {
    if (!email) return;
    openCompose({
      subject: email.subject.startsWith('Fwd:') ? email.subject : `Fwd: ${email.subject}`,
      body: email.bodyHtml || email.body || '',
      replyType: 'forward',
      originalEmail: email,
    });
  };

  if (!email) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <EmptyState
          icon={Mail}
          title="Select an email"
          description="Choose an email from the list to view its contents"
        />
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString([], {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getInitials = (name: string, emailAddr: string) => {
    if (name) {
      return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return emailAddr.slice(0, 2).toUpperCase();
  };

  const handleDelete = () => {
    deleteEmail(email.id);
  };

  const handleArchive = () => {
    moveEmail(email.id, 'Archive');
  };

  const handleToggleStar = () => {
    toggleStar(email.id);
  };

  // Process HTML content
  const renderEmailBody = () => {
    if (email.bodyHtml) {
      // Add styling and handle images
      let html = email.bodyHtml;

      // Block remote images unless explicitly shown
      if (!showImages) {
        html = html.replace(/<img[^>]+src="http[^"]*"[^>]*>/gi, '');
      }

      return (
        <div
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }

    // Plain text fallback
    return (
      <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800">
        {email.body || email.bodyText}
      </pre>
    );
  };

  // Check if email has remote images
  const hasRemoteImages = email.bodyHtml?.includes('src="http');

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-gray-200">
        <div className="flex items-center gap-1">
          <button
            onClick={handleReply}
            className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Reply size={18} />
            <span className="text-sm font-medium">Reply</span>
          </button>
          <button
            onClick={handleReplyAll}
            className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ReplyAll size={18} />
            <span className="text-sm font-medium">Reply All</span>
          </button>
          <button
            onClick={handleForward}
            className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Forward size={18} />
            <span className="text-sm font-medium">Forward</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleToggleStar}
            className="p-2 text-gray-500 hover:text-amber-500 hover:bg-gray-100 rounded-lg"
          >
            <Star
              size={18}
              className={email.isStarred ? 'fill-amber-400 text-amber-400' : ''}
            />
          </button>
          <button
            onClick={handleArchive}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <Archive size={18} />
          </button>
          <button
            onClick={handleDelete}
            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
          >
            <Trash2 size={18} />
          </button>
          <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
            <Printer size={18} />
          </button>
          <button
            onClick={fetchSummary}
            disabled={loadingSummary}
            className="flex items-center gap-1 px-3 py-2 text-purple-600 hover:bg-purple-50 rounded-lg"
            title="AI Summary"
          >
            {loadingSummary ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Sparkles size={18} />
            )}
            <span className="text-sm font-medium">Summary</span>
          </button>
          <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
            <MoreHorizontal size={18} />
          </button>
        </div>
      </div>

      {/* Email Content */}
      <div className="flex-1 overflow-y-auto mail-scrollbar">
        {/* AI Summary Panel */}
        {showSummary && summary && (
          <div className="mx-6 mt-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-purple-600" />
                <span className="text-sm font-semibold text-purple-900">AI Summary</span>
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  summary.sentiment === 'positive' ? 'bg-green-100 text-green-700' :
                  summary.sentiment === 'negative' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {summary.sentiment}
                </span>
              </div>
              <button
                onClick={() => setShowSummary(false)}
                className="text-purple-400 hover:text-purple-600"
              >
                <ChevronUp size={16} />
              </button>
            </div>
            <p className="text-sm text-gray-700 mb-3">{summary.summary}</p>
            {summary.key_points.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-purple-700 mb-1">Key Points:</p>
                <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                  {summary.key_points.map((point, idx) => (
                    <li key={idx}>{point}</li>
                  ))}
                </ul>
              </div>
            )}
            {summary.action_items.length > 0 && (
              <div>
                <p className="text-xs font-medium text-purple-700 mb-1">Action Items:</p>
                <ul className="text-sm text-gray-600 space-y-1">
                  {summary.action_items.map((item, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <FileText size={12} className="text-purple-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Subject */}
        <div className="px-6 py-4 border-b border-gray-100">
          <h1 className="text-xl font-semibold text-gray-900">
            {email.subject || '(No Subject)'}
          </h1>
          {email.labels && email.labels.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              {email.labels.map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600"
                >
                  <Tag size={12} />
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Sender Info */}
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white font-medium"
              style={{
                background: `linear-gradient(135deg, ${stringToColor(email.from.email)} 0%, ${stringToColor(email.from.email + '2')} 100%)`,
              }}
            >
              {getInitials(email.from.name, email.from.email)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">
                  {email.from.name || email.from.email}
                </span>
                <span className="text-sm text-gray-500">
                  &lt;{email.from.email}&gt;
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                <span>to {email.to.map((t) => t.name || t.email).join(', ')}</span>
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>

              {/* Expanded Details */}
              {showDetails && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm space-y-1">
                  <div>
                    <span className="text-gray-500">From:</span>{' '}
                    <span className="text-gray-700">
                      {email.from.name} &lt;{email.from.email}&gt;
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">To:</span>{' '}
                    <span className="text-gray-700">
                      {email.to.map((t) => `${t.name || ''} <${t.email}>`).join(', ')}
                    </span>
                  </div>
                  {email.cc && email.cc.length > 0 && (
                    <div>
                      <span className="text-gray-500">Cc:</span>{' '}
                      <span className="text-gray-700">
                        {email.cc.map((c) => `${c.name || ''} <${c.email}>`).join(', ')}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-500">Date:</span>{' '}
                    <span className="text-gray-700">{formatDate(email.date)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="text-sm text-gray-500">
              {formatDate(email.date)}
            </div>
          </div>
        </div>

        {/* Calendar Event Detection */}
        <div className="px-6 mt-4">
          <CalendarEventDetector
            email={email}
            onAddToCalendar={(event) => {
              console.log('Event added to calendar:', event);
            }}
          />
        </div>

        {/* ICS Attachments (Calendar Invites) */}
        {email.attachments && email.attachments.some(att =>
          att.contentType === 'text/calendar' || att.filename.endsWith('.ics')
        ) && (
          <div className="px-6 mt-4 space-y-2">
            {email.attachments
              .map((att, idx) => ({ ...att, originalIndex: idx }))
              .filter(att => att.contentType === 'text/calendar' || att.filename.endsWith('.ics'))
              .map((att) => (
                <ICSAttachment
                  key={att.id}
                  attachment={att}
                  messageId={email.id}
                  attachmentIndex={att.originalIndex}
                />
              ))}
          </div>
        )}

        {/* Image Warning */}
        {hasRemoteImages && !showImages && (
          <div className="mx-6 mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center justify-between">
            <span className="text-sm text-yellow-800">
              Images are hidden for your privacy
            </span>
            <button
              onClick={() => setShowImages(true)}
              className="text-sm font-medium text-yellow-700 hover:text-yellow-800"
            >
              Show images
            </button>
          </div>
        )}

        {/* Email Body */}
        <div className="px-6 py-6">
          {renderEmailBody()}
        </div>

        {/* Attachments */}
        {email.attachments && email.attachments.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <Paperclip size={16} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-700">
                {email.attachments.length} Attachment{email.attachments.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {email.attachments.map((attachment, index) => (
                <AttachmentCard
                  key={attachment.id}
                  attachment={attachment}
                  onClick={() => setPreviewAttachment({ attachment, index })}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Attachment Preview Modal */}
      {previewAttachment && email && (
        <AttachmentPreview
          attachment={previewAttachment.attachment}
          attachments={email.attachments}
          messageId={email.id}
          attachmentIndex={previewAttachment.index}
          folder={currentFolder}
          onClose={() => setPreviewAttachment(null)}
        />
      )}

      {/* Smart Replies & Quick Reply */}
      <div className="flex-shrink-0 p-4 border-t border-gray-200 bg-gray-50">
        {/* Smart Reply Suggestions */}
        {(smartReplies.length > 0 || loadingReplies) && (
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={14} className="text-purple-500" />
              <span className="text-xs font-medium text-gray-500">Smart Replies</span>
              {loadingReplies && <Loader2 size={12} className="animate-spin text-purple-500" />}
            </div>
            <div className="flex flex-wrap gap-2">
              {smartReplies.map((reply, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSmartReply(reply)}
                  className="px-3 py-1.5 text-sm bg-white border border-purple-200 text-purple-700 rounded-full hover:bg-purple-50 hover:border-purple-300 transition-colors"
                >
                  {reply.length > 50 ? reply.substring(0, 50) + '...' : reply}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick Reply Box */}
        <button
          onClick={handleReply}
          className="w-full px-4 py-3 text-left text-gray-500 bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors"
        >
          Click here to reply...
        </button>
      </div>
    </div>
  );
}

// Attachment Card Component
function AttachmentCard({ attachment, onClick }: { attachment: Attachment; onClick?: () => void }) {
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = () => {
    const type = attachment.contentType;
    if (type.startsWith('image/')) return '🖼️';
    if (type.includes('pdf')) return '📄';
    if (type.includes('word') || type.includes('document')) return '📝';
    if (type.includes('sheet') || type.includes('excel')) return '📊';
    if (type.includes('zip') || type.includes('compressed')) return '🗜️';
    return '📎';
  };

  return (
    <div
      className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 cursor-pointer group transition-colors"
      onClick={onClick}
    >
      <span className="text-2xl">{getFileIcon()}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {attachment.filename}
        </p>
        <p className="text-xs text-gray-500">{formatSize(attachment.size)}</p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          className="p-1.5 text-gray-400 hover:text-orange-500"
          title="Preview"
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
        >
          <Eye size={16} />
        </button>
        <button
          className="p-1.5 text-gray-400 hover:text-gray-600"
          title="Download"
          onClick={(e) => e.stopPropagation()}
        >
          <Download size={16} />
        </button>
      </div>
    </div>
  );
}

// Helper to generate consistent colors from strings
function stringToColor(str: string): string {
  const colors = [
    '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b',
    '#ef4444', '#ec4899', '#06b6d4', '#6366f1',
  ];

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}
