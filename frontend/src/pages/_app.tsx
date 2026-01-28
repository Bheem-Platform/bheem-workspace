import { useEffect } from 'react'
import type { AppProps } from 'next/app'
import '@/styles/globals.css'
import '@/styles/meet-design-tokens.css'
import { useAuthStore } from '@/stores/authStore'
import { useSettingsStore } from '@/stores/settingsStore'

export default function App({ Component, pageProps }: AppProps) {
  const initialize = useAuthStore((state) => state.initialize)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const { loadSettings, applyTheme, isLoaded } = useSettingsStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  // Load settings only after user is authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoaded) {
      loadSettings()
    }
  }, [isAuthenticated, isLoaded, loadSettings])

  // Apply theme whenever settings change
  useEffect(() => {
    applyTheme()
  }, [applyTheme])

  // Listen for settings changes from settings page
  useEffect(() => {
    const handleSettingsChanged = () => {
      applyTheme()
    }
    window.addEventListener('bheem-settings-changed', handleSettingsChanged)
    return () => {
      window.removeEventListener('bheem-settings-changed', handleSettingsChanged)
    }
  }, [applyTheme])

  return <Component {...pageProps} />
}
