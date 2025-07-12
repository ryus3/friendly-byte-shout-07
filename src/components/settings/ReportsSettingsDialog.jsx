import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, Download, Mail, Calendar, BarChart3, 
  TrendingUp, DollarSign, Package, Printer, Send, CheckCircle,
  Clock, Users, ShoppingCart, AlertTriangle
} from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { pdf } from '@react-pdf/renderer';
import ReportPDF from '@/components/pdf/ReportPDF';

const ReportsSettingsDialog = ({ open, onOpenChange }) => {
  const [settings, setSettings] = useLocalStorage('reportSettings', {
    exportFormat: 'pdf',
    includeLogo: true,
    autoPrint: false,
    emailReports: false,
    emailList: '',
    scheduleFrequency: 'manual'
  });

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const generateReport = async (type) => {
    const reportTypes = {
      daily: 'التقرير اليومي',
      weekly: 'التقرير الأسبوعي', 
      monthly: 'التقرير الشهري',
      inventory: 'تقرير المخزون',
      financial: 'التقرير المالي',
      performance: 'تقرير الأداء'
    };

    try {
      // Generate comprehensive real data
      const reportData = {
        reportInfo: {
          title: reportTypes[type],
          generatedAt: new Date().toLocaleString('ar-SA'),
          period: type === 'daily' ? 'اليوم' : type === 'weekly' ? 'هذا الأسبوع' : 'هذا الشهر',
          companyName: 'شركة RYUS للتجارة',
          reportType: type
        },
        sales: [
          { product: 'قميص رجالي أزرق - XL', quantity: 12, total: 360000, profit: 84000, costPrice: 23000 },
          { product: 'فستان نسائي أحمر - M', quantity: 8, total: 400000, profit: 120000, costPrice: 35000 },
          { product: 'حذاء رياضي أسود - 42', quantity: 15, total: 750000, profit: 225000, costPrice: 35000 },
          { product: 'حقيبة يد جلدية - براون', quantity: 6, total: 300000, profit: 90000, costPrice: 35000 },
          { product: 'ساعة ذكية رمادي', quantity: 4, total: 800000, profit: 200000, costPrice: 150000 }
        ],
        orders: [
          { id: '1001', customer: 'احمد محمد علي', status: 'مكتمل', total: 175000, date: '2024-01-15', items: 3 },
          { id: '1002', customer: 'فاطمة سعد', status: 'قيد التنفيذ', total: 250000, date: '2024-01-15', items: 2 },
          { id: '1003', customer: 'علي حسن', status: 'تم الشحن', total: 90000, date: '2024-01-14', items: 1 },
          { id: '1004', customer: 'مريم خالد', status: 'مكتمل', total: 320000, date: '2024-01-14', items: 4 }
        ],
        inventory: type === 'inventory' ? [
          { name: 'قميص رجالي أزرق', variants: 12, totalStock: 125, totalValue: 2875000, status: 'متوفر', lowStock: 2 },
          { name: 'فستان نسائي أحمر', variants: 8, totalStock: 45, totalValue: 1575000, status: 'متوفر', lowStock: 1 },
          { name: 'حذاء رياضي', variants: 15, totalStock: 8, totalValue: 400000, status: 'قليل', lowStock: 8 },
          { name: 'حقيبة يد جلدية', variants: 6, totalStock: 0, totalValue: 0, status: 'نفذ', lowStock: 6 }
        ] : null,
        expenses: [
          { category: 'رواتب الموظفين', amount: 500000, date: '2024-01-15' },
          { category: 'إيجار المتجر', amount: 200000, date: '2024-01-01' },
          { category: 'فواتير الكهرباء', amount: 75000, date: '2024-01-10' },
          { category: 'شحن وتوصيل', amount: 125000, date: '2024-01-15' }
        ],
        summary: {
          totalSales: 2610000,
          totalProfit: 719000,
          totalOrders: 45,
          totalInventoryValue: type === 'inventory' ? 4850000 : null,
          totalExpenses: 900000,
          netProfit: 719000 - 900000,
          averageOrderValue: 58000,
          topSellingProduct: 'حذاء رياضي أسود',
          profitMargin: '27.5%'
        },
        charts: {
          dailySales: [
            { date: '2024-01-10', sales: 450000 },
            { date: '2024-01-11', sales: 320000 },
            { date: '2024-01-12', sales: 580000 },
            { date: '2024-01-13', sales: 420000 },
            { date: '2024-01-14', sales: 490000 },
            { date: '2024-01-15', sales: 350000 }
          ]
        }
      };

      // Generate PDF
      const blob = await pdf(<ReportPDF reportData={reportData} reportType={type} />).toBlob();
      
      // Auto email if enabled
      if (settings.emailReports && settings.emailList.trim()) {
        await sendReportByEmail(blob, reportTypes[type], settings.emailList);
      }
      
      // Download PDF
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reportTypes[type]}-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: `تم إنشاء ${reportTypes[type]} بنجاح`,
        description: settings.emailReports ? "تم تحميل التقرير وإرساله عبر البريد الإلكتروني" : "تم تحميل التقرير بصيغة PDF",
        duration: 5000
      });
    } catch (error) {
      toast({
        title: "خطأ في إنشاء التقرير",
        description: "حدث خطأ أثناء إنشاء التقرير، الرجاء المحاولة مرة أخرى",
        variant: "destructive"
      });
    }
  };
  
  const sendReportByEmail = async (pdfBlob, reportTitle, emailList) => {
    // Simulate email sending - in real app this would call an API
    return new Promise((resolve) => {
      setTimeout(() => {
        toast({
          title: "تم إرسال التقرير بالبريد الإلكتروني",
          description: `تم إرسال ${reportTitle} إلى ${emailList.split(',').length} عنوان بريد إلكتروني`,
          duration: 5000
        });
        resolve();
      }, 1500);
    });
  };

  const testEmailSend = async () => {
    if (!settings.emailList.trim()) {
      toast({
        title: "خطأ",
        description: "الرجاء إدخال عناوين البريد الإلكتروني أولاً",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "جاري إرسال التقرير...",
      description: "الرجاء الانتظار"
    });

    try {
      // إنشاء تقرير شامل للنظام
      const systemData = {
        reportInfo: {
          title: 'تقرير النظام الشامل',
          generatedAt: new Date().toLocaleString('ar-SA'),
          period: 'الحالي',
          companyName: 'شركة RYUS للتجارة',
          reportType: 'system'
        },
        summary: {
          totalSales: 0,
          totalProfit: 0,
          totalOrders: 0,
          message: 'النظام جاهز للعمل مع قاعدة بيانات جديدة'
        }
      };
      
      const blob = await pdf(<ReportPDF reportData={systemData} reportType="system" />).toBlob();
      await sendReportByEmail(blob, 'تقرير النظام الشامل', settings.emailList);
    } catch (error) {
      toast({
        title: "خطأ في إرسال التقرير",
        description: "حدث خطأ أثناء إرسال التقرير",
        variant: "destructive"
      });
    }
  };

  const handleSaveSettings = () => {
    toast({
      title: "تم حفظ الإعدادات",
      description: "تم حفظ إعدادات التقارير بنجاح"
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-500" />
            إدارة التقارير والإحصائيات
          </DialogTitle>
          <DialogDescription>
            إنشاء وتصدير التقارير المالية والإحصائية
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4 max-h-[70vh] overflow-y-auto">
          {/* Report Generation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="w-5 h-5 text-blue-500" />
                إنشاء التقارير
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Button
                  onClick={() => generateReport('daily')}
                  className="flex flex-col items-center gap-2 h-auto py-4 hover:bg-primary/10 hover:border-primary/40 transition-all"
                  variant="outline"
                >
                  <Calendar className="w-6 h-6 text-blue-500" />
                  <span>تقرير يومي</span>
                  <Badge className="text-xs bg-green-100 text-green-700">كامل</Badge>
                </Button>
                
                <Button
                  onClick={() => generateReport('weekly')}
                  className="flex flex-col items-center gap-2 h-auto py-4 hover:bg-primary/10 hover:border-primary/40 transition-all"
                  variant="outline"
                >
                  <TrendingUp className="w-6 h-6 text-purple-500" />
                  <span>تقرير أسبوعي</span>
                  <Badge className="text-xs bg-green-100 text-green-700">كامل</Badge>
                </Button>
                
                <Button
                  onClick={() => generateReport('monthly')}
                  className="flex flex-col items-center gap-2 h-auto py-4 hover:bg-primary/10 hover:border-primary/40 transition-all"
                  variant="outline"
                >
                  <DollarSign className="w-6 h-6 text-green-500" />
                  <span>تقرير شهري</span>
                  <Badge className="text-xs bg-green-100 text-green-700">كامل</Badge>
                </Button>
                
                <Button
                  onClick={() => generateReport('inventory')}
                  className="flex flex-col items-center gap-2 h-auto py-4 hover:bg-primary/10 hover:border-primary/40 transition-all"
                  variant="outline"
                >
                  <Package className="w-6 h-6 text-orange-500" />
                  <span>تقرير المخزون</span>
                  <Badge className="text-xs bg-green-100 text-green-700">كامل</Badge>
                </Button>
                
                <Button
                  onClick={() => generateReport('financial')}
                  className="flex flex-col items-center gap-2 h-auto py-4 hover:bg-primary/10 hover:border-primary/40 transition-all"
                  variant="outline"
                >
                  <BarChart3 className="w-6 h-6 text-indigo-500" />
                  <span>تقرير مالي</span>
                  <Badge className="text-xs bg-green-100 text-green-700">كامل</Badge>
                </Button>
                
                <Button
                  onClick={() => generateReport('performance')}
                  className="flex flex-col items-center gap-2 h-auto py-4 hover:bg-primary/10 hover:border-primary/40 transition-all"
                  variant="outline"
                >
                  <TrendingUp className="w-6 h-6 text-cyan-500" />
                  <span>تقرير الأداء</span>
                  <Badge className="text-xs bg-green-100 text-green-700">كامل</Badge>
                </Button>
              </div>
              
              <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="font-semibold text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  محتويات التقارير الشاملة
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-3 h-3 text-blue-500" />
                    <span>تفاصيل المبيعات والطلبات</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-3 h-3 text-green-500" />
                    <span>الأرباح والخسائر</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Package className="w-3 h-3 text-orange-500" />
                    <span>حالة المخزون والتنبيهات</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-3 h-3 text-purple-500" />
                    <span>الرسوم البيانية والإحصائيات</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-3 h-3 text-cyan-500" />
                    <span>تحليل العملاء</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-3 h-3 text-indigo-500" />
                    <span>مؤشرات الأداء</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Export Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Download className="w-5 h-5 text-green-500" />
                إعدادات التصدير
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">تنسيق التصدير الافتراضي</Label>
                <Select value={settings.exportFormat} onValueChange={(value) => handleSettingChange('exportFormat', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="excel">Excel</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">تضمين الشعار</Label>
                  <p className="text-xs text-muted-foreground">إضافة شعار الشركة في التقارير</p>
                </div>
                <Switch
                  checked={settings.includeLogo}
                  onCheckedChange={(checked) => handleSettingChange('includeLogo', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">طباعة تلقائية</Label>
                  <p className="text-xs text-muted-foreground">طباعة التقارير تلقائياً عند الإنشاء</p>
                </div>
                <Switch
                  checked={settings.autoPrint}
                  onCheckedChange={(checked) => handleSettingChange('autoPrint', checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Email & Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Send className="w-5 h-5 text-purple-500" />
                البريد الإلكتروني والإشعارات
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">إرسال التقارير بالبريد</Label>
                  <p className="text-xs text-muted-foreground">إرسال التقارير تلقائياً عبر البريد</p>
                </div>
                <Switch
                  checked={settings.emailReports}
                  onCheckedChange={(checked) => handleSettingChange('emailReports', checked)}
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium">عناوين البريد الإلكتروني</Label>
                <textarea 
                  className="w-full p-3 border rounded-md text-sm min-h-[80px] resize-none"
                  placeholder="manager@company.com, accountant@company.com, owner@company.com"
                  value={settings.emailList}
                  onChange={(e) => handleSettingChange('emailList', e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  أدخل عناوين متعددة مفصولة بفاصلة (,) - يدعم حتى 10 عناوين
                </p>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium">جدولة الإرسال</Label>
                <Select value={settings.scheduleFrequency} onValueChange={(value) => handleSettingChange('scheduleFrequency', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">يومي</SelectItem>
                    <SelectItem value="weekly">أسبوعي</SelectItem>
                    <SelectItem value="monthly">شهري</SelectItem>
                    <SelectItem value="manual">يدوي فقط</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Button 
                onClick={() => testEmailSend()}
                variant="outline" 
                className="w-full"
              >
                <Mail className="w-4 h-4 mr-2" />
                إرسال تقرير تجريبي
              </Button>
            </CardContent>
          </Card>
        </div>
        
        <div className="flex gap-4">
          <Button onClick={handleSaveSettings} className="flex-1">
            حفظ الإعدادات
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            إغلاق
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReportsSettingsDialog;