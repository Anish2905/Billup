/**
 * App Layout
 * Sidebar + Header + main content area
 */

import { Outlet, NavLink } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useUIStore } from '../../store/uiStore';
import { FileText, Users, Package, BarChart3, Settings } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/invoices', icon: FileText, label: 'Invoices' },
  { to: '/parties', icon: Users, label: 'Parties' },
  { to: '/items', icon: Package, label: 'Items' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function AppLayout() {
  const { sidebarCollapsed } = useUIStore();

  return (
    <div className="h-screen flex overflow-hidden bg-surface-0">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200
          ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-60'} mb-16 md:mb-0
        `}
      >
        <Header />

        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-6 pb-20 md:pb-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface-100/95 backdrop-blur-md border-t border-surface-200 z-50 flex items-center justify-around px-2">
         {NAV_ITEMS.map((item) => (
            <NavLink 
              key={item.to} 
              to={item.to}
              className={({isActive}) => `flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive ? 'text-brand-500' : 'text-surface-400'}`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-sans font-medium">{item.label}</span>
            </NavLink>
         ))}
      </nav>
    </div>
  );
}
