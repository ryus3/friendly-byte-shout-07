import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import { FileText, Mail, Download } from 'lucide-react';

const ReportsSettingsDialog = ({ open, onOpenChange }) => {
  const [autoGeneration, setAutoGeneration] = useState(false);
  const [emailReports, setEmailReports] = useState(false);
  const [reportFormat, setReportFormat] = useState('PDF');
  const [includedData, setIncludedData] = useState({
    sales: true,
    inventory: true,
    profits: true,
    expenses: true
  });

  const handleDataToggle = (key) => {
    setIncludedData(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSaveSettings = () => {
    const settings = {
      autoGeneration,
      emailReports,
      reportFormat,
      includedData
    };
    
    localStorage.setItem('reportSettings', JSON.stringify(settings));
    
    toast({
      title: "تم حفظ الإعدادات",
      description: "تم حفظ إعدادات التقارير بنجاح"
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            إعدادات التقارير
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* التوليد التلقائي */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-semibold flex items-center gap-2">
              <Download className="w-4 h-4" />
              التوليد التلقائي
            </h3>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">تفعيل التوليد التلقائي</p>
                <p className="text-sm text-muted-foreground">إنشاء تقارير دورية تلقائياً</p>
              </div>
              <Switch
                checked={autoGeneration}
                onCheckedChange={setAutoGeneration}
              />
            </div>
          </div>

          {/* إرسال بالبريد الإلكتروني */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-semibold flex items-center gap-2">
              <Mail className="w-4 h-4" />
              إرسال بالبريد الإلكتروني
            </h3>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">إرسال التقارير بالإيميل</p>
                <p className="text-sm text-muted-foreground">إرسال التقارير تلقائياً عبر البريد</p>
              </div>
              <Switch
                checked={emailReports}
                onCheckedChange={setEmailReports}
              />
            </div>
          </div>

          {/* تنسيق التقرير */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-semibold">تنسيق التقرير</h3>
            
            <div className="space-y-2">
              <Label>نوع الملف</Label>
              <Select value={reportFormat} onValueChange={setReportFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PDF">PDF</SelectItem>
                  <SelectItem value="EXCEL">Excel</SelectItem>
                  <SelectItem value="CSV">CSV</SelectItem>
                  <SelectItem value="JSON">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* البيانات المضمنة */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-semibold">البيانات المضمنة</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">المبيعات</p>
                  <p className="text-sm text-muted-foreground">بيانات المبيعات والطلبات</p>
                </div>
                <Switch
                  checked={includedData.sales}
                  onCheckedChange={() => handleDataToggle('sales')}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">المخزون</p>
                  <p className="text-sm text-muted-foreground">حالة المخزون والجرد</p>
                </div>
                <Switch
                  checked={includedData.inventory}
                  onCheckedChange={() => handleDataToggle('inventory')}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">الأرباح</p>
                  <p className="text-sm text-muted-foreground">تقارير الأرباح والخسائر</p>
                </div>
                <Switch
                  checked={includedData.profits}
                  onCheckedChange={() => handleDataToggle('profits')}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">المصاريف</p>
                  <p className="text-sm text-muted-foreground">المصاريف والتكاليف</p>
                </div>
                <Switch
                  checked={includedData.expenses}
                  onCheckedChange={() => handleDataToggle('expenses')}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <Button onClick={handleSaveSettings} className="flex-1">
              حفظ الإعدادات
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              إلغاء
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReportsSettingsDialog;