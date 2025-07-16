import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Filter
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const AdvancedAccountingSystem = () => {
  const { accounting, orders, products, settings, settlementInvoices } = useInventory();
  const { hasPermission, user } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [activeTab, setActiveTab] = useState('overview');

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
      o.status === 'delivered' && o.receipt_received === true
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
      userPersonalProfit
    };
  }, [orders, accounting, products, selectedPeriod]);

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

  // مؤشرات الأداء الرئيسية
  const kpiCards = [
    {
      title: 'إجمالي الإيرادات',
      value: financialAnalysis.totalRevenue || 0,
      format: 'currency',
      icon: DollarSign,
      color: 'blue',
      change: '+12.5%'
    },
    {
      title: 'صافي الربح',
      value: financialAnalysis.netProfit || 0,
      format: 'currency',
      icon: TrendingUp,
      color: financialAnalysis.netProfit >= 0 ? 'green' : 'red',
      change: `${financialAnalysis.netProfitMargin?.toFixed(1) || 0}%`
    },
    {
      title: 'أرباحي',
      value: financialAnalysis.userPersonalProfit || 0,
      format: 'currency',
      icon: Wallet,
      color: 'teal',
      change: 'طلبات مستلمة'
    },
    {
      title: 'هامش الربح الإجمالي',
      value: financialAnalysis.grossProfitMargin || 0,
      format: 'percentage',
      icon: PieChart,
      color: 'purple',
      change: 'هامش صحي'
    }
  ];

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

  const getColorClass = (color) => {
    const colors = {
      blue: 'from-blue-500 to-blue-600',
      green: 'from-green-500 to-green-600',
      red: 'from-red-500 to-red-600',
      purple: 'from-purple-500 to-purple-600',
      orange: 'from-orange-500 to-orange-600',
      teal: 'from-teal-500 to-teal-600'
    };
    return colors[color] || colors.blue;
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

      {/* مؤشرات الأداء الرئيسية */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi, index) => (
          <motion.div
            key={kpi.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className={cn("p-4 bg-gradient-to-br", getColorClass(kpi.color))}>
                  <div className="flex items-center justify-between text-white">
                    <div>
                      <p className="text-sm opacity-90">{kpi.title}</p>
                      <p className="text-2xl font-bold">
                        {formatValue(kpi.value, kpi.format)}
                      </p>
                    </div>
                    <kpi.icon className="w-8 h-8 opacity-80" />
                  </div>
                </div>
                <div className="p-3 bg-card">
                  <div className="flex items-center gap-2">
                    {kpi.color === 'green' ? (
                      <TrendingUp className="w-4 h-4 text-green-500" />
                    ) : kpi.color === 'red' ? (
                      <TrendingDown className="w-4 h-4 text-red-500" />
                    ) : (
                      <Activity className="w-4 h-4 text-blue-500" />
                    )}
                    <span className="text-xs text-muted-foreground">{kpi.change}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

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