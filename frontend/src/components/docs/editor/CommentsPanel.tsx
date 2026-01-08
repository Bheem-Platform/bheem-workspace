/**
 * Bheem Docs - Comments Panel
 * Sidebar for viewing and managing document comments
 */
import { useState, useEffect } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Reply,
  MoreVertical,
  Check,
  CheckCheck,
  Trash2,
  Edit2,
  AtSign,
  Smile,
} from 'lucide-react';
import { format } from 'date-fns';

interface Comment {
  id: string;
  content: string;
  user: {
    id: string;
    name: string;
    avatar?: string;
    email: string;
  };
  position?: {
    start: number;
    end: number;
  };
  selection_text?: string;
  replies: Comment[];
  reactions: { emoji: string; users: string[] }[];
  resolved: boolean;
  created_at: string;
  updated_at: string;
}

interface CommentsPanelProps {
  documentId: string;
  comments: Comment[];
  currentUser: { id: string; name: string; email: string; avatar?: string };
  onAddComment: (content: string, position?: { start: number; end: number }, selectionText?: string) => void;
  onReply: (commentId: string, content: string) => void;
  onResolve: (commentId: string) => void;
  onDelete: (commentId: string) => void;
  onEdit: (commentId: string, content: string) => void;
  onReact: (commentId: string, emoji: string) => void;
  onClose: () => void;
  selectedText?: { text: string; start: number; end: number };
}

const EMOJI_OPTIONS = ['👍', '👎', '❤️', '😄', '😮', '🎉', '🤔', '👀'];

export default function CommentsPanel({
  documentId,
  comments,
  currentUser,
  onAddComment,
  onReply,
  onResolve,
  onDelete,
  onEdit,
  onReact,
  onClose,
  selectedText,
}: CommentsPanelProps) {
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [mentionSearch, setMentionSearch] = useState('');

  const filteredComments = comments.filter((comment) => {
    if (filter === 'open') return !comment.resolved;
    if (filter === 'resolved') return comment.resolved;
    return true;
  });

  const handleSubmitComment = () => {
    if (!newComment.trim()) return;
    onAddComment(
      newComment,
      selectedText ? { start: selectedText.start, end: selectedText.end } : undefined,
      selectedText?.text
    );
    setNewComment('');
  };

  const handleSubmitReply = (commentId: string) => {
    if (!replyContent.trim()) return;
    onReply(commentId, replyContent);
    setReplyContent('');
    setReplyingTo(null);
  };

  const handleSaveEdit = (commentId: string) => {
    if (!editContent.trim()) return;
    onEdit(commentId, editContent);
    setEditingComment(null);
    setEditContent('');
  };

  const CommentItem = ({ comment, isReply = false }: { comment: Comment; isReply?: boolean }) => (
    <div className={`${isReply ? 'ml-8 mt-3' : 'border-b'} ${comment.resolved ? 'opacity-60' : ''}`}>
      <div className="p-4">
        {/* Selection highlight */}
        {comment.selection_text && !isReply && (
          <div className="mb-3 px-3 py-2 bg-yellow-50 border-l-4 border-yellow-400 text-sm text-gray-700 italic">
            "{comment.selection_text}"
          </div>
        )}

        {/* Comment header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-medium">
              {comment.user.avatar ? (
                <img src={comment.user.avatar} alt="" className="w-full h-full rounded-full" />
              ) : (
                comment.user.name.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">{comment.user.name}</p>
              <p className="text-xs text-gray-500">
                {format(new Date(comment.created_at), 'MMM d, yyyy h:mm a')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {comment.resolved && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCheck size={12} />
                Resolved
              </span>
            )}
            <div className="relative">
              <button
                onClick={() => setShowEmojiPicker(showEmojiPicker === comment.id ? null : comment.id)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <Smile size={16} className="text-gray-400" />
              </button>
              {showEmojiPicker === comment.id && (
                <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg p-2 flex gap-1 z-10">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => { onReact(comment.id, emoji); setShowEmojiPicker(null); }}
                      className="hover:bg-gray-100 p-1 rounded text-lg"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {comment.user.id === currentUser.id && (
              <>
                <button
                  onClick={() => { setEditingComment(comment.id); setEditContent(comment.content); }}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <Edit2 size={14} className="text-gray-400" />
                </button>
                <button
                  onClick={() => onDelete(comment.id)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <Trash2 size={14} className="text-gray-400" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Comment content */}
        {editingComment === comment.id ? (
          <div className="mt-3">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => setEditingComment(null)}
                className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveEdit(comment.id)}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{comment.content}</p>
        )}

        {/* Reactions */}
        {comment.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {comment.reactions.map((reaction, idx) => (
              <button
                key={idx}
                onClick={() => onReact(comment.id, reaction.emoji)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${
                  reaction.users.includes(currentUser.id)
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <span>{reaction.emoji}</span>
                <span>{reaction.users.length}</span>
              </button>
            ))}
          </div>
        )}

        {/* Actions */}
        {!isReply && (
          <div className="flex items-center gap-4 mt-3">
            <button
              onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <Reply size={14} />
              Reply
            </button>
            {!comment.resolved && (
              <button
                onClick={() => onResolve(comment.id)}
                className="text-xs text-green-600 hover:text-green-800 flex items-center gap-1"
              >
                <Check size={14} />
                Resolve
              </button>
            )}
          </div>
        )}

        {/* Reply input */}
        {replyingTo === comment.id && (
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Write a reply..."
              className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmitReply(comment.id)}
              autoFocus
            />
            <button
              onClick={() => handleSubmitReply(comment.id)}
              disabled={!replyContent.trim()}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Send size={16} />
            </button>
          </div>
        )}

        {/* Replies */}
        {comment.replies.map((reply) => (
          <CommentItem key={reply.id} comment={reply} isReply />
        ))}
      </div>
    </div>
  );

  return (
    <div className="w-80 bg-white border-l flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <MessageSquare size={20} className="text-blue-600" />
          <h2 className="font-semibold">Comments</h2>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {comments.length}
          </span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X size={18} />
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex border-b">
        {(['all', 'open', 'resolved'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 py-2 text-sm font-medium capitalize ${
              filter === f
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* New comment */}
      {selectedText && (
        <div className="p-4 border-b bg-blue-50">
          <p className="text-xs text-blue-600 mb-2">Comment on selected text:</p>
          <p className="text-sm italic text-gray-700 mb-3">"{selectedText.text}"</p>
        </div>
      )}
      <div className="p-4 border-b">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          className="w-full px-3 py-2 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500"
          rows={3}
        />
        <div className="flex justify-between items-center mt-2">
          <button className="p-1 hover:bg-gray-100 rounded text-gray-400">
            <AtSign size={18} />
          </button>
          <button
            onClick={handleSubmitComment}
            disabled={!newComment.trim()}
            className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Comment
          </button>
        </div>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto">
        {filteredComments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <MessageSquare size={48} strokeWidth={1} />
            <p className="mt-2 text-sm">No comments yet</p>
            <p className="text-xs">Select text to add a comment</p>
          </div>
        ) : (
          filteredComments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))
        )}
      </div>
    </div>
  );
}
