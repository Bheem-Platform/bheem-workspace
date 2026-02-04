/**
 * ConversationInfoPanel - Slide-out panel showing conversation details
 *
 * Features:
 * - Direct chat: User info, email, company
 * - Group chat: Member list with admin badges, search members
 * - Shared media & files section
 * - Actions: Mute, Pin, Archive, Leave chat, Remove members (admin only)
 */

'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import {
  X,
  Mail,
  Building2,
  Calendar,
  BellOff,
  Bell,
  Archive,
  ArchiveRestore,
  Image as ImageIcon,
  FileText,
  Link as LinkIcon,
  Video,
  ExternalLink,
  Download,
  ChevronRight,
  ChevronDown,
  Users,
  MessageSquare,
  Loader2,
  Pin,
  PinOff,
  LogOut,
  UserMinus,
  UserPlus,
  Search,
  Shield,
  Crown,
  Camera,
  Edit2,
  Check,
} from 'lucide-react';
import {
  useChatStore,
  type Conversation,
  type Participant,
} from '@/stores/chatStore';

interface ConversationInfoPanelProps {
  conversation: Conversation;
  currentUserId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ConversationInfoPanel({
  conversation,
  currentUserId,
  isOpen,
  onClose,
}: ConversationInfoPanelProps) {
  const {
    sharedFiles,
    conversationStats,
    archiveConversation,
    unarchiveConversation,
    muteConversation,
    pinConversation,
    leaveConversation,
    removeGroupMember,
    addGroupMembers,
    updateGroupDetails,
    fetchConversations,
    fetchSharedFiles,
    updateGroupAvatar,
    searchTeamMembers,
    teamMembers,
  } = useChatStore();

  const [isMuted, setIsMuted] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [showMedia, setShowMedia] = useState(true);
  const [showMembers, setShowMembers] = useState(true);
  const [memberSearch, setMemberSearch] = useState('');
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Edit group name state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  // Add members state
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState('');
  const [selectedNewMembers, setSelectedNewMembers] = useState<Array<{id: string; name: string; email?: string; avatar?: string}>>([]);
  const [isAddingMembers, setIsAddingMembers] = useState(false);

  // Get current user's participant info
  const currentUserParticipant = useMemo(() => {
    return conversation.participants.find((p) => p.user_id === currentUserId);
  }, [conversation.participants, currentUserId]);

  // Check if current user is admin/owner
  const isAdmin = useMemo(() => {
    return currentUserParticipant?.role === 'admin' || currentUserParticipant?.role === 'owner';
  }, [currentUserParticipant]);

  // Filter members by search
  const filteredMembers = useMemo(() => {
    if (!memberSearch) return conversation.participants.filter((p) => !p.left_at);
    const search = memberSearch.toLowerCase();
    return conversation.participants.filter(
      (p) => !p.left_at && (
        p.user_name.toLowerCase().includes(search) ||
        p.user_email?.toLowerCase().includes(search)
      )
    );
  }, [conversation.participants, memberSearch]);

  // Get participant info for direct chats
  const getOtherParticipant = () => {
    return conversation.participants.find((p) => p.user_id !== currentUserId);
  };

  const other = conversation.type === 'direct' ? getOtherParticipant() : null;

  // Initialize state from participant
  useEffect(() => {
    if (currentUserParticipant) {
      setIsMuted(currentUserParticipant.is_muted || false);
    }
  }, [currentUserParticipant]);

  // Fetch shared files when panel opens
  useEffect(() => {
    if (isOpen && conversation?.id) {
      fetchSharedFiles(conversation.id);
    }
  }, [isOpen, conversation?.id, fetchSharedFiles]);

  const handleToggleMute = async () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    await muteConversation(conversation.id, newMuted);
  };

  const handleTogglePin = async () => {
    const newPinned = !isPinned;
    setIsPinned(newPinned);
    await pinConversation(conversation.id, newPinned);
  };

  const handleArchive = async () => {
    if (conversation.is_archived) {
      await unarchiveConversation(conversation.id);
    } else {
      await archiveConversation(conversation.id);
    }
    onClose();
    fetchConversations();
  };

