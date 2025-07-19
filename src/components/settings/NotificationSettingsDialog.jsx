import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Settings, Bell, Package, AlertTriangle, Users, TrendingUp, Volume2, VolumeX } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import usePermissionBasedData from '@/hooks/usePermissionBasedData';
import { useAuth } from '@/contexts/UnifiedAuthContext';

const NotificationSettingsDialog = ({ open, onOpenChange }) => {
  // Add safety check for auth context
  let canViewAllData = false;
  let hasPermission = () => false;
  
  try {
    const permissionData = usePermissionBasedData();
    canViewAllData = permissionData.canViewAllData;
    hasPermission = permissionData.hasPermission;
  } catch (error) {
    console.warn('NotificationSettingsDialog: Permission context not available');
  }
  const [settings, setSettings] = useState({
    // الإشعارات العامة
    generalNotifications: true,
    soundEnabled: true,
    
    // إشعارات المخزون
    stockAlerts: true,
    lowStockThreshold: true,
    outOfStockAlerts: true,
    
    // إشعارات الطلبات
    newOrders: true,
    orderStatusChanges: true,
    orderCancellations: true,
    
    // إشعارات الموظفين (للمدير فقط)
    employeeActions: true,
    employeeRegistrations: true,
    
    // إشعارات النظام
    systemUpdates: true,
    systemErrors: true,
    
    // إشعارات الذكاء الاصطناعي
    aiOrders: true,
    aiRecommendations: false,
  });

  useEffect(() => {
    // تحميل الإعدادات من التخزين المحلي
    const savedSettings = localStorage.getItem('notificationSettings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, []);

  const handleSettingChange = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem('notificationSettings', JSON.stringify(newSettings));
    
    toast({
      title: "تم الحفظ",
      description: "تم حفظ إعدادات الإشعارات بنجاح",
    });
  };

  const notificationCategories = [
    {
      title: "الإعدادات العامة",
      icon: Settings,
      settings: [
        { key: 'generalNotifications', label: 'تفعيل الإشعارات', description: 'تفعيل أو إيقاف جميع الإشعارات' },
        { key: 'soundEnabled', label: 'الأصوات', description: 'تشغيل الأصوات عند وصول الإشعارات' },
      ]
    },
    {
      title: "إشعارات المخزون العامة",
      icon: Package,
      description: "إعدادات أساسية للإشعارات - للإعدادات المتقدمة استخدم إعدادات المخزون المنخفض",
      settings: [
        { key: 'stockAlerts', label: 'تفعيل إشعارات المخزون', description: 'تشغيل/إيقاف جميع إشعارات المخزون (أساسي)' },
        { key: 'outOfStockAlerts', label: 'نفاد المخزون', description: 'إشعار عند نفاد المنتج بالكامل' },
      ]
    },
    {
      title: "إشعارات الطلبات",
      icon: Bell,
      settings: [
        { key: 'newOrders', label: 'الطلبات الجديدة', description: 'إشعار عند وصول طلب جديد' },
        { key: 'orderStatusChanges', label: 'تغيير حالة الطلب', description: 'إشعار عند تغيير حالة أي طلب' },
        { key: 'orderCancellations', label: 'إلغاء الطلبات', description: 'إشعار عند إلغاء طلب' },
      ]
    },
    // إشعارات الموظفين للمدير فقط
    canViewAllData && {
      title: "إشعارات الموظفين",
      icon: Users,
      settings: [
        { key: 'employeeActions', label: 'أنشطة الموظفين', description: 'إشعارات حول أنشطة الموظفين المهمة' },
        { key: 'employeeRegistrations', label: 'تسجيل موظف جديد', description: 'إشعار عند تسجيل موظف جديد' },
      ]
    },
    // إشعارات الذكاء الاصطناعي للمخولين فقط
    hasPermission('use_ai_assistant') && {
      title: "إشعارات الذكاء الاصطناعي",
      icon: TrendingUp,
      settings: [
        { key: 'aiOrders', label: 'طلبات الذكاء الاصطناعي', description: 'إشعارات الطلبات المقترحة من الذكاء الاصطناعي' },
        { key: 'aiRecommendations', label: 'التوصيات الذكية', description: 'اقتراحات تحسين الأداء والمبيعات' },
      ]
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            إعدادات الإشعارات
          </DialogTitle>
          <DialogDescription>
            تحكم في أنواع الإشعارات التي تريد استلامها وطريقة عرضها
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {notificationCategories.filter(Boolean).map((category, index) => (
            <Card key={index} className="border border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <category.icon className="w-5 h-5 text-primary" />
                  {category.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {category.settings.map((setting, settingIndex) => (
                  <div key={settingIndex}>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor={setting.key} className="text-sm font-medium">
                          {setting.label}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {setting.description}
                        </p>
                      </div>
                      <Switch
                        id={setting.key}
                        checked={settings[setting.key]}
                        onCheckedChange={(checked) => handleSettingChange(setting.key, checked)}
                      />
                    </div>
                    {settingIndex < category.settings.length - 1 && (
                      <Separator className="mt-4" />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}

          <Card className="border border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                ملاحظات مهمة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>• <strong>هذه الإعدادات العامة للإشعارات:</strong> تحكم في أنواع الإشعارات الأساسية</p>
              <p>• <strong>للإعدادات المتقدمة للمخزون:</strong> استخدم "إشعارات المخزون المتقدمة" من الصفحة الرئيسية للإعدادات</p>
              <p>• يتم حفظ هذه الإعدادات محلياً في متصفحك</p>
              <p>• إيقاف الإشعارات العامة سيوقف جميع أنواع الإشعارات</p>
              <p>• بعض الإشعارات الحرجة قد تظهر حتى لو كانت معطلة</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إغلاق
          </Button>
          <Button 
            onClick={() => {
              toast({
                title: "تم الحفظ",
                description: "تم حفظ جميع إعدادات الإشعارات بنجاح"
              });
              onOpenChange(false);
            }}
          >
            حفظ الإعدادات
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationSettingsDialog;