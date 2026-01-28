/**
 * Bheem Workspace - Settings Store
 * Global state management for user settings using Zustand
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';

// Types
interface AppearanceSettings {
  theme: 'light' | 'dark' | 'system';
  accentColor: string;
  logo: string | null;
  showAppNames: boolean;
  compactMode: boolean;
  sidebarPosition: 'left' | 'right';
}

interface AppsSettings {
  mail: boolean;
  docs: boolean;
  sheets: boolean;
  slides: boolean;
  calendar: boolean;
  meet: boolean;
  drive: boolean;
  chat: boolean;
  forms: boolean;
}

interface NotificationSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  desktopNotifications: boolean;
  soundEnabled: boolean;
  emailDigest: 'none' | 'daily' | 'weekly';
  notifyOnMention: boolean;
  notifyOnComment: boolean;
  notifyOnShare: boolean;
}

interface LanguageSettings {
  language: string;
  timezone: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  weekStart: 'sunday' | 'monday';
}

interface GeneralSettings {
  workspaceName: string;
  description: string;
  industry: string;
  size: string;
}

export interface WorkspaceSettings {
  general: GeneralSettings;
  appearance: AppearanceSettings;
  apps: AppsSettings;
  notifications: NotificationSettings;
  language: LanguageSettings;
}

interface SettingsState {
  settings: WorkspaceSettings;
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;

  // Actions
  loadSettings: () => Promise<void>;
  updateSettings: (settings: Partial<WorkspaceSettings>) => void;
  saveSettings: () => Promise<boolean>;
  resetSettings: () => void;
  applyTheme: () => void;

  // Getters
  getTheme: () => 'light' | 'dark';
  getAccentColor: () => string;
  isAppEnabled: (appId: string) => boolean;
}

// Default settings
const defaultSettings: WorkspaceSettings = {
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
  language: {
    language: 'en',
    timezone: 'UTC',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
    weekStart: 'sunday',
  },
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      isLoading: false,
      isLoaded: false,
      error: null,

      loadSettings: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.get('/settings');
          if (response.data) {
            const currentSettings = get().settings;
            set({
              settings: {
                general: { ...currentSettings.general, ...response.data.general },
                appearance: { ...currentSettings.appearance, ...response.data.appearance },
                apps: { ...currentSettings.apps, ...response.data.apps },
                notifications: { ...currentSettings.notifications, ...response.data.notifications },
                language: { ...currentSettings.language, ...response.data.language },
              },
              isLoaded: true,
              isLoading: false,
            });

            // Apply theme immediately
            get().applyTheme();
          }
        } catch (error: any) {
          console.error('Failed to load settings:', error);
          set({
            error: error.message || 'Failed to load settings',
            isLoading: false,
            isLoaded: true,
          });
        }
      },

      updateSettings: (newSettings) => {
        const current = get().settings;
        set({
          settings: {
            general: { ...current.general, ...newSettings.general },
            appearance: { ...current.appearance, ...newSettings.appearance },
            apps: { ...current.apps, ...newSettings.apps },
            notifications: { ...current.notifications, ...newSettings.notifications },
            language: { ...current.language, ...newSettings.language },
          },
        });

        // Apply theme when appearance changes
        if (newSettings.appearance) {
          get().applyTheme();
        }
      },

      saveSettings: async () => {
        try {
          await api.put('/settings', get().settings);
          return true;
        } catch (error) {
          console.error('Failed to save settings:', error);
          return false;
        }
      },

      resetSettings: () => {
        set({ settings: defaultSettings });
        get().applyTheme();
      },

      getTheme: () => {
        const { theme } = get().settings.appearance;
        if (theme === 'system') {
          if (typeof window !== 'undefined') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
          }
          return 'light';
        }
        return theme;
      },

      getAccentColor: () => {
        return get().settings.appearance.accentColor || '#977DFF';
      },

      isAppEnabled: (appId: string) => {
        const apps = get().settings.apps;
        return (apps as unknown as Record<string, boolean>)[appId] !== false;
      },

      applyTheme: () => {
        if (typeof window === 'undefined') return;

        const theme = get().getTheme();
        const accentColor = get().getAccentColor();

        // Apply theme class to document
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }

        // Apply accent color as CSS variable
        document.documentElement.style.setProperty('--accent-color', accentColor);

        // Apply compact mode
        const { compactMode } = get().settings.appearance;
        if (compactMode) {
          document.documentElement.classList.add('compact-mode');
        } else {
          document.documentElement.classList.remove('compact-mode');
        }
      },
    }),
    {
      name: 'bheem-settings',
      partialize: (state) => ({ settings: state.settings }),
    }
  )
);

// Hook to initialize settings on app load
export function useInitializeSettings() {
  const { loadSettings, isLoaded, isLoading } = useSettingsStore();

  if (!isLoaded && !isLoading && typeof window !== 'undefined') {
    loadSettings();
  }
}

// Selector hooks for specific settings
export const useTheme = () => useSettingsStore((state) => state.getTheme());
export const useAccentColor = () => useSettingsStore((state) => state.settings.appearance.accentColor);
export const useCompactMode = () => useSettingsStore((state) => state.settings.appearance.compactMode);
export const useShowAppNames = () => useSettingsStore((state) => state.settings.appearance.showAppNames);
export const useSidebarPosition = () => useSettingsStore((state) => state.settings.appearance.sidebarPosition);
export const useEnabledApps = () => useSettingsStore((state) => state.settings.apps);

// Language/Regional settings selectors
export const useWeekStart = () => useSettingsStore((state) => state.settings.language.weekStart);
export const useDateFormat = () => useSettingsStore((state) => state.settings.language.dateFormat);
export const useTimeFormat = () => useSettingsStore((state) => state.settings.language.timeFormat);
export const useTimezone = () => useSettingsStore((state) => state.settings.language.timezone);
export const useLanguageSettings = () => useSettingsStore((state) => state.settings.language);
