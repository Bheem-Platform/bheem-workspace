import { useState } from 'react';
import Head from 'next/head';
import {
  Settings,
  FileText,
  Download,
  Upload,
  Bell,
  Shield,
  Clock,
  HardDrive,
  Palette,
  Globe,
  Save,
  RotateCcw,
} from 'lucide-react';
import AppSwitcherBar from '@/components/shared/AppSwitcherBar';
import DocsSidebar from '@/components/docs/DocsSidebar';
import { useRequireAuth } from '@/stores/authStore';

interface SettingsSection {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const sections: SettingsSection[] = [
  { id: 'general', label: 'General', icon: <Settings size={20} /> },
  { id: 'appearance', label: 'Appearance', icon: <Palette size={20} /> },
  { id: 'storage', label: 'Storage', icon: <HardDrive size={20} /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={20} /> },
  { id: 'export', label: 'Export & Import', icon: <Download size={20} /> },
  { id: 'security', label: 'Security', icon: <Shield size={20} /> },
];

export default function DocsSettingsPage() {
  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeSection, setActiveSection] = useState('general');
  const [hasChanges, setHasChanges] = useState(false);

  // Settings state
  const [settings, setSettings] = useState({
    // General
    defaultView: 'grid',
    autoSave: true,
    autoSaveInterval: 30,
    showRecentFiles: true,
    showFileExtensions: false,

    // Appearance
    theme: 'light',
    fontSize: 'medium',
    compactMode: false,
    showThumbnails: true,

    // Storage
    maxUploadSize: 100,
    autoCleanTrash: true,
    trashRetentionDays: 30,

    // Notifications
    emailOnShare: true,
    emailOnComment: true,
    emailOnMention: true,
    desktopNotifications: false,

    // Export
    defaultExportFormat: 'pdf',
    includeMetadata: true,

    // Security
    requirePasswordForSharing: false,
    defaultShareExpiry: 7,
    allowPublicLinks: true,
  });

  const handleSettingChange = (key: string, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    // TODO: Save settings to backend
    console.log('Saving settings:', settings);
    setHasChanges(false);
  };

  const handleReset = () => {
    // TODO: Reset to defaults
    setHasChanges(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500" />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Settings | Bheem Docs</title>
      </Head>

      <div className="min-h-screen flex bg-gray-100">
        {/* App Switcher Bar */}
        <AppSwitcherBar activeApp="docs" />

        {/* Docs Sidebar */}
        <div className="fixed left-[60px] top-0 bottom-0 w-[240px] z-40">
          <DocsSidebar activeType="home" />
        </div>

        <div
          className="flex-1 transition-all duration-300 flex flex-col"
          style={{ marginLeft: 300 }}
        >

          <div className="flex-1 max-w-6xl mx-auto px-6 py-8 w-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                <p className="text-gray-500">Configure your document preferences</p>
              </div>
              {hasChanges && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <RotateCcw size={18} />
                    <span>Reset</span>
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-2 px-4 py-2.5 bg-purple-500 text-white font-medium rounded-lg hover:bg-purple-600 transition-colors"
                  >
                    <Save size={18} />
                    <span>Save Changes</span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex gap-6">
              {/* Sidebar */}
              <div className="w-56 flex-shrink-0">
                <nav className="bg-white rounded-xl border border-gray-200 p-2">
                  {sections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                        activeSection === section.id
                          ? 'bg-purple-50 text-purple-700'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {section.icon}
                      <span className="font-medium">{section.label}</span>
                    </button>
                  ))}
                </nav>
              </div>

              {/* Content */}
              <div className="flex-1 bg-white rounded-xl border border-gray-200 p-6">
                {activeSection === 'general' && (
                  <GeneralSettings settings={settings} onChange={handleSettingChange} />
                )}
                {activeSection === 'appearance' && (
                  <AppearanceSettings settings={settings} onChange={handleSettingChange} />
                )}
                {activeSection === 'storage' && (
                  <StorageSettings settings={settings} onChange={handleSettingChange} />
                )}
                {activeSection === 'notifications' && (
                  <NotificationSettings settings={settings} onChange={handleSettingChange} />
                )}
                {activeSection === 'export' && (
                  <ExportSettings settings={settings} onChange={handleSettingChange} />
                )}
                {activeSection === 'security' && (
                  <SecuritySettings settings={settings} onChange={handleSettingChange} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Settings Components
function GeneralSettings({ settings, onChange }: { settings: any; onChange: (key: string, value: any) => void }) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">General Settings</h2>

      <SettingRow
        label="Default View"
        description="Choose how files are displayed by default"
      >
        <select
          value={settings.defaultView}
          onChange={(e) => onChange('defaultView', e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
        >
          <option value="grid">Grid</option>
          <option value="list">List</option>
        </select>
      </SettingRow>

      <SettingToggle
        label="Auto-save"
        description="Automatically save documents while editing"
        checked={settings.autoSave}
        onChange={(v) => onChange('autoSave', v)}
      />

      {settings.autoSave && (
        <SettingRow
          label="Auto-save Interval"
          description="How often to auto-save (in seconds)"
        >
          <input
            type="number"
            value={settings.autoSaveInterval}
            onChange={(e) => onChange('autoSaveInterval', parseInt(e.target.value))}
            min={5}
            max={300}
            className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          />
        </SettingRow>
      )}

      <SettingToggle
        label="Show Recent Files"
        description="Display recently opened files on the home page"
        checked={settings.showRecentFiles}
        onChange={(v) => onChange('showRecentFiles', v)}
      />

      <SettingToggle
        label="Show File Extensions"
        description="Display file extensions in file names"
        checked={settings.showFileExtensions}
        onChange={(v) => onChange('showFileExtensions', v)}
      />
    </div>
  );
}

function AppearanceSettings({ settings, onChange }: { settings: any; onChange: (key: string, value: any) => void }) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Appearance</h2>

      <SettingRow label="Theme" description="Choose your preferred color theme">
        <select
          value={settings.theme}
          onChange={(e) => onChange('theme', e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
      </SettingRow>

      <SettingRow label="Font Size" description="Document editor font size">
        <select
          value={settings.fontSize}
          onChange={(e) => onChange('fontSize', e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
        >
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </SettingRow>

      <SettingToggle
        label="Compact Mode"
        description="Use a more compact layout with smaller spacing"
        checked={settings.compactMode}
        onChange={(v) => onChange('compactMode', v)}
      />

      <SettingToggle
        label="Show Thumbnails"
        description="Display file thumbnails in grid view"
        checked={settings.showThumbnails}
        onChange={(v) => onChange('showThumbnails', v)}
      />
    </div>
  );
}

function StorageSettings({ settings, onChange }: { settings: any; onChange: (key: string, value: any) => void }) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Storage</h2>

      {/* Storage Usage */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium text-gray-900">Storage Used</span>
          <span className="text-sm text-gray-600">2.5 GB of 15 GB</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-purple-500 h-2 rounded-full" style={{ width: '16.7%' }} />
        </div>
      </div>

      <SettingRow
        label="Max Upload Size"
        description="Maximum file size for uploads (MB)"
      >
        <input
          type="number"
          value={settings.maxUploadSize}
          onChange={(e) => onChange('maxUploadSize', parseInt(e.target.value))}
          min={1}
          max={500}
          className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
        />
      </SettingRow>

      <SettingToggle
        label="Auto-clean Trash"
        description="Automatically delete files from trash after retention period"
        checked={settings.autoCleanTrash}
        onChange={(v) => onChange('autoCleanTrash', v)}
      />

      {settings.autoCleanTrash && (
        <SettingRow
          label="Trash Retention"
          description="Days to keep files in trash before deletion"
        >
          <input
            type="number"
            value={settings.trashRetentionDays}
            onChange={(e) => onChange('trashRetentionDays', parseInt(e.target.value))}
            min={1}
            max={365}
            className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          />
        </SettingRow>
      )}
    </div>
  );
}

function NotificationSettings({ settings, onChange }: { settings: any; onChange: (key: string, value: any) => void }) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>

      <SettingToggle
        label="Email on Share"
        description="Receive email when someone shares a file with you"
        checked={settings.emailOnShare}
        onChange={(v) => onChange('emailOnShare', v)}
      />

      <SettingToggle
        label="Email on Comment"
        description="Receive email when someone comments on your document"
        checked={settings.emailOnComment}
        onChange={(v) => onChange('emailOnComment', v)}
      />

      <SettingToggle
        label="Email on Mention"
        description="Receive email when someone mentions you in a comment"
        checked={settings.emailOnMention}
        onChange={(v) => onChange('emailOnMention', v)}
      />

      <SettingToggle
        label="Desktop Notifications"
        description="Show browser notifications for updates"
        checked={settings.desktopNotifications}
        onChange={(v) => onChange('desktopNotifications', v)}
      />
    </div>
  );
}

function ExportSettings({ settings, onChange }: { settings: any; onChange: (key: string, value: any) => void }) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Export & Import</h2>

      <SettingRow
        label="Default Export Format"
        description="Default format when exporting documents"
      >
        <select
          value={settings.defaultExportFormat}
          onChange={(e) => onChange('defaultExportFormat', e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
        >
          <option value="pdf">PDF</option>
          <option value="docx">Word (.docx)</option>
          <option value="odt">OpenDocument (.odt)</option>
          <option value="html">HTML</option>
          <option value="md">Markdown</option>
        </select>
      </SettingRow>

      <SettingToggle
        label="Include Metadata"
        description="Include document metadata in exports"
        checked={settings.includeMetadata}
        onChange={(v) => onChange('includeMetadata', v)}
      />

      {/* Export All Data */}
      <div className="pt-4 border-t border-gray-200">
        <h3 className="font-medium text-gray-900 mb-2">Export All Data</h3>
        <p className="text-sm text-gray-600 mb-4">
          Download all your documents and data in a single archive
        </p>
        <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          <Download size={18} />
          <span>Export All Data</span>
        </button>
      </div>
    </div>
  );
}

function SecuritySettings({ settings, onChange }: { settings: any; onChange: (key: string, value: any) => void }) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Security</h2>

      <SettingToggle
        label="Password for Sharing"
        description="Require password when sharing files externally"
        checked={settings.requirePasswordForSharing}
        onChange={(v) => onChange('requirePasswordForSharing', v)}
      />

      <SettingRow
        label="Default Share Expiry"
        description="Default expiration for shared links (days, 0 = never)"
      >
        <input
          type="number"
          value={settings.defaultShareExpiry}
          onChange={(e) => onChange('defaultShareExpiry', parseInt(e.target.value))}
          min={0}
          max={365}
          className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
        />
      </SettingRow>

      <SettingToggle
        label="Allow Public Links"
        description="Allow creating publicly accessible share links"
        checked={settings.allowPublicLinks}
        onChange={(v) => onChange('allowPublicLinks', v)}
      />
    </div>
  );
}

// Helper Components
function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div>
        <div className="font-medium text-gray-900">{label}</div>
        <div className="text-sm text-gray-500">{description}</div>
      </div>
      {children}
    </div>
  );
}

function SettingToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div>
        <div className="font-medium text-gray-900">{label}</div>
        <div className="text-sm text-gray-500">{description}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${
          checked ? 'bg-purple-500' : 'bg-gray-300'
        }`}
      >
        <div
          className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}
