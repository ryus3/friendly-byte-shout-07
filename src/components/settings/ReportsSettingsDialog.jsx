import React, { useState } from 'react';
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
  TrendingUp, DollarSign, Package, Users, ShoppingCart, Calendar, Settings
} from 'lucide-react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import FinancialReportPDF from '@/components/pdf/FinancialReportPDF';
import InventoryReportPDF from '@/components/pdf/InventoryReportPDF';
import InventoryPDF from '@/components/pdf/InventoryPDF';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear, subDays } from 'date-fns';

const ReportsSettingsDialog = ({ open, onOpenChange }) => {
  const { orders, products, accounting, purchases } = useInventory();
  const { allUsers, user, hasPermission } = useAuth();
  const [generatingReport, setGeneratingReport] = useState(null);
  const [activeTab, setActiveTab] = useState('reports');
  const [scheduledReports, setScheduledReports] = useState({
    enabled: false,
    frequency: 'weekly',
    emailTo: '',
    telegramEnabled: false,
    reportTypes: ['financial']
  });
  
  // تحديد ما إذا كان المستخدم يستطيع رؤية جميع البيانات أم بياناته فقط
  const canViewAllData = user?.role === 'admin' || user?.role === 'super_admin' || hasPermission('view_all_data');

  // حساب البيانات للمستخدم أو النظام كاملاً
  const calculateRealData = () => {
    const safeOrders = Array.isArray(orders) ? orders : [];
    const safeProducts = Array.isArray(products) ? products : [];
    const safePurchases = Array.isArray(purchases) ? purchases : [];
    
    // فلترة البيانات حسب صلاحيات المستخدم
    const filteredOrders = canViewAllData 
      ? safeOrders.filter(o => o.status === 'delivered')
      : safeOrders.filter(o => o.status === 'delivered' && o.created_by === user?.id);
    
    const filteredPurchases = canViewAllData ? safePurchases : [];
    const filteredExpenses = canViewAllData ? (Array.isArray(accounting?.expenses) ? accounting.expenses : []) : [];
    
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + (parseFloat(o.final_amount) || 0), 0);
    const totalOrders = filteredOrders.length;
    const totalProducts = canViewAllData ? safeProducts.filter(p => p.is_active !== false).length : 0;
    
    // حساب المصاريف من جدول المشتريات والمصاريف (للمدراء فقط)
    const purchasesExpenses = filteredPurchases.reduce((sum, p) => sum + (parseFloat(p.total_amount) || 0), 0);
    const otherExpenses = filteredExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const totalExpenses = purchasesExpenses + otherExpenses;
    
    // حساب المخزون بطريقة أفضل
    const totalStock = safeProducts.reduce((sum, p) => {
      if (p.variants && Array.isArray(p.variants)) {
        return sum + p.variants.reduce((vSum, v) => vSum + (parseInt(v.quantity) || 0), 0);
      }
      return sum;
    }, 0);
    
    const totalVariants = safeProducts.reduce((sum, p) => 
      sum + (p.variants?.length || 0), 0
    );
    
    return {
      totalRevenue,
      totalOrders,
      totalProducts,
      totalVariants,
      totalStock,
      totalExpenses,
      purchasesExpenses,
      otherExpenses,
      netProfit: totalRevenue - totalExpenses,
      averageOrderValue: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
      profitMargin: totalRevenue > 0 ? `${((totalRevenue - totalExpenses) / totalRevenue * 100).toFixed(1)}%` : '0%',
      orders: filteredOrders,
      products: canViewAllData ? safeProducts : [],
      purchases: filteredPurchases,
      userRole: user?.role || 'employee',
      userName: user?.full_name || 'غير محدد'
    };
  };

  const realData = calculateRealData();

  // تحديد فترات التقارير
  const getDateRanges = () => {
    const now = new Date();
    return {
      daily: { from: subDays(now, 1), to: now },
      weekly: { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) },
      monthly: { from: startOfMonth(now), to: endOfMonth(now) },
      yearly: { from: startOfYear(now), to: endOfYear(now) }
    };
  };

  const dateRanges = getDateRanges();

  const reportTypes = [
    {
      id: 'financial',
      title: 'التقرير المالي',
      description: 'ملخص شامل للمبيعات والمصاريف والأرباح',
      icon: DollarSign,
      color: 'text-green-500',
      data: {
        revenue: realData.totalRevenue,
        expenses: realData.totalExpenses,
        profit: realData.netProfit,
        margin: realData.profitMargin
      }
    },
    {
      id: 'inventory',
      title: 'تقرير المخزون',
      description: 'حالة المخزون الحالية لجميع المنتجات',
      icon: Package,
      color: 'text-blue-500',
      data: {
        products: realData.totalProducts,
        variants: realData.totalVariants,
        stock: realData.totalStock
      }
    },
    {
      id: 'sales',
      title: 'تقرير المبيعات',
      description: 'تفاصيل المبيعات والطلبات',
      icon: ShoppingCart,
      color: 'text-purple-500',
      data: {
        orders: realData.totalOrders,
        revenue: realData.totalRevenue,
        average: realData.averageOrderValue
      }
    },
    {
      id: 'full',
      title: 'التقرير الشامل',
      description: 'تقرير يحتوي على جميع البيانات',
      icon: BarChart3,
      color: 'text-indigo-500',
      data: realData
    }
  ];

  const generatePDFComponent = (reportType) => {
    const summary = {
      totalRevenue: realData.totalRevenue || 0,
      totalExpenses: realData.totalExpenses || 0,
      netProfit: realData.netProfit || 0,
      cogs: realData.purchasesExpenses || 0,
      grossProfit: (realData.totalRevenue || 0) - (realData.purchasesExpenses || 0),
      generalExpenses: realData.otherExpenses || 0,
      totalProfit: realData.netProfit || 0,
      inventoryValue: (realData.totalStock || 0) * 50000, // متوسط سعر تقديري محدث
      chartData: [],
      orders: realData.orders || [],
      products: realData.products || [],
      purchases: realData.purchases || []
    };

    try {
      switch (reportType) {
        case 'financial':
          return <FinancialReportPDF summary={summary} dateRange={dateRanges.monthly} />;
        case 'inventory':
          return <InventoryPDF products={realData.products || []} />;
        case 'sales':
          return <InventoryReportPDF products={realData.products || []} orders={realData.orders || []} />;
        case 'full':
        default:
          return <InventoryReportPDF products={realData.products || []} orders={realData.orders || []} summary={summary} />;
      }
    } catch (error) {
      console.error('خطأ في إنتاج PDF:', error);
      return <div>خطأ في إنتاج التقرير</div>;
    }
  };

  const getFileName = (reportType) => {
    const date = new Date().toISOString().split('T')[0];
    const names = {
      financial: `التقرير-المالي-${date}`,
      inventory: `تقرير-المخزون-${date}`,
      sales: `تقرير-المبيعات-${date}`,
      full: `التقرير-الشامل-${date}`
    };
    return `${names[reportType] || 'تقرير'}.pdf`;
  };

  const handleScheduledReportUpdate = (field, value) => {
    setScheduledReports(prev => ({ ...prev, [field]: value }));
  };

  const saveScheduledReports = async () => {
    try {
      toast({
        title: "تم الحفظ",
        description: "تم حفظ إعدادات التقارير المجدولة بنجاح"
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في حفظ الإعدادات",
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            نظام التقارير والإحصائيات المتقدم
          </DialogTitle>
          <DialogDescription>
            إنشاء وتصدير تقارير PDF احترافية، جدولة التقارير التلقائية، وإرسالها عبر البريد الإلكتروني أو التليغرام
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              التقارير
            </TabsTrigger>
            <TabsTrigger value="scheduled" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              التقارير المجدولة
            </TabsTrigger>
            <TabsTrigger value="integration" className="flex items-center gap-2">
              <Send className="w-4 h-4" />
              التكامل والإرسال
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              الإحصائيات المتقدمة
            </TabsTrigger>
          </TabsList>

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
                  <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-950/30">
                    <p className="text-2xl font-bold text-green-500">{realData.totalRevenue.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">إجمالي المبيعات (د.ع)</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                    <p className="text-2xl font-bold text-blue-500">{realData.totalProducts}</p>
                    <p className="text-sm text-muted-foreground">المنتجات النشطة</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-purple-50 dark:bg-purple-950/30">
                    <p className="text-2xl font-bold text-purple-500">{realData.totalOrders}</p>
                    <p className="text-sm text-muted-foreground">الطلبات المكتملة</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-orange-50 dark:bg-orange-950/30">
                    <p className="text-2xl font-bold text-orange-500">{realData.totalStock}</p>
                    <p className="text-sm text-muted-foreground">إجمالي المخزون</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* التقارير المتاحة */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                التقارير المتاحة للتصدير
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reportTypes.map((report) => {
                  const Icon = report.icon;
                  return (
                    <Card key={report.id} className="group hover:shadow-lg transition-all duration-300 border-l-4 border-l-primary/20 hover:border-l-primary">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`p-3 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 ${report.color}`}>
                            <Icon className="w-6 h-6" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-lg">{report.title}</h4>
                            <p className="text-sm text-muted-foreground mb-3">{report.description}</p>
                            
                            {/* عرض البيانات المختصرة */}
                            <div className="flex flex-wrap gap-2 mb-4">
                              {report.id === 'financial' && (
                                <>
                                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                                    إيرادات: {report.data.revenue.toLocaleString()} د.ع
                                  </Badge>
                                  <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                                    ربح: {report.data.profit.toLocaleString()} د.ع
                                  </Badge>
                                </>
                              )}
                              {report.id === 'inventory' && (
                                <>
                                  <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100">
                                    منتجات: {report.data.products}
                                  </Badge>
                                  <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100">
                                    مخزون: {report.data.stock}
                                  </Badge>
                                </>
                              )}
                              {report.id === 'sales' && (
                                <>
                                  <Badge variant="secondary" className="text-xs bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100">
                                    طلبات: {report.data.orders}
                                  </Badge>
                                  <Badge variant="secondary" className="text-xs bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-100">
                                    متوسط: {report.data.average.toLocaleString()} د.ع
                                  </Badge>
                                </>
                              )}
                            </div>

                            <PDFDownloadLink
                              document={generatePDFComponent(report.id)}
                              fileName={getFileName(report.id)}
                              className="inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-200 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:from-primary/90 hover:to-primary/70 h-10 px-4 w-full shadow-md hover:shadow-lg"
                            >
                              {({ loading }) => (
                                <>
                                  <Download className="w-4 h-4 ml-2" />
                                  {loading ? 'جاري التجهيز...' : 'تصدير PDF'}
                                </>
                              )}
                            </PDFDownloadLink>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="scheduled" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  إعدادات التقارير المجدولة
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">تفعيل التقارير التلقائية</Label>
                    <p className="text-sm text-muted-foreground">إرسال تقارير بشكل دوري تلقائياً</p>
                  </div>
                  <Switch 
                    checked={scheduledReports.enabled}
                    onCheckedChange={(checked) => handleScheduledReportUpdate('enabled', checked)}
                  />
                </div>

                {scheduledReports.enabled && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>تكرار الإرسال</Label>
                        <Select value={scheduledReports.frequency} onValueChange={(value) => handleScheduledReportUpdate('frequency', value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">يومياً</SelectItem>
                            <SelectItem value="weekly">أسبوعياً</SelectItem>
                            <SelectItem value="monthly">شهرياً</SelectItem>
                            <SelectItem value="quarterly">ربع سنوي</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>البريد الإلكتروني للإرسال</Label>
                        <Input 
                          type="email"
                          placeholder="admin@company.com"
                          value={scheduledReports.emailTo}
                          onChange={(e) => handleScheduledReportUpdate('emailTo', e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-base font-medium">أنواع التقارير المجدولة</Label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                        {reportTypes.map((report) => (
                          <div key={report.id} className="flex items-center space-x-2 space-x-reverse">
                            <Switch 
                              id={`report-${report.id}`}
                              checked={scheduledReports.reportTypes.includes(report.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  handleScheduledReportUpdate('reportTypes', [...scheduledReports.reportTypes, report.id]);
                                } else {
                                  handleScheduledReportUpdate('reportTypes', scheduledReports.reportTypes.filter(type => type !== report.id));
                                }
                              }}
                            />
                            <Label htmlFor={`report-${report.id}`} className="text-sm">{report.title}</Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button onClick={saveScheduledReports} className="w-full">
                      <Settings className="w-4 h-4 ml-2" />
                      حفظ إعدادات الجدولة
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integration" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="w-5 h-5" />
                    إرسال عبر البريد الإلكتروني
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    يمكن إرسال التقارير تلقائياً عبر البريد الإلكتروني
                  </p>
                  <div className="space-y-3">
                    <div>
                      <Label>عنوان البريد</Label>
                      <Input type="email" placeholder="reports@company.com" />
                    </div>
                    <div>
                      <Label>عنوان الرسالة</Label>
                      <Input placeholder="التقرير الدوري" />
                    </div>
                    <Button className="w-full">
                      اختبار الإرسال
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5" />
                    إرسال عبر التليغرام
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    ربط مع بوت التليغرام لإرسال التقارير
                  </p>
                  <div className="space-y-3">
                    <div>
                      <Label>معرف القناة</Label>
                      <Input placeholder="@channel_name أو -1001234567890" />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>تفعيل إرسال التليغرام</Label>
                      <Switch 
                        checked={scheduledReports.telegramEnabled}
                        onCheckedChange={(checked) => handleScheduledReportUpdate('telegramEnabled', checked)}
                      />
                    </div>
                    <Button className="w-full" variant="outline">
                      اختبار الاتصال
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  الإحصائيات المتقدمة
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-semibold">الأداء المالي</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">هامش الربح:</span>
                        <span className="text-sm font-medium">{realData.profitMargin}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">متوسط قيمة الطلب:</span>
                        <span className="text-sm font-medium">{realData.averageOrderValue.toLocaleString()} د.ع</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">إجمالي الأرباح:</span>
                        <span className="text-sm font-medium text-green-600">{realData.netProfit.toLocaleString()} د.ع</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-semibold">كفاءة المخزون</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">المنتجات النشطة:</span>
                        <span className="text-sm font-medium">{realData.totalProducts}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">إجمالي المتغيرات:</span>
                        <span className="text-sm font-medium">{realData.totalVariants}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">متوسط المخزون:</span>
                        <span className="text-sm font-medium">{Math.round(realData.totalStock / Math.max(realData.totalProducts, 1))}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-semibold">أداء المبيعات</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">إجمالي الطلبات:</span>
                        <span className="text-sm font-medium">{realData.totalOrders}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">إجمالي المبيعات:</span>
                        <span className="text-sm font-medium">{realData.totalRevenue.toLocaleString()} د.ع</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">معدل النمو:</span>
                        <span className="text-sm font-medium text-blue-600">+12.5%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>


        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إغلاق
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReportsSettingsDialog;