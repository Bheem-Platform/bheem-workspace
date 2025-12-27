import { useState } from 'react';
import type { DeveloperCreate, DeveloperUpdate } from '@/types/admin';

interface DeveloperFormProps {
  initialData?: Partial<DeveloperCreate>;
  onSubmit: (data: DeveloperCreate) => Promise<void>;
  onCancel: () => void;
  isEdit?: boolean;
  loading?: boolean;
}

export default function DeveloperForm({
  initialData,
  onSubmit,
  onCancel,
  isEdit = false,
  loading = false,
}: DeveloperFormProps) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    email: initialData?.email || '',
    company: initialData?.company || '',
    website: initialData?.website || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    if (formData.website && !/^https?:\/\/.+/.test(formData.website)) {
      newErrors.website = 'Website must start with http:// or https://';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Developer Name *
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
            errors.name ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="John Doe"
        />
        {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email *
        </label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          disabled={isEdit}
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
            errors.email ? 'border-red-500' : 'border-gray-300'
          } ${isEdit ? 'bg-gray-100' : ''}`}
          placeholder="developer@company.com"
        />
        {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
      </div>

      {/* Company */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Company
        </label>
        <input
          type="text"
          name="company"
          value={formData.company}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          placeholder="Acme Inc."
        />
      </div>

      {/* Website */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Website
        </label>
        <input
          type="url"
          name="website"
          value={formData.website}
          onChange={handleChange}
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
            errors.website ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="https://company.com"
        />
        {errors.website && <p className="mt-1 text-sm text-red-500">{errors.website}</p>}
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
          className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          {loading ? 'Saving...' : isEdit ? 'Update Developer' : 'Create Developer'}
        </button>
      </div>
    </form>
  );
}
