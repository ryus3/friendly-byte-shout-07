import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  FileText, Download, BarChart3, TrendingUp, DollarSign, Package, Users, 
  ShoppingCart, Calendar, ArrowUp, ArrowDown, Activity, Target, Zap,
  Star, Award, Crown, CheckCircle, AlertTriangle, Sparkles
} from 'lucide-react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import FinancialReportPDF from '@/components/pdf/FinancialReportPDF';
import InventoryReportPDF from '@/components/pdf/InventoryReportPDF';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useAdvancedProfitsAnalysis } from '@/hooks/useAdvancedProfitsAnalysis';
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, subDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

const ReportsSettingsDialog = ({ open, onOpenChange }) => {
  const { orders, products, accounting, purchases } = useInventory();
  const { allUsers, user, hasPermission } = useAuth();
  const { toast } = useToast();
  const [generatingReport, setGeneratingReport] = useState(null);

  // استخدام نظام تحليل الأرباح المتقدم الموجود
  const dateRange = {
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  };
  
  const filters = {
    period: 'month',
    department: 'all',
    category: 'all'
  };

  const { 
    analysisData, 
    loading: profitsLoading,
    departments,
    categories
  } = useAdvancedProfitsAnalysis(dateRange, filters);

  // إحصائيات متقدمة ومعلوماتية
  const [analytics, setAnalytics] = useState({
    todaySales: 0,
    yesterdaySales: 0,
    weekSales: 0,
    monthSales: 0,
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    totalProducts: 0,
    activeProducts: 0,
    lowStockItems: 0,
    outOfStockItems: 0,
    totalCustomers: 0,
    avgOrderValue: 0,
    topSellingCategory: '',
    profitMargin: 0,
    monthlyGrowth: 0,
    weeklyGrowth: 0
  });

  // التحقق من الصلاحيات
  const canViewAllData = hasPermission && (
    hasPermission('view_all_data') || 
    hasPermission('manage_reports') ||
    user?.role === 'admin'
  );

  // حساب الإحصائيات المتقدمة
  useEffect(() => {
    const calculateAdvancedAnalytics = () => {
      if (!orders || !products) return;

      const now = new Date();
      const today = startOfDay(now);
      const yesterday = startOfDay(subDays(now, 1));
      const weekAgo = subDays(now, 7);
      const monthAgo = subDays(now, 30);

      // مبيعات اليوم
      const todayOrders = orders.filter(order => 
        new Date(order.created_at) >= today
      );
      const todaySales = todayOrders.reduce((sum, order) => sum + order.final_amount, 0);

      // مبيعات أمس
      const yesterdayOrders = orders.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate >= yesterday && orderDate < today;
      });
      const yesterdaySales = yesterdayOrders.reduce((sum, order) => sum + order.final_amount, 0);

      // مبيعات الأسبوع
      const weekOrders = orders.filter(order => 
        new Date(order.created_at) >= weekAgo
      );
      const weekSales = weekOrders.reduce((sum, order) => sum + order.final_amount, 0);

      // مبيعات الشهر
      const monthOrders = orders.filter(order => 
        new Date(order.created_at) >= monthAgo
      );
      const monthSales = monthOrders.reduce((sum, order) => sum + order.final_amount, 0);

      // إحصائيات الطلبات
      const totalOrders = orders.length;
      const pendingOrders = orders.filter(order => order.status === 'pending').length;
      const completedOrders = orders.filter(order => order.status === 'completed').length;
      const cancelledOrders = orders.filter(order => order.status === 'cancelled').length;
      const returnedOrders = orders.filter(order => order.status === 'returned' || order.status === 'refunded').length;
      const processingOrders = orders.filter(order => order.status === 'processing').length;

      // إحصائيات المنتجات
      const totalProducts = products.length;
      const activeProducts = products.filter(product => product.is_active).length;
      
      // حساب المخزون المنخفض والنافد
      let lowStockItems = 0;
      let outOfStockItems = 0;
      products.forEach(product => {
        if (product.variants?.length > 0) {
          product.variants.forEach(variant => {
            const quantity = variant.quantity || 0;
            if (quantity === 0) outOfStockItems++;
            else if (quantity <= 5) lowStockItems++;
          });
        }
      });

      // العملاء الفريدون
      const totalCustomers = new Set(orders.map(order => order.customer_name)).size;

      // متوسط قيمة الطلب
      const avgOrderValue = totalOrders > 0 ? orders.reduce((sum, order) => sum + order.final_amount, 0) / totalOrders : 0;

      // أكثر فئة مبيعاً (تحليل تقريبي)
      const categoryStats = {};
      orders.forEach(order => {
        // هذا تحليل مبسط - يمكن تحسينه
        const category = 'عام'; // يحتاج ربط مع بيانات المنتجات
        categoryStats[category] = (categoryStats[category] || 0) + 1;
      });
      const topSellingCategory = Object.keys(categoryStats).reduce((a, b) => 
        categoryStats[a] > categoryStats[b] ? a : b, 'عام'
      );

      // هامش الربح
      const totalRevenue = orders.reduce((sum, order) => sum + order.final_amount, 0);
      const totalCost = purchases?.reduce((sum, purchase) => sum + purchase.total_amount, 0) || 0;
      const profitMargin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;

      // النمو الشهري والأسبوعي
      const lastMonthOrders = orders.filter(order => {
        const orderDate = new Date(order.created_at);
        const twoMonthsAgo = subDays(now, 60);
        return orderDate >= twoMonthsAgo && orderDate < monthAgo;
      });
      const lastMonthSales = lastMonthOrders.reduce((sum, order) => sum + order.final_amount, 0);
      const monthlyGrowth = lastMonthSales > 0 ? ((monthSales - lastMonthSales) / lastMonthSales) * 100 : 0;

      const lastWeekOrders = orders.filter(order => {
        const orderDate = new Date(order.created_at);
        const twoWeeksAgo = subDays(now, 14);
        return orderDate >= twoWeeksAgo && orderDate < weekAgo;
      });
      const lastWeekSales = lastWeekOrders.reduce((sum, order) => sum + order.final_amount, 0);
      const weeklyGrowth = lastWeekSales > 0 ? ((weekSales - lastWeekSales) / lastWeekSales) * 100 : 0;

      setAnalytics({
        todaySales,
        yesterdaySales,
        weekSales,
        monthSales,
        totalOrders,
        pendingOrders,
        completedOrders,
        cancelledOrders,
        returnedOrders,
        processingOrders,
        totalProducts,
        activeProducts,
        lowStockItems,
        outOfStockItems,
        totalCustomers,
        avgOrderValue,
        topSellingCategory,
        profitMargin,
        monthlyGrowth,
        weeklyGrowth
      });
    };

    calculateAdvancedAnalytics();
    const interval = setInterval(calculateAdvancedAnalytics, 60000); // تحديث كل دقيقة

    return () => clearInterval(interval);
  }, [orders, products, purchases]);

  // إنشاء ملخص مالي للتقارير
  const createFinancialSummary = () => {
    const totalRevenue = orders?.reduce((sum, order) => sum + order.final_amount, 0) || 0;
    const totalOrders = orders?.length || 0;
    const totalCost = purchases?.reduce((sum, purchase) => sum + purchase.total_amount, 0) || 0;
    const totalExpenses = accounting?.expenses?.reduce((sum, expense) => sum + expense.amount, 0) || 0;
    
    return {
      totalRevenue,
      totalOrders,
      totalCost,
      totalExpenses,
      netProfit: totalRevenue - totalCost - totalExpenses,
      averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0
    };
  };

  const financialSummary = createFinancialSummary();

  const renderPDFDocument = (reportType) => {
    const completeFinancialSummary = {
      ...financialSummary,
      totalOrders: analytics.totalOrders,
      pendingOrders: analytics.pendingOrders,
      completedOrders: analytics.completedOrders,
      cancelledOrders: analytics.cancelledOrders,
      returnedOrders: analytics.returnedOrders,
      processingOrders: analytics.processingOrders
    };

    switch (reportType) {
      case 'financial':
        return <FinancialReportPDF summary={completeFinancialSummary} dateRange={dateRange} />;
      case 'inventory':
        return <InventoryReportPDF products={products || []} settings={{}} />;
      case 'complete':
      default:
        return <InventoryReportPDF products={products || []} summary={completeFinancialSummary} />;
    }
  };

  const handleGenerateReport = async (reportType) => {
    setGeneratingReport(reportType);
    
    // محاكاة وقت التحضير
    setTimeout(() => {
      setGeneratingReport(null);
      toast({
        title: "تم إنشاء التقرير بنجاح",
        description: `تقرير ${reportType === 'financial' ? 'مالي' : reportType === 'inventory' ? 'المخزون' : 'شامل'} جاهز للتحميل`,
      });
    }, 2000);
  };

  // مؤشرات الأداء الرئيسية (KPIs)
  const kpis = [
    {
      title: "مبيعات اليوم",
      value: analytics.todaySales,
      format: "currency",
      change: analytics.yesterdaySales > 0 ? ((analytics.todaySales - analytics.yesterdaySales) / analytics.yesterdaySales) * 100 : 0,
      icon: DollarSign,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      iconBg: "bg-emerald-500"
    },
    {
      title: "الطلبات النشطة",
      value: analytics.pendingOrders,
      format: "number",
      change: analytics.weeklyGrowth,
      icon: ShoppingCart,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      iconBg: "bg-blue-500"
    },
    {
      title: "إجمالي المنتجات",
      value: analytics.activeProducts,
      format: "number",
      change: 0,
      icon: Package,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      iconBg: "bg-purple-500"
    },
    {
      title: "هامش الربح",
      value: analytics.profitMargin,
      format: "percentage",
      change: analytics.monthlyGrowth,
      icon: TrendingUp,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      iconBg: "bg-orange-500"
    }
  ];

  const formatValue = (value, format) => {
    switch (format) {
      case 'currency':
        return `${value.toLocaleString()} د.ع`;
      case 'percentage':
        return `${value.toFixed(1)}%`;
      case 'number':
      default:
        return value.toLocaleString();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl w-[95vw] max-h-[95vh] overflow-y-auto p-0">
        {/* Header المحدث */}
        <div className="sticky top-0 z-10 bg-background border-b px-6 py-4">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              مركز التقارير والتحليلات المتقدم v2.0
            </DialogTitle>
            <DialogDescription className="text-base">
              نظام شامل لإدارة وتحليل البيانات مع تقارير PDF احترافية
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-8">
          {/* مؤشرات الأداء الرئيسية */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {kpis.map((kpi, index) => (
              <Card key={index} className="overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-primary/20 border-0 shadow-lg shadow-black/10 dark:shadow-lg dark:shadow-primary/20 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">{kpi.title}</p>
                      <p className={`text-2xl font-bold ${kpi.color}`}>
                        {formatValue(kpi.value, kpi.format)}
                      </p>
                      {kpi.change !== 0 && (
                        <div className={`flex items-center text-xs ${
                          kpi.change > 0 ? 'text-emerald-600' : 'text-red-600'
                        }`}>
                          {kpi.change > 0 ? <ArrowUp className="w-3 h-3 mr-1" /> : <ArrowDown className="w-3 h-3 mr-1" />}
                          {Math.abs(kpi.change).toFixed(1)}% من أمس
                        </div>
                      )}
                    </div>
                    <div className={`p-3 rounded-full ${kpi.iconBg}`}>
                      <kpi.icon className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* الإحصائيات التفصيلية */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* إحصائيات المبيعات */}
            <Card className="lg:col-span-2 overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-primary/20 border-0 shadow-lg shadow-black/10 dark:shadow-lg dark:shadow-primary/20 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  تحليل المبيعات التفصيلي
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">مبيعات الأسبوع</span>
                      <span className="font-semibold">{analytics.weekSales.toLocaleString()} د.ع</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">مبيعات الشهر</span>
                      <span className="font-semibold">{analytics.monthSales.toLocaleString()} د.ع</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">متوسط قيمة الطلب</span>
                      <span className="font-semibold">{analytics.avgOrderValue.toLocaleString()} د.ع</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">النمو الأسبوعي</span>
                      <span className={`font-semibold ${analytics.weeklyGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {analytics.weeklyGrowth >= 0 ? '+' : ''}{analytics.weeklyGrowth.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">النمو الشهري</span>
                      <span className={`font-semibold ${analytics.monthlyGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {analytics.monthlyGrowth >= 0 ? '+' : ''}{analytics.monthlyGrowth.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">إجمالي العملاء</span>
                      <span className="font-semibold">{analytics.totalCustomers}</span>
                    </div>
                  </div>
                </div>

                {/* التحليل المتقدم للأرباح */}
                {analysisData && (
                  <div className="pt-4 border-t">
                    <h4 className="font-semibold mb-3">تحليل الأرباح المتقدم</h4>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="space-y-1">
                        <div className="text-lg font-bold text-green-600">
                          {analysisData.totalProfit?.toLocaleString()} د.ع
                        </div>
                        <div className="text-xs text-muted-foreground">إجمالي الربح</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-lg font-bold text-blue-600">
                          {analysisData.totalRevenue?.toLocaleString()} د.ع
                        </div>
                        <div className="text-xs text-muted-foreground">إجمالي المبيعات</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-lg font-bold text-orange-600">
                          {analysisData.totalCost?.toLocaleString()} د.ع
                        </div>
                        <div className="text-xs text-muted-foreground">إجمالي التكلفة</div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* حالة المخزون */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-500" />
                  حالة المخزون
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm">منتجات متوفرة</span>
                    </div>
                    <Badge variant="secondary">{analytics.activeProducts}</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-500" />
                      <span className="text-sm">مخزون منخفض</span>
                    </div>
                    <Badge variant="outline" className="text-yellow-600 border-yellow-200">
                      {analytics.lowStockItems}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <span className="text-sm">نفد المخزون</span>
                    </div>
                    <Badge variant="destructive">{analytics.outOfStockItems}</Badge>
                  </div>
                </div>

                <Separator />
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">إجمالي المنتجات</span>
                    <span className="font-medium">{analytics.totalProducts}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">معدل التوفر</span>
                    <span className="font-medium text-green-600">
                      {analytics.totalProducts > 0 ? 
                        (((analytics.totalProducts - analytics.outOfStockItems) / analytics.totalProducts) * 100).toFixed(1) + '%' 
                        : '0%'
                      }
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* حالة الطلبات */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-purple-500" />
                إدارة الطلبات والعمليات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="text-center space-y-2 p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{analytics.totalOrders}</div>
                  <div className="text-xs text-muted-foreground">إجمالي الطلبات</div>
                </div>
                <div className="text-center space-y-2 p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{analytics.pendingOrders}</div>
                  <div className="text-xs text-muted-foreground">في الانتظار</div>
                </div>
                <div className="text-center space-y-2 p-4 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg">
                  <div className="text-2xl font-bold text-indigo-600">{analytics.processingOrders}</div>
                  <div className="text-xs text-muted-foreground">قيد المعالجة</div>
                </div>
                <div className="text-center space-y-2 p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{analytics.completedOrders}</div>
                  <div className="text-xs text-muted-foreground">مكتملة</div>
                </div>
                <div className="text-center space-y-2 p-4 bg-gradient-to-br from-red-50 to-red-100 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{analytics.cancelledOrders}</div>
                  <div className="text-xs text-muted-foreground">ملغية</div>
                </div>
                <div className="text-center space-y-2 p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">{analytics.returnedOrders}</div>
                  <div className="text-xs text-muted-foreground">راجعة</div>
                </div>
              </div>
              
              <Separator className="my-6" />
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center space-y-2 p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg">
                  <div className="text-lg font-bold text-emerald-600">
                    {analytics.totalOrders > 0 ? ((analytics.completedOrders / analytics.totalOrders) * 100).toFixed(1) : 0}%
                  </div>
                  <div className="text-xs text-muted-foreground">معدل الإنجاز</div>
                </div>
                <div className="text-center space-y-2 p-4 bg-gradient-to-br from-rose-50 to-rose-100 rounded-lg">
                  <div className="text-lg font-bold text-rose-600">
                    {analytics.totalOrders > 0 ? ((analytics.cancelledOrders / analytics.totalOrders) * 100).toFixed(1) : 0}%
                  </div>
                  <div className="text-xs text-muted-foreground">معدل الإلغاء</div>
                </div>
                <div className="text-center space-y-2 p-4 bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg">
                  <div className="text-lg font-bold text-amber-600">
                    {analytics.totalOrders > 0 ? ((analytics.returnedOrders / analytics.totalOrders) * 100).toFixed(1) : 0}%
                  </div>
                  <div className="text-xs text-muted-foreground">معدل الإرجاع</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* تقارير PDF */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-red-500" />
                تصدير التقارير الاحترافية
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* التقرير المالي - تدرج أخضر راقي */}
                <div className="space-y-4 p-6 border-0 rounded-xl hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 hover:from-emerald-100 hover:via-green-100 hover:to-teal-100">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-r from-emerald-500 to-green-600 rounded-xl shadow-lg">
                      <DollarSign className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-emerald-700">التقرير المالي الشامل</h3>
                      <p className="text-sm text-emerald-600">
                        تحليل مفصل للوضع المالي والأرباح مع البيانات الحقيقية
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-white/60 p-3 rounded-lg space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">إجمالي الإيرادات:</span>
                      <span className="font-bold text-emerald-700">{financialSummary.totalRevenue.toLocaleString()} د.ع</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">صافي الربح:</span>
                      <span className="font-bold text-green-600">{financialSummary.netProfit.toLocaleString()} د.ع</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">إجمالي الطلبات:</span>
                      <span className="font-bold text-emerald-600">{analytics.totalOrders}</span>
                    </div>
                  </div>

                  <PDFDownloadLink
                    document={renderPDFDocument('financial')}
                    fileName={`تقرير-مالي-${format(new Date(), 'dd-MM-yyyy')}.pdf`}
                  >
                    {({ loading }) => (
                      <Button 
                        className="w-full bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-700 hover:to-green-800 text-white shadow-lg" 
                        disabled={loading || generatingReport === 'financial'}
                        onClick={() => handleGenerateReport('financial')}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        {loading || generatingReport === 'financial' ? 'جاري التحضير...' : 'تحميل التقرير المالي'}
                      </Button>
                    )}
                  </PDFDownloadLink>
                </div>

                {/* تقرير المخزون - تدرج أزرق راقي */}
                <div className="space-y-4 p-6 border-0 rounded-xl hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-blue-50 via-cyan-50 to-indigo-50 hover:from-blue-100 hover:via-cyan-100 hover:to-indigo-100">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-xl shadow-lg">
                      <Package className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-blue-700">تقرير المخزون المفصل</h3>
                      <p className="text-sm text-blue-600">
                        حالة المخزون والمنتجات مع تحليل شامل
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-white/60 p-3 rounded-lg space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">إجمالي المنتجات:</span>
                      <span className="font-bold text-blue-700">{analytics.totalProducts}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">مخزون منخفض:</span>
                      <span className="font-bold text-yellow-600">{analytics.lowStockItems}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">معدل التوفر:</span>
                      <span className="font-bold text-green-600">
                        {analytics.totalProducts > 0 ? 
                          (((analytics.totalProducts - analytics.outOfStockItems) / analytics.totalProducts) * 100).toFixed(1) + '%' 
                          : '0%'
                        }
                      </span>
                    </div>
                  </div>

                  <PDFDownloadLink
                    document={renderPDFDocument('inventory')}
                    fileName={`تقرير-مخزون-${format(new Date(), 'dd-MM-yyyy')}.pdf`}
                  >
                    {({ loading }) => (
                      <Button 
                        className="w-full bg-gradient-to-r from-blue-600 to-cyan-700 hover:from-blue-700 hover:to-cyan-800 text-white shadow-lg" 
                        disabled={loading || generatingReport === 'inventory'}
                        onClick={() => handleGenerateReport('inventory')}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        {loading || generatingReport === 'inventory' ? 'جاري التحضير...' : 'تحميل تقرير المخزون'}
                      </Button>
                    )}
                  </PDFDownloadLink>
                </div>

                {/* التقرير الشامل - تدرج بنفسجي راقي */}
                <div className="space-y-4 p-6 border-0 rounded-xl hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-purple-50 via-violet-50 to-fuchsia-50 hover:from-purple-100 hover:via-violet-100 hover:to-fuchsia-100 relative overflow-hidden">
                  {/* تأثير لامع */}
                  <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-white/30 to-transparent rounded-full blur-xl"></div>
                  
                  <div className="flex items-center gap-3 relative z-10">
                    <div className="p-3 bg-gradient-to-r from-purple-600 to-fuchsia-700 rounded-xl shadow-lg">
                      <Award className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-purple-700">التقرير الشامل المتكامل</h3>
                      <p className="text-sm text-purple-600">
                        تقرير كامل يجمع كافة البيانات بجودة احترافية
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-white/70 p-3 rounded-lg space-y-2 text-xs relative z-10">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">المبيعات:</span>
                      <span className="font-bold text-purple-700">{analytics.todaySales.toLocaleString()} د.ع</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">الطلبات:</span>
                      <span className="font-bold text-blue-600">{analytics.totalOrders}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">المنتجات:</span>
                      <span className="font-bold text-green-600">{analytics.totalProducts}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 relative z-10">
                    <Crown className="w-4 h-4 text-yellow-500" />
                    <span className="text-xs font-medium text-purple-600 bg-white/60 px-2 py-1 rounded-full">الأكثر شمولية</span>
                  </div>

                  <PDFDownloadLink
                    document={renderPDFDocument('complete')}
                    fileName={`تقرير-شامل-${format(new Date(), 'dd-MM-yyyy')}.pdf`}
                  >
                    {({ loading }) => (
                      <Button 
                        className="w-full bg-gradient-to-r from-purple-600 via-violet-600 to-fuchsia-700 hover:from-purple-700 hover:via-violet-700 hover:to-fuchsia-800 text-white shadow-lg relative z-10" 
                        disabled={loading || generatingReport === 'complete'}
                        onClick={() => handleGenerateReport('complete')}
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        {loading || generatingReport === 'complete' ? 'جاري التحضير...' : 'تحميل التقرير الشامل'}
                      </Button>
                    )}
                  </PDFDownloadLink>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* معلومات النظام */}
          <Card className="bg-gradient-to-r from-slate-50 to-gray-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Activity className="w-5 h-5 text-blue-500" />
                  <div>
                    <h3 className="font-semibold">آخر تحديث للبيانات</h3>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(), 'dd/MM/yyyy - HH:mm')} | البيانات محدثة تلقائياً
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  <Zap className="w-3 h-3 mr-1" />
                  مباشر
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReportsSettingsDialog;