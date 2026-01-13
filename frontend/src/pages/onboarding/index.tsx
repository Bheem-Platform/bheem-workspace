/**
 * Bheem Workspace - Onboarding Wizard
 * Guides new workspace owners through setup
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  Check,
  ChevronRight,
  User,
  Globe,
  Users,
  Video,
  FileText,
  Sparkles,
  ArrowRight,
  X,
  Building2,
  Mail,
  Calendar,
} from 'lucide-react';
import { useAuthStore, useRequireAuth } from '@/stores/authStore';
import { api } from '@/lib/api';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  required: boolean;
}

interface OnboardingProgress {
  current_step: string;
  completed: {
    profile: boolean;
    domain: boolean;
    invite: boolean;
    meeting: boolean;
    document: boolean;
  };
  is_complete: boolean;
}

const STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome',
    description: 'Welcome to Bheem Workspace',
    icon: <Sparkles size={24} />,
    required: true,
  },
  {
    id: 'profile',
    title: 'Complete Profile',
    description: 'Add your organization details',
    icon: <Building2 size={24} />,
    required: true,
  },
  {
    id: 'domain',
    title: 'Add Domain',
    description: 'Connect your custom domain',
    icon: <Globe size={24} />,
    required: false,
  },
  {
    id: 'invite',
    title: 'Invite Team',
    description: 'Add your team members',
    icon: <Users size={24} />,
    required: false,
  },
  {
    id: 'tour',
    title: 'Quick Tour',
    description: 'Explore key features',
    icon: <Sparkles size={24} />,
    required: false,
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { isAuthenticated, isLoading } = useRequireAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Profile form state
  const [profileData, setProfileData] = useState({
    organization_name: '',
    industry: '',
    team_size: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  // Domain form state
  const [domainData, setDomainData] = useState({
    domain: '',
    domain_type: 'email',
  });

  // Invite form state
  const [inviteEmails, setInviteEmails] = useState('');

  useEffect(() => {
    if (!isAuthenticated || isLoading) return;
    fetchProgress();
  }, [isAuthenticated, isLoading]);

  const fetchProgress = async () => {
    try {
      const res = await api.get('/onboarding/progress');
      setProgress(res.data);

      // Find current step index
      const stepIndex = STEPS.findIndex(s => s.id === res.data.current_step);
      if (stepIndex >= 0) {
        setCurrentStep(stepIndex);
      }
    } catch (err) {
      console.error('Failed to fetch onboarding progress:', err);
    } finally {
      setLoading(false);
    }
  };

  const completeStep = async (stepId: string) => {
    setSaving(true);
    try {
      await api.post(`/onboarding/complete-step/${stepId}`);
      await fetchProgress();

      // Move to next step
      if (currentStep < STEPS.length - 1) {
        setCurrentStep(currentStep + 1);
      }
    } catch (err) {
      console.error('Failed to complete step:', err);
    } finally {
      setSaving(false);
    }
  };

  const skipOnboarding = async () => {
    try {
      await api.post('/onboarding/skip');
      router.push('/dashboard');
    } catch (err) {
      console.error('Failed to skip onboarding:', err);
      router.push('/dashboard');
    }
  };

  const handleProfileSubmit = async () => {
    setSaving(true);
    try {
      // Update tenant profile
      await api.put('/user-workspace/tenant', profileData);
      await completeStep('profile');
    } catch (err) {
      console.error('Failed to update profile:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDomainSubmit = async () => {
    if (!domainData.domain) {
      await completeStep('domain');
      return;
    }

    setSaving(true);
    try {
      await api.post('/domains', domainData);
      await completeStep('domain');
    } catch (err) {
      console.error('Failed to add domain:', err);
      // Still mark as complete even if domain fails
      await completeStep('domain');
    } finally {
      setSaving(false);
    }
  };

  const handleInviteSubmit = async () => {
    if (!inviteEmails.trim()) {
      await completeStep('invite');
      return;
    }

    setSaving(true);
    try {
      const emails = inviteEmails.split(/[,\n]/).map(e => e.trim()).filter(Boolean);

      for (const email of emails) {
        try {
          await api.post('/admin/users/invite', { email, role: 'member' });
        } catch (err) {
          console.error(`Failed to invite ${email}:`, err);
        }
      }

      await completeStep('invite');
    } catch (err) {
      console.error('Failed to send invites:', err);
    } finally {
      setSaving(false);
    }
  };

  const finishOnboarding = async () => {
    await completeStep('tour');
    router.push('/dashboard');
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const step = STEPS[currentStep];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto h-16 w-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center mb-4">
            <span className="text-2xl font-bold text-white">B</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome to Bheem Workspace</h1>
          <p className="text-gray-600 mt-2">Let's get your workspace set up</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8 overflow-x-auto">
          {STEPS.map((s, idx) => (
            <div key={s.id} className="flex items-center">
              <button
                onClick={() => idx <= currentStep && setCurrentStep(idx)}
                disabled={idx > currentStep}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                  idx === currentStep
                    ? 'bg-blue-600 text-white'
                    : idx < currentStep
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {idx < currentStep ? (
                  <Check size={16} />
                ) : (
                  <span className="w-4 h-4 flex items-center justify-center text-xs font-medium">
                    {idx + 1}
                  </span>
                )}
                <span className="text-sm font-medium hidden sm:inline">{s.title}</span>
              </button>
              {idx < STEPS.length - 1 && (
                <ChevronRight size={16} className="text-gray-300 mx-1" />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Welcome Step */}
          {step.id === 'welcome' && (
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Sparkles size={40} className="text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Welcome, {user?.username}!
              </h2>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                Bheem Workspace brings together Mail, Meet, Docs, and Calendar
                in one powerful platform. Let's set up your workspace in just a few steps.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                  { icon: <Mail size={24} />, label: 'Mail', color: 'blue' },
                  { icon: <Video size={24} />, label: 'Meet', color: 'green' },
                  { icon: <FileText size={24} />, label: 'Docs', color: 'purple' },
                  { icon: <Calendar size={24} />, label: 'Calendar', color: 'orange' },
                ].map((feature) => (
                  <div
                    key={feature.label}
                    className="p-4 rounded-xl bg-gray-50 text-center"
                  >
                    <div className={`text-${feature.color}-600 mb-2 flex justify-center`}>
                      {feature.icon}
                    </div>
                    <span className="text-sm font-medium text-gray-700">{feature.label}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => completeStep('welcome')}
                disabled={saving}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Get Started
                <ArrowRight size={20} />
              </button>
            </div>
          )}

          {/* Profile Step */}
          {step.id === 'profile' && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-blue-100 rounded-xl text-blue-600">
                  <Building2 size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Organization Profile</h2>
                  <p className="text-gray-600 text-sm">Tell us about your organization</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    value={profileData.organization_name}
                    onChange={(e) => setProfileData({ ...profileData, organization_name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Acme Inc."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Industry
                  </label>
                  <select
                    value={profileData.industry}
                    onChange={(e) => setProfileData({ ...profileData, industry: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select industry</option>
                    <option value="technology">Technology</option>
                    <option value="healthcare">Healthcare</option>
                    <option value="finance">Finance</option>
                    <option value="education">Education</option>
                    <option value="retail">Retail</option>
                    <option value="manufacturing">Manufacturing</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Team Size
                  </label>
                  <select
                    value={profileData.team_size}
                    onChange={(e) => setProfileData({ ...profileData, team_size: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select team size</option>
                    <option value="1-5">1-5 people</option>
                    <option value="6-20">6-20 people</option>
                    <option value="21-50">21-50 people</option>
                    <option value="51-200">51-200 people</option>
                    <option value="201+">201+ people</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-between mt-8">
                <button
                  onClick={() => completeStep('profile')}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Skip for now
                </button>
                <button
                  onClick={handleProfileSubmit}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Continue'}
                  <ArrowRight size={20} />
                </button>
              </div>
            </div>
          )}

          {/* Domain Step */}
          {step.id === 'domain' && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-green-100 rounded-xl text-green-600">
                  <Globe size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Add Custom Domain</h2>
                  <p className="text-gray-600 text-sm">Use your own domain for email</p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800">
                  Adding a custom domain allows you to use email addresses like
                  <strong> you@yourcompany.com</strong>. You can skip this step and add a domain later.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Domain Name
                  </label>
                  <input
                    type="text"
                    value={domainData.domain}
                    onChange={(e) => setDomainData({ ...domainData, domain: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="yourcompany.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Domain Type
                  </label>
                  <select
                    value={domainData.domain_type}
                    onChange={(e) => setDomainData({ ...domainData, domain_type: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="email">Email Domain</option>
                    <option value="workspace">Workspace Domain</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-between mt-8">
                <button
                  onClick={() => completeStep('domain')}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Skip for now
                </button>
                <button
                  onClick={handleDomainSubmit}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                >
                  {saving ? 'Adding...' : domainData.domain ? 'Add Domain' : 'Continue'}
                  <ArrowRight size={20} />
                </button>
              </div>
            </div>
          )}

          {/* Invite Step */}
          {step.id === 'invite' && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-purple-100 rounded-xl text-purple-600">
                  <Users size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Invite Your Team</h2>
                  <p className="text-gray-600 text-sm">Add team members to your workspace</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Addresses
                  </label>
                  <textarea
                    value={inviteEmails}
                    onChange={(e) => setInviteEmails(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter email addresses, one per line or separated by commas"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    They'll receive an invitation to join your workspace
                  </p>
                </div>
              </div>

              <div className="flex justify-between mt-8">
                <button
                  onClick={() => completeStep('invite')}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Skip for now
                </button>
                <button
                  onClick={handleInviteSubmit}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                >
                  {saving ? 'Sending...' : inviteEmails.trim() ? 'Send Invites' : 'Continue'}
                  <ArrowRight size={20} />
                </button>
              </div>
            </div>
          )}

          {/* Tour Step */}
          {step.id === 'tour' && (
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Check size={40} className="text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                You're All Set!
              </h2>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                Your workspace is ready. Here's a quick overview of what you can do:
              </p>

              <div className="grid gap-4 mb-8 text-left">
                {[
                  { icon: <Mail size={20} />, title: 'Mail', desc: 'Send and receive emails with your custom domain' },
                  { icon: <Video size={20} />, title: 'Meet', desc: 'Host video meetings with your team and clients' },
                  { icon: <FileText size={20} />, title: 'Docs', desc: 'Create and collaborate on documents in real-time' },
                  { icon: <Calendar size={20} />, title: 'Calendar', desc: 'Schedule events and manage your time' },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                    <div className="p-2 bg-white rounded-lg text-blue-600 shadow-sm">
                      {item.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{item.title}</h3>
                      <p className="text-sm text-gray-600">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={finishOnboarding}
                disabled={saving}
                className="inline-flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Go to Dashboard
                <ArrowRight size={20} />
              </button>
            </div>
          )}
        </div>

        {/* Skip Link */}
        <div className="text-center mt-6">
          <button
            onClick={skipOnboarding}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Skip setup and go to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
