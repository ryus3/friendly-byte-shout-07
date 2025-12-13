import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useUnifiedPermissionsSystem as usePermissions } from '@/hooks/useUnifiedPermissionsSystem.jsx';
import { useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Menu, X, Home, Package, Warehouse, ShoppingCart, ShoppingBag, TrendingUp, LogOut, User,
  Settings, PackagePlus, Users, Briefcase, Sun, Moon, Bot, ArrowRight, Zap, DollarSign, Shield, RefreshCw, Bell, Wallet, Heart, Store
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
import SyncStatusIndicator from '@/components/SyncStatusIndicator.jsx';
import { Helmet } from 'react-helmet-async';
import ryusLogo from '@/assets/ryus-logo-new.png';

const SidebarContent = ({ onClose, isMobile }) => {
  const { user, logout } = useAuth();
  const { hasPermission } = usePermissions();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const menuItems = [
    { path: '/', icon: Home, label: 'لوحة التحكم', roles: ['super_admin', 'admin', 'department_manager', 'sales_employee', 'warehouse_employee', 'cashier'], color: 'text-blue-500' },
    { path: '/quick-order', icon: Zap, label: 'طلب سريع', roles: ['super_admin', 'admin', 'department_manager', 'sales_employee', 'cashier'], color: 'text-yellow-500' },
    { 
      path: '/dashboard/storefront', 
      icon: Store, 
      label: (user?.roles?.includes('super_admin') || user?.roles?.includes('admin')) ? 'المتجر' : 'متجري',
      roles: ['super_admin', 'admin', 'department_manager', 'sales_employee'], 
      requiresStorefrontAccess: true, 
      color: 'text-fuchsia-500' 
    },
    { path: '/my-orders', icon: ShoppingCart, label: user?.roles?.includes('super_admin') || user?.roles?.includes('admin') ? 'متابعة الطلبات' : 'طلباتي', roles: ['super_admin', 'admin', 'department_manager', 'sales_employee', 'warehouse_employee', 'cashier'], color: 'text-green-500' },
    { path: '/profits-summary', icon: Wallet, label: 'أرباحي', roles: ['department_manager', 'sales_employee', 'warehouse_employee', 'cashier'], color: 'text-emerald-600' },
    { path: '/sales', icon: TrendingUp, label: 'المبيعات', roles: ['super_admin', 'admin', 'department_manager', 'sales_employee', 'warehouse_employee', 'cashier'], color: 'text-cyan-600' },
    { path: '/employee-follow-up', icon: Users, label: 'متابعة الموظفين', roles: ['super_admin', 'admin', 'department_manager'], color: 'text-purple-500' },
    { path: '/products', icon: Package, label: 'المنتجات', roles: ['super_admin', 'admin', 'department_manager', 'sales_employee', 'warehouse_employee', 'cashier'], color: 'text-orange-500' },
    { path: '/manage-products', icon: PackagePlus, label: 'ادارة المنتجات', roles: ['super_admin', 'admin'], requiresPermission: 'manage_products', color: 'text-cyan-500' },
    { path: '/customers-management', icon: Heart, label: 'إدارة العملاء', roles: ['super_admin', 'admin', 'department_manager', 'sales_employee', 'warehouse_employee', 'cashier'], requiresCustomerAccess: true, color: 'text-rose-500' },
    { path: '/inventory', icon: Warehouse, label: 'الجرد التفصيلي', roles: ['super_admin', 'admin', 'department_manager', 'sales_employee', 'warehouse_employee'], color: 'text-pink-500' },
    { path: '/purchases', icon: ShoppingBag, label: 'المشتريات', roles: ['super_admin', 'admin'], color: 'text-blue-500' },
    { path: '/accounting', icon: DollarSign, label: 'المركز المالي', roles: ['super_admin', 'admin'], color: 'text-indigo-500' },
    { path: '/notifications', icon: Bell, label: 'الإشعارات', roles: ['super_admin', 'admin', 'department_manager', 'sales_employee', 'warehouse_employee', 'cashier'], color: 'text-red-500' },
    { path: '/department-settings', icon: Users, label: 'إعدادات القسم', roles: ['department_manager'], color: 'text-violet-500' },
    { path: '/settings', icon: Settings, label: 'الاعدادات', roles: ['super_admin', 'admin', 'department_manager', 'sales_employee', 'warehouse_employee', 'cashier'], color: 'text-gray-500' }
  ];
  
  // فلترة القائمة حسب الأدوار
  const visibleMenuItems = useMemo(() => {
    if (!user?.roles || user.roles.length === 0) return [];
    
    return menuItems.filter(item => {
      // التحقق من وجود أي دور مسموح في أدوار المستخدم
      const hasRole = item.roles.some(role => user.roles.includes(role));
      
      // فحص الصلاحيات الخاصة - التحقق من صلاحية إدارة العملاء
      if (item.requiresCustomerAccess) {
        const hasCustomerPermission = hasPermission('view_customers') || hasPermission('manage_all_customers') || user?.customer_management_access === true;
        return hasRole && hasCustomerPermission;
      }
      
      // فحص الصلاحيات الخاصة - التحقق من صلاحية المتجر الإلكتروني
      if (item.requiresStorefrontAccess) {
        return hasRole && user?.has_storefront_access === true;
      }
      
      // فحص الصلاحيات الخاصة - التحقق من صلاحية إدارة المنتجات
      if (item.requiresPermission) {
        // المدير العام والأدمن لديهم الصلاحية تلقائياً
        const isAdminUser = user?.roles?.includes('admin') || user?.roles?.includes('super_admin');
        if (isAdminUser) return true;
        // لمدير القسم: يجب أن يملك الصلاحية
        return hasRole && hasPermission(item.requiresPermission);
      }
      
      return hasRole;
    });
  }, [menuItems, user?.roles, user?.customer_management_access, user?.has_storefront_access]);

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
          <div 
            className="flex items-center gap-3 cursor-pointer hover:bg-secondary/50 p-2 rounded-lg transition-all duration-200 flex-1"
            onClick={() => navigate(user?.username ? `/profile/${user.username}` : '/profile')}
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-purple-600 flex items-center justify-center shadow-md">
              <User className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-foreground truncate">{user?.full_name}</h3>
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
  const [aiOrderForEdit, setAiOrderForEdit] = useState(null);
  const [aiOrderHighlightId, setAiOrderHighlightId] = useState(null);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { user } = useAuth();

  // Listen for AI orders manager events
  useEffect(() => {
    const handleOpenAiOrders = (event) => {
      const id = event?.detail?.aiOrderId || null;
      setAiOrderHighlightId(id);
      setAiOrdersOpen(true);
    };
    
    window.addEventListener('openAiOrdersManager', handleOpenAiOrders);
    
    return () => {
      window.removeEventListener('openAiOrdersManager', handleOpenAiOrders);
    };
  }, []);

  // Listen for opening Quick Order with AI data
  useEffect(() => {
    const handleOpenQuickOrderWithAi = (e) => {
      const data = e?.detail || null;
      setAiOrderForEdit(data);
      setDialogs({ cart: false, quickOrder: true });
    };
    window.addEventListener('openQuickOrderWithAi', handleOpenQuickOrderWithAi);
    return () => window.removeEventListener('openQuickOrderWithAi', handleOpenQuickOrderWithAi);
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
    
    // ✅ إغلاق dialogs عند تغيير المسار
    setDialogs({ cart: false, quickOrder: false });
    setAiOrderForEdit(null);
    
    // Scroll to top عند تغيير الصفحة
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname]);

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

  const canonicalUrl = typeof window !== 'undefined' ? `${window.location.origin}${location.pathname}` : '';

  return (
    <div className="flex h-dvh bg-background">
      <Helmet>
        <title>RYUS | نظام إدارة المخزون والطلبات</title>
        <meta name="description" content="نظام احترافي لإدارة المخزون والطلبات والإحصائيات والفلاتر في RYUS." />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>
<div className="hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0 lg:right-0 lg:z-[60] bg-card border-l border-border">
  {/* Sidebar ثابتة لسطح المكتب */}
  <SidebarContent isMobile={false} />
</div>

{/* Sidebar متحركة للجوال - خارج حاوية سطح المكتب حتى لا تُخفى */}
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
                <img src={ryusLogo} alt="RYUS" className="h-14 w-auto transition-opacity duration-300" />
              </div>
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2 md:gap-4">
              <SyncStatusIndicator />
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
          onOpenChange={(open) => {
            if (!open) setAiOrderForEdit(null);
            setDialogs(prev => ({ ...prev, quickOrder: open }));
          }} 
          aiOrderData={aiOrderForEdit}
        />
        
        <AnimatePresence>
          {aiOrdersOpen && (
            <AiOrdersManager 
              highlightId={aiOrderHighlightId}
              onClose={() => { setAiOrdersOpen(false); setAiOrderHighlightId(null); }} 
            />
          )}
        </AnimatePresence>
      </div>
    );
  };

export default Layout;