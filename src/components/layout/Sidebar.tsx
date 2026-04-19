/**
 * Sidebar Navigation
 * Collapsible, icon-only mode, active route highlighting, sync badge in footer
 */


import { NavLink, useLocation } from 'react-router-dom';
import {
  FileText, Users, Package, BarChart3, Settings,
  ChevronLeft, ChevronRight, Zap,
} from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { SyncBadge } from './SyncBadge';
import { APP_NAME } from '../../lib/constants';

const NAV_ITEMS = [
  { to: '/invoices', icon: FileText, label: 'Invoices' },
  { to: '/parties', icon: Users, label: 'Parties' },
  { to: '/items', icon: Package, label: 'Items' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const location = useLocation();

  return (
    <aside
      className={`
        fixed top-0 left-0 h-screen z-40
        bg-surface-0 border-r border-surface-100
        hidden md:flex flex-col transition-all duration-200
        ${sidebarCollapsed ? 'w-16' : 'w-60'}
      `}
    >
      {/* Header / Brand */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-surface-100 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-brand-500/15 flex items-center justify-center shrink-0">
          <Zap className="w-4 h-4 text-brand-400" />
        </div>
        {!sidebarCollapsed && (
          <div className="overflow-hidden animate-fade-in">
            <p className="text-sm font-bold text-surface-800 truncate leading-tight">
              {APP_NAME.split(' ')[0]}
            </p>
            <p className="text-xxs text-surface-400 truncate leading-tight">
              Billing System
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              className={isActive ? 'sidebar-link-active' : 'sidebar-link'}
              title={sidebarCollapsed ? label : undefined}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {!sidebarCollapsed && (
                <span className="truncate animate-fade-in">{label}</span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer — Sync Badge + Collapse Toggle */}
      <div className="border-t border-surface-100 p-2 space-y-2 shrink-0">
        <SyncBadge collapsed={sidebarCollapsed} />
        
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center gap-2 p-2 rounded-lg
                     text-surface-400 hover:text-surface-600 hover:bg-surface-100
                     transition-colors"
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span className="text-xs">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
