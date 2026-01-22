import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import {
  Eye,
  EyeOff,
  LogIn,
  UserPlus,
  AlertCircle,
  Check,
  ArrowRight,
  MessageSquare,
  BarChart3,
  Sparkles,
  Zap,
  Lock,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { BheemLogoSegmented, BHEEM_COLORS } from '@/components/shared/BheemLogo';

type AuthMode = 'login' | 'signup';

// Custom Bheem App Icons with brand colors
const BheemAppIcons = {
  Mail: () => (
    <svg viewBox="0 0 48 48" className="w-full h-full">
      <defs>
        <linearGradient id="mailGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF6B6B" />
          <stop offset="100%" stopColor="#EE5A5A" />
        </linearGradient>
      </defs>
      <rect x="4" y="10" width="40" height="28" rx="3" fill="url(#mailGrad)" />
      <path d="M4 13l20 14 20-14" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  ),
  Docs: () => (
    <svg viewBox="0 0 48 48" className="w-full h-full">
      <defs>
        <linearGradient id="docsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={BHEEM_COLORS.blue} />
          <stop offset="100%" stopColor={BHEEM_COLORS.darkBlue} />
        </linearGradient>
      </defs>
      <rect x="8" y="4" width="32" height="40" rx="3" fill="url(#docsGrad)" />
      <rect x="14" y="12" width="20" height="3" rx="1.5" fill="white" />
      <rect x="14" y="19" width="16" height="3" rx="1.5" fill="white" opacity="0.8" />
      <rect x="14" y="26" width="18" height="3" rx="1.5" fill="white" opacity="0.6" />
    </svg>
  ),
  Meet: () => (
    <svg viewBox="0 0 48 48" className="w-full h-full">
      <defs>
        <linearGradient id="meetGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00C853" />
          <stop offset="100%" stopColor="#00A846" />
        </linearGradient>
      </defs>
      <rect x="4" y="8" width="30" height="32" rx="3" fill="url(#meetGrad)" />
      <polygon points="38,14 44,10 44,38 38,34" fill="#00A846" />
      <circle cx="19" cy="24" r="8" fill="white" opacity="0.3" />
    </svg>
  ),
  Calendar: () => (
    <svg viewBox="0 0 48 48" className="w-full h-full">
      <defs>
        <linearGradient id="calGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={BHEEM_COLORS.purple} />
          <stop offset="100%" stopColor={BHEEM_COLORS.darkBlue} />
        </linearGradient>
      </defs>
      <rect x="4" y="8" width="40" height="36" rx="3" fill="url(#calGrad)" />
      <rect x="4" y="8" width="40" height="10" rx="3" fill={BHEEM_COLORS.pink} />
      <circle cx="14" cy="13" r="2" fill={BHEEM_COLORS.purple} />
      <circle cx="34" cy="13" r="2" fill={BHEEM_COLORS.purple} />
      <text x="24" y="34" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">15</text>
    </svg>
  ),
  Drive: () => (
    <svg viewBox="0 0 48 48" className="w-full h-full">
      <polygon points="24,4 44,38 4,38" fill={BHEEM_COLORS.blue} />
      <polygon points="14,38 24,20 44,38" fill={BHEEM_COLORS.purple} />
      <polygon points="4,38 14,22 24,38" fill={BHEEM_COLORS.pink} />
    </svg>
  ),
  Sheets: () => (
    <svg viewBox="0 0 48 48" className="w-full h-full">
      <defs>
        <linearGradient id="sheetsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34A853" />
          <stop offset="100%" stopColor="#2E8B4A" />
        </linearGradient>
      </defs>
      <rect x="6" y="4" width="36" height="40" rx="3" fill="url(#sheetsGrad)" />
      <rect x="12" y="12" width="10" height="6" rx="1" fill="white" />
      <rect x="26" y="12" width="10" height="6" rx="1" fill="white" opacity="0.8" />
      <rect x="12" y="22" width="10" height="6" rx="1" fill="white" opacity="0.8" />
      <rect x="26" y="22" width="10" height="6" rx="1" fill="white" opacity="0.6" />
      <rect x="12" y="32" width="10" height="6" rx="1" fill="white" opacity="0.6" />
      <rect x="26" y="32" width="10" height="6" rx="1" fill="white" opacity="0.4" />
    </svg>
  ),
  Slides: () => (
    <svg viewBox="0 0 48 48" className="w-full h-full">
      <defs>
        <linearGradient id="slidesGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FBBC04" />
          <stop offset="100%" stopColor="#F9A825" />
        </linearGradient>
      </defs>
      <rect x="4" y="8" width="40" height="32" rx="3" fill="url(#slidesGrad)" />
      <rect x="10" y="14" width="28" height="20" rx="2" fill="white" opacity="0.9" />
      <circle cx="24" cy="24" r="6" fill={BHEEM_COLORS.purple} />
    </svg>
  ),
  Forms: () => (
    <svg viewBox="0 0 48 48" className="w-full h-full">
      <defs>
        <linearGradient id="formsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={BHEEM_COLORS.purple} />
          <stop offset="100%" stopColor="#6B5BFF" />
        </linearGradient>
      </defs>
      <rect x="8" y="4" width="32" height="40" rx="3" fill="url(#formsGrad)" />
      <rect x="14" y="12" width="6" height="6" rx="1" fill="white" />
      <rect x="24" y="14" width="12" height="2" rx="1" fill="white" opacity="0.8" />
      <rect x="14" y="22" width="6" height="6" rx="1" fill="white" />
      <rect x="24" y="24" width="12" height="2" rx="1" fill="white" opacity="0.8" />
      <rect x="14" y="32" width="6" height="6" rx="1" fill="white" />
      <rect x="24" y="34" width="12" height="2" rx="1" fill="white" opacity="0.8" />
    </svg>
  ),
  Chat: () => (
    <svg viewBox="0 0 48 48" className="w-full h-full">
      <defs>
        <linearGradient id="chatGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00BCD4" />
          <stop offset="100%" stopColor="#0097A7" />
        </linearGradient>
      </defs>
      <path d="M8,8 h28 a4,4 0 0,1 4,4 v18 a4,4 0 0,1 -4,4 h-20 l-8,8 v-8 a4,4 0 0,1 -4,-4 v-18 a4,4 0 0,1 4,-4 z" fill="url(#chatGrad)" />
      <circle cx="16" cy="21" r="3" fill="white" />
      <circle cx="26" cy="21" r="3" fill="white" />
      <circle cx="36" cy="21" r="3" fill="white" opacity="0.6" />
    </svg>
  ),
  AI: () => (
    <svg viewBox="0 0 48 48" className="w-full h-full">
      <defs>
        <linearGradient id="aiGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={BHEEM_COLORS.pink} />
          <stop offset="50%" stopColor={BHEEM_COLORS.purple} />
          <stop offset="100%" stopColor={BHEEM_COLORS.blue} />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="20" fill="url(#aiGrad)" />
      <path d="M16,20 Q24,10 32,20 Q36,28 24,36 Q12,28 16,20" fill="white" opacity="0.9" />
      <circle cx="20" cy="22" r="2" fill={BHEEM_COLORS.deepBlue} />
      <circle cx="28" cy="22" r="2" fill={BHEEM_COLORS.deepBlue} />
      <path d="M20,28 Q24,32 28,28" stroke={BHEEM_COLORS.deepBlue} strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  ),
};

// Floating app icons for background animation
const floatingApps = [
  { Icon: BheemAppIcons.Mail, size: 40, x: 8, y: 12, duration: 20, delay: 0 },
  { Icon: BheemAppIcons.Meet, size: 48, x: 92, y: 8, duration: 25, delay: 1 },
  { Icon: BheemAppIcons.Docs, size: 36, x: 15, y: 85, duration: 22, delay: 2 },
  { Icon: BheemAppIcons.Calendar, size: 44, x: 88, y: 78, duration: 28, delay: 0.5 },
  { Icon: BheemAppIcons.Drive, size: 32, x: 5, y: 45, duration: 24, delay: 3 },
  { Icon: BheemAppIcons.Sheets, size: 38, x: 95, y: 42, duration: 26, delay: 1.5 },
  { Icon: BheemAppIcons.Slides, size: 42, x: 12, y: 65, duration: 21, delay: 2.5 },
  { Icon: BheemAppIcons.Forms, size: 34, x: 85, y: 25, duration: 23, delay: 4 },
  { Icon: BheemAppIcons.Chat, size: 30, x: 50, y: 5, duration: 19, delay: 0 },
  { Icon: BheemAppIcons.AI, size: 46, x: 48, y: 92, duration: 27, delay: 2 },
  { Icon: BheemAppIcons.Mail, size: 28, x: 25, y: 30, duration: 18, delay: 3.5 },
  { Icon: BheemAppIcons.Meet, size: 36, x: 72, y: 55, duration: 24, delay: 1 },
  { Icon: BheemAppIcons.Docs, size: 40, x: 35, y: 70, duration: 22, delay: 4.5 },
  { Icon: BheemAppIcons.Calendar, size: 26, x: 62, y: 18, duration: 20, delay: 2 },
  { Icon: BheemAppIcons.Drive, size: 32, x: 78, y: 88, duration: 25, delay: 0.5 },
  { Icon: BheemAppIcons.Sheets, size: 38, x: 20, y: 50, duration: 23, delay: 3 },
];

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, setAuth, user } = useAuthStore();
  const [mode, setMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Login form
  const [loginData, setLoginData] = useState({
    username: '',
    password: '',
  });

  // Signup form
  const [signupData, setSignupData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    workspaceName: '',
  });

  const redirectTo = router.query.redirect as string;
  const selectedPlan = router.query.plan as string;
  const urlMode = router.query.mode as string;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (selectedPlan || urlMode === 'signup') {
      setMode('signup');
    }
  }, [selectedPlan, urlMode]);

  useEffect(() => {
    // Double-check token exists in localStorage before redirecting
    // This prevents redirect when store state is stale after logout
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

    if (!isLoading && isAuthenticated && !isLoggingIn && token) {
      // Determine default redirect based on role hierarchy:
      // 1. SuperAdmin (platform admin) -> /super-admin
      // 2. workspace_role admin (external tenant admin) -> /admin
      // 3. Default -> /dashboard
      let defaultRedirect = '/dashboard';
      if (user?.role === 'SuperAdmin') {
        defaultRedirect = '/super-admin';
      } else if (user?.workspace_role === 'admin') {
        // External customer who is admin of their workspace
        defaultRedirect = '/admin';
      }
      router.push(redirectTo || defaultRedirect);
    }
  }, [isAuthenticated, isLoading, router, redirectTo, isLoggingIn, user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setIsLoggingIn(true);

    try {
      const response = await api.post('/auth/login', {
        username: loginData.username,
        password: loginData.password,
      });

      const { access_token, user } = response.data;

      // Set auth first (this also fetches workspace info)
      await setAuth(access_token, user);

      // Determine redirect based on role hierarchy:
      // 1. SuperAdmin (platform admin) -> /super-admin
      // 2. Check workspace role for external customers -> /admin if workspace admin
      // 3. Default -> /dashboard
      let targetUrl = '/dashboard';
      if (user.role === 'SuperAdmin') {
        targetUrl = '/super-admin';
      } else {
        // For external customers, check their workspace role
        // setAuth fetches workspace info, but we need to check it separately for redirect
        try {
          const workspaceRes = await api.get('/user-workspace/me');
          const workspace = workspaceRes.data;
          if (workspace?.role === 'admin' || workspace?.user?.workspace_role === 'admin') {
            targetUrl = '/admin';
          }
        } catch (err) {
          // No workspace - use default dashboard
          console.log('No workspace found, using default redirect');
        }
      }

      const finalRedirect = redirectTo || targetUrl;
      router.push(finalRedirect);
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.response?.status === 401) {
        setError('Invalid email or password');
      } else if (err.response?.status === 403) {
        setError('Account is inactive or banned');
      } else if (err.response?.data?.detail) {
        const detail = err.response.data.detail;
        setError(typeof detail === 'string' ? detail : 'Login failed');
      } else {
        setError('Unable to connect to authentication service');
      }
      setIsLoggingIn(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (signupData.password !== signupData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (signupData.password.length < 8) {
      setError('Password must be at least 8 characters');
      setLoading(false);
      return;
    }

    try {
      await api.post('/auth/register', {
        username: signupData.email,
        email: signupData.email,
        password: signupData.password,
        full_name: signupData.fullName,
        role: 'Customer',
        company_code: 'BHM001',
      });

      const loginResponse = await api.post('/auth/login', {
        username: signupData.email,
        password: signupData.password,
      });

      const { access_token, user } = loginResponse.data;

      const workspaceSlug = signupData.workspaceName
        ?.toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') ||
        signupData.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-');

      try {
        await api.post('/tenants', {
          name: signupData.workspaceName || `${signupData.fullName}'s Workspace`,
          slug: workspaceSlug,
          owner_email: signupData.email,
          owner_name: signupData.fullName,
          plan: 'starter',
        }, {
          headers: { Authorization: `Bearer ${access_token}` }
        });
      } catch (tenantErr: any) {
        console.log('Tenant note:', tenantErr.response?.data?.detail || 'proceeding');
      }

      await setAuth(access_token, user);
      setSuccess('Account created successfully! Redirecting to setup...');

      setTimeout(() => {
        router.push('/onboarding');
      }, 1000);

    } catch (err: any) {
      console.error('Signup error:', err);
      if (err.response?.status === 422) {
        const detail = err.response?.data?.detail;
        if (Array.isArray(detail)) {
          const messages = detail.map((d: any) => d.msg || d.message).join(', ');
          setError(`Validation error: ${messages}`);
        } else {
          setError('Please check all fields are filled correctly.');
        }
      } else if (err.response?.status === 400 && err.response?.data?.detail?.includes('already')) {
        setError('An account with this email already exists. Please sign in instead.');
      } else if (err.response?.data?.detail) {
        const detail = err.response.data.detail;
        setError(typeof detail === 'string' ? detail : 'Registration failed');
      } else {
        setError('Unable to create account. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: BHEEM_COLORS.deepBlue }}>
        <div className="relative">
          <div className="w-20 h-20 border-4 rounded-full animate-spin" style={{ borderColor: `${BHEEM_COLORS.purple}30`, borderTopColor: BHEEM_COLORS.purple }}></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <BheemLogoSegmented size={48} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{mode === 'login' ? 'Sign In' : 'Sign Up'} - Bheem Workspace</title>
        <meta name="description" content="Sign in to Bheem Workspace - Your complete productivity suite" />
      </Head>

      <div className="min-h-screen flex relative overflow-hidden" style={{ backgroundColor: BHEEM_COLORS.deepBlue }}>
        {/* Floating Background App Icons */}
        {mounted && floatingApps.map((item, index) => {
          const { Icon } = item;
          return (
            <div
              key={index}
              className="absolute pointer-events-none z-0 animate-float-icon"
              style={{
                left: `${item.x}%`,
                top: `${item.y}%`,
                width: item.size,
                height: item.size,
                animationDuration: `${item.duration}s`,
                animationDelay: `${item.delay}s`,
              }}
            >
              <div className="relative animate-pulse-slow opacity-50 hover:opacity-80 transition-opacity" style={{ animationDelay: `${item.delay * 0.5}s` }}>
                <Icon />
              </div>
            </div>
          );
        })}

        {/* Gradient Overlays */}
        <div className="absolute inset-0 z-0" style={{ background: `linear-gradient(135deg, ${BHEEM_COLORS.darkBlue}20 0%, transparent 50%, ${BHEEM_COLORS.purple}20 100%)` }} />
        <div className="absolute top-0 left-0 w-1/2 h-full z-[1]" style={{ background: `linear-gradient(90deg, ${BHEEM_COLORS.deepBlue} 0%, ${BHEEM_COLORS.deepBlue}80 50%, transparent 100%)` }} />

        {/* Animated Background Blobs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-20 blur-3xl animate-blob" style={{ backgroundColor: BHEEM_COLORS.purple }} />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-15 blur-3xl animate-blob animation-delay-2000" style={{ backgroundColor: BHEEM_COLORS.pink }} />
        <div className="absolute top-1/2 right-1/3 w-72 h-72 rounded-full opacity-10 blur-3xl animate-blob animation-delay-4000" style={{ backgroundColor: BHEEM_COLORS.blue }} />

        {/* Left Side - Branding & Info */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-16 xl:px-24 relative z-10">
          {/* Logo */}
          <div className="mb-12">
            <div className="flex items-center gap-4 mb-8">
              <div className="relative">
                <div className="absolute -inset-2 rounded-2xl blur-lg opacity-50" style={{ background: `linear-gradient(135deg, ${BHEEM_COLORS.pink}, ${BHEEM_COLORS.purple}, ${BHEEM_COLORS.blue})` }} />
                <BheemLogoSegmented size={64} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Bheem</h1>
                <p style={{ color: BHEEM_COLORS.lavender }}>Workspace</p>
              </div>
            </div>
          </div>

          {/* Main Headline */}
          <div className="mb-12">
            <h2 className="text-5xl xl:text-6xl font-bold text-white leading-tight mb-6">
              Everything you need.
              <br />
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(90deg, ${BHEEM_COLORS.pink}, ${BHEEM_COLORS.purple}, ${BHEEM_COLORS.blue})` }}>
                One workspace.
              </span>
            </h2>
            <p className="text-xl max-w-lg" style={{ color: BHEEM_COLORS.lavender }}>
              Collaborate, communicate, and create with your team using our integrated suite of productivity tools.
            </p>
          </div>

          {/* AI Features - Compact Horizontal */}
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-3 group cursor-pointer">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform" style={{ background: `linear-gradient(135deg, ${BHEEM_COLORS.purple}, ${BHEEM_COLORS.pink})`, boxShadow: `0 8px 20px ${BHEEM_COLORS.purple}40` }}>
                <Sparkles size={22} className="text-white" />
              </div>
              <span className="text-white font-medium">AI Writer</span>
            </div>

            <div className="flex items-center gap-3 group cursor-pointer">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform" style={{ background: `linear-gradient(135deg, ${BHEEM_COLORS.blue}, ${BHEEM_COLORS.darkBlue})`, boxShadow: `0 8px 20px ${BHEEM_COLORS.blue}40` }}>
                <MessageSquare size={22} className="text-white" />
              </div>
              <span className="text-white font-medium">Summarize</span>
            </div>

            <div className="flex items-center gap-3 group cursor-pointer">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform" style={{ background: 'linear-gradient(135deg, #00C853, #00A846)', boxShadow: '0 8px 20px rgba(0, 200, 83, 0.4)' }}>
                <Zap size={22} className="text-white" />
              </div>
              <span className="text-white font-medium">Automate</span>
            </div>

            <div className="flex items-center gap-3 group cursor-pointer">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform" style={{ background: `linear-gradient(135deg, ${BHEEM_COLORS.pink}, ${BHEEM_COLORS.purple})`, boxShadow: `0 8px 20px ${BHEEM_COLORS.pink}40` }}>
                <BarChart3 size={22} className="text-white" />
              </div>
              <span className="text-white font-medium">Analytics</span>
            </div>
          </div>

          {/* App Icons Grid */}
          <div className="mt-12">
            <p className="text-sm uppercase tracking-wider mb-4" style={{ color: BHEEM_COLORS.purple }}>All your tools in one place</p>
            <div className="flex gap-3 flex-wrap">
              {[
                { Icon: BheemAppIcons.Mail, name: 'Mail' },
                { Icon: BheemAppIcons.Docs, name: 'Docs' },
                { Icon: BheemAppIcons.Meet, name: 'Meet' },
                { Icon: BheemAppIcons.Calendar, name: 'Calendar' },
                { Icon: BheemAppIcons.Drive, name: 'Drive' },
                { Icon: BheemAppIcons.Sheets, name: 'Sheets' },
                { Icon: BheemAppIcons.Slides, name: 'Slides' },
                { Icon: BheemAppIcons.Forms, name: 'Forms' },
                { Icon: BheemAppIcons.Chat, name: 'Chat' },
                { Icon: BheemAppIcons.AI, name: 'AI' },
              ].map((app, i) => (
                <div key={i} className="group relative">
                  <div className="w-10 h-10 rounded-lg overflow-hidden transform group-hover:scale-110 transition-transform cursor-pointer">
                    <app.Icon />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12 relative z-10">
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="lg:hidden text-center mb-8">
              <div className="inline-flex items-center gap-3 mb-4">
                <BheemLogoSegmented size={48} />
                <span className="text-2xl font-bold text-white">Bheem Workspace</span>
              </div>
            </div>

            {/* Card */}
            <div className="relative">
              <div className="absolute -inset-1 rounded-3xl blur-xl" style={{ background: `linear-gradient(135deg, ${BHEEM_COLORS.pink}30, ${BHEEM_COLORS.purple}30, ${BHEEM_COLORS.blue}30)` }} />

              <div className="relative backdrop-blur-2xl rounded-3xl border p-8 shadow-2xl" style={{ backgroundColor: `${BHEEM_COLORS.darkBlue}60`, borderColor: `${BHEEM_COLORS.purple}30` }}>
                {/* Mode Toggle */}
                <div className="flex rounded-2xl p-1.5 mb-8" style={{ backgroundColor: `${BHEEM_COLORS.purple}15` }}>
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setError(''); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-300 ${
                      mode === 'login'
                        ? 'text-white shadow-lg'
                        : 'text-gray-400 hover:text-white'
                    }`}
                    style={mode === 'login' ? { background: `linear-gradient(90deg, ${BHEEM_COLORS.blue}, ${BHEEM_COLORS.purple})` } : {}}
                  >
                    <LogIn size={18} />
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMode('signup'); setError(''); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-300 ${
                      mode === 'signup'
                        ? 'text-white shadow-lg'
                        : 'text-gray-400 hover:text-white'
                    }`}
                    style={mode === 'signup' ? { background: `linear-gradient(90deg, ${BHEEM_COLORS.purple}, ${BHEEM_COLORS.pink})` } : {}}
                  >
                    <UserPlus size={18} />
                    Sign Up
                  </button>
                </div>

                {/* Header */}
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-white mb-2">
                    {mode === 'login' ? 'Welcome back' : 'Create your workspace'}
                  </h3>
                  <p style={{ color: BHEEM_COLORS.lavender }}>
                    {mode === 'login'
                      ? 'Enter your credentials to access your workspace'
                      : 'Start your 14-day free trial today'}
                  </p>
                </div>

                {selectedPlan && mode === 'signup' && (
                  <div className="mb-6 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium" style={{ backgroundColor: '#00C85315', color: '#00C853', border: '1px solid #00C85330' }}>
                    <Check size={18} />
                    {selectedPlan.replace('WORKSPACE-', '')} plan selected
                  </div>
                )}

                {/* Messages */}
                {error && (
                  <div className="flex items-center gap-3 p-4 mb-6 rounded-xl" style={{ backgroundColor: '#EF444415', border: '1px solid #EF444430', color: '#EF4444' }}>
                    <AlertCircle size={20} className="flex-shrink-0" />
                    <span className="text-sm">{error}</span>
                  </div>
                )}
                {success && (
                  <div className="flex items-center gap-3 p-4 mb-6 rounded-xl" style={{ backgroundColor: '#00C85315', border: '1px solid #00C85330', color: '#00C853' }}>
                    <Check size={20} className="flex-shrink-0" />
                    <span className="text-sm">{success}</span>
                  </div>
                )}

                {/* Forms */}
                {mode === 'login' ? (
                  <form className="space-y-5" onSubmit={handleLogin}>
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: BHEEM_COLORS.lavender }}>Email address</label>
                      <div className="relative">
                        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 opacity-60" viewBox="0 0 48 48">
                          <rect x="4" y="10" width="40" height="28" rx="3" fill={BHEEM_COLORS.purple} />
                          <path d="M4 13l20 14 20-14" stroke="white" strokeWidth="2.5" fill="none" />
                        </svg>
                        <input
                          type="email"
                          required
                          value={loginData.username}
                          onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                          className="w-full pl-12 pr-4 py-3.5 rounded-xl text-white placeholder-gray-500 focus:outline-none transition-all"
                          style={{ backgroundColor: `${BHEEM_COLORS.purple}15`, border: `1px solid ${BHEEM_COLORS.purple}30` }}
                          onFocus={(e) => e.target.style.boxShadow = `0 0 0 2px ${BHEEM_COLORS.purple}50`}
                          onBlur={(e) => e.target.style.boxShadow = 'none'}
                          placeholder="you@example.com"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: BHEEM_COLORS.lavender }}>Password</label>
                      <div className="relative">
                        <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-60" style={{ color: BHEEM_COLORS.purple }} />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={loginData.password}
                          onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                          className="w-full pl-12 pr-12 py-3.5 rounded-xl text-white placeholder-gray-500 focus:outline-none transition-all"
                          style={{ backgroundColor: `${BHEEM_COLORS.purple}15`, border: `1px solid ${BHEEM_COLORS.purple}30` }}
                          onFocus={(e) => e.target.style.boxShadow = `0 0 0 2px ${BHEEM_COLORS.purple}50`}
                          onBlur={(e) => e.target.style.boxShadow = 'none'}
                          placeholder="Enter your password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-white transition-colors"
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 rounded" style={{ accentColor: BHEEM_COLORS.purple }} />
                        <span className="text-sm" style={{ color: BHEEM_COLORS.lavender }}>Remember me</span>
                      </label>
                      <a href="#" className="text-sm transition-colors hover:opacity-80" style={{ color: BHEEM_COLORS.pink }}>
                        Forgot password?
                      </a>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full relative group py-4 rounded-xl font-semibold text-white transition-all duration-300 disabled:opacity-50 overflow-hidden"
                    >
                      <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, ${BHEEM_COLORS.blue}, ${BHEEM_COLORS.purple}, ${BHEEM_COLORS.pink})` }} />
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: `linear-gradient(90deg, ${BHEEM_COLORS.darkBlue}, ${BHEEM_COLORS.blue}, ${BHEEM_COLORS.purple})` }} />
                      <span className="relative flex items-center justify-center gap-2">
                        {loading ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white/30 rounded-full animate-spin border-t-white" />
                            Signing in...
                          </>
                        ) : (
                          <>
                            Sign in
                            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                          </>
                        )}
                      </span>
                    </button>
                  </form>
                ) : (
                  <form className="space-y-4" onSubmit={handleSignup}>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: BHEEM_COLORS.lavender }}>Full Name</label>
                        <input
                          type="text"
                          required
                          value={signupData.fullName}
                          onChange={(e) => setSignupData({ ...signupData, fullName: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 focus:outline-none transition-all"
                          style={{ backgroundColor: `${BHEEM_COLORS.purple}15`, border: `1px solid ${BHEEM_COLORS.purple}30` }}
                          onFocus={(e) => e.target.style.boxShadow = `0 0 0 2px ${BHEEM_COLORS.purple}50`}
                          onBlur={(e) => e.target.style.boxShadow = 'none'}
                          placeholder="John Doe"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: BHEEM_COLORS.lavender }}>Workspace</label>
                        <input
                          type="text"
                          required
                          value={signupData.workspaceName}
                          onChange={(e) => setSignupData({ ...signupData, workspaceName: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 focus:outline-none transition-all"
                          style={{ backgroundColor: `${BHEEM_COLORS.purple}15`, border: `1px solid ${BHEEM_COLORS.purple}30` }}
                          onFocus={(e) => e.target.style.boxShadow = `0 0 0 2px ${BHEEM_COLORS.purple}50`}
                          onBlur={(e) => e.target.style.boxShadow = 'none'}
                          placeholder="My Company"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: BHEEM_COLORS.lavender }}>Work Email</label>
                      <div className="relative">
                        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 opacity-60" viewBox="0 0 48 48">
                          <rect x="4" y="10" width="40" height="28" rx="3" fill={BHEEM_COLORS.purple} />
                          <path d="M4 13l20 14 20-14" stroke="white" strokeWidth="2.5" fill="none" />
                        </svg>
                        <input
                          type="email"
                          required
                          value={signupData.email}
                          onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                          className="w-full pl-12 pr-4 py-3 rounded-xl text-white placeholder-gray-500 focus:outline-none transition-all"
                          style={{ backgroundColor: `${BHEEM_COLORS.purple}15`, border: `1px solid ${BHEEM_COLORS.purple}30` }}
                          onFocus={(e) => e.target.style.boxShadow = `0 0 0 2px ${BHEEM_COLORS.purple}50`}
                          onBlur={(e) => e.target.style.boxShadow = 'none'}
                          placeholder="you@company.com"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: BHEEM_COLORS.lavender }}>Password</label>
                      <div className="relative">
                        <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-60" style={{ color: BHEEM_COLORS.purple }} />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={signupData.password}
                          onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                          className="w-full pl-12 pr-12 py-3 rounded-xl text-white placeholder-gray-500 focus:outline-none transition-all"
                          style={{ backgroundColor: `${BHEEM_COLORS.purple}15`, border: `1px solid ${BHEEM_COLORS.purple}30` }}
                          onFocus={(e) => e.target.style.boxShadow = `0 0 0 2px ${BHEEM_COLORS.purple}50`}
                          onBlur={(e) => e.target.style.boxShadow = 'none'}
                          placeholder="Min 8 characters"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-white transition-colors"
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: BHEEM_COLORS.lavender }}>Confirm Password</label>
                      <div className="relative">
                        <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-60" style={{ color: BHEEM_COLORS.purple }} />
                        <input
                          type="password"
                          required
                          value={signupData.confirmPassword}
                          onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                          className="w-full pl-12 pr-4 py-3 rounded-xl text-white placeholder-gray-500 focus:outline-none transition-all"
                          style={{ backgroundColor: `${BHEEM_COLORS.purple}15`, border: `1px solid ${BHEEM_COLORS.purple}30` }}
                          onFocus={(e) => e.target.style.boxShadow = `0 0 0 2px ${BHEEM_COLORS.purple}50`}
                          onBlur={(e) => e.target.style.boxShadow = 'none'}
                          placeholder="Confirm your password"
                        />
                      </div>
                    </div>

                    <p className="text-xs" style={{ color: `${BHEEM_COLORS.lavender}80` }}>
                      By signing up, you agree to our{' '}
                      <a href="#" style={{ color: BHEEM_COLORS.pink }} className="hover:opacity-80">Terms</a>
                      {' '}and{' '}
                      <a href="#" style={{ color: BHEEM_COLORS.pink }} className="hover:opacity-80">Privacy Policy</a>.
                    </p>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full relative group py-4 rounded-xl font-semibold text-white transition-all duration-300 disabled:opacity-50 overflow-hidden"
                    >
                      <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, ${BHEEM_COLORS.purple}, ${BHEEM_COLORS.pink}, #FF6B6B)` }} />
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: `linear-gradient(90deg, ${BHEEM_COLORS.blue}, ${BHEEM_COLORS.purple}, ${BHEEM_COLORS.pink})` }} />
                      <span className="relative flex items-center justify-center gap-2">
                        {loading ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white/30 rounded-full animate-spin border-t-white" />
                            Creating workspace...
                          </>
                        ) : (
                          <>
                            Get started free
                            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                          </>
                        )}
                      </span>
                    </button>
                  </form>
                )}

                {/* Divider */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t" style={{ borderColor: `${BHEEM_COLORS.purple}30` }} />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-4 text-sm" style={{ backgroundColor: BHEEM_COLORS.darkBlue, color: BHEEM_COLORS.lavender }}>or continue with</span>
                  </div>
                </div>

                {/* Social Login */}
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-white transition-all duration-300"
                    style={{ backgroundColor: `${BHEEM_COLORS.purple}15`, border: `1px solid ${BHEEM_COLORS.purple}30` }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${BHEEM_COLORS.purple}30`}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = `${BHEEM_COLORS.purple}15`}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#EA4335" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC04" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#4285F4" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Google
                  </button>
                  <button
                    type="button"
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-white transition-all duration-300"
                    style={{ backgroundColor: `${BHEEM_COLORS.purple}15`, border: `1px solid ${BHEEM_COLORS.purple}30` }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${BHEEM_COLORS.purple}30`}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = `${BHEEM_COLORS.purple}15`}
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                    GitHub
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <p className="text-center text-sm mt-8" style={{ color: BHEEM_COLORS.lavender }}>
              <Link href="/" className="inline-flex items-center gap-1 transition-colors hover:opacity-80" style={{ color: BHEEM_COLORS.pink }}>
                <ArrowRight size={14} className="rotate-180" />
                Back to home
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Animation Styles */}
      <style jsx global>{`
        @keyframes float-icon {
          0%, 100% {
            transform: translate(0, 0) rotate(0deg);
          }
          25% {
            transform: translate(15px, -25px) rotate(5deg);
          }
          50% {
            transform: translate(-10px, -50px) rotate(-3deg);
          }
          75% {
            transform: translate(20px, -25px) rotate(3deg);
          }
        }

        @keyframes pulse-slow {
          0%, 100% {
            opacity: 0.4;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.05);
          }
        }

        @keyframes blob {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          25% {
            transform: translate(20px, -30px) scale(1.1);
          }
          50% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          75% {
            transform: translate(30px, 10px) scale(1.05);
          }
        }

        .animate-float-icon {
          animation: float-icon ease-in-out infinite;
        }

        .animate-pulse-slow {
          animation: pulse-slow 4s ease-in-out infinite;
        }

        .animate-blob {
          animation: blob 15s ease-in-out infinite;
        }

        .animation-delay-2000 {
          animation-delay: 2s;
        }

        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </>
  );
}
