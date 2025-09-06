import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Clock, FileText, Package, Settings, Zap, Moon, Sun } from 'lucide-react';
import { useUnifiedAutoSync } from '@/hooks/useUnifiedAutoSync';
import { toast } from '@/hooks/use-toast';

export const UnifiedSyncSettings = ({ open, onOpenChange }) => {
  const { syncSettings, loadSyncSettings, saveSyncSettings, lastAutoSync } = useUnifiedAutoSync();
  const [localSettings, setLocalSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadSyncSettings().then(settings => {
        setLocalSettings(settings);
      });
    }
  }, [open, loadSyncSettings]);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await saveSyncSettings(localSettings);
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "خطأ في الحفظ",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateSetting = (key, value) => {
    setLocalSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  if (!open || !localSettings) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-background rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Settings className="h-6 w-6" />
                إعدادات المزامنة التلقائية الموحدة
              </h2>
              <p className="text-muted-foreground mt-1">
                تحكم في المزامنة التلقائية للفواتير والطلبات
              </p>
            </div>
            {lastAutoSync && (
              <Badge variant="outline" className="text-xs">
                آخر مزامنة: {lastAutoSync.toLocaleString('ar-IQ')}
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* إعدادات الفواتير */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  مزامنة الفواتير
                </CardTitle>
                <CardDescription>
                  إعدادات المزامنة التلقائية للفواتير الجديدة
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="invoice-auto">مزامنة تلقائية للفواتير</Label>
                  <Switch
                    id="invoice-auto"
                    checked={localSettings.invoice_auto_sync}
                    onCheckedChange={(checked) => updateSetting('invoice_auto_sync', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="invoice-daily">مزامنة يومية في الخلفية</Label>
                  <Switch
                    id="invoice-daily"
                    checked={localSettings.invoice_daily_sync}
                    onCheckedChange={(checked) => updateSetting('invoice_daily_sync', checked)}
                    disabled={!localSettings.invoice_auto_sync}
                  />
                </div>

                {localSettings.invoice_daily_sync && (
                  <div className="space-y-2">
                    <Label htmlFor="invoice-time">وقت المزامنة اليومية</Label>
                    <Input
                      id="invoice-time"
                      type="time"
                      value={localSettings.invoice_sync_time}
                      onChange={(e) => updateSetting('invoice_sync_time', e.target.value)}
                      disabled={!localSettings.invoice_auto_sync}
                    />
                  </div>
                )}

                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md">
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 text-sm">
                    <Zap className="h-4 w-4" />
                    <span className="font-medium">ذكية وسريعة</span>
                  </div>
                  <p className="text-blue-600 dark:text-blue-400 text-xs mt-1">
                    • مرة واحدة عند فتح التطبيق<br/>
                    • مرة واحدة يومياً في الخلفية<br/>
                    • فقط الفواتير الجديدة
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* إعدادات الطلبات */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  مزامنة الطلبات
                </CardTitle>
                <CardDescription>
                  إعدادات المزامنة التلقائية للطلبات الظاهرة
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="orders-auto">مزامنة تلقائية للطلبات</Label>
                  <Switch
                    id="orders-auto"
                    checked={localSettings.orders_auto_sync}
                    onCheckedChange={(checked) => updateSetting('orders_auto_sync', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="orders-twice">مزامنة مرتين يومياً في الخلفية</Label>
                  <Switch
                    id="orders-twice"
                    checked={localSettings.orders_twice_daily}
                    onCheckedChange={(checked) => updateSetting('orders_twice_daily', checked)}
                    disabled={!localSettings.orders_auto_sync}
                  />
                </div>

                {localSettings.orders_twice_daily && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="morning-time" className="flex items-center gap-1">
                        <Sun className="h-3 w-3" />
                        الصباح
                      </Label>
                      <Input
                        id="morning-time"
                        type="time"
                        value={localSettings.orders_morning_time}
                        onChange={(e) => updateSetting('orders_morning_time', e.target.value)}
                        disabled={!localSettings.orders_auto_sync}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="evening-time" className="flex items-center gap-1">
                        <Moon className="h-3 w-3" />
                        المساء
                      </Label>
                      <Input
                        id="evening-time"
                        type="time"
                        value={localSettings.orders_evening_time}
                        onChange={(e) => updateSetting('orders_evening_time', e.target.value)}
                        disabled={!localSettings.orders_auto_sync}
                      />
                    </div>
                  </div>
                )}

                <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-md">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300 text-sm">
                    <Zap className="h-4 w-4" />
                    <span className="font-medium">ذكية ومحدودة</span>
                  </div>
                  <p className="text-green-600 dark:text-green-400 text-xs mt-1">
                    • مرة واحدة عند فتح التطبيق<br/>
                    • مرتين يومياً في الخلفية<br/>
                    • فقط الطلبات الظاهرة في الصفحة
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* إعدادات ساعات العمل */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  ساعات العمل
                </CardTitle>
                <CardDescription>
                  تحديد ساعات العمل للمزامنة التلقائية
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="work-hours-only">المزامنة في ساعات العمل فقط</Label>
                  <Switch
                    id="work-hours-only"
                    checked={localSettings.sync_work_hours_only}
                    onCheckedChange={(checked) => updateSetting('sync_work_hours_only', checked)}
                  />
                </div>

                {localSettings.sync_work_hours_only && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="work-start">بداية العمل</Label>
                      <Input
                        id="work-start"
                        type="number"
                        min="0"
                        max="23"
                        value={localSettings.work_start_hour}
                        onChange={(e) => updateSetting('work_start_hour', parseInt(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="work-end">نهاية العمل</Label>
                      <Input
                        id="work-end"
                        type="number"
                        min="0"
                        max="23"
                        value={localSettings.work_end_hour}
                        onChange={(e) => updateSetting('work_end_hour', parseInt(e.target.value))}
                      />
                    </div>
                  </div>
                )}

                <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-md">
                  <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300 text-sm">
                    <Clock className="h-4 w-4" />
                    <span className="font-medium">توفير الموارد</span>
                  </div>
                  <p className="text-orange-600 dark:text-orange-400 text-xs mt-1">
                    المزامنة التلقائية ستعمل فقط في ساعات العمل المحددة
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* إعدادات متقدمة */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  إعدادات متقدمة
                </CardTitle>
                <CardDescription>
                  إعدادات أداء وتنظيف البيانات
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="lookback-days">أيام المراجعة للخلف</Label>
                  <Input
                    id="lookback-days"
                    type="number"
                    min="7"
                    max="90"
                    value={localSettings.lookback_days}
                    onChange={(e) => updateSetting('lookback_days', parseInt(e.target.value))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-cleanup">تنظيف تلقائي للبيانات القديمة</Label>
                  <Switch
                    id="auto-cleanup"
                    checked={localSettings.auto_cleanup_enabled}
                    onCheckedChange={(checked) => updateSetting('auto_cleanup_enabled', checked)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="keep-invoices">عدد الفواتير المحفوظة لكل موظف</Label>
                  <Input
                    id="keep-invoices"
                    type="number"
                    min="5"
                    max="50"
                    value={localSettings.keep_invoices_per_employee}
                    onChange={(e) => updateSetting('keep_invoices_per_employee', parseInt(e.target.value))}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <Separator className="my-6" />

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};