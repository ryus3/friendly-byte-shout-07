/**
 * 🏠 لوحة التحكم المبسطة
 * 
 * نموذج للوحة تحكم جديدة:
 * - بيانات من API واحد
 * - إحصائيات بسيطة
 * - تصميم جميل
 * - أداء سريع
 */

import React from 'react';
import { 
  TrendingUp, Package, ShoppingCart, Users, 
  DollarSign, AlertTriangle, Plus, Eye 
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { useData } from '@/core/hooks/useData';
import { useAppData } from '@/core/components/DataProvider';

export const DashboardNew = () => {
  const { user, hasPermission } = useAppData();

  // البيانات الأساسية للوحة التحكم
  const { data: todayStats, loading: statsLoading } = useData('dashboard_stats', {
    autoLoad: true,
    useCache: false // إحصائيات حية
  });

  const { data: recentOrders } = useData('orders', {
    filters: { 
      created_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }
    },
    select: 'id, order_number, customer_name, total_amount, status, created_at',
    autoLoad: true
  });

  const { data: lowStockProducts } = useData('products', {
    filters: { stock_level: { lt: 10 } },
    select: 'id, name, stock_level',
    autoLoad: true
  });

  // الإحصائيات الافتراضية
  const stats = todayStats?.[0] || {
    total_sales: 0,
    total_orders: 0,
    total_products: 0,
    total_customers: 0,
    pending_orders: 0,
    low_stock_items: 0
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">
          مرحباً، {user?.full_name || 'المستخدم'} 👋
        </h1>
        <p className="text-muted-foreground">
          نظرة عامة على نشاطات اليوم
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {hasPermission('view_accounting') && (
          <StatCard
            title="مبيعات اليوم"
            value={`${stats.total_sales?.toLocaleString()} د.ع`}
            icon={DollarSign}
            trend="+12%"
            trendUp={true}
          />
        )}
        
        {hasPermission('view_orders') && (
          <StatCard
            title="الطلبات"
            value={stats.total_orders}
            icon={ShoppingCart}
            subtitle={`${stats.pending_orders} قيد التجهيز`}
          />
        )}
        
        {hasPermission('view_products') && (
          <StatCard
            title="المنتجات"
            value={stats.total_products}
            icon={Package}
            subtitle={`${stats.low_stock_items} مخزون منخفض`}
            alert={stats.low_stock_items > 0}
          />
        )}
        
        {hasPermission('view_customers') && (
          <StatCard
            title="العملاء"
            value={stats.total_customers}
            icon={Users}
          />
        )}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>إجراءات سريعة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {hasPermission('quick_order') && (
              <QuickActionButton
                title="طلب سريع"
                icon={Plus}
                href="/quick-order"
              />
            )}
            
            {hasPermission('manage_products') && (
              <QuickActionButton
                title="إضافة منتج"
                icon={Package}
                href="/products/add"
              />
            )}
            
            {hasPermission('view_reports') && (
              <QuickActionButton
                title="التقارير"
                icon={TrendingUp}
                href="/reports"
              />
            )}
            
            {hasPermission('view_inventory') && (
              <QuickActionButton
                title="المخزون"
                icon={Eye}
                href="/inventory"
              />
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        {hasPermission('view_orders') && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>آخر الطلبات</CardTitle>
              <Button variant="ghost" size="sm">
                عرض الكل
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentOrders?.slice(0, 5).map((order) => (
                  <OrderItem key={order.id} order={order} />
                ))}
                
                {(!recentOrders || recentOrders.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    لا توجد طلبات حديثة
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Low Stock Alerts */}
        {hasPermission('view_inventory') && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                تنبيهات المخزون
              </CardTitle>
              <Button variant="ghost" size="sm">
                عرض الكل
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {lowStockProducts?.slice(0, 5).map((product) => (
                  <LowStockItem key={product.id} product={product} />
                ))}
                
                {(!lowStockProducts || lowStockProducts.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    جميع المنتجات في مستوى آمن
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

// مكون بطاقة الإحصائيات
const StatCard = ({ title, value, icon: Icon, trend, trendUp, subtitle, alert }) => (
  <Card>
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="space-y-1">
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && (
              <p className={`text-xs ${alert ? 'text-orange-600' : 'text-muted-foreground'}`}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <div className={`p-2 rounded-full ${alert ? 'bg-orange-100' : 'bg-primary/10'}`}>
          <Icon className={`h-5 w-5 ${alert ? 'text-orange-600' : 'text-primary'}`} />
        </div>
      </div>
      
      {trend && (
        <div className="mt-4">
          <span className={`text-xs font-medium ${trendUp ? 'text-green-600' : 'text-red-600'}`}>
            {trend} من الأمس
          </span>
        </div>
      )}
    </CardContent>
  </Card>
);

// مكون الإجراء السريع
const QuickActionButton = ({ title, icon: Icon, href }) => (
  <Button 
    variant="outline" 
    className="h-20 flex-col gap-2"
    onClick={() => window.location.href = href}
  >
    <Icon className="h-5 w-5" />
    <span className="text-xs">{title}</span>
  </Button>
);

// مكون عنصر الطلب
const OrderItem = ({ order }) => {
  const getStatusBadge = (status) => {
    const statusMap = {
      pending: { label: 'قيد التجهيز', variant: 'secondary' },
      completed: { label: 'مكتمل', variant: 'default' },
      cancelled: { label: 'ملغى', variant: 'destructive' }
    };
    
    const statusInfo = statusMap[status] || { label: status, variant: 'outline' };
    
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{order.order_number}</span>
          {getStatusBadge(order.status)}
        </div>
        <p className="text-sm text-muted-foreground">{order.customer_name}</p>
      </div>
      <div className="text-right space-y-1">
        <p className="font-medium">{order.total_amount?.toLocaleString()} د.ع</p>
        <p className="text-xs text-muted-foreground">
          {new Date(order.created_at).toLocaleDateString('ar')}
        </p>
      </div>
    </div>
  );
};

// مكون عنصر المخزون المنخفض
const LowStockItem = ({ product }) => (
  <div className="flex items-center justify-between p-3 border rounded-lg">
    <div className="space-y-1">
      <p className="font-medium">{product.name}</p>
      <p className="text-sm text-muted-foreground">رقم المنتج: {product.id}</p>
    </div>
    <Badge variant="destructive">
      {product.stock_level} قطعة
    </Badge>
  </div>
);

export default DashboardNew;