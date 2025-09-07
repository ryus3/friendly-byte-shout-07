import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Clock, RefreshCw, Info, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const OrdersSyncSettings = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('invoice_sync_settings')
        .select('*')
        .maybeSingle();

      if (error) throw error;

      setSettings(data || {
        orders_sync_enabled: true,
        orders_sync_every_hours: 3,
        orders_visible_only: true,
        delivery_invoices_daily_sync: true,
        delivery_invoices_sync_time: '09:00:00',
        sync_work_hours_only: true,
        work_start_hour: 8,
        work_end_hour: 20
      });
    } catch (error) {
      console.error('خطأ في تحميل الإعدادات:', error);
      toast({
        title: "خطأ في تحميل الإعدادات",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('invoice_sync_settings')
        .upsert(settings);

      if (error) throw error;

      toast({
        title: "✅ تم حفظ الإعدادات",
        description: "تم حفظ إعدادات مزامنة طلبات متابعة الطلبات بنجاح",
        variant: "default"
      });
    } catch (error) {
      console.error('خطأ في حفظ الإعدادات:', error);
      toast({
        title: "خطأ في حفظ الإعدادات",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* إعدادات مزامنة الطلبات */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-orange-600" />
            <CardTitle className="text-sm">مزامنة طلبات متابعة الطلبات</CardTitle>
          </div>
          <CardDescription className="text-xs">
            مزامنة تلقائية للطلبات الظاهرة في صفحة متابعة الطلبات
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm">تفعيل المزامنة التلقائية</Label>
              <p className="text-xs text-muted-foreground">
                مزامنة الطلبات كل بضع ساعات تلقائياً
              </p>
            </div>
            <Switch
              checked={settings?.orders_sync_enabled || false}
              onCheckedChange={(value) => updateSetting('orders_sync_enabled', value)}
            />
          </div>

          {settings?.orders_sync_enabled && (
            <>
              <Separator />
              
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-sm">تكرار المزامنة</Label>
                  <Select
                    value={settings?.orders_sync_every_hours?.toString() || "3"}
                    onValueChange={(value) => updateSetting('orders_sync_every_hours', parseInt(value))}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">كل ساعتين</SelectItem>
                      <SelectItem value="3">كل 3 ساعات</SelectItem>
                      <SelectItem value="4">كل 4 ساعات</SelectItem>
                      <SelectItem value="6">كل 6 ساعات</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm">الطلبات الظاهرة فقط</Label>
                    <p className="text-xs text-muted-foreground">
                      مزامنة الطلبات غير المؤرشفة وغير المكتملة فقط
                    </p>
                  </div>
                  <Switch
                    checked={settings?.orders_visible_only || false}
                    onCheckedChange={(value) => updateSetting('orders_visible_only', value)}
                  />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* إعدادات مزامنة فواتير التوصيل */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-green-600" />
            <CardTitle className="text-sm">مزامنة فواتير التوصيل اليومية</CardTitle>
          </div>
          <CardDescription className="text-xs">
            مزامنة فواتير شركة التوصيل مرة واحدة يومياً
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm">تفعيل المزامنة اليومية</Label>
              <p className="text-xs text-muted-foreground">
                جلب فواتير التوصيل الجديدة يومياً
              </p>
            </div>
            <Switch
              checked={settings?.delivery_invoices_daily_sync || false}
              onCheckedChange={(value) => updateSetting('delivery_invoices_daily_sync', value)}
            />
          </div>

          {settings?.delivery_invoices_daily_sync && (
            <>
              <Separator />
              
              <div className="space-y-2">
                <Label className="text-sm">وقت المزامنة اليومية</Label>
                <Input
                  type="time"
                  value={settings?.delivery_invoices_sync_time || '09:00:00'}
                  onChange={(e) => updateSetting('delivery_invoices_sync_time', e.target.value)}
                  className="h-8"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* إعدادات ساعات العمل */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-blue-600" />
            <CardTitle className="text-sm">ساعات العمل</CardTitle>
          </div>
          <CardDescription className="text-xs">
            تحديد ساعات العمل للمزامنة التلقائية
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm">المزامنة خلال ساعات العمل فقط</Label>
              <p className="text-xs text-muted-foreground">
                تقييد المزامنة لساعات العمل المحددة
              </p>
            </div>
            <Switch
              checked={settings?.sync_work_hours_only || false}
              onCheckedChange={(value) => updateSetting('sync_work_hours_only', value)}
            />
          </div>

          {settings?.sync_work_hours_only && (
            <>
              <Separator />
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm">بداية الدوام</Label>
                  <Select
                    value={settings?.work_start_hour?.toString() || "8"}
                    onValueChange={(value) => updateSetting('work_start_hour', parseInt(value))}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 6).map(hour => (
                        <SelectItem key={hour} value={hour.toString()}>
                          {hour}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">نهاية الدوام</Label>
                  <Select
                    value={settings?.work_end_hour?.toString() || "20"}
                    onValueChange={(value) => updateSetting('work_end_hour', parseInt(value))}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 12).map(hour => (
                        <SelectItem key={hour} value={hour.toString()}>
                          {hour}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* معلومات المزامنة */}
      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="space-y-2">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 text-sm">
              معلومات المزامنة التلقائية
            </h4>
            <div className="space-y-1 text-xs text-blue-800 dark:text-blue-200">
              <p>• مزامنة الطلبات: تحديث حالات الطلبات كل {settings?.orders_sync_every_hours || 3} ساعات</p>
              <p>• مزامنة الفواتير: جلب فواتير جديدة يومياً في الساعة {settings?.delivery_invoices_sync_time?.slice(0, 5) || '09:00'}</p>
              <p>• تعمل المزامنة فقط ضمن ساعات العمل ({settings?.work_start_hour || 8}:00 - {settings?.work_end_hour || 20}:00)</p>
            </div>
          </div>
        </div>
      </div>

      <Button onClick={saveSettings} disabled={saving} className="w-full" size="sm">
        {saving ? (
          <>
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            جاري الحفظ...
          </>
        ) : (
          <>
            <CheckCircle className="h-4 w-4 mr-2" />
            حفظ الإعدادات
          </>
        )}
      </Button>
    </div>
  );
};