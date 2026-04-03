import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  FileText,
  ClipboardCheck,
  LayoutDashboard,
  Upload,
  Users,
  BarChart3,
  LogOut,
  Menu,
  X,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { t, i18n } = useTranslation();
  const { user, isAdmin, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleLanguage = () => {
    const newLang = i18n.language === 'ru' ? 'kk' : 'ru';
    i18n.changeLanguage(newLang);
    localStorage.setItem('language', newLang);
  };

  const employeeNav = [
    { path: '/documents', label: t('nav.documents'), icon: FileText },
    { path: '/tests', label: t('nav.tests'), icon: ClipboardCheck },
  ];

  const adminNav = [
    { path: '/admin', label: t('nav.dashboard'), icon: LayoutDashboard },
    { path: '/admin/documents', label: t('nav.uploadDocs'), icon: Upload },
    { path: '/admin/users', label: t('nav.users'), icon: Users },
    { path: '/admin/reports', label: t('nav.reports'), icon: BarChart3 },
  ];

  const navItems = [...employeeNav, ...(isAdmin ? adminNav : [])];

  return (
    <div className="min-h-screen flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 bg-white border-r transform transition-transform lg:translate-x-0 lg:static lg:z-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-5 border-b">
            <Shield className="h-8 w-8 text-primary" />
            <div className="flex-1">
              <h1 className="font-bold text-sm">Crystal Spring</h1>
              <p className="text-xs text-muted-foreground">{t('nav.portal')}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLanguage}
              className="text-xs gap-1 px-2"
            >
              {i18n.language === 'ru' ? (
                <><span className="font-bold">РУС</span><span className="text-muted-foreground">|</span><span>ҚАЗ</span></>
              ) : (
                <><span>РУС</span><span className="text-muted-foreground">|</span><span className="font-bold">ҚАЗ</span></>
              )}
            </Button>
            <button
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path ||
                (item.path !== '/' && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User info */}
          <div className="border-t px-4 py-4">
            <div className="flex items-center gap-3">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="h-8 w-8 rounded-full"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-medium">
                  {user?.name?.[0] || '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={logout} title={t('nav.logout')}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-4 px-4 py-3 border-b bg-white">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">{t('nav.portal')}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleLanguage}
            className="ml-auto text-xs gap-1"
          >
            {i18n.language === 'ru' ? (
              <><span className="font-bold">РУС</span><span className="text-muted-foreground">|</span><span>ҚАЗ</span></>
            ) : (
              <><span>РУС</span><span className="text-muted-foreground">|</span><span className="font-bold">ҚАЗ</span></>
            )}
          </Button>
        </header>

        <main className="flex-1 p-6 bg-gray-50/50">
          {children}
        </main>
      </div>
    </div>
  );
}