  const handleLeaveGroup = async () => {
    if (confirm('Are you sure you want to leave this group?')) {
      await leaveConversation(conversation.id);
      onClose();
      fetchConversations();
    }
  };

  // Handle group avatar upload
  const handleAvatarClick = () => {
    if (conversation.type === 'group' && isAdmin) {
      avatarInputRef.current?.click();
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size should be less than 5MB');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      await updateGroupAvatar(conversation.id, file);
      fetchConversations(); // Refresh to get updated avatar
    } catch (err) {
      console.error('Failed to update avatar:', err);
      alert('Failed to update group photo');
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (confirm(`Are you sure you want to remove ${memberName} from this group?`)) {
      setRemovingMember(memberId);
      const success = await removeGroupMember(conversation.id, memberId);
      setRemovingMember(null);
      if (!success) {
        alert('Failed to remove member');
      }
    }
  };

  // Handle edit group name
  const handleStartEditName = () => {
    setEditedName(conversation.name || '');
    setIsEditingName(true);
  };

  const handleSaveName = async () => {
    if (!editedName.trim()) return;
    setIsSavingName(true);
    const success = await updateGroupDetails(conversation.id, editedName.trim());
    setIsSavingName(false);
    if (success) {
      setIsEditingName(false);
      fetchConversations();
    } else {
      alert('Failed to update group name');
    }
  };

  const handleCancelEditName = () => {
    setIsEditingName(false);
    setEditedName('');
  };

  // Handle add members
  const handleOpenAddMembers = () => {
    setShowAddMembers(true);
    setAddMemberSearch('');
    setSelectedNewMembers([]);
    searchTeamMembers(''); // Load all team members
  };

  const handleAddMemberSearchChange = (query: string) => {
    setAddMemberSearch(query);
    searchTeamMembers(query);
  };

  const handleToggleNewMember = (member: {id: string; name: string; email?: string; avatar?: string}) => {
    setSelectedNewMembers((prev) => {
      const exists = prev.find((m) => m.id === member.id);
      if (exists) {
        return prev.filter((m) => m.id !== member.id);
      }
      return [...prev, member];
    });
  };

  const handleConfirmAddMembers = async () => {
    if (selectedNewMembers.length === 0) return;

    setIsAddingMembers(true);
    const participants = selectedNewMembers.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      type: 'internal' as const,
    }));

    const success = await addGroupMembers(conversation.id, participants);
    setIsAddingMembers(false);

    if (success) {
      setShowAddMembers(false);
      setSelectedNewMembers([]);
      fetchConversations();
    } else {
      alert('Failed to add members');
    }
  };

  // Get existing member IDs to filter out from search
  const existingMemberIds = useMemo(() => {
    return new Set(conversation.participants.filter((p) => !p.left_at).map((p) => p.user_id));
  }, [conversation.participants]);

  // Filter team members to exclude existing members
  const availableTeamMembers = useMemo(() => {
    return (teamMembers || []).filter((m) => !existingMemberIds.has(m.id));
  }, [teamMembers, existingMemberIds]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown';
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadge = (role: string) => {
    if (role === 'owner') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
          <Crown size={12} />
          Owner
        </span>
      );
    }
    if (role === 'admin') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
          <Shield size={12} />
          Admin
        </span>
      );
    }
    return null;
  };

  if (!isOpen) return null;

  const activeMembers = conversation.participants.filter((p) => !p.left_at);
  const imageCount = sharedFiles?.totals?.images || 0;
  const docCount = sharedFiles?.totals?.documents || 0;
  const linkCount = sharedFiles?.totals?.links || 0;

  return (
    <div
      className={`
        fixed inset-y-0 right-0 w-80 bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">
            {conversation.type === 'group' ? 'Group Info' : 'Contact Info'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Profile Section */}
          <div className="p-6 text-center border-b border-gray-200">
            {/* Hidden file input for avatar upload */}
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />

            {/* Avatar */}
            {conversation.type === 'group' ? (
              <div
                onClick={handleAvatarClick}
                className={`relative w-20 h-20 rounded-full mx-auto mb-3 flex items-center justify-center ${
                  isAdmin ? 'cursor-pointer group' : ''
                } ${conversation.avatar_url ? '' : 'bg-gradient-to-br from-[#977DFF] to-[#0033FF] text-white'}`}
              >
                {conversation.avatar_url ? (
                  <img
                    src={conversation.avatar_url}
                    alt={conversation.name || 'Group'}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <Users size={32} />
                )}
                {/* Camera overlay for admin */}
                {isAdmin && (
                  <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {isUploadingAvatar ? (
                      <Loader2 size={24} className="text-white animate-spin" />
                    ) : (
                      <Camera size={24} className="text-white" />
                    )}
                  </div>
                )}
              </div>
            ) : other?.user_avatar ? (
              <img
                src={other.user_avatar}
                alt={other.user_name}
                className="w-20 h-20 rounded-full mx-auto mb-3 object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full mx-auto mb-3 flex items-center justify-center bg-gradient-to-br from-[#977DFF] to-[#0033FF] text-white text-2xl font-semibold">
                {getInitials(other?.user_name || 'U')}
              </div>
            )}

            {/* Name */}
            {conversation.type === 'group' && isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-lg font-semibold text-gray-900 border border-[#977DFF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#977DFF]/50"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') handleCancelEditName();
                  }}
                />
                <button
                  onClick={handleSaveName}
                  disabled={isSavingName || !editedName.trim()}
                  className="p-1.5 text-white bg-gradient-to-r from-[#977DFF] to-[#0033FF] rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  {isSavingName ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                </button>
                <button
                  onClick={handleCancelEditName}
                  className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900">
                  {conversation.type === 'group' ? conversation.name : other?.user_name}
                </h2>
                {conversation.type === 'group' && isAdmin && (
                  <button
                    onClick={handleStartEditName}
                    className="p-1 text-gray-400 hover:text-[#977DFF] hover:bg-gray-100 rounded transition-colors"
                    title="Edit group name"
                  >
                    <Edit2 size={14} />
                  </button>
                )}
              </div>
            )}

            {/* Subtitle */}
            {conversation.type === 'group' ? (
              <p className="text-sm text-gray-500">{activeMembers.length} members</p>
            ) : (
              <p className="text-sm text-gray-500">
                {other?.participant_type === 'internal'
                  ? 'Team Member'
                  : other?.participant_type === 'external_user'
                  ? 'External User'
                  : 'Guest'}
              </p>
            )}
          </div>

          {/* Direct Chat: User Info */}
          {conversation.type === 'direct' && other && (
            <div className="p-4 border-b border-gray-200 space-y-3">
              {other.user_email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail size={16} className="text-gray-400" />
                  <span className="text-gray-700">{other.user_email}</span>
                </div>
              )}
              {other.company_name && (
                <div className="flex items-center gap-3 text-sm">
                  <Building2 size={16} className="text-gray-400" />
                  <span className="text-gray-700">{other.company_name}</span>
                </div>
              )}
              {other.joined_at && (
                <div className="flex items-center gap-3 text-sm">
                  <Calendar size={16} className="text-gray-400" />
                  <span className="text-gray-700">Member since {formatDate(other.joined_at)}</span>
                </div>
              )}
            </div>
          )}

          {/* Shared Media & Files Section */}
          <div className="border-b border-gray-200">
            <button
              onClick={() => setShowMedia(!showMedia)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50"
            >
              <span className="font-medium text-gray-900">Shared Media & Files</span>
              {showMedia ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </button>

            {showMedia && (
              <div className="px-4 pb-4 space-y-3">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-3 bg-gradient-to-br from-[#FFCCF2]/30 via-[#977DFF]/15 to-[#0033FF]/10 rounded-lg">
                    <ImageIcon size={20} className="text-[#977DFF] mx-auto mb-1" />
                    <p className="text-lg font-semibold text-gray-900">{imageCount}</p>
                    <p className="text-xs text-gray-500">Images</p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-[#FFCCF2]/30 via-[#977DFF]/15 to-[#0033FF]/10 rounded-lg">
                    <Video size={20} className="text-[#977DFF] mx-auto mb-1" />
                    <p className="text-lg font-semibold text-gray-900">0</p>
                    <p className="text-xs text-gray-500">Videos</p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-[#FFCCF2]/30 via-[#977DFF]/15 to-[#0033FF]/10 rounded-lg">
                    <FileText size={20} className="text-[#0033FF] mx-auto mb-1" />
                    <p className="text-lg font-semibold text-gray-900">{docCount}</p>
                    <p className="text-xs text-gray-500">Files</p>
                  </div>
                </div>

                {/* Image preview */}
                {sharedFiles?.images && sharedFiles.images.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">Images</p>
                    <div className="grid grid-cols-4 gap-1">
                      {sharedFiles.images.slice(0, 8).map((file) => (
                        <a
                          key={file.id}
                          href={file.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="aspect-square bg-gray-100 rounded overflow-hidden hover:opacity-80"
                        >
                          <img
                            src={file.thumbnail_url || file.file_url}
                            alt={file.file_name}
                            className="w-full h-full object-cover"
                          />
                        </a>
                      ))}
                    </div>
                    {sharedFiles.images.length > 8 && (
                      <p className="text-xs bg-gradient-to-r from-[#977DFF] to-[#0033FF] bg-clip-text text-transparent text-center mt-2 cursor-pointer hover:underline">
                        View all {sharedFiles.images.length} images
                      </p>
                    )}
                  </div>
                )}

                {/* Documents/Files preview */}
                {sharedFiles?.documents && sharedFiles.documents.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">Documents & Files</p>
                    <div className="space-y-2">
                      {sharedFiles.documents.slice(0, 5).map((file) => (
                        <a
                          key={file.id}
                          href={file.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <FileText size={20} className="text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{file.file_name}</p>
                            <p className="text-xs text-gray-500">
                              {file.file_size ? `${(file.file_size / 1024).toFixed(1)} KB` : ''}
                              {file.sender_name ? ` • ${file.sender_name}` : ''}
                            </p>
                          </div>
                          <Download size={16} className="text-gray-400 flex-shrink-0" />
                        </a>
                      ))}
                    </div>
                    {sharedFiles.documents.length > 5 && (
                      <p className="text-xs bg-gradient-to-r from-[#977DFF] to-[#0033FF] bg-clip-text text-transparent text-center mt-2 cursor-pointer hover:underline">
                        View all {sharedFiles.documents.length} files
                      </p>
                    )}
                  </div>
                )}

                {/* No shared content message */}
                {(!sharedFiles?.images || sharedFiles.images.length === 0) &&
                 (!sharedFiles?.documents || sharedFiles.documents.length === 0) && (
                  <p className="text-sm text-gray-500 text-center py-4">No media or files shared yet</p>
                )}
              </div>
            )}
          </div>

          {/* Group Chat: Team Members Section */}
          {conversation.type === 'group' && (
            <div className="border-b border-gray-200">
              <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                <button
                  onClick={() => setShowMembers(!showMembers)}
                  className="flex items-center gap-2 flex-1"
                >
                  <Users size={18} className="text-gray-500" />
                  <span className="font-medium text-gray-900">Team Members</span>
                  <span className="text-sm text-gray-500">{activeMembers.length}</span>
                </button>
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <button
                      onClick={handleOpenAddMembers}
                      className="p-1.5 text-[#977DFF] hover:bg-[#977DFF]/10 rounded-lg transition-colors"
                      title="Add members"
                    >
                      <UserPlus size={18} />
                    </button>
                  )}
                  <button onClick={() => setShowMembers(!showMembers)}>
                    {showMembers ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </button>
                </div>
              </div>

              {showMembers && (
                <div className="px-4 pb-4 space-y-3">
                  {/* Search */}
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search members..."
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#977DFF]"
                    />
                  </div>

                  {/* Member List */}
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {filteredMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50"
                      >
                        {/* Avatar */}
                        {member.user_avatar ? (
                          <img
                            src={member.user_avatar}
                            alt={member.user_name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#977DFF] to-[#0033FF] text-white flex items-center justify-center text-sm font-medium">
                            {getInitials(member.user_name)}
                          </div>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900 truncate">{member.user_name}</p>
                            {getRoleBadge(member.role)}
                          </div>
                          <p className="text-xs text-gray-500 truncate">{member.user_email}</p>
                        </div>

                        {/* Remove button (admin only, can't remove self) */}
                        {isAdmin && member.user_id !== currentUserId && (
                          <button
                            onClick={() => handleRemoveMember(member.user_id!, member.user_name)}
                            disabled={removingMember === member.user_id}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                            title="Remove from group"
                          >
                            {removingMember === member.user_id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <UserMinus size={16} />
                            )}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions Section */}
          <div className="p-4 space-y-1">
            <h4 className="text-sm font-medium text-gray-500 mb-2">Actions</h4>

            {/* Mute Toggle */}
            <button
              onClick={handleToggleMute}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {isMuted ? (
                <>
                  <Bell size={18} className="text-gray-500" />
                  <span>Unmute notifications</span>
                </>
              ) : (
                <>
                  <BellOff size={18} className="text-gray-500" />
                  <span>Mute notifications</span>
                </>
              )}
            </button>

            {/* Pin Toggle */}
            <button
              onClick={handleTogglePin}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {isPinned ? (
                <>
                  <PinOff size={18} className="text-gray-500" />
                  <span>Unpin conversation</span>
                </>
              ) : (
                <>
                  <Pin size={18} className="text-gray-500" />
                  <span>Pin conversation</span>
                </>
              )}
            </button>

            {/* Archive/Unarchive */}
            <button
              onClick={handleArchive}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {conversation.is_archived ? (
                <>
                  <ArchiveRestore size={18} className="text-gray-500" />
                  <span>Unarchive conversation</span>
                </>
              ) : (
                <>
                  <Archive size={18} className="text-gray-500" />
                  <span>Archive conversation</span>
                </>
              )}
            </button>

            {/* Leave Group (only for groups) */}
            {conversation.type === 'group' && (
              <button
                onClick={handleLeaveGroup}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut size={18} />
                <span>Leave group</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Add Members Modal */}
      {showAddMembers && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Add Members</h3>
              <button
                onClick={() => setShowAddMembers(false)}
                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-gray-200">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search team members..."
                  value={addMemberSearch}
                  onChange={(e) => handleAddMemberSearchChange(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#977DFF]"
                />
              </div>

              {/* Selected members pills */}
              {selectedNewMembers.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {selectedNewMembers.map((m) => (
                    <span
                      key={m.id}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-[#977DFF]/10 text-[#977DFF] text-sm rounded-full"
                    >
                      {m.name}
                      <button
                        onClick={() => handleToggleNewMember(m)}
                        className="hover:text-[#0033FF]"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Team Members List */}
            <div className="flex-1 overflow-y-auto p-2">
              {availableTeamMembers.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  {addMemberSearch ? 'No members found' : 'All team members are already in this group'}
                </p>
              ) : (
                <div className="space-y-1">
                  {availableTeamMembers.map((member) => {
                    const isSelected = selectedNewMembers.some((m) => m.id === member.id);
                    return (
                      <button
                        key={member.id}
                        onClick={() => handleToggleNewMember({
                          id: member.id,
                          name: member.name,
                          email: member.email,
                          avatar: member.avatar,
                        })}
                        className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${
                          isSelected ? 'bg-[#977DFF]/10' : 'hover:bg-gray-50'
                        }`}
                      >
                        {member.avatar ? (
                          <img
                            src={member.avatar}
                            alt={member.name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#977DFF] to-[#0033FF] text-white flex items-center justify-center text-sm font-medium">
                            {member.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                          </div>
                        )}
                        <div className="flex-1 text-left">
                          <p className="font-medium text-gray-900">{member.name}</p>
                          <p className="text-xs text-gray-500">{member.email}</p>
                        </div>
                        {isSelected && (
                          <Check size={18} className="text-[#977DFF]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-gray-200">
              <button
                onClick={() => setShowAddMembers(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAddMembers}
                disabled={selectedNewMembers.length === 0 || isAddingMembers}
                className="px-4 py-2 text-sm text-white bg-gradient-to-r from-[#977DFF] to-[#0033FF] rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                {isAddingMembers ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <UserPlus size={16} />
                    Add {selectedNewMembers.length > 0 ? `(${selectedNewMembers.length})` : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
