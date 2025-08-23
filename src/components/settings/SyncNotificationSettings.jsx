import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import { Bell, BellOff, Settings, AlertTriangle, Info } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';

const SyncNotificationSettings = ({ open, onOpenChange }) => {
  const [autoSyncEnabled, setAutoSyncEnabled] = useLocalStorage('auto_sync_enabled', true);
  const [syncNotificationsEnabled, setSyncNotificationsEnabled] = useLocalStorage('sync_notifications_enabled', true);
  const [syncInterval, setSyncInterval] = useLocalStorage('sync_interval', 600000); // 10 minutes

  const [localSettings, setLocalSettings] = useState({
    autoSyncEnabled,
    syncNotificationsEnabled,
    syncInterval
  });

  const handleSave = () => {
    setAutoSyncEnabled(localSettings.autoSyncEnabled);
    setSyncNotificationsEnabled(localSettings.syncNotificationsEnabled);
    setSyncInterval(localSettings.syncInterval);
    
    toast({
      title: "تم الحفظ!",
      description: "تم حفظ إعدادات المزامنة والإشعارات بنجاح",
      variant: "success"
    });
    
    onOpenChange(false);
  };

  const updateLocalSetting = (key, value) => {
    setLocalSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const intervalOptions = [
    { value: 300000, label: '5 دقائق' },
    { value: 600000, label: '10 دقائق' },
    { value: 900000, label: '15 دقيقة' },
    { value: 1800000, label: '30 دقيقة' },
    { value: 3600000, label: 'ساعة واحدة' }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-500" />
            إعدادات المزامنة والإشعارات
          </DialogTitle>
          <DialogDescription>
            تحكم في إشعارات المزامنة مع شركة التوصيل
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* المزامنة التلقائية */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                إعدادات المزامنة التلقائية
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>تفعيل المزامنة التلقائية</Label>
                  <p className="text-sm text-muted-foreground">
                    مزامنة حالات الطلبات مع شركة التوصيل بشكل دوري
                  </p>
                </div>
                <Switch
                  checked={localSettings.autoSyncEnabled}
                  onCheckedChange={(checked) => updateLocalSetting('autoSyncEnabled', checked)}
                />
              </div>

              {localSettings.autoSyncEnabled && (
                <div className="space-y-2">
                  <Label>فترة المزامنة</Label>
                  <select
                    className="w-full p-2 border rounded-md"
                    value={localSettings.syncInterval}
                    onChange={(e) => updateLocalSetting('syncInterval', parseInt(e.target.value))}
                  >
                    {intervalOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </CardContent>
          </Card>

          {/* الإشعارات */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {localSettings.syncNotificationsEnabled ? (
                  <Bell className="w-5 h-5 text-green-500" />
                ) : (
                  <BellOff className="w-5 h-5 text-red-500" />
                )}
                إعدادات الإشعارات
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>إشعارات تحديث الحالات</Label>
                  <p className="text-sm text-muted-foreground">
                    إظهار إشعار عند تغيير حالة الطلب من شركة التوصيل
                  </p>
                </div>
                <Switch
                  checked={localSettings.syncNotificationsEnabled}
                  onCheckedChange={(checked) => updateLocalSetting('syncNotificationsEnabled', checked)}
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-700">
                    <p className="font-medium mb-1">ملاحظة مهمة:</p>
                    <p>
                      الإشعارات تظهر فقط عند تغيير الحالة الفعلي. إذا كنت تتلقى إشعارات متكررة، 
                      فهذا يعني أن حالات الطلبات تتغير فعلاً في شركة التوصيل.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* معلومات حالات الطلبات */}
          <Card className="bg-gray-50 border-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                حالات الطلبات الموحدة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">قيد التجهيز:</span>
                  <span className="font-medium">pending</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">تم الشحن:</span>
                  <span className="font-medium">shipped</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">قيد التوصيل:</span>
                  <span className="font-medium">delivery</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">تم التسليم:</span>
                  <span className="font-medium">delivered</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">مكتمل:</span>
                  <span className="font-medium">completed</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">ملغي:</span>
                  <span className="font-medium">cancelled</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">مرجع:</span>
                  <span className="font-medium">returned</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">غير معروف:</span>
                  <span className="font-medium">unknown</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={handleSave}>
            حفظ التغييرات
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SyncNotificationSettings;