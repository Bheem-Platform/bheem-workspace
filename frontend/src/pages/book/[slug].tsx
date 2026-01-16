/**
 * Bheem Workspace - Public Booking Page
 * Calendly-like public scheduling page
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  Calendar,
  Clock,
  Video,
  Phone,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Check,
  User,
  Mail,
  Globe,
  Loader2,
} from 'lucide-react';
import axios from 'axios';

interface BookingPage {
  id: string;
  user_id: string;
  host_name: string;
  host_email: string;
  name: string;
  slug: string;
  description?: string;
  duration_minutes: number;
  color?: string;
  location_type: string;
  questions: Array<{ question: string; required?: boolean }>;
  availability: Record<string, { enabled: boolean; start: string; end: string }>;
  min_notice_hours: number;
  max_days_ahead: number;
}

interface TimeSlot {
  start: string;
  end: string;
}

// Use relative URL so requests go through the same domain and get proxied correctly
const API_BASE = '/api/v1';

export default function PublicBookingPage() {
  const router = useRouter();
  const { slug } = router.query;

  const [bookingPage, setBookingPage] = useState<BookingPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [availableSlots, setAvailableSlots] = useState<Record<string, TimeSlot[]>>({});
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Booking form state
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [step, setStep] = useState<'date' | 'time' | 'form' | 'confirmed'>('date');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    notes: '',
  });
  const [booking, setBooking] = useState(false);

  // Fetch booking page data
  useEffect(() => {
    if (!slug) return;

    const fetchBookingPage = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get(`${API_BASE}/appointments/public/by-slug/${slug}`);
        setBookingPage(response.data);
      } catch (err: any) {
        console.error('Failed to load booking page:', err);
        setError(err.response?.data?.detail || 'Booking page not found');
      } finally {
        setLoading(false);
      }
    };

    fetchBookingPage();
  }, [slug]);

  // Fetch available slots when month changes
  useEffect(() => {
    if (!bookingPage) return;

    const fetchSlots = async () => {
      setLoadingSlots(true);
      try {
        const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

        const response = await axios.get(
          `${API_BASE}/appointments/types/${bookingPage.id}/slots`,
          {
            params: {
              start_date: startDate.toISOString().split('T')[0],
              end_date: endDate.toISOString().split('T')[0],
              timezone: formData.timezone,
            },
          }
        );
        setAvailableSlots(response.data.slots || {});
      } catch (err) {
        console.error('Failed to fetch slots:', err);
      } finally {
        setLoadingSlots(false);
      }
    };

    fetchSlots();
  }, [bookingPage, currentMonth, formData.timezone]);

  // Handle booking submission
  const handleBook = async () => {
    if (!bookingPage || !selectedSlot) return;

    setBooking(true);
    try {
      await axios.post(`${API_BASE}/appointments/types/${bookingPage.id}/book`, {
        guest_email: formData.email,
        guest_name: formData.name,
        guest_timezone: formData.timezone,
        start_time: selectedSlot.start,
        notes: formData.notes || null,
      });
      setStep('confirmed');
    } catch (err: any) {
      console.error('Failed to book:', err);
      alert(err.response?.data?.detail || 'Failed to book appointment');
    } finally {
      setBooking(false);
    }
  };

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    const days: (number | null)[] = [];
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  };

  const isDateAvailable = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const dateStr = date.toISOString().split('T')[0];
    return availableSlots[dateStr]?.length > 0;
  };

  const isPastDate = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const getLocationIcon = () => {
    switch (bookingPage?.location_type) {
      case 'meet':
        return <Video size={16} className="text-blue-500" />;
      case 'phone':
        return <Phone size={16} className="text-green-500" />;
      default:
        return <MapPin size={16} className="text-gray-500" />;
    }
  };

  const getLocationText = () => {
    switch (bookingPage?.location_type) {
      case 'meet':
        return 'Bheem Meet video call';
      case 'phone':
        return 'Phone call';
      default:
        return 'Custom location';
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error || !bookingPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Calendar size={48} className="mx-auto text-gray-300 mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Booking Page Not Found</h1>
          <p className="text-gray-500">{error || 'This booking page does not exist or has been disabled.'}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{bookingPage.name} - Book a Meeting</title>
        <meta name="description" content={bookingPage.description || `Book a ${bookingPage.duration_minutes} minute meeting`} />
      </Head>

      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-t-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg"
                style={{ backgroundColor: bookingPage.color || '#4285f4' }}
              >
                {bookingPage.host_name?.charAt(0)?.toUpperCase() || 'H'}
              </div>
              <div>
                <p className="text-sm text-gray-500">{bookingPage.host_name}</p>
                <h1 className="text-xl font-semibold text-gray-900">{bookingPage.name}</h1>
              </div>
            </div>
            {bookingPage.description && (
              <p className="mt-4 text-gray-600">{bookingPage.description}</p>
            )}
            <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Clock size={16} />
                {bookingPage.duration_minutes} min
              </span>
              <span className="flex items-center gap-1">
                {getLocationIcon()}
                {getLocationText()}
              </span>
            </div>
          </div>

          {/* Main Content */}
          <div className="bg-white rounded-b-2xl border border-t-0 border-gray-200">
            {step === 'confirmed' ? (
              /* Confirmation */
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check size={32} className="text-green-600" />
                </div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">You're Booked!</h2>
                <p className="text-gray-600 mb-6">
                  A confirmation email has been sent to {formData.email}
                </p>
                <div className="bg-gray-50 rounded-lg p-4 text-left max-w-md mx-auto">
                  <p className="font-medium text-gray-900">{bookingPage.name}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedDate?.toLocaleDateString(undefined, {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                  <p className="text-sm text-gray-500">
                    {selectedSlot && formatTime(selectedSlot.start)} - {selectedSlot && formatTime(selectedSlot.end)}
                  </p>
                </div>
              </div>
            ) : step === 'form' ? (
              /* Booking Form */
              <div className="p-6">
                <button
                  onClick={() => setStep('time')}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
                >
                  <ChevronLeft size={16} />
                  Back
                </button>

                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <p className="font-medium text-gray-900">
                    {selectedDate?.toLocaleDateString(undefined, {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                  <p className="text-sm text-gray-500">
                    {selectedSlot && formatTime(selectedSlot.start)} - {selectedSlot && formatTime(selectedSlot.end)}
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <User size={14} className="inline mr-1" />
                      Your Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="John Doe"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Mail size={14} className="inline mr-1" />
                      Email *
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="john@example.com"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Globe size={14} className="inline mr-1" />
                      Timezone
                    </label>
                    <select
                      value={formData.timezone}
                      onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">Eastern Time</option>
                      <option value="America/Chicago">Central Time</option>
                      <option value="America/Denver">Mountain Time</option>
                      <option value="America/Los_Angeles">Pacific Time</option>
                      <option value="Europe/London">London</option>
                      <option value="Europe/Paris">Paris</option>
                      <option value="Asia/Tokyo">Tokyo</option>
                      <option value="Asia/Kolkata">India (IST)</option>
                      <option value="Australia/Sydney">Sydney</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Additional Notes (optional)
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      rows={3}
                      placeholder="Please share anything that will help prepare for our meeting..."
                    />
                  </div>

                  <button
                    onClick={handleBook}
                    disabled={!formData.name || !formData.email || booking}
                    className="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {booking ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Scheduling...
                      </>
                    ) : (
                      'Schedule Meeting'
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* Date & Time Selection */
              <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200">
                {/* Calendar */}
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-gray-900">
                      {currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                    </h2>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <button
                        onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center text-sm">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <div key={day} className="py-2 text-gray-500 font-medium">
                        {day}
                      </div>
                    ))}
                    {getDaysInMonth(currentMonth).map((day, index) => {
                      if (day === null) {
                        return <div key={`empty-${index}`} />;
                      }

                      const isAvailable = isDateAvailable(day);
                      const isPast = isPastDate(day);
                      const isSelected =
                        selectedDate?.getDate() === day &&
                        selectedDate?.getMonth() === currentMonth.getMonth() &&
                        selectedDate?.getFullYear() === currentMonth.getFullYear();

                      return (
                        <button
                          key={day}
                          onClick={() => {
                            if (isAvailable && !isPast) {
                              setSelectedDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day));
                              setStep('time');
                            }
                          }}
                          disabled={!isAvailable || isPast}
                          className={`py-2 rounded-lg transition-colors ${
                            isSelected
                              ? 'bg-blue-500 text-white'
                              : isAvailable && !isPast
                              ? 'hover:bg-blue-50 text-gray-900 font-medium'
                              : 'text-gray-300 cursor-not-allowed'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>

                  {loadingSlots && (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 size={20} className="animate-spin text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Time Slots */}
                <div className="p-6">
                  {step === 'time' && selectedDate ? (
                    <>
                      <button
                        onClick={() => setStep('date')}
                        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
                      >
                        <ChevronLeft size={16} />
                        Back
                      </button>
                      <h3 className="font-medium text-gray-900 mb-4">
                        {selectedDate.toLocaleDateString(undefined, {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </h3>
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {availableSlots[selectedDate.toISOString().split('T')[0]]?.map((slot, index) => (
                          <button
                            key={index}
                            onClick={() => {
                              setSelectedSlot(slot);
                              setStep('form');
                            }}
                            className="w-full py-3 px-4 border border-blue-500 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-center font-medium"
                          >
                            {formatTime(slot.start)}
                          </button>
                        )) || (
                          <p className="text-gray-500 text-center py-8">No available times</p>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-500">
                      <p>Select a date to see available times</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="text-center mt-6 text-sm text-gray-400">
            Powered by <span className="font-medium">Bheem Workspace</span>
          </div>
        </div>
      </div>
    </>
  );
}
