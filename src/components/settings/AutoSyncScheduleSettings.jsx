import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import { Clock, Bell, BellOff, RefreshCw, Play, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const AutoSyncScheduleSettings = ({ open, onOpenChange }) => {
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settings, setSettings] = useState({
    enabled: true,
    sync_times: ['06:00', '12:00', '18:00', '23:00'],
    notifications_enabled: false,
    last_run_at: null,
  });

  useEffect(() => {
    if (open) {
      loadSettings();
    }
  }, [open]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('auto_sync_schedule_settings')
        .select('*')
        .single();

      if (error) throw error;

      if (data) {
        setSettings({
          enabled: data.enabled,
          sync_times: data.sync_times || ['06:00', '12:00', '18:00', '23:00'],
          notifications_enabled: data.notifications_enabled,
          last_run_at: data.last_run_at,
        });
      }
    } catch (error) {
      console.error('خطأ في تحميل الإعدادات:', error);
      toast({
        title: 'خطأ',
        description: 'فشل تحميل إعدادات المزامنة',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from('auto_sync_schedule_settings')
        .update({
          enabled: settings.enabled,
          sync_times: settings.sync_times,
          notifications_enabled: settings.notifications_enabled,
          updated_at: new Date().toISOString(),
        })
        .eq('id', (await supabase.from('auto_sync_schedule_settings').select('id').single()).data.id);

      if (error) throw error;

      toast({
        title: 'تم الحفظ',
        description: 'تم حفظ إعدادات المزامنة التلقائية بنجاح',
      });

      onOpenChange(false);
    } catch (error) {
      console.error('خطأ في الحفظ:', error);
      toast({
        title: 'خطأ',
        description: 'فشل حفظ الإعدادات',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestSync = async () => {
    try {
      setTesting(true);
      toast({
        title: 'جاري الاختبار...',
        description: 'جاري تشغيل المزامنة التلقائية للاختبار',
      });

      const { data, error } = await supabase.functions.invoke('sync-order-updates');

      if (error) throw error;

      console.log('نتائج الاختبار:', data);

      toast({
        title: 'تم الاختبار بنجاح ✅',
        description: `تم فحص ${data.checked || 0} طلب، وتحديث ${data.updated || 0} طلب، وإرسال ${data.notifications_sent || 0} إشعار`,
      });

      loadSettings(); // تحديث آخر وقت تشغيل
    } catch (error) {
      console.error('خطأ في الاختبار:', error);
      toast({
        title: 'خطأ في الاختبار',
        description: error.message || 'فشل تشغيل المزامنة',
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleTimeChange = (index, value) => {
    const newTimes = [...settings.sync_times];
    newTimes[index] = value;
    setSettings({ ...settings, sync_times: newTimes });
  };

  const addTime = () => {
    if (settings.sync_times.length < 8) {
      setSettings({ 
        ...settings, 
        sync_times: [...settings.sync_times, '00:00'] 
      });
    }
  };

  const removeTime = (index) => {
    if (settings.sync_times.length > 1) {
      const newTimes = settings.sync_times.filter((_, i) => i !== index);
      setSettings({ ...settings, sync_times: newTimes });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Clock className="w-6 h-6 text-primary" />
            إعدادات المزامنة التلقائية
          </DialogTitle>
          <DialogDescription>
            تحكم بأوقات تشغيل المزامنة التلقائية مع شركة التوصيل الوسيط
          </DialogDescription>
        </DialogHeader>

        {loading && !testing ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* تفعيل/تعطيل المزامنة */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">حالة المزامنة التلقائية</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>تفعيل المزامنة التلقائية</Label>
                    <p className="text-sm text-muted-foreground">
                      تشغيل المزامنة حسب الأوقات المحددة أدناه
                    </p>
                  </div>
                  <Switch
                    checked={settings.enabled}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, enabled: checked })
                    }
                  />
                </div>

                {settings.last_run_at && (
                  <div className="pt-2 border-t">
                    <p className="text-sm text-muted-foreground">
                      آخر تشغيل:{' '}
                      <span className="font-medium text-foreground">
                        {new Date(settings.last_run_at).toLocaleString('ar-IQ')}
                      </span>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* أوقات المزامنة */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">أوقات التشغيل اليومية</CardTitle>
                  <Badge variant="outline">
                    {settings.sync_times.length} {settings.sync_times.length === 1 ? 'وقت' : 'أوقات'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {settings.sync_times.map((time, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="time"
                        value={time}
                        onChange={(e) => handleTimeChange(index, e.target.value)}
                        className="flex-1 px-3 py-2 border rounded-md text-sm"
                        disabled={!settings.enabled}
                      />
                      {settings.sync_times.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTime(index)}
                          disabled={!settings.enabled}
                        >
                          ×
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {settings.sync_times.length < 8 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addTime}
                    disabled={!settings.enabled}
                    className="w-full"
                  >
                    + إضافة وقت جديد
                  </Button>
                )}

                <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    سيتم تشغيل المزامنة تلقائياً في الأوقات المحددة يومياً. يُنصح بتوزيع الأوقات على مدار اليوم.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* إعدادات الإشعارات */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  {settings.notifications_enabled ? (
                    <Bell className="w-4 h-4" />
                  ) : (
                    <BellOff className="w-4 h-4" />
                  )}
                  إشعارات التحديثات
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>إرسال إشعارات عند التحديث</Label>
                    <p className="text-sm text-muted-foreground">
                      إشعار الموظفين عند تغيير حالة أو سعر طلباتهم
                    </p>
                  </div>
                  <Switch
                    checked={settings.notifications_enabled}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, notifications_enabled: checked })
                    }
                    disabled={!settings.enabled}
                  />
                </div>

                {!settings.notifications_enabled && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                    <BellOff className="w-4 h-4 text-amber-600 mt-0.5" />
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      الإشعارات معطلة. سيتم تحديث الطلبات بصمت دون إرسال إشعارات للموظفين.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Separator />

            {/* أزرار الإجراءات */}
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="outline"
                onClick={handleTestSync}
                disabled={testing || !settings.enabled}
                className="flex-1"
              >
                {testing ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    جاري الاختبار...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    اختبار المزامنة الآن
                  </>
                )}
              </Button>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  إلغاء
                </Button>
                <Button onClick={handleSave} disabled={loading}>
                  حفظ التغييرات
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AutoSyncScheduleSettings;
