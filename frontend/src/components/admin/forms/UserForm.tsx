import { useState } from 'react';
import type { TenantUserCreate, TenantUserUpdate, UserRole } from '@/types/admin';

interface UserFormProps {
  initialData?: Partial<TenantUserCreate>;
  onSubmit: (data: TenantUserCreate) => Promise<void>;
  onCancel: () => void;
  isEdit?: boolean;
  loading?: boolean;
}

const ROLES: { value: UserRole; label: string; description: string }[] = [
  { value: 'admin', label: 'Admin', description: 'Full access to all settings and users' },
  { value: 'member', label: 'Member', description: 'Can use all workspace features' },
  { value: 'guest', label: 'Guest', description: 'Limited access to shared content' },
];

export default function UserForm({
  initialData,
  onSubmit,
  onCancel,
  isEdit = false,
  loading = false,
}: UserFormProps) {
  const [formData, setFormData] = useState({
    email: initialData?.email || '',
    name: initialData?.name || '',
    role: initialData?.role || 'member' as UserRole,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) newErrors.email = 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    if (!formData.name.trim()) newErrors.name = 'Name is required';

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
      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email Address *
        </label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          disabled={isEdit}
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            errors.email ? 'border-red-500' : 'border-gray-300'
          } ${isEdit ? 'bg-gray-100' : ''}`}
          placeholder="user@company.com"
        />
        {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
      </div>

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Full Name *
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            errors.name ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="John Doe"
        />
        {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
      </div>

      {/* Role */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Role
        </label>
        <div className="space-y-2">
          {ROLES.map((role) => (
            <label
              key={role.value}
              className={`flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${
                formData.role === role.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="role"
                value={role.value}
                checked={formData.role === role.value}
                onChange={handleChange}
                className="mt-1 text-blue-600 focus:ring-blue-500"
              />
              <div className="ml-3">
                <p className="font-medium text-gray-900">{role.label}</p>
                <p className="text-sm text-gray-500">{role.description}</p>
              </div>
            </label>
          ))}
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
          {loading ? 'Saving...' : isEdit ? 'Update User' : 'Send Invite'}
        </button>
      </div>
    </form>
  );
}
