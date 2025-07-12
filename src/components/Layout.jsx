import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Menu, X, Home, Package, Warehouse, ShoppingCart, TrendingUp, LogOut, User,
  Settings, PackagePlus, Users, Briefcase, Sun, Moon, Bot, ArrowRight, Zap, DollarSign, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { toast } from '@/components/ui/use-toast.js';
import { useTheme } from '@/contexts/ThemeContext.jsx';
import NotificationsPanel from '@/components/NotificationsPanel.jsx';
import BottomNav from '@/components/BottomNav.jsx';
import { useAiChat } from '@/contexts/AiChatContext.jsx';
import AiChatDialog from '@/components/ai/AiChatDialog.jsx';
import QuickOrderDialog from '@/components/quick-order/QuickOrderDialog.jsx';
import { useMediaQuery } from '@/hooks/useMediaQuery.js';
import FloatingCartButton from '@/components/orders/FloatingCartButton.jsx';
import CartDialog from '@/components/orders/CartDialog.jsx';

const SidebarContent = ({ onClose }) => {
  const { user, logout, hasPermission } = useAuth();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const menuItems = [
    { path: '/', icon: Home, label: 'لوحة التحكم', permission: 'view_dashboard' },
    { path: '/quick-order', icon: Zap, label: 'طلب سريع', permission: 'create_order' },
    { path: '/my-orders', icon: ShoppingCart, label: 'طلباتي', permission: 'view_orders' },
    { path: '/employee-follow-up', icon: Users, label: 'متابعة الموظفين', permission: 'view_all_orders' },
    { path: '/products', icon: Package, label: 'المنتجات', permission: 'view_products' },
    { path: '/manage-products', icon: PackagePlus, label: 'ادارة المنتجات', permission: 'manage_products' },
    { path: '/inventory', icon: Warehouse, label: 'الجرد التفصيلي', permission: 'view_inventory' },
    { path: '/purchases', icon: TrendingUp, label: 'المشتريات', permission: 'view_purchases' },
    { path: '/accounting', icon: DollarSign, label: 'المركز المالي', permission: 'view_accounting' },
    { path: '/settings', icon: Settings, label: 'الاعدادات', permission: 'view_settings' }
  ];
  
  const visibleMenuItems = menuItems.filter(item => hasPermission(item.permission));

  const handleNavigation = (path) => {
    if (location.pathname === path) {
      if (onClose) onClose();
      return;
    }
    navigate(path);
  };

  const handleLogout = async () => {
    if (onClose) onClose();
    await logout();
    navigate('/login');
    toast({ title: "تم تسجيل الخروج بنجاح", description: "نراك قريباً!" });
  };
  
  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const getRoleDisplayName = (role) => {
    switch (role) {
      case 'admin': return 'مدير';
      case 'deputy': return 'نائب مدير';
      case 'employee': return 'موظف';
      case 'warehouse': return 'مسؤول مخزن';
      default: return 'مستخدم';
    }
  };

  return (
    <>
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{user?.full_name}</h3>
              <p className="text-sm text-muted-foreground">{getRoleDisplayName(user?.role)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9">
              <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
                <X className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <React.Fragment key={item.path}>
                <div
                  className={`sidebar-item ${isActive ? 'active' : ''}`}
                  onClick={() => handleNavigation(item.path)}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </div>
              </React.Fragment>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <Button
            variant="outline"
            className="w-full justify-start gap-3 text-red-500 border-red-500/50 hover:bg-red-500/10 hover:text-red-500"
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5" />
            <span>تسجيل الخروج</span>
          </Button>
        </div>
      </div>
    </>
  );
};

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { aiChatOpen, setAiChatOpen } = useAiChat();
  const [dialogs, setDialogs] = useState({ cart: false, quickOrder: false });
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { user } = useAuth();

  useEffect(() => {
    if (sidebarOpen) {
      setSidebarOpen(false);
    }
  }, [location]);

  const childrenWithProps = React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child);
    }
    return child;
  });

  const handlePan = (event, info) => {
    if (window.innerWidth < 1024) {
      if (info.offset.x < -60 && Math.abs(info.velocity.x) > 150 && Math.abs(info.offset.y) < 60) {
        setSidebarOpen(true);
      }
      if (sidebarOpen && info.offset.x > 60 && Math.abs(info.velocity.x) > 150 && Math.abs(info.offset.y) < 60) {
        setSidebarOpen(false);
      }
    }
  };

  const handleOpenQuickOrder = () => {
    setDialogs({ cart: false, quickOrder: true });
  };

  const handleHomeClick = () => {
    navigate(user?.default_page || '/');
  };

  return (
    <div className="flex h-dvh bg-background">
      <div className="hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0 lg:right-0 lg:z-50 bg-card border-l border-border">
        <SidebarContent onClose={() => setSidebarOpen(false)} />
      </div>

      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ x: 300 }}
            animate={{ x: 0 }}
            exit={{ x: 300 }}
            transition={{ type: "spring", damping: 30, stiffness: 250 }}
            className="fixed inset-y-0 right-0 z-50 w-72 bg-card border-l border-border lg:hidden"
            dir="rtl"
          >
            <SidebarContent onClose={() => setSidebarOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        className="flex-1 flex flex-col lg:mr-72"
        onPan={handlePan}
      >
        <header className="bg-card/80 backdrop-blur-lg border-b border-border p-4 sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden"
              >
                <Menu className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowRight className="w-5 h-5" />
              </Button>
              <div className="cursor-pointer" onClick={handleHomeClick}>
                <img className="h-14 w-auto hidden dark:block mix-blend-screen" alt="RYUS BRAND Logo Dark" src="https://storage.googleapis.com/hostinger-horizons-assets-prod/1f3b5d57-e29a-4462-965e-89e9a8cac3f1/2e94508b11f0bf0fa626aea4716f1658.png" />
                <img className="h-14 w-auto block dark:hidden mix-blend-multiply" alt="RYUS BRAND Logo Light" src="https://storage.googleapis.com/hostinger-horizons-assets-prod/1f3b5d57-e29a-4462-965e-89e9a8cac3f1/c5b1cd2be0f791e7e3cb0e078059203a.png" />
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4">
              <Button variant="ghost" size="icon" onClick={() => setAiChatOpen(true)} className="hidden md:inline-flex">
                <Bot className="w-5 h-5" />
              </Button>
              <NotificationsPanel />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 lg:pb-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.key || location.pathname}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              {childrenWithProps}
            </motion.div>
          </AnimatePresence>
        </main>
        
        <BottomNav />
        {!isMobile && <FloatingCartButton onOpenCart={() => setDialogs(prev => ({ ...prev, cart: true }))} />}
      </motion.div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <AiChatDialog open={aiChatOpen} onOpenChange={setAiChatOpen} />
      <CartDialog 
        open={dialogs.cart} 
        onOpenChange={(open) => setDialogs(prev => ({ ...prev, cart: open }))}
        onCheckout={handleOpenQuickOrder}
      />
      <QuickOrderDialog 
        open={dialogs.quickOrder} 
        onOpenChange={(open) => setDialogs(prev => ({ ...prev, quickOrder: open }))}
      />
    </div>
  );
};

export default Layout;