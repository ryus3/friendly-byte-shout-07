import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  TrendingDown,
  Download, 
  FileText, 
  Calendar as CalendarIcon,
  Filter,
  Package,
  DollarSign,
  Users,
  ShoppingCart,
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
  Target,
  Eye,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Calculator,
  Wallet
} from 'lucide-react';
import { motion } from 'framer-motion';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays } from 'date-fns';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, BarChart, Bar, PieChart as RechartsPieChart, Legend } from 'recharts';
import { cn } from '@/lib/utils';
import { useFinancialSystem } from '@/hooks/useFinancialSystem';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { TIME_PERIODS } from '@/lib/financial-constants';

/**
 * نظام التحليلات الموحد المتصل بالنظام المالي
 */
const UnifiedAnalyticsSystem = () => {
  const { products, orders, loading } = useInventory();
  const { allUsers } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [timePeriod, setTimePeriod] = useState(TIME_PERIODS.MONTH);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customDateRange, setCustomDateRange] = useState(null);

  // جلب البيانات المالية الموحدة
  const financialData = useFinancialSystem(timePeriod);

  // معالجة البيانات للرسوم البيانية مع فلترة صحيحة
  const analyticsData = useMemo(() => {
    if (!orders || loading || financialData.loading) return null;

    
    
    // فلترة الطلبات حسب الفترة الزمنية بدقة
    const filteredOrders = orders.filter(order => {
      const orderDate = new Date(order.created_at);
      const now = new Date();
      
      switch (timePeriod) {
        case TIME_PERIODS.TODAY:
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          return orderDate >= today && orderDate < tomorrow;
          
        case TIME_PERIODS.WEEK:
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return orderDate >= weekAgo;
          
        case TIME_PERIODS.MONTH:
          const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          return orderDate >= startMonth && orderDate <= endMonth;
          
        case TIME_PERIODS.YEAR:
          const startYear = new Date(now.getFullYear(), 0, 1);
          const endYear = new Date(now.getFullYear(), 11, 31);
          return orderDate >= startYear && orderDate <= endYear;
          
        case TIME_PERIODS.ALL:
        default:
          return true;
      }
    });

    

    // إحصائيات المبيعات الحقيقية
    const completedOrdersData = filteredOrders.filter(o => o.status === 'completed' || o.status === 'delivered');
    const salesStats = {
      totalOrders: filteredOrders.length,
      completedOrders: completedOrdersData.length,
      pendingOrders: filteredOrders.filter(o => o.status === 'pending').length,
      cancelledOrders: filteredOrders.filter(o => o.status === 'cancelled').length,
      totalRevenue: completedOrdersData.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0),
      averageOrderValue: 0,
      conversionRate: 0
    };

    salesStats.averageOrderValue = salesStats.completedOrders > 0 
      ? salesStats.totalRevenue / salesStats.completedOrders 
      : 0;
    
    salesStats.conversionRate = salesStats.totalOrders > 0 
      ? (salesStats.completedOrders / salesStats.totalOrders) * 100 
      : 0;

    // إحصائيات المخزون (لا تتأثر بالفترة الزمنية)
    const inventoryStats = {
      totalProducts: products?.length || 0,
      totalVariants: products?.reduce((sum, p) => sum + (p.variants?.length || 0), 0) || 0,
      totalStock: products?.reduce((sum, p) => 
        sum + (p.variants?.reduce((vSum, v) => vSum + (Number(v.quantity) || 0), 0) || 0), 0
      ) || 0,
      lowStockCount: products?.filter(p => 
        p.variants?.some(v => (Number(v.quantity) || 0) > 0 && (Number(v.quantity) || 0) <= 5)
      ).length || 0,
      outOfStockCount: products?.filter(p => 
        p.variants?.every(v => (Number(v.quantity) || 0) === 0)
      ).length || 0,
      totalValue: products?.reduce((sum, p) => 
        sum + (p.variants?.reduce((vSum, v) => vSum + ((Number(v.quantity) || 0) * (Number(v.cost_price) || 0)), 0) || 0), 0
      ) || 0
    };

    

    return {
      sales: salesStats,
      inventory: inventoryStats
    };
  }, [orders, products, timePeriod, loading, financialData.loading]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ar-IQ', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0) + ' د.ع';
  };

  // أزرار الفترات السريعة
  const quickDateRanges = [
    { label: 'اليوم', value: TIME_PERIODS.TODAY },
    { label: 'آخر 7 أيام', value: TIME_PERIODS.WEEK },
    { label: 'هذا الشهر', value: TIME_PERIODS.MONTH },
    { label: 'هذا العام', value: TIME_PERIODS.YEAR },
  ];

  const handlePeriodChange = (newPeriod) => {
    setTimePeriod(newPeriod);
    financialData.refreshData();
  };

  if (loading || !analyticsData || financialData.loading) {
    return (
      <div className="flex justify-center items-center h-64 space-y-4">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-lg font-medium">جاري تحليل البيانات...</p>
          <p className="text-sm text-muted-foreground">يتم إعداد التقارير من النظام المالي الموحد</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4"
      >
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                التحليلات
              </h1>
              <p className="text-muted-foreground">تحليل شامل متصل بالنظام المالي الموحد</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            متصل بالنظام المالي
          </Badge>
          <Button variant="outline" size="sm" onClick={() => financialData.refreshData()}>
            <RefreshCw className="w-4 h-4 ml-1" />
            تحديث
          </Button>
        </div>
      </motion.div>

      {/* تبويبات التحليلات - بدون فلتر مكرر */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-12">
            <TabsTrigger value="dashboard" className="gap-2">
              <Eye className="w-4 h-4" />
              لوحة القيادة
            </TabsTrigger>
            <TabsTrigger value="financial" className="gap-2">
              <Calculator className="w-4 h-4" />
              مالي
            </TabsTrigger>
            <TabsTrigger value="sales" className="gap-2">
              <TrendingUp className="w-4 h-4" />
              مبيعات
            </TabsTrigger>
            <TabsTrigger value="inventory" className="gap-2">
              <Package className="w-4 h-4" />
              مخزون
            </TabsTrigger>
          </TabsList>

          {/* فلتر الفترة الزمنية داخل التبويبات */}
          <div className="mt-4 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="w-5 h-5" />
                  فلتر الفترة الزمنية - الفترة الحالية: {quickDateRanges.find(r => r.value === timePeriod)?.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {quickDateRanges.map((range) => (
                    <Button
                      key={range.value}
                      variant={timePeriod === range.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePeriodChange(range.value)}
                      className="transition-all duration-300"
                    >
                      {range.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* لوحة القيادة */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* البيانات المالية من النظام الموحد */}
              <motion.div whileHover={{ scale: 1.02 }}>
                <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50 to-blue-100/50">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground font-medium">رأس المال</p>
                        <p className="text-2xl font-bold text-blue-700">
                          {formatCurrency(financialData.capitalAmount)}
                        </p>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <Wallet className="w-6 h-6 text-blue-500" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div whileHover={{ scale: 1.02 }}>
                <Card className="border-l-4 border-l-green-500 bg-gradient-to-br from-green-50 to-green-100/50">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground font-medium">صافي الربح</p>
                        <p className="text-2xl font-bold text-green-700">
                          {formatCurrency(financialData.netProfit)}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-green-600">
                          {financialData.netProfit > 0 ? (
                            <ArrowUpRight className="w-3 h-3" />
                          ) : (
                            <ArrowDownRight className="w-3 h-3" />
                          )}
                          {financialData.netProfit > 0 ? 'ربحي' : 'خسارة'}
                        </div>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                        <TrendingUp className="w-6 h-6 text-green-500" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div whileHover={{ scale: 1.02 }}>
                <Card className="border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-50 to-purple-100/50">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground font-medium">إجمالي المبيعات</p>
                        <p className="text-2xl font-bold text-purple-700">
                          {formatCurrency(analyticsData.sales.totalRevenue)}
                        </p>
                        <p className="text-xs text-purple-600">
                          {analyticsData.sales.completedOrders} طلب مكتمل
                        </p>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                        <ShoppingCart className="w-6 h-6 text-purple-500" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div whileHover={{ scale: 1.02 }}>
                <Card className="border-l-4 border-l-orange-500 bg-gradient-to-br from-orange-50 to-orange-100/50">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground font-medium">قيمة المخزون</p>
                        <p className="text-2xl font-bold text-orange-700">
                          {formatCurrency(analyticsData.inventory.totalValue)}
                        </p>
                        <p className="text-xs text-orange-600">
                          {analyticsData.inventory.totalProducts} منتج
                        </p>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                        <Package className="w-6 h-6 text-orange-500" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* ملخص مالي سريع */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="w-5 h-5" />
                  الملخص المالي السريع
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">إجمالي المشتريات</p>
                    <p className="text-xl font-bold text-red-600">
                      -{formatCurrency(financialData.totalPurchases)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">إجمالي المصاريف</p>
                    <p className="text-xl font-bold text-orange-600">
                      -{formatCurrency(financialData.generalExpenses)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">مستحقات مدفوعة</p>
                    <p className="text-xl font-bold text-purple-600">
                      -{formatCurrency(financialData.employeeDuesPaid)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">الرصيد النهائي</p>
                    <p className="text-xl font-bold text-blue-600">
                      {formatCurrency(financialData.currentBalance)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* التبويب المالي */}
          <TabsContent value="financial" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>التوزيع المالي</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>رأس المال</span>
                      <span className="font-bold text-blue-600">
                        {formatCurrency(financialData.capitalAmount)}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span>إيرادات المبيعات</span>
                      <span className="font-bold text-green-600">
                        +{formatCurrency(financialData.totalRevenue)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>تكلفة المشتريات</span>
                      <span className="font-bold text-red-600">
                        -{formatCurrency(financialData.totalPurchases)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>المصاريف العامة</span>
                      <span className="font-bold text-orange-600">
                        -{formatCurrency(financialData.generalExpenses)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>مستحقات الموظفين</span>
                      <span className="font-bold text-purple-600">
                        -{formatCurrency(financialData.employeeDuesPaid)}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span>صافي الربح</span>
                      <span className={financialData.netProfit > 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(financialData.netProfit)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>مؤشرات الأداء المالي</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span>هامش الربح</span>
                        <span className="font-bold">
                          {financialData.totalRevenue > 0 
                            ? ((financialData.netProfit / financialData.totalRevenue) * 100).toFixed(1)
                            : 0}%
                        </span>
                      </div>
                      <Progress 
                        value={financialData.totalRevenue > 0 
                          ? Math.abs((financialData.netProfit / financialData.totalRevenue) * 100)
                          : 0} 
                        className="h-2" 
                      />
                    </div>
                    
                    <div>
                      <div className="flex justify-between mb-2">
                        <span>معدل العائد على رأس المال</span>
                        <span className="font-bold">
                          {financialData.capitalAmount > 0 
                            ? ((financialData.netProfit / financialData.capitalAmount) * 100).toFixed(1)
                            : 0}%
                        </span>
                      </div>
                      <Progress 
                        value={financialData.capitalAmount > 0 
                          ? Math.abs((financialData.netProfit / financialData.capitalAmount) * 100)
                          : 0} 
                        className="h-2" 
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* تبويب المبيعات */}
          <TabsContent value="sales" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    الطلبات المكتملة
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-3xl font-bold text-green-600">
                      {analyticsData.sales.completedOrders}
                    </p>
                    <Progress 
                      value={(analyticsData.sales.completedOrders / (analyticsData.sales.totalOrders || 1)) * 100} 
                      className="h-2" 
                    />
                    <p className="text-sm text-muted-foreground">
                      {((analyticsData.sales.completedOrders / (analyticsData.sales.totalOrders || 1)) * 100).toFixed(1)}% من إجمالي الطلبات
                    </p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-yellow-500" />
                    الطلبات المعلقة
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-3xl font-bold text-yellow-600">
                      {analyticsData.sales.pendingOrders}
                    </p>
                    <Progress 
                      value={(analyticsData.sales.pendingOrders / (analyticsData.sales.totalOrders || 1)) * 100} 
                      className="h-2" 
                    />
                    <p className="text-sm text-muted-foreground">
                      {((analyticsData.sales.pendingOrders / (analyticsData.sales.totalOrders || 1)) * 100).toFixed(1)}% من إجمالي الطلبات
                    </p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-blue-500" />
                    متوسط قيمة الطلب
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCurrency(analyticsData.sales.averageOrderValue)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      معدل التحويل: {analyticsData.sales.conversionRate.toFixed(1)}%
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* تبويب المخزون */}
          <TabsContent value="inventory" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">إجمالي المنتجات</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{analyticsData.inventory.totalProducts}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {analyticsData.inventory.totalVariants} متغير
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">إجمالي الكمية</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{analyticsData.inventory.totalStock}</p>
                  <p className="text-xs text-muted-foreground mt-1">قطعة في المخزن</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-orange-600">مخزون منخفض</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-orange-600">
                    {analyticsData.inventory.lowStockCount}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">منتج يحتاج تجديد</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-red-600">نفد المخزون</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-red-600">
                    {analyticsData.inventory.outOfStockCount}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">منتج غير متوفر</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
};

export default UnifiedAnalyticsSystem;