/**
 * Meet Section - Google Meet-like people search for starting meetings
 */
import { useState, useEffect, useRef } from 'react';
import {
  Search,
  Video,
  Phone,
  X,
  Users,
  Mail,
  Building,
  ChevronRight,
  Copy,
  Check,
  Plus,
  Clock
} from 'lucide-react';
import { searchPeople, listPeople, type Person } from '@/lib/calendarTasksApi';

interface MeetSectionProps {
  onClose: () => void;
}

export default function MeetSection({ onClose }: MeetSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [recentPeople, setRecentPeople] = useState<Person[]>([]);
  const [selectedPeople, setSelectedPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [meetingLink, setMeetingLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [showNewMeeting, setShowNewMeeting] = useState(false);

  // Load recent/suggested people on mount
  useEffect(() => {
    loadRecentPeople();
  }, []);

  const loadRecentPeople = async () => {
    try {
      const data = await listPeople(10, 0);
      setRecentPeople(data);
    } catch (error) {
      console.error('Failed to load people:', error);
    }
  };

  // Debounced search
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length < 2) {
      setPeople([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchPeople(searchQuery, 10);
        setPeople(results);
      } catch (error) {
        console.error('Search failed:', error);
        setPeople([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const handleSelectPerson = (person: Person) => {
    if (!selectedPeople.find(p => p.id === person.id)) {
      setSelectedPeople([...selectedPeople, person]);
    }
    setSearchQuery('');
    setPeople([]);
  };

  const handleRemovePerson = (personId: string) => {
    setSelectedPeople(selectedPeople.filter(p => p.id !== personId));
  };

  const generateMeetingLink = () => {
    // Generate a random meeting ID
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    const segments = [
      Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''),
      Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''),
      Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''),
    ];
    const meetId = segments.join('-');
    const link = `${window.location.origin}/meet/${meetId}`;
    setMeetingLink(link);
    setShowNewMeeting(true);
  };

  const copyMeetingLink = async () => {
    try {
      await navigator.clipboard.writeText(meetingLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const startMeeting = () => {
    if (meetingLink) {
      window.open(meetingLink, '_blank');
    }
  };

  const displayPeople = searchQuery.trim().length >= 2 ? people : recentPeople;

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Meet</h2>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X size={18} className="text-gray-500" />
        </button>
      </div>

      {/* New Meeting Button */}
      <div className="p-4 border-b border-gray-200">
        <button
          onClick={generateMeetingLink}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all shadow-lg shadow-blue-500/25"
        >
          <Video size={20} />
          <span className="font-medium">New Meeting</span>
        </button>

        {/* Meeting Link Section */}
        {showNewMeeting && meetingLink && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-2">Meeting link created:</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={meetingLink}
                className="flex-1 text-xs bg-white border border-gray-200 rounded px-2 py-1.5 text-gray-700"
              />
              <button
                onClick={copyMeetingLink}
                className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                title="Copy link"
              >
                {linkCopied ? (
                  <Check size={16} className="text-green-500" />
                ) : (
                  <Copy size={16} className="text-gray-500" />
                )}
              </button>
            </div>
            <button
              onClick={startMeeting}
              className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 transition-colors"
            >
              <Video size={16} />
              <span>Start Meeting Now</span>
            </button>
          </div>
        )}
      </div>

      {/* Search Input */}
      <div className="p-4">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search people..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border-0 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Selected People */}
      {selectedPeople.length > 0 && (
        <div className="px-4 pb-3">
          <div className="flex flex-wrap gap-2">
            {selectedPeople.map((person) => (
              <div
                key={person.id}
                className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs"
              >
                <span>{person.name || person.email}</span>
                <button
                  onClick={() => handleRemovePerson(person.id)}
                  className="p-0.5 hover:bg-blue-200 rounded-full transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              generateMeetingLink();
              // TODO: Send invites to selected people
            }}
            className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Users size={16} />
            <span>Start Meeting with {selectedPeople.length} people</span>
          </button>
        </div>
      )}

      {/* People List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
          </div>
        ) : (
          <>
            <div className="px-4 py-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {searchQuery.trim().length >= 2 ? 'Search Results' : 'People'}
              </h3>
            </div>
            <div className="space-y-1 px-2">
              {displayPeople.map((person) => (
                <button
                  key={person.id}
                  onClick={() => handleSelectPerson(person)}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
                    {person.avatar_url ? (
                      <img
                        src={person.avatar_url}
                        alt={person.name || person.email}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      (person.name || person.email).charAt(0).toUpperCase()
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {person.name || person.email}
                    </p>
                    {person.name && (
                      <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                        <Mail size={10} />
                        {person.email}
                      </p>
                    )}
                    {person.department && (
                      <p className="text-xs text-gray-400 truncate flex items-center gap-1">
                        <Building size={10} />
                        {person.department}
                      </p>
                    )}
                  </div>

                  {/* Action */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Direct video call
                        handleSelectPerson(person);
                        generateMeetingLink();
                      }}
                      className="p-2 hover:bg-blue-50 rounded-full transition-colors"
                      title="Start video call"
                    >
                      <Video size={16} className="text-blue-500" />
                    </button>
                    <Plus size={16} className="text-gray-400" />
                  </div>
                </button>
              ))}

              {displayPeople.length === 0 && !loading && (
                <div className="py-8 text-center">
                  <Users size={32} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-500">
                    {searchQuery.trim().length >= 2
                      ? 'No people found'
                      : 'Start typing to search'}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div className="border-t border-gray-200 p-4 space-y-2">
        <button
          onClick={() => {
            // Schedule meeting for later
            // TODO: Open event modal with meeting type
          }}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <Clock size={18} className="text-gray-400" />
          <span>Schedule meeting for later</span>
          <ChevronRight size={16} className="ml-auto text-gray-400" />
        </button>
      </div>
    </div>
  );
}
