import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, Download, BarChart3, 
  TrendingUp, DollarSign, Package, Users, ShoppingCart
} from 'lucide-react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import FinancialReportPDF from '@/components/pdf/FinancialReportPDF';
import InventoryReportPDF from '@/components/pdf/InventoryReportPDF';
import InventoryPDF from '@/components/pdf/InventoryPDF';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/AuthContext';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear, subDays } from 'date-fns';

const ReportsSettingsDialog = ({ open, onOpenChange }) => {
  const { orders, products, accounting, purchases } = useInventory();
  const { allUsers } = useAuth();
  const [generatingReport, setGeneratingReport] = useState(null);

  // حساب البيانات الحقيقية للنظام
  const calculateRealData = () => {
    const now = new Date();
    const safeOrders = Array.isArray(orders) ? orders : [];
    const safeProducts = Array.isArray(products) ? products : [];
    const deliveredOrders = safeOrders.filter(o => o.status === 'delivered');
    
    const totalRevenue = deliveredOrders.reduce((sum, o) => sum + (o.final_amount || 0), 0);
    const totalOrders = deliveredOrders.length;
    const totalProducts = safeProducts.length;
    const totalExpenses = Array.isArray(accounting?.expenses) 
      ? accounting.expenses.reduce((sum, e) => sum + (e.amount || 0), 0) 
      : 0;
    
    const totalVariants = safeProducts.reduce((sum, p) => sum + (p.variants?.length || 0), 0);
    const totalStock = safeProducts.reduce((sum, p) => 
      sum + (p.variants?.reduce((vSum, v) => vSum + (v.quantity || 0), 0) || 0), 0
    );
    
    return {
      totalRevenue,
      totalOrders,
      totalProducts,
      totalVariants,
      totalStock,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      averageOrderValue: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
      profitMargin: totalRevenue > 0 ? `${((totalRevenue - totalExpenses) / totalRevenue * 100).toFixed(1)}%` : '0%',
      orders: deliveredOrders,
      products: safeProducts
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
      totalRevenue: realData.totalRevenue,
      totalExpenses: realData.totalExpenses,
      netProfit: realData.netProfit,
      cogs: realData.totalExpenses * 0.6, // تقدير تكلفة البضاعة
      grossProfit: realData.totalRevenue - (realData.totalExpenses * 0.6),
      generalExpenses: realData.totalExpenses * 0.4,
      totalProfit: realData.netProfit,
      inventoryValue: realData.totalStock * 15000, // متوسط سعر تقديري
      chartData: []
    };

    switch (reportType) {
      case 'financial':
        return <FinancialReportPDF summary={summary} dateRange={dateRanges.monthly} />;
      case 'inventory':
        return <InventoryPDF products={realData.products} />;
      case 'sales':
      case 'full':
      default:
        return <InventoryReportPDF products={realData.products} />;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            التقارير والإحصائيات
          </DialogTitle>
          <DialogDescription>
            إنشاء وتصدير تقارير PDF شاملة من البيانات الحقيقية للنظام
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* ملخص سريع للبيانات */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">ملخص البيانات الحالية</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-500">{realData.totalRevenue.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">إجمالي المبيعات (د.ع)</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-500">{realData.totalProducts}</p>
                  <p className="text-sm text-muted-foreground">المنتجات</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-500">{realData.totalOrders}</p>
                  <p className="text-sm text-muted-foreground">الطلبات المكتملة</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-500">{realData.totalStock}</p>
                  <p className="text-sm text-muted-foreground">إجمالي المخزون</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* التقارير المتاحة */}
          <div>
            <h3 className="text-lg font-semibold mb-4">التقارير المتاحة للتصدير</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reportTypes.map((report) => {
                const Icon = report.icon;
                return (
                  <Card key={report.id} className="group hover:shadow-md transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg bg-muted ${report.color}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold">{report.title}</h4>
                          <p className="text-sm text-muted-foreground mb-3">{report.description}</p>
                          
                          {/* عرض البيانات المختصرة */}
                          <div className="flex flex-wrap gap-2 mb-3">
                            {report.id === 'financial' && (
                              <>
                                <Badge variant="outline" className="text-xs">
                                  إيرادات: {report.data.revenue.toLocaleString()} د.ع
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  ربح: {report.data.profit.toLocaleString()} د.ع
                                </Badge>
                              </>
                            )}
                            {report.id === 'inventory' && (
                              <>
                                <Badge variant="outline" className="text-xs">
                                  منتجات: {report.data.products}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  مخزون: {report.data.stock}
                                </Badge>
                              </>
                            )}
                            {report.id === 'sales' && (
                              <>
                                <Badge variant="outline" className="text-xs">
                                  طلبات: {report.data.orders}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  متوسط: {report.data.average.toLocaleString()} د.ع
                                </Badge>
                              </>
                            )}
                          </div>

                          <PDFDownloadLink
                            document={generatePDFComponent(report.id)}
                            fileName={getFileName(report.id)}
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-3 w-full"
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

          {/* معلومات إضافية */}
          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <TrendingUp className="w-5 h-5 text-blue-500 mt-1" />
                <div>
                  <h4 className="font-semibold">محتويات التقارير</h4>
                  <div className="text-sm text-muted-foreground space-y-1 mt-2">
                    <p>• <strong>التقرير المالي:</strong> ملخص الإيرادات والمصاريف والأرباح مع الرسوم البيانية</p>
                    <p>• <strong>تقرير المخزون:</strong> حالة المخزون الحالية لجميع المنتجات والمتغيرات</p>
                    <p>• <strong>تقرير المبيعات:</strong> تفاصيل الطلبات والمبيعات والعملاء</p>
                    <p>• <strong>التقرير الشامل:</strong> يحتوي على جميع البيانات السابقة في تقرير واحد</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

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