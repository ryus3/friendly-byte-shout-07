import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { toast } from '@/components/ui/use-toast';
import { CheckCircle, XCircle, AlertTriangle, TrendingUp, TrendingDown, BarChart3, Package, Users, ShoppingCart } from 'lucide-react';

const SystemStatusDashboard = () => {
  const { 
    products, 
    orders, 
    settings,
    accounting,
    purchases
  } = useInventory();
  
  const { allUsers } = useAuth();
  
  const [showDetails, setShowDetails] = useState(false);

  // حساب الإحصائيات الحقيقية للنظام
  const systemStats = useMemo(() => {
    const safeOrders = Array.isArray(orders) ? orders : [];
    const safeProducts = Array.isArray(products) ? products : [];
    const safeUsers = Array.isArray(allUsers) ? allUsers : [];
    const safePurchases = Array.isArray(purchases) ? purchases : [];
    
    // إحصائيات الطلبات
    const totalOrders = safeOrders.length;
    const deliveredOrders = safeOrders.filter(o => o.status === 'delivered' || o.status === 'completed').length;
    const pendingOrders = safeOrders.filter(o => o.status === 'pending').length;
    const totalRevenue = safeOrders
      .filter(o => o.status === 'delivered' || o.status === 'completed')
      .reduce((sum, o) => sum + (o.final_amount || 0), 0);

    // إحصائيات المخزون
    const totalProducts = safeProducts.length;
    const totalVariants = safeProducts.reduce((sum, p) => sum + (p.variants?.length || 0), 0);
    const totalStock = safeProducts.reduce((sum, p) => 
      sum + (p.variants?.reduce((vSum, v) => vSum + (v.quantity || 0), 0) || 0), 0
    );
    const lowStockItems = safeProducts.reduce((sum, p) => 
      sum + (p.variants?.filter(v => (v.quantity || 0) <= 5).length || 0), 0
    );

    // إحصائيات المستخدمين
    const activeUsers = safeUsers.filter(u => u.is_active).length;
    const employeeUsers = safeUsers.filter(u => u.role === 'employee').length;
    const adminUsers = safeUsers.filter(u => u.role === 'admin').length;

    // إحصائيات المالية
    const totalExpenses = Array.isArray(accounting?.expenses) 
      ? accounting.expenses.reduce((sum, e) => sum + (e.amount || 0), 0) 
      : 0;
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100) : 0;

    // إحصائيات المشتريات
    const totalPurchases = safePurchases.length;
    const totalPurchaseAmount = safePurchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);
    const pendingPurchases = safePurchases.filter(p => p.status === 'pending').length;

    return {
      orders: { total: totalOrders, delivered: deliveredOrders, pending: pendingOrders, revenue: totalRevenue },
      inventory: { products: totalProducts, variants: totalVariants, stock: totalStock, lowStock: lowStockItems },
      users: { total: safeUsers.length, active: activeUsers, employees: employeeUsers, admins: adminUsers },
      finance: { revenue: totalRevenue, expenses: totalExpenses, profit: netProfit, margin: profitMargin },
      purchases: { total: totalPurchases, amount: totalPurchaseAmount, pending: pendingPurchases }
    };
  }, [orders, products, allUsers, accounting, purchases]);

  // تحديد حالة النظام
  const systemHealth = useMemo(() => {
    const issues = [];
    
    if (systemStats.inventory.lowStock > 10) {
      issues.push({ type: 'warning', message: `${systemStats.inventory.lowStock} منتج بمخزون منخفض` });
    }
    
    if (systemStats.orders.pending > 20) {
      issues.push({ type: 'warning', message: `${systemStats.orders.pending} طلب معلق` });
    }
    
    if (systemStats.finance.margin < 10) {
      issues.push({ type: 'error', message: 'هامش الربح منخفض جداً' });
    }
    
    if (systemStats.users.active < 2) {
      issues.push({ type: 'warning', message: 'عدد المستخدمين النشطين قليل' });
    }

    const status = issues.length === 0 ? 'excellent' : 
                  issues.filter(i => i.type === 'error').length > 0 ? 'poor' : 'good';

    return { status, issues };
  }, [systemStats]);

  const getHealthColor = () => {
    switch (systemHealth.status) {
      case 'excellent': return 'text-green-500';
      case 'good': return 'text-yellow-500';
      case 'poor': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getHealthIcon = () => {
    switch (systemHealth.status) {
      case 'excellent': return CheckCircle;
      case 'good': return AlertTriangle;
      case 'poor': return XCircle;
      default: return AlertTriangle;
    }
  };

  const HealthIcon = getHealthIcon();

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            حالة النظام
          </span>
          <div className="flex items-center gap-2">
            <HealthIcon className={`w-5 h-5 ${getHealthColor()}`} />
            <Badge variant={systemHealth.status === 'excellent' ? 'default' : 
                          systemHealth.status === 'good' ? 'secondary' : 'destructive'}>
              {systemHealth.status === 'excellent' ? 'ممتاز' : 
               systemHealth.status === 'good' ? 'جيد' : 'يحتاج انتباه'}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* الإحصائيات الرئيسية */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <ShoppingCart className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-lg font-bold">{systemStats.orders.total}</p>
              <p className="text-sm text-muted-foreground">إجمالي الطلبات</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <Package className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-lg font-bold">{systemStats.inventory.products}</p>
              <p className="text-sm text-muted-foreground">المنتجات</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <Users className="w-8 h-8 text-purple-500" />
            <div>
              <p className="text-lg font-bold">{systemStats.users.active}</p>
              <p className="text-sm text-muted-foreground">مستخدمين نشطين</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <TrendingUp className="w-8 h-8 text-orange-500" />
            <div>
              <p className="text-lg font-bold">{systemStats.finance.margin.toFixed(1)}%</p>
              <p className="text-sm text-muted-foreground">هامش الربح</p>
            </div>
          </div>
        </div>

        {/* التفاصيل المالية */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 border rounded-lg">
            <p className="text-sm text-muted-foreground">إجمالي المبيعات</p>
            <p className="text-2xl font-bold text-green-500">{systemStats.finance.revenue.toLocaleString()} د.ع</p>
          </div>
          <div className="p-4 border rounded-lg">
            <p className="text-sm text-muted-foreground">إجمالي المصاريف</p>
            <p className="text-2xl font-bold text-red-500">{systemStats.finance.expenses.toLocaleString()} د.ع</p>
          </div>
          <div className="p-4 border rounded-lg">
            <p className="text-sm text-muted-foreground">صافي الربح</p>
            <p className={`text-2xl font-bold ${systemStats.finance.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {systemStats.finance.profit.toLocaleString()} د.ع
            </p>
          </div>
        </div>

        {/* التحذيرات والمشاكل */}
        {systemHealth.issues.length > 0 && (
          <div className="space-y-2">
            <p className="font-semibold text-orange-600">تحذيرات النظام:</p>
            {systemHealth.issues.map((issue, index) => (
              <div key={index} className={`p-3 rounded-lg flex items-center gap-2 ${
                issue.type === 'error' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' :
                'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300'
              }`}>
                {issue.type === 'error' ? 
                  <XCircle className="w-4 h-4" /> : 
                  <AlertTriangle className="w-4 h-4" />
                }
                <span className="text-sm">{issue.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* زر التفاصيل */}
        <Button 
          variant="outline" 
          onClick={() => setShowDetails(!showDetails)}
          className="w-full"
        >
          {showDetails ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}
        </Button>

        {/* التفاصيل الإضافية */}
        {showDetails && (
          <div className="space-y-4 pt-4 border-t">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-semibold">تفاصيل الطلبات:</h4>
                <div className="text-sm space-y-1">
                  <p>• طلبات مكتملة: {systemStats.orders.delivered}</p>
                  <p>• طلبات معلقة: {systemStats.orders.pending}</p>
                  <p>• متوسط قيمة الطلب: {(systemStats.orders.revenue / Math.max(systemStats.orders.delivered, 1)).toLocaleString()} د.ع</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-semibold">تفاصيل المخزون:</h4>
                <div className="text-sm space-y-1">
                  <p>• إجمالي المتغيرات: {systemStats.inventory.variants}</p>
                  <p>• إجمالي المخزون: {systemStats.inventory.stock}</p>
                  <p>• منتجات بمخزون منخفض: {systemStats.inventory.lowStock}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-semibold">تفاصيل المستخدمين:</h4>
                <div className="text-sm space-y-1">
                  <p>• إداريين: {systemStats.users.admins}</p>
                  <p>• موظفين: {systemStats.users.employees}</p>
                  <p>• إجمالي المستخدمين: {systemStats.users.total}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-semibold">تفاصيل المشتريات:</h4>
                <div className="text-sm space-y-1">
                  <p>• إجمالي المشتريات: {systemStats.purchases.total}</p>
                  <p>• قيمة المشتريات: {systemStats.purchases.amount.toLocaleString()} د.ع</p>
                  <p>• مشتريات معلقة: {systemStats.purchases.pending}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SystemStatusDashboard;