
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, Users, Star, Phone, Gift } from 'lucide-react';

const ExportDialog = ({ 
  isOpen, 
  onClose, 
  customers,
  customersWithPoints,
  customersWithPhones,
  highPointsCustomers,
  onExport 
}) => {
  const [exportType, setExportType] = useState('all');
  const [includeFields, setIncludeFields] = useState({
    basic: true,
    loyalty: true,
    segments: true,
    location: true
  });

  const exportOptions = [
    {
      value: 'all',
      label: 'جميع العملاء',
      icon: Users,
      count: customers.length,
      description: 'تصدير جميع العملاء في النظام'
    },
    {
      value: 'with_points',
      label: 'العملاء مع النقاط',
      icon: Star,
      count: customersWithPoints,
      description: 'العملاء الذين لديهم نقاط ولاء'
    },
    {
      value: 'with_phones',
      label: 'العملاء مع الأرقام',
      icon: Phone,
      count: customersWithPhones,
      description: 'العملاء الذين لديهم أرقام هواتف'
    },
    {
      value: 'high_points',
      label: 'النقاط العالية',
      icon: Gift,
      count: highPointsCustomers,
      description: 'العملاء أكثر من 1000 نقطة'
    },
    {
      value: 'male_segment',
      label: 'الجمهور الرجالي',
      icon: Users,
      count: customers.filter(c => c.customer_product_segments?.some(s => s.gender_segment === 'male')).length,
      description: 'العملاء الذين يشترون منتجات رجالية'
    },
    {
      value: 'female_segment',
      label: 'الجمهور النسائي',
      icon: Users,
      count: customers.filter(c => c.customer_product_segments?.some(s => s.gender_segment === 'female')).length,
      description: 'العملاء الذين يشترون منتجات نسائية'
    }
  ];

  const fieldOptions = [
    { key: 'basic', label: 'المعلومات الأساسية', description: 'الاسم، الهاتف، البريد الإلكتروني' },
    { key: 'location', label: 'معلومات الموقع', description: 'المدينة، المحافظة، العنوان' },
    { key: 'loyalty', label: 'معلومات الولاء', description: 'النقاط، الطلبات، المستوى' },
    { key: 'segments', label: 'التقسيمات', description: 'الجمهور المستهدف، الأقسام' }
  ];

  const handleExport = () => {
    onExport(exportType, includeFields);
    onClose();
  };

  const selectedOption = exportOptions.find(opt => opt.value === exportType);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            تصدير بيانات العملاء
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* اختيار نوع التصدير */}
          <div>
            <Label className="text-base font-medium mb-4 block">اختر العملاء المراد تصديرهم:</Label>
            <RadioGroup value={exportType} onValueChange={setExportType}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {exportOptions.map((option) => {
                  const IconComponent = option.icon;
                  return (
                    <div key={option.value} className="flex items-center space-x-3 space-x-reverse">
                      <RadioGroupItem value={option.value} id={option.value} />
                      <label
                        htmlFor={option.value}
                        className="flex-1 cursor-pointer p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <IconComponent className="h-5 w-5 text-primary" />
                          <div className="flex-1">
                            <p className="font-medium">{option.label}</p>
                            <p className="text-sm text-muted-foreground">{option.description}</p>
                            <p className="text-sm font-medium text-primary">{option.count} عميل</p>
                          </div>
                        </div>
                      </label>
                    </div>
                  );
                })}
              </div>
            </RadioGroup>
          </div>

          {/* اختيار الحقول */}
          <div>
            <Label className="text-base font-medium mb-4 block">الحقول المراد تضمينها:</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fieldOptions.map((field) => (
                <div key={field.key} className="flex items-start space-x-3 space-x-reverse">
                  <Checkbox
                    id={field.key}
                    checked={includeFields[field.key]}
                    onCheckedChange={(checked) =>
                      setIncludeFields(prev => ({ ...prev, [field.key]: checked }))
                    }
                  />
                  <label htmlFor={field.key} className="cursor-pointer">
                    <p className="font-medium">{field.label}</p>
                    <p className="text-sm text-muted-foreground">{field.description}</p>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* ملخص التصدير */}
          {selectedOption && (
            <div className="bg-muted/30 rounded-lg p-4">
              <h4 className="font-medium mb-2">ملخص التصدير:</h4>
              <div className="flex items-center gap-2 text-sm">
                <selectedOption.icon className="h-4 w-4" />
                <span>{selectedOption.label}</span>
                <span className="text-muted-foreground">•</span>
                <span className="font-medium">{selectedOption.count} عميل</span>
                <span className="text-muted-foreground">•</span>
                <span>{Object.values(includeFields).filter(Boolean).length} مجموعة حقول</span>
              </div>
            </div>
          )}

          {/* أزرار التحكم */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={onClose}>
              إلغاء
            </Button>
            <Button onClick={handleExport} className="gap-2">
              <Download className="h-4 w-4" />
              تصدير ({selectedOption?.count} عميل)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExportDialog;
