import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { WifiOff, RefreshCw, Home, Mail, Calendar, FileText, Video } from 'lucide-react';

export default function OfflinePage() {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    // Check initial online status
    setIsOnline(navigator.onLine);

    // Listen for online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-redirect when back online
      setTimeout(() => {
        router.back();
      }, 1000);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [router]);

  const handleRetry = async () => {
    setChecking(true);
    try {
      // Try to fetch a small resource to check connectivity
      await fetch('/api/health', { method: 'HEAD', cache: 'no-store' });
      setIsOnline(true);
      router.back();
    } catch {
      setIsOnline(false);
    } finally {
      setChecking(false);
    }
  };

  const quickLinks = [
    { name: 'Dashboard', href: '/dashboard', icon: Home, description: 'View your dashboard' },
    { name: 'Mail', href: '/mail', icon: Mail, description: 'Check cached emails' },
    { name: 'Calendar', href: '/calendar', icon: Calendar, description: 'View calendar events' },
    { name: 'Documents', href: '/docs', icon: FileText, description: 'Access saved docs' },
    { name: 'Meet', href: '/meet', icon: Video, description: 'View meeting history' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-20 w-20 bg-gradient-to-br from-gray-400 to-gray-600 rounded-2xl flex items-center justify-center mb-6">
            <WifiOff size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            You're Offline
          </h1>
          <p className="mt-3 text-gray-600">
            It looks like you've lost your internet connection.
            Don't worry, some features may still be available from cache.
          </p>
        </div>

        {/* Status indicator */}
        <div className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg ${
          isOnline
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-amber-50 text-amber-700 border border-amber-200'
        }`}>
          <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-amber-500'} animate-pulse`} />
          <span className="text-sm font-medium">
            {isOnline ? 'Connection restored! Redirecting...' : 'No internet connection'}
          </span>
        </div>

        {/* Retry button */}
        <div className="flex justify-center">
          <button
            onClick={handleRetry}
            disabled={checking}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            <RefreshCw size={20} className={checking ? 'animate-spin' : ''} />
            {checking ? 'Checking connection...' : 'Try Again'}
          </button>
        </div>

        {/* Quick links */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Available Offline
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            These pages may have cached content you can access:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {quickLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="flex flex-col items-center p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
              >
                <link.icon size={24} className="text-gray-400 group-hover:text-blue-600 mb-2" />
                <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">
                  {link.name}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Tips */}
        <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
          <h3 className="font-semibold text-blue-900 mb-2">Tips while offline:</h3>
          <ul className="text-sm text-blue-800 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              Previously viewed pages may be available from cache
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              Draft emails will be saved and sent when you're back online
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              Document changes will sync automatically once connected
            </li>
          </ul>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500">
          <Link href="/" className="text-blue-600 hover:underline">
            Bheem Workspace
          </Link>
          {' • '}
          <span>Offline Mode</span>
        </p>
      </div>
    </div>
  );
}

// This page should work offline, so we export it as static
export const config = {
  unstable_runtimeJS: true,
};
