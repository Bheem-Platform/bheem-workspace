import { ReactNode, useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Menu, Bell, LogOut, ChevronRight } from 'lucide-react';
import Sidebar from './Sidebar';
import { useAdminStore } from '@/stores/adminStore';

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
  breadcrumbs?: { label: string; href?: string }[];
  isSuperAdmin?: boolean;
  isInternalMode?: boolean;
}

export default function AdminLayout({ children, title, breadcrumbs, isSuperAdmin: isSuperAdminProp, isInternalMode = false }: AdminLayoutProps) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { currentTenant, userRole, setUserRole } = useAdminStore();

  // Determine if super admin or tenant admin based on prop or route
  const isSuperAdmin = isSuperAdminProp !== undefined
    ? isSuperAdminProp
    : router.pathname.startsWith('/super-admin');

  useEffect(() => {
    setUserRole(isSuperAdmin ? 'super_admin' : 'tenant_admin');
  }, [isSuperAdmin, setUserRole]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        role={isSuperAdmin ? 'super_admin' : 'tenant_admin'}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        tenantName={currentTenant?.name}
        isInternalMode={isInternalMode}
      />

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className={`sticky top-0 z-30 border-b ${
          isSuperAdmin ? 'bg-purple-600 border-purple-700' : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center justify-between h-16 px-4">
            {/* Mobile menu button */}
            <button
              className={`lg:hidden p-2 ${isSuperAdmin ? 'text-white/80 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={24} />
            </button>

            {/* Title / Breadcrumbs */}
            <div className="flex-1 ml-4 lg:ml-0">
              {breadcrumbs && breadcrumbs.length > 0 ? (
                <nav className="flex items-center space-x-2 text-sm">
                  {breadcrumbs.map((crumb, index) => (
                    <div key={index} className="flex items-center">
                      {index > 0 && (
                        <ChevronRight
                          size={16}
                          className={isSuperAdmin ? 'text-white/50 mx-2' : 'text-gray-400 mx-2'}
                        />
                      )}
                      {crumb.href ? (
                        <Link
                          href={crumb.href}
                          className={isSuperAdmin
                            ? 'text-white/80 hover:text-white'
                            : 'text-gray-500 hover:text-gray-700'
                          }
                        >
                          {crumb.label}
                        </Link>
                      ) : (
                        <span className={isSuperAdmin ? 'text-white font-medium' : 'text-gray-900 font-medium'}>
                          {crumb.label}
                        </span>
                      )}
                    </div>
                  ))}
                </nav>
              ) : title ? (
                <h1 className={`text-lg font-semibold ${isSuperAdmin ? 'text-white' : 'text-gray-900'}`}>
                  {title}
                </h1>
              ) : null}
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-3">
              <button className={`p-2 relative ${
                isSuperAdmin ? 'text-white/80 hover:text-white' : 'text-gray-500 hover:text-gray-700'
              }`}>
                <Bell size={20} />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </button>
              <button
                onClick={() => router.push('/')}
                className={`p-2 ${
                  isSuperAdmin ? 'text-white/80 hover:text-white' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
