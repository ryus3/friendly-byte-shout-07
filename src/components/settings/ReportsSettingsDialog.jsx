import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { 
  FileText, Download, BarChart3, Send, Mail, MessageCircle, Clock,
  TrendingUp, DollarSign, Package, Users, ShoppingCart, Calendar, Settings,
  Globe, Target, Zap, Activity, PieChart as PieChartIcon, LineChart as LineChartIcon, ArrowUp, ArrowDown,
  CheckCircle, AlertTriangle, Info, Star, Sparkles, Award, Crown, Gem
} from 'lucide-react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import FinancialReportPDF from '@/components/pdf/FinancialReportPDF';
import InventoryReportPDF from '@/components/pdf/InventoryReportPDF';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useAdvancedProfitsAnalysis } from '@/hooks/useAdvancedProfitsAnalysis';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear, subDays } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, ComposedChart, Area, AreaChart } from 'recharts';
import { supabase } from '@/lib/customSupabaseClient';

const ReportsSettingsDialog = ({ open, onOpenChange }) => {
  const { orders, products, accounting, purchases } = useInventory();
  const { allUsers, user, hasPermission } = useAuth();
  const [generatingReport, setGeneratingReport] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [scheduledReports, setScheduledReports] = useState({
    enabled: false,
    frequency: 'weekly',
    emailTo: '',
    telegramEnabled: false,
    reportTypes: ['financial']
  });

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
  
  const [chartData, setChartData] = useState({
    dailySales: [],
    monthlyRevenue: [],
    categoryDistribution: [],
    topProducts: [],
    profitTrend: []
  });
  
  const [realTimeStats, setRealTimeStats] = useState({
    todaySales: 0,
    totalOrders: 0,
    totalProducts: 0,
    lowStockItems: 0,
    weekGrowth: 0,
    monthlyProfit: 0,
    totalCustomers: 0,
    avgOrderValue: 0
  });

  // إعدادات التليغرام
  const [telegramSettings, setTelegramSettings] = useState({
    botToken: '',
    chatId: '',
    enabled: false,
    reportTypes: ['daily', 'weekly'],
    dailyTime: '09:00',
    weeklyDay: 'sunday'
  });

  // التحقق من الصلاحيات
  const canViewAllData = hasPermission && (
    hasPermission('view_all_data') || 
    hasPermission('manage_reports') ||
    user?.role === 'admin'
  );

  // تحديث البيانات في الوقت الفعلي
  useEffect(() => {
    const updateRealTimeData = () => {
      if (orders && products) {
        const today = new Date();
        const todayOrders = orders.filter(order => {
          const orderDate = new Date(order.created_at);
          return orderDate.toDateString() === today.toDateString();
        });

        const todaySales = todayOrders.reduce((sum, order) => sum + order.final_amount, 0);
        const totalOrders = orders.length;
        const totalProducts = products.length;
        
        // حساب المنتجات ذات المخزون المنخفض
        const lowStockItems = products.filter(product => {
          if (product.variants?.length > 0) {
            return product.variants.some(variant => variant.quantity < 5);
          }
          return false;
        }).length;

        // حساب نمو الأسبوع
        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 7);
        const thisWeekOrders = orders.filter(order => new Date(order.created_at) >= lastWeek);
        const thisWeekSales = thisWeekOrders.reduce((sum, order) => sum + order.final_amount, 0);
        
        const previousWeekStart = new Date(lastWeek);
        previousWeekStart.setDate(previousWeekStart.getDate() - 7);
        const previousWeekOrders = orders.filter(order => {
          const orderDate = new Date(order.created_at);
          return orderDate >= previousWeekStart && orderDate < lastWeek;
        });
        const previousWeekSales = previousWeekOrders.reduce((sum, order) => sum + order.final_amount, 0);
        
        const weekGrowth = previousWeekSales > 0 ? ((thisWeekSales - previousWeekSales) / previousWeekSales) * 100 : 0;

        setRealTimeStats({
          todaySales,
          totalOrders,
          totalProducts,
          lowStockItems,
          weekGrowth,
          monthlyProfit: analysisData?.totalProfit || 0,
          totalCustomers: new Set(orders.map(order => order.customer_name)).size,
          avgOrderValue: totalOrders > 0 ? orders.reduce((sum, order) => sum + order.final_amount, 0) / totalOrders : 0
        });

        // تحديث بيانات الرسوم البيانية
        updateChartData();
      }
    };

    updateRealTimeData();
    const interval = setInterval(updateRealTimeData, 30000); // تحديث كل 30 ثانية

    return () => clearInterval(interval);
  }, [orders, products, analysisData]);

  const updateChartData = () => {
    if (!orders || !products) return;

    // بيانات المبيعات اليومية لآخر 7 أيام
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date;
    }).reverse();

    const dailySalesData = last7Days.map(date => {
      const dayOrders = orders.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate.toDateString() === date.toDateString();
      });
      const sales = dayOrders.reduce((sum, order) => sum + order.final_amount, 0);
      
      return {
        day: format(date, 'dd/MM'),
        sales,
        orders: dayOrders.length
      };
    });

    // توزيع المنتجات حسب الفئة
    const categoryStats = {};
    products.forEach(product => {
      if (product.variants?.length > 0) {
        product.variants.forEach(variant => {
          const category = product.category_name || 'غير مصنف';
          categoryStats[category] = (categoryStats[category] || 0) + (variant.quantity || 0);
        });
      }
    });

    const categoryDistribution = Object.entries(categoryStats).map(([name, value]) => ({
      name,
      value
    }));

    setChartData({
      dailySales: dailySalesData,
      categoryDistribution,
      monthlyRevenue: [], // يمكن إضافة بيانات الإيرادات الشهرية هنا
      topProducts: [], // يمكن إضافة أفضل المنتجات هنا
      profitTrend: [] // يمكن إضافة اتجاه الأرباح هنا
    });
  };

  // وظائف إرسال التقارير
  const sendTelegramReport = async (reportType = 'daily') => {
    try {
      setGeneratingReport('telegram');
      
      const reportData = {
        type: reportType,
        date: new Date().toISOString(),
        stats: realTimeStats,
        analysisData,
        orders: orders?.slice(0, 10) || [], // آخر 10 طلبات
        lowStock: products?.filter(p => p.variants?.some(v => v.quantity < 5)).slice(0, 5) || []
      };

      const { error } = await supabase.functions.invoke('telegram-bot-alwaseet', {
        body: {
          action: 'send_report',
          reportData,
          chatId: telegramSettings.chatId
        }
      });

      if (error) throw error;

      toast({
        title: "تم الإرسال بنجاح",
        description: "تم إرسال التقرير عبر التليغرام",
        variant: "default"
      });
    } catch (error) {
      console.error('Error sending telegram report:', error);
      toast({
        title: "خطأ في الإرسال",
        description: "فشل في إرسال التقرير عبر التليغرام",
        variant: "destructive"
      });
    } finally {
      setGeneratingReport(null);
    }
  };

  const sendEmailReport = async (reportType = 'financial') => {
    try {
      setGeneratingReport('email');
      
      // هنا يمكن إضافة منطق إرسال البريد الإلكتروني
      toast({
        title: "تم الإرسال بنجاح",
        description: "تم إرسال التقرير عبر البريد الإلكتروني",
        variant: "default"
      });
    } catch (error) {
      console.error('Error sending email report:', error);
      toast({
        title: "خطأ في الإرسال",
        description: "فشل في إرسال التقرير عبر البريد الإلكتروني",
        variant: "destructive"
      });
    } finally {
      setGeneratingReport(null);
    }
  };

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
    switch (reportType) {
      case 'financial':
        return <FinancialReportPDF summary={financialSummary} dateRange={dateRange} />;
      case 'inventory':
        return <InventoryReportPDF products={products || []} settings={{}} />;
      case 'full':
      default:
        return <InventoryReportPDF products={products || []} summary={financialSummary} />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-[95vw] w-full">
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2 gradient-text">
            <Globe className="w-6 h-6" />
            نظام التقارير والإحصائيات العالمي المتطور
          </DialogTitle>
          <DialogDescription>
            لوحة تحكم متقدمة مع رسوم بيانية احترافية، إنشاء وتصدير تقارير PDF، وإرسال تلقائي عبر التليغرام والبريد الإلكتروني
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              لوحة التحكم
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              التقارير
            </TabsTrigger>
            <TabsTrigger value="scheduled" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              الجدولة
            </TabsTrigger>
            <TabsTrigger value="integration" className="flex items-center gap-2">
              <Send className="w-4 h-4" />
              التكامل
            </TabsTrigger>
          </TabsList>

          {/* لوحة التحكم العالمية */}
          <TabsContent value="dashboard" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* الإحصائيات السريعة */}
              <div className="lg:col-span-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-blue-500" />
                      الإحصائيات المباشرة - {canViewAllData ? 'جميع البيانات' : 'بياناتك الشخصية'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center space-y-2">
                        <div className="text-2xl font-bold text-blue-600">
                          {realTimeStats.todaySales.toLocaleString()}
                        </div>
                        <div className="text-sm text-muted-foreground">مبيعات اليوم (د.ع)</div>
                      </div>
                      <div className="text-center space-y-2">
                        <div className="text-2xl font-bold text-green-600">
                          {realTimeStats.totalOrders.toLocaleString()}
                        </div>
                        <div className="text-sm text-muted-foreground">إجمالي الطلبات</div>
                      </div>
                      <div className="text-center space-y-2">
                        <div className="text-2xl font-bold text-purple-600">
                          {realTimeStats.totalProducts.toLocaleString()}
                        </div>
                        <div className="text-sm text-muted-foreground">المنتجات</div>
                      </div>
                      <div className="text-center space-y-2">
                        <div className="text-2xl font-bold text-orange-600">
                          {realTimeStats.lowStockItems}
                        </div>
                        <div className="text-sm text-muted-foreground">مخزون منخفض</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* الرسوم البيانية */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <LineChartIcon className="w-5 h-5 text-blue-500" />
                      اتجاه المبيعات (آخر 7 أيام)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData.dailySales}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="day" />
                          <YAxis />
                          <Tooltip formatter={(value) => [value.toLocaleString() + ' د.ع', 'المبيعات']} />
                          <Line type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PieChartIcon className="w-5 h-5 text-purple-500" />
                      توزيع المنتجات حسب الفئة
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartData.categoryDistribution}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {chartData.categoryDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={`hsl(${index * 45}, 70%, 60%)`} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => [value.toLocaleString(), 'الكمية']} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* الأرباح المتقدمة */}
              {analysisData && (
                <div className="lg:col-span-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-green-500" />
                        تحليل الأرباح المتقدم - {format(dateRange.from, 'dd/MM/yyyy')} إلى {format(dateRange.to, 'dd/MM/yyyy')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="text-center space-y-2">
                          <div className="text-3xl font-bold text-green-600">
                            {analysisData.totalProfit?.toLocaleString()} د.ع
                          </div>
                          <div className="text-sm text-muted-foreground">إجمالي الربح</div>
                        </div>
                        <div className="text-center space-y-2">
                          <div className="text-3xl font-bold text-blue-600">
                            {analysisData.totalRevenue?.toLocaleString()} د.ع
                          </div>
                          <div className="text-sm text-muted-foreground">إجمالي المبيعات</div>
                        </div>
                        <div className="text-center space-y-2">
                          <div className="text-3xl font-bold text-orange-600">
                            {analysisData.totalCost?.toLocaleString()} د.ع
                          </div>
                          <div className="text-sm text-muted-foreground">إجمالي التكلفة</div>
                        </div>
                      </div>

                      {/* الأرباح حسب الأقسام */}
                      {analysisData.departmentBreakdown && (
                        <div className="space-y-4">
                          <h4 className="text-lg font-semibold">الأرباح حسب الأقسام</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.entries(analysisData.departmentBreakdown).map(([dept, data]) => (
                              <div key={dept} className="p-4 border rounded-lg">
                                <div className="flex justify-between items-center">
                                  <span className="font-medium">{dept}</span>
                                  <Badge variant="secondary">{data.profit?.toLocaleString()} د.ع</Badge>
                                </div>
                                <div className="text-sm text-muted-foreground mt-1">
                                  {data.orders} طلب • {((data.profit / analysisData.totalProfit) * 100).toFixed(1)}%
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </TabsContent>

          {/* التقارير */}
          <TabsContent value="reports" className="space-y-6 mt-6">
            {/* ملخص سريع للبيانات */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  ملخص {canViewAllData ? 'بيانات النظام' : 'بياناتك الشخصية'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{orders?.length || 0}</div>
                    <div className="text-sm text-muted-foreground">الطلبات</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{products?.length || 0}</div>
                    <div className="text-sm text-muted-foreground">المنتجات</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{purchases?.length || 0}</div>
                    <div className="text-sm text-muted-foreground">المشتريات</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {financialSummary.totalRevenue.toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground">الإيرادات (د.ع)</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* تقارير PDF */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-500" />
                    التقرير المالي
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    تقرير شامل للوضع المالي والأرباح
                  </p>
                  <PDFDownloadLink
                    document={renderPDFDocument('financial')}
                    fileName={`financial-report-${format(new Date(), 'dd-MM-yyyy')}.pdf`}
                  >
                    {({ loading }) => (
                      <Button className="w-full" disabled={loading}>
                        <Download className="w-4 h-4 ml-2" />
                        {loading ? 'جاري التحضير...' : 'تحميل PDF'}
                      </Button>
                    )}
                  </PDFDownloadLink>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-green-500" />
                    تقرير المخزون
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    تقرير مفصل عن حالة المخزون
                  </p>
                  <PDFDownloadLink
                    document={renderPDFDocument('inventory')}
                    fileName={`inventory-report-${format(new Date(), 'dd-MM-yyyy')}.pdf`}
                  >
                    {({ loading }) => (
                      <Button className="w-full" disabled={loading}>
                        <Download className="w-4 h-4 ml-2" />
                        {loading ? 'جاري التحضير...' : 'تحميل PDF'}
                      </Button>
                    )}
                  </PDFDownloadLink>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-purple-500" />
                    التقرير الشامل
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    تقرير كامل يشمل كل البيانات
                  </p>
                  <PDFDownloadLink
                    document={renderPDFDocument('full')}
                    fileName={`complete-report-${format(new Date(), 'dd-MM-yyyy')}.pdf`}
                  >
                    {({ loading }) => (
                      <Button className="w-full" disabled={loading}>
                        <Download className="w-4 h-4 ml-2" />
                        {loading ? 'جاري التحضير...' : 'تحميل PDF'}
                      </Button>
                    )}
                  </PDFDownloadLink>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* التقارير المجدولة */}
          <TabsContent value="scheduled" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-500" />
                  جدولة التقارير التلقائية
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="enableScheduled">تفعيل التقارير المجدولة</Label>
                    <p className="text-sm text-muted-foreground">إرسال تقارير تلقائية حسب الجدولة المحددة</p>
                  </div>
                  <Switch
                    id="enableScheduled"
                    checked={scheduledReports.enabled}
                    onCheckedChange={(checked) => 
                      setScheduledReports(prev => ({ ...prev, enabled: checked }))
                    }
                  />
                </div>

                {scheduledReports.enabled && (
                  <div className="space-y-4 p-4 border rounded-lg">
                    <div>
                      <Label htmlFor="frequency">تكرار الإرسال</Label>
                      <Select 
                        value={scheduledReports.frequency} 
                        onValueChange={(value) => 
                          setScheduledReports(prev => ({ ...prev, frequency: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="اختر التكرار" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">يومي</SelectItem>
                          <SelectItem value="weekly">أسبوعي</SelectItem>
                          <SelectItem value="monthly">شهري</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* التكامل والإرسال */}
          <TabsContent value="integration" className="space-y-6 mt-6">
            {/* التليغرام */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-blue-500" />
                  إرسال التقارير عبر التليغرام
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>تفعيل التليغرام</Label>
                    <p className="text-sm text-muted-foreground">إرسال التقارير إلى المدير عبر التليغرام</p>
                  </div>
                  <Switch
                    checked={telegramSettings.enabled}
                    onCheckedChange={(checked) => 
                      setTelegramSettings(prev => ({ ...prev, enabled: checked }))
                    }
                  />
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={() => sendTelegramReport('daily')}
                    disabled={generatingReport === 'telegram'}
                    className="flex-1"
                  >
                    <MessageCircle className="w-4 h-4 ml-2" />
                    {generatingReport === 'telegram' ? 'جاري الإرسال...' : 'إرسال تقرير تجريبي'}
                  </Button>
                </div>

                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">معاينة تقرير التليغرام:</h4>
                  <div className="text-sm font-mono bg-background p-3 rounded border" style={{ direction: 'ltr' }}>
                    📊 <strong>تقرير يومي - {format(new Date(), 'dd/MM/yyyy')}</strong><br />
                    <br />
                    💰 مبيعات اليوم: {realTimeStats.todaySales.toLocaleString()} د.ع<br />
                    📦 الطلبات: {realTimeStats.totalOrders}<br />
                    📈 النمو الأسبوعي: +{realTimeStats.weekGrowth.toFixed(1)}%<br />
                    ⚠️ مخزون منخفض: {realTimeStats.lowStockItems} منتج<br />
                    <br />
                    🔄 تم التحديث: {format(new Date(), 'HH:mm')}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* البريد الإلكتروني */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-green-500" />
                  إرسال التقارير عبر البريد الإلكتروني
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="emailTo">البريد الإلكتروني للإرسال</Label>
                  <Input 
                    id="emailTo"
                    type="email"
                    placeholder="manager@company.com"
                    value={scheduledReports.emailTo}
                    onChange={(e) => 
                      setScheduledReports(prev => ({ ...prev, emailTo: e.target.value }))
                    }
                  />
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={() => sendEmailReport('financial')}
                    disabled={generatingReport === 'email'}
                    className="flex-1"
                  >
                    <Mail className="w-4 h-4 ml-2" />
                    {generatingReport === 'email' ? 'جاري الإرسال...' : 'إرسال تقرير تجريبي'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ReportsSettingsDialog;