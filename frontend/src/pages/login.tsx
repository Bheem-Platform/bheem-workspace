import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye,
  EyeOff,
  LogIn,
  UserPlus,
  AlertCircle,
  Check,
  ArrowRight,
  Mail,
  Lock,
  User,
  Building2,
  Sparkles,
  Shield,
  Zap,
  Globe,
  Users,
  FileText,
  Video,
  Calendar,
  HardDrive,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import LoginLoader from '@/components/shared/LoginLoader';

type AuthMode = 'login' | 'signup';

// Brand Colors
const BRAND = {
  pink: '#FFCCF2',
  purple: '#977DFF',
  blue: '#0033FF',
  gradient: 'from-[#FFCCF2] via-[#977DFF] to-[#0033FF]',
};

// 3D Floating Element Component
function FloatingElement({
  children,
  delay = 0,
  duration = 4,
  x = 0,
  y = 0,
}: {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  x?: number;
  y?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0, y: 20 }}
      animate={{
        opacity: 1,
        scale: 1,
        y: [0, y - 10, 0],
        x: [0, x, 0],
        rotateY: [0, 10, -10, 0],
      }}
      transition={{
        opacity: { duration: 0.5, delay },
        scale: { duration: 0.5, delay },
        y: { duration, repeat: Infinity, delay },
        x: { duration: duration * 1.2, repeat: Infinity, delay },
        rotateY: { duration: duration * 1.5, repeat: Infinity, delay },
      }}
      style={{ transformStyle: 'preserve-3d' }}
    >
      {children}
    </motion.div>
  );
}

// Animated Background Component
function AnimatedBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-white to-gray-100" />

      {/* Large Gradient Blobs */}
      <motion.div
        className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-[#FFCCF2]/30 to-transparent blur-3xl"
        animate={{
          scale: [1, 1.2, 1],
          x: [0, 50, 0],
          y: [0, 30, 0],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-[#977DFF]/25 to-transparent blur-3xl"
        animate={{
          scale: [1, 1.1, 1],
          x: [0, -30, 0],
          y: [0, -50, 0],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-gradient-to-r from-[#0033FF]/15 to-transparent blur-3xl"
        animate={{
          scale: [1, 1.3, 1],
          rotate: [0, 180, 360],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      />

      {/* Floating Geometric Shapes */}
      {[
        { size: 80, x: '10%', y: '20%', delay: 0, color: BRAND.pink },
        { size: 60, x: '85%', y: '15%', delay: 0.5, color: BRAND.purple },
        { size: 50, x: '15%', y: '75%', delay: 1, color: BRAND.blue },
        { size: 70, x: '80%', y: '70%', delay: 1.5, color: BRAND.pink },
        { size: 40, x: '50%', y: '10%', delay: 2, color: BRAND.purple },
        { size: 55, x: '90%', y: '45%', delay: 2.5, color: BRAND.blue },
      ].map((shape, i) => (
        <motion.div
          key={i}
          className="absolute rounded-2xl"
          style={{
            width: shape.size,
            height: shape.size,
            left: shape.x,
            top: shape.y,
            background: `linear-gradient(135deg, ${shape.color}40, ${shape.color}10)`,
            border: `1px solid ${shape.color}30`,
            backdropFilter: 'blur(10px)',
          }}
          animate={{
            y: [0, -20, 0],
            rotate: [0, 45, 0],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{
            duration: 5 + i,
            repeat: Infinity,
            delay: shape.delay,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Animated Particles */}
      {[...Array(15)].map((_, i) => (
        <motion.div
          key={`particle-${i}`}
          className="absolute w-2 h-2 rounded-full"
          style={{
            left: `${10 + Math.random() * 80}%`,
            top: `${10 + Math.random() * 80}%`,
            background: i % 3 === 0 ? BRAND.pink : i % 3 === 1 ? BRAND.purple : BRAND.blue,
            boxShadow: `0 0 10px ${i % 3 === 0 ? BRAND.pink : i % 3 === 1 ? BRAND.purple : BRAND.blue}`,
          }}
          animate={{
            scale: [0, 1, 0],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            delay: i * 0.3,
          }}
        />
      ))}
    </div>
  );
}

// 3D Card Component for Left Side
function BrandShowcase() {
  const apps = [
    { icon: Mail, name: 'Mail', color: BRAND.pink },
    { icon: FileText, name: 'Docs', color: BRAND.purple },
    { icon: Video, name: 'Meet', color: BRAND.blue },
    { icon: Calendar, name: 'Calendar', color: BRAND.purple },
    { icon: HardDrive, name: 'Drive', color: BRAND.pink },
  ];

  return (
    <div className="relative h-full flex flex-col justify-center px-8 lg:px-16" style={{ perspective: '1000px' }}>
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3">
          <motion.div
            className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${BRAND.gradient} flex items-center justify-center shadow-xl`}
            whileHover={{ scale: 1.1, rotate: 5 }}
            style={{ boxShadow: `0 20px 40px ${BRAND.purple}40` }}
          >
            <span className="text-white font-black text-2xl">B</span>
          </motion.div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bheem</h1>
            <p className="text-sm text-gray-500">Workspace</p>
          </div>
        </div>
      </motion.div>

      {/* Main Headline */}
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="mb-10"
      >
        <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 leading-tight mb-4">
          Everything you need.
          <br />
          <span className={`bg-gradient-to-r ${BRAND.gradient} bg-clip-text text-transparent`}>
            One workspace.
          </span>
        </h2>
        <p className="text-lg text-gray-600 max-w-md">
          Collaborate, communicate, and create with your team using our AI-powered productivity suite.
        </p>
      </motion.div>

      {/* 3D Floating App Cards */}
      <div className="relative mb-10">
        <motion.div
          className="flex flex-wrap gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {apps.map((app, i) => (
            <FloatingElement key={app.name} delay={0.5 + i * 0.1} duration={4 + i * 0.5} y={-5 - i * 2}>
              <motion.div
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white shadow-lg border border-gray-100"
                whileHover={{ scale: 1.05, y: -5 }}
                style={{ boxShadow: `0 10px 30px ${app.color}20` }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${app.color}, ${BRAND.purple})` }}
                >
                  <app.icon size={16} className="text-white" />
                </div>
                <span className="font-medium text-gray-700">{app.name}</span>
              </motion.div>
            </FloatingElement>
          ))}
        </motion.div>
      </div>

      {/* Features */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="grid grid-cols-2 gap-4"
      >
        {[
          { icon: Sparkles, text: 'AI-Powered', color: BRAND.pink },
          { icon: Shield, text: 'Enterprise Security', color: BRAND.purple },
          { icon: Zap, text: 'Real-time Sync', color: BRAND.blue },
          { icon: Globe, text: 'Global CDN', color: BRAND.purple },
        ].map((feature, i) => (
          <motion.div
            key={feature.text}
            className="flex items-center gap-2 text-gray-600"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1 + i * 0.1 }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: `${feature.color}20` }}
            >
              <feature.icon size={16} style={{ color: feature.color }} />
            </div>
            <span className="text-sm font-medium">{feature.text}</span>
          </motion.div>
        ))}
      </motion.div>

      {/* Trust Badge */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="mt-10 flex items-center gap-3"
      >
        <div className="flex -space-x-2">
          {['S', 'A', 'J', 'T', 'M'].map((letter, i) => (
            <motion.div
              key={i}
              className={`w-8 h-8 rounded-full bg-gradient-to-br ${BRAND.gradient} flex items-center justify-center text-white text-xs font-bold border-2 border-white shadow-md`}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 1.3 + i * 0.1 }}
            >
              {letter}
            </motion.div>
          ))}
        </div>
        <p className="text-sm text-gray-500">
          <span className="font-semibold text-gray-900">50,000+</span> teams trust Bheem
        </p>
      </motion.div>
    </div>
  );
}

// Passport URL for OAuth
const PASSPORT_URL = process.env.NEXT_PUBLIC_PASSPORT_URL || 'https://platform.bheem.co.uk';

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
  const [showLoginLoader, setShowLoginLoader] = useState(false);
  const [loggedInUserName, setLoggedInUserName] = useState('');
  const [socialLoading, setSocialLoading] = useState<string | null>(null);

  // Remember me state
  const [rememberMe, setRememberMe] = useState(false);

  // Login form
  const [loginData, setLoginData] = useState({
    username: '',
    password: '',
  });

  // Load saved credentials on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedUsername = localStorage.getItem('bheem_remembered_username');
      const savedRememberMe = localStorage.getItem('bheem_remember_me') === 'true';
      if (savedUsername && savedRememberMe) {
        setLoginData(prev => ({ ...prev, username: savedUsername }));
        setRememberMe(true);
      }
    }
  }, []);

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
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

    if (!isLoading && isAuthenticated && !isLoggingIn && token) {
      let defaultRedirect = '/dashboard';
      if (user?.role === 'SuperAdmin') {
        defaultRedirect = '/super-admin';
      } else if (user?.workspace_role === 'admin') {
        defaultRedirect = '/admin';
      }
      router.push(redirectTo || defaultRedirect);
    }
  }, [isAuthenticated, isLoading, router, redirectTo, isLoggingIn, user]);

  // Store target URL for navigation after login loader
  const [loginTargetUrl, setLoginTargetUrl] = useState('');

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
      await setAuth(access_token, user);

      // Store user name for loader greeting
      setLoggedInUserName(user.name || user.full_name || user.username?.split('@')[0] || '');

      let targetUrl = '/dashboard';
      if (user.role === 'SuperAdmin') {
        targetUrl = '/super-admin';
      } else {
        try {
          const workspaceRes = await api.get('/user-workspace/me');
          const workspace = workspaceRes.data;
          if (workspace?.role === 'admin' || workspace?.user?.workspace_role === 'admin') {
            targetUrl = '/admin';
          }
        } catch (err) {
          console.log('No workspace found, using default redirect');
        }
      }

      // Save or clear remembered credentials
      if (rememberMe) {
        localStorage.setItem('bheem_remembered_username', loginData.username);
        localStorage.setItem('bheem_remember_me', 'true');
      } else {
        localStorage.removeItem('bheem_remembered_username');
        localStorage.removeItem('bheem_remember_me');
      }

      // Store target URL and show branded loader
      setLoginTargetUrl(redirectTo || targetUrl);
      setShowLoginLoader(true);
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

  // Handle login loader completion - navigate to target
  const handleLoginLoaderComplete = () => {
    router.push(loginTargetUrl);
  };

  // Handle social login - redirect to Passport OAuth
  const handleSocialLogin = (provider: string) => {
    setSocialLoading(provider);
    const callbackUrl = `${window.location.origin}/auth/callback`;
    const url = `${PASSPORT_URL}/api/v1/auth/oauth/${provider}?company_code=BHM001&redirect_url=${encodeURIComponent(callbackUrl)}`;
    window.location.href = url;
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
      setSuccess('Account created successfully! Redirecting...');

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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <motion.div
          className="relative"
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          <div className={`w-16 h-16 rounded-full border-4 border-transparent bg-gradient-to-r ${BRAND.gradient}`} style={{ padding: '3px' }}>
            <div className="w-full h-full rounded-full bg-white" />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{mode === 'login' ? 'Sign In' : 'Sign Up'} - Bheem Workspace</title>
        <meta name="description" content="Sign in to Bheem Workspace - Your complete productivity suite" />
      </Head>

      <div className="min-h-screen flex relative overflow-hidden bg-white">
        {/* Animated Background */}
        {mounted && <AnimatedBackground />}

        {/* Left Side - Brand Showcase (Hidden on mobile) */}
        <div className="hidden lg:flex lg:w-1/2 relative z-10">
          <BrandShowcase />
        </div>

        {/* Right Side - Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            {/* Mobile Logo */}
            <div className="lg:hidden text-center mb-8">
              <motion.div
                className={`w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br ${BRAND.gradient} flex items-center justify-center shadow-xl mb-4`}
                whileHover={{ scale: 1.1, rotate: 5 }}
              >
                <span className="text-white font-black text-3xl">B</span>
              </motion.div>
              <h1 className="text-2xl font-bold text-gray-900">Bheem Workspace</h1>
            </div>

            {/* Main Card */}
            <motion.div
              className="relative"
              style={{ perspective: '1000px' }}
            >
              {/* Card Glow */}
              <div className={`absolute -inset-1 rounded-3xl bg-gradient-to-r ${BRAND.gradient} opacity-20 blur-xl`} />

              <div className="relative bg-white/80 backdrop-blur-xl rounded-3xl border border-gray-200 shadow-2xl p-6 sm:p-8">
                {/* Mode Toggle */}
                <div className="flex rounded-2xl p-1.5 mb-6 bg-gray-100">
                  <motion.button
                    type="button"
                    onClick={() => { setMode('login'); setError(''); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all ${
                      mode === 'login' ? 'text-white shadow-lg' : 'text-gray-500 hover:text-gray-700'
                    }`}
                    style={mode === 'login' ? { background: `linear-gradient(90deg, ${BRAND.purple}, ${BRAND.blue})` } : {}}
                    whileTap={{ scale: 0.98 }}
                  >
                    <LogIn size={18} />
                    Sign In
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={() => { setMode('signup'); setError(''); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all ${
                      mode === 'signup' ? 'text-white shadow-lg' : 'text-gray-500 hover:text-gray-700'
                    }`}
                    style={mode === 'signup' ? { background: `linear-gradient(90deg, ${BRAND.pink}, ${BRAND.purple})` } : {}}
                    whileTap={{ scale: 0.98 }}
                  >
                    <UserPlus size={18} />
                    Sign Up
                  </motion.button>
                </div>

                {/* Header */}
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {mode === 'login' ? 'Welcome back' : 'Create your workspace'}
                  </h3>
                  <p className="text-gray-500">
                    {mode === 'login'
                      ? 'Enter your credentials to access your workspace'
                      : 'Start your 14-day free trial today'}
                  </p>
                </div>

                {selectedPlan && mode === 'signup' && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium bg-green-50 text-green-600 border border-green-200"
                  >
                    <Check size={18} />
                    {selectedPlan.replace('WORKSPACE-', '')} plan selected
                  </motion.div>
                )}

                {/* Messages */}
                <AnimatePresence mode="wait">
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex items-center gap-3 p-4 mb-4 rounded-xl bg-red-50 border border-red-200 text-red-600"
                    >
                      <AlertCircle size={20} className="flex-shrink-0" />
                      <span className="text-sm">{error}</span>
                    </motion.div>
                  )}
                  {success && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex items-center gap-3 p-4 mb-4 rounded-xl bg-green-50 border border-green-200 text-green-600"
                    >
                      <Check size={20} className="flex-shrink-0" />
                      <span className="text-sm">{success}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Forms */}
                <AnimatePresence mode="wait">
                  {mode === 'login' ? (
                    <motion.form
                      key="login"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="space-y-4"
                      onSubmit={handleLogin}
                    >
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Email address</label>
                        <div className="relative">
                          <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            type="email"
                            required
                            value={loginData.username}
                            onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                            className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#977DFF]/50 focus:border-[#977DFF] transition-all"
                            placeholder="you@example.com"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                        <div className="relative">
                          <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            value={loginData.password}
                            onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                            className="w-full pl-12 pr-12 py-3.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#977DFF]/50 focus:border-[#977DFF] transition-all"
                            placeholder="Enter your password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-[#977DFF] focus:ring-[#977DFF]"
                          />
                          <span className="text-sm text-gray-600">Remember me</span>
                        </label>
                        <a href="#" className="text-sm font-medium text-[#977DFF] hover:text-[#0033FF] transition-colors">
                          Forgot password?
                        </a>
                      </div>

                      <motion.button
                        type="submit"
                        disabled={loading}
                        className={`w-full relative group py-4 rounded-xl font-semibold text-white transition-all disabled:opacity-50 overflow-hidden bg-gradient-to-r ${BRAND.gradient}`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        style={{ boxShadow: `0 10px 30px ${BRAND.purple}40` }}
                      >
                        <span className="relative flex items-center justify-center gap-2">
                          {loading ? (
                            <>
                              <motion.div
                                className="w-5 h-5 border-2 border-white/30 rounded-full border-t-white"
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                              />
                              Signing in...
                            </>
                          ) : (
                            <>
                              Sign in
                              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                            </>
                          )}
                        </span>
                      </motion.button>
                    </motion.form>
                  ) : (
                    <motion.form
                      key="signup"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                      onSubmit={handleSignup}
                    >
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                          <div className="relative">
                            <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                              type="text"
                              required
                              value={signupData.fullName}
                              onChange={(e) => setSignupData({ ...signupData, fullName: e.target.value })}
                              className="w-full pl-12 pr-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#977DFF]/50 focus:border-[#977DFF] transition-all text-sm"
                              placeholder="John Doe"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Workspace</label>
                          <div className="relative">
                            <Building2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                              type="text"
                              required
                              value={signupData.workspaceName}
                              onChange={(e) => setSignupData({ ...signupData, workspaceName: e.target.value })}
                              className="w-full pl-12 pr-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#977DFF]/50 focus:border-[#977DFF] transition-all text-sm"
                              placeholder="My Company"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Work Email</label>
                        <div className="relative">
                          <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            type="email"
                            required
                            value={signupData.email}
                            onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                            className="w-full pl-12 pr-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#977DFF]/50 focus:border-[#977DFF] transition-all"
                            placeholder="you@company.com"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                        <div className="relative">
                          <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            value={signupData.password}
                            onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                            className="w-full pl-12 pr-12 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#977DFF]/50 focus:border-[#977DFF] transition-all"
                            placeholder="Min 8 characters"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
                        <div className="relative">
                          <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            type="password"
                            required
                            value={signupData.confirmPassword}
                            onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                            className="w-full pl-12 pr-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#977DFF]/50 focus:border-[#977DFF] transition-all"
                            placeholder="Confirm your password"
                          />
                        </div>
                      </div>

                      <p className="text-xs text-gray-500">
                        By signing up, you agree to our{' '}
                        <a href="#" className="text-[#977DFF] hover:text-[#0033FF]">Terms</a>
                        {' '}and{' '}
                        <a href="#" className="text-[#977DFF] hover:text-[#0033FF]">Privacy Policy</a>.
                      </p>

                      <motion.button
                        type="submit"
                        disabled={loading}
                        className={`w-full relative group py-4 rounded-xl font-semibold text-white transition-all disabled:opacity-50 overflow-hidden bg-gradient-to-r from-[#FFCCF2] via-[#977DFF] to-[#0033FF]`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        style={{ boxShadow: `0 10px 30px ${BRAND.purple}40` }}
                      >
                        <span className="relative flex items-center justify-center gap-2">
                          {loading ? (
                            <>
                              <motion.div
                                className="w-5 h-5 border-2 border-white/30 rounded-full border-t-white"
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                              />
                              Creating workspace...
                            </>
                          ) : (
                            <>
                              Get started free
                              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                            </>
                          )}
                        </span>
                      </motion.button>
                    </motion.form>
                  )}
                </AnimatePresence>

                {/* Divider */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-4 text-sm text-gray-500 bg-white">or continue with</span>
                  </div>
                </div>

                {/* Social Login */}
                <div className="grid grid-cols-2 gap-3">
                  <motion.button
                    type="button"
                    onClick={() => handleSocialLogin('google')}
                    disabled={socialLoading !== null}
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-700 font-medium hover:bg-gray-100 transition-all disabled:opacity-50"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {socialLoading === 'google' ? (
                      <motion.div
                        className="w-5 h-5 border-2 border-gray-300 rounded-full border-t-gray-600"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      />
                    ) : (
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#EA4335" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC04" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#4285F4" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                    )}
                    Google
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={() => handleSocialLogin('github')}
                    disabled={socialLoading !== null}
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-700 font-medium hover:bg-gray-100 transition-all disabled:opacity-50"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {socialLoading === 'github' ? (
                      <motion.div
                        className="w-5 h-5 border-2 border-gray-300 rounded-full border-t-gray-600"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      />
                    ) : (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                      </svg>
                    )}
                    GitHub
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={() => handleSocialLogin('facebook')}
                    disabled={socialLoading !== null}
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-700 font-medium hover:bg-gray-100 transition-all disabled:opacity-50"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {socialLoading === 'facebook' ? (
                      <motion.div
                        className="w-5 h-5 border-2 border-gray-300 rounded-full border-t-gray-600"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      />
                    ) : (
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                    )}
                    Facebook
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={() => handleSocialLogin('linkedin')}
                    disabled={socialLoading !== null}
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-700 font-medium hover:bg-gray-100 transition-all disabled:opacity-50"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {socialLoading === 'linkedin' ? (
                      <motion.div
                        className="w-5 h-5 border-2 border-gray-300 rounded-full border-t-gray-600"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      />
                    ) : (
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#0A66C2" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                    )}
                    LinkedIn
                  </motion.button>
                </div>
              </div>
            </motion.div>

            {/* Footer */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-center text-sm mt-6 text-gray-500"
            >
              <Link href="/" className="inline-flex items-center gap-1 text-[#977DFF] hover:text-[#0033FF] transition-colors font-medium">
                <ArrowRight size={14} className="rotate-180" />
                Back to home
              </Link>
            </motion.p>
          </motion.div>
        </div>
      </div>

      {/* Branded Login Loader - Only shows after successful authentication */}
      <AnimatePresence>
        {showLoginLoader && (
          <LoginLoader
            userName={loggedInUserName}
            onComplete={handleLoginLoaderComplete}
          />
        )}
      </AnimatePresence>
    </>
  );
}
