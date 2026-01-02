import { useState } from 'react';
import type { TenantUserCreate, TenantUserUpdate, UserRole } from '@/types/admin';

interface UserFormProps {
  initialData?: Partial<TenantUserCreate>;
  onSubmit: (data: TenantUserCreate) => Promise<void>;
  onCancel: () => void;
  isEdit?: boolean;
  loading?: boolean;
  error?: string | null;
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
  error = null,
}: UserFormProps) {
  const [formData, setFormData] = useState({
    username: initialData?.username || '',
    name: initialData?.name || '',
    personal_email: initialData?.personal_email || '',
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

    if (!formData.username.trim()) newErrors.username = 'Username is required';
    if (!/^[a-zA-Z0-9._-]+$/.test(formData.username)) {
      newErrors.username = 'Username can only contain letters, numbers, dots, underscores, and hyphens';
    }
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    // Personal email is required for new users (to send login credentials)
    if (!isEdit && !formData.personal_email.trim()) {
      newErrors.personal_email = 'Personal email is required to send login credentials';
    }
    if (formData.personal_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.personal_email)) {
      newErrors.personal_email = 'Invalid email format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    await onSubmit({
      username: formData.username,
      name: formData.name,
      personal_email: formData.personal_email || undefined,
      role: formData.role,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* API Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Username */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Username *
        </label>
        <input
          type="text"
          name="username"
          value={formData.username}
          onChange={handleChange}
          disabled={isEdit}
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            errors.username ? 'border-red-500' : 'border-gray-300'
          } ${isEdit ? 'bg-gray-100' : ''}`}
          placeholder="johndoe"
        />
        {errors.username && <p className="mt-1 text-sm text-red-500">{errors.username}</p>}
        <p className="mt-1 text-xs text-gray-500">
          This will become the workspace email: <strong>{formData.username || 'username'}@your-domain.com</strong>
        </p>
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

      {/* Personal Email (for sending invite) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Personal Email {isEdit ? <span className="text-gray-400">(optional)</span> : '*'}
        </label>
        <input
          type="email"
          name="personal_email"
          value={formData.personal_email}
          onChange={handleChange}
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            errors.personal_email ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="john@gmail.com"
        />
        {errors.personal_email && <p className="mt-1 text-sm text-red-500">{errors.personal_email}</p>}
        <p className="mt-1 text-xs text-gray-500">
          {isEdit
            ? 'Used for sending notifications'
            : 'Login credentials will be sent to this email (e.g., user\'s Gmail or personal email)'}
        </p>
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
