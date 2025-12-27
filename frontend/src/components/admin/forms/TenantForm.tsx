import { useState } from 'react';
import type { TenantCreate, TenantUpdate, PlanType } from '@/types/admin';
import { PLAN_QUOTAS } from '@/types/admin';

interface TenantFormProps {
  initialData?: Partial<TenantCreate>;
  onSubmit: (data: TenantCreate) => Promise<void>;
  onCancel: () => void;
  isEdit?: boolean;
  loading?: boolean;
}

export default function TenantForm({
  initialData,
  onSubmit,
  onCancel,
  isEdit = false,
  loading = false,
}: TenantFormProps) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    slug: initialData?.slug || '',
    domain: initialData?.domain || '',
    owner_email: initialData?.owner_email || '',
    plan: initialData?.plan || 'free' as PlanType,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Auto-generate slug from name
    if (name === 'name' && !isEdit) {
      const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      setFormData((prev) => ({ ...prev, slug }));
    }

    // Clear error when field is edited
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!isEdit && !formData.slug.trim()) newErrors.slug = 'Slug is required';
    if (!isEdit && !/^[a-z0-9-]+$/.test(formData.slug)) {
      newErrors.slug = 'Slug can only contain lowercase letters, numbers, and hyphens';
    }
    if (!isEdit && !formData.owner_email.trim()) newErrors.owner_email = 'Owner email is required';
    if (!isEdit && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.owner_email)) {
      newErrors.owner_email = 'Invalid email format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    await onSubmit(formData as TenantCreate);
  };

  const selectedPlanQuotas = PLAN_QUOTAS[formData.plan];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Organization Name *
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            errors.name ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="Acme Inc."
        />
        {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
      </div>

      {/* Slug (only for create) */}
      {!isEdit && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Slug *
          </label>
          <div className="flex items-center">
            <span className="text-gray-500 text-sm mr-2">workspace.bheem.cloud/</span>
            <input
              type="text"
              name="slug"
              value={formData.slug}
              onChange={handleChange}
              className={`flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.slug ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="acme"
            />
          </div>
          {errors.slug && <p className="mt-1 text-sm text-red-500">{errors.slug}</p>}
        </div>
      )}

      {/* Domain */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Custom Domain
        </label>
        <input
          type="text"
          name="domain"
          value={formData.domain}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="workspace.acme.com"
        />
        <p className="mt-1 text-xs text-gray-500">Optional custom domain for this workspace</p>
      </div>

      {/* Owner Email (only for create) */}
      {!isEdit && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Owner Email *
          </label>
          <input
            type="email"
            name="owner_email"
            value={formData.owner_email}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.owner_email ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="admin@acme.com"
          />
          {errors.owner_email && <p className="mt-1 text-sm text-red-500">{errors.owner_email}</p>}
        </div>
      )}

      {/* Plan */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Plan
        </label>
        <select
          name="plan"
          value={formData.plan}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="free">Free</option>
          <option value="starter">Starter</option>
          <option value="business">Business</option>
          <option value="enterprise">Enterprise</option>
        </select>

        {/* Plan quotas preview */}
        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs font-medium text-gray-600 mb-2">Plan Includes:</p>
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
            <span>Users: {selectedPlanQuotas.max_users}</span>
            <span>Meet: {selectedPlanQuotas.meet_hours} hrs/mo</span>
            <span>Docs: {(selectedPlanQuotas.docs_mb / 1024).toFixed(0)} GB</span>
            <span>Mail: {(selectedPlanQuotas.mail_mb / 1024).toFixed(0)} GB</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Saving...' : isEdit ? 'Update Tenant' : 'Create Tenant'}
        </button>
      </div>
    </form>
  );
}
