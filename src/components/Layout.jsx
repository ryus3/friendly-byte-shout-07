import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Menu, X, Home, Package, Warehouse, ShoppingCart, TrendingUp, LogOut, User,
  Settings, PackagePlus, Users, Briefcase, Sun, Moon, Bot, ArrowRight, Zap, DollarSign, Shield, RefreshCw, Bell, Wallet, Heart
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
import AiOrdersManager from '@/components/dashboard/AiOrdersManager.jsx';

const SidebarContent = ({ onClose, isMobile }) => {
  const { user, logout } = useAuth();
  const { hasPermission } = usePermissions();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const menuItems = [
    { path: '/', icon: Home, label: 'لوحة التحكم', roles: ['super_admin', 'admin', 'department_manager', 'sales_employee', 'warehouse_employee', 'cashier'], color: 'text-blue-500' },
    { path: '/quick-order', icon: Zap, label: 'طلب سريع', roles: ['super_admin', 'admin', 'department_manager', 'sales_employee', 'cashier'], color: 'text-yellow-500' },
    { path: '/my-orders', icon: ShoppingCart, label: user?.roles?.includes('super_admin') || user?.roles?.includes('admin') ? 'متابعة الطلبات' : 'طلباتي', roles: ['super_admin', 'admin', 'department_manager', 'sales_employee', 'warehouse_employee', 'cashier'], color: 'text-green-500' },
    { path: '/profits-summary', icon: Wallet, label: 'أرباحي', roles: ['department_manager', 'sales_employee', 'warehouse_employee', 'cashier'], color: 'text-emerald-600' },
    { path: '/employee-follow-up', icon: Users, label: 'متابعة الموظفين', roles: ['super_admin', 'admin'], color: 'text-purple-500' },
    { path: '/products', icon: Package, label: 'المنتجات', roles: ['super_admin', 'admin', 'department_manager', 'sales_employee', 'warehouse_employee', 'cashier'], color: 'text-orange-500' },
    { path: '/manage-products', icon: PackagePlus, label: 'ادارة المنتجات', roles: ['super_admin', 'admin', 'department_manager'], color: 'text-cyan-500' },
    { path: '/customers-management', icon: Heart, label: 'إدارة العملاء', roles: ['super_admin', 'admin', 'department_manager'], color: 'text-rose-500' },
    { path: '/inventory', icon: Warehouse, label: 'الجرد التفصيلي', roles: ['super_admin', 'admin', 'department_manager', 'sales_employee', 'warehouse_employee'], color: 'text-pink-500' },
    { path: '/purchases', icon: TrendingUp, label: 'المشتريات', roles: ['super_admin', 'admin', 'department_manager'], color: 'text-emerald-500' },
    { path: '/accounting', icon: DollarSign, label: 'المركز المالي', roles: ['super_admin', 'admin'], color: 'text-indigo-500' },
    { path: '/notifications', icon: Bell, label: 'الإشعارات', roles: ['super_admin', 'admin', 'department_manager', 'sales_employee', 'warehouse_employee', 'cashier'], color: 'text-red-500' },
    { path: '/settings', icon: Settings, label: 'الاعدادات', roles: ['super_admin', 'admin', 'department_manager', 'sales_employee', 'warehouse_employee', 'cashier'], color: 'text-gray-500' }
  ];
  
  // فلترة القائمة حسب الأدوار
  const visibleMenuItems = useMemo(() => {
    if (!user?.roles || user.roles.length === 0) return [];
    
    return menuItems.filter(item => {
      // التحقق من وجود أي دور مسموح في أدوار المستخدم
      return item.roles.some(role => user.roles.includes(role));
    });
  }, [menuItems, user?.roles]);

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

  const getRoleDisplayName = () => {
    if (!user?.roles || user.roles.length === 0) return 'مستخدم';
    
    // الحصول على أعلى دور حسب الأولوية
    const roleMapping = {
      'super_admin': 'المدير العام',
      'admin': 'مدير', 
      'department_manager': 'مدير قسم',
      'sales_employee': 'موظف مبيعات',
      'warehouse_employee': 'موظف مخزن',
      'cashier': 'أمين صندوق'
    };
    
    // ترتيب الأولوية للأدوار
    const rolePriority = ['super_admin', 'admin', 'department_manager', 'sales_employee', 'warehouse_employee', 'cashier'];
    
    for (const role of rolePriority) {
      if (user.roles.includes(role)) {
        return roleMapping[role] || 'موظف';
      }
    }
    
    return 'موظف';
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
              <p className="text-sm text-muted-foreground">{getRoleDisplayName()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9">
              <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
            {onClose && isMobile && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onClose} 
                className="rounded-md w-10 h-10 bg-background/90 backdrop-blur-sm border border-border/60 text-muted-foreground hover:text-foreground hover:bg-background transition-all duration-300 hover:scale-110 shadow-lg hover:shadow-xl group hover:border-primary/50"
              >
                <X className="w-4 h-4 transition-all duration-300 group-hover:rotate-90 group-hover:scale-110" />
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
                  <Icon className={`w-5 h-5 ${isActive ? '' : item.color}`} />
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
  const [aiOrdersOpen, setAiOrdersOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { user } = useAuth();

  // Listen for AI orders manager events
  useEffect(() => {
    const handleOpenAiOrders = (event) => {
      setAiOrdersOpen(true);
    };
    
    window.addEventListener('openAiOrdersManager', handleOpenAiOrders);
    
    return () => {
      window.removeEventListener('openAiOrdersManager', handleOpenAiOrders);
    };
  }, []);

  // استقبال إشارة فتح السايدبار من الشريط السفلي
  useEffect(() => {
    const handleToggleSidebar = () => {
      setSidebarOpen(prev => !prev);
    };
    
    window.addEventListener('toggle-sidebar', handleToggleSidebar);
    return () => window.removeEventListener('toggle-sidebar', handleToggleSidebar);
  }, []);

  useEffect(() => {
    if (sidebarOpen) {
      setSidebarOpen(false);
    }
    // Scroll to top عند تغيير الصفحة
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      <div className="hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0 lg:right-0 lg:z-[60] bg-card border-l border-border">
        <SidebarContent isMobile={isMobile} />
      </div>

      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ x: 300 }}
            animate={{ x: 0 }}
            exit={{ x: 300 }}
            transition={{ type: "spring", damping: 30, stiffness: 250 }}
            className="fixed inset-y-0 right-0 z-[60] w-72 bg-card border-l border-border lg:hidden"
            dir="rtl"
          >
            <SidebarContent onClose={() => setSidebarOpen(false)} isMobile={isMobile} />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        className="flex-1 flex flex-col lg:mr-72"
        onPan={handlePan}
      >
        <header className="bg-card/80 backdrop-blur-lg border-b border-border p-3 sm:p-4 sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {location.pathname !== (user?.default_page || '/') && (
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                  <ArrowRight className="w-5 h-5" />
                </Button>
              )}
              <div className="cursor-pointer" onClick={handleHomeClick}>
                <img className="h-14 w-auto hidden dark:block mix-blend-screen" alt="RYUS BRAND Logo Dark" src="https://storage.googleapis.com/hostinger-horizons-assets-prod/1f3b5d57-e29a-4462-965e-89e9a8cac3f1/2e94508b11f0bf0fa626aea4716f1658.png" />
                <img className="h-14 w-auto block dark:hidden mix-blend-multiply" alt="RYUS BRAND Logo Light" src="https://storage.googleapis.com/hostinger-horizons-assets-prod/1f3b5d57-e29a-4462-965e-89e9a8cac3f1/c5b1cd2be0f791e7e3cb0e078059203a.png" />
              </div>
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2 md:gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  const refreshBtn = e.currentTarget.querySelector('.refresh-icon');
                  if (refreshBtn) {
                    refreshBtn.classList.add('animate-spin');
                   }
                   
                   try {
                     // إظهار إشعار فوري بدء التحديث
                     toast({ 
                       title: "🔄 جاري التحديث...", 
                       description: "يتم تحديث الطلبات والبيانات الجديدة (المخزون محفوظ)",
                       className: "z-[9999] text-right",
                     });

                     // استدعاء تحديث واحد فقط بدلاً من multiple events
                     if (window.refreshInventory) {
                       await window.refreshInventory();
                     }

                     // تحديث الإشعارات أيضاً
                     window.dispatchEvent(new CustomEvent('refresh-notifications'));
                     
                     await new Promise(resolve => setTimeout(resolve, 800));
                     
                     toast({ 
                       title: "✅ تم التحديث بنجاح!", 
                       description: "تم تحديث جميع البيانات والطلبات والإشعارات بنجاح",
                       className: "z-[9999] text-right bg-green-500 text-white border-green-600",
                       duration: 3000
                     });
                  } catch (error) {
                    console.error('خطأ في تحديث البيانات:', error);
                    toast({ 
                      title: "❌ خطأ في التحديث", 
                      description: "فشل في تحديث بعض البيانات",
                      variant: "destructive",
                      className: "z-[9999] text-right",
                    });
                  } finally {
                    if (refreshBtn) {
                      refreshBtn.classList.remove('animate-spin');
                    }
                  }
                }} 
                className="text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                title="مزامنة البيانات"
              >
                <RefreshCw className="w-5 h-5 refresh-icon" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setAiChatOpen(true)} className="hidden md:inline-flex">
                <Bot className="w-5 h-5" />
              </Button>
              <NotificationsPanel />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 pb-24 lg:pb-6">
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
          className="fixed inset-0 bg-black/60 z-[55] lg:hidden"
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
        
        <AnimatePresence>
          {aiOrdersOpen && (
            <AiOrdersManager onClose={() => setAiOrdersOpen(false)} />
          )}
        </AnimatePresence>
      </div>
    );
  };

export default Layout;