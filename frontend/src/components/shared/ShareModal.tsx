/**
 * Share Modal Component
 * Reusable modal for sharing documents (Sheets, Slides, Docs)
 */
import { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  Link,
  Mail,
  Users,
  Globe,
  Lock,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentType: 'sheet' | 'slide' | 'doc';
  documentTitle: string;
}

type AccessLevel = 'private' | 'anyone_with_link' | 'public';
type Permission = 'view' | 'comment' | 'edit';

export default function ShareModal({
  isOpen,
  onClose,
  documentId,
  documentType,
  documentTitle,
}: ShareModalProps) {
  const [accessLevel, setAccessLevel] = useState<AccessLevel>('private');
  const [linkPermission, setLinkPermission] = useState<Permission>('view');
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState('');
  const [emailPermission, setEmailPermission] = useState<Permission>('view');
  const [invitedUsers, setInvitedUsers] = useState<Array<{email: string, permission: Permission}>>([]);
  const [showAccessDropdown, setShowAccessDropdown] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Generate share link
  const getShareLink = () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const typeMap = {
      sheet: 'sheets',
      slide: 'slides',
      doc: 'docs',
    };
    return `${baseUrl}/${typeMap[documentType]}/${documentId}`;
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(getShareLink());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleInvite = () => {
    if (!email.trim()) return;

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert('Please enter a valid email address');
      return;
    }

    setInvitedUsers([...invitedUsers, { email: email.trim(), permission: emailPermission }]);
    setEmail('');
  };

  const handleRemoveUser = (emailToRemove: string) => {
    setInvitedUsers(invitedUsers.filter(u => u.email !== emailToRemove));
  };

  const handleSave = async () => {
    if (invitedUsers.length === 0) {
      onClose();
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      // Determine the API endpoint based on document type
      // Docs uses v2 API, sheets and slides use their own endpoints
      const getShareEndpoint = () => {
        if (documentType === 'doc') {
          return `/docs/v2/documents/${documentId}/share`;
        } else if (documentType === 'sheet') {
          return `/sheets/${documentId}/share`;
        } else if (documentType === 'slide') {
          return `/slides/${documentId}/share`;
        }
        return `/docs/v2/documents/${documentId}/share`;
      };

      // Build the share request
      const shareData = {
        access_level: accessLevel,
        link_permission: linkPermission,
        invites: invitedUsers.map(user => ({
          email: user.email,
          permission: user.permission,
          send_notification: true,
        })),
      };

      // Call the share API
      const response = await api.post(getShareEndpoint(), shareData);

      console.log('Share response:', response.data);

      // Show success message
      setSaveSuccess(true);

      // Check for email errors
      if (response.data.email_errors && response.data.email_errors.length > 0) {
        console.warn('Some email notifications failed:', response.data.email_errors);
      }

      // Close after a short delay to show success
      setTimeout(() => {
        setInvitedUsers([]);
        setSaveSuccess(false);
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Failed to share:', err);
      setSaveError(err.response?.data?.detail || 'Failed to share. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const accessOptions = [
    { value: 'private', label: 'Restricted', icon: Lock, description: 'Only people added can open' },
    { value: 'anyone_with_link', label: 'Anyone with the link', icon: Link, description: 'Anyone with the link can access' },
  ];

  const permissionOptions = [
    { value: 'view', label: 'Viewer' },
    { value: 'comment', label: 'Commenter' },
    { value: 'edit', label: 'Editor' },
  ];

  const getTypeColor = () => {
    switch (documentType) {
      case 'sheet': return 'green';
      case 'slide': return 'orange';
      case 'doc': return 'blue';
      default: return 'purple';
    }
  };

  const color = getTypeColor();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Share "{documentTitle}"
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* Add people section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Add people
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email address"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-offset-0 focus:ring-blue-500 focus:border-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleInvite();
                    }
                  }}
                />
              </div>
              <select
                value={emailPermission}
                onChange={(e) => setEmailPermission(e.target.value as Permission)}
                className="px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-offset-0 focus:ring-blue-500 focus:border-blue-500"
              >
                {permissionOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <button
                onClick={handleInvite}
                disabled={!email.trim()}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  email.trim()
                    ? `bg-${color}-600 hover:bg-${color}-700 text-white`
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
                style={{
                  backgroundColor: email.trim() ? (color === 'green' ? '#16a34a' : color === 'orange' ? '#ea580c' : '#2563eb') : undefined,
                }}
              >
                Invite
              </button>
            </div>
          </div>

          {/* Invited users list */}
          {invitedUsers.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                People with access
              </label>
              {invitedUsers.map((user, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-600">
                        {user.email.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-sm text-gray-900">{user.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 capitalize">{user.permission}</span>
                    <button
                      onClick={() => handleRemoveUser(user.email)}
                      className="p-1 text-gray-400 hover:text-red-500 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* General access section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              General access
            </label>
            <div className="relative">
              <button
                onClick={() => setShowAccessDropdown(!showAccessDropdown)}
                className="w-full flex items-center justify-between p-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {accessLevel === 'private' ? (
                    <Lock className="w-5 h-5 text-gray-500" />
                  ) : (
                    <Globe className="w-5 h-5 text-green-500" />
                  )}
                  <div className="text-left">
                    <div className="text-sm font-medium text-gray-900">
                      {accessLevel === 'private' ? 'Restricted' : 'Anyone with the link'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {accessLevel === 'private'
                        ? 'Only people added can open'
                        : 'Anyone on the internet with the link can access'}
                    </div>
                  </div>
                </div>
                <ChevronDown className="w-5 h-5 text-gray-400" />
              </button>

              {showAccessDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                  {accessOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setAccessLevel(option.value as AccessLevel);
                        setShowAccessDropdown(false);
                      }}
                      className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                    >
                      <option.icon className="w-5 h-5 text-gray-500" />
                      <div className="text-left">
                        <div className="text-sm font-medium text-gray-900">{option.label}</div>
                        <div className="text-xs text-gray-500">{option.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {accessLevel === 'anyone_with_link' && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm text-gray-600">Permission:</span>
                <select
                  value={linkPermission}
                  onChange={(e) => setLinkPermission(e.target.value as Permission)}
                  className="px-2 py-1 text-sm border border-gray-300 rounded bg-white"
                >
                  {permissionOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Copy link section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Share link
            </label>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center px-3 py-2 bg-gray-100 rounded-lg">
                <Link className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
                <span className="text-sm text-gray-600 truncate">
                  {getShareLink()}
                </span>
              </div>
              <button
                onClick={handleCopyLink}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  copied
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Error message */}
        {saveError && (
          <div className="mx-6 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{saveError}</p>
          </div>
        )}

        {/* Success message */}
        {saveSuccess && (
          <div className="mx-6 mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-700 flex items-center gap-2">
              <Check className="w-4 h-4" />
              Shared successfully! Email notifications sent.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || saveSuccess}
            className="px-4 py-2 rounded-lg font-medium text-white transition-colors disabled:opacity-50 flex items-center gap-2"
            style={{
              backgroundColor: color === 'green' ? '#16a34a' : color === 'orange' ? '#ea580c' : '#2563eb',
            }}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sharing...
              </>
            ) : saveSuccess ? (
              <>
                <Check className="w-4 h-4" />
                Done
              </>
            ) : (
              'Done'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
