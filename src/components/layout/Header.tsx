/**
 * Header Component
 * Page title, offline banner, quick actions
 */


import { useLocation } from 'react-router-dom';
import { Menu, LogOut, WifiOff } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { useSyncStore } from '../../store/syncStore';

const PAGE_TITLES: Record<string, string> = {
  '/invoices': 'Invoices',
  '/parties': 'Parties',
  '/items': 'Items',
  '/reports': 'Reports',
  '/settings': 'Settings',
};

export function Header() {
  const location = useLocation();
  const { setSidebarMobileOpen } = useUIStore();
  const { isOnline } = useSyncStore();
  const { logout } = useAuthStore();

  // Find matching title
  const title = Object.entries(PAGE_TITLES).find(([path]) =>
    location.pathname.startsWith(path)
  )?.[1] || 'Dashboard';

  // Sub-title for specific routes
  const getSubTitle = () => {
    if (location.pathname === '/invoices/new') return 'New Invoice';
    if (location.pathname.match(/^\/invoices\/.+/)) return 'Edit Invoice';
    return null;
  };

  const subTitle = getSubTitle();

  return (
    <>
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center gap-2 text-amber-400 text-xs font-medium animate-slide-in">
          <WifiOff className="w-3.5 h-3.5" />
          You're offline — changes will sync when connection is restored
        </div>
      )}

      <header className="sticky top-0 z-30 h-14 bg-surface-0/80 backdrop-blur-md border-b border-surface-100 flex items-center gap-4 px-6">
        {/* Mobile menu toggle */}
        <button
          onClick={() => setSidebarMobileOpen(true)}
          className="lg:hidden btn-icon text-surface-400"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-surface-800 truncate">{title}</h1>
            {subTitle && (
              <>
                <span className="text-surface-300">/</span>
                <span className="text-sm text-surface-500">{subTitle}</span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={logout}
            className="btn-ghost btn-sm text-surface-400 hover:text-red-400"
            title="Lock screen"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Lock</span>
          </button>
        </div>
      </header>
    </>
  );
}
