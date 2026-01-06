/**
 * Bheem Mail Conversation/Thread View
 * Gmail-style threaded conversation display
 */
import { useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Reply,
  ReplyAll,
  Forward,
  Star,
  Trash2,
  Archive,
  MoreHorizontal,
  Paperclip,
  Clock,
  User,
  Users,
} from 'lucide-react';
import { useMailStore, useReplyToEmail, useReplyAllToEmail, useForwardEmail } from '@/stores/mailStore';
import * as mailApi from '@/lib/mailApi';
import type { Email, Conversation } from '@/types/mail';

interface ConversationViewProps {
  conversation: Conversation | null;
  onClose?: () => void;
}

export default function ConversationView({ conversation, onClose }: ConversationViewProps) {
  const { toggleStar, deleteEmail, moveEmail } = useMailStore();
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // Auto-expand the latest message
  useEffect(() => {
    if (conversation?.messages?.length) {
      const latestId = conversation.messages[conversation.messages.length - 1].id;
      setExpandedMessages(new Set([latestId]));
    }
  }, [conversation?.thread_id]);

  if (!conversation) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Users size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Select a conversation to view</p>
        </div>
      </div>
    );
  }

  const toggleExpand = (messageId: string) => {
    setExpandedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedMessages(new Set(conversation.messages.map((m) => m.id)));
  };

  const collapseAll = () => {
    // Keep only the latest expanded
    const latestId = conversation.messages[conversation.messages.length - 1].id;
    setExpandedMessages(new Set([latestId]));
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  const getParticipants = () => {
    const participants = new Set<string>();
    conversation.messages.forEach((m) => {
      participants.add(m.from.name || m.from.email);
      m.to.forEach((t) => participants.add(t.name || t.email));
    });
    return Array.from(participants).slice(0, 5);
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Conversation Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-gray-900 truncate">
              {conversation.subject || '(No Subject)'}
            </h1>
            <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
              <Users size={14} />
              <span>{getParticipants().join(', ')}</span>
              <span className="text-gray-300">•</span>
              <span>{conversation.messages.length} messages</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={expandAll}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Expand all
            </button>
            <button
              onClick={collapseAll}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Collapse
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {conversation.messages.map((message, index) => (
          <ConversationMessage
            key={message.id}
            message={message}
            isExpanded={expandedMessages.has(message.id)}
            isFirst={index === 0}
            isLast={index === conversation.messages.length - 1}
            onToggle={() => toggleExpand(message.id)}
            onStar={() => toggleStar(message.id)}
            onDelete={() => deleteEmail(message.id)}
            onArchive={() => moveEmail(message.id, 'Archive')}
          />
        ))}
      </div>

      {/* Quick Reply */}
      <div className="flex-shrink-0 p-4 border-t border-gray-200 bg-gray-50">
        <QuickReply conversation={conversation} />
      </div>
    </div>
  );
}

// Individual message in conversation
interface ConversationMessageProps {
  message: Email;
  isExpanded: boolean;
  isFirst: boolean;
  isLast: boolean;
  onToggle: () => void;
  onStar: () => void;
  onDelete: () => void;
  onArchive: () => void;
}

function ConversationMessage({
  message,
  isExpanded,
  isFirst,
  isLast,
  onToggle,
  onStar,
  onDelete,
  onArchive,
}: ConversationMessageProps) {
  const handleReply = useReplyToEmail(message);
  const handleReplyAll = useReplyAllToEmail(message);
  const handleForward = useForwardEmail(message);
  const [showActions, setShowActions] = useState(false);

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email?.slice(0, 2).toUpperCase() || '?';
  };

  const stringToColor = (str: string): string => {
    const colors = [
      '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b',
      '#ef4444', '#ec4899', '#06b6d4', '#6366f1',
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      className={`border rounded-lg transition-all ${
        isExpanded ? 'border-gray-300 shadow-sm' : 'border-gray-200 hover:border-gray-300'
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Message Header - Always visible */}
      <div
        onClick={onToggle}
        className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-gray-50 rounded-t-lg"
      >
        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium flex-shrink-0"
          style={{ backgroundColor: stringToColor(message.from.email) }}
        >
          {getInitials(message.from.name, message.from.email)}
        </div>

        {/* Sender & Preview */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">
              {message.from.name || message.from.email}
            </span>
            {!message.isRead && (
              <span className="w-2 h-2 bg-blue-500 rounded-full" />
            )}
          </div>
          {!isExpanded && (
            <p className="text-sm text-gray-500 truncate">
              {message.bodyText?.slice(0, 100) || message.body?.slice(0, 100) || ''}
            </p>
          )}
        </div>

        {/* Date & Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {message.hasAttachments && (
            <Paperclip size={14} className="text-gray-400" />
          )}
          <span className="text-sm text-gray-500">
            {formatDate(message.date)}
          </span>
          {showActions && (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={onStar}
                className="p-1 text-gray-400 hover:text-amber-500 rounded"
              >
                <Star size={16} className={message.isStarred ? 'fill-amber-400 text-amber-400' : ''} />
              </button>
            </div>
          )}
          {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-100">
          {/* Recipients */}
          <div className="px-4 py-2 bg-gray-50 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <span className="text-gray-400">to</span>
              <span>{message.to.map((t) => t.name || t.email).join(', ')}</span>
              {message.cc && message.cc.length > 0 && (
                <>
                  <span className="text-gray-400">cc</span>
                  <span>{message.cc.map((c) => c.name || c.email).join(', ')}</span>
                </>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="px-4 py-4">
            {message.bodyHtml ? (
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: message.bodyHtml }}
              />
            ) : (
              <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800">
                {message.body || message.bodyText}
              </pre>
            )}
          </div>

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2 mb-2">
                <Paperclip size={14} className="text-gray-400" />
                <span className="text-sm text-gray-600">
                  {message.attachments.length} attachment{message.attachments.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {message.attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm hover:border-gray-300"
                  >
                    <span className="truncate max-w-32">{att.filename}</span>
                    <span className="text-gray-400 text-xs">
                      {(att.size / 1024).toFixed(1)}KB
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100">
            <button
              onClick={handleReply}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <Reply size={16} />
              Reply
            </button>
            <button
              onClick={handleReplyAll}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <ReplyAll size={16} />
              Reply all
            </button>
            <button
              onClick={handleForward}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <Forward size={16} />
              Forward
            </button>
            <div className="flex-1" />
            <button
              onClick={onArchive}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
            >
              <Archive size={16} />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Quick reply component
function QuickReply({ conversation }: { conversation: Conversation }) {
  const { openCompose } = useMailStore();
  const lastMessage = conversation.messages[conversation.messages.length - 1];

  const handleQuickReply = () => {
    openCompose({
      to: [lastMessage.from.email],
      subject: conversation.subject.startsWith('Re:')
        ? conversation.subject
        : `Re: ${conversation.subject}`,
      inReplyTo: lastMessage.messageId,
      replyType: 'reply',
      originalEmail: lastMessage,
    });
  };

  const handleReplyAll = () => {
    const recipients = new Set<string>();
    recipients.add(lastMessage.from.email);
    lastMessage.to.forEach((t) => recipients.add(t.email));
    if (lastMessage.cc) {
      lastMessage.cc.forEach((c) => recipients.add(c.email));
    }

    openCompose({
      to: Array.from(recipients),
      subject: conversation.subject.startsWith('Re:')
        ? conversation.subject
        : `Re: ${conversation.subject}`,
      inReplyTo: lastMessage.messageId,
      replyType: 'replyAll',
      originalEmail: lastMessage,
    });
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleQuickReply}
        className="flex-1 px-4 py-2.5 text-left text-gray-500 bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors"
      >
        Click to reply...
      </button>
      <button
        onClick={handleReplyAll}
        className="px-3 py-2.5 text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
        title="Reply all"
      >
        <ReplyAll size={18} />
      </button>
    </div>
  );
}
