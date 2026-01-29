/**
 * Workspace Settings Page - Customize your Bheem Workspace
 * Brand Colors: #FFCCF2 (Pink), #977DFF (Purple), #0033FF (Blue)
 */
import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  User,
  Palette,
  Bell,
  Shield,
  Globe,
  LayoutGrid,
  Moon,
  Sun,
  Monitor,
  Upload,
  Check,
  ChevronRight,
  Mail,
  Video,
  FileText,
  Calendar,
  HardDrive,
  MessageCircle,
  Eye,
  EyeOff,
  Clock,
  Languages,
  Smartphone,
  Key,
  LogOut,
  Trash2,
  Download,
  RefreshCw,
  Save,
  ArrowLeft,
  Building2,
  Image,
  Type,
  Sliders,
  Table,
  Presentation,
  FormInput,
  StickyNote,
} from 'lucide-react';
import WorkspaceLayout from '@/components/workspace/WorkspaceLayout';
import { useAuthStore, useRequireAuth } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { api } from '@/lib/api';

// Brand colors
const BRAND = {
  pink: '#FFCCF2',
  purple: '#977DFF',
  blue: '#0033FF',
};

// Settings sections
const settingsSections = [
  { id: 'general', name: 'General', icon: Settings, description: 'Workspace name, description & basics' },
  { id: 'appearance', name: 'Appearance', icon: Palette, description: 'Theme, colors & branding' },
  { id: 'apps', name: 'Apps & Features', icon: LayoutGrid, description: 'Enable or disable workspace apps' },
  { id: 'notifications', name: 'Notifications', icon: Bell, description: 'Email & push notification settings' },
  { id: 'security', name: 'Security', icon: Shield, description: 'Password, 2FA & sessions' },
  { id: 'language', name: 'Language & Region', icon: Globe, description: 'Language, timezone & date format' },
  { id: 'account', name: 'Account', icon: User, description: 'Profile, data export & deletion' },
];

// Available apps
const availableApps = [
  { id: 'mail', name: 'Bheem Mail', icon: Mail, description: 'Email and communication', color: BRAND.pink },
  { id: 'docs', name: 'Bheem Docs', icon: FileText, description: 'Documents and word processing', color: BRAND.purple },
  { id: 'sheets', name: 'Bheem Sheets', icon: Table, description: 'Spreadsheets and data', color: '#22c55e' },
  { id: 'slides', name: 'Bheem Slides', icon: Presentation, description: 'Presentations', color: '#f59e0b' },
  { id: 'calendar', name: 'Bheem Calendar', icon: Calendar, description: 'Scheduling and events', color: BRAND.purple },
  { id: 'meet', name: 'Bheem Meet', icon: Video, description: 'Video conferencing', color: '#10b981' },
  { id: 'drive', name: 'Bheem Drive', icon: HardDrive, description: 'Cloud storage', color: BRAND.blue },
  { id: 'notes', name: 'Bheem Notes', icon: StickyNote, description: 'Quick notes and reminders', color: '#f59e0b' },
  { id: 'sites', name: 'Bheem Sites', icon: Globe, description: 'Internal wikis and websites', color: BRAND.blue },
  { id: 'chat', name: 'Bheem Chat', icon: MessageCircle, description: 'Team messaging', color: BRAND.purple },
  { id: 'forms', name: 'Bheem Forms', icon: FormInput, description: 'Surveys and forms', color: BRAND.pink },
];

// Theme options
const themeOptions = [
  { id: 'light', name: 'Light', icon: Sun, description: 'Clean and bright' },
  { id: 'dark', name: 'Dark', icon: Moon, description: 'Easy on the eyes' },
  { id: 'system', name: 'System', icon: Monitor, description: 'Match device settings' },
];

// Accent color options
const accentColors = [
  { id: 'purple', name: 'Purple', color: '#977DFF' },
  { id: 'blue', name: 'Blue', color: '#0033FF' },
  { id: 'pink', name: 'Pink', color: '#FFCCF2' },
  { id: 'green', name: 'Green', color: '#10b981' },
  { id: 'orange', name: 'Orange', color: '#f59e0b' },
  { id: 'red', name: 'Red', color: '#ef4444' },
];

// Languages
const languages = [
  { id: 'en', name: 'English (US)' },
  { id: 'en-gb', name: 'English (UK)' },
  { id: 'es', name: 'Spanish' },
  { id: 'fr', name: 'French' },
  { id: 'de', name: 'German' },
  { id: 'hi', name: 'Hindi' },
  { id: 'ja', name: 'Japanese' },
  { id: 'zh', name: 'Chinese' },
];

// Timezones
const timezones = [
  { id: 'UTC', name: 'UTC (Coordinated Universal Time)' },
  { id: 'America/New_York', name: 'Eastern Time (US & Canada)' },
  { id: 'America/Los_Angeles', name: 'Pacific Time (US & Canada)' },
  { id: 'Europe/London', name: 'London (GMT)' },
  { id: 'Europe/Paris', name: 'Paris (CET)' },
  { id: 'Asia/Kolkata', name: 'India Standard Time' },
  { id: 'Asia/Tokyo', name: 'Tokyo (JST)' },
  { id: 'Australia/Sydney', name: 'Sydney (AEST)' },
];

// Date formats
const dateFormats = [
  { id: 'MM/DD/YYYY', name: 'MM/DD/YYYY (US)' },
  { id: 'DD/MM/YYYY', name: 'DD/MM/YYYY (UK/EU)' },
  { id: 'YYYY-MM-DD', name: 'YYYY-MM-DD (ISO)' },
];

interface WorkspaceSettings {
  general: {
    workspaceName: string;
    description: string;
    industry: string;
    size: string;
  };
  appearance: {
    theme: 'light' | 'dark' | 'system';
    accentColor: string;
    logo: string | null;
    showAppNames: boolean;
    compactMode: boolean;
    sidebarPosition: 'left' | 'right';
  };
  apps: {
    [key: string]: boolean;
  };
  notifications: {
    emailNotifications: boolean;
    pushNotifications: boolean;
    desktopNotifications: boolean;
    soundEnabled: boolean;
    emailDigest: 'none' | 'daily' | 'weekly';
    notifyOnMention: boolean;
    notifyOnComment: boolean;
    notifyOnShare: boolean;
  };
  security: {
    twoFactorEnabled: boolean;
    sessionTimeout: number;
    passwordLastChanged: string;
  };
  language: {
    language: string;
    timezone: string;
    dateFormat: string;
    timeFormat: '12h' | '24h';
    weekStart: 'sunday' | 'monday';
  };
}

// Toggle Switch Component
function ToggleSwitch({
  enabled,
  onChange,
  size = 'md',
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  size?: 'sm' | 'md';
}) {
  const sizeClasses = {
    sm: { track: 'w-9 h-5', thumb: 'w-4 h-4', translate: 'translate-x-4' },
    md: { track: 'w-11 h-6', thumb: 'w-5 h-5', translate: 'translate-x-5' },
  };

  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex ${sizeClasses[size].track} items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#977DFF]/50 ${
        enabled ? 'bg-gradient-to-r from-[#977DFF] to-[#0033FF]' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block ${sizeClasses[size].thumb} transform rounded-full bg-white shadow-lg transition-transform ${
          enabled ? sizeClasses[size].translate : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

// Settings Card Component
function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
      </div>
      {children}
    </div>
  );
}

// Settings Row Component
function SettingsRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0">
      <div className="flex-1 pr-4">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();
  const { updateSettings: updateGlobalSettings, applyTheme } = useSettingsStore();
  const [activeSection, setActiveSection] = useState('general');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Settings state
  const [settings, setSettings] = useState<WorkspaceSettings>({
    general: {
      workspaceName: 'My Workspace',
      description: '',
      industry: 'technology',
      size: '1-10',
    },
    appearance: {
      theme: 'light',
      accentColor: '#977DFF',
      logo: null,
      showAppNames: true,
      compactMode: false,
      sidebarPosition: 'left',
    },
    apps: {
      mail: true,
      docs: true,
      sheets: true,
      slides: true,
      calendar: true,
      meet: true,
      drive: true,
      notes: true,
      sites: true,
      chat: true,
      forms: true,
    },
    notifications: {
      emailNotifications: true,
      pushNotifications: true,
      desktopNotifications: true,
      soundEnabled: true,
      emailDigest: 'daily',
      notifyOnMention: true,
      notifyOnComment: true,
      notifyOnShare: true,
    },
    security: {
      twoFactorEnabled: false,
      sessionTimeout: 30,
      passwordLastChanged: new Date().toISOString(),
    },
    language: {
      language: 'en',
      timezone: 'UTC',
      dateFormat: 'MM/DD/YYYY',
      timeFormat: '12h',
      weekStart: 'sunday',
    },
  });

  // Load settings on mount
  useEffect(() => {
    const loadSettingsFromAPI = async () => {
      try {
        // Load from API
        const response = await api.get('/settings');
        if (response.data) {
          const loadedSettings = {
            general: { ...settings.general, ...response.data.general },
            appearance: { ...settings.appearance, ...response.data.appearance },
            apps: { ...settings.apps, ...response.data.apps },
            notifications: { ...settings.notifications, ...response.data.notifications },
            security: { ...settings.security, ...response.data.security },
            language: { ...settings.language, ...response.data.language },
          };
          setSettings(loadedSettings);
          // Also sync to global store so other components see the settings
          updateGlobalSettings(loadedSettings as any);
        }
      } catch (error) {
        console.error('Failed to load settings from API:', error);
        // Fallback to localStorage
        try {
          const savedSettings = localStorage.getItem('bheem_workspace_settings');
          if (savedSettings) {
            const parsed = JSON.parse(savedSettings);
            setSettings(parsed);
            updateGlobalSettings(parsed as any);
          }
        } catch (e) {
          console.error('Failed to load settings from localStorage:', e);
        }
      }
    };
    loadSettingsFromAPI();
  }, []);

  // Update setting helper
  const updateSetting = <K extends keyof WorkspaceSettings>(
    section: K,
    key: keyof WorkspaceSettings[K],
    value: any
  ) => {
    const newSectionSettings = {
      ...settings[section],
      [key]: value,
    };

    const newSettings = {
      ...settings,
      [section]: newSectionSettings,
    };

    setSettings(newSettings);
    setHasChanges(true);
    setSaved(false);

    // Sync ALL settings to global store immediately for real-time UI updates
    updateGlobalSettings({ [section]: newSectionSettings } as any);

    // Apply theme changes if appearance updated
    if (section === 'appearance') {
      applyTheme();
    }
  };

  // Save settings
  const saveSettings = async () => {
    setSaving(true);
    try {
      // Save to API
      await api.put('/settings', settings);

      // Also save to localStorage as backup
      localStorage.setItem('bheem_workspace_settings', JSON.stringify(settings));

      // Update global settings store
      updateGlobalSettings(settings as any);
      applyTheme();

      // Dispatch custom event so other components can react to settings change
      window.dispatchEvent(new CustomEvent('bheem-settings-changed', { detail: settings }));

      setSaved(true);
      setHasChanges(false);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save settings to API:', error);
      // Still save to localStorage as fallback
      try {
        localStorage.setItem('bheem_workspace_settings', JSON.stringify(settings));
        updateGlobalSettings(settings as any);
        applyTheme();
        setSaved(true);
        setHasChanges(false);
        setTimeout(() => setSaved(false), 3000);
      } catch (e) {
        console.error('Failed to save settings:', e);
      }
    } finally {
      setSaving(false);
    }
  };

  // Skip showing loading screen
  if (authLoading) {
    return null;
  }

  // Render section content
  const renderSectionContent = () => {
    switch (activeSection) {
      case 'general':
        return (
          <motion.div
            key="general"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <SettingsCard title="Workspace Information" description="Basic details about your workspace">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Workspace Name</label>
                  <input
                    type="text"
                    value={settings.general.workspaceName}
                    onChange={(e) => updateSetting('general', 'workspaceName', e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#977DFF]/50 focus:border-[#977DFF]"
                    placeholder="Enter workspace name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={settings.general.description}
                    onChange={(e) => updateSetting('general', 'description', e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#977DFF]/50 focus:border-[#977DFF] resize-none"
                    rows={3}
                    placeholder="Describe your workspace"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Industry</label>
                    <select
                      value={settings.general.industry}
                      onChange={(e) => updateSetting('general', 'industry', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#977DFF]/50 focus:border-[#977DFF]"
                    >
                      <option value="technology">Technology</option>
                      <option value="finance">Finance</option>
                      <option value="healthcare">Healthcare</option>
                      <option value="education">Education</option>
                      <option value="retail">Retail</option>
                      <option value="manufacturing">Manufacturing</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Team Size</label>
                    <select
                      value={settings.general.size}
                      onChange={(e) => updateSetting('general', 'size', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#977DFF]/50 focus:border-[#977DFF]"
                    >
                      <option value="1-10">1-10 members</option>
                      <option value="11-50">11-50 members</option>
                      <option value="51-200">51-200 members</option>
                      <option value="201-500">201-500 members</option>
                      <option value="500+">500+ members</option>
                    </select>
                  </div>
                </div>
              </div>
            </SettingsCard>
          </motion.div>
        );

      case 'appearance':
        return (
          <motion.div
            key="appearance"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <SettingsCard title="Theme" description="Choose how Bheem Workspace looks to you">
              <div className="grid grid-cols-3 gap-4">
                {themeOptions.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => updateSetting('appearance', 'theme', theme.id as any)}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      settings.appearance.theme === theme.id
                        ? 'border-[#977DFF] bg-[#977DFF]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 ${
                      settings.appearance.theme === theme.id
                        ? 'bg-gradient-to-br from-[#FFCCF2] via-[#977DFF] to-[#0033FF] text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      <theme.icon size={24} />
                    </div>
                    <p className="font-medium text-gray-900 text-center">{theme.name}</p>
                    <p className="text-xs text-gray-500 text-center mt-1">{theme.description}</p>
                    {settings.appearance.theme === theme.id && (
                      <div className="flex justify-center mt-2">
                        <Check size={16} className="text-[#977DFF]" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </SettingsCard>

            <SettingsCard title="Accent Color" description="Choose your preferred accent color">
              <div className="flex flex-wrap gap-3">
                {accentColors.map((color) => (
                  <button
                    key={color.id}
                    onClick={() => updateSetting('appearance', 'accentColor', color.color)}
                    className={`w-12 h-12 rounded-xl transition-all relative ${
                      settings.appearance.accentColor === color.color
                        ? 'ring-2 ring-offset-2 ring-gray-400 scale-110'
                        : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: color.color }}
                    title={color.name}
                  >
                    {settings.appearance.accentColor === color.color && (
                      <Check size={20} className="absolute inset-0 m-auto text-white drop-shadow-md" />
                    )}
                  </button>
                ))}
              </div>
            </SettingsCard>

            <SettingsCard title="Workspace Logo" description="Upload your company logo">
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#FFCCF2] via-[#977DFF] to-[#0033FF] flex items-center justify-center text-white text-3xl font-bold">
                  {settings.general.workspaceName.charAt(0).toUpperCase() || 'B'}
                </div>
                <div className="flex-1">
                  <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                    <Upload size={18} />
                    <span>Upload Logo</span>
                  </button>
                  <p className="text-xs text-gray-500 mt-2">
                    Recommended: 512x512px, PNG or SVG format
                  </p>
                </div>
              </div>
            </SettingsCard>

            <SettingsCard title="Display Options">
              <SettingsRow label="Show app names in sidebar" description="Display text labels next to app icons">
                <ToggleSwitch
                  enabled={settings.appearance.showAppNames}
                  onChange={(v) => updateSetting('appearance', 'showAppNames', v)}
                />
              </SettingsRow>
              <SettingsRow label="Compact mode" description="Reduce spacing and padding for more content">
                <ToggleSwitch
                  enabled={settings.appearance.compactMode}
                  onChange={(v) => updateSetting('appearance', 'compactMode', v)}
                />
              </SettingsRow>
              <SettingsRow label="Sidebar position" description="Choose which side the navigation appears">
                <select
                  value={settings.appearance.sidebarPosition}
                  onChange={(e) => updateSetting('appearance', 'sidebarPosition', e.target.value as any)}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#977DFF]/50"
                >
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </SettingsRow>
            </SettingsCard>
          </motion.div>
        );

      case 'apps':
        return (
          <motion.div
            key="apps"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <SettingsCard title="Enabled Apps" description="Choose which apps appear in your workspace">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableApps.map((app) => (
                  <div
                    key={app.id}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      settings.apps[app.id]
                        ? 'border-[#977DFF]/30 bg-[#977DFF]/5'
                        : 'border-gray-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: `${app.color}20`, color: app.color }}
                        >
                          <app.icon size={20} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{app.name}</p>
                          <p className="text-xs text-gray-500">{app.description}</p>
                        </div>
                      </div>
                      <ToggleSwitch
                        enabled={settings.apps[app.id]}
                        onChange={(v) => updateSetting('apps', app.id as any, v)}
                        size="sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </SettingsCard>
          </motion.div>
        );

      case 'notifications':
        return (
          <motion.div
            key="notifications"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <SettingsCard title="Notification Channels" description="How you want to receive notifications">
              <SettingsRow label="Email notifications" description="Receive updates via email">
                <ToggleSwitch
                  enabled={settings.notifications.emailNotifications}
                  onChange={(v) => updateSetting('notifications', 'emailNotifications', v)}
                />
              </SettingsRow>
              <SettingsRow label="Push notifications" description="Receive notifications on your devices">
                <ToggleSwitch
                  enabled={settings.notifications.pushNotifications}
                  onChange={(v) => updateSetting('notifications', 'pushNotifications', v)}
                />
              </SettingsRow>
              <SettingsRow label="Desktop notifications" description="Show notifications in your browser">
                <ToggleSwitch
                  enabled={settings.notifications.desktopNotifications}
                  onChange={(v) => updateSetting('notifications', 'desktopNotifications', v)}
                />
              </SettingsRow>
              <SettingsRow label="Sound" description="Play a sound for new notifications">
                <ToggleSwitch
                  enabled={settings.notifications.soundEnabled}
                  onChange={(v) => updateSetting('notifications', 'soundEnabled', v)}
                />
              </SettingsRow>
            </SettingsCard>

            <SettingsCard title="Email Digest" description="Summary of activity sent to your email">
              <div className="flex gap-3">
                {(['none', 'daily', 'weekly'] as const).map((option) => (
                  <button
                    key={option}
                    onClick={() => updateSetting('notifications', 'emailDigest', option)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      settings.notifications.emailDigest === option
                        ? 'bg-gradient-to-r from-[#977DFF] to-[#0033FF] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {option === 'none' ? 'Off' : option.charAt(0).toUpperCase() + option.slice(1)}
                  </button>
                ))}
              </div>
            </SettingsCard>

            <SettingsCard title="Activity Notifications" description="Get notified about specific activities">
              <SettingsRow label="Mentions" description="When someone @mentions you">
                <ToggleSwitch
                  enabled={settings.notifications.notifyOnMention}
                  onChange={(v) => updateSetting('notifications', 'notifyOnMention', v)}
                />
              </SettingsRow>
              <SettingsRow label="Comments" description="When someone comments on your content">
                <ToggleSwitch
                  enabled={settings.notifications.notifyOnComment}
                  onChange={(v) => updateSetting('notifications', 'notifyOnComment', v)}
                />
              </SettingsRow>
              <SettingsRow label="Sharing" description="When someone shares something with you">
                <ToggleSwitch
                  enabled={settings.notifications.notifyOnShare}
                  onChange={(v) => updateSetting('notifications', 'notifyOnShare', v)}
                />
              </SettingsRow>
            </SettingsCard>
          </motion.div>
        );

      case 'security':
        return (
          <motion.div
            key="security"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <SettingsCard title="Password" description="Manage your account password">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">
                    Last changed: {new Date(settings.security.passwordLastChanged).toLocaleDateString()}
                  </p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors">
                  <Key size={18} />
                  Change Password
                </button>
              </div>
            </SettingsCard>

            <SettingsCard title="Two-Factor Authentication" description="Add an extra layer of security">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    settings.security.twoFactorEnabled
                      ? 'bg-green-100 text-green-600'
                      : 'bg-gray-100 text-gray-400'
                  }`}>
                    <Shield size={24} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {settings.security.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {settings.security.twoFactorEnabled
                        ? 'Your account is protected with 2FA'
                        : 'Enable 2FA for enhanced security'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => updateSetting('security', 'twoFactorEnabled', !settings.security.twoFactorEnabled)}
                  className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                    settings.security.twoFactorEnabled
                      ? 'bg-red-100 text-red-600 hover:bg-red-200'
                      : 'bg-gradient-to-r from-[#977DFF] to-[#0033FF] text-white'
                  }`}
                >
                  {settings.security.twoFactorEnabled ? 'Disable' : 'Enable'}
                </button>
              </div>
            </SettingsCard>

            <SettingsCard title="Session Settings" description="Control your login sessions">
              <SettingsRow label="Session timeout" description="Automatically log out after inactivity">
                <select
                  value={settings.security.sessionTimeout}
                  onChange={(e) => updateSetting('security', 'sessionTimeout', parseInt(e.target.value))}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#977DFF]/50"
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={120}>2 hours</option>
                  <option value={0}>Never</option>
                </select>
              </SettingsRow>
            </SettingsCard>

            <SettingsCard title="Active Sessions">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl border border-green-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                      <Monitor size={20} className="text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Current Session</p>
                      <p className="text-xs text-gray-500">Chrome on Windows - Active now</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded-full bg-green-100 text-green-600 text-xs font-medium">Active</span>
                </div>
              </div>
              <button className="mt-4 flex items-center gap-2 text-red-600 hover:text-red-700 text-sm font-medium">
                <LogOut size={16} />
                Sign out of all other sessions
              </button>
            </SettingsCard>
          </motion.div>
        );

      case 'language':
        return (
          <motion.div
            key="language"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <SettingsCard title="Language & Region" description="Set your preferred language and regional settings">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
                  <select
                    value={settings.language.language}
                    onChange={(e) => updateSetting('language', 'language', e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#977DFF]/50 focus:border-[#977DFF]"
                  >
                    {languages.map((lang) => (
                      <option key={lang.id} value={lang.id}>{lang.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    UI translation coming soon. Regional formats below are active.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
                  <select
                    value={settings.language.timezone}
                    onChange={(e) => updateSetting('language', 'timezone', e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#977DFF]/50 focus:border-[#977DFF]"
                  >
                    {timezones.map((tz) => (
                      <option key={tz.id} value={tz.id}>{tz.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </SettingsCard>

            <SettingsCard title="Date & Time Format">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date Format</label>
                  <select
                    value={settings.language.dateFormat}
                    onChange={(e) => updateSetting('language', 'dateFormat', e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#977DFF]/50 focus:border-[#977DFF]"
                  >
                    {dateFormats.map((fmt) => (
                      <option key={fmt.id} value={fmt.id}>{fmt.name}</option>
                    ))}
                  </select>
                </div>
                <SettingsRow label="Time format" description="Choose 12-hour or 24-hour format">
                  <div className="flex gap-2">
                    {(['12h', '24h'] as const).map((format) => (
                      <button
                        key={format}
                        onClick={() => updateSetting('language', 'timeFormat', format)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                          settings.language.timeFormat === format
                            ? 'bg-gradient-to-r from-[#977DFF] to-[#0033FF] text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {format === '12h' ? '12-hour' : '24-hour'}
                      </button>
                    ))}
                  </div>
                </SettingsRow>
                <SettingsRow label="Week starts on" description="Choose the first day of your week">
                  <select
                    value={settings.language.weekStart}
                    onChange={(e) => updateSetting('language', 'weekStart', e.target.value as any)}
                    className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#977DFF]/50"
                  >
                    <option value="sunday">Sunday</option>
                    <option value="monday">Monday</option>
                  </select>
                </SettingsRow>
              </div>
            </SettingsCard>
          </motion.div>
        );

      case 'account':
        return (
          <motion.div
            key="account"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <SettingsCard title="Profile Information">
              <div className="flex items-center gap-6 mb-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FFCCF2] via-[#977DFF] to-[#0033FF] flex items-center justify-center text-white text-2xl font-bold">
                  {user?.username?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-lg">{user?.username || 'User'}</p>
                  <p className="text-gray-500">{user?.email || ''}</p>
                  <button className="mt-2 text-sm text-[#977DFF] hover:text-[#0033FF] font-medium">
                    Edit Profile
                  </button>
                </div>
              </div>
            </SettingsCard>

            <SettingsCard title="Data & Privacy">
              <div className="space-y-4">
                <button className="flex items-center gap-3 w-full p-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-left">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Download size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Export Your Data</p>
                    <p className="text-sm text-gray-500">Download a copy of all your data</p>
                  </div>
                  <ChevronRight size={20} className="ml-auto text-gray-400" />
                </button>
                <button className="flex items-center gap-3 w-full p-4 rounded-xl border border-red-200 hover:bg-red-50 transition-colors text-left">
                  <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                    <Trash2 size={20} className="text-red-600" />
                  </div>
                  <div>
                    <p className="font-medium text-red-600">Delete Account</p>
                    <p className="text-sm text-gray-500">Permanently delete your account and data</p>
                  </div>
                  <ChevronRight size={20} className="ml-auto text-gray-400" />
                </button>
              </div>
            </SettingsCard>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <WorkspaceLayout title="Settings">
      <Head>
        <title>Settings | Bheem Workspace</title>
      </Head>

      <div className="h-full bg-gray-50 overflow-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft size={20} className="text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                <p className="text-sm text-gray-500">Customize your Bheem Workspace experience</p>
              </div>
            </div>
            <motion.button
              onClick={saveSettings}
              disabled={saving || !hasChanges}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${
                hasChanges
                  ? 'bg-gradient-to-r from-[#977DFF] to-[#0033FF] text-white hover:shadow-lg'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
              whileHover={hasChanges ? { scale: 1.02 } : {}}
              whileTap={hasChanges ? { scale: 0.98 } : {}}
            >
              {saving ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Saving...
                </>
              ) : saved ? (
                <>
                  <Check size={18} />
                  Saved!
                </>
              ) : (
                <>
                  <Save size={18} />
                  Save Changes
                </>
              )}
            </motion.button>
          </div>
        </div>

        {/* Content */}
        <div className="flex">
          {/* Sidebar Navigation */}
          <div className="w-64 min-h-[calc(100vh-140px)] bg-white border-r border-gray-200 p-4">
            <nav className="space-y-1">
              {settingsSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                    activeSection === section.id
                      ? 'bg-gradient-to-r from-[#FFCCF2]/20 via-[#977DFF]/20 to-[#0033FF]/20 text-[#977DFF]'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <section.icon size={20} />
                  <div>
                    <p className={`font-medium ${activeSection === section.id ? 'text-[#977DFF]' : 'text-gray-900'}`}>
                      {section.name}
                    </p>
                    <p className="text-xs text-gray-500 hidden lg:block">{section.description}</p>
                  </div>
                </button>
              ))}
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-6 max-w-3xl">
            <AnimatePresence mode="wait">
              {renderSectionContent()}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </WorkspaceLayout>
  );
}
