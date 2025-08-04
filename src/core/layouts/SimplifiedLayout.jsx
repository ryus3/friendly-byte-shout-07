/**
 * 🎨 Layout مبسط وجميل
 * 
 * يحافظ على التصميم الجميل الحالي مع تبسيط الكود
 * - Sidebar قابل للطي
 * - Navigation بسيط
 * - Dark/Light mode
 * - Mobile responsive
 */

import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Menu, X, Home, Package, ShoppingCart, Users, 
  DollarSign, BarChart3, Settings, Bell, LogOut,
  Store, FileText, TrendingUp, UserCheck
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';
import { useAppData } from '../components/DataProvider';
import BottomNav from '@/components/BottomNav';

// قائمة التنقل الأساسية
const navigationItems = [
  {
    title: 'الرئيسية',
    path: '/',
    icon: Home,
    permission: null
  },
  {
    title: 'طلب سريع',
    path: '/quick-order',
    icon: ShoppingCart,
    permission: 'quick_order'
  },
  {
    title: 'المنتجات',
    path: '/products',
    icon: Package,
    permission: 'view_products'
  },
  {
    title: 'إدارة المنتجات',
    path: '/manage-products',
    icon: Store,
    permission: 'manage_products'
  },
  {
    title: 'المخزون',
    path: '/inventory',
    icon: Package,
    permission: 'view_inventory'
  },
  {
    title: 'الطلبات',
    path: '/my-orders',
    icon: FileText,
    permission: 'view_orders'
  },
  {
    title: 'المحاسبة',
    path: '/accounting',
    icon: DollarSign,
    permission: 'view_accounting'
  },
  {
    title: 'الأرباح',
    path: '/profits-summary',
    icon: TrendingUp,
    permission: 'view_own_profits'
  },
  {
    title: 'الموظفين',
    path: '/manage-employees',
    icon: Users,
    permission: 'manage_employees'
  },
  {
    title: 'التقارير',
    path: '/reports',
    icon: BarChart3,
    permission: 'view_reports'
  },
  {
    title: 'الإعدادات',
    path: '/settings',
    icon: Settings,
    permission: 'view_settings'
  }
];

export const SimplifiedLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { user, hasPermission, logout } = useAppData();
  const location = useLocation();
  const navigate = useNavigate();

  // إغلاق Sidebar عند تغيير المسار
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // فلترة قائمة التنقل حسب الأذونات
  const allowedNavItems = navigationItems.filter(item => 
    !item.permission || hasPermission(item.permission)
  );

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('خطأ في تسجيل الخروج:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between px-4">
          {/* Menu Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(true)}
            className="md:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Logo */}
          <div className="flex items-center space-x-2">
            <div className="font-bold text-xl">RYUS</div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            {allowedNavItems.slice(0, 6).map((item) => (
              <Button
                key={item.path}
                variant={location.pathname === item.path ? "default" : "ghost"}
                size="sm"
                onClick={() => navigate(item.path)}
                className="text-sm"
              >
                <item.icon className="h-4 w-4 mr-2" />
                {item.title}
              </Button>
            ))}
          </nav>

          {/* User Menu */}
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm">
              <Bell className="h-4 w-4" />
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm"
              onClick={toggleTheme}
            >
              {theme === 'dark' ? '🌙' : '☀️'}
            </Button>

            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleLogout}
              className="hidden md:flex"
            >
              <LogOut className="h-4 w-4 mr-2" />
              خروج
            </Button>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
            />
            
            {/* Sidebar */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed top-0 left-0 z-50 h-full w-64 bg-background border-r md:hidden"
            >
              {/* Sidebar Header */}
              <div className="flex items-center justify-between p-4 border-b">
                <div className="font-bold text-lg">RYUS</div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarOpen(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Navigation */}
              <nav className="p-4 space-y-2">
                {allowedNavItems.map((item) => (
                  <Button
                    key={item.path}
                    variant={location.pathname === item.path ? "default" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => navigate(item.path)}
                  >
                    <item.icon className="h-4 w-4 mr-2" />
                    {item.title}
                  </Button>
                ))}
                
                {/* Logout Button */}
                <Button
                  variant="ghost"
                  className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  تسجيل الخروج
                </Button>
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 mb-20 md:mb-0">
        <Outlet />
      </main>

      {/* Bottom Navigation (Mobile) */}
      <BottomNav />
    </div>
  );
};