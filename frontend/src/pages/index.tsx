import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Script from 'next/script';
import {
  Zap, Mail, FileText, Video, Shield, Bot,
  Check, X, Star, ArrowRight, Play, ChevronRight
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

export default function LandingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const startCheckout = async (planId: string) => {
    setLoading(planId);

    try {
      // Get auth token from localStorage
      const authToken = localStorage.getItem('auth_token');

      if (!authToken) {
        // Store selected plan and redirect to login
        sessionStorage.setItem('pending_plan', planId);
        window.location.href = '/login?redirect=/&plan=' + planId;
        return;
      }

      // Create checkout session
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

      // Initialize Razorpay
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
          // Payment successful - verify on backend
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
        prefill: {
          email: '',
        },
        theme: {
          color: '#2563eb'
        },
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
      console.error('Checkout error:', error);
    }
  };

  // Check for pending plan on mount
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
      title: 'Professional Email',
      description: 'Your domain, your email. AI writes replies in your tone, sorts your inbox, and flags what matters.',
      benefit: '2x faster email responses',
      gradient: 'from-orange-500 to-orange-600'
    },
    {
      icon: FileText,
      title: 'Smart Documents',
      description: 'Write, edit, and collaborate in real-time. AI helps draft, summarize, and format your docs.',
      benefit: 'Cut writing time by 50%',
      gradient: 'from-green-500 to-green-600'
    },
    {
      icon: Video,
      title: 'HD Video Meetings',
      description: 'Crystal clear calls with up to 500 people. AI transcribes, summarizes, and creates action items.',
      benefit: 'Never miss meeting notes again',
      gradient: 'from-blue-500 to-blue-600'
    },
    {
      icon: Zap,
      title: 'Workflow Automation',
      description: 'Connect everything with Bheem Flow. When a meeting ends, docs update, emails send—automatically.',
      benefit: 'Eliminate repetitive tasks',
      gradient: 'from-purple-500 to-purple-600'
    },
    {
      icon: Bot,
      title: 'AI Built-In',
      description: 'Not a $30/user add-on. AI is included in every plan—writing, transcription, summaries, and more.',
      benefit: 'Save $360/user/year vs competitors',
      gradient: 'from-pink-500 to-pink-600'
    },
    {
      icon: Shield,
      title: 'Enterprise Security',
      description: 'AES-256 encryption, SOC 2 compliance, and DRM protection for recordings. Self-host option available.',
      benefit: '100% data ownership',
      gradient: 'from-cyan-500 to-cyan-600'
    }
  ];

  const testimonials = [
    {
      text: "We switched from Google Workspace and saved over $15,000/year. The AI features alone are worth it—my team spends 50% less time on emails now.",
      author: "Sarah Kim",
      role: "CEO, TechStart Inc.",
      initials: "SK"
    },
    {
      text: "The meeting transcription is a game-changer. I used to spend an hour after each call writing notes. Now Bheem does it automatically.",
      author: "Marcus Rodriguez",
      role: "Product Lead, ScaleUp",
      initials: "MR"
    },
    {
      text: "Finally, one tool instead of five. We cancelled Zoom, Notion, Gmail, and Slack. Bheem does it all—and the AI is actually useful.",
      author: "Jennifer Lee",
      role: "Operations Director, GlobalCo",
      initials: "JL"
    }
  ];

  const comparison = [
    { feature: 'AI writing & summaries', bheem: true, google: 'Limited', microsoft: '+$30/user' },
    { feature: 'Meeting transcription', bheem: true, google: 'Add-on', microsoft: 'Premium only' },
    { feature: 'Workflow automation', bheem: true, google: false, microsoft: 'Power Auto' },
    { feature: 'Self-host option', bheem: true, google: false, microsoft: false },
    { feature: 'White-label available', bheem: true, google: false, microsoft: false },
  ];

  const plans = [
    {
      id: 'WORKSPACE-STARTER',
      name: 'Starter',
      description: 'For small teams getting started',
      price: '₹999',
      period: '/user/month',
      features: ['Email, Docs, Meetings', '50 AI actions/month', '10 GB storage/user', 'Custom domain'],
      popular: false
    },
    {
      id: 'WORKSPACE-PROFESSIONAL',
      name: 'Professional',
      description: 'For growing teams',
      price: '₹2,499',
      period: '/user/month',
      features: ['Everything in Starter', 'Unlimited AI actions', '100 GB storage/user', 'Bheem Flow automation', 'Priority support'],
      popular: true
    },
    {
      id: 'WORKSPACE-ENTERPRISE',
      name: 'Enterprise',
      description: 'For large organizations',
      price: 'Custom',
      period: '',
      features: ['Everything in Professional', 'Self-hosted option', 'White-label branding', 'Dedicated support', 'SLA guarantee'],
      popular: false,
      isEnterprise: true
    }
  ];

  return (
    <>
      <Head>
        <title>Bheem Workspace | Where Teams Get More Done</title>
        <meta name="description" content="Email, Docs, Meetings—all in one place with AI built-in. Stop juggling 5 different tools." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-6 py-4 rounded-lg text-white font-medium shadow-lg animate-slide-in ${
            toast.type === 'error' ? 'bg-red-500' : toast.type === 'success' ? 'bg-green-500' : 'bg-blue-500'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="min-h-screen bg-white">
        {/* Top Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white text-center py-3 px-4 text-sm font-medium">
          🎉 Limited Time: Get 3 months free when you switch from Google or Microsoft.{' '}
          <a href="#pricing" className="underline font-bold hover:no-underline">Claim offer →</a>
        </div>

        {/* Navigation */}
        <nav className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-200 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <Link href="/" className="flex items-center gap-2 font-bold text-xl text-gray-900">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">B</span>
                </div>
                Bheem
              </Link>

              <div className="hidden md:flex items-center gap-8">
                <a href="#features" className="text-gray-600 hover:text-gray-900 font-medium">Features</a>
                <a href="#testimonials" className="text-gray-600 hover:text-gray-900 font-medium">Customers</a>
                <a href="#pricing" className="text-gray-600 hover:text-gray-900 font-medium">Pricing</a>
                <a href="https://academy.bheem.cloud" className="text-gray-600 hover:text-gray-900 font-medium">Academy</a>
              </div>

              <div className="flex items-center gap-3">
                <Link href="/login" className="text-gray-600 hover:text-gray-900 font-medium px-4 py-2">
                  Sign in
                </Link>
                <Link href="/login" className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors">
                  Start free trial
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="py-20 lg:py-28 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              <div>
                <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded-full text-sm font-semibold mb-6">
                  <Zap size={16} />
                  AI-Powered Workspace
                </div>

                <h1 className="text-4xl lg:text-5xl xl:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
                  Email. Docs. Meetings.
                  <br />
                  <span className="text-blue-600">All in one place.</span>
                </h1>

                <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                  Stop juggling 5 different tools. Bheem Workspace gives your team everything they need to communicate, collaborate, and get work done—with AI that actually helps.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 mb-10">
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-blue-700 transition-all hover:-translate-y-0.5 shadow-lg shadow-blue-500/25"
                  >
                    Start free trial
                    <ArrowRight size={20} />
                  </Link>
                  <a
                    href="#demo"
                    className="inline-flex items-center justify-center gap-2 bg-white text-gray-900 px-8 py-4 rounded-xl font-semibold text-lg border-2 border-gray-200 hover:border-blue-600 hover:text-blue-600 transition-colors"
                  >
                    <Play size={20} />
                    Watch demo
                  </a>
                </div>

                <div className="flex flex-wrap items-center gap-6 pt-6 border-t border-gray-200">
                  {['14-day free trial', 'No credit card required', 'Cancel anytime'].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-gray-600">
                      <Check size={20} className="text-green-500" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative">
                <div className="bg-gray-100 rounded-2xl p-4 shadow-2xl border border-gray-200">
                  <div className="bg-white rounded-xl overflow-hidden">
                    <div className="bg-gray-200 h-10 flex items-center px-4 gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-400"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                      <div className="w-3 h-3 rounded-full bg-green-400"></div>
                    </div>
                    <div className="p-6 space-y-4">
                      <div className="h-6 bg-gray-900 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-full"></div>
                      <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                      <div className="h-3 bg-gray-200 rounded w-4/5"></div>
                      <div className="grid grid-cols-3 gap-3 pt-4">
                        <div className="h-20 bg-blue-100 rounded-lg"></div>
                        <div className="h-20 bg-green-100 rounded-lg"></div>
                        <div className="h-20 bg-yellow-100 rounded-lg"></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating cards */}
                <div className="absolute -top-4 -right-4 bg-white rounded-xl p-4 shadow-lg border border-gray-100 flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <Check size={20} className="text-green-600" />
                  </div>
                  <div>
                    <div className="font-bold text-green-600">12 hrs saved</div>
                    <div className="text-sm text-gray-500">per week, per user</div>
                  </div>
                </div>

                <div className="absolute -bottom-4 -left-4 bg-white rounded-xl p-4 shadow-lg border border-gray-100 flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Bot size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">AI Assistant</div>
                    <div className="text-sm text-gray-500">Writes emails for you</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50">
          <div className="max-w-6xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { value: '47%', label: 'Increase in productivity' },
              { value: '12 hrs', label: 'Saved per user weekly' },
              { value: '60%', label: 'Less tool switching' },
              { value: '99.9%', label: 'Uptime guaranteed' },
            ].map((stat) => (
              <div key={stat.label} className="text-center p-6 bg-white rounded-2xl border border-gray-200">
                <div className="text-4xl font-extrabold text-blue-600 mb-2">{stat.value}</div>
                <div className="text-gray-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <span className="inline-block bg-blue-100 text-blue-700 px-4 py-1.5 rounded-full text-sm font-semibold uppercase tracking-wide mb-4">
                Features
              </span>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900 mb-4">
                Everything your team needs
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                One platform for email, documents, video calls, and automation. AI built-in, not bolted on.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="bg-white p-8 rounded-2xl border border-gray-200 hover:border-blue-500 hover:shadow-lg transition-all hover:-translate-y-1"
                >
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-5`}>
                    <feature.icon size={28} className="text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                  <p className="text-gray-600 mb-5 leading-relaxed">{feature.description}</p>
                  <div className="flex items-center gap-2 text-green-600 font-semibold">
                    <ChevronRight size={18} />
                    {feature.benefit}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section id="testimonials" className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <span className="inline-block bg-blue-100 text-blue-700 px-4 py-1.5 rounded-full text-sm font-semibold uppercase tracking-wide mb-4">
                Testimonials
              </span>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900 mb-4">
                Teams love Bheem
              </h2>
              <p className="text-xl text-gray-600">
                See why thousands of teams switched from Google and Microsoft.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {testimonials.map((t) => (
                <div key={t.author} className="bg-white p-8 rounded-2xl">
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={20} className="text-yellow-400 fill-yellow-400" />
                    ))}
                  </div>
                  <p className="text-gray-700 mb-6 leading-relaxed">{t.text}</p>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold">
                      {t.initials}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{t.author}</div>
                      <div className="text-sm text-gray-500">{t.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Comparison */}
        <section className="py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <span className="inline-block bg-blue-100 text-blue-700 px-4 py-1.5 rounded-full text-sm font-semibold uppercase tracking-wide mb-4">
                Compare
              </span>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900 mb-4">
                Why teams switch to Bheem
              </h2>
            </div>

            <div className="bg-white rounded-2xl overflow-hidden shadow-lg border border-gray-200">
              <div className="grid grid-cols-4 bg-gray-900 text-white">
                <div className="p-5 font-semibold">Feature</div>
                <div className="p-5 font-semibold text-center bg-blue-600">Bheem</div>
                <div className="p-5 font-semibold text-center">Google</div>
                <div className="p-5 font-semibold text-center">Microsoft</div>
              </div>
              {comparison.map((row, i) => (
                <div key={row.feature} className={`grid grid-cols-4 border-t border-gray-200 ${i % 2 === 0 ? 'bg-gray-50' : ''}`}>
                  <div className="p-5 font-medium text-gray-900">{row.feature}</div>
                  <div className="p-5 flex justify-center bg-blue-50">
                    {row.bheem === true ? <Check size={24} className="text-green-500" /> : row.bheem}
                  </div>
                  <div className="p-5 flex justify-center">
                    {row.google === true ? <Check size={24} className="text-green-500" /> :
                     row.google === false ? <X size={24} className="text-red-400" /> :
                     <span className="text-yellow-600 font-medium">{row.google}</span>}
                  </div>
                  <div className="p-5 flex justify-center">
                    {row.microsoft === true ? <Check size={24} className="text-green-500" /> :
                     row.microsoft === false ? <X size={24} className="text-red-400" /> :
                     <span className="text-yellow-600 font-medium">{row.microsoft}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <span className="inline-block bg-blue-100 text-blue-700 px-4 py-1.5 rounded-full text-sm font-semibold uppercase tracking-wide mb-4">
                Pricing
              </span>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900 mb-4">
                Simple, transparent pricing
              </h2>
              <p className="text-xl text-gray-600">
                AI included in every plan. No hidden fees. Cancel anytime.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`bg-white rounded-2xl p-8 border-2 transition-all relative ${
                    plan.popular
                      ? 'border-blue-500 shadow-xl scale-105'
                      : 'border-gray-200 hover:border-blue-500'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                      Most Popular
                    </div>
                  )}

                  <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <p className="text-gray-600 mb-6">{plan.description}</p>

                  <div className="mb-6">
                    <span className="text-4xl font-extrabold text-gray-900">{plan.price}</span>
                    <span className="text-gray-500">{plan.period}</span>
                  </div>

                  <ul className="space-y-4 mb-8">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-3 text-gray-600">
                        <Check size={20} className="text-green-500 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {plan.isEnterprise ? (
                    <a
                      href="mailto:sales@bheem.cloud"
                      className="block w-full text-center py-4 rounded-xl font-semibold border-2 border-gray-200 text-gray-900 hover:border-blue-500 hover:text-blue-600 transition-colors"
                    >
                      Contact sales
                    </a>
                  ) : (
                    <button
                      onClick={() => startCheckout(plan.id)}
                      disabled={loading === plan.id}
                      className={`w-full py-4 rounded-xl font-semibold transition-all ${
                        plan.popular
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'border-2 border-gray-200 text-gray-900 hover:border-blue-500 hover:text-blue-600'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {loading === plan.id ? 'Processing...' : 'Subscribe Now'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-900 to-gray-800 text-white">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl lg:text-4xl font-extrabold mb-6">
              Ready to work smarter?
            </h2>
            <p className="text-xl text-gray-300 mb-10">
              Join thousands of teams who've already made the switch. Start your free trial today—no credit card required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/login"
                className="inline-flex items-center justify-center bg-white text-gray-900 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-gray-100 transition-colors"
              >
                Start free trial
              </Link>
              <a
                href="mailto:sales@bheem.cloud"
                className="inline-flex items-center justify-center border-2 border-gray-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:border-white transition-colors"
              >
                Talk to sales
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-gray-900 text-white py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-5 gap-12 mb-12">
              <div className="md:col-span-2">
                <Link href="/" className="flex items-center gap-2 font-bold text-xl mb-4">
                  <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-lg">B</span>
                  </div>
                  Bheem
                </Link>
                <p className="text-gray-400 leading-relaxed max-w-xs">
                  The all-in-one workspace for modern teams. Email, docs, meetings, and AI—together at last.
                </p>
              </div>

              {[
                { title: 'Product', links: [{ label: 'Email', href: '/mail' }, { label: 'Documents', href: '/docs' }, { label: 'Meetings', href: '/meet' }] },
                { title: 'Resources', links: [{ label: 'Academy', href: 'https://academy.bheem.cloud' }, { label: 'Documentation', href: '#' }, { label: 'API', href: '#' }] },
                { title: 'Company', links: [{ label: 'About', href: '#' }, { label: 'Contact', href: 'mailto:sales@bheem.cloud' }, { label: 'Privacy', href: '#' }] },
              ].map((col) => (
                <div key={col.title}>
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-4">{col.title}</h4>
                  <ul className="space-y-3">
                    {col.links.map((link) => (
                      <li key={link.label}>
                        <a href={link.href} className="text-gray-400 hover:text-white transition-colors">{link.label}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-gray-500 text-sm">© 2024 Bheem Cloud. All rights reserved.</p>
              <div className="flex gap-4">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg text-sm text-gray-400">
                  <Shield size={14} />
                  SOC 2 Compliant
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg text-sm text-gray-400">
                  <Shield size={14} />
                  GDPR Ready
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>

      <style jsx>{`
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
