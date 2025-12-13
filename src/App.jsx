import React, { lazy, Suspense, useEffect, useState, useCallback } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { HelmetProvider, Helmet } from 'react-helmet-async';
import { Toaster } from '@/components/ui/toaster.jsx';
import { toast } from '@/hooks/use-toast';
import { AnimatePresence } from 'framer-motion';

import { useAuth } from '@/contexts/UnifiedAuthContext.jsx';
import { useUnifiedPermissionsSystem as usePermissions } from '@/hooks/useUnifiedPermissionsSystem.jsx';
import Layout from '@/components/Layout.jsx';
import Loader from '@/components/ui/loader.jsx';
import { useAiChat } from './contexts/AiChatContext';
import SuperAiChatDialog from './components/ai/SuperAiChatDialog';
import NotificationsHandler from './contexts/NotificationsHandler';
import EmployeeFollowUpPage from '@/pages/EmployeeFollowUpPage.jsx';
import { useAppStartSync } from '@/hooks/useAppStartSync';
import AppSplashScreen from '@/components/AppSplashScreen.jsx';

import { scrollToTopInstant } from '@/utils/scrollToTop';

// ⚡ Prefetch الصفحات الشائعة عند idle
const prefetchCommonRoutes = () => {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      import('@/pages/Dashboard.jsx');
      import('@/pages/OrdersPage.jsx');
      import('@/pages/QuickOrderPage.jsx');
    });
  }
};

// تنفيذ prefetch بعد 3 ثواني من تحميل الصفحة
if (typeof window !== 'undefined') {
  setTimeout(prefetchCommonRoutes, 3000);
}

const LoginPage = lazy(() => import('@/pages/LoginPage.jsx'));
const UpdatePasswordPage = lazy(() => import('@/pages/UpdatePasswordPage.jsx'));
const Dashboard = lazy(() => import('@/pages/Dashboard.jsx'));
const ProductsPage = lazy(() => import('@/pages/ProductsPage.jsx'));
const ManageProductsPage = lazy(() => import('@/pages/ManageProductsPage.jsx'));
const AddProductPage = lazy(() => import('@/pages/AddProductPage.jsx'));
const ManageVariantsPage = lazy(() => import('@/pages/ManageVariantsPage.jsx'));
const InventoryPage = lazy(() => import('@/pages/InventoryPage.jsx'));
const OrdersPage = lazy(() => import('@/pages/OrdersPage.jsx'));
const PurchasesPage = lazy(() => import('@/pages/PurchasesPage.jsx'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage.jsx'));
const AppearanceSettingsPage = lazy(() => import('@/pages/AppearanceSettingsPage.jsx'));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage.jsx'));
const QuickOrderPage = lazy(() => import('@/pages/QuickOrderPage.jsx'));
const ProfitsSummaryPage = lazy(() => import('@/pages/ProfitsSummaryPage.jsx'));
const ProfitsManagementPage = lazy(() => import('@/pages/ProfitsManagementPage.jsx'));
const AccountingPage = lazy(() => import('@/pages/AccountingPage.jsx'));
const CashManagementPage = lazy(() => import('@/pages/CashManagementPage.jsx'));
const ManageEmployeesPage = lazy(() => import('@/pages/ManageEmployeesPage.jsx'));
const QRLabelsPage = lazy(() => import('@/pages/QRLabelsPage.jsx'));
const AdvancedProfitsAnalysisPage = lazy(() => import('@/pages/AdvancedProfitsAnalysisPage.jsx'));
const CustomersManagementPage = lazy(() => import('@/pages/CustomersManagementPage.jsx'));
const SalesPage = lazy(() => import('@/pages/SalesPage.jsx'));
const PushNotificationControl = lazy(() => import('@/pages/PushNotificationControl.jsx'));
const NotificationTemplates = lazy(() => import('@/pages/NotificationTemplates.jsx'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage.jsx'));
const OrderTrackingPage = lazy(() => import('@/pages/OrderTrackingPage.jsx'));
const DepartmentManagerSettingsPage = lazy(() => import('@/pages/DepartmentManagerSettingsPage.jsx'));

// Employee Storefront Pages
const StorefrontDashboardPage = lazy(() => import('@/pages/employee-storefront/StorefrontDashboardPage.jsx'));
const StorefrontSettingsPage = lazy(() => import('@/pages/employee-storefront/StorefrontSettingsPage.jsx'));
const StorefrontProductsManagePage = lazy(() => import('@/pages/employee-storefront/StorefrontProductsManagePage.jsx'));
const StorefrontPromotionsPage = lazy(() => import('@/pages/employee-storefront/StorefrontPromotionsPage.jsx'));
const StorefrontBannersPage = lazy(() => import('@/pages/employee-storefront/StorefrontBannersPage.jsx'));
const StorefrontOrdersPage = lazy(() => import('@/pages/employee-storefront/StorefrontOrdersPage.jsx'));
const StorefrontSetupWizard = lazy(() => import('@/pages/employee-storefront/StorefrontSetupWizard.jsx'));
const AdvancedSettingsPage = lazy(() => import('@/pages/employee-storefront/AdvancedSettingsPage.jsx'));

// Public Storefront Pages
const StorefrontPage = lazy(() => import('@/pages/StorefrontPage.jsx'));
const StorefrontProductsPage = lazy(() => import('@/pages/StorefrontProductsPage.jsx'));
const StorefrontProductDetailPage = lazy(() => import('@/pages/StorefrontProductDetailPage.jsx'));
const StorefrontCartPage = lazy(() => import('@/pages/StorefrontCartPage.jsx'));
const StorefrontCheckoutPage = lazy(() => import('@/pages/StorefrontCheckoutPage.jsx'));

// Public Storefront Footer Pages
const AboutPage = lazy(() => import('@/pages/storefront/AboutPage.jsx'));
const PrivacyPolicyPage = lazy(() => import('@/pages/storefront/PrivacyPolicyPage.jsx'));
const TermsPage = lazy(() => import('@/pages/storefront/TermsPage.jsx'));
const ReturnPolicyPage = lazy(() => import('@/pages/storefront/ReturnPolicyPage.jsx'));
const ContactPage = lazy(() => import('@/pages/storefront/ContactPage.jsx'));

function ProtectedRoute({ children, permission }) {
  const { user, loading } = useAuth();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  
  // انتظار تحميل البيانات الأساسية أولاً
  if (loading) {
    return <div className="h-screen w-screen flex items-center justify-center bg-background"><Loader /></div>;
  }
  
  // إذا لم يكن هناك مستخدم، انتقل لصفحة تسجيل الدخول
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // فحص إذا كان المستخدم معلق
  if (user.status === 'pending') {
    return <Navigate to="/login" replace />;
  }

  // انتظار تحميل الصلاحيات بعد التأكد من وجود المستخدم
  if (permissionsLoading) {
    return <div className="h-screen w-screen flex items-center justify-center bg-background"><Loader /></div>;
  }

  // فحص الصلاحيات إذا كانت مطلوبة
  if (permission) {
    const requested = Array.isArray(permission) ? permission : [permission];
    const allowedByPerms = requested.some((p) => hasPermission(p));
    const allowedByFlag = requested.some((p) => ['view_customers','manage_all_customers'].includes(p)) && (user?.customer_management_access === true);
    const allowed = allowedByPerms || allowedByFlag;
    if (!allowed) {
      
      // إذا لم يملك المستخدم الصلاحية، انتقل للصفحة الافتراضية
      return <Navigate to={(user && (user.defaultPage || user.default_page)) || '/'} replace />;
    }
  }
  
  return children;
}

// مكون للتمرير لأعلى الصفحة عند تغيير المسار - محسّن لجميع الصفحات
function ScrollToTop() {
  const location = useLocation();
  
  useEffect(() => {
    // تمرير فوري لأعلى الصفحة عند تغيير المسار
    scrollToTopInstant();
    // تأكيد إضافي للتمرير
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location.pathname]);
  
  return null;
}

function AppContent() {
  const { user, loading } = useAuth();
  const { aiChatOpen, setAiChatOpen } = useAiChat();
  const [showSplash, setShowSplash] = useState(() => {
    // التحقق من عرض السبلاش من قبل - مرة واحدة فقط في الجلسة
    const hasShownSplash = sessionStorage.getItem('hasShownSplash');
    return !hasShownSplash;
  });
  
  // Enable app start synchronization
  useAppStartSync();

  useEffect(() => {
    if (showSplash) {
      // انتظار اكتمال السبلاش وحفظ الحالة
      const timer = setTimeout(() => {
        setShowSplash(false);
        sessionStorage.setItem('hasShownSplash', 'true');
      }, 2800); // 2.8 ثانية للسماح بإكمال الأنيميشن
      return () => clearTimeout(timer);
    }
  }, [showSplash]);

  if (showSplash) {
    return (
      <AnimatePresence mode="wait">
        <AppSplashScreen key="splash" onComplete={() => setShowSplash(false)} />
      </AnimatePresence>
    );
  }

  if (loading) {
    return <div className="h-screen w-screen flex items-center justify-center bg-background"><Loader /></div>;
  }

  const childrenWithProps = (Component, props = {}) => (
    <Layout>
      <Component {...props} />
    </Layout>
  );

  return (
    <div className="h-dvh bg-background text-foreground">
       <Helmet>
        <title>RYUS</title>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#ffffff" />
      </Helmet>
      <ScrollToTop />
      <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center bg-background"><Loader /></div>}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/update-password" element={<UpdatePasswordPage />} />
           <Route path="/" element={<ProtectedRoute>{user?.defaultPage && user.defaultPage !== '/' ? <Navigate to={user.defaultPage} replace /> : childrenWithProps(Dashboard)}</ProtectedRoute>} />
          
          <Route path="/quick-order" element={<ProtectedRoute permission="quick_order">{childrenWithProps(QuickOrderPage)}</ProtectedRoute>} />
          <Route path="/products" element={<ProtectedRoute permission="view_products">{childrenWithProps(ProductsPage)}</ProtectedRoute>} />
          <Route path="/manage-products" element={<ProtectedRoute permission="manage_products">{childrenWithProps(ManageProductsPage)}</ProtectedRoute>} />
          <Route path="/products/add" element={<ProtectedRoute permission="manage_products">{childrenWithProps(AddProductPage)}</ProtectedRoute>} />
          <Route path="/add-product" element={<ProtectedRoute permission="manage_products">{childrenWithProps(AddProductPage)}</ProtectedRoute>} />
          <Route path="/manage-variants" element={<ProtectedRoute permission="manage_variants">{childrenWithProps(ManageVariantsPage)}</ProtectedRoute>} />
          <Route path="/inventory" element={<ProtectedRoute permission="view_inventory">{childrenWithProps(InventoryPage)}</ProtectedRoute>} />
          
          <Route path="/employee-follow-up" element={<ProtectedRoute permission="view_all_orders">{childrenWithProps(EmployeeFollowUpPage)}</ProtectedRoute>} />
          <Route path="/my-orders" element={<ProtectedRoute permission="view_orders">{childrenWithProps(OrdersPage)}</ProtectedRoute>} />

          <Route path="/purchases" element={<ProtectedRoute permission="manage_purchases">{childrenWithProps(PurchasesPage)}</ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute permission="view_settings">{childrenWithProps(SettingsPage)}</ProtectedRoute>} />
          <Route path="/appearance-settings" element={<ProtectedRoute>{childrenWithProps(AppearanceSettingsPage)}</ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute>{childrenWithProps(NotificationsPage)}</ProtectedRoute>} />
          
          <Route path="/profits-summary" element={<ProtectedRoute permission="view_own_profits">{childrenWithProps(ProfitsSummaryPage)}</ProtectedRoute>} />
          
          <Route path="/accounting" element={<ProtectedRoute permission="view_accounting">{childrenWithProps(AccountingPage)}</ProtectedRoute>} />
          <Route path="/cash-management" element={<ProtectedRoute permission="view_accounting">{childrenWithProps(CashManagementPage)}</ProtectedRoute>} />
          <Route path="/manage-employees" element={<ProtectedRoute permission="manage_employees">{childrenWithProps(ManageEmployeesPage)}</ProtectedRoute>} />
          <Route path="/qr-labels" element={<ProtectedRoute permission="manage_products">{childrenWithProps(QRLabelsPage)}</ProtectedRoute>} />
          <Route path="/advanced-profits-analysis" element={<ProtectedRoute permission="view_all_profits">{childrenWithProps(AdvancedProfitsAnalysisPage)}</ProtectedRoute>} />
          <Route path="/customers-management" element={<ProtectedRoute permission={['view_customers','manage_all_customers']}>{childrenWithProps(CustomersManagementPage)}</ProtectedRoute>} />
          <Route path="/sales" element={<ProtectedRoute permission="view_orders">{childrenWithProps(SalesPage)}</ProtectedRoute>} />
          <Route path="/push-notification-control" element={<ProtectedRoute>{childrenWithProps(PushNotificationControl)}</ProtectedRoute>} />
          <Route path="/notification-templates" element={<ProtectedRoute>{childrenWithProps(NotificationTemplates)}</ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute>{childrenWithProps(ProfilePage)}</ProtectedRoute>} />
          <Route path="/profile/:identifier" element={<ProtectedRoute>{childrenWithProps(ProfilePage)}</ProtectedRoute>} />
          <Route path="/department-settings" element={<ProtectedRoute>{childrenWithProps(DepartmentManagerSettingsPage)}</ProtectedRoute>} />
          <Route path="/track" element={<OrderTrackingPage />} />
          <Route path="/track/:trackingNumber" element={<OrderTrackingPage />} />
          
          {/* Employee Storefront Dashboard Routes (Protected) */}
          <Route path="/dashboard/storefront" element={<ProtectedRoute>{childrenWithProps(StorefrontDashboardPage)}</ProtectedRoute>} />
          <Route path="/dashboard/storefront/setup-wizard" element={<ProtectedRoute>{childrenWithProps(StorefrontSetupWizard)}</ProtectedRoute>} />
          <Route path="/dashboard/storefront/settings" element={<ProtectedRoute>{childrenWithProps(StorefrontSettingsPage)}</ProtectedRoute>} />
          <Route path="/dashboard/storefront/advanced-settings" element={<ProtectedRoute>{childrenWithProps(AdvancedSettingsPage)}</ProtectedRoute>} />
          <Route path="/dashboard/storefront/products" element={<ProtectedRoute>{childrenWithProps(StorefrontProductsManagePage)}</ProtectedRoute>} />
          <Route path="/dashboard/storefront/promotions" element={<ProtectedRoute>{childrenWithProps(StorefrontPromotionsPage)}</ProtectedRoute>} />
          <Route path="/dashboard/storefront/banners" element={<ProtectedRoute>{childrenWithProps(StorefrontBannersPage)}</ProtectedRoute>} />
          <Route path="/dashboard/storefront/orders" element={<ProtectedRoute>{childrenWithProps(StorefrontOrdersPage)}</ProtectedRoute>} />
          
          {/* Public Storefront Routes (No Auth Required) */}
          <Route path="/storefront/:slug" element={<StorefrontPage />} />
          <Route path="/storefront/:slug/products" element={<StorefrontProductsPage />} />
          <Route path="/storefront/:slug/products/:productId" element={<StorefrontProductDetailPage />} />
          <Route path="/storefront/:slug/cart" element={<StorefrontCartPage />} />
          <Route path="/storefront/:slug/checkout" element={<StorefrontCheckoutPage />} />
          
          {/* Public Storefront Footer Pages */}
          <Route path="/storefront/:slug/about" element={<AboutPage />} />
          <Route path="/storefront/:slug/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/storefront/:slug/terms" element={<TermsPage />} />
          <Route path="/storefront/:slug/return-policy" element={<ReturnPolicyPage />} />
          <Route path="/storefront/:slug/contact" element={<ContactPage />} />
        </Routes>
      </Suspense>
      <Toaster />
      <SuperAiChatDialog open={aiChatOpen} onOpenChange={setAiChatOpen} />
      {user && <NotificationsHandler />}
    </div>
  )
}

function App() {
  return (
    <HelmetProvider>
      <AppContent />
    </HelmetProvider>
  );
}

export default App;