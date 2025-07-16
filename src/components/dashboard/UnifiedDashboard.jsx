import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import useUnifiedPermissions from '@/hooks/useUnifiedPermissions';
import { useInventory } from '@/contexts/InventoryContext';
import { useProfits } from '@/contexts/ProfitsContext';
import { 
  TrendingUp, 
  DollarSign, 
  Package, 
  ShoppingCart, 
  Users, 
  Bot,
  MapPin,
  AlertTriangle,
  CheckCircle,
  Clock,
  Star
} from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';
import WelcomeHeader from '@/components/dashboard/WelcomeHeader';
import EmployeeStatsCards from '@/components/dashboard/EmployeeStatsCards';
import ManagerDashboardSection from '@/components/dashboard/ManagerDashboardSection';
import AiOrdersManager from '@/components/dashboard/AiOrdersManager';
import QuickActionsPanel from '@/components/dashboard/QuickActionsPanel';
import RecentOrdersCard from '@/components/dashboard/RecentOrdersCard';
import TopPerformanceCards from '@/components/dashboard/TopPerformanceCards';

const UnifiedDashboard = () => {
  const navigate = useNavigate();
  const {
    user,
    isAdmin,
    isDepartmentManager,
    isSalesEmployee,
    isWarehouseEmployee,
    canViewAllData,
    hasPermission,
    filterDataByUser,
    getEmployeeStats,
    loading: permissionsLoading
  } = useUnifiedPermissions();

  const { 
    orders, 
    aiOrders, 
    products, 
    loading: inventoryLoading 
  } = useInventory();
  
  const { profits } = useProfits();

  const [currentTime, setCurrentTime] = useState(new Date());

  // تحديث الوقت كل دقيقة
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  // حساب الإحصائيات حسب نوع المستخدم
  const dashboardStats = React.useMemo(() => {
    if (!orders || !profits) return null;

    if (canViewAllData) {
      // إحصائيات شاملة للمدير
      return {
        totalOrders: orders?.length || 0,
        pendingOrders: orders?.filter(o => o.status === 'pending')?.length || 0,
        completedOrders: orders?.filter(o => o.status === 'completed')?.length || 0,
        totalRevenue: orders?.reduce((sum, o) => sum + (o.final_amount || 0), 0) || 0,
        totalProducts: products?.length || 0,
        lowStockProducts: products?.filter(p => (p.stock_quantity || 0) < (p.min_stock || 5))?.length || 0,
        aiOrdersCount: aiOrders?.length || 0,
        pendingProfits: profits?.filter(p => p.status === 'pending')?.reduce((sum, p) => sum + (p.profit_amount || 0), 0) || 0
      };
    } else {
      // إحصائيات شخصية للموظف
      return getEmployeeStats(orders, profits);
    }
  }, [orders, profits, products, aiOrders, canViewAllData, getEmployeeStats]);

  const loading = permissionsLoading || inventoryLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">جاري تحميل لوحة التحكم...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <Helmet>
        <title>
          {isAdmin ? 'لوحة تحكم المدير' : 
           isDepartmentManager ? 'لوحة تحكم مدير القسم' :
           'لوحة التحكم الشخصية'} - نظام إدارة المخزون
        </title>
      </Helmet>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* ترحيب مخصص */}
        <WelcomeHeader 
          user={user} 
          isAdmin={isAdmin}
          isDepartmentManager={isDepartmentManager}
          currentTime={currentTime}
        />

        {/* الإحصائيات الرئيسية */}
        {canViewAllData ? (
          // إحصائيات المدير الشاملة
          <ManagerDashboardSection 
            stats={dashboardStats}
            orders={orders}
            aiOrders={aiOrders}
            profits={profits}
            products={products}
          />
        ) : (
          // إحصائيات الموظف الشخصية
          <EmployeeStatsCards 
            stats={dashboardStats}
            userRole={user?.role}
            canRequestSettlement={hasPermission('view_own_profits')}
          />
        )}

        {/* الأقسام حسب نوع المستخدم */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* العمود الأيسر */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* طلبات الذكاء الاصطناعي */}
            {hasPermission('view_ai_orders') && (
              <AiOrdersManager 
                aiOrders={canViewAllData ? aiOrders : filterDataByUser(aiOrders)}
                isManager={canViewAllData}
              />
            )}

            {/* الطلبات الحديثة */}
            {hasPermission('view_orders') && (
              <RecentOrdersCard 
                orders={canViewAllData ? orders?.slice(0, 10) : filterDataByUser(orders)?.slice(0, 10)}
                onViewAll={() => navigate('/orders')}
                isPersonal={!canViewAllData}
              />
            )}

            {/* أفضل الأداء */}
            {(hasPermission('view_products') || hasPermission('view_orders')) && (
              <TopPerformanceCards 
                orders={canViewAllData ? orders : filterDataByUser(orders)}
                products={products}
                isPersonal={!canViewAllData}
              />
            )}
          </div>

          {/* العمود الأيمن */}
          <div className="space-y-6">
            
            {/* لوحة الإجراءات السريعة */}
            <QuickActionsPanel 
              userPermissions={{
                canCreateOrder: hasPermission('create_orders'),
                canManageProducts: hasPermission('manage_products'),
                canViewInventory: hasPermission('view_inventory'),
                canManageEmployees: hasPermission('manage_employees'),
                canViewAccounting: hasPermission('view_accounting'),
                canRequestSettlement: hasPermission('view_own_profits'),
                canUseBarcode: hasPermission('use_barcode_scanner'),
                canQuickOrder: hasPermission('quick_order')
              }}
              navigate={navigate}
            />

            {/* معلومات إضافية حسب الدور */}
            {isWarehouseEmployee && (
              <div className="bg-card rounded-lg border p-4">
                <h3 className="font-semibold text-lg mb-3 flex items-center">
                  <Package className="ml-2 h-5 w-5 text-orange-500" />
                  معلومات المخزن
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>إجمالي المنتجات:</span>
                    <span className="font-medium">{products?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>منتجات منخفضة المخزون:</span>
                    <span className="font-medium text-orange-600">
                      {dashboardStats?.lowStockProducts || 0}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* معلومات التليغرام للموظف */}
            {!isAdmin && (
              <div className="bg-card rounded-lg border p-4">
                <h3 className="font-semibold text-lg mb-3 flex items-center">
                  <Bot className="ml-2 h-5 w-5 text-blue-500" />
                  كود التليغرام
                </h3>
                <div className="text-center space-y-2">
                  <div className="text-2xl font-bold text-primary bg-primary/10 rounded-lg py-2">
                    {user?.telegram_code || 'غير متاح'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    استخدم هذا الكود لربط حسابك ببوت التليغرام
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnifiedDashboard;