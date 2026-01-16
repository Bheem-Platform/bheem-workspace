/**
 * Bheem Calendar - Booking Pages Panel
 * Calendly-like scheduling pages management
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Calendar,
  Clock,
  Video,
  Phone,
  MapPin,
  ExternalLink,
  Copy,
  MoreVertical,
  Edit2,
  Trash2,
  X,
  Check,
  Link2,
} from 'lucide-react';
import { api } from '@/lib/api';

interface AppointmentType {
  id: string;
  name: string;
  slug: string;
  description?: string;
  duration_minutes: number;
  color?: string;
  location_type: 'meet' | 'phone' | 'custom';
  custom_location?: string;
  is_active: boolean;
  min_notice_hours: number;
  max_days_ahead: number;
  created_at: string;
}

interface BookingPagesPanelProps {
  onClose?: () => void;
}

const DURATION_OPTIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
];

const LOCATION_TYPES = [
  { value: 'meet', label: 'Bheem Meet', icon: Video },
  { value: 'phone', label: 'Phone call', icon: Phone },
  { value: 'custom', label: 'Custom location', icon: MapPin },
];

export default function BookingPagesPanel({ onClose }: BookingPagesPanelProps) {
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form state for creating new booking page
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    duration_minutes: 30,
    location_type: 'meet' as 'meet' | 'phone' | 'custom',
    custom_location: '',
    min_notice_hours: 24,
    max_days_ahead: 60,
  });

  // Fetch appointment types
  const fetchAppointmentTypes = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/appointments/types');
      setAppointmentTypes(response.data);
    } catch (error) {
      console.error('Failed to fetch appointment types:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointmentTypes();
  }, [fetchAppointmentTypes]);

  // Generate slug from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  // Handle name change and auto-generate slug
  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: generateSlug(name),
    }));
  };

  // Create new booking page
  const handleCreate = async () => {
    try {
      await api.post('/appointments/types', formData);
      setShowCreateModal(false);
      setFormData({
        name: '',
        slug: '',
        description: '',
        duration_minutes: 30,
        location_type: 'meet',
        custom_location: '',
        min_notice_hours: 24,
        max_days_ahead: 60,
      });
      fetchAppointmentTypes();
    } catch (error: any) {
      console.error('Failed to create booking page:', error);
      alert(error.response?.data?.detail || 'Failed to create booking page');
    }
  };

  // Delete booking page
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this booking page?')) return;

    try {
      await api.delete(`/appointments/types/${id}`);
      fetchAppointmentTypes();
    } catch (error) {
      console.error('Failed to delete booking page:', error);
    }
  };

  // Toggle active status
  const handleToggleActive = async (type: AppointmentType) => {
    try {
      await api.patch(`/appointments/types/${type.id}`, {
        is_active: !type.is_active,
      });
      fetchAppointmentTypes();
    } catch (error) {
      console.error('Failed to toggle status:', error);
    }
  };

  // Copy booking link
  const copyBookingLink = async (type: AppointmentType) => {
    // Note: In production, this would use the actual user ID
    const link = `${window.location.origin}/book/${type.slug}`;
    await navigator.clipboard.writeText(link);
    setCopiedId(type.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getLocationIcon = (locationType: string) => {
    const type = LOCATION_TYPES.find(t => t.value === locationType);
    return type?.icon || MapPin;
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Booking Pages</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
          >
            <Plus size={16} />
            New Page
          </button>
          {onClose && (
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
              <X size={20} className="text-gray-500" />
            </button>
          )}
        </div>
      </div>

      {/* Booking Pages List */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
          </div>
        ) : appointmentTypes.length === 0 ? (
          <div className="text-center py-12">
            <Calendar size={48} className="mx-auto text-gray-300 mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No booking pages yet</h3>
            <p className="text-sm text-gray-500 mb-4">
              Create a booking page to let others schedule time with you
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              <Plus size={18} />
              Create Booking Page
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {appointmentTypes.map(type => {
              const LocationIcon = getLocationIcon(type.location_type);
              return (
                <div
                  key={type.id}
                  className={`border rounded-xl p-4 ${
                    type.is_active ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: type.color || '#4285f4' }}
                      >
                        <Clock size={20} className="text-white" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{type.name}</h3>
                        {type.description && (
                          <p className="text-sm text-gray-500 mt-0.5">{type.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {type.duration_minutes} min
                          </span>
                          <span className="flex items-center gap-1">
                            <LocationIcon size={12} />
                            {LOCATION_TYPES.find(t => t.value === type.location_type)?.label}
                          </span>
                          {!type.is_active && (
                            <span className="px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full">
                              Inactive
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => copyBookingLink(type)}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                        title="Copy booking link"
                      >
                        {copiedId === type.id ? (
                          <Check size={16} className="text-green-500" />
                        ) : (
                          <Link2 size={16} className="text-gray-400" />
                        )}
                      </button>
                      <button
                        onClick={() => window.open(`/book/${type.slug}`, '_blank')}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                        title="Preview booking page"
                      >
                        <ExternalLink size={16} className="text-gray-400" />
                      </button>
                      <BookingPageMenu
                        type={type}
                        onToggleActive={() => handleToggleActive(type)}
                        onDelete={() => handleDelete(type.id)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Create Booking Page</h3>
              <p className="text-sm text-gray-500 mt-1">
                Set up a new scheduling page for others to book time with you
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g., 30 Minute Meeting"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Slug */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL slug
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">/book/</span>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                    placeholder="30-minute-meeting"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of this meeting type..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration
                </label>
                <div className="flex flex-wrap gap-2">
                  {DURATION_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => setFormData(prev => ({ ...prev, duration_minutes: option.value }))}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                        formData.duration_minutes === option.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Location Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location
                </label>
                <div className="space-y-2">
                  {LOCATION_TYPES.map(option => {
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.value}
                        onClick={() => setFormData(prev => ({ ...prev, location_type: option.value as any }))}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${
                          formData.location_type === option.value
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Icon size={18} className={formData.location_type === option.value ? 'text-blue-500' : 'text-gray-400'} />
                        <span className={formData.location_type === option.value ? 'text-blue-700' : 'text-gray-700'}>
                          {option.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {formData.location_type === 'custom' && (
                  <input
                    type="text"
                    value={formData.custom_location}
                    onChange={(e) => setFormData(prev => ({ ...prev, custom_location: e.target.value }))}
                    placeholder="Enter location or link"
                    className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>

              {/* Advanced Settings */}
              <div className="pt-4 border-t border-gray-100">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Booking Rules</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Min. notice (hours)</label>
                    <input
                      type="number"
                      value={formData.min_notice_hours}
                      onChange={(e) => setFormData(prev => ({ ...prev, min_notice_hours: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Max. days ahead</label>
                    <input
                      type="number"
                      value={formData.max_days_ahead}
                      onChange={(e) => setFormData(prev => ({ ...prev, max_days_ahead: parseInt(e.target.value) || 60 }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!formData.name || !formData.slug}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Booking Page
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Booking Page Menu Component
function BookingPageMenu({
  type,
  onToggleActive,
  onDelete,
}: {
  type: AppointmentType;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="p-2 hover:bg-gray-100 rounded-lg"
      >
        <MoreVertical size={16} className="text-gray-400" />
      </button>

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
            <button
              onClick={() => {
                onToggleActive();
                setShowMenu(false);
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
            >
              {type.is_active ? 'Deactivate' : 'Activate'}
            </button>
            <button
              onClick={() => {
                onDelete();
                setShowMenu(false);
              }}
              className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
