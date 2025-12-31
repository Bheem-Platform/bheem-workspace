import { useEffect, useState, useCallback } from 'react';
import {
  CreditCard,
  Check,
  ArrowUp,
  Download,
  AlertCircle,
  Loader2,
  Crown,
  Zap,
  Building2,
  X,
  ExternalLink,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import UsageProgressBar from '@/components/admin/UsageProgressBar';
import Modal from '@/components/admin/Modal';
import { useAuthStore, useCurrentTenantId } from '@/stores/authStore';
import * as adminApi from '@/lib/adminApi';
import type {
  SubscriptionPlan,
  SubscriptionStatus,
  CheckoutSession,
  Invoice,
  BillingCycle,
  Tenant,
} from '@/types/admin';

// Razorpay types
declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function BillingPage() {
  const tenantId = useCurrentTenantId();
  const { user } = useAuthStore();

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');

  // Modal states
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Check if tenant is internal mode (Bheemverse subsidiary)
  const isInternalMode = tenant?.tenant_mode === 'internal';

  // Load data
  const loadData = useCallback(async () => {
    if (!tenantId) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch tenant details
      const tenantRes = await adminApi.getTenant(tenantId);
      setTenant(tenantRes.data);

      // Fetch subscription plans
      const plansRes = await adminApi.getSubscriptionPlans();
      setPlans(plansRes.data.plans || []);

      // Only fetch subscription for external tenants
      if (tenantRes.data.tenant_mode !== 'internal') {
        try {
          const subRes = await adminApi.getSubscriptionStatus(tenantId);
          setSubscription(subRes.data);
        } catch (e) {
          // No subscription yet
          setSubscription(null);
        }

        // Fetch invoices
        try {
          const invoicesRes = await adminApi.getInvoices(tenantId);
          setInvoices(invoicesRes.data || []);
        } catch (e) {
          setInvoices([]);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load billing data');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load Razorpay script
  useEffect(() => {
    if (!isInternalMode) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);
      return () => {
        document.body.removeChild(script);
      };
    }
  }, [isInternalMode]);

  // Handle checkout
  const handleCheckout = async (plan: SubscriptionPlan) => {
    if (!tenantId) return;

    setCheckoutLoading(true);
    setSelectedPlan(plan);

    try {
      const response = await adminApi.createCheckoutSession(tenantId, {
        plan_id: plan.sku_id,
        billing_cycle: billingCycle,
      });

      const checkout: CheckoutSession = response.data;

      // Open Razorpay checkout
      const options = {
        key: checkout.key_id,
        amount: checkout.amount * 100, // Razorpay expects paise
        currency: checkout.currency || 'INR',
        name: 'Bheem Workspace',
        description: `${checkout.plan_name} - ${billingCycle}`,
        order_id: checkout.order_id,
        handler: async function(response: any) {
          // Payment successful - poll for status
          try {
            const statusRes = await adminApi.getCheckoutStatus(checkout.order_id);
            if (statusRes.data.status === 'completed') {
              await loadData();
              setShowUpgradeModal(false);
              alert('Subscription activated successfully!');
            }
          } catch (e) {
            console.error('Failed to verify payment:', e);
          }
        },
        prefill: {
          email: user?.email || '',
          contact: '',
        },
        theme: {
          color: '#3B82F6',
        },
        modal: {
          ondismiss: function() {
            setCheckoutLoading(false);
          }
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create checkout session');
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Handle cancel subscription
  const handleCancelSubscription = async () => {
    if (!tenantId) return;

    try {
      await adminApi.cancelSubscription(tenantId, cancelReason);
      setShowCancelModal(false);
      setCancelReason('');
      await loadData();
      alert('Subscription cancellation scheduled');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to cancel subscription');
    }
  };

  // Get plan icon
  const getPlanIcon = (skuId: string) => {
    if (skuId.includes('ENTERPRISE')) return Crown;
    if (skuId.includes('PROFESSIONAL')) return Zap;
    return Building2;
  };

  // Format price
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  if (loading) {
    return (
      <AdminLayout
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Billing' },
        ]}
        isSuperAdmin={false}
      >
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </AdminLayout>
    );
  }

  // Internal mode - no billing needed
  if (isInternalMode) {
    return (
      <AdminLayout
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Billing' },
        ]}
        isSuperAdmin={false}
      >
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Plan & Billing</h1>
            <p className="text-gray-500">Subscription management</p>
          </div>

          {/* Internal Mode Banner */}
          <div className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-2xl p-6 text-white">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white/20 rounded-lg">
                <Crown size={32} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Enterprise Plan</h2>
                <p className="text-purple-200 mt-1">
                  Bheemverse Subsidiary - {tenant?.erp_company_code}
                </p>
                <p className="text-purple-100 mt-3">
                  As a Bheemverse subsidiary, your organization has full enterprise access
                  with no billing required. All features are included.
                </p>
              </div>
            </div>
          </div>

          {/* Features Included */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Included Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                'Unlimited Users',
                'Unlimited Meet Hours',
                'Unlimited Storage',
                'Custom Domains',
                'SSO/SAML',
                'Full API Access',
                'Priority Support',
                'ERP Integration',
                'HR Module Sync',
                'PM Module Sync',
                'Custom Branding',
                'Advanced Analytics',
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span className="text-gray-700">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Usage - still show for internal tenants */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Current Usage</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <UsageProgressBar
                label="Users"
                used={tenant?.user_count || 0}
                quota={tenant?.max_users || -1}
                unit="users"
              />
              <UsageProgressBar
                label="Meet Hours"
                used={tenant?.meet_used_hours || 0}
                quota={tenant?.meet_quota_hours || -1}
                unit="hours"
              />
              <UsageProgressBar
                label="Docs Storage"
                used={tenant?.docs_used_mb || 0}
                quota={tenant?.docs_quota_mb || -1}
                unit="MB"
              />
              <UsageProgressBar
                label="Mail Storage"
                used={tenant?.mail_used_mb || 0}
                quota={tenant?.mail_quota_mb || -1}
                unit="MB"
              />
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  // External mode - show full billing UI
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

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <p className="text-red-700">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="h-4 w-4 text-red-500" />
            </button>
          </div>
        )}

        {/* Current Subscription */}
        <div className={`rounded-2xl p-6 text-white ${
          subscription?.status === 'active'
            ? 'bg-gradient-to-r from-blue-600 to-blue-800'
            : 'bg-gradient-to-r from-gray-600 to-gray-800'
        }`}>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <p className="text-blue-200">Current Plan</p>
              <h2 className="text-3xl font-bold">
                {subscription?.plan || 'No Active Plan'}
              </h2>
              {subscription?.status === 'active' ? (
                <p className="text-blue-200 mt-1">
                  {formatPrice(subscription.price || 0)}/{subscription.billing_cycle || 'month'}
                  {subscription.next_billing_date && (
                    <span className="ml-2">
                      • Next billing: {new Date(subscription.next_billing_date).toLocaleDateString()}
                    </span>
                  )}
                </p>
              ) : (
                <p className="text-gray-300 mt-1">
                  Subscribe to unlock all features
                </p>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="inline-flex items-center justify-center px-6 py-3 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors"
              >
                <ArrowUp size={20} className="mr-2" />
                {subscription?.status === 'active' ? 'Change Plan' : 'Subscribe Now'}
              </button>
              {subscription?.status === 'active' && (
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="inline-flex items-center justify-center px-6 py-3 bg-red-500/20 text-white rounded-lg font-medium hover:bg-red-500/30 transition-colors"
                >
                  Cancel Subscription
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Usage */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Current Usage</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <UsageProgressBar
              label="Users"
              used={tenant?.user_count || 0}
              quota={tenant?.max_users || 5}
              unit="users"
            />
            <UsageProgressBar
              label="Meet Hours"
              used={tenant?.meet_used_hours || 0}
              quota={tenant?.meet_quota_hours || 10}
              unit="hours"
            />
            <UsageProgressBar
              label="Docs Storage"
              used={tenant?.docs_used_mb || 0}
              quota={tenant?.docs_quota_mb || 1024}
              unit="MB"
            />
            <UsageProgressBar
              label="Mail Storage"
              used={tenant?.mail_used_mb || 0}
              quota={tenant?.mail_quota_mb || 512}
              unit="MB"
            />
          </div>
        </div>

        {/* Available Plans */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Available Plans</h2>
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
                onClick={() => setBillingCycle('annual')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  billingCycle === 'annual'
                    ? 'bg-white text-gray-900 shadow'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Annual
                <span className="ml-1 text-xs text-green-600">Save 17%</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const Icon = getPlanIcon(plan.sku_id);
              const isCurrentPlan = subscription?.plan === plan.name;
              const price = billingCycle === 'annual'
                ? Math.round((plan.offer_price || plan.base_price) * 10) // 2 months free
                : (plan.offer_price || plan.base_price);

              return (
                <div
                  key={plan.sku_id}
                  className={`relative rounded-xl border-2 p-6 ${
                    isCurrentPlan
                      ? 'border-blue-500 bg-blue-50'
                      : plan.is_featured
                        ? 'border-purple-500'
                        : 'border-gray-200'
                  }`}
                >
                  {plan.is_featured && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-purple-500 text-white text-xs font-medium rounded-full">
                      Most Popular
                    </div>
                  )}

                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2 rounded-lg ${
                      isCurrentPlan ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      <Icon className={`h-6 w-6 ${
                        isCurrentPlan ? 'text-blue-600' : 'text-gray-600'
                      }`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                      {isCurrentPlan && (
                        <span className="text-xs text-blue-600">Current Plan</span>
                      )}
                    </div>
                  </div>

                  <div className="mb-4">
                    <span className="text-3xl font-bold text-gray-900">
                      {plan.base_price === 0 ? 'Free' : formatPrice(price)}
                    </span>
                    {plan.base_price > 0 && (
                      <span className="text-gray-500">/{billingCycle === 'annual' ? 'year' : 'month'}</span>
                    )}
                  </div>

                  <p className="text-sm text-gray-500 mb-4">{plan.description}</p>

                  <ul className="space-y-2 mb-6">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500" />
                        <span className="text-gray-600">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleCheckout(plan)}
                    disabled={isCurrentPlan || checkoutLoading}
                    className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                      isCurrentPlan
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : plan.base_price === 0
                          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {checkoutLoading && selectedPlan?.sku_id === plan.sku_id ? (
                      <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                    ) : isCurrentPlan ? (
                      'Current Plan'
                    ) : plan.base_price === 0 ? (
                      'Get Started'
                    ) : (
                      'Subscribe'
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Invoices */}
        {invoices.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Billing History</h2>
            <div className="space-y-3">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">{invoice.invoice_number}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(invoice.invoice_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-medium text-gray-900">
                        {formatPrice(invoice.total_amount)}
                      </p>
                      <span className={`inline-flex items-center px-2 py-1 text-xs rounded-full ${
                        invoice.status === 'paid'
                          ? 'bg-green-100 text-green-700'
                          : invoice.status === 'overdue'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {invoice.status}
                      </span>
                    </div>
                    {invoice.pdf_url && (
                      <a
                        href={invoice.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-400 hover:text-gray-600"
                      >
                        <Download className="h-5 w-5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Cancel Subscription Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancel Subscription"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to cancel your subscription? Your access will continue
            until the end of the current billing period.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason for cancellation (optional)
            </label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              placeholder="Let us know why you're cancelling..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setShowCancelModal(false)}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Keep Subscription
            </button>
            <button
              onClick={handleCancelSubscription}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Cancel Subscription
            </button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
