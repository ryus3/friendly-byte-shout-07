import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { 
  Receipt, 
  Clock, 
  RefreshCw, 
  Settings, 
  Calendar,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useToast } from '@/hooks/use-toast';

const InvoiceSyncSettings = () => {
  const { toast } = useToast();
  const [syncSettings, setSyncSettings] = useLocalStorage('delivery-invoice-sync-settings', {
    enabled: true,
    frequency: 'daily',
    dailyTime: '09:00',
    autoSyncOnAppStart: true,
    autoSyncOnTabEntry: true
  });

  const [lastAutoSync] = useLocalStorage('invoices-auto-sync', null);

  const updateSetting = (key, value) => {
    setSyncSettings(prev => ({
      ...prev,
      [key]: value
    }));
    
    toast({
      title: "تم حفظ الإعدادات",
      description: "تم تحديث إعدادات مزامنة الفواتير بنجاح",
    });
  };

  const getNextSyncTime = () => {
    if (!syncSettings.enabled || syncSettings.frequency !== 'daily') return null;
    
    const now = new Date();
    const [hour, minute] = syncSettings.dailyTime.split(':');
    const nextSync = new Date();
    nextSync.setHours(parseInt(hour), parseInt(minute), 0, 0);
    
    if (nextSync <= now) {
      nextSync.setDate(nextSync.getDate() + 1);
    }
    
    return nextSync;
  };

  return (
    <div className="space-y-6">
      {/* حالة المزامنة */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="w-5 h-5" />
            إعدادات مزامنة الفواتير
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* حالة آخر مزامنة */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="space-y-1">
              <p className="text-sm font-medium">آخر مزامنة تلقائية</p>
              <p className="text-xs text-muted-foreground">
                {lastAutoSync 
                  ? new Date(lastAutoSync).toLocaleString('ar-EG')
                  : 'لم يتم بعد'
                }
              </p>
            </div>
            <div className="flex items-center gap-2">
              {lastAutoSync ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              )}
            </div>
          </div>

          <Separator />

          {/* تفعيل/إيقاف المزامنة التلقائية */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-medium">المزامنة التلقائية للفواتير</Label>
              <p className="text-xs text-muted-foreground">
                تشغيل المزامنة التلقائية لفواتير شركة التوصيل
              </p>
            </div>
            <Switch
              checked={syncSettings.enabled}
              onCheckedChange={(checked) => updateSetting('enabled', checked)}
            />
          </div>

          {syncSettings.enabled && (
            <>
              <Separator />

              {/* تكرار المزامنة */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">تكرار المزامنة</Label>
                <Select 
                  value={syncSettings.frequency} 
                  onValueChange={(value) => updateSetting('frequency', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">يومياً</SelectItem>
                    <SelectItem value="manual">يدوي فقط</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* وقت المزامنة اليومية */}
              {syncSettings.frequency === 'daily' && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">وقت المزامنة اليومية</Label>
                  <Input
                    type="time"
                    value={syncSettings.dailyTime}
                    onChange={(e) => updateSetting('dailyTime', e.target.value)}
                    className="w-32"
                  />
                  {getNextSyncTime() && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      المزامنة القادمة: {getNextSyncTime().toLocaleString('ar-EG')}
                    </p>
                  )}
                </div>
              )}

              <Separator />

              {/* إعدادات المزامنة التلقائية */}
              <div className="space-y-4">
                <Label className="text-sm font-medium">إعدادات المزامنة التلقائية</Label>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm">مزامنة عند فتح التطبيق</Label>
                    <p className="text-xs text-muted-foreground">
                      مزامنة الفواتير تلقائياً عند أول فتح للتطبيق
                    </p>
                  </div>
                  <Switch
                    checked={syncSettings.autoSyncOnAppStart}
                    onCheckedChange={(checked) => updateSetting('autoSyncOnAppStart', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm">مزامنة عند دخول تبويب الفواتير</Label>
                    <p className="text-xs text-muted-foreground">
                      مزامنة الفواتير عند الدخول لتبويب فواتير التوصيل
                    </p>
                  </div>
                  <Switch
                    checked={syncSettings.autoSyncOnTabEntry}
                    onCheckedChange={(checked) => updateSetting('autoSyncOnTabEntry', checked)}
                  />
                </div>
              </div>
            </>
          )}

          <Separator />

          <div className="text-xs text-muted-foreground bg-muted p-3 rounded flex items-start gap-2">
            <Settings className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium mb-1">ملاحظات هامة:</p>
              <ul className="space-y-1">
                <li>• المزامنة التلقائية تحسن دقة البيانات وتقلل الحاجة للتحديث اليدوي</li>
                <li>• يمكن دائماً استخدام زر "تحديث" للمزامنة اليدوية</li>
                <li>• المزامنة آمنة وتحترم صلاحيات كل موظف</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InvoiceSyncSettings;