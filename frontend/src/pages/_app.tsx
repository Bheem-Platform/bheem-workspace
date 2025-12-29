import { useEffect } from 'react'
import type { AppProps } from 'next/app'
import '@/styles/globals.css'
import { useAuthStore } from '@/stores/authStore'

export default function App({ Component, pageProps }: AppProps) {
  const initialize = useAuthStore((state) => state.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  return <Component {...pageProps} />
}
