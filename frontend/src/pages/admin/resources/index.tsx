/**
 * Bheem Workspace - Resource Booking Management
 * Manage meeting rooms, equipment, and bookings
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  Plus,
  Search,
  Calendar,
  Clock,
  MapPin,
  Users,
  Monitor,
  Car,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useCurrentTenantId, useRequireAuth } from '@/stores/authStore';
import { api } from '@/lib/api';

interface Resource {
  id: string;
  name: string;
  resource_type: string;
  capacity: number | null;
  location: string | null;
  description: string | null;
  available_from: string | null;
  available_until: string | null;
  is_active: boolean;
}

interface Booking {
  id: string;
  resource_id: string;
  resource_name: string;
  title: string;
  start_time: string;
  end_time: string;
  booked_by_name: string;
  status: string;
}

interface TimeSlot {
  time: string;
  available: boolean;
  booking?: Booking;
}

const RESOURCE_TYPES = [
  { value: 'room', label: 'Meeting Room', icon: <Monitor size={20} /> },
  { value: 'equipment', label: 'Equipment', icon: <Monitor size={20} /> },
  { value: 'vehicle', label: 'Vehicle', icon: <Car size={20} /> },
];

export default function ResourcesPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useRequireAuth();
  const tenantId = useCurrentTenantId();

  const [resources, setResources] = useState<Resource[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Modal states
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);

  // Form states
  const [resourceForm, setResourceForm] = useState({
    name: '',
    resource_type: 'room',
    capacity: '',
    location: '',
    description: '',
    available_from: '09:00',
    available_until: '18:00',
  });

  const [bookingForm, setBookingForm] = useState({
    title: '',
    start_time: '',
    end_time: '',
    description: '',
  });

  useEffect(() => {
    if (!isAuthenticated || isLoading) return;
    fetchResources();
    fetchBookings();
  }, [isAuthenticated, isLoading, tenantId, selectedDate]);

  const fetchResources = async () => {
    try {
      const res = await api.get('/resources');
      setResources(res.data.resources || res.data || []);
    } catch (err) {
      console.error('Failed to fetch resources:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBookings = async () => {
    try {
      const res = await api.get('/resources/bookings', {
        params: { date: selectedDate }
      });
      setBookings(res.data.bookings || res.data || []);
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
    }
  };

  const handleCreateResource = async () => {
    try {
      await api.post('/resources', {
        ...resourceForm,
        capacity: resourceForm.capacity ? parseInt(resourceForm.capacity) : null,
      });
      setShowResourceModal(false);
      setResourceForm({
        name: '',
        resource_type: 'room',
        capacity: '',
        location: '',
        description: '',
        available_from: '09:00',
        available_until: '18:00',
      });
      fetchResources();
    } catch (err) {
      console.error('Failed to create resource:', err);
    }
  };

  const handleUpdateResource = async () => {
    if (!editingResource) return;
    try {
      await api.put(`/resources/${editingResource.id}`, {
        ...resourceForm,
        capacity: resourceForm.capacity ? parseInt(resourceForm.capacity) : null,
      });
      setShowResourceModal(false);
      setEditingResource(null);
      fetchResources();
    } catch (err) {
      console.error('Failed to update resource:', err);
    }
  };

  const handleDeleteResource = async (id: string) => {
    if (!confirm('Are you sure you want to delete this resource?')) return;
    try {
      await api.delete(`/resources/${id}`);
      fetchResources();
    } catch (err) {
      console.error('Failed to delete resource:', err);
    }
  };

  const handleBookResource = async () => {
    if (!selectedResource) return;
    try {
      await api.post(`/resources/${selectedResource.id}/book`, {
        ...bookingForm,
        start_time: `${selectedDate}T${bookingForm.start_time}:00`,
        end_time: `${selectedDate}T${bookingForm.end_time}:00`,
      });
      setShowBookingModal(false);
      setSelectedResource(null);
      setBookingForm({ title: '', start_time: '', end_time: '', description: '' });
      fetchBookings();
    } catch (err) {
      console.error('Failed to book resource:', err);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    try {
      await api.delete(`/resources/bookings/${bookingId}`);
      fetchBookings();
    } catch (err) {
      console.error('Failed to cancel booking:', err);
    }
  };

  const openEditModal = (resource: Resource) => {
    setEditingResource(resource);
    setResourceForm({
      name: resource.name,
      resource_type: resource.resource_type,
      capacity: resource.capacity?.toString() || '',
      location: resource.location || '',
      description: resource.description || '',
      available_from: resource.available_from || '09:00',
      available_until: resource.available_until || '18:00',
    });
    setShowResourceModal(true);
  };

  const openBookingModal = (resource: Resource) => {
    setSelectedResource(resource);
    setShowBookingModal(true);
  };

  const filteredResources = resources.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.location?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = !filterType || r.resource_type === filterType;
    return matchesSearch && matchesType;
  });

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'room': return <Monitor size={20} />;
      case 'vehicle': return <Car size={20} />;
      default: return <Monitor size={20} />;
    }
  };

  const navigateDate = (days: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  if (isLoading || loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Resource Booking</h1>
            <p className="text-gray-600">Manage meeting rooms, equipment, and bookings</p>
          </div>
          <button
            onClick={() => {
              setEditingResource(null);
              setResourceForm({
                name: '',
                resource_type: 'room',
                capacity: '',
                location: '',
                description: '',
                available_from: '09:00',
                available_until: '18:00',
              });
              setShowResourceModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            Add Resource
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search resources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Types</option>
            {RESOURCE_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>

        {/* Date Navigation */}
        <div className="flex items-center justify-center gap-4 bg-white p-4 rounded-xl shadow-sm">
          <button
            onClick={() => navigateDate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Calendar size={20} className="text-gray-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={() => navigateDate(1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight size={20} />
          </button>
          <button
            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
            className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            Today
          </button>
        </div>

        {/* Resources Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredResources.map((resource) => {
            const resourceBookings = bookings.filter(b => b.resource_id === resource.id);

            return (
              <div
                key={resource.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-xl ${
                        resource.resource_type === 'room' ? 'bg-blue-100 text-blue-600' :
                        resource.resource_type === 'vehicle' ? 'bg-green-100 text-green-600' :
                        'bg-purple-100 text-purple-600'
                      }`}>
                        {getResourceIcon(resource.resource_type)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{resource.name}</h3>
                        <span className="text-sm text-gray-500 capitalize">{resource.resource_type}</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEditModal(resource)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteResource(resource.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    {resource.location && (
                      <div className="flex items-center gap-2">
                        <MapPin size={16} className="text-gray-400" />
                        {resource.location}
                      </div>
                    )}
                    {resource.capacity && (
                      <div className="flex items-center gap-2">
                        <Users size={16} className="text-gray-400" />
                        {resource.capacity} people
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-gray-400" />
                      {resource.available_from || '09:00'} - {resource.available_until || '18:00'}
                    </div>
                  </div>

                  {/* Today's Bookings */}
                  {resourceBookings.length > 0 && (
                    <div className="border-t pt-4 mb-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Today's Bookings</p>
                      <div className="space-y-2">
                        {resourceBookings.slice(0, 3).map(booking => (
                          <div
                            key={booking.id}
                            className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg"
                          >
                            <div>
                              <p className="text-sm font-medium text-gray-900">{booking.title}</p>
                              <p className="text-xs text-gray-500">
                                {new Date(booking.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -
                                {new Date(booking.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            <button
                              onClick={() => handleCancelBooking(booking.id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <XCircle size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => openBookingModal(resource)}
                    className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    Book Now
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredResources.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl">
            <Monitor size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No resources found</h3>
            <p className="text-gray-600 mb-4">Add your first resource to get started</p>
            <button
              onClick={() => setShowResourceModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={20} />
              Add Resource
            </button>
          </div>
        )}

        {/* Resource Modal */}
        {showResourceModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingResource ? 'Edit Resource' : 'Add Resource'}
                </h2>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={resourceForm.name}
                    onChange={(e) => setResourceForm({ ...resourceForm, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Conference Room A"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={resourceForm.resource_type}
                    onChange={(e) => setResourceForm({ ...resourceForm, resource_type: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {RESOURCE_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
                    <input
                      type="number"
                      value={resourceForm.capacity}
                      onChange={(e) => setResourceForm({ ...resourceForm, capacity: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                    <input
                      type="text"
                      value={resourceForm.location}
                      onChange={(e) => setResourceForm({ ...resourceForm, location: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Floor 2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Available From</label>
                    <input
                      type="time"
                      value={resourceForm.available_from}
                      onChange={(e) => setResourceForm({ ...resourceForm, available_from: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Available Until</label>
                    <input
                      type="time"
                      value={resourceForm.available_until}
                      onChange={(e) => setResourceForm({ ...resourceForm, available_until: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={resourceForm.description}
                    onChange={(e) => setResourceForm({ ...resourceForm, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Add any additional details..."
                  />
                </div>
              </div>
              <div className="p-6 border-t flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowResourceModal(false);
                    setEditingResource(null);
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={editingResource ? handleUpdateResource : handleCreateResource}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingResource ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Booking Modal */}
        {showBookingModal && selectedResource && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full">
              <div className="p-6 border-b">
                <h2 className="text-xl font-bold text-gray-900">Book {selectedResource.name}</h2>
                <p className="text-gray-600 text-sm">{selectedDate}</p>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={bookingForm.title}
                    onChange={(e) => setBookingForm({ ...bookingForm, title: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Team Meeting"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                    <input
                      type="time"
                      value={bookingForm.start_time}
                      onChange={(e) => setBookingForm({ ...bookingForm, start_time: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                    <input
                      type="time"
                      value={bookingForm.end_time}
                      onChange={(e) => setBookingForm({ ...bookingForm, end_time: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                  <textarea
                    value={bookingForm.description}
                    onChange={(e) => setBookingForm({ ...bookingForm, description: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="p-6 border-t flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowBookingModal(false);
                    setSelectedResource(null);
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBookResource}
                  disabled={!bookingForm.title || !bookingForm.start_time || !bookingForm.end_time}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Book
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
