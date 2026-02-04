/**
 * Modal for creating new conversations (direct or group)
 */

import { useState, useEffect } from 'react';
import { X, Search, Users, Mail, Check, Plus, Building2 } from 'lucide-react';
import { useChatStore, type TeamMember, type ExternalContact, type ChatTab } from '@/stores/chatStore';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: ChatTab;
  currentUserId: string;
}

type ModalTab = 'team' | 'group' | 'external';

export default function NewChatModal({
  isOpen,
  onClose,
  activeTab,
  currentUserId,
}: NewChatModalProps) {
  const {
    teamMembers,
    externalContacts,
    searchTeamMembers,
    fetchExternalContacts,
    createDirectConversation,
    createGroupConversation,
    createExternalContact,
    inviteExternalContact,
    setActiveConversation,
  } = useChatStore();

  const [modalTab, setModalTab] = useState<ModalTab>('team');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<TeamMember[]>([]);
  const [groupName, setGroupName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      // Default to team tab when coming from 'teams' filter, otherwise show all options
      setModalTab(activeTab === 'teams' ? 'group' : 'team');
      setSearchQuery('');
      setSelectedUsers([]);
      setGroupName('');
      setInviteEmail('');
      setInviteName('');

      // Always load team members initially
      searchTeamMembers('');
      fetchExternalContacts();
    }
  }, [isOpen, activeTab, searchTeamMembers, fetchExternalContacts]);

  // Search team members with debounce
  useEffect(() => {
    if (modalTab === 'external') return;

    const timer = setTimeout(() => {
      setIsSearching(true);
      searchTeamMembers(searchQuery).finally(() => setIsSearching(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, modalTab, searchTeamMembers]);

  const handleSelectUser = (user: TeamMember) => {
    if (modalTab === 'team') {
      // Direct chat - immediately create conversation
      handleCreateDirectChat(user);
    } else {
      // Group - toggle selection
      setSelectedUsers((prev) => {
        const exists = prev.find((u) => u.id === user.id);
        if (exists) {
          return prev.filter((u) => u.id !== user.id);
        }
        return [...prev, user];
      });
    }
  };

  const handleCreateDirectChat = async (user: TeamMember) => {
    setIsSubmitting(true);
    try {
      const conv = await createDirectConversation({
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      });
      if (conv) {
        setActiveConversation(conv);
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) return;

    setIsSubmitting(true);
    try {
      const conv = await createGroupConversation(
        groupName.trim(),
        selectedUsers.map((u) => ({ id: u.id, name: u.name, email: u.email }))
      );
      if (conv) {
        setActiveConversation(conv);
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInviteExternal = async () => {
    if (!inviteEmail.trim()) return;

    setIsSubmitting(true);
    try {
      // Create external contact
      const contact = await createExternalContact({
        email: inviteEmail.trim(),
        name: inviteName.trim() || inviteEmail.split('@')[0],
      });

      if (contact) {
        // Create direct conversation with the contact
        const conv = await createDirectConversation({
          id: contact.id,
          name: contact.name,
          email: contact.email,
        });
        if (conv) {
          setActiveConversation(conv);
          onClose();
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectContact = async (contact: ExternalContact) => {
    setIsSubmitting(true);
    try {
      const conv = await createDirectConversation({
        id: contact.id,
        name: contact.name,
        email: contact.email,
        avatar: contact.avatar_url,
      });
      if (conv) {
        setActiveConversation(conv);
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">New Conversation</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setModalTab('team')}
            className={`
              flex-1 py-3 text-sm font-medium transition-colors
              ${modalTab === 'team'
                ? 'bg-gradient-to-r from-[#977DFF] to-[#0033FF] bg-clip-text text-transparent border-b-2 border-[#977DFF]'
                : 'text-gray-500 hover:text-gray-700'
              }
            `}
          >
            Team
          </button>
          <button
            onClick={() => setModalTab('group')}
            className={`
              flex-1 py-3 text-sm font-medium transition-colors
              ${modalTab === 'group'
                ? 'bg-gradient-to-r from-[#977DFF] to-[#0033FF] bg-clip-text text-transparent border-b-2 border-[#977DFF]'
                : 'text-gray-500 hover:text-gray-700'
              }
            `}
          >
            <Users size={16} className="inline mr-1" />
            Group
          </button>
          <button
            onClick={() => setModalTab('external')}
            className={`
              flex-1 py-3 text-sm font-medium transition-colors
              ${modalTab === 'external'
                ? 'bg-gradient-to-r from-[#977DFF] to-[#0033FF] bg-clip-text text-transparent border-b-2 border-[#977DFF]'
                : 'text-gray-500 hover:text-gray-700'
              }
            `}
          >
            <Building2 size={16} className="inline mr-1" />
            External
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* External contacts with invite option */}
          {modalTab === 'external' ? (
            <div className="p-4 space-y-4">
              {/* Invite by email section */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <h4 className="text-sm font-medium text-gray-700">Invite by Email</h4>
                <div>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="client@company.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#977DFF] focus:border-transparent"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="Name (optional)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#977DFF] focus:border-transparent"
                  />
                </div>
                <button
                  onClick={handleInviteExternal}
                  disabled={isSubmitting || !inviteEmail.trim()}
                  className="w-full py-2 px-4 bg-gradient-to-r from-[#977DFF] to-[#0033FF] text-white rounded-lg font-medium hover:from-[#8066EE] hover:to-[#0029CC] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                >
                  {isSubmitting ? 'Connecting...' : 'Connect & Start Chat'}
                </button>
              </div>

              {/* Existing contacts */}
              {externalContacts.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">My Contacts</h4>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    {(externalContacts as ExternalContact[]).map((contact) => (
                      <ContactItem
                        key={contact.id}
                        contact={contact}
                        onClick={() => handleSelectContact(contact)}
                        disabled={isSubmitting}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Search input */}
              <div className="p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search team members..."
                    className="w-full pl-10 pr-4 py-2 bg-gray-100 border border-transparent rounded-lg text-sm focus:outline-none focus:border-[#977DFF] focus:bg-white"
                  />
                </div>
              </div>

              {/* Group name input */}
              {modalTab === 'group' && (
                <div className="px-4 pb-4">
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Group name"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#977DFF] focus:border-transparent"
                  />
                </div>
              )}

              {/* Selected users for group */}
              {modalTab === 'group' && selectedUsers.length > 0 && (
                <div className="px-4 pb-4 flex flex-wrap gap-2">
                  {selectedUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-[#FFCCF2] via-[#977DFF]/30 to-[#0033FF]/20 text-[#0033FF] rounded-full text-sm"
                    >
                      {user.name}
                      <button
                        onClick={() => handleSelectUser(user)}
                        className="ml-1 text-[#977DFF] hover:text-[#8066EE]"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* User list */}
              <div className="border-t border-gray-100">
                {isSearching ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#FFCCF2] border-t-[#977DFF] border-r-[#0033FF]" />
                  </div>
                ) : teamMembers.filter((u) => u.id !== currentUserId).length === 0 ? (
                  <div className="py-8 text-center text-gray-500">
                    No team members found
                  </div>
                ) : (
                  teamMembers
                    .filter((u) => u.id !== currentUserId)
                    .map((user) => (
                      <UserItem
                        key={user.id}
                        user={user}
                        isSelected={selectedUsers.some((u) => u.id === user.id)}
                        showCheckbox={modalTab === 'group'}
                        onClick={() => handleSelectUser(user)}
                        disabled={isSubmitting}
                      />
                    ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer actions for group */}
        {modalTab === 'group' && (
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={handleCreateGroup}
              disabled={isSubmitting || !groupName.trim() || selectedUsers.length === 0}
              className="w-full py-2 px-4 bg-gradient-to-r from-[#977DFF] to-[#0033FF] text-white rounded-lg font-medium hover:from-[#8066EE] hover:to-[#0029CC] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </span>
              ) : (
                `Create Group (${selectedUsers.length} members)`
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// User item for team members
function UserItem({
  user,
  isSelected,
  showCheckbox,
  onClick,
  disabled,
}: {
  user: TeamMember;
  isSelected: boolean;
  showCheckbox: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 transition-colors disabled:opacity-50"
    >
      {/* Checkbox or avatar */}
      {showCheckbox ? (
        <div
          className={`
            w-5 h-5 rounded border-2 flex items-center justify-center
            ${isSelected ? 'bg-gradient-to-r from-[#977DFF] to-[#0033FF] border-[#977DFF]' : 'border-gray-300'}
          `}
        >
          {isSelected && <Check size={14} className="text-white" />}
        </div>
      ) : null}

      {/* Avatar */}
      {user.avatar ? (
        <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full object-cover" />
      ) : (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#977DFF] to-[#0033FF] text-white flex items-center justify-center font-medium">
          {initials}
        </div>
      )}

      {/* Info */}
      <div className="flex-1 text-left">
        <p className="font-medium text-gray-900">{user.name}</p>
        <p className="text-sm text-gray-500">{user.job_title || user.email}</p>
      </div>

      {/* Online indicator */}
      {user.is_online && (
        <span className="w-2 h-2 rounded-full bg-green-500" />
      )}
    </button>
  );
}

// Contact item for external contacts
function ContactItem({
  contact,
  onClick,
  disabled,
}: {
  contact: ExternalContact;
  onClick: () => void;
  disabled: boolean;
}) {
  const initials = contact.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 transition-colors disabled:opacity-50"
    >
      {/* Avatar */}
      {contact.avatar_url ? (
        <img src={contact.avatar_url} alt={contact.name} className="w-10 h-10 rounded-full object-cover" />
      ) : (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0033FF] to-[#977DFF] text-white flex items-center justify-center font-medium">
          {initials}
        </div>
      )}

      {/* Info */}
      <div className="flex-1 text-left">
        <p className="font-medium text-gray-900">{contact.name}</p>
        <p className="text-sm text-gray-500">
          {contact.company_name || contact.email}
        </p>
      </div>
    </button>
  );
}
