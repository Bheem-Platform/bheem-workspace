interface StatusBadgeProps {
  status: 'active' | 'inactive' | 'suspended' | 'pending' | 'verified' | 'unverified' | 'admin' | 'manager' | 'member';
  size?: 'sm' | 'md';
}

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: 'bg-green-100', text: 'text-green-700', label: 'Active' },
  inactive: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Inactive' },
  suspended: { bg: 'bg-red-100', text: 'text-red-700', label: 'Suspended' },
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending' },
  verified: { bg: 'bg-green-100', text: 'text-green-700', label: 'Verified' },
  unverified: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Unverified' },
  admin: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Admin' },
  manager: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Manager' },
  member: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Member' },
};

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const style = statusStyles[status] || statusStyles.inactive;
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${style.bg} ${style.text} ${sizeClasses}`}>
      {style.label}
    </span>
  );
}
