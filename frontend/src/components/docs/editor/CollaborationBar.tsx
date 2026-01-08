/**
 * Bheem Docs - Collaboration Bar
 * Shows active collaborators and their cursor colors
 */
import { useState } from 'react';
import { Users, Circle, Eye, Edit3 } from 'lucide-react';

interface Collaborator {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  color: string;
  cursor_position?: number;
  is_editing: boolean;
  last_active: string;
}

interface CollaborationBarProps {
  collaborators: Collaborator[];
  currentUserId: string;
  documentTitle: string;
  isOnline: boolean;
  onUserClick?: (userId: string) => void;
}

const CURSOR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
];

export default function CollaborationBar({
  collaborators,
  currentUserId,
  documentTitle,
  isOnline,
  onUserClick,
}: CollaborationBarProps) {
  const [showAllUsers, setShowAllUsers] = useState(false);

  const activeCollaborators = collaborators.filter((c) => c.id !== currentUserId);
  const displayedCollaborators = showAllUsers ? activeCollaborators : activeCollaborators.slice(0, 5);
  const remainingCount = activeCollaborators.length - 5;

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-white border-b">
      {/* Left side - Document info */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
          <span className="text-sm text-gray-500">
            {isOnline ? 'Connected' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Right side - Collaborators */}
      <div className="flex items-center gap-4">
        {/* Active collaborators */}
        {activeCollaborators.length > 0 && (
          <div className="flex items-center gap-2">
            <Users size={16} className="text-gray-400" />
            <span className="text-sm text-gray-500">
              {activeCollaborators.length} viewing
            </span>
          </div>
        )}

        {/* Collaborator avatars */}
        <div className="flex items-center -space-x-2">
          {displayedCollaborators.map((collaborator) => (
            <button
              key={collaborator.id}
              onClick={() => onUserClick?.(collaborator.id)}
              className="relative group"
              title={collaborator.name}
            >
              <div
                className="w-8 h-8 rounded-full border-2 bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-medium hover:z-10 hover:scale-110 transition-transform"
                style={{ borderColor: collaborator.color }}
              >
                {collaborator.avatar ? (
                  <img
                    src={collaborator.avatar}
                    alt={collaborator.name}
                    className="w-full h-full rounded-full"
                  />
                ) : (
                  collaborator.name.charAt(0).toUpperCase()
                )}
              </div>
              {/* Status indicator */}
              <div
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                  collaborator.is_editing ? 'bg-green-500' : 'bg-yellow-500'
                }`}
              />
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                <div className="flex items-center gap-1">
                  {collaborator.is_editing ? <Edit3 size={10} /> : <Eye size={10} />}
                  {collaborator.name}
                </div>
                <div
                  className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"
                />
              </div>
            </button>
          ))}

          {/* Show more */}
          {remainingCount > 0 && !showAllUsers && (
            <button
              onClick={() => setShowAllUsers(true)}
              className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs font-medium text-gray-600 hover:bg-gray-300"
            >
              +{remainingCount}
            </button>
          )}
        </div>

        {/* Current user indicator */}
        <div className="flex items-center gap-2 pl-4 border-l">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white text-xs font-medium">
            You
          </div>
        </div>
      </div>

      {/* Expanded user list */}
      {showAllUsers && activeCollaborators.length > 5 && (
        <div className="absolute right-4 top-full mt-2 bg-white border rounded-lg shadow-lg py-2 z-50 min-w-[200px]">
          <div className="px-3 py-2 border-b">
            <p className="text-sm font-medium text-gray-900">All collaborators</p>
          </div>
          {activeCollaborators.map((collaborator) => (
            <button
              key={collaborator.id}
              onClick={() => {
                onUserClick?.(collaborator.id);
                setShowAllUsers(false);
              }}
              className="w-full px-3 py-2 flex items-center gap-3 hover:bg-gray-50"
            >
              <div
                className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-medium"
                style={{ borderColor: collaborator.color, borderWidth: 2 }}
              >
                {collaborator.name.charAt(0).toUpperCase()}
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900">{collaborator.name}</p>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  {collaborator.is_editing ? (
                    <>
                      <Edit3 size={10} className="text-green-500" />
                      Editing
                    </>
                  ) : (
                    <>
                      <Eye size={10} className="text-yellow-500" />
                      Viewing
                    </>
                  )}
                </p>
              </div>
              <div
                className="w-3 h-3 rounded-full ml-auto"
                style={{ backgroundColor: collaborator.color }}
              />
            </button>
          ))}
          <button
            onClick={() => setShowAllUsers(false)}
            className="w-full px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 border-t"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
