/**
 * Bheem Mail Shared Mailbox Panel
 * Team inbox management with assignments and collaboration
 */
import { useState, useEffect } from 'react';
import {
  X,
  Users,
  Mail,
  UserPlus,
  MessageSquare,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronRight,
  RefreshCw,
  Filter,
  Settings,
  Plus,
} from 'lucide-react';
import * as mailApi from '@/lib/mailApi';

interface SharedMailboxPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMailbox?: (mailboxId: string) => void;
}

interface SharedMailbox {
  id: string;
  email: string;
  name: string;
  description?: string;
  role?: string;
  can_send?: boolean;
  can_delete?: boolean;
  unread_count?: number;
}

interface Assignment {
  id: string;
  mailbox_id: string;
  mailbox_name?: string;
  mailbox_email?: string;
  message_id: string;
  assigned_to?: string;
  assigned_by?: string;
  status: string;
  priority: string;
  due_date?: string;
  notes?: string;
  created_at?: string;
}

export default function SharedMailboxPanel({
  isOpen,
  onClose,
  onSelectMailbox,
}: SharedMailboxPanelProps) {
  const [view, setView] = useState<'mailboxes' | 'assignments'>('mailboxes');
  const [mailboxes, setMailboxes] = useState<SharedMailbox[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, view]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (view === 'mailboxes') {
        const data = await mailApi.listSharedMailboxes();
        setMailboxes(data.mailboxes || []);
      } else {
        const data = await mailApi.getMyAssignments();
        setAssignments(data.assignments || []);
      }
    } catch (error) {
      console.error('Failed to fetch shared mailbox data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'normal': return 'text-blue-600 bg-blue-100';
      case 'low': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved':
      case 'closed':
        return <CheckCircle size={16} className="text-green-500" />;
      case 'in_progress':
        return <Clock size={16} className="text-blue-500" />;
      case 'open':
        return <AlertCircle size={16} className="text-orange-500" />;
      default:
        return <Mail size={16} className="text-gray-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay */}
      <div className="flex-1 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="w-[450px] bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Users className="text-orange-500" size={24} />
            <h2 className="text-lg font-semibold text-gray-900">Team Inboxes</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setView('mailboxes')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              view === 'mailboxes'
                ? 'text-orange-600 border-b-2 border-orange-500'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <Mail size={16} />
              Shared Mailboxes
            </span>
          </button>
          <button
            onClick={() => setView('assignments')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              view === 'assignments'
                ? 'text-orange-600 border-b-2 border-orange-500'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <UserPlus size={16} />
              My Assignments
              {assignments.length > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-orange-100 text-orange-600 rounded-full">
                  {assignments.filter(a => a.status === 'open' || a.status === 'in_progress').length}
                </span>
              )}
            </span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <RefreshCw className="animate-spin text-gray-400" size={24} />
            </div>
          ) : view === 'mailboxes' ? (
            <MailboxesList
              mailboxes={mailboxes}
              onSelect={onSelectMailbox}
              onRefresh={fetchData}
            />
          ) : (
            <AssignmentsList
              assignments={assignments}
              onRefresh={fetchData}
            />
          )}
        </div>

        {/* Footer */}
        {view === 'mailboxes' && (
          <div className="px-6 py-4 border-t border-gray-200">
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
            >
              <Plus size={18} />
              <span>Create Shared Mailbox</span>
            </button>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateMailboxModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

// Mailboxes list component
function MailboxesList({
  mailboxes,
  onSelect,
  onRefresh,
}: {
  mailboxes: SharedMailbox[];
  onSelect?: (id: string) => void;
  onRefresh: () => void;
}) {
  if (mailboxes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center px-6">
        <Users size={48} className="text-gray-300 mb-3" />
        <p className="text-gray-600 font-medium">No shared mailboxes</p>
        <p className="text-sm text-gray-400 mt-1">
          Create a shared mailbox to collaborate with your team
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {mailboxes.map((mailbox) => (
        <button
          key={mailbox.id}
          onClick={() => onSelect?.(mailbox.id)}
          className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 text-left transition-colors"
        >
          <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center text-white font-semibold">
            {mailbox.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-gray-900 truncate">{mailbox.name}</p>
              <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded capitalize">
                {mailbox.role}
              </span>
            </div>
            <p className="text-sm text-gray-500 truncate">{mailbox.email}</p>
            {mailbox.description && (
              <p className="text-xs text-gray-400 truncate mt-0.5">{mailbox.description}</p>
            )}
          </div>
          {mailbox.unread_count && mailbox.unread_count > 0 && (
            <span className="px-2 py-1 text-xs font-semibold bg-orange-500 text-white rounded-full">
              {mailbox.unread_count}
            </span>
          )}
          <ChevronRight size={20} className="text-gray-400" />
        </button>
      ))}
    </div>
  );
}

// Assignments list component
function AssignmentsList({
  assignments,
  onRefresh,
}: {
  assignments: Assignment[];
  onRefresh: () => void;
}) {
  if (assignments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center px-6">
        <CheckCircle size={48} className="text-gray-300 mb-3" />
        <p className="text-gray-600 font-medium">No assignments</p>
        <p className="text-sm text-gray-400 mt-1">
          You don't have any emails assigned to you
        </p>
      </div>
    );
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-700';
      case 'high': return 'bg-orange-100 text-orange-700';
      case 'normal': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved':
      case 'closed':
        return 'text-green-600';
      case 'in_progress':
        return 'text-blue-600';
      default:
        return 'text-orange-600';
    }
  };

  return (
    <div className="divide-y divide-gray-100">
      {assignments.map((assignment) => (
        <div
          key={assignment.id}
          className="px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <div className="flex items-start gap-3">
            <div className={`mt-1 ${getStatusColor(assignment.status)}`}>
              {assignment.status === 'resolved' || assignment.status === 'closed' ? (
                <CheckCircle size={18} />
              ) : assignment.status === 'in_progress' ? (
                <Clock size={18} />
              ) : (
                <AlertCircle size={18} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-gray-900 truncate">
                  {assignment.mailbox_name}
                </p>
                <span className={`px-2 py-0.5 text-xs rounded-full capitalize ${getPriorityColor(assignment.priority)}`}>
                  {assignment.priority}
                </span>
              </div>
              <p className="text-sm text-gray-500 truncate mt-0.5">
                {assignment.mailbox_email}
              </p>
              {assignment.notes && (
                <p className="text-xs text-gray-400 mt-1 line-clamp-2">{assignment.notes}</p>
              )}
              {assignment.due_date && (
                <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                  <Clock size={12} />
                  Due: {new Date(assignment.due_date).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Create mailbox modal
function CreateMailboxModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.name) return;

    setLoading(true);
    setError(null);
    try {
      await mailApi.createSharedMailbox(formData);
      onCreated();
    } catch (err: any) {
      setError(err.message || 'Failed to create mailbox');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-[450px]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Create Shared Mailbox</h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mailbox Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="e.g., Support Team"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="support@yourcompany.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="What is this mailbox for?"
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.email || !formData.name}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Mailbox'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
