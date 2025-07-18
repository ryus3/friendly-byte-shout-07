import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';
import { 
  FileText, Download, DollarSign, Package, BarChart3, TrendingUp
} from 'lucide-react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import FinancialReportPDF from '@/components/pdf/FinancialReportPDF';
import InventoryReportPDF from '@/components/pdf/InventoryReportPDF';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';

const ReportsSettingsDialog = ({ open, onOpenChange }) => {
  const { orders, products, accounting, purchases } = useInventory();
  const { user } = useAuth();
  const { canViewAllData, hasPermission } = usePermissions();
  const [generatingReport, setGeneratingReport] = useState(null);

  // حساب البيانات حسب الصلاحيات
  const calculateFilteredData = () => {
    const safeOrders = Array.isArray(orders) ? orders : [];
    const safeProducts = Array.isArray(products) ? products : [];
    const safePurchases = Array.isArray(purchases) ? purchases : [];
    
    // فلترة البيانات حسب الصلاحيات
    const filteredOrders = canViewAllData 
      ? safeOrders 
      : safeOrders.filter(order => order.created_by === user?.user_id);
    
    // حساب الإحصائيات
    const totalOrders = filteredOrders.length;
    
    // حساب المبيعات على أساس سعر المنتج فقط (بدون التوصيل)
    const totalRevenue = filteredOrders.reduce((sum, order) => {
      const productAmount = (order.total_amount || 0) - (order.delivery_fee || 0);
      return sum + Math.max(0, productAmount);
    }, 0);
    
    const totalDeliveryFees = filteredOrders.reduce((sum, order) => sum + (order.delivery_fee || 0), 0);
    const totalWithDelivery = filteredOrders.reduce((sum, order) => sum + (order.final_amount || 0), 0);
    
    const completedOrders = filteredOrders.filter(order => order.status === 'completed' || order.status === 'delivered');
    const pendingOrders = filteredOrders.filter(order => order.status === 'pending');
    
    return {
      totalOrders,
      totalRevenue, // سعر المنتجات فقط
      totalDeliveryFees,
      totalWithDelivery,
      completedOrders: completedOrders.length,
      pendingOrders: pendingOrders.length,
      activeProducts: safeProducts.filter(p => p.is_active).length,
      totalProducts: safeProducts.length,
      totalPurchases: safePurchases.length,
      ordersData: filteredOrders,
      productsData: safeProducts
    };
  };

  const systemData = calculateFilteredData();

  // عنوان التقرير حسب الصلاحيات
  const getReportTitle = () => {
    return canViewAllData ? 'تقارير النظام الشاملة' : 'تقاريري الشخصية';
  };

  const handleReportGeneration = (type) => {
    setGeneratingReport(type);
    setTimeout(() => {
      setGeneratingReport(null);
      toast({
        title: "تم إنشاء التقرير",
        description: `تم إنشاء ${type === 'financial' ? 'التقرير المالي' : 'تقرير المخزون'} بنجاح`,
      });
    }, 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {getReportTitle()}
          </DialogTitle>
          <DialogDescription>
            {canViewAllData 
              ? 'إنشاء وتصدير التقارير الشاملة للنظام' 
              : 'إنشاء وتصدير تقاريرك الشخصية'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
              <TabsTrigger value="financial">التقرير المالي</TabsTrigger>
              <TabsTrigger value="inventory">تقرير المخزون</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    الإحصائيات العامة
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                      <div className="text-2xl font-bold text-blue-600">{systemData.totalOrders.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">
                        {canViewAllData ? 'إجمالي طلبات النظام' : 'إجمالي طلباتي'}
                      </div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950/30">
                      <div className="text-2xl font-bold text-green-600">{systemData.totalRevenue.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">
                        {canViewAllData ? 'مبيعات النظام (د.ع)' : 'مبيعاتي (د.ع)'}
                      </div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30">
                      <div className="text-2xl font-bold text-purple-600">{systemData.completedOrders.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">الطلبات المكتملة</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30">
                      <div className="text-2xl font-bold text-orange-600">{systemData.activeProducts.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">المنتجات النشطة</div>
                    </div>
                  </div>
                  
                  {systemData.totalDeliveryFees > 0 && (
                    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">إجمالي رسوم التوصيل:</span>
                        <span className="text-lg font-bold text-blue-600">{systemData.totalDeliveryFees.toLocaleString()} د.ع</span>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-sm font-medium">الإجمالي مع التوصيل:</span>
                        <span className="text-lg font-bold text-green-600">{systemData.totalWithDelivery.toLocaleString()} د.ع</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="financial" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    التقرير المالي
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    {canViewAllData 
                      ? 'تقرير مالي شامل يحتوي على جميع المعاملات والأرباح في النظام'
                      : 'تقرير أرباحك ومبيعاتك الشخصية'
                    }
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-semibold mb-2">ملخص المبيعات</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>إجمالي الطلبات:</span>
                          <span className="font-medium">{systemData.totalOrders}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>قيمة المنتجات:</span>
                          <span className="font-medium">{systemData.totalRevenue.toLocaleString()} د.ع</span>
                        </div>
                        <div className="flex justify-between">
                          <span>رسوم التوصيل:</span>
                          <span className="font-medium">{systemData.totalDeliveryFees.toLocaleString()} د.ع</span>
                        </div>
                        <div className="flex justify-between border-t pt-2">
                          <span className="font-semibold">الإجمالي:</span>
                          <span className="font-semibold">{systemData.totalWithDelivery.toLocaleString()} د.ع</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-semibold mb-2">حالة الطلبات</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>مكتملة:</span>
                          <span className="font-medium text-green-600">{systemData.completedOrders}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>معلقة:</span>
                          <span className="font-medium text-orange-600">{systemData.pendingOrders}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>منتجات نشطة:</span>
                          <span className="font-medium">{systemData.activeProducts}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <PDFDownloadLink 
                    document={<FinancialReportPDF 
                      orders={systemData.ordersData} 
                      products={systemData.productsData}
                      reportTitle={canViewAllData ? "التقرير المالي الشامل" : "تقرير المبيعات الشخصي"}
                      userInfo={{
                        name: user?.full_name || user?.username,
                        isAdmin: canViewAllData,
                        generatedAt: new Date().toLocaleDateString('ar')
                      }}
                    />}
                    fileName={`financial-report-${new Date().toISOString().split('T')[0]}.pdf`}
                    className="w-full"
                  >
                    {({ blob, url, loading, error }) => (
                      <Button 
                        className="w-full" 
                        disabled={loading}
                        onClick={() => handleReportGeneration('financial')}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        {loading ? 'جاري إنشاء التقرير...' : 'تصدير التقرير المالي (PDF)'}
                      </Button>
                    )}
                  </PDFDownloadLink>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="inventory" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    تقرير المخزون
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    تقرير شامل لحالة المخزون والمنتجات المتاحة
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{systemData.totalProducts}</div>
                      <div className="text-sm text-muted-foreground">إجمالي المنتجات</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{systemData.activeProducts}</div>
                      <div className="text-sm text-muted-foreground">المنتجات النشطة</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">{systemData.totalProducts - systemData.activeProducts}</div>
                      <div className="text-sm text-muted-foreground">المنتجات غير النشطة</div>
                    </div>
                  </div>

                  <PDFDownloadLink 
                    document={<InventoryReportPDF 
                      products={systemData.productsData}
                      reportTitle="تقرير المخزون التفصيلي"
                      userInfo={{
                        name: user?.full_name || user?.username,
                        generatedAt: new Date().toLocaleDateString('ar')
                      }}
                    />}
                    fileName={`inventory-report-${new Date().toISOString().split('T')[0]}.pdf`}
                    className="w-full"
                  >
                    {({ blob, url, loading, error }) => (
                      <Button 
                        className="w-full" 
                        disabled={loading}
                        onClick={() => handleReportGeneration('inventory')}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        {loading ? 'جاري إنشاء التقرير...' : 'تصدير تقرير المخزون (PDF)'}
                      </Button>
                    )}
                  </PDFDownloadLink>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إغلاق
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReportsSettingsDialog;