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
  Building2,
  Mail,
  Video,
  FileText,
  Calendar,
  HardDrive,
  Table,
  Presentation,
  ClipboardList,
  ArrowRight,
  MessageSquare,
  Users,
  BarChart3,
  Shield,
  Cloud,
  Sparkles,
  Zap,
  Globe,
  Lock,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';

type AuthMode = 'login' | 'signup';

// Floating icons for background animation
const floatingIcons = [
  { icon: Mail, color: '#EA4335', size: 40, x: 8, y: 12, duration: 20, delay: 0 },
  { icon: Video, color: '#34A853', size: 48, x: 92, y: 8, duration: 25, delay: 1 },
  { icon: FileText, color: '#4285F4', size: 36, x: 15, y: 85, duration: 22, delay: 2 },
  { icon: Calendar, color: '#8E24AA', size: 44, x: 88, y: 78, duration: 28, delay: 0.5 },
  { icon: HardDrive, color: '#FBBC04', size: 32, x: 5, y: 45, duration: 24, delay: 3 },
  { icon: Table, color: '#0F9D58', size: 38, x: 95, y: 42, duration: 26, delay: 1.5 },
  { icon: Presentation, color: '#F4B400', size: 42, x: 12, y: 65, duration: 21, delay: 2.5 },
  { icon: ClipboardList, color: '#7B1FA2', size: 34, x: 85, y: 25, duration: 23, delay: 4 },
  { icon: MessageSquare, color: '#00ACC1', size: 30, x: 50, y: 5, duration: 19, delay: 0 },
  { icon: Users, color: '#5C6BC0', size: 46, x: 48, y: 92, duration: 27, delay: 2 },
  { icon: BarChart3, color: '#43A047', size: 28, x: 25, y: 30, duration: 18, delay: 3.5 },
  { icon: Shield, color: '#E53935', size: 36, x: 72, y: 55, duration: 24, delay: 1 },
  { icon: Cloud, color: '#039BE5', size: 40, x: 35, y: 70, duration: 22, delay: 4.5 },
  { icon: Sparkles, color: '#FF6F00', size: 26, x: 62, y: 18, duration: 20, delay: 2 },
  { icon: Zap, color: '#FFD600', size: 32, x: 78, y: 88, duration: 25, delay: 0.5 },
  { icon: Globe, color: '#26A69A', size: 38, x: 20, y: 50, duration: 23, delay: 3 },
];

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, setAuth } = useAuthStore();
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
    if (!isLoading && isAuthenticated && !isLoggingIn) {
      router.push(redirectTo || '/dashboard');
    }
  }, [isAuthenticated, isLoading, router, redirectTo, isLoggingIn]);

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
      let targetUrl = '/dashboard';
      if (user.role === 'SuperAdmin') {
        targetUrl = '/super-admin';
      }

      const finalRedirect = redirectTo || targetUrl;
      await setAuth(access_token, user);
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
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a1a]">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-purple-500/30 rounded-full animate-spin border-t-purple-500"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <span className="text-xl font-black text-white">B</span>
            </div>
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

      <div className="min-h-screen flex relative overflow-hidden bg-[#0a0a1a]">
        {/* Floating Background Icons */}
        {mounted && floatingIcons.map((item, index) => {
          const Icon = item.icon;
          return (
            <div
              key={index}
              className="absolute pointer-events-none z-0 animate-float-icon"
              style={{
                left: `${item.x}%`,
                top: `${item.y}%`,
                animationDuration: `${item.duration}s`,
                animationDelay: `${item.delay}s`,
              }}
            >
              <div className="relative animate-pulse-slow" style={{ animationDelay: `${item.delay * 0.5}s` }}>
                <div
                  className="absolute inset-0 rounded-xl blur-lg opacity-30"
                  style={{ backgroundColor: item.color }}
                />
                <div
                  className="relative rounded-xl p-2.5 backdrop-blur-sm border border-white/5"
                  style={{
                    backgroundColor: `${item.color}15`,
                    boxShadow: `0 0 20px ${item.color}20`,
                  }}
                >
                  <Icon size={item.size} style={{ color: item.color }} className="opacity-70" />
                </div>
              </div>
            </div>
          );
        })}

        {/* Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/10 via-transparent to-purple-900/10 z-0" />
        <div className="absolute top-0 left-0 w-1/2 h-full bg-gradient-to-r from-[#0a0a1a] via-[#0a0a1a]/80 to-transparent z-[1]" />

        {/* Left Side - Branding & Info */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-16 xl:px-24 relative z-10">
          {/* Logo */}
          <div className="mb-12">
            <div className="flex items-center gap-4 mb-8">
              <div className="relative">
                <div className="absolute -inset-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-2xl blur-lg opacity-50" />
                <div className="relative w-16 h-16 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center">
                  <span className="text-3xl font-black text-white">B</span>
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Bheem</h1>
                <p className="text-gray-400">Workspace</p>
              </div>
            </div>
          </div>

          {/* Main Headline */}
          <div className="mb-12">
            <h2 className="text-5xl xl:text-6xl font-bold text-white leading-tight mb-6">
              Everything you need.
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                One workspace.
              </span>
            </h2>
            <p className="text-xl text-gray-400 max-w-lg">
              Collaborate, communicate, and create with your team using our integrated suite of productivity tools.
            </p>
          </div>

          {/* AI Features - Compact Horizontal */}
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-3 group cursor-pointer">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:scale-110 transition-transform">
                <Sparkles size={22} className="text-white" />
              </div>
              <span className="text-white font-medium">AI Writer</span>
            </div>

            <div className="flex items-center gap-3 group cursor-pointer">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform">
                <MessageSquare size={22} className="text-white" />
              </div>
              <span className="text-white font-medium">Summarize</span>
            </div>

            <div className="flex items-center gap-3 group cursor-pointer">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-500/20 group-hover:scale-110 transition-transform">
                <Zap size={22} className="text-white" />
              </div>
              <span className="text-white font-medium">Automate</span>
            </div>

            <div className="flex items-center gap-3 group cursor-pointer">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center shadow-lg shadow-orange-500/20 group-hover:scale-110 transition-transform">
                <BarChart3 size={22} className="text-white" />
              </div>
              <span className="text-white font-medium">Analytics</span>
            </div>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12 relative z-10">
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="lg:hidden text-center mb-8">
              <div className="inline-flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                  <span className="text-2xl font-black text-white">B</span>
                </div>
                <span className="text-2xl font-bold text-white">Bheem Workspace</span>
              </div>
            </div>

            {/* Card */}
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/30 via-purple-500/30 to-pink-500/30 rounded-3xl blur-xl" />

              <div className="relative bg-[#12121f]/80 backdrop-blur-2xl rounded-3xl border border-white/10 p-8 shadow-2xl">
                {/* Mode Toggle */}
                <div className="flex bg-white/5 rounded-2xl p-1.5 mb-8">
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setError(''); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-300 ${
                      mode === 'login'
                        ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <LogIn size={18} />
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMode('signup'); setError(''); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-300 ${
                      mode === 'signup'
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                        : 'text-gray-400 hover:text-white'
                    }`}
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
                  <p className="text-gray-400">
                    {mode === 'login'
                      ? 'Enter your credentials to access your workspace'
                      : 'Start your 14-day free trial today'}
                  </p>
                </div>

                {selectedPlan && mode === 'signup' && (
                  <div className="mb-6 flex items-center justify-center gap-2 bg-green-500/10 text-green-400 px-4 py-3 rounded-xl text-sm font-medium border border-green-500/20">
                    <Check size={18} />
                    {selectedPlan.replace('WORKSPACE-', '')} plan selected
                  </div>
                )}

                {/* Messages */}
                {error && (
                  <div className="flex items-center gap-3 p-4 mb-6 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
                    <AlertCircle size={20} className="flex-shrink-0" />
                    <span className="text-sm">{error}</span>
                  </div>
                )}
                {success && (
                  <div className="flex items-center gap-3 p-4 mb-6 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400">
                    <Check size={20} className="flex-shrink-0" />
                    <span className="text-sm">{success}</span>
                  </div>
                )}

                {/* Forms */}
                {mode === 'login' ? (
                  <form className="space-y-5" onSubmit={handleLogin}>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Email address</label>
                      <div className="relative">
                        <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                          type="email"
                          required
                          value={loginData.username}
                          onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                          className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all"
                          placeholder="you@example.com"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                      <div className="relative">
                        <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={loginData.password}
                          onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                          className="w-full pl-12 pr-12 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all"
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
                        <input type="checkbox" className="w-4 h-4 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500/50" />
                        <span className="text-sm text-gray-400">Remember me</span>
                      </label>
                      <a href="#" className="text-sm text-purple-400 hover:text-purple-300 transition-colors">
                        Forgot password?
                      </a>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full relative group py-4 rounded-xl font-semibold text-white transition-all duration-300 disabled:opacity-50 overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600" />
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
                        <label className="block text-sm font-medium text-gray-300 mb-2">Full Name</label>
                        <input
                          type="text"
                          required
                          value={signupData.fullName}
                          onChange={(e) => setSignupData({ ...signupData, fullName: e.target.value })}
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all"
                          placeholder="John Doe"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Workspace</label>
                        <input
                          type="text"
                          required
                          value={signupData.workspaceName}
                          onChange={(e) => setSignupData({ ...signupData, workspaceName: e.target.value })}
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all"
                          placeholder="My Company"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Work Email</label>
                      <div className="relative">
                        <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                          type="email"
                          required
                          value={signupData.email}
                          onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                          className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all"
                          placeholder="you@company.com"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                      <div className="relative">
                        <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={signupData.password}
                          onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                          className="w-full pl-12 pr-12 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all"
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
                      <label className="block text-sm font-medium text-gray-300 mb-2">Confirm Password</label>
                      <div className="relative">
                        <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                          type="password"
                          required
                          value={signupData.confirmPassword}
                          onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                          className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all"
                          placeholder="Confirm your password"
                        />
                      </div>
                    </div>

                    <p className="text-xs text-gray-500">
                      By signing up, you agree to our{' '}
                      <a href="#" className="text-purple-400 hover:text-purple-300">Terms</a>
                      {' '}and{' '}
                      <a href="#" className="text-purple-400 hover:text-purple-300">Privacy Policy</a>.
                    </p>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full relative group py-4 rounded-xl font-semibold text-white transition-all duration-300 disabled:opacity-50 overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-pink-500 to-red-500" />
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-purple-600 via-pink-600 to-red-600" />
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
                    <div className="w-full border-t border-white/10" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-4 bg-[#12121f] text-gray-500 text-sm">or continue with</span>
                  </div>
                </div>

                {/* Social Login */}
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    className="flex items-center justify-center gap-2 py-3 px-4 bg-white/5 border border-white/10 rounded-xl text-white hover:bg-white/10 transition-all duration-300"
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
                    className="flex items-center justify-center gap-2 py-3 px-4 bg-white/5 border border-white/10 rounded-xl text-white hover:bg-white/10 transition-all duration-300"
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
            <p className="text-center text-sm text-gray-500 mt-8">
              <Link href="/" className="text-purple-400 hover:text-purple-300 transition-colors inline-flex items-center gap-1">
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
            opacity: 0.5;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.05);
          }
        }

        .animate-float-icon {
          animation: float-icon ease-in-out infinite;
        }

        .animate-pulse-slow {
          animation: pulse-slow 4s ease-in-out infinite;
        }
      `}</style>
    </>
  );
}
