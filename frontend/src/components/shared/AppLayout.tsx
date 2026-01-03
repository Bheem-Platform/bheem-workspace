import { useState, useEffect } from 'react';
import Head from 'next/head';
import AppSwitcher, { AppId, AppSwitcherCompact } from './AppSwitcher';
import LoadingOverlay from './LoadingOverlay';
import { useRequireAuth } from '@/stores/authStore';

interface AppLayoutProps {
  children: React.ReactNode;
  activeApp?: AppId;
  title?: string;
  header?: React.ReactNode;
  sidebar?: React.ReactNode;
  sidebarWidth?: number;
  loading?: boolean;
  loadingText?: string;
  fullWidth?: boolean;
  noPadding?: boolean;
  className?: string;
}

export default function AppLayout({
  children,
  activeApp,
  title,
  header,
  sidebar,
  sidebarWidth = 280,
  loading = false,
  loadingText,
  fullWidth = false,
  noPadding = false,
  className = '',
}: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();

  // Detect mobile/tablet
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Calculate left offset based on sidebar state
  const appSwitcherWidth = sidebarCollapsed ? 64 : 240;
  const totalSidebarWidth = sidebar ? sidebarWidth : 0;
  const leftOffset = isMobile ? 0 : appSwitcherWidth;
  const contentLeftOffset = isMobile ? 0 : appSwitcherWidth + totalSidebarWidth;

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingOverlay text="Loading..." />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{title ? `${title} | Bheem Workspace` : 'Bheem Workspace'}</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* App Switcher - Desktop */}
        {!isMobile && (
          <AppSwitcher
            activeApp={activeApp}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        )}

        {/* App Switcher - Mobile (bottom nav) */}
        {isMobile && <AppSwitcherCompact activeApp={activeApp} />}

        {/* App-specific Sidebar */}
        {sidebar && !isMobile && (
          <div
            className="fixed top-0 bottom-0 bg-white border-r border-gray-200 overflow-y-auto z-30"
            style={{
              left: leftOffset,
              width: sidebarWidth,
            }}
          >
            {sidebar}
          </div>
        )}

        {/* Main Content Area */}
        <div
          className={`min-h-screen transition-all duration-300 ${className}`}
          style={{
            marginLeft: isMobile ? 0 : contentLeftOffset,
            paddingBottom: isMobile ? 80 : 0, // Space for mobile nav
          }}
        >
          {/* Header */}
          {header && (
            <header className="sticky top-0 z-20 bg-white border-b border-gray-200">
              {header}
            </header>
          )}

          {/* Content */}
          <main
            className={`
              ${fullWidth ? '' : 'max-w-full'}
              ${noPadding ? '' : 'p-6'}
              ${loading ? 'opacity-50 pointer-events-none' : ''}
            `}
          >
            {children}
          </main>
        </div>

        {/* Loading Overlay */}
        {loading && (
          <LoadingOverlay text={loadingText} fullScreen />
        )}
      </div>
    </>
  );
}

// Three-column layout helper for Mail
interface ThreeColumnLayoutProps {
  left: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode;
  leftWidth?: number;
  centerWidth?: number;
  showRight?: boolean;
}

export function ThreeColumnLayout({
  left,
  center,
  right,
  leftWidth = 240,
  centerWidth = 400,
  showRight = true,
}: ThreeColumnLayoutProps) {
  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Left Panel */}
      <div
        className="flex-shrink-0 border-r border-gray-200 overflow-y-auto bg-white"
        style={{ width: leftWidth }}
      >
        {left}
      </div>

      {/* Center Panel */}
      <div
        className="flex-shrink-0 border-r border-gray-200 overflow-y-auto bg-white"
        style={{ width: centerWidth }}
      >
        {center}
      </div>

      {/* Right Panel */}
      {showRight && (
        <div className="flex-1 overflow-y-auto bg-gray-50">
          {right}
        </div>
      )}
    </div>
  );
}

// Two-column layout helper for Calendar/Docs
interface TwoColumnLayoutProps {
  sidebar: React.ReactNode;
  main: React.ReactNode;
  sidebarWidth?: number;
}

export function TwoColumnLayout({
  sidebar,
  main,
  sidebarWidth = 280,
}: TwoColumnLayoutProps) {
  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Sidebar */}
      <div
        className="flex-shrink-0 border-r border-gray-200 overflow-y-auto bg-white"
        style={{ width: sidebarWidth }}
      >
        {sidebar}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {main}
      </div>
    </div>
  );
}
