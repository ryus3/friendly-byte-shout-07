import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider, Helmet } from 'react-helmet-async';
import { Toaster } from '@/components/ui/toaster.jsx';
import { AppProviders } from '@/contexts/Providers.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import Layout from '@/components/Layout.jsx';
import Loader from '@/components/ui/loader.jsx';
import { useAiChat } from './contexts/AiChatContext';
import AiChatDialog from './components/ai/AiChatDialog';
import NotificationsHandler from './contexts/NotificationsHandler';
import EmployeeFollowUpPage from '@/pages/EmployeeFollowUpPage.jsx';
import ProfitSettlementPage from '@/pages/ProfitSettlementPage.jsx';

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
const QuickOrderPage = lazy(() => import('@/pages/QuickOrderPage.jsx'));
const ProfitsSummaryPage = lazy(() => import('@/pages/ProfitsSummaryPage.jsx'));
const AccountingPage = lazy(() => import('@/pages/AccountingPage.jsx'));
const ManageEmployeesPage = lazy(() => import('@/pages/ManageEmployeesPage.jsx'));

function ProtectedRoute({ children, permission }) {
  const { user, loading, hasPermission } = useAuth();
  
  if (loading) {
    return <div className="h-screen w-screen flex items-center justify-center bg-background"><Loader /></div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (permission && !hasPermission(permission)) {
    return <Navigate to={user.defaultPage || '/'} replace />;
  }
  
  return children;
}

function AppContent() {
  const { user } = useAuth();
  const { aiChatOpen, setAiChatOpen } = useAiChat();

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
      <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center bg-background"><Loader /></div>}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/update-password" element={<UpdatePasswordPage />} />
          <Route path="/" element={<ProtectedRoute>{user?.defaultPage && user.defaultPage !== '/' ? <Navigate to={user.defaultPage} replace /> : childrenWithProps(Dashboard)}</ProtectedRoute>} />
          
          <Route path="/quick-order" element={<ProtectedRoute permission="create_order">{childrenWithProps(QuickOrderPage)}</ProtectedRoute>} />
          <Route path="/products" element={<ProtectedRoute permission="view_products">{childrenWithProps(ProductsPage)}</ProtectedRoute>} />
          <Route path="/manage-products" element={<ProtectedRoute permission="manage_products">{childrenWithProps(ManageProductsPage)}</ProtectedRoute>} />
          <Route path="/products/add" element={<ProtectedRoute permission="manage_products">{childrenWithProps(AddProductPage)}</ProtectedRoute>} />
          <Route path="/manage-variants" element={<ProtectedRoute permission="manage_variants">{childrenWithProps(ManageVariantsPage)}</ProtectedRoute>} />
          <Route path="/inventory" element={<ProtectedRoute permission="view_inventory">{childrenWithProps(InventoryPage)}</ProtectedRoute>} />
          
          <Route path="/employee-follow-up" element={<ProtectedRoute permission="view_all_orders">{childrenWithProps(EmployeeFollowUpPage)}</ProtectedRoute>} />
          <Route path="/my-orders" element={<ProtectedRoute permission="view_orders">{childrenWithProps(OrdersPage)}</ProtectedRoute>} />

          <Route path="/purchases" element={<ProtectedRoute permission="view_purchases">{childrenWithProps(PurchasesPage)}</ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute permission="view_settings">{childrenWithProps(SettingsPage)}</ProtectedRoute>} />
          
          <Route path="/profits-summary" element={<ProtectedRoute permission="view_profits">{childrenWithProps(ProfitsSummaryPage)}</ProtectedRoute>} />
          <Route path="/profit-settlement/:employeeId" element={<ProtectedRoute permission="manage_profit_settlement">{childrenWithProps(ProfitSettlementPage)}</ProtectedRoute>} />
          <Route path="/accounting" element={<ProtectedRoute permission="view_accounting">{childrenWithProps(AccountingPage)}</ProtectedRoute>} />
          <Route path="/manage-employees" element={<ProtectedRoute permission="manage_users">{childrenWithProps(ManageEmployeesPage)}</ProtectedRoute>} />

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
        <Router>
          <AppProviders>
            <AppContent />
          </AppProviders>
        </Router>
    </HelmetProvider>
  );
}

export default App;