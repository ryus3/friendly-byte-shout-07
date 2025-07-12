import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { toast } from '@/components/ui/use-toast';
import { Bell, Mail, MessageSquare, Volume2, Smartphone } from 'lucide-react';

const NotificationsSettingsDialog = ({ open, onOpenChange }) => {
  const [emailNotifications, setEmailNotifications] = useState({
    newOrders: true,
    lowStock: false,
    weeklyReports: true,
    systemUpdates: true
  });
  
  const [instantNotifications, setInstantNotifications] = useState({
    newOrders: true,
    lowStock: true,
    customerMessages: true,
    systemAlerts: true
  });
  
  const [smsNotifications, setSmsNotifications] = useState({
    criticalAlerts: true,
    orderUpdates: false
  });
  
  const [soundSettings, setSoundSettings] = useState({
    enabled: true,
    volume: [50]
  });

  const handleEmailToggle = (key) => {
    setEmailNotifications(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleInstantToggle = (key) => {
    setInstantNotifications(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSmsToggle = (key) => {
    setSmsNotifications(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSaveSettings = () => {
    const settings = {
      emailNotifications,
      instantNotifications,
      smsNotifications,
      soundSettings
    };
    
    localStorage.setItem('notificationSettings', JSON.stringify(settings));
    
    toast({
      title: "تم حفظ الإعدادات",
      description: "تم حفظ إعدادات الإشعارات بنجاح"
    });
  };

  const testNotification = () => {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification('إشعار تجريبي', {
          body: 'هذا إشعار تجريبي لاختبار الإعدادات',
          icon: '/favicon.ico'
        });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification('إشعار تجريبي', {
              body: 'تم تفعيل الإشعارات بنجاح!',
              icon: '/favicon.ico'
            });
          }
        });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            إعدادات الإشعارات
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* إشعارات البريد الإلكتروني */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-semibold flex items-center gap-2">
              <Mail className="w-4 h-4" />
              إشعارات البريد الإلكتروني
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">طلبات جديدة</p>
                  <p className="text-sm text-muted-foreground">إشعار عند وصول طلب جديد</p>
                </div>
                <Switch
                  checked={emailNotifications.newOrders}
                  onCheckedChange={() => handleEmailToggle('newOrders')}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">نفاد المخزون</p>
                  <p className="text-sm text-muted-foreground">تنبيه عند انخفاض المخزون</p>
                </div>
                <Switch
                  checked={emailNotifications.lowStock}
                  onCheckedChange={() => handleEmailToggle('lowStock')}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">التقارير الأسبوعية</p>
                  <p className="text-sm text-muted-foreground">ملخص أسبوعي للمبيعات</p>
                </div>
                <Switch
                  checked={emailNotifications.weeklyReports}
                  onCheckedChange={() => handleEmailToggle('weeklyReports')}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">تحديثات النظام</p>
                  <p className="text-sm text-muted-foreground">إشعارات حول تحديثات النظام</p>
                </div>
                <Switch
                  checked={emailNotifications.systemUpdates}
                  onCheckedChange={() => handleEmailToggle('systemUpdates')}
                />
              </div>
            </div>
          </div>

          {/* الإشعارات الفورية */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-semibold flex items-center gap-2">
              <Smartphone className="w-4 h-4" />
              الإشعارات الفورية
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">طلبات جديدة</p>
                  <p className="text-sm text-muted-foreground">إشعار فوري للطلبات</p>
                </div>
                <Switch
                  checked={instantNotifications.newOrders}
                  onCheckedChange={() => handleInstantToggle('newOrders')}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">نفاد المخزون</p>
                  <p className="text-sm text-muted-foreground">تنبيه فوري لانخفاض المخزون</p>
                </div>
                <Switch
                  checked={instantNotifications.lowStock}
                  onCheckedChange={() => handleInstantToggle('lowStock')}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">رسائل العملاء</p>
                  <p className="text-sm text-muted-foreground">إشعار برسائل العملاء الجديدة</p>
                </div>
                <Switch
                  checked={instantNotifications.customerMessages}
                  onCheckedChange={() => handleInstantToggle('customerMessages')}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">تنبيهات النظام</p>
                  <p className="text-sm text-muted-foreground">تنبيهات مهمة للنظام</p>
                </div>
                <Switch
                  checked={instantNotifications.systemAlerts}
                  onCheckedChange={() => handleInstantToggle('systemAlerts')}
                />
              </div>
            </div>
          </div>

          {/* رسائل SMS */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-semibold flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              رسائل SMS
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">التنبيهات الحرجة</p>
                  <p className="text-sm text-muted-foreground">رسائل SMS للحالات الطارئة</p>
                </div>
                <Switch
                  checked={smsNotifications.criticalAlerts}
                  onCheckedChange={() => handleSmsToggle('criticalAlerts')}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">تحديثات الطلبات</p>
                  <p className="text-sm text-muted-foreground">رسائل SMS لتحديثات الطلبات</p>
                </div>
                <Switch
                  checked={smsNotifications.orderUpdates}
                  onCheckedChange={() => handleSmsToggle('orderUpdates')}
                />
              </div>
            </div>
          </div>

          {/* إعدادات الصوت */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-semibold flex items-center gap-2">
              <Volume2 className="w-4 h-4" />
              إعدادات الصوت
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">تفعيل الأصوات</p>
                  <p className="text-sm text-muted-foreground">تشغيل أصوات التنبيهات</p>
                </div>
                <Switch
                  checked={soundSettings.enabled}
                  onCheckedChange={(checked) => setSoundSettings(prev => ({ ...prev, enabled: checked }))}
                />
              </div>

              {soundSettings.enabled && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>مستوى الصوت</Label>
                    <span className="text-sm text-muted-foreground">{soundSettings.volume[0]}%</span>
                  </div>
                  <Slider
                    value={soundSettings.volume}
                    onValueChange={(value) => setSoundSettings(prev => ({ ...prev, volume: value }))}
                    min={0}
                    max={100}
                    step={10}
                    className="w-full"
                  />
                </div>
              )}
            </div>
          </div>

          {/* اختبار الإشعارات */}
          <div className="space-y-4 p-4 border rounded-lg bg-card/50">
            <h3 className="font-semibold">اختبار الإشعارات</h3>
            <Button onClick={testNotification} variant="outline" className="w-full">
              إرسال إشعار تجريبي
            </Button>
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

export default NotificationsSettingsDialog;