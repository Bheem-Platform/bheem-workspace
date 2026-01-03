'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Send,
  Smile,
  Search,
  Download,
  MoreVertical,
  Edit2,
  Trash2,
  Reply,
} from 'lucide-react';
import { useMeetStore } from '@/stores/meetStore';
import { MeetAvatar } from './ui';
import type { EnhancedChatMessage } from '@/types/meet';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface MessageItemProps {
  message: EnhancedChatMessage;
  isOwnMessage: boolean;
  onReact: (emoji: string) => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

function MessageItem({ message, isOwnMessage, onReact, onEdit, onDelete }: MessageItemProps) {
  const [showReactions, setShowReactions] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const totalReactions = Object.values(message.reactions || {}).reduce(
    (sum, users) => sum + users.length,
    0
  );

  if (message.messageType === 'system') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-2"
      >
        <span className="text-xs text-gray-500 bg-gray-800/50 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group relative ${isOwnMessage ? 'flex flex-row-reverse' : 'flex'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowReactions(false);
      }}
    >
      {/* Avatar */}
      {!isOwnMessage && (
        <MeetAvatar name={message.senderName} size="sm" className="flex-shrink-0 mt-1" />
      )}

      {/* Message content */}
      <div className={`flex-1 min-w-0 mx-2 max-w-[240px] ${isOwnMessage ? 'items-end' : ''}`}>
        {!isOwnMessage && (
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-xs font-medium text-gray-400">{message.senderName}</span>
            <span className="text-xs text-gray-600">{formatTime(message.createdAt)}</span>
          </div>
        )}

        <div
          className={`
            relative px-3 py-2 rounded-2xl text-sm
            ${message.isDeleted
              ? 'bg-gray-800/50 text-gray-500 italic'
              : isOwnMessage
                ? 'bg-emerald-600 text-white rounded-br-md'
                : 'bg-gray-700/80 text-gray-100 rounded-bl-md'
            }
          `}
        >
          {message.content}
          {message.isEdited && (
            <span className="text-xs opacity-60 ml-1">(edited)</span>
          )}
        </div>

        {isOwnMessage && (
          <div className="flex items-center justify-end gap-1 mt-1">
            <span className="text-xs text-gray-600">{formatTime(message.createdAt)}</span>
          </div>
        )}

        {/* Reactions display */}
        {totalReactions > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {Object.entries(message.reactions || {}).map(([emoji, users]) => (
              users.length > 0 && (
                <motion.button
                  key={emoji}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => onReact(emoji)}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-gray-700/80 hover:bg-gray-600 rounded-full text-xs"
                >
                  <span>{emoji}</span>
                  <span className="text-gray-400">{users.length}</span>
                </motion.button>
              )
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <AnimatePresence>
        {isHovered && !message.isDeleted && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`absolute top-0 flex items-center gap-0.5 ${isOwnMessage ? 'left-0' : 'right-0'}`}
          >
            {/* Reaction button */}
            <div className="relative">
              <button
                onClick={() => setShowReactions(!showReactions)}
                className="p-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
              >
                <Smile size={14} />
              </button>

              {/* Reaction picker */}
              <AnimatePresence>
                {showReactions && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute bottom-full mb-1 left-0 flex gap-0.5 p-1.5 bg-gray-800 rounded-xl shadow-xl border border-gray-700"
                  >
                    {REACTION_EMOJIS.map((emoji) => (
                      <motion.button
                        key={emoji}
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => {
                          onReact(emoji);
                          setShowReactions(false);
                        }}
                        className="p-1 hover:bg-gray-700 rounded-lg text-base"
                      >
                        {emoji}
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Edit/Delete for own messages */}
            {isOwnMessage && (
              <>
                <button
                  onClick={onEdit}
                  className="p-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={onDelete}
                  className="p-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-red-400 hover:bg-gray-700 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface ChatPanelProps {
  onClose?: () => void;
  onSendMessage?: (message: string) => void;
}

export default function ChatPanel({ onClose, onSendMessage }: ChatPanelProps) {
  const {
    chatMessages,
    loading,
    isChatPanelOpen,
    toggleChatPanel,
    loadChatMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    addReaction,
    exportChat,
  } = useMeetStore();

  const [message, setMessage] = useState('');
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentUserId = typeof window !== 'undefined'
    ? localStorage.getItem('userId') || 'current-user'
    : 'current-user';

  useEffect(() => {
    if (isChatPanelOpen) {
      loadChatMessages();
    }
  }, [isChatPanelOpen, loadChatMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSend = async () => {
    if (!message.trim()) return;
    await sendMessage(message);
    if (onSendMessage) {
      onSendMessage(message);
    }
    setMessage('');
    inputRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEdit = async () => {
    if (!editingMessage || !editContent.trim()) return;
    await editMessage(editingMessage, editContent);
    setEditingMessage(null);
    setEditContent('');
  };

  const handleExport = async () => {
    const result = await exportChat('txt');
    if (result && typeof result === 'string') {
      const blob = new Blob([result], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'chat-export.txt';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      toggleChatPanel();
    }
  };

  const messages: EnhancedChatMessage[] = chatMessages.map((msg: any) => ({
    id: msg.id,
    roomCode: msg.roomCode || '',
    senderId: msg.senderId,
    senderName: msg.senderName,
    senderAvatar: msg.senderAvatar,
    content: msg.content,
    messageType: msg.messageType || msg.type || 'text',
    replyToId: msg.replyToId,
    reactions: msg.reactions || {},
    isEdited: msg.isEdited || false,
    isDeleted: msg.isDeleted || false,
    createdAt: msg.createdAt || msg.timestamp,
    updatedAt: msg.updatedAt,
  }));

  const filteredMessages = searchQuery
    ? messages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  return (
    <div className="h-full bg-gray-900/95 backdrop-blur-lg flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h3 className="font-semibold text-white">Chat</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`p-2 rounded-lg transition-colors ${showSearch ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
          >
            <Search size={18} />
          </button>
          <button
            onClick={handleExport}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
            title="Export chat"
          >
            <Download size={18} />
          </button>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Search */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 py-2 border-b border-gray-800 overflow-hidden"
          >
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search messages..."
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {loading.chat ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Send size={24} className="text-gray-600" />
            </div>
            <p className="text-sm text-gray-400">No messages yet</p>
            <p className="text-xs text-gray-600 mt-1">
              Messages are visible to everyone in the call
            </p>
          </div>
        ) : (
          <>
            {filteredMessages.map((msg) => (
              <MessageItem
                key={msg.id}
                message={msg}
                isOwnMessage={msg.senderId === currentUserId}
                onReact={(emoji) => addReaction(msg.id, emoji)}
                onEdit={() => {
                  setEditingMessage(msg.id);
                  setEditContent(msg.content);
                }}
                onDelete={() => deleteMessage(msg.id)}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Edit mode */}
      <AnimatePresence>
        {editingMessage && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 py-2 bg-gray-800/50 border-t border-gray-700 overflow-hidden"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="flex-1 bg-gray-700 text-white text-sm rounded-xl px-3 py-2 border border-gray-600 focus:border-emerald-500 focus:outline-none"
                onKeyPress={(e) => e.key === 'Enter' && handleEdit()}
                autoFocus
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleEdit}
                className="p-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl"
              >
                <Edit2 size={16} />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setEditingMessage(null);
                  setEditContent('');
                }}
                className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-xl"
              >
                <X size={16} />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 bg-gray-800 text-white text-sm rounded-xl px-4 py-3 border border-gray-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSend}
            disabled={!message.trim()}
            className="p-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl transition-colors"
          >
            <Send size={18} />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
