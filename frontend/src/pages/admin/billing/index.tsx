import { useEffect, useState } from 'react';
import {
  CreditCard,
  Check,
  ArrowUp,
  Users,
  Video,
  Mail,
  FileText,
  Zap,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import UsageProgressBar from '@/components/admin/UsageProgressBar';
import { PLAN_QUOTAS } from '@/types/admin';
import type { PlanType } from '@/types/admin';

interface PlanFeature {
  name: string;
  free: string | boolean;
  starter: string | boolean;
  business: string | boolean;
  enterprise: string | boolean;
}

const PLAN_FEATURES: PlanFeature[] = [
  { name: 'Users', free: '5', starter: '25', business: '100', enterprise: 'Unlimited' },
  { name: 'Meet Hours/mo', free: '100', starter: '500', business: '2000', enterprise: 'Unlimited' },
  { name: 'Docs Storage', free: '5 GB', starter: '50 GB', business: '500 GB', enterprise: '5 TB' },
  { name: 'Mail Storage', free: '10 GB', starter: '100 GB', business: '1 TB', enterprise: '10 TB' },
  { name: 'Recording Storage', free: false, starter: '10 GB', business: '100 GB', enterprise: '1 TB' },
  { name: 'Custom Domain', free: false, starter: true, business: true, enterprise: true },
  { name: 'SSO/SAML', free: false, starter: false, business: true, enterprise: true },
  { name: 'API Access', free: false, starter: false, business: true, enterprise: true },
  { name: 'Priority Support', free: false, starter: false, business: true, enterprise: true },
  { name: 'SLA', free: false, starter: false, business: false, enterprise: true },
];

const PLAN_PRICES: Record<PlanType, { monthly: number; yearly: number }> = {
  free: { monthly: 0, yearly: 0 },
  starter: { monthly: 12, yearly: 120 },
  business: { monthly: 25, yearly: 250 },
  enterprise: { monthly: 0, yearly: 0 }, // Contact sales
};

export default function BillingPage() {
  const [currentPlan] = useState<PlanType>('starter');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [usage] = useState({
    users: { used: 12, quota: 25 },
    meet: { used: 245, quota: 500 },
    docs: { used: 23456, quota: 51200 }, // MB
    mail: { used: 45678, quota: 102400 }, // MB
    recordings: { used: 5120, quota: 10240 }, // MB
  });

  const currentQuotas = PLAN_QUOTAS[currentPlan];

  return (
    <AdminLayout
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Billing' },
      ]}
      isSuperAdmin={false}
    >
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plan & Billing</h1>
          <p className="text-gray-500">Manage your subscription and view usage</p>
        </div>

        {/* Current Plan */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-6 text-white">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <p className="text-blue-200">Current Plan</p>
              <h2 className="text-3xl font-bold capitalize">{currentPlan}</h2>
              <p className="text-blue-200 mt-1">
                {currentPlan === 'free'
                  ? 'Free forever'
                  : `$${PLAN_PRICES[currentPlan].monthly}/user/month`}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button className="inline-flex items-center justify-center px-6 py-3 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors">
                <ArrowUp size={20} className="mr-2" />
                Upgrade Plan
              </button>
              <button className="inline-flex items-center justify-center px-6 py-3 bg-blue-700 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors">
                <CreditCard size={20} className="mr-2" />
                Manage Billing
              </button>
            </div>
          </div>
        </div>

        {/* Usage */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Current Usage</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <UsageProgressBar
              label="Users"
              used={usage.users.used}
              quota={usage.users.quota}
              unit="users"
            />
            <UsageProgressBar
              label="Meet Hours"
              used={usage.meet.used}
              quota={usage.meet.quota}
              unit="hours"
            />
            <UsageProgressBar
              label="Docs Storage"
              used={usage.docs.used}
              quota={usage.docs.quota}
              unit="MB"
            />
            <UsageProgressBar
              label="Mail Storage"
              used={usage.mail.used}
              quota={usage.mail.quota}
              unit="MB"
            />
            <UsageProgressBar
              label="Recording Storage"
              used={usage.recordings.used}
              quota={usage.recordings.quota}
              unit="MB"
            />
          </div>
        </div>

        {/* Plan Comparison */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Compare Plans</h2>
            <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  billingCycle === 'monthly'
                    ? 'bg-white text-gray-900 shadow'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  billingCycle === 'yearly'
                    ? 'bg-white text-gray-900 shadow'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Yearly
                <span className="ml-1 text-xs text-green-600">Save 17%</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="py-4 px-4 text-left text-sm font-medium text-gray-500">
                    Feature
                  </th>
                  {(['free', 'starter', 'business', 'enterprise'] as PlanType[]).map((plan) => (
                    <th
                      key={plan}
                      className={`py-4 px-4 text-center ${
                        plan === currentPlan ? 'bg-blue-50' : ''
                      }`}
                    >
                      <p className="font-semibold text-gray-900 capitalize">{plan}</p>
                      <p className="text-sm text-gray-500">
                        {plan === 'enterprise'
                          ? 'Contact us'
                          : plan === 'free'
                          ? 'Free'
                          : `$${
                              billingCycle === 'monthly'
                                ? PLAN_PRICES[plan].monthly
                                : Math.round(PLAN_PRICES[plan].yearly / 12)
                            }/user/mo`}
                      </p>
                      {plan === currentPlan && (
                        <span className="inline-block mt-2 px-2 py-1 bg-blue-600 text-white text-xs rounded-full">
                          Current
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PLAN_FEATURES.map((feature, idx) => (
                  <tr key={feature.name} className={idx % 2 === 0 ? 'bg-gray-50' : ''}>
                    <td className="py-3 px-4 text-sm text-gray-700">{feature.name}</td>
                    {(['free', 'starter', 'business', 'enterprise'] as PlanType[]).map((plan) => {
                      const value = feature[plan];
                      return (
                        <td
                          key={plan}
                          className={`py-3 px-4 text-center text-sm ${
                            plan === currentPlan ? 'bg-blue-50' : ''
                          }`}
                        >
                          {typeof value === 'boolean' ? (
                            value ? (
                              <Check className="inline text-green-500" size={18} />
                            ) : (
                              <span className="text-gray-300">—</span>
                            )
                          ) : (
                            <span className="text-gray-700">{value}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Billing History */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Billing History</h2>
          <div className="space-y-3">
            {[
              { date: '2024-01-01', amount: 300, status: 'Paid', invoice: 'INV-2024-001' },
              { date: '2023-12-01', amount: 300, status: 'Paid', invoice: 'INV-2023-012' },
              { date: '2023-11-01', amount: 300, status: 'Paid', invoice: 'INV-2023-011' },
            ].map((invoice) => (
              <div
                key={invoice.invoice}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900">{invoice.invoice}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(invoice.date).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">${invoice.amount}</p>
                  <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                    {invoice.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <button className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium">
            View All Invoices
          </button>
        </div>

        {/* Payment Method */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Method</h2>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <CreditCard className="text-blue-600" size={24} />
              </div>
              <div>
                <p className="font-medium text-gray-900">•••• •••• •••• 4242</p>
                <p className="text-sm text-gray-500">Expires 12/25</p>
              </div>
            </div>
            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              Update
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
