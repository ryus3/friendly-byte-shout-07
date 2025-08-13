import React, { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { HelmetProvider, Helmet } from 'react-helmet-async';
import { Toaster } from '@/components/ui/toaster.jsx';
import { toast } from '@/hooks/use-toast';

import { useAuth } from '@/contexts/UnifiedAuthContext.jsx';
import { usePermissions } from '@/hooks/usePermissions.js';
import Layout from '@/components/Layout.jsx';
import Loader from '@/components/ui/loader.jsx';
import { useAiChat } from './contexts/AiChatContext';
import AiChatDialog from './components/ai/AiChatDialog';
import NotificationsHandler from './contexts/NotificationsHandler';
import EmployeeFollowUpPage from '@/pages/EmployeeFollowUpPage.jsx';

import { scrollToTopInstant } from '@/utils/scrollToTop';

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
      console.warn('🚫 ProtectedRoute blocked access', { requested, allowedByPerms, allowedByFlag, userDefault: user?.defaultPage || user?.default_page });
      // إذا لم يملك المستخدم الصلاحية، انتقل للصفحة الافتراضية
      return <Navigate to={(user && (user.defaultPage || user.default_page)) || '/'} replace />;
    }
  }
  
  return children;
}

// مكون للتمرير لأعلى الصفحة عند تغيير المسار
function ScrollToTop() {
  const location = useLocation();
  
  useEffect(() => {
    scrollToTopInstant();
  }, [location.pathname]);
  
  return null;
}

function AppContent() {
  const { user, loading } = useAuth();
  const { aiChatOpen, setAiChatOpen } = useAiChat();

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

          <Route path="/purchases" element={<ProtectedRoute permission="view_purchases">{childrenWithProps(PurchasesPage)}</ProtectedRoute>} />
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

        </Routes>
      </Suspense>
      <Toaster />
      <AiChatDialog open={aiChatOpen} onOpenChange={setAiChatOpen} />
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