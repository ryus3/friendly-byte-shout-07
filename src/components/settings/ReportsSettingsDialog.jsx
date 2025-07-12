import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, Download, Mail, Calendar, BarChart3, 
  TrendingUp, DollarSign, Package, Printer, Send
} from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';

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

  const generateReport = (type) => {
    const reportTypes = {
      daily: 'التقرير اليومي',
      weekly: 'التقرير الأسبوعي', 
      monthly: 'التقرير الشهري',
      inventory: 'تقرير المخزون'
    };
    
    toast({
      title: `تم إنشاء ${reportTypes[type]}`,
      description: "سيتم تنزيل التقرير خلال لحظات"
    });
  };
  
  const testEmailSend = () => {
    toast({
      title: "تم إرسال تقرير تجريبي",
      description: "تحقق من صندوق البريد الإلكتروني"
    });
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
                  className="flex flex-col items-center gap-2 h-auto py-4"
                  variant="outline"
                >
                  <Calendar className="w-6 h-6" />
                  <span>تقرير يومي</span>
                  <Badge variant="secondary" className="text-xs">متاح</Badge>
                </Button>
                
                <Button
                  onClick={() => generateReport('weekly')}
                  className="flex flex-col items-center gap-2 h-auto py-4"
                  variant="outline"
                >
                  <TrendingUp className="w-6 h-6" />
                  <span>تقرير أسبوعي</span>
                  <Badge variant="secondary" className="text-xs">متاح</Badge>
                </Button>
                
                <Button
                  onClick={() => generateReport('monthly')}
                  className="flex flex-col items-center gap-2 h-auto py-4"
                  variant="outline"
                >
                  <DollarSign className="w-6 h-6" />
                  <span>تقرير شهري</span>
                  <Badge variant="secondary" className="text-xs">متاح</Badge>
                </Button>
                
                <Button
                  onClick={() => generateReport('inventory')}
                  className="flex flex-col items-center gap-2 h-auto py-4"
                  variant="outline"
                >
                  <Package className="w-6 h-6" />
                  <span>تقرير المخزون</span>
                  <Badge variant="secondary" className="text-xs">متاح</Badge>
                </Button>
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
                  className="w-full p-2 border rounded-md text-sm"
                  placeholder="manager@company.com, accountant@company.com"
                  value={settings.emailList}
                  onChange={(e) => handleSettingChange('emailList', e.target.value)}
                  rows={2}
                />
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