import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  LayoutDashboard,
  Building2,
  Users,
  Globe,
  Mail,
  Video,
  FileText,
  Activity,
  Settings,
  Code2,
  CreditCard,
  X,
  ChevronLeft,
  HardDrive,
  BarChart3,
  RefreshCw,
  Shield,
  Calendar,
  Upload,
  MessageCircle,
} from 'lucide-react';

interface SidebarProps {
  role: 'super_admin' | 'tenant_admin';
  isOpen: boolean;
  onClose: () => void;
  tenantName?: string;
  isInternalMode?: boolean;
}

const superAdminNavigation = [
  { name: 'Dashboard', href: '/super-admin', icon: LayoutDashboard },
  { name: 'Tenants', href: '/super-admin/tenants', icon: Building2 },
  { name: 'Developers', href: '/super-admin/developers', icon: Code2 },
  { name: 'Reports', href: '/super-admin/reports', icon: BarChart3 },
  { name: 'Activity', href: '/super-admin/activity', icon: Activity },
  { name: 'Settings', href: '/super-admin/settings', icon: Settings },
];

const getTenantAdminNavigation = (isInternalMode: boolean) => {
  const baseNavigation = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Users', href: '/admin/users', icon: Users },
    { name: 'Domains', href: '/admin/domains', icon: Globe },
    { name: 'Mail', href: '/admin/mail', icon: Mail },
    { name: 'Meet', href: '/admin/meet', icon: Video },
    { name: 'Docs', href: '/admin/docs', icon: HardDrive },
    { name: 'Resources', href: '/admin/resources', icon: Calendar },
    { name: 'Reports', href: '/admin/reports', icon: BarChart3 },
    { name: 'Activity', href: '/admin/activity', icon: Activity },
    { name: 'Security', href: '/admin/security', icon: Shield },
    { name: 'Migration', href: '/admin/migration', icon: Upload },
  ];

  // Add ERP Sync for internal mode, or Billing for external mode
  if (isInternalMode) {
    baseNavigation.push({ name: 'ERP Sync', href: '/admin/erp-sync', icon: RefreshCw });
  }
  baseNavigation.push({ name: 'Billing', href: '/admin/billing', icon: CreditCard });

  return baseNavigation;
};

export default function Sidebar({ role, isOpen, onClose, tenantName, isInternalMode = false }: SidebarProps) {
  const router = useRouter();
  const navigation = role === 'super_admin' ? superAdminNavigation : getTenantAdminNavigation(isInternalMode);
  const isSuperAdmin = role === 'super_admin';

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-gray-200 transform transition-transform lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between h-16 px-4 border-b ${
          isSuperAdmin ? 'bg-purple-600 border-purple-700' : 'bg-bheem-primary border-blue-600'
        }`}>
          <Link href={isSuperAdmin ? '/super-admin' : '/admin'} className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">B</span>
            </div>
            <div>
              <span className="font-semibold text-white text-sm">
                {isSuperAdmin ? 'Super Admin' : 'Admin'}
              </span>
              {!isSuperAdmin && tenantName && (
                <p className="text-xs text-white/70 truncate max-w-[120px]">{tenantName}</p>
              )}
            </div>
          </Link>
          <button
            className="lg:hidden p-2 text-white/80 hover:text-white"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        {/* Back to Workspace link */}
        <Link
          href="/"
          className="flex items-center space-x-2 px-4 py-3 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 border-b border-gray-100"
        >
          <ChevronLeft size={16} />
          <span>Back to Workspace</span>
        </Link>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = router.pathname === item.href ||
              (item.href !== '/super-admin' && item.href !== '/admin' && router.pathname.startsWith(item.href));

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? isSuperAdmin
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <item.icon size={20} />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-xs text-gray-500">
            {isSuperAdmin ? (
              <p>Platform Administration</p>
            ) : (
              <p>Workspace Administration</p>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
