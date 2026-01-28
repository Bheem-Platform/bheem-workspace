import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { motion } from 'framer-motion';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import LoginLoader from '@/components/shared/LoginLoader';

const BRAND = {
  pink: '#FFCCF2',
  purple: '#977DFF',
  blue: '#0033FF',
  gradient: 'from-[#FFCCF2] via-[#977DFF] to-[#0033FF]',
};

export default function OAuthCallbackPage() {
  const router = useRouter();
  const { loginWithOAuth, user } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [showLoader, setShowLoader] = useState(false);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      // Get tokens from URL params
      const params = new URLSearchParams(window.location.search);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const errorParam = params.get('error');
      const errorDescription = params.get('error_description');

      // Handle OAuth errors
      if (errorParam) {
        setError(errorDescription || `Authentication failed: ${errorParam}`);
        return;
      }

      // Validate access token presence
      if (!accessToken) {
        setError('No access token received. Please try again.');
        return;
      }

      try {
        // Store tokens and authenticate
        await loginWithOAuth(accessToken, refreshToken || undefined);

        // Extract user name from token for loader
        try {
          const payload = JSON.parse(atob(accessToken.split('.')[1]));
          setUserName(payload.name || payload.full_name || payload.username?.split('@')[0] || '');
        } catch {
          setUserName('');
        }

        // Show branded loader before redirecting
        setShowLoader(true);
      } catch (err: any) {
        console.error('OAuth callback error:', err);
        setError(err.message || 'Failed to complete authentication. Please try again.');
      }
    };

    // Only run on client side after router is ready
    if (typeof window !== 'undefined') {
      handleCallback();
    }
  }, [loginWithOAuth]);

  const handleLoaderComplete = () => {
    // Determine redirect based on user role
    let targetUrl = '/dashboard';
    if (user?.role === 'SuperAdmin') {
      targetUrl = '/super-admin';
    } else if (user?.workspace_role === 'admin') {
      targetUrl = '/admin';
    }
    router.push(targetUrl);
  };

  const handleRetry = () => {
    router.push('/login');
  };

  // Show error state
  if (error) {
    return (
      <>
        <Head>
          <title>Authentication Error - Bheem Workspace</title>
        </Head>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center"
          >
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle size={32} className="text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">Authentication Failed</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <motion.button
              onClick={handleRetry}
              className={`w-full py-3 px-4 rounded-xl font-semibold text-white bg-gradient-to-r ${BRAND.gradient} flex items-center justify-center gap-2`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <RefreshCw size={18} />
              Try Again
            </motion.button>
          </motion.div>
        </div>
      </>
    );
  }

  // Show branded loader on success
  if (showLoader) {
    return (
      <>
        <Head>
          <title>Signing In - Bheem Workspace</title>
        </Head>
        <LoginLoader userName={userName} onComplete={handleLoaderComplete} />
      </>
    );
  }

  // Show loading spinner while processing
  return (
    <>
      <Head>
        <title>Authenticating - Bheem Workspace</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <motion.div
            className="relative mx-auto mb-6"
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <div
              className={`w-16 h-16 rounded-full border-4 border-transparent bg-gradient-to-r ${BRAND.gradient}`}
              style={{ padding: '3px' }}
            >
              <div className="w-full h-full rounded-full bg-white" />
            </div>
          </motion.div>
          <p className="text-gray-600">Completing authentication...</p>
        </div>
      </div>
    </>
  );
}
