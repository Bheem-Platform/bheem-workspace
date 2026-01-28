import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { motion } from 'framer-motion';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
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
  const [redirectTarget, setRedirectTarget] = useState('/dashboard');

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
        let extractedName = '';
        try {
          const payload = JSON.parse(atob(accessToken.split('.')[1]));
          extractedName = payload.name || payload.full_name || payload.username?.split('@')[0] || '';
          setUserName(extractedName);
        } catch {
          setUserName('');
        }

        // Check if user has a workspace
        try {
          const response = await api.get('/user-workspace/check');
          const { has_workspace, needs_onboarding, workspace } = response.data;

          if (needs_onboarding || !has_workspace) {
            // User needs to create a workspace - redirect to onboarding
            console.log('[OAuth] User needs onboarding - no workspace found');
            setRedirectTarget('/onboarding');
          } else if (workspace) {
            // User has a workspace - determine redirect based on role
            console.log('[OAuth] User has workspace:', workspace.name, 'Role:', workspace.role);

            if (workspace.role === 'admin' || workspace.role === 'owner') {
              // Check if onboarding is completed
              setRedirectTarget('/dashboard');
            } else {
              setRedirectTarget('/dashboard');
            }
          }
        } catch (checkError: any) {
          console.warn('[OAuth] Could not check workspace:', checkError);
          // If we can't check, assume user needs onboarding (safe default)
          // But if it's a 401/403, the token might be invalid
          if (checkError.response?.status === 401 || checkError.response?.status === 403) {
            // Token might be invalid for this service, still try dashboard
            setRedirectTarget('/dashboard');
          } else {
            // Network error or service unavailable, try onboarding
            setRedirectTarget('/onboarding');
          }
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
    // Use the determined redirect target
    console.log('[OAuth] Redirecting to:', redirectTarget);
    router.push(redirectTarget);
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
