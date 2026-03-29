import { Outlet, NavLink } from 'react-router-dom';
import { Receipt, Package, BarChart3, Settings, User, Store } from 'lucide-react';
import { cn } from '../../core/utils/cn';
import { useAuthStore } from '../auth/store/useAuthStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/database';

export function Layout() {
  const { user } = useAuthStore();
  const shopProfile = useLiveQuery(() => db.shops.toCollection().first());

  const navItems = [
    { to: '/billing', icon: Receipt, label: 'Billing' },
    { to: '/inventory', icon: Package, label: 'Inventory' },
    { to: '/reports', icon: BarChart3, label: 'Reports' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="flex flex-col h-screen bg-[#F2F2F7] text-[#1C1C1E] font-sans">
      {/* Mobile Header with Logo */}
      <header className="md:hidden bg-white border-b border-[#C6C6C8]/50 h-14 flex items-center px-4 shrink-0 z-40">
        <div className="flex items-center gap-2">
          {shopProfile?.logoPath ? (
            <img src={shopProfile.logoPath} alt="Logo" className="w-8 h-8 rounded-lg object-cover border border-[#C6C6C8]/30" />
          ) : (
            <div className="w-8 h-8 bg-[#007AFF]/10 text-[#007AFF] rounded-lg flex items-center justify-center">
              <Store className="w-5 h-5" />
            </div>
          )}
          <span className="font-bold text-lg truncate text-[#1C1C1E]">{shopProfile?.name || 'POS App'}</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-20 md:pb-0 md:pl-24">
        <Outlet />
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-[#C6C6C8] pb-safe z-50">
        <div className="flex justify-around items-center h-16">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors',
                  isActive ? 'text-[#007AFF]' : 'text-[#6E6E73]'
                )
              }
            >
              <item.icon className="w-6 h-6" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Tablet Sidebar */}
      <nav className="hidden md:flex flex-col fixed top-0 left-0 bottom-0 w-24 bg-white/80 backdrop-blur-md border-r border-[#C6C6C8] py-6 z-50 justify-between">
        <div className="flex flex-col items-center space-y-6">
          {/* Logo Placeholder */}
          <div className="mb-4 flex flex-col items-center justify-center">
            {shopProfile?.logoPath ? (
              <img src={shopProfile.logoPath} alt="Logo" className="w-12 h-12 rounded-xl object-cover shadow-sm border border-[#C6C6C8]/30" />
            ) : (
              <div className="w-12 h-12 bg-[#007AFF]/10 text-[#007AFF] rounded-xl flex items-center justify-center shadow-sm">
                <Store className="w-7 h-7" />
              </div>
            )}
          </div>

          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center p-3 rounded-2xl transition-all',
                  isActive
                    ? 'bg-[#007AFF]/10 text-[#007AFF]'
                    : 'text-[#6E6E73] hover:bg-gray-100'
                )
              }
            >
              <item.icon className="w-7 h-7 mb-1" />
              <span className="text-[11px] font-medium">{item.label}</span>
            </NavLink>
          ))}
        </div>
        
        {/* User Profile Indicator */}
        <div className="flex flex-col items-center justify-center p-3">
          <div className="w-10 h-10 bg-[#007AFF]/10 text-[#007AFF] rounded-full flex items-center justify-center font-bold text-lg mb-1">
            {user?.name?.charAt(0).toUpperCase() || <User className="w-5 h-5" />}
          </div>
          <span className="text-[10px] font-medium text-[#6E6E73] truncate w-full text-center">
            {user?.name}
          </span>
        </div>
      </nav>
    </div>
  );
}
