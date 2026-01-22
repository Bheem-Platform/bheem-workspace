import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Script from 'next/script';
import {
  Zap, Shield, Bot,
  Check, Star, ArrowRight, Play,
  Sparkles, Users,
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

// Bheem Brand Colors
const BHEEM_COLORS = {
  pink: '#FFCCF2',
  purple: '#977DFF',
  blue: '#0033FF',
  darkBlue: '#0600AB',
  deepBlue: '#00033D',
  lavender: '#F2E6EE',
};

// Bheem App Icons - Similar to Google's colorful icons
const BheemAppIcons = {
  Mail: ({ size = 24 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="5" fill="url(#mail-grad)" />
      <path d="M4 8L12 13L20 8" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <rect x="4" y="6" width="16" height="12" rx="2" stroke="white" strokeWidth="2" fill="none" />
      <defs>
        <linearGradient id="mail-grad" x1="0" y1="0" x2="24" y2="24">
          <stop stopColor="#FF6B6B" />
          <stop offset="1" stopColor="#EE5A5A" />
        </linearGradient>
      </defs>
    </svg>
  ),
  Docs: ({ size = 24 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="5" fill="url(#docs-grad)" />
      <path d="M8 8H16M8 12H16M8 16H13" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <defs>
        <linearGradient id="docs-grad" x1="0" y1="0" x2="24" y2="24">
          <stop stopColor="#0033FF" />
          <stop offset="1" stopColor="#0600AB" />
        </linearGradient>
      </defs>
    </svg>
  ),
  Meet: ({ size = 24 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="5" fill="url(#meet-grad)" />
      <rect x="6" y="7" width="8" height="10" rx="1" stroke="white" strokeWidth="2" />
      <path d="M14 10L18 7V17L14 14" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="meet-grad" x1="0" y1="0" x2="24" y2="24">
          <stop stopColor="#00C853" />
          <stop offset="1" stopColor="#00A843" />
        </linearGradient>
      </defs>
    </svg>
  ),
  Calendar: ({ size = 24 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="5" fill="url(#cal-grad)" />
      <rect x="5" y="6" width="14" height="13" rx="2" stroke="white" strokeWidth="2" />
      <path d="M5 10H19" stroke="white" strokeWidth="2" />
      <path d="M9 4V7M15 4V7" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <defs>
        <linearGradient id="cal-grad" x1="0" y1="0" x2="24" y2="24">
          <stop stopColor="#977DFF" />
          <stop offset="1" stopColor="#7B5FFF" />
        </linearGradient>
      </defs>
    </svg>
  ),
  Drive: ({ size = 24 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="5" fill="url(#drive-grad)" />
      <path d="M12 5L18 15H6L12 5Z" stroke="white" strokeWidth="2" strokeLinejoin="round" />
      <path d="M6 15L9 20H15L18 15" stroke="white" strokeWidth="2" strokeLinejoin="round" />
      <defs>
        <linearGradient id="drive-grad" x1="0" y1="0" x2="24" y2="24">
          <stop stopColor="#FFBC00" />
          <stop offset="0.5" stopColor="#00A843" />
          <stop offset="1" stopColor="#0033FF" />
        </linearGradient>
      </defs>
    </svg>
  ),
  Sheets: ({ size = 24 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="5" fill="url(#sheets-grad)" />
      <rect x="5" y="5" width="14" height="14" rx="2" stroke="white" strokeWidth="2" />
      <path d="M5 9H19M5 13H19M5 17H19M9 5V19M13 5V19" stroke="white" strokeWidth="1.5" />
      <defs>
        <linearGradient id="sheets-grad" x1="0" y1="0" x2="24" y2="24">
          <stop stopColor="#34A853" />
          <stop offset="1" stopColor="#1E8E3E" />
        </linearGradient>
      </defs>
    </svg>
  ),
  Slides: ({ size = 24 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="5" fill="url(#slides-grad)" />
      <rect x="5" y="6" width="14" height="10" rx="2" stroke="white" strokeWidth="2" />
      <path d="M12 19V16" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 19H16" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <defs>
        <linearGradient id="slides-grad" x1="0" y1="0" x2="24" y2="24">
          <stop stopColor="#FFBC00" />
          <stop offset="1" stopColor="#F9A825" />
        </linearGradient>
      </defs>
    </svg>
  ),
  Forms: ({ size = 24 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="5" fill="url(#forms-grad)" />
      <rect x="6" y="5" width="12" height="14" rx="2" stroke="white" strokeWidth="2" />
      <circle cx="9" cy="9" r="1.5" fill="white" />
      <path d="M12 9H15" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <circle cx="9" cy="13" r="1.5" fill="white" />
      <path d="M12 13H15" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <defs>
        <linearGradient id="forms-grad" x1="0" y1="0" x2="24" y2="24">
          <stop stopColor="#673AB7" />
          <stop offset="1" stopColor="#512DA8" />
        </linearGradient>
      </defs>
    </svg>
  ),
  Chat: ({ size = 24 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="5" fill="url(#chat-grad)" />
      <path d="M7 8H17M7 12H13" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <path d="M5 6C5 4.89543 5.89543 4 7 4H17C18.1046 4 19 4.89543 19 6V14C19 15.1046 18.1046 16 17 16H10L6 20V16H7C5.89543 16 5 15.1046 5 14V6Z" stroke="white" strokeWidth="2" />
      <defs>
        <linearGradient id="chat-grad" x1="0" y1="0" x2="24" y2="24">
          <stop stopColor="#00BCD4" />
          <stop offset="1" stopColor="#0097A7" />
        </linearGradient>
      </defs>
    </svg>
  ),
  AI: ({ size = 24 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="5" fill="url(#ai-grad)" />
      <circle cx="12" cy="12" r="4" stroke="white" strokeWidth="2" />
      <path d="M12 4V6M12 18V20M4 12H6M18 12H20M6.34 6.34L7.76 7.76M16.24 16.24L17.66 17.66M6.34 17.66L7.76 16.24M16.24 7.76L17.66 6.34" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <defs>
        <linearGradient id="ai-grad" x1="0" y1="0" x2="24" y2="24">
          <stop stopColor="#FFCCF2" />
          <stop offset="0.5" stopColor="#977DFF" />
          <stop offset="1" stopColor="#0033FF" />
        </linearGradient>
      </defs>
    </svg>
  ),
};

// Floating particles
const particles = [
  { size: 4, x: 10, y: 20, duration: 20, delay: 0 },
  { size: 6, x: 20, y: 60, duration: 25, delay: 2 },
  { size: 3, x: 80, y: 30, duration: 22, delay: 1 },
  { size: 5, x: 70, y: 70, duration: 28, delay: 3 },
  { size: 4, x: 90, y: 15, duration: 24, delay: 0.5 },
  { size: 7, x: 15, y: 85, duration: 26, delay: 1.5 },
  { size: 3, x: 50, y: 10, duration: 21, delay: 2.5 },
  { size: 5, x: 85, y: 55, duration: 23, delay: 4 },
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
        body: JSON.stringify({ plan_id: planId, billing_cycle: 'monthly' })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create checkout session');
      }
      const session: CheckoutResponse = await response.json();
      if (!window.Razorpay) throw new Error('Razorpay not loaded');
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
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature
              })
            });
            if (verifyResponse.ok) {
              showToast('Subscription activated successfully!', 'success');
              setTimeout(() => { window.location.href = '/dashboard'; }, 1500);
            } else throw new Error('Verification failed');
          } catch (err) {
            showToast('Payment verification failed. Please contact support.', 'error');
          }
        },
        prefill: { email: '' },
        theme: { color: BHEEM_COLORS.purple },
        modal: { ondismiss: function() { setLoading(null); showToast('Payment cancelled', 'info'); } }
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
    { Icon: BheemAppIcons.Mail, title: 'Bheem Mail', description: 'AI-powered inbox with smart replies, automatic sorting, and priority flagging.', color: '#FF6B6B' },
    { Icon: BheemAppIcons.Docs, title: 'Bheem Docs', description: 'Collaborative documents with real-time editing and AI writing assistance.', color: BHEEM_COLORS.blue },
    { Icon: BheemAppIcons.Meet, title: 'Bheem Meet', description: 'Crystal clear video calls with AI transcription and automatic meeting notes.', color: '#00C853' },
    { Icon: BheemAppIcons.Calendar, title: 'Bheem Calendar', description: 'Smart scheduling with conflict detection and timezone management.', color: BHEEM_COLORS.purple },
    { Icon: BheemAppIcons.Drive, title: 'Bheem Drive', description: 'Secure cloud storage with smart search and easy file sharing.', color: '#FFBC00' },
    { Icon: BheemAppIcons.AI, title: 'Bheem AI', description: 'Built-in AI assistant for writing, analysis, and productivity tasks.', color: BHEEM_COLORS.purple },
  ];

  const allApps = [
    { Icon: BheemAppIcons.Mail, name: 'Mail' },
    { Icon: BheemAppIcons.Docs, name: 'Docs' },
    { Icon: BheemAppIcons.Sheets, name: 'Sheets' },
    { Icon: BheemAppIcons.Slides, name: 'Slides' },
    { Icon: BheemAppIcons.Meet, name: 'Meet' },
    { Icon: BheemAppIcons.Calendar, name: 'Calendar' },
    { Icon: BheemAppIcons.Drive, name: 'Drive' },
    { Icon: BheemAppIcons.Forms, name: 'Forms' },
    { Icon: BheemAppIcons.Chat, name: 'Chat' },
    { Icon: BheemAppIcons.AI, name: 'AI' },
  ];

  const plans = [
    { id: 'WORKSPACE-STARTER', name: 'Starter', description: 'For small teams', price: '₹999', period: '/user/month', features: ['All Bheem Apps', '50 AI actions/month', '10 GB storage', 'Custom domain', 'Email support'], gradient: 'from-[#0033FF] to-[#0600AB]' },
    { id: 'WORKSPACE-PROFESSIONAL', name: 'Professional', description: 'For growing businesses', price: '₹2,499', period: '/user/month', features: ['Everything in Starter', 'Unlimited AI actions', '100 GB storage', 'Advanced analytics', 'Priority support'], popular: true, gradient: 'from-[#977DFF] to-[#0033FF]' },
    { id: 'WORKSPACE-ENTERPRISE', name: 'Enterprise', description: 'For large organizations', price: 'Custom', period: '', features: ['Everything in Pro', 'Unlimited storage', 'Self-hosted option', 'White-label', 'Dedicated support'], isEnterprise: true, gradient: 'from-[#FFCCF2] to-[#977DFF]' }
  ];

  const stats = [
    { value: '47%', label: 'Productivity boost', icon: TrendingUp },
    { value: '12hrs', label: 'Saved weekly', icon: Clock },
    { value: '10K+', label: 'Teams worldwide', icon: Users },
    { value: '99.9%', label: 'Uptime SLA', icon: Award },
  ];

  return (
    <>
      <Head>
        <title>Bheem Workspace | AI-Powered Productivity Suite</title>
        <meta name="description" content="Email, Docs, Meetings—all in one place with AI built-in. The modern workspace for productive teams." />
      </Head>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 px-6 py-4 rounded-2xl text-white font-medium shadow-2xl animate-slide-in ${
          toast.type === 'error' ? 'bg-red-500' : toast.type === 'success' ? 'bg-green-500' : 'bg-[#977DFF]'
        }`}>
          {toast.message}
        </div>
      )}

      <div className="min-h-screen bg-[#00033D] text-white overflow-hidden">
        {/* Animated Background with Bheem Colors */}
        <div className="fixed inset-0 z-0">
          <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-[#977DFF]/30 rounded-full blur-[120px] animate-blob" />
          <div className="absolute top-[20%] right-[-10%] w-[500px] h-[500px] bg-[#0033FF]/25 rounded-full blur-[120px] animate-blob animation-delay-2000" />
          <div className="absolute bottom-[-10%] left-[30%] w-[550px] h-[550px] bg-[#FFCCF2]/20 rounded-full blur-[120px] animate-blob animation-delay-4000" />
          <div className="absolute top-[50%] left-[50%] w-[400px] h-[400px] bg-[#0600AB]/30 rounded-full blur-[100px] animate-pulse-slow" />

          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: `linear-gradient(rgba(151,125,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(151,125,255,0.2) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }} />

          {mounted && particles.map((p, i) => (
            <div key={i} className="absolute rounded-full bg-[#977DFF]/30 animate-float-particle"
              style={{ width: p.size, height: p.size, left: `${p.x}%`, top: `${p.y}%`, animationDuration: `${p.duration}s`, animationDelay: `${p.delay}s` }} />
          ))}

          {mounted && (
            <div className="pointer-events-none absolute w-[600px] h-[600px] rounded-full opacity-20 transition-all duration-300 ease-out"
              style={{ background: 'radial-gradient(circle, rgba(151,125,255,0.4) 0%, transparent 70%)', left: mousePosition.x - 300, top: mousePosition.y - 300 }} />
          )}
        </div>

        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50">
          <div className="mx-4 mt-4">
            <div className="max-w-7xl mx-auto glass rounded-2xl border border-[#977DFF]/20">
              <div className="px-6 flex justify-between items-center h-16">
                <Link href="/" className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#FFCCF2] via-[#977DFF] to-[#0033FF] rounded-xl flex items-center justify-center shadow-lg shadow-[#977DFF]/30">
                    <span className="text-white font-black text-lg">B</span>
                  </div>
                  <span className="text-xl font-bold bg-gradient-to-r from-white to-[#977DFF] bg-clip-text text-transparent">Bheem</span>
                </Link>

                <div className="hidden md:flex items-center gap-1">
                  <a href="#apps" className="text-sm text-gray-400 hover:text-white px-4 py-2 rounded-lg hover:bg-white/5 transition-all">Apps</a>
                  <a href="#features" className="text-sm text-gray-400 hover:text-white px-4 py-2 rounded-lg hover:bg-white/5 transition-all">Features</a>
                  <a href="#pricing" className="text-sm text-gray-400 hover:text-white px-4 py-2 rounded-lg hover:bg-white/5 transition-all">Pricing</a>
                </div>

                <div className="flex items-center gap-3">
                  <Link href="/login" className="text-sm text-gray-400 hover:text-white px-4 py-2 transition-colors">Sign in</Link>
                  <Link href="/login?mode=signup" className="text-sm bg-gradient-to-r from-[#977DFF] to-[#0033FF] px-5 py-2.5 rounded-xl font-medium hover:shadow-lg hover:shadow-[#977DFF]/30 transition-all">
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
            <div className="text-center max-w-4xl mx-auto">
              <div className="inline-flex items-center gap-2 glass px-4 py-2 rounded-full mb-6 border border-[#977DFF]/30">
                <span className="w-2 h-2 bg-[#FFCCF2] rounded-full animate-pulse" />
                <span className="text-xs text-[#FFCCF2]">Powered by AI</span>
                <ArrowRight size={12} className="text-[#977DFF]" />
              </div>

              <h1 className="text-5xl lg:text-7xl font-bold leading-[1.1] mb-6">
                Your complete
                <br />
                <span className="bg-gradient-to-r from-[#FFCCF2] via-[#977DFF] to-[#0033FF] bg-clip-text text-transparent animate-gradient">
                  workspace suite
                </span>
              </h1>

              <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
                Mail, Docs, Meet, Calendar, Drive, and more—all powered by AI.
                One platform, one price, unlimited productivity.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                <Link href="/login?mode=signup" className="group inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#977DFF] to-[#0033FF] px-8 py-4 rounded-xl font-semibold text-lg transition-all hover:shadow-xl hover:shadow-[#977DFF]/30 hover:scale-[1.02]">
                  Start free trial
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </Link>
                <a href="#demo" className="inline-flex items-center justify-center gap-2 glass px-8 py-4 rounded-xl font-semibold text-lg border border-[#977DFF]/30 hover:bg-[#977DFF]/10 transition-all">
                  <Play size={20} />
                  Watch demo
                </a>
              </div>

              {/* App Icons Grid */}
              <div id="apps" className="flex flex-wrap justify-center gap-4 mb-8">
                {allApps.map((app, i) => (
                  <div key={i} className="group flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-white/5 transition-all cursor-pointer">
                    <div className="transform group-hover:scale-110 transition-transform">
                      <app.Icon size={48} />
                    </div>
                    <span className="text-xs text-gray-400 group-hover:text-white transition-colors">{app.name}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap justify-center items-center gap-6 text-sm text-gray-500">
                <span className="flex items-center gap-2"><Check size={16} className="text-[#FFCCF2]" />14-day free trial</span>
                <span className="flex items-center gap-2"><Check size={16} className="text-[#FFCCF2]" />No credit card</span>
                <span className="flex items-center gap-2"><Check size={16} className="text-[#FFCCF2]" />Cancel anytime</span>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="relative z-10 py-16">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="glass rounded-3xl border border-[#977DFF]/20 p-8 lg:p-12">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                {stats.map((stat, i) => (
                  <div key={i} className="text-center group">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-[#977DFF]/20 to-[#0033FF]/20 mb-4 group-hover:scale-110 transition-transform">
                      <stat.icon size={24} className="text-[#977DFF]" />
                    </div>
                    <div className="text-3xl lg:text-4xl font-bold mb-1 bg-gradient-to-r from-white to-[#977DFF] bg-clip-text text-transparent">{stat.value}</div>
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
            <div className="max-w-2xl mb-16">
              <div className="inline-flex items-center gap-2 glass px-3 py-1.5 rounded-full mb-4 border border-[#977DFF]/30">
                <Cpu size={14} className="text-[#977DFF]" />
                <span className="text-xs text-[#977DFF] font-medium">Features</span>
              </div>
              <h2 className="text-3xl lg:text-4xl font-bold mb-4">
                Everything your team needs,
                <span className="text-gray-500"> nothing it doesn't</span>
              </h2>
              <p className="text-gray-400 text-lg">
                One platform for email, documents, meetings, and automation. AI built-in, not bolted on.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, i) => (
                <div key={i} className="group glass rounded-2xl border border-[#977DFF]/10 p-6 hover:border-[#977DFF]/40 transition-all duration-300 hover:shadow-lg hover:shadow-[#977DFF]/10 hover:-translate-y-1">
                  <div className="mb-4 transform group-hover:scale-110 transition-transform duration-300">
                    <feature.Icon size={56} />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* AI Section */}
        <section className="relative z-10 py-24">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="glass rounded-3xl border border-[#977DFF]/20 p-8 lg:p-16 overflow-hidden relative">
              <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#977DFF]/20 rounded-full blur-[100px]" />
              <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-[#FFCCF2]/20 rounded-full blur-[100px]" />

              <div className="relative grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 glass px-3 py-1.5 rounded-full mb-4 border border-[#FFCCF2]/30">
                    <Sparkles size={14} className="text-[#FFCCF2]" />
                    <span className="text-xs text-[#FFCCF2] font-medium">AI-Powered</span>
                  </div>
                  <h2 className="text-3xl lg:text-4xl font-bold mb-6">
                    AI that works
                    <span className="bg-gradient-to-r from-[#FFCCF2] to-[#977DFF] bg-clip-text text-transparent"> for you</span>
                  </h2>
                  <p className="text-gray-400 text-lg mb-8 leading-relaxed">
                    Not a $30/user add-on. AI is included in every plan—writing assistance,
                    meeting transcription, smart summaries, and more.
                  </p>
                  <div className="space-y-4">
                    {['Write emails 3x faster', 'Auto meeting transcription', 'Smart inbox prioritization', 'Instant document summaries'].map((item, i) => (
                      <div key={i} className="flex items-center gap-3 group">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[#FFCCF2] to-[#977DFF] flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Check size={14} />
                        </div>
                        <span className="text-gray-300">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="relative">
                  <div className="glass rounded-2xl border border-[#977DFF]/30 p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <BheemAppIcons.AI size={48} />
                      <div>
                        <div className="font-semibold">Bheem AI</div>
                        <div className="text-xs text-gray-500">Assistant</div>
                      </div>
                      <div className="ml-auto flex gap-1 items-center">
                        <div className="w-2 h-2 rounded-full bg-[#FFCCF2] animate-pulse" />
                        <span className="text-xs text-gray-500">Online</span>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="glass rounded-xl p-4 border border-white/5">
                        <p className="text-sm text-gray-400">Summarize my meeting with the design team</p>
                      </div>
                      <div className="glass rounded-xl p-4 border border-[#977DFF]/30 bg-[#977DFF]/5">
                        <p className="text-sm leading-relaxed">
                          <span className="text-[#FFCCF2] font-medium">Key decisions:</span> New dashboard approved, launch Q2.
                          <br /><br />
                          <span className="text-[#FFCCF2] font-medium">Action items:</span> Sarah finalizes mockups Friday, Dev starts Monday.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Security Section */}
        <section className="relative z-10 py-24">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              <div className="order-2 lg:order-1">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { icon: Shield, label: 'AES-256', sub: 'Encryption', color: '#00C853' },
                    { icon: Lock, label: 'SOC 2', sub: 'Compliant', color: '#0033FF' },
                    { icon: Globe, label: 'GDPR', sub: 'Ready', color: '#977DFF' },
                    { icon: BarChart3, label: '99.9%', sub: 'Uptime', color: '#FFCCF2' },
                  ].map((item, i) => (
                    <div key={i} className="glass rounded-2xl border border-[#977DFF]/10 p-6 hover:border-[#977DFF]/40 transition-all hover:-translate-y-1 group">
                      <item.icon size={32} style={{ color: item.color }} className="mb-4 group-hover:scale-110 transition-transform" />
                      <div className="text-2xl font-bold mb-1">{item.label}</div>
                      <div className="text-sm text-gray-500">{item.sub}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="order-1 lg:order-2">
                <div className="inline-flex items-center gap-2 glass px-3 py-1.5 rounded-full mb-4 border border-green-500/30">
                  <Shield size={14} className="text-green-400" />
                  <span className="text-xs text-green-400 font-medium">Enterprise Security</span>
                </div>
                <h2 className="text-3xl lg:text-4xl font-bold mb-6">
                  Security you can<span className="text-gray-500"> trust</span>
                </h2>
                <p className="text-gray-400 text-lg mb-8 leading-relaxed">
                  Your data is protected with enterprise-grade security. SOC 2 compliant, GDPR ready, with self-hosting option.
                </p>
                <div className="space-y-4">
                  {['End-to-end encryption', 'Regular security audits', 'Self-hosted deployment', 'Granular access controls'].map((item, i) => (
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

        {/* Pricing Section */}
        <section id="pricing" className="relative z-10 py-24">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <div className="inline-flex items-center gap-2 glass px-3 py-1.5 rounded-full mb-4 border border-[#0033FF]/30">
                <Zap size={14} className="text-[#0033FF]" />
                <span className="text-xs text-[#0033FF] font-medium">Pricing</span>
              </div>
              <h2 className="text-3xl lg:text-4xl font-bold mb-4">Simple, transparent pricing</h2>
              <p className="text-gray-400 text-lg">AI included in every plan. No hidden fees.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {plans.map((plan, i) => (
                <div key={i} className={`relative glass rounded-2xl border p-6 transition-all hover:-translate-y-1 ${
                  plan.popular ? 'border-[#977DFF]/50 shadow-lg shadow-[#977DFF]/20' : 'border-[#977DFF]/10 hover:border-[#977DFF]/30'
                }`}>
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#977DFF] to-[#0033FF] px-4 py-1 rounded-full text-xs font-semibold shadow-lg">
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
                    {plan.features.map((feature, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 size={16} className="text-[#FFCCF2] mt-0.5 flex-shrink-0" />
                        <span className="text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  {plan.isEnterprise ? (
                    <a href="mailto:sales@bheem.cloud" className="block w-full text-center py-3 rounded-xl font-medium glass border border-[#977DFF]/30 hover:bg-[#977DFF]/10 transition-all">
                      Contact sales
                    </a>
                  ) : (
                    <button onClick={() => startCheckout(plan.id)} disabled={loading === plan.id}
                      className={`w-full py-3 rounded-xl font-medium transition-all disabled:opacity-50 ${
                        plan.popular ? 'bg-gradient-to-r from-[#977DFF] to-[#0033FF] hover:shadow-lg hover:shadow-[#977DFF]/30' : 'glass border border-[#977DFF]/30 hover:bg-[#977DFF]/10'
                      }`}>
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
            <div className="relative glass rounded-3xl border border-[#977DFF]/20 p-12 lg:p-16 text-center overflow-hidden">
              <div className="absolute top-0 left-1/4 w-[300px] h-[300px] bg-[#977DFF]/30 rounded-full blur-[100px]" />
              <div className="absolute bottom-0 right-1/4 w-[200px] h-[200px] bg-[#FFCCF2]/30 rounded-full blur-[100px]" />
              <div className="relative">
                <h2 className="text-3xl lg:text-4xl font-bold mb-4">Ready to transform your workflow?</h2>
                <p className="text-gray-400 text-lg mb-8 max-w-xl mx-auto">Join thousands of teams already using Bheem. Start your free trial today.</p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href="/login?mode=signup" className="group inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#FFCCF2] via-[#977DFF] to-[#0033FF] text-white px-8 py-4 rounded-xl font-semibold hover:shadow-lg hover:shadow-[#977DFF]/30 transition-all">
                    Start free trial
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <a href="mailto:sales@bheem.cloud" className="inline-flex items-center justify-center px-8 py-4 rounded-xl font-semibold glass border border-[#977DFF]/30 hover:bg-[#977DFF]/10 transition-all">
                    Talk to sales
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="relative z-10 border-t border-[#977DFF]/10 py-12">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
              <div className="col-span-2">
                <Link href="/" className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#FFCCF2] via-[#977DFF] to-[#0033FF] rounded-xl flex items-center justify-center">
                    <span className="text-white font-black">B</span>
                  </div>
                  <span className="text-xl font-bold">Bheem</span>
                </Link>
                <p className="text-gray-500 text-sm max-w-xs">The all-in-one workspace for modern teams. Email, docs, meetings, and AI—together at last.</p>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-4">Apps</h4>
                <ul className="space-y-2 text-sm text-gray-500">
                  <li><a href="/mail" className="hover:text-[#977DFF] transition-colors">Mail</a></li>
                  <li><a href="/docs" className="hover:text-[#977DFF] transition-colors">Docs</a></li>
                  <li><a href="/meet" className="hover:text-[#977DFF] transition-colors">Meet</a></li>
                  <li><a href="/calendar" className="hover:text-[#977DFF] transition-colors">Calendar</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-4">Resources</h4>
                <ul className="space-y-2 text-sm text-gray-500">
                  <li><a href="#" className="hover:text-[#977DFF] transition-colors">Academy</a></li>
                  <li><a href="#" className="hover:text-[#977DFF] transition-colors">Documentation</a></li>
                  <li><a href="#" className="hover:text-[#977DFF] transition-colors">API</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-4">Company</h4>
                <ul className="space-y-2 text-sm text-gray-500">
                  <li><a href="#" className="hover:text-[#977DFF] transition-colors">About</a></li>
                  <li><a href="mailto:sales@bheem.cloud" className="hover:text-[#977DFF] transition-colors">Contact</a></li>
                  <li><a href="#" className="hover:text-[#977DFF] transition-colors">Privacy</a></li>
                </ul>
              </div>
            </div>
            <div className="pt-8 border-t border-[#977DFF]/10 flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-gray-500 text-sm">© 2024 Bheem Cloud. All rights reserved.</p>
              <div className="flex gap-3">
                <span className="flex items-center gap-2 px-3 py-1.5 glass rounded-lg text-xs text-gray-400 border border-[#977DFF]/10">
                  <Shield size={12} />SOC 2
                </span>
                <span className="flex items-center gap-2 px-3 py-1.5 glass rounded-lg text-xs text-gray-400 border border-[#977DFF]/10">
                  <Lock size={12} />GDPR
                </span>
              </div>
            </div>
          </div>
        </footer>
      </div>

      <style jsx global>{`
        .glass { background: rgba(151, 125, 255, 0.03); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }
        @keyframes blob { 0%, 100% { transform: translate(0, 0) scale(1); } 25% { transform: translate(20px, -30px) scale(1.1); } 50% { transform: translate(-20px, 20px) scale(0.9); } 75% { transform: translate(30px, 10px) scale(1.05); } }
        .animate-blob { animation: blob 20s ease-in-out infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
        @keyframes float-particle { 0%, 100% { transform: translate(0, 0); opacity: 0.2; } 50% { transform: translate(-10px, -30px); opacity: 0.5; } }
        .animate-float-particle { animation: float-particle ease-in-out infinite; }
        @keyframes pulse-slow { 0%, 100% { opacity: 0.15; } 50% { opacity: 0.3; } }
        .animate-pulse-slow { animation: pulse-slow 8s ease-in-out infinite; }
        @keyframes gradient { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        .animate-gradient { background-size: 200% 200%; animation: gradient 3s ease-in-out infinite; }
        @keyframes slide-in { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .animate-slide-in { animation: slide-in 0.3s ease; }
      `}</style>
    </>
  );
}
