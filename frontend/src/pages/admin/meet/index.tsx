import { useEffect, useState } from 'react';
import { Video, Users, Clock, Settings, Save } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import StatsCard from '@/components/admin/StatsCard';
import UsageProgressBar from '@/components/admin/UsageProgressBar';
import { useCurrentTenantId } from '@/stores/authStore';
import * as adminApi from '@/lib/adminApi';
import type { MeetSettings } from '@/types/admin';

export default function MeetSettingsPage() {
  const [settings, setSettings] = useState<MeetSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [formData, setFormData] = useState({
    allow_recording: true,
    max_participants: 100,
    max_duration_minutes: 480,
    waiting_room_enabled: true,
    chat_enabled: true,
    screen_share_enabled: true,
  });

  // Get tenant ID from auth context
  const tenantId = useCurrentTenantId();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getMeetSettings(tenantId);
      const data = response.data;
      setSettings(data);
      setFormData({
        allow_recording: data.allow_recording,
        max_participants: data.max_participants,
        max_duration_minutes: data.max_duration_minutes,
        waiting_room_enabled: data.waiting_room_enabled,
        chat_enabled: data.chat_enabled,
        screen_share_enabled: data.screen_share_enabled,
      });
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminApi.updateMeetSettings(tenantId, formData);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <AdminLayout isSuperAdmin={false}>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="grid grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Meet Settings' },
      ]}
      isSuperAdmin={false}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Meet Settings</h1>
            <p className="text-gray-500">Configure video conferencing for your workspace</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <>Saving...</>
            ) : saved ? (
              <>
                <Save size={20} className="mr-2" />
                Saved!
              </>
            ) : (
              <>
                <Save size={20} className="mr-2" />
                Save Changes
              </>
            )}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatsCard
            title="Hours Used"
            value={`${settings?.hours_used?.toFixed(1) || 0}`}
            icon={Clock}
            color="orange"
            subtitle={`of ${settings?.hours_quota || 0} hrs`}
          />
          <StatsCard
            title="Meetings (This Month)"
            value={settings?.meetings_this_month || 0}
            icon={Video}
            color="blue"
          />
          <StatsCard
            title="Avg Participants"
            value={settings?.avg_participants?.toFixed(1) || 0}
            icon={Users}
            color="green"
          />
          <StatsCard
            title="Recordings"
            value={`${((settings?.recordings_used_mb || 0) / 1024).toFixed(1)} GB`}
            icon={Video}
            color="purple"
          />
        </div>

        {/* Usage */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Usage</h2>
          <div className="space-y-4">
            <UsageProgressBar
              label="Meeting Hours"
              used={settings?.hours_used || 0}
              quota={settings?.hours_quota || 100}
              unit="hours"
            />
            <UsageProgressBar
              label="Recording Storage"
              used={settings?.recordings_used_mb || 0}
              quota={settings?.recordings_quota_mb || 10240}
              unit="MB"
            />
          </div>
        </div>

        {/* Settings */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Meeting Defaults</h2>

          <div className="space-y-6">
            {/* Max Participants */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maximum Participants
              </label>
              <select
                value={formData.max_participants}
                onChange={(e) =>
                  setFormData({ ...formData, max_participants: parseInt(e.target.value) })
                }
                className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              >
                <option value={10}>10 participants</option>
                <option value={25}>25 participants</option>
                <option value={50}>50 participants</option>
                <option value={100}>100 participants</option>
                <option value={250}>250 participants</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Based on your plan limits
              </p>
            </div>

            {/* Max Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maximum Meeting Duration
              </label>
              <select
                value={formData.max_duration_minutes}
                onChange={(e) =>
                  setFormData({ ...formData, max_duration_minutes: parseInt(e.target.value) })
                }
                className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              >
                <option value={60}>1 hour</option>
                <option value={120}>2 hours</option>
                <option value={240}>4 hours</option>
                <option value={480}>8 hours</option>
                <option value={1440}>24 hours (unlimited)</option>
              </select>
            </div>

            {/* Feature Toggles */}
            <div className="border-t pt-6">
              <h3 className="text-sm font-medium text-gray-900 mb-4">Features</h3>
              <div className="space-y-4">
                <label className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-700">Allow Recording</p>
                    <p className="text-sm text-gray-500">
                      Let hosts record meetings to cloud storage
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.allow_recording}
                    onChange={(e) =>
                      setFormData({ ...formData, allow_recording: e.target.checked })
                    }
                    className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
                  />
                </label>

                <label className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-700">Waiting Room</p>
                    <p className="text-sm text-gray-500">
                      Require host approval before joining
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.waiting_room_enabled}
                    onChange={(e) =>
                      setFormData({ ...formData, waiting_room_enabled: e.target.checked })
                    }
                    className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
                  />
                </label>

                <label className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-700">In-Meeting Chat</p>
                    <p className="text-sm text-gray-500">
                      Allow participants to chat during meetings
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.chat_enabled}
                    onChange={(e) =>
                      setFormData({ ...formData, chat_enabled: e.target.checked })
                    }
                    className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
                  />
                </label>

                <label className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-700">Screen Sharing</p>
                    <p className="text-sm text-gray-500">
                      Allow participants to share their screen
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.screen_share_enabled}
                    onChange={(e) =>
                      setFormData({ ...formData, screen_share_enabled: e.target.checked })
                    }
                    className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
