import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Script from 'next/script';
import {
  Zap, Mail, FileText, Video, Shield, Bot,
  Check, Star, ArrowRight, Play,
  Sparkles, Calendar, HardDrive, Users,
  Clock, TrendingUp, Award, CheckCircle2,
  BarChart3, Lock, Globe, Cpu
} from 'lucide-react';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface CheckoutResponse {
  checkout_id: string;
  order_id: string;
  amount: number;
  currency: string;
  plan_name: string;
  key_id: string;
  gateway_response: {
    id: string;
    amount: number;
    currency: string;
  };
}

// Floating particles configuration
const particles = [
  { size: 4, x: 10, y: 20, duration: 20, delay: 0 },
  { size: 6, x: 20, y: 60, duration: 25, delay: 2 },
  { size: 3, x: 80, y: 30, duration: 22, delay: 1 },
  { size: 5, x: 70, y: 70, duration: 28, delay: 3 },
  { size: 4, x: 90, y: 15, duration: 24, delay: 0.5 },
  { size: 7, x: 15, y: 85, duration: 26, delay: 1.5 },
  { size: 3, x: 50, y: 10, duration: 21, delay: 2.5 },
  { size: 5, x: 85, y: 55, duration: 23, delay: 4 },
  { size: 4, x: 30, y: 40, duration: 27, delay: 1 },
  { size: 6, x: 60, y: 80, duration: 29, delay: 3.5 },
];

export default function LandingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setMounted(true);

    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const startCheckout = async (planId: string) => {
    setLoading(planId);

    try {
      const authToken = localStorage.getItem('auth_token');

      if (!authToken) {
        sessionStorage.setItem('pending_plan', planId);
        window.location.href = '/login?redirect=/&plan=' + planId;
        return;
      }

      const response = await fetch('/api/v1/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          plan_id: planId,
          billing_cycle: 'monthly'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create checkout session');
      }

      const session: CheckoutResponse = await response.json();

      if (!window.Razorpay) {
        throw new Error('Razorpay not loaded');
      }

      const options = {
        key: session.key_id,
        amount: session.gateway_response.amount,
        currency: session.gateway_response.currency,
        name: 'Bheem Workspace',
        description: `${session.plan_name} Subscription`,
        order_id: session.order_id,
        handler: async function(response: any) {
          try {
            const verifyResponse = await fetch('/api/v1/billing/verify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
              },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature
              })
            });

            if (verifyResponse.ok) {
              showToast('Subscription activated successfully!', 'success');
              setTimeout(() => {
                window.location.href = '/dashboard';
              }, 1500);
            } else {
              throw new Error('Verification failed');
            }
          } catch (err) {
            showToast('Payment verification failed. Please contact support.', 'error');
          }
        },
        prefill: { email: '' },
        theme: { color: '#8B5CF6' },
        modal: {
          ondismiss: function() {
            setLoading(null);
            showToast('Payment cancelled', 'info');
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function(response: any) {
        setLoading(null);
        showToast('Payment failed: ' + response.error.description, 'error');
      });
      rzp.open();

    } catch (error: any) {
      setLoading(null);
      showToast(error.message || 'Something went wrong', 'error');
    }
  };

  useEffect(() => {
    const pendingPlan = sessionStorage.getItem('pending_plan');
    const authToken = localStorage.getItem('auth_token');

    if (pendingPlan && authToken) {
      sessionStorage.removeItem('pending_plan');
      setTimeout(() => startCheckout(pendingPlan), 500);
    }
  }, []);

  const features = [
    {
      icon: Mail,
      title: 'Smart Email',
      description: 'AI-powered inbox that writes replies in your tone, automatically sorts messages, and flags what matters most.',
      color: '#EA4335',
      bg: 'bg-red-500/10'
    },
    {
      icon: FileText,
      title: 'Collaborative Docs',
      description: 'Create, edit, and collaborate in real-time. AI assists with drafting, summarizing, and formatting.',
      color: '#4285F4',
      bg: 'bg-blue-500/10'
    },
    {
      icon: Video,
      title: 'HD Video Meetings',
      description: 'Crystal clear video calls with AI transcription, automatic meeting notes, and action item tracking.',
      color: '#34A853',
      bg: 'bg-green-500/10'
    },
    {
      icon: Calendar,
      title: 'Smart Calendar',
      description: 'Intelligent scheduling with conflict detection, timezone management, and automated reminders.',
      color: '#8E24AA',
      bg: 'bg-purple-500/10'
    },
    {
      icon: HardDrive,
      title: 'Secure Drive',
      description: 'Store, share, and collaborate on files with enterprise-grade security and smart search.',
      color: '#FBBC04',
      bg: 'bg-yellow-500/10'
    },
    {
      icon: Bot,
      title: 'AI Assistant',
      description: 'Built-in AI for writing, analysis, and productivity tasks. No expensive add-ons required.',
      color: '#00ACC1',
      bg: 'bg-cyan-500/10'
    }
  ];

  const plans = [
    {
      id: 'WORKSPACE-STARTER',
      name: 'Starter',
      description: 'For small teams getting started',
      price: '₹999',
      period: '/user/month',
      features: ['Email, Docs, Meet, Calendar', '50 AI actions/month', '10 GB storage per user', 'Custom domain support', 'Standard support'],
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      id: 'WORKSPACE-PROFESSIONAL',
      name: 'Professional',
      description: 'For growing businesses',
      price: '₹2,499',
      period: '/user/month',
      features: ['Everything in Starter', 'Unlimited AI actions', '100 GB storage per user', 'Bheem Flow automation', 'Advanced analytics', 'Priority support'],
      popular: true,
      gradient: 'from-purple-500 to-pink-500'
    },
    {
      id: 'WORKSPACE-ENTERPRISE',
      name: 'Enterprise',
      description: 'For large organizations',
      price: 'Custom',
      period: '',
      features: ['Everything in Professional', 'Unlimited storage', 'Self-hosted option', 'White-label branding', 'Dedicated account manager', 'SLA guarantee'],
      isEnterprise: true,
      gradient: 'from-orange-500 to-red-500'
    }
  ];

  const stats = [
    { value: '47%', label: 'Productivity boost', icon: TrendingUp },
    { value: '12hrs', label: 'Saved weekly', icon: Clock },
    { value: '10K+', label: 'Teams worldwide', icon: Users },
    { value: '99.9%', label: 'Uptime SLA', icon: Award },
  ];

  const testimonials = [
    {
      quote: "We switched from Google Workspace and saved over $15,000/year. The AI features alone make it worth every penny.",
      author: "Sarah Kim",
      role: "CEO, TechStart Inc.",
      avatar: "SK"
    },
    {
      quote: "The meeting transcription is a game-changer. I used to spend hours writing notes. Now it's completely automatic.",
      author: "Marcus Rodriguez",
      role: "Product Lead, ScaleUp",
      avatar: "MR"
    },
    {
      quote: "Finally, one platform instead of five. We cancelled Zoom, Notion, and Slack. Bheem does it all better.",
      author: "Jennifer Lee",
      role: "Operations Director, GlobalCo",
      avatar: "JL"
    }
  ];

  return (
    <>
      <Head>
        <title>Bheem Workspace | AI-Powered Productivity Suite</title>
        <meta name="description" content="Email, Docs, Meetings—all in one place with AI built-in. The modern workspace for productive teams." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 px-6 py-4 rounded-2xl text-white font-medium shadow-2xl glass animate-slide-in ${
          toast.type === 'error' ? 'bg-red-500/80' : toast.type === 'success' ? 'bg-green-500/80' : 'bg-blue-500/80'
        }`}>
          {toast.message}
        </div>
      )}

      <div className="min-h-screen bg-[#050508] text-white overflow-hidden">
        {/* Animated Background */}
        <div className="fixed inset-0 z-0">
          {/* Main gradient orbs */}
          <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-purple-600/30 rounded-full blur-[120px] animate-blob" />
          <div className="absolute top-[20%] right-[-10%] w-[500px] h-[500px] bg-blue-600/25 rounded-full blur-[120px] animate-blob animation-delay-2000" />
          <div className="absolute bottom-[-10%] left-[30%] w-[550px] h-[550px] bg-pink-600/20 rounded-full blur-[120px] animate-blob animation-delay-4000" />
          <div className="absolute top-[50%] left-[50%] w-[400px] h-[400px] bg-cyan-600/15 rounded-full blur-[100px] animate-pulse-slow" />

          {/* Grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
              backgroundSize: '50px 50px'
            }}
          />

          {/* Floating particles */}
          {mounted && particles.map((particle, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white/20 animate-float-particle"
              style={{
                width: particle.size,
                height: particle.size,
                left: `${particle.x}%`,
                top: `${particle.y}%`,
                animationDuration: `${particle.duration}s`,
                animationDelay: `${particle.delay}s`,
              }}
            />
          ))}

          {/* Mouse follow gradient */}
          {mounted && (
            <div
              className="pointer-events-none absolute w-[600px] h-[600px] rounded-full opacity-20 transition-all duration-300 ease-out"
              style={{
                background: 'radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, transparent 70%)',
                left: mousePosition.x - 300,
                top: mousePosition.y - 300,
              }}
            />
          )}
        </div>

        {/* Navigation - Glassmorphism */}
        <nav className="fixed top-0 left-0 right-0 z-50">
          <div className="mx-4 mt-4">
            <div className="max-w-7xl mx-auto glass rounded-2xl border border-white/10">
              <div className="px-6 flex justify-between items-center h-16">
                <Link href="/" className="flex items-center gap-2">
                  <div className="w-9 h-9 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/25">
                    <span className="text-white font-bold text-sm">B</span>
                  </div>
                  <span className="text-lg font-bold">Bheem</span>
                </Link>

                <div className="hidden md:flex items-center gap-1">
                  <a href="#features" className="text-sm text-gray-400 hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-white/5">Features</a>
                  <a href="#pricing" className="text-sm text-gray-400 hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-white/5">Pricing</a>
                  <a href="#testimonials" className="text-sm text-gray-400 hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-white/5">Customers</a>
                </div>

                <div className="flex items-center gap-3">
                  <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors px-4 py-2">
                    Sign in
                  </Link>
                  <Link href="/login?mode=signup" className="text-sm bg-white text-gray-900 px-5 py-2.5 rounded-xl font-medium hover:bg-gray-100 transition-all hover:shadow-lg hover:shadow-white/10">
                    Get started
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="relative z-10 pt-36 pb-20 lg:pt-44 lg:pb-32">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              {/* Left content */}
              <div className="text-left">
                <div className="inline-flex items-center gap-2 glass-subtle px-4 py-2 rounded-full mb-6 border border-white/10">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-xs text-gray-300">Now with GPT-4 powered AI</span>
                  <ArrowRight size={12} className="text-gray-500" />
                </div>

                <h1 className="text-4xl lg:text-6xl font-bold leading-[1.1] mb-6">
                  The workspace
                  <br />
                  <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-gradient">
                    that works for you
                  </span>
                </h1>

                <p className="text-lg text-gray-400 mb-8 max-w-lg leading-relaxed">
                  Email, docs, meetings, and calendar—unified with AI that actually helps.
                  Stop paying for 5 different tools. Start getting things done.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 mb-8">
                  <Link href="/login?mode=signup" className="group inline-flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-3.5 rounded-xl font-semibold transition-all hover:shadow-lg hover:shadow-purple-500/25 hover:scale-[1.02]">
                    Start free trial
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <a href="#demo" className="inline-flex items-center justify-center gap-2 glass px-6 py-3.5 rounded-xl font-semibold hover:bg-white/10 transition-all border border-white/10">
                    <Play size={18} />
                    Watch demo
                  </a>
                </div>

                <div className="flex flex-wrap items-center gap-6 text-sm text-gray-500">
                  <span className="flex items-center gap-2">
                    <Check size={16} className="text-green-400" />
                    14-day free trial
                  </span>
                  <span className="flex items-center gap-2">
                    <Check size={16} className="text-green-400" />
                    No credit card
                  </span>
                  <span className="flex items-center gap-2">
                    <Check size={16} className="text-green-400" />
                    Cancel anytime
                  </span>
                </div>
              </div>

              {/* Right content - Dashboard Preview with Glassmorphism */}
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-3xl blur-2xl animate-pulse-slow" />
                <div className="relative glass rounded-2xl border border-white/10 p-1.5 shadow-2xl">
                  {/* Browser bar */}
                  <div className="glass-subtle rounded-t-xl px-4 py-3 flex items-center gap-3 border-b border-white/5">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500/80" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                      <div className="w-3 h-3 rounded-full bg-green-500/80" />
                    </div>
                    <div className="flex-1 bg-white/5 rounded-lg px-3 py-1.5 text-xs text-gray-500">
                      workspace.bheem.cloud
                    </div>
                  </div>

                  {/* Dashboard content */}
                  <div className="p-4 space-y-3">
                    <div className="flex gap-3">
                      <div className="w-12 glass-subtle rounded-lg p-2 space-y-2">
                        <div className="w-6 h-6 bg-blue-500/30 rounded animate-pulse" />
                        <div className="w-6 h-6 bg-green-500/30 rounded animate-pulse animation-delay-500" />
                        <div className="w-6 h-6 bg-purple-500/30 rounded animate-pulse animation-delay-1000" />
                        <div className="w-6 h-6 bg-yellow-500/30 rounded animate-pulse animation-delay-1500" />
                      </div>
                      <div className="flex-1 space-y-3">
                        <div className="h-6 bg-gradient-to-r from-purple-500/30 to-pink-500/30 rounded-lg w-1/2 animate-shimmer" />
                        <div className="grid grid-cols-3 gap-2">
                          <div className="h-20 glass-subtle rounded-lg border border-blue-500/20 p-2 hover:border-blue-500/40 transition-colors">
                            <div className="w-4 h-4 bg-blue-500/40 rounded mb-1" />
                            <div className="h-2 bg-white/10 rounded w-3/4" />
                          </div>
                          <div className="h-20 glass-subtle rounded-lg border border-green-500/20 p-2 hover:border-green-500/40 transition-colors">
                            <div className="w-4 h-4 bg-green-500/40 rounded mb-1" />
                            <div className="h-2 bg-white/10 rounded w-2/3" />
                          </div>
                          <div className="h-20 glass-subtle rounded-lg border border-purple-500/20 p-2 hover:border-purple-500/40 transition-colors">
                            <div className="w-4 h-4 bg-purple-500/40 rounded mb-1" />
                            <div className="h-2 bg-white/10 rounded w-4/5" />
                          </div>
                        </div>
                        <div className="h-24 glass-subtle rounded-lg" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating cards with glassmorphism */}
                <div className="absolute -bottom-6 -left-6 glass rounded-xl p-3 border border-white/10 shadow-xl animate-float">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500/30 to-green-500/10 flex items-center justify-center backdrop-blur-sm">
                      <TrendingUp size={18} className="text-green-400" />
                    </div>
                    <div>
                      <div className="text-green-400 font-bold text-sm">+47%</div>
                      <div className="text-gray-500 text-xs">Productivity</div>
                    </div>
                  </div>
                </div>

                <div className="absolute -top-4 -right-4 glass rounded-xl p-3 border border-white/10 shadow-xl animate-float animation-delay-1000">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/30 to-purple-500/10 flex items-center justify-center backdrop-blur-sm">
                      <Sparkles size={18} className="text-purple-400" />
                    </div>
                    <div>
                      <div className="text-white font-bold text-sm">AI Ready</div>
                      <div className="text-gray-500 text-xs">Always on</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section - Glassmorphism */}
        <section className="relative z-10 py-16">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="glass rounded-3xl border border-white/10 p-8 lg:p-12">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                {stats.map((stat, index) => (
                  <div key={index} className="text-center group">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 mb-4 group-hover:scale-110 transition-transform">
                      <stat.icon size={24} className="text-purple-400" />
                    </div>
                    <div className="text-3xl lg:text-4xl font-bold mb-1 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">{stat.value}</div>
                    <div className="text-sm text-gray-500">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="relative z-10 py-24">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            {/* Section header - left aligned */}
            <div className="max-w-2xl mb-16">
              <div className="inline-flex items-center gap-2 glass-subtle px-3 py-1.5 rounded-full mb-4 border border-purple-500/20">
                <Cpu size={14} className="text-purple-400" />
                <span className="text-xs text-purple-400 font-medium">Features</span>
              </div>
              <h2 className="text-3xl lg:text-4xl font-bold mb-4">
                Everything your team needs,
                <span className="text-gray-500"> nothing it doesn't</span>
              </h2>
              <p className="text-gray-400 text-lg">
                One platform for email, documents, meetings, and automation. AI built-in, not bolted on.
              </p>
            </div>

            {/* Features grid with glassmorphism cards */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="group glass rounded-2xl border border-white/5 p-6 hover:border-white/20 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/5 hover:-translate-y-1"
                >
                  <div
                    className={`w-14 h-14 rounded-xl ${feature.bg} backdrop-blur-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 border border-white/10`}
                  >
                    <feature.icon size={28} style={{ color: feature.color }} />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* AI Section - Left/Right Layout */}
        <section className="relative z-10 py-24">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="glass rounded-3xl border border-white/10 p-8 lg:p-16 overflow-hidden relative">
              {/* Background glow */}
              <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-purple-500/20 rounded-full blur-[100px]" />
              <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-pink-500/20 rounded-full blur-[100px]" />

              <div className="relative grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
                {/* Left content */}
                <div>
                  <div className="inline-flex items-center gap-2 glass-subtle px-3 py-1.5 rounded-full mb-4 border border-white/10">
                    <Sparkles size={14} className="text-purple-400" />
                    <span className="text-xs font-medium">AI-Powered</span>
                  </div>

                  <h2 className="text-3xl lg:text-4xl font-bold mb-6">
                    AI that works
                    <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent"> for you</span>
                  </h2>

                  <p className="text-gray-400 text-lg mb-8 leading-relaxed">
                    Not a $30/user add-on. AI is included in every plan—writing assistance,
                    meeting transcription, smart summaries, and more.
                  </p>

                  <div className="space-y-4">
                    {[
                      'Write emails and documents 3x faster',
                      'Automatic meeting transcription & notes',
                      'Smart inbox prioritization',
                      'Instant document summaries'
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3 group">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Check size={14} />
                        </div>
                        <span className="text-gray-300">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right content - AI Demo */}
                <div className="relative">
                  <div className="glass rounded-2xl border border-white/10 p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/25">
                        <Bot size={24} />
                      </div>
                      <div>
                        <div className="font-semibold">Bheem AI</div>
                        <div className="text-xs text-gray-500">Assistant</div>
                      </div>
                      <div className="ml-auto flex gap-1">
                        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                        <span className="text-xs text-gray-500">Online</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="glass-subtle rounded-xl p-4 border border-white/5">
                        <p className="text-sm text-gray-400">Summarize my meeting with the design team</p>
                      </div>
                      <div className="glass rounded-xl p-4 border border-purple-500/30 bg-purple-500/5">
                        <p className="text-sm leading-relaxed">
                          <span className="text-purple-400 font-medium">Key decisions:</span> New dashboard design approved,
                          launch date set for Q2.
                          <br /><br />
                          <span className="text-purple-400 font-medium">Action items:</span> Sarah to finalize mockups by Friday,
                          Dev team to start implementation Monday.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Security Section - Right/Left Layout */}
        <section className="relative z-10 py-24">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              {/* Left - Visual */}
              <div className="order-2 lg:order-1">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { icon: Shield, label: 'AES-256', sub: 'Encryption', color: 'green' },
                    { icon: Lock, label: 'SOC 2', sub: 'Compliant', color: 'blue' },
                    { icon: Globe, label: 'GDPR', sub: 'Ready', color: 'purple' },
                    { icon: BarChart3, label: '99.9%', sub: 'Uptime', color: 'orange' },
                  ].map((item, i) => (
                    <div key={i} className="glass rounded-2xl border border-white/10 p-6 hover:border-white/20 transition-all hover:-translate-y-1 group">
                      <item.icon size={32} className={`text-${item.color}-400 mb-4 group-hover:scale-110 transition-transform`} />
                      <div className="text-2xl font-bold mb-1">{item.label}</div>
                      <div className="text-sm text-gray-500">{item.sub}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right content */}
              <div className="order-1 lg:order-2">
                <div className="inline-flex items-center gap-2 glass-subtle px-3 py-1.5 rounded-full mb-4 border border-green-500/20">
                  <Shield size={14} className="text-green-400" />
                  <span className="text-xs text-green-400 font-medium">Enterprise Security</span>
                </div>

                <h2 className="text-3xl lg:text-4xl font-bold mb-6">
                  Security you can
                  <span className="text-gray-500"> trust</span>
                </h2>

                <p className="text-gray-400 text-lg mb-8 leading-relaxed">
                  Your data is protected with enterprise-grade security. We're SOC 2 compliant,
                  GDPR ready, and offer self-hosting for complete control.
                </p>

                <div className="space-y-4">
                  {[
                    'End-to-end encryption for all data',
                    'Regular third-party security audits',
                    'Self-hosted deployment option',
                    'Granular access controls & SSO'
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 group">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Check size={14} />
                      </div>
                      <span className="text-gray-300">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section id="testimonials" className="relative z-10 py-24">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="max-w-2xl mb-16">
              <div className="inline-flex items-center gap-2 glass-subtle px-3 py-1.5 rounded-full mb-4 border border-yellow-500/20">
                <Star size={14} className="text-yellow-400 fill-yellow-400" />
                <span className="text-xs text-yellow-400 font-medium">Testimonials</span>
              </div>
              <h2 className="text-3xl lg:text-4xl font-bold">
                Loved by teams
                <span className="text-gray-500"> worldwide</span>
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {testimonials.map((t, index) => (
                <div key={index} className="glass rounded-2xl border border-white/5 p-6 hover:border-white/20 transition-all hover:-translate-y-1">
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={16} className="text-yellow-400 fill-yellow-400" />
                    ))}
                  </div>
                  <p className="text-gray-300 mb-6 leading-relaxed">"{t.quote}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm font-bold shadow-lg shadow-purple-500/25">
                      {t.avatar}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{t.author}</div>
                      <div className="text-gray-500 text-xs">{t.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="relative z-10 py-24">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <div className="inline-flex items-center gap-2 glass-subtle px-3 py-1.5 rounded-full mb-4 border border-blue-500/20">
                <Zap size={14} className="text-blue-400" />
                <span className="text-xs text-blue-400 font-medium">Pricing</span>
              </div>
              <h2 className="text-3xl lg:text-4xl font-bold mb-4">
                Simple, transparent pricing
              </h2>
              <p className="text-gray-400 text-lg">
                AI included in every plan. No hidden fees. Cancel anytime.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {plans.map((plan, index) => (
                <div
                  key={index}
                  className={`relative glass rounded-2xl border p-6 transition-all hover:-translate-y-1 ${
                    plan.popular
                      ? 'border-purple-500/50 shadow-lg shadow-purple-500/10'
                      : 'border-white/5 hover:border-white/20'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-1 rounded-full text-xs font-semibold shadow-lg">
                      Most Popular
                    </div>
                  )}

                  <div className="mb-6">
                    <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                    <p className="text-sm text-gray-500">{plan.description}</p>
                  </div>

                  <div className="mb-6">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-gray-500 text-sm">{plan.period}</span>
                  </div>

                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {plan.isEnterprise ? (
                    <a
                      href="mailto:sales@bheem.cloud"
                      className="block w-full text-center py-3 rounded-xl font-medium glass border border-white/10 hover:bg-white/10 transition-all"
                    >
                      Contact sales
                    </a>
                  ) : (
                    <button
                      onClick={() => startCheckout(plan.id)}
                      disabled={loading === plan.id}
                      className={`w-full py-3 rounded-xl font-medium transition-all disabled:opacity-50 ${
                        plan.popular
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:shadow-lg hover:shadow-purple-500/25'
                          : 'glass border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {loading === plan.id ? 'Processing...' : 'Get started'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative z-10 py-24">
          <div className="max-w-4xl mx-auto px-6 lg:px-8">
            <div className="relative glass rounded-3xl border border-white/10 p-12 lg:p-16 text-center overflow-hidden">
              {/* Background effects */}
              <div className="absolute top-0 left-1/4 w-[300px] h-[300px] bg-purple-500/30 rounded-full blur-[100px]" />
              <div className="absolute bottom-0 right-1/4 w-[200px] h-[200px] bg-pink-500/30 rounded-full blur-[100px]" />

              <div className="relative">
                <h2 className="text-3xl lg:text-4xl font-bold mb-4">
                  Ready to transform how your team works?
                </h2>
                <p className="text-gray-400 text-lg mb-8 max-w-xl mx-auto">
                  Join thousands of teams who've already made the switch. Start your free trial today.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href="/login?mode=signup" className="group inline-flex items-center justify-center gap-2 bg-white text-gray-900 px-8 py-4 rounded-xl font-semibold hover:bg-gray-100 transition-all hover:shadow-lg">
                    Start free trial
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <a href="mailto:sales@bheem.cloud" className="inline-flex items-center justify-center px-8 py-4 rounded-xl font-semibold glass border border-white/10 hover:bg-white/10 transition-all">
                    Talk to sales
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="relative z-10 border-t border-white/5 py-12">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
              <div className="col-span-2">
                <Link href="/" className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">B</span>
                  </div>
                  <span className="text-lg font-bold">Bheem</span>
                </Link>
                <p className="text-gray-500 text-sm max-w-xs">
                  The all-in-one workspace for modern teams. Email, docs, meetings, and AI—together at last.
                </p>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-4">Product</h4>
                <ul className="space-y-2 text-sm text-gray-500">
                  <li><a href="/mail" className="hover:text-white transition-colors">Email</a></li>
                  <li><a href="/docs" className="hover:text-white transition-colors">Documents</a></li>
                  <li><a href="/meet" className="hover:text-white transition-colors">Meetings</a></li>
                  <li><a href="/calendar" className="hover:text-white transition-colors">Calendar</a></li>
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-4">Resources</h4>
                <ul className="space-y-2 text-sm text-gray-500">
                  <li><a href="https://academy.bheem.cloud" className="hover:text-white transition-colors">Academy</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">API</a></li>
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-4">Company</h4>
                <ul className="space-y-2 text-sm text-gray-500">
                  <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                  <li><a href="mailto:sales@bheem.cloud" className="hover:text-white transition-colors">Contact</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
                </ul>
              </div>
            </div>

            <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-gray-500 text-sm">© 2024 Bheem Cloud. All rights reserved.</p>
              <div className="flex gap-3">
                <span className="flex items-center gap-2 px-3 py-1.5 glass rounded-lg text-xs text-gray-400 border border-white/5">
                  <Shield size={12} />
                  SOC 2
                </span>
                <span className="flex items-center gap-2 px-3 py-1.5 glass rounded-lg text-xs text-gray-400 border border-white/5">
                  <Lock size={12} />
                  GDPR
                </span>
              </div>
            </div>
          </div>
        </footer>
      </div>

      <style jsx global>{`
        /* Glassmorphism utilities */
        .glass {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }

        .glass-subtle {
          background: rgba(255, 255, 255, 0.02);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }

        /* Animations */
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(20px, -30px) scale(1.1); }
          50% { transform: translate(-20px, 20px) scale(0.9); }
          75% { transform: translate(30px, 10px) scale(1.05); }
        }

        .animate-blob {
          animation: blob 20s ease-in-out infinite;
        }

        .animation-delay-2000 {
          animation-delay: 2s;
        }

        .animation-delay-4000 {
          animation-delay: 4s;
        }

        .animation-delay-500 {
          animation-delay: 0.5s;
        }

        .animation-delay-1000 {
          animation-delay: 1s;
        }

        .animation-delay-1500 {
          animation-delay: 1.5s;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }

        .animate-float {
          animation: float 4s ease-in-out infinite;
        }

        @keyframes float-particle {
          0%, 100% {
            transform: translate(0, 0) rotate(0deg);
            opacity: 0.2;
          }
          25% {
            transform: translate(10px, -20px) rotate(90deg);
            opacity: 0.5;
          }
          50% {
            transform: translate(-10px, -40px) rotate(180deg);
            opacity: 0.3;
          }
          75% {
            transform: translate(15px, -20px) rotate(270deg);
            opacity: 0.4;
          }
        }

        .animate-float-particle {
          animation: float-particle ease-in-out infinite;
        }

        @keyframes pulse-slow {
          0%, 100% { opacity: 0.15; transform: scale(1); }
          50% { opacity: 0.25; transform: scale(1.05); }
        }

        .animate-pulse-slow {
          animation: pulse-slow 8s ease-in-out infinite;
        }

        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease-in-out infinite;
        }

        @keyframes shimmer {
          0% { opacity: 0.3; }
          50% { opacity: 0.6; }
          100% { opacity: 0.3; }
        }

        .animate-shimmer {
          animation: shimmer 2s ease-in-out infinite;
        }

        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }

        .animate-slide-in {
          animation: slide-in 0.3s ease;
        }
      `}</style>
    </>
  );
}
