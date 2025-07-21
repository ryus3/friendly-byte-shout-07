import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Calculator, 
  PieChart, 
  BarChart3,
  Wallet,
  CreditCard,
  Target,
  AlertCircle,
  CheckCircle2,
  Activity,
  FileText,
  Calendar,
  Filter,
  User,
  Package,
  MapPin,
  Phone,
  Hourglass
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import StatCard from '@/components/dashboard/StatCard';

const AdvancedAccountingSystem = () => {
  const { accounting, orders, products, settings, settlementInvoices, calculateProfit, allUsers } = useInventory();
  const { hasPermission, user } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [activeTab, setActiveTab] = useState('overview');
  const [showUserProfitsDialog, setShowUserProfitsDialog] = useState(false);

  // حسابات مالية متقدمة
  const financialAnalysis = useMemo(() => {
    if (!orders || !accounting || !products) return {};

    const now = new Date();
    const periods = {
      today: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      week: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      month: new Date(now.getFullYear(), now.getMonth(), 1),
      year: new Date(now.getFullYear(), 0, 1)
    };

    const fromDate = periods[selectedPeriod] || periods.month;
    
    // تصفية الطلبات والنفقات حسب الفترة
    const filteredOrders = orders.filter(order => {
      const orderDate = new Date(order.created_at);
      return orderDate >= fromDate;
    });

    const filteredExpenses = (accounting.expenses || []).filter(expense => {
      const expenseDate = new Date(expense.transaction_date);
      return expenseDate >= fromDate;
    });

    // حساب الإيرادات (نفس طريقة لوحة التحكم - الطلبات المُوصلة التي تم استلام فواتيرها فقط)
    const deliveredOrdersWithReceipts = filteredOrders.filter(o => 
      (o.status === 'delivered' || o.status === 'completed') && o.receipt_received === true
    );
    
    const totalRevenue = deliveredOrdersWithReceipts.reduce((sum, order) => 
      sum + (order.final_amount || order.total_amount || 0), 0
    );
    
    const deliveryFees = deliveredOrdersWithReceipts.reduce((sum, order) => 
      sum + (order.delivery_fee || 0), 0
    );
    
    const salesWithoutDelivery = totalRevenue - deliveryFees;

    // حساب تكلفة البضاعة المباعة (COGS) - نفس طريقة لوحة التحكم
    const cogs = deliveredOrdersWithReceipts.reduce((sum, order) => {
      return sum + (order.items || []).reduce((itemSum, item) => {
        const costPrice = item.costPrice || item.cost_price || 0;
        return itemSum + (costPrice * item.quantity);
      }, 0);
    }, 0);

    // الربح الإجمالي
    const grossProfit = salesWithoutDelivery - cogs;
    const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    // النفقات التشغيلية
    const operatingExpenses = filteredExpenses
      .filter(e => e.related_data?.category !== 'مستحقات الموظفين' && e.related_data?.category !== 'شراء بضاعة')
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    // مستحقات الموظفين
    const employeeExpenses = filteredExpenses
      .filter(e => e.related_data?.category === 'مستحقات الموظفين')
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    // مشتريات البضاعة
    const purchaseExpenses = filteredExpenses
      .filter(e => e.related_data?.category === 'شراء بضاعة')
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    // إجمالي النفقات
    const totalExpenses = operatingExpenses + employeeExpenses + purchaseExpenses;

    // صافي الربح (نفس حساب لوحة التحكم تماماً)
    const netProfit = grossProfit - operatingExpenses - employeeExpenses;
    const netProfitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    
    // حساب أرباح المستخدم الحالي من طلباته المستلمة فقط
    const userDeliveredOrders = deliveredOrdersWithReceipts.filter(o => o.created_by === user?.id);
    const userPersonalProfit = userDeliveredOrders.reduce((sum, order) => {
      return sum + (order.items || []).reduce((itemSum, item) => {
        const profit = (item.unit_price - (item.cost_price || item.costPrice || 0)) * item.quantity;
        return itemSum + profit;
      }, 0);
    }, 0);

    // حساب قيمة المخزون على أساس سعر البيع (وليس التكلفة)
    const inventoryValue = Array.isArray(products) ? products.reduce((sum, p) => {
      return sum + (Array.isArray(p.variants) ? p.variants.reduce((variantSum, v) => 
        variantSum + (v.quantity * (v.price || v.base_price || 0)), 0
      ) : 0);
    }, 0) : 0;

    // معدل العائد على رأس المال
    const roi = accounting.capital > 0 ? (netProfit / accounting.capital) * 100 : 0;

    // تحليل التدفق النقدي
    const cashFlow = {
      inflow: totalRevenue,
      outflow: totalExpenses,
      net: totalRevenue - totalExpenses
    };

    // أداء المبيعات
    const salesMetrics = {
      totalOrders: filteredOrders.length,
      deliveredOrders: deliveredOrdersWithReceipts.length,
      conversionRate: filteredOrders.length > 0 ? (deliveredOrdersWithReceipts.length / filteredOrders.length) * 100 : 0,
      averageOrderValue: deliveredOrdersWithReceipts.length > 0 ? totalRevenue / deliveredOrdersWithReceipts.length : 0
    };

    // تحليل الفترات
    const dailyData = {};
    deliveredOrdersWithReceipts.forEach(order => {
      const day = format(new Date(order.updated_at || order.created_at), 'yyyy-MM-dd');
      if (!dailyData[day]) {
        dailyData[day] = { revenue: 0, orders: 0, profit: 0 };
      }
      dailyData[day].revenue += order.final_amount || order.total_amount || 0;
      dailyData[day].orders += 1;
      dailyData[day].profit += (order.items || []).reduce((sum, item) => {
        const profit = (item.unit_price - (item.cost_price || item.costPrice || 0)) * item.quantity;
        return sum + profit;
      }, 0);
    });

    const chartData = Object.entries(dailyData).map(([date, data]) => ({
      date,
      revenue: data.revenue,
      orders: data.orders,
      profit: data.profit
    }));

    return {
      totalRevenue,
      deliveryFees,
      salesWithoutDelivery,
      cogs,
      grossProfit,
      grossProfitMargin,
      operatingExpenses,
      employeeExpenses,
      purchaseExpenses,
      totalExpenses,
      netProfit,
      netProfitMargin,
      roi,
      cashFlow,
      salesMetrics,
      chartData,
      filteredOrders,
      deliveredOrdersWithReceipts,
      userPersonalProfit,
      inventoryValue
    };
  }, [orders, accounting, products, selectedPeriod, user?.id, calculateProfit]);

  // تحليل نسب مالية
  const ratioAnalysis = useMemo(() => {
    if (!financialAnalysis.totalRevenue) return {};

    return {
      profitability: {
        grossMargin: financialAnalysis.grossProfitMargin,
        netMargin: financialAnalysis.netProfitMargin,
        operatingMargin: financialAnalysis.totalRevenue > 0 ? 
          ((financialAnalysis.grossProfit - financialAnalysis.operatingExpenses) / financialAnalysis.totalRevenue) * 100 : 0
      },
      efficiency: {
        assetTurnover: accounting.capital > 0 ? financialAnalysis.totalRevenue / accounting.capital : 0,
        expenseRatio: financialAnalysis.totalRevenue > 0 ? 
          (financialAnalysis.totalExpenses / financialAnalysis.totalRevenue) * 100 : 0,
        cogsRatio: financialAnalysis.totalRevenue > 0 ? 
          (financialAnalysis.cogs / financialAnalysis.totalRevenue) * 100 : 0
      },
      liquidity: {
        currentCash: accounting.capital - financialAnalysis.totalExpenses,
        burnRate: financialAnalysis.totalExpenses / 30, // يومياً
        runwayDays: financialAnalysis.totalExpenses > 0 ? 
          (accounting.capital / (financialAnalysis.totalExpenses / 30)) : 0
      }
    };
  }, [financialAnalysis, accounting]);

  // استيراد حساب صافي الأرباح مباشرة من لوحة التحكم
  const dashboardNetProfit = useMemo(() => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1); // آخر شهر كما في لوحة التحكم
    const to = new Date();
    
    if (!orders || !accounting || !products) return 0;
    
    const filterByDate = (itemDateStr) => {
      if (!from || !to || !itemDateStr) return true;
      const itemDate = new Date(itemDateStr);
      return itemDate >= from && itemDate <= to;
    };
    
    // نفس حساب لوحة التحكم تماماً - الطلبات المُوصلة التي تم استلام فواتيرها فقط
    const deliveredOrders = (orders || []).filter(o => 
      o.status === 'delivered' && 
      o.receipt_received === true && 
      filterByDate(o.updated_at || o.created_at)
    );
    const expensesInRange = (accounting.expenses || []).filter(e => filterByDate(e.transaction_date));
    
    // حساب إجمالي الإيرادات والرسوم
    const totalRevenue = deliveredOrders.reduce((sum, o) => sum + (o.final_amount || o.total_amount || 0), 0);
    const deliveryFees = deliveredOrders.reduce((sum, o) => sum + (o.delivery_fee || 0), 0);
    const salesWithoutDelivery = totalRevenue - deliveryFees;
    
    // حساب تكلفة البضاعة المباعة من العناصر الفعلية
    const cogs = deliveredOrders.reduce((sum, o) => {
      const orderCogs = (o.items || []).reduce((itemSum, item) => {
        const costPrice = item.costPrice || item.cost_price || 0;
        return itemSum + (costPrice * item.quantity);
      }, 0);
      return sum + orderCogs;
    }, 0);
    const grossProfit = salesWithoutDelivery - cogs;
    const generalExpenses = expensesInRange.filter(e => e.related_data?.category !== 'مستحقات الموظفين').reduce((sum, e) => sum + e.amount, 0);
    const employeeSettledDues = expensesInRange.filter(e => e.related_data?.category === 'مستحقات الموظفين').reduce((sum, e) => sum + e.amount, 0);
    const totalExpenses = generalExpenses + employeeSettledDues;
    const netProfit = grossProfit - totalExpenses;
    
    return netProfit;
  }, [orders, accounting, products]);

  // مؤشرات الأداء الرئيسية - استخدام صافي الأرباح من لوحة التحكم
  const kpiCards = [
    {
      title: 'إجمالي الإيرادات',
      value: financialAnalysis.totalRevenue || 0,
      format: 'currency',
      icon: DollarSign,
      colors: ['blue-500', 'sky-500'],
      change: '+12.5%'
    },
    {
      title: 'صافي الارباح',
      value: dashboardNetProfit,
      format: 'currency',
      icon: TrendingUp,
      colors: dashboardNetProfit >= 0 ? ['green-500', 'emerald-500'] : ['red-500', 'orange-500'],
      change: `بنفس حساب لوحة التحكم`,
      key: 'dashboard-net-profit-unified'
    },
    {
      title: 'أرباحي',
      value: financialAnalysis.userPersonalProfit || 0,
      format: 'currency',
      icon: User,
      colors: ['teal-500', 'cyan-500'],
      change: 'طلبات مستلمة فقط',
      onClick: () => setShowUserProfitsDialog(true),
      key: 'my-profits-interactive-v2'
    },
    {
      title: 'قيمة المخزون',
      value: financialAnalysis.inventoryValue || 0,
      format: 'currency',
      icon: Package,
      colors: ['emerald-500', 'green-500'],
      change: 'بسعر البيع'
    }
  ];

  // حساب أرباح المستخدم من الطلبات المستلمة فقط لعرضها في النافذة المنبثقة
  const userProfitOrders = useMemo(() => {
    if (!orders || !user?.id) return [];
    
    const userDeliveredOrders = orders.filter(o => 
      o.status === 'delivered' && 
      o.receipt_received === true && 
      o.created_by === user.id
    );
    
    return userDeliveredOrders.map(order => {
      const orderProfit = (order.items || []).reduce((sum, item) => {
        const profit = (item.unit_price - (item.cost_price || item.costPrice || 0)) * item.quantity;
        return sum + profit;
      }, 0);
      
      return {
        ...order,
        calculatedProfit: orderProfit
      };
    });
  }, [orders, user?.id]);

  const formatValue = (value, format) => {
    switch (format) {
      case 'currency':
        return `${value.toLocaleString()} د.ع`;
      case 'percentage':
        return `${value.toFixed(1)}%`;
      default:
        return value.toLocaleString();
    }
  };

  return (
    <div className="space-y-6">
      {/* فلاتر الفترة الزمنية */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-primary" />
              النظام المحاسبي المتقدم
            </CardTitle>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <select 
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-3 py-1 border rounded-md text-sm"
              >
                <option value="today">اليوم</option>
                <option value="week">آخر أسبوع</option>
                <option value="month">آخر شهر</option>
                <option value="year">آخر سنة</option>
              </select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* مؤشرات الأداء الرئيسية - نفس تنسيق لوحة التحكم */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {kpiCards.map((stat, index) => (
          <motion.div 
            key={stat.key || `${stat.title}-${index}`} 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: index * 0.05 }}
          >
            <StatCard 
              {...stat}
              onClick={stat.onClick}
            />
          </motion.div>
        ))}
      </div>

      {/* نافذة منبثقة لأرباح المستخدم */}
      <Dialog open={showUserProfitsDialog} onOpenChange={setShowUserProfitsDialog}>
        <DialogContent className="w-[95vw] max-w-2xl h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="flex-shrink-0 p-4 sm:p-6 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
              <User className="h-5 w-5 sm:h-6 sm:w-6 text-teal-500" />
              أرباحي من الطلبات المستلمة
            </DialogTitle>
            <div className="text-sm text-muted-foreground mt-2">
              الطلبات التي بعتها أنا وتم استلام فواتيرها
            </div>
          </DialogHeader>

          <div className="flex-1 flex flex-col min-h-0 p-4 sm:p-6 pt-2 gap-4">
            {/* إحصائيات سريعة */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-shrink-0">
              <Card className="bg-gradient-to-r from-teal-50 to-teal-100 dark:from-teal-900/20 dark:to-teal-800/20">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 sm:h-5 sm:w-5 text-teal-500" />
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground">عدد الطلبات</p>
                      <p className="text-base sm:text-lg font-semibold">{userProfitOrders.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground">إجمالي أرباحي</p>
                      <p className="text-base sm:text-lg font-semibold">
                        {userProfitOrders.reduce((sum, o) => sum + o.calculatedProfit, 0).toLocaleString()} د.ع
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground">متوسط الربح</p>
                      <p className="text-base sm:text-lg font-semibold">
                        {userProfitOrders.length > 0 
                          ? Math.round(userProfitOrders.reduce((sum, o) => sum + o.calculatedProfit, 0) / userProfitOrders.length).toLocaleString()
                          : 0} د.ع
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* قائمة الطلبات */}
            <div className="flex-1 min-h-0">
              <ScrollArea className="h-full w-full">
                <div className="space-y-2 pr-2">
                  {userProfitOrders.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>لا توجد طلبات مستلمة بعد</p>
                    </div>
                  ) : (
                    userProfitOrders.map((order) => (
                      <Card key={order.id} className="hover:shadow-md transition-all">
                        <CardContent className="p-3 sm:p-4">
                          <div className="flex flex-col gap-3">
                            {/* معلومات الطلب الأساسية */}
                            <div className="flex flex-col xs:flex-row xs:items-center gap-2">
                              <Badge variant="outline" className="w-fit text-xs">
                                {order.order_number}
                              </Badge>
                              <Badge variant="secondary" className="w-fit text-xs">
                                مُستلم
                              </Badge>
                            </div>

                            {/* معلومات العميل والأرباح */}
                            <div className="flex flex-col sm:flex-row justify-between gap-3">
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                  <span className="text-sm font-medium truncate">{order.customer_name}</span>
                                </div>
                                {order.customer_phone && (
                                  <div className="flex items-center gap-2">
                                    <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    <span className="text-sm font-mono">{order.customer_phone}</span>
                                  </div>
                                )}
                                {order.customer_province && (
                                  <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    <span className="text-sm truncate">{order.customer_province}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                  <span className="text-sm">
                                    {format(parseISO(order.created_at), 'dd MMM yyyy', { locale: ar })}
                                  </span>
                                </div>
                              </div>

                              {/* الأرباح والمعلومات المالية */}
                              <div className="flex sm:flex-col items-start sm:items-end gap-2 sm:gap-1 sm:text-right min-w-fit">
                                <div className="flex-1 sm:flex-none">
                                  <p className="text-base sm:text-lg font-bold text-green-600">
                                    {order.calculatedProfit.toLocaleString()} د.ع
                                  </p>
                                  <p className="text-xs text-muted-foreground">ربحي</p>
                                </div>
                                <div className="flex-1 sm:flex-none">
                                  <p className="text-sm font-medium">
                                    {(order.total_amount || 0).toLocaleString()} د.ع
                                  </p>
                                  <p className="text-xs text-muted-foreground">إجمالي المبيعات</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* تذييل النافذة */}
          <div className="flex-shrink-0 p-4 sm:p-6 pt-2 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
              <Button variant="outline" onClick={() => setShowUserProfitsDialog(false)} size="sm" className="w-full sm:w-auto">
                إغلاق
              </Button>
              <div className="text-sm text-muted-foreground text-center sm:text-right">
                {userProfitOrders.length} طلب مُستلم
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* تفاصيل التحليل المالي */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
          <TabsTrigger value="profitloss">الأرباح والخسائر</TabsTrigger>
          <TabsTrigger value="cashflow">التدفق النقدي</TabsTrigger>
          <TabsTrigger value="analysis">التحليل المالي</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* ملخص الإيرادات */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-green-500" />
                  ملخص الإيرادات
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                  <span>إجمالي المبيعات</span>
                  <span className="font-bold text-green-700">
                    {formatValue(financialAnalysis.totalRevenue || 0, 'currency')}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                  <span>تكلفة البضاعة المباعة</span>
                  <span className="font-bold text-blue-700">
                    {formatValue(financialAnalysis.cogs || 0, 'currency')}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                  <span>الربح الإجمالي</span>
                  <span className="font-bold text-purple-700">
                    {formatValue(financialAnalysis.grossProfit || 0, 'currency')}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* ملخص النفقات */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-red-500" />
                  ملخص النفقات
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                  <span>النفقات التشغيلية</span>
                  <span className="font-bold text-orange-700">
                    {formatValue(financialAnalysis.operatingExpenses || 0, 'currency')}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                  <span>مستحقات الموظفين</span>
                  <span className="font-bold text-yellow-700">
                    {formatValue(financialAnalysis.employeeExpenses || 0, 'currency')}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                  <span>إجمالي النفقات</span>
                  <span className="font-bold text-red-700">
                    {formatValue(financialAnalysis.totalExpenses || 0, 'currency')}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* أداء المبيعات */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-500" />
                أداء المبيعات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-700">
                    {financialAnalysis.salesMetrics?.totalOrders || 0}
                  </div>
                  <div className="text-sm text-blue-600">إجمالي الطلبات</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-700">
                    {financialAnalysis.salesMetrics?.deliveredOrders || 0}
                  </div>
                  <div className="text-sm text-green-600">طلبات مكتملة</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-700">
                    {financialAnalysis.salesMetrics?.conversionRate?.toFixed(1) || 0}%
                  </div>
                  <div className="text-sm text-purple-600">معدل التحويل</div>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-700">
                    {formatValue(financialAnalysis.salesMetrics?.averageOrderValue || 0, 'currency')}
                  </div>
                  <div className="text-sm text-orange-600">متوسط قيمة الطلب</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profitloss" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>قائمة الأرباح والخسائر</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border-b pb-4">
                  <h3 className="font-semibold text-lg mb-2">الإيرادات</h3>
                  <div className="flex justify-between">
                    <span>إجمالي المبيعات</span>
                    <span className="font-bold">
                      {formatValue(financialAnalysis.totalRevenue || 0, 'currency')}
                    </span>
                  </div>
                </div>
                
                <div className="border-b pb-4">
                  <h3 className="font-semibold text-lg mb-2">تكلفة البضاعة المباعة</h3>
                  <div className="flex justify-between text-red-600">
                    <span>COGS</span>
                    <span className="font-bold">
                      ({formatValue(financialAnalysis.cogs || 0, 'currency')})
                    </span>
                  </div>
                  <div className="flex justify-between mt-2 pt-2 border-t">
                    <span className="font-semibold">الربح الإجمالي</span>
                    <span className="font-bold text-green-600">
                      {formatValue(financialAnalysis.grossProfit || 0, 'currency')}
                    </span>
                  </div>
                </div>

                <div className="border-b pb-4">
                  <h3 className="font-semibold text-lg mb-2">النفقات التشغيلية</h3>
                  <div className="flex justify-between text-red-600">
                    <span>نفقات عامة</span>
                    <span>({formatValue(financialAnalysis.operatingExpenses || 0, 'currency')})</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>مستحقات موظفين</span>
                    <span>({formatValue(financialAnalysis.employeeExpenses || 0, 'currency')})</span>
                  </div>
                </div>

                <div className="pt-4">
                  <div className="flex justify-between text-lg font-bold">
                    <span>صافي الربح</span>
                    <span className={cn(
                      "font-bold",
                      financialAnalysis.netProfit >= 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {formatValue(financialAnalysis.netProfit || 0, 'currency')}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground mt-1">
                    <span>هامش صافي الربح</span>
                    <span>{financialAnalysis.netProfitMargin?.toFixed(1) || 0}%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cashflow" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>تحليل التدفق النقدي</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-6 bg-green-50 rounded-lg">
                  <div className="text-3xl font-bold text-green-600 mb-2">
                    {formatValue(financialAnalysis.cashFlow?.inflow || 0, 'currency')}
                  </div>
                  <div className="text-sm text-green-700">التدفق الداخل</div>
                </div>
                <div className="text-center p-6 bg-red-50 rounded-lg">
                  <div className="text-3xl font-bold text-red-600 mb-2">
                    {formatValue(financialAnalysis.cashFlow?.outflow || 0, 'currency')}
                  </div>
                  <div className="text-sm text-red-700">التدفق الخارج</div>
                </div>
                <div className="text-center p-6 bg-blue-50 rounded-lg">
                  <div className={cn(
                    "text-3xl font-bold mb-2",
                    financialAnalysis.cashFlow?.net >= 0 ? "text-blue-600" : "text-red-600"
                  )}>
                    {formatValue(financialAnalysis.cashFlow?.net || 0, 'currency')}
                  </div>
                  <div className="text-sm text-blue-700">صافي التدفق</div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                <h4 className="font-semibold mb-2">معلومات السيولة</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">النقد المتاح:</span>
                    <span className="font-semibold ml-2">
                      {formatValue(ratioAnalysis.liquidity?.currentCash || 0, 'currency')}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">معدل الحرق اليومي:</span>
                    <span className="font-semibold ml-2">
                      {formatValue(ratioAnalysis.liquidity?.burnRate || 0, 'currency')}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">أيام التشغيل المتبقية:</span>
                    <span className="font-semibold ml-2">
                      {Math.round(ratioAnalysis.liquidity?.runwayDays || 0)} يوم
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* نسب الربحية */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">نسب الربحية</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm">هامش الربح الإجمالي</span>
                  <Badge variant="outline">
                    {ratioAnalysis.profitability?.grossMargin?.toFixed(1) || 0}%
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">هامش الربح التشغيلي</span>
                  <Badge variant="outline">
                    {ratioAnalysis.profitability?.operatingMargin?.toFixed(1) || 0}%
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">هامش صافي الربح</span>
                  <Badge variant={financialAnalysis.netProfitMargin >= 0 ? "default" : "destructive"}>
                    {ratioAnalysis.profitability?.netMargin?.toFixed(1) || 0}%
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* نسب الكفاءة */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">نسب الكفاءة</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm">دوران الأصول</span>
                  <Badge variant="outline">
                    {ratioAnalysis.efficiency?.assetTurnover?.toFixed(2) || 0}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">نسبة النفقات</span>
                  <Badge variant="outline">
                    {ratioAnalysis.efficiency?.expenseRatio?.toFixed(1) || 0}%
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">نسبة تكلفة البضاعة</span>
                  <Badge variant="outline">
                    {ratioAnalysis.efficiency?.cogsRatio?.toFixed(1) || 0}%
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* تقييم الأداء */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">تقييم الأداء</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">الحالة المالية</span>
                  {financialAnalysis.netProfit >= 0 ? (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      صحية
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      تحتاج مراجعة
                    </Badge>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">معدل النمو</span>
                  <Badge variant="outline">+12.5%</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">التقييم العام</span>
                  <Badge className="bg-blue-100 text-blue-800">
                    {financialAnalysis.roi > 15 ? 'ممتاز' : 
                     financialAnalysis.roi > 10 ? 'جيد جداً' : 
                     financialAnalysis.roi > 5 ? 'جيد' : 'متوسط'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* التوصيات */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                التوصيات والتحليل
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {financialAnalysis.netProfitMargin < 10 && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-yellow-600" />
                      <span className="text-sm font-medium text-yellow-800">
                        هامش الربح منخفض - يُنصح بمراجعة استراتيجية التسعير
                      </span>
                    </div>
                  </div>
                )}
                
                {ratioAnalysis.efficiency?.expenseRatio > 70 && (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-orange-600" />
                      <span className="text-sm font-medium text-orange-800">
                        نسبة النفقات مرتفعة - راجع النفقات التشغيلية
                      </span>
                    </div>
                  </div>
                )}

                {financialAnalysis.roi > 15 && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-green-800">
                        أداء مالي ممتاز - معدل عائد قوي على رأس المال
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdvancedAccountingSystem;