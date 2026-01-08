/**
 * Bheem Docs - Workflow/Approval Panel
 * Document approval workflow management
 */
import { useState } from 'react';
import {
  GitPullRequest,
  X,
  Send,
  Check,
  XCircle,
  Clock,
  User,
  MessageSquare,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Circle,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';

interface WorkflowStep {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'approved' | 'rejected' | 'skipped';
  assignee?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  completed_at?: string;
  comments?: string;
}

interface WorkflowStatus {
  status: 'draft' | 'pending_review' | 'approved' | 'rejected';
  submitted_at?: string;
  reviewed_at?: string;
  submitted_by?: { id: string; name: string };
  reviewed_by?: { id: string; name: string };
  comments?: string;
  steps: WorkflowStep[];
}

interface WorkflowPanelProps {
  documentId: string;
  workflowStatus: WorkflowStatus;
  onSubmit: (approvers: string[], message: string) => Promise<void>;
  onApprove: (comments?: string) => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  onClose: () => void;
  canApprove: boolean;
  isOwner: boolean;
}

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-700',
  pending_review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

const STATUS_ICONS = {
  draft: Circle,
  pending_review: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
};

export default function WorkflowPanel({
  documentId,
  workflowStatus,
  onSubmit,
  onApprove,
  onReject,
  onClose,
  canApprove,
  isOwner,
}: WorkflowPanelProps) {
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [approverEmails, setApproverEmails] = useState('');
  const [submitMessage, setSubmitMessage] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [approveComment, setApproveComment] = useState('');
  const [loading, setLoading] = useState(false);

  const StatusIcon = STATUS_ICONS[workflowStatus.status];

  const handleSubmitForApproval = async () => {
    if (!approverEmails.trim()) return;

    setLoading(true);
    try {
      const approvers = approverEmails.split(',').map((e) => e.trim()).filter(Boolean);
      await onSubmit(approvers, submitMessage);
      setShowSubmitForm(false);
      setApproverEmails('');
      setSubmitMessage('');
    } catch (err) {
      console.error('Failed to submit:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setLoading(true);
    try {
      await onApprove(approveComment || undefined);
      setApproveComment('');
    } catch (err) {
      console.error('Failed to approve:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;

    setLoading(true);
    try {
      await onReject(rejectReason);
      setShowRejectForm(false);
      setRejectReason('');
    } catch (err) {
      console.error('Failed to reject:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-80 bg-white border-l flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <GitPullRequest size={20} className="text-indigo-600" />
          <h2 className="font-semibold">Approval Workflow</h2>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X size={18} />
        </button>
      </div>

      {/* Current Status */}
      <div className="px-4 py-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-500">Status</span>
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
              STATUS_COLORS[workflowStatus.status]
            }`}
          >
            <StatusIcon size={12} />
            {workflowStatus.status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          </span>
        </div>

        {workflowStatus.submitted_at && (
          <div className="text-xs text-gray-500">
            Submitted on {format(new Date(workflowStatus.submitted_at), 'MMM d, yyyy h:mm a')}
            {workflowStatus.submitted_by && ` by ${workflowStatus.submitted_by.name}`}
          </div>
        )}

        {workflowStatus.reviewed_at && (
          <div className="text-xs text-gray-500 mt-1">
            Reviewed on {format(new Date(workflowStatus.reviewed_at), 'MMM d, yyyy h:mm a')}
            {workflowStatus.reviewed_by && ` by ${workflowStatus.reviewed_by.name}`}
          </div>
        )}

        {workflowStatus.comments && (
          <div className="mt-3 p-2 bg-gray-50 rounded-lg text-sm text-gray-700">
            <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
              <MessageSquare size={12} />
              Review Comments
            </div>
            {workflowStatus.comments}
          </div>
        )}
      </div>

      {/* Workflow Steps */}
      {workflowStatus.steps && workflowStatus.steps.length > 0 && (
        <div className="px-4 py-4 border-b">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Approval Steps</h3>
          <div className="space-y-3">
            {workflowStatus.steps.map((step, index) => (
              <div key={step.id} className="flex items-start gap-3">
                {/* Step indicator */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      step.status === 'approved'
                        ? 'bg-green-500 text-white'
                        : step.status === 'rejected'
                        ? 'bg-red-500 text-white'
                        : step.status === 'in_progress'
                        ? 'bg-yellow-500 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {step.status === 'approved' ? (
                      <Check size={14} />
                    ) : step.status === 'rejected' ? (
                      <X size={14} />
                    ) : (
                      index + 1
                    )}
                  </div>
                  {index < workflowStatus.steps.length - 1 && (
                    <div className="w-0.5 h-8 bg-gray-200 my-1" />
                  )}
                </div>

                {/* Step content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{step.name}</p>
                  {step.assignee && (
                    <p className="text-xs text-gray-500">{step.assignee.name}</p>
                  )}
                  {step.completed_at && (
                    <p className="text-xs text-gray-400">
                      {format(new Date(step.completed_at), 'MMM d, h:mm a')}
                    </p>
                  )}
                  {step.comments && (
                    <p className="text-xs text-gray-600 mt-1 italic">"{step.comments}"</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Submit for Approval (Owner, Draft status) */}
        {isOwner && workflowStatus.status === 'draft' && (
          <>
            {!showSubmitForm ? (
              <button
                onClick={() => setShowSubmitForm(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                <Send size={18} />
                Submit for Approval
              </button>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Approvers (comma-separated emails)
                  </label>
                  <input
                    type="text"
                    value={approverEmails}
                    onChange={(e) => setApproverEmails(e.target.value)}
                    placeholder="approver@example.com"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Message (optional)
                  </label>
                  <textarea
                    value={submitMessage}
                    onChange={(e) => setSubmitMessage(e.target.value)}
                    placeholder="Add a message for the reviewers..."
                    className="w-full px-3 py-2 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-indigo-500"
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowSubmitForm(false)}
                    className="flex-1 px-3 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitForApproval}
                    disabled={!approverEmails.trim() || loading}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    Submit
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Approve/Reject (Approver, Pending status) */}
        {canApprove && workflowStatus.status === 'pending_review' && (
          <div className="space-y-4">
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-700">
                <AlertCircle size={16} />
                <span className="text-sm font-medium">Awaiting your review</span>
              </div>
              <p className="text-xs text-yellow-600 mt-1">
                Please review this document and approve or reject it.
              </p>
            </div>

            {/* Approve */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Comments (optional)
              </label>
              <textarea
                value={approveComment}
                onChange={(e) => setApproveComment(e.target.value)}
                placeholder="Add approval comments..."
                className="w-full px-3 py-2 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-green-500"
                rows={2}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleApprove}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Approve
              </button>
              <button
                onClick={() => setShowRejectForm(true)}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                <XCircle size={16} />
                Reject
              </button>
            </div>

            {/* Reject Form */}
            {showRejectForm && (
              <div className="mt-4 p-4 border border-red-200 rounded-lg bg-red-50">
                <label className="block text-sm font-medium text-red-700 mb-1">
                  Rejection Reason (required)
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Please explain why you're rejecting..."
                  className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-red-500"
                  rows={3}
                  autoFocus
                />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setShowRejectForm(false)}
                    className="flex-1 px-3 py-2 text-sm text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={!rejectReason.trim() || loading}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                    Confirm Reject
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Status Messages */}
        {workflowStatus.status === 'approved' && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
            <CheckCircle2 size={32} className="mx-auto text-green-500 mb-2" />
            <p className="font-medium text-green-700">Document Approved</p>
            <p className="text-sm text-green-600 mt-1">
              This document has been approved and is ready for use.
            </p>
          </div>
        )}

        {workflowStatus.status === 'rejected' && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-center">
            <XCircle size={32} className="mx-auto text-red-500 mb-2" />
            <p className="font-medium text-red-700">Document Rejected</p>
            <p className="text-sm text-red-600 mt-1">
              Please review the feedback and make necessary changes.
            </p>
            {isOwner && (
              <button
                onClick={() => setShowSubmitForm(true)}
                className="mt-3 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
              >
                Resubmit for Approval
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
