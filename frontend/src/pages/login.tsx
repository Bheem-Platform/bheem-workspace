import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Eye, EyeOff, LogIn, UserPlus, AlertCircle, Check, Building2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';

type AuthMode = 'login' | 'signup';

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, setAuth } = useAuthStore();
  const [mode, setMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false); // Flag to prevent auto-redirect during login

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

  // Get redirect URL and plan from query params
  const redirectTo = router.query.redirect as string;
  const selectedPlan = router.query.plan as string;

  // Set mode based on URL or plan selection
  useEffect(() => {
    if (selectedPlan) {
      setMode('signup');
    }
  }, [selectedPlan]);

  // If already authenticated (and not currently logging in), redirect
  useEffect(() => {
    if (!isLoading && isAuthenticated && !isLoggingIn) {
      router.push(redirectTo || '/dashboard');
    }
  }, [isAuthenticated, isLoading, router, redirectTo, isLoggingIn]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setIsLoggingIn(true); // Prevent auto-redirect while we calculate the correct destination

    try {
      // Login via Bheem Passport (through backend)
      const response = await api.post('/auth/login', {
        username: loginData.username,
        password: loginData.password,
      });

      const { access_token, user } = response.data;

      // Determine redirect based on user role
      // SuperAdmin goes to super-admin panel
      // Workspace admins go to /admin
      // Regular users go to user dashboard
      let targetUrl = '/dashboard';

      if (user.role === 'SuperAdmin') {
        targetUrl = '/super-admin';
      } else {
        // Check if user has workspace admin role by fetching their membership
        try {
          const membershipRes = await api.get('/user-workspace/me', {
            headers: { Authorization: `Bearer ${access_token}` }
          });
          const workspaceData = membershipRes.data;
          const workspaceRole = workspaceData?.user?.workspace_role;
          if (workspaceRole === 'admin' || workspaceRole === 'manager') {
            targetUrl = '/admin';
          }
        } catch {
          // If no workspace membership found, go to dashboard
          targetUrl = '/dashboard';
        }
      }

      // Use redirect param if specified, otherwise use role-based redirect
      const finalRedirect = redirectTo || targetUrl;

      // Now set auth state and redirect
      setAuth(access_token, user);
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
      setIsLoggingIn(false); // Reset flag on error
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    // Validate passwords match
    if (signupData.password !== signupData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    // Validate password strength
    if (signupData.password.length < 8) {
      setError('Password must be at least 8 characters');
      setLoading(false);
      return;
    }

    try {
      // Step 1: Register user via Bheem Passport (through backend)
      await api.post('/auth/register', {
        username: signupData.email,
        email: signupData.email,
        password: signupData.password,
        full_name: signupData.fullName,
        role: 'Customer',
        company_code: 'BHM001', // External customers under BHM001
      });

      // Step 2: Login via Bheem Passport to get token
      const loginResponse = await api.post('/auth/login', {
        username: signupData.email,
        password: signupData.password,
      });

      const { access_token, user } = loginResponse.data;

      // Step 3: Create tenant/workspace for the user
      const workspaceSlug = signupData.workspaceName
        ?.toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') ||
        signupData.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-');

      try {
        // Create tenant using public endpoint (no SuperAdmin required)
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
        // Tenant creation might fail if user already has one - continue anyway
        console.log('Tenant note:', tenantErr.response?.data?.detail || 'proceeding');
      }

      // Step 4: Set auth and redirect
      setAuth(access_token, user);
      setSuccess('Account created successfully! Redirecting...');

      setTimeout(() => {
        router.push(redirectTo || '/admin');
      }, 1000);

    } catch (err: any) {
      console.error('Signup error:', err);
      console.error('Error response:', err.response?.data);

      if (err.response?.status === 422) {
        // Validation error - show details
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

  // Show loading while checking auth state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <Link href="/" className="inline-block">
            <div className="mx-auto h-16 w-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
              <span className="text-2xl font-bold text-white">B</span>
            </div>
          </Link>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Bheem Workspace
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {mode === 'login' ? 'Sign in to your account' : 'Create your workspace'}
          </p>
          {selectedPlan && mode === 'signup' && (
            <div className="mt-3 inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-sm font-medium">
              <Check size={16} />
              {selectedPlan.replace('WORKSPACE-', '')} plan selected
            </div>
          )}
        </div>

        {/* Mode Toggle */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(''); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${
              mode === 'login'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <LogIn size={18} />
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(''); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${
              mode === 'signup'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <UserPlus size={18} />
            Sign Up
          </button>
        </div>

        {/* Form */}
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl">
          {/* Error/Success Messages */}
          {error && (
            <div className="flex items-center space-x-2 p-4 mb-6 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertCircle size={20} className="flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}
          {success && (
            <div className="flex items-center space-x-2 p-4 mb-6 bg-green-50 border border-green-200 rounded-lg text-green-700">
              <Check size={20} className="flex-shrink-0" />
              <span className="text-sm">{success}</span>
            </div>
          )}

          {mode === 'login' ? (
            /* Login Form */
            <form className="space-y-6" onSubmit={handleLogin}>
              <div>
                <label htmlFor="login-email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={loginData.username}
                  onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                  className="mt-1 appearance-none block w-full px-4 py-3 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="login-password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="mt-1 relative">
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors pr-12"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end">
                <a href="#" className="text-sm text-blue-600 hover:text-blue-500">
                  Forgot password?
                </a>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn size={20} className="mr-2" />
                    Sign in
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Signup Form */
            <form className="space-y-5" onSubmit={handleSignup}>
              <div>
                <label htmlFor="signup-name" className="block text-sm font-medium text-gray-700">
                  Full Name
                </label>
                <input
                  id="signup-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={signupData.fullName}
                  onChange={(e) => setSignupData({ ...signupData, fullName: e.target.value })}
                  className="mt-1 appearance-none block w-full px-4 py-3 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label htmlFor="signup-email" className="block text-sm font-medium text-gray-700">
                  Work Email
                </label>
                <input
                  id="signup-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={signupData.email}
                  onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                  className="mt-1 appearance-none block w-full px-4 py-3 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="you@company.com"
                />
              </div>

              <div>
                <label htmlFor="signup-workspace" className="block text-sm font-medium text-gray-700">
                  Workspace Name
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Building2 size={18} className="text-gray-400" />
                  </div>
                  <input
                    id="signup-workspace"
                    name="workspace"
                    type="text"
                    required
                    value={signupData.workspaceName}
                    onChange={(e) => setSignupData({ ...signupData, workspaceName: e.target.value })}
                    className="appearance-none block w-full pl-10 px-4 py-3 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="My Company"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="signup-password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="mt-1 relative">
                  <input
                    id="signup-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={signupData.password}
                    onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                    className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors pr-12"
                    placeholder="Min 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="signup-confirm" className="block text-sm font-medium text-gray-700">
                  Confirm Password
                </label>
                <input
                  id="signup-confirm"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={signupData.confirmPassword}
                  onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                  className="mt-1 appearance-none block w-full px-4 py-3 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Confirm your password"
                />
              </div>

              <div className="text-sm text-gray-500">
                By signing up, you agree to our{' '}
                <a href="#" className="text-blue-600 hover:underline">Terms of Service</a>
                {' '}and{' '}
                <a href="#" className="text-blue-600 hover:underline">Privacy Policy</a>.
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Creating account...
                  </>
                ) : (
                  <>
                    <UserPlus size={20} className="mr-2" />
                    Create Account
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500">
          <Link href="/" className="text-blue-600 hover:underline">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
