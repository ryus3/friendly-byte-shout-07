import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Clock, 
  RefreshCw, 
  Settings, 
  Calendar,
  Bell,
  BellOff,
  CheckCircle,
  AlertTriangle,
  FileText
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/hooks/use-toast';

/**
 * إعدادات مزامنة الفواتير التلقائية
 */
const InvoiceSyncSettings = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  // جلب الإعدادات الحالية
  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('invoice_sync_settings')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = No rows found
        throw error;
      }

      setSettings(data || {
        daily_sync_enabled: true,
        daily_sync_time: '09:00:00',
        lookback_days: 30,
        auto_cleanup_enabled: true,
        keep_invoices_per_employee: 10
      });
    } catch (error) {
      console.error('خطأ في جلب إعدادات المزامنة:', error);
      toast({
        title: "خطأ في جلب الإعدادات",
        description: "تعذر جلب إعدادات مزامنة الفواتير",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // حفظ الإعدادات
  const saveSettings = async (newSettings) => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('invoice_sync_settings')
        .upsert({
          id: '00000000-0000-0000-0000-000000000001', // ID ثابت للإعدادات
          ...newSettings,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      setSettings(data);
      toast({
        title: "تم حفظ الإعدادات",
        description: "تم تحديث إعدادات مزامنة الفواتير بنجاح",
      });
    } catch (error) {
      console.error('خطأ في حفظ الإعدادات:', error);
      toast({
        title: "خطأ في الحفظ",
        description: "تعذر حفظ إعدادات المزامنة",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  // مزامنة يدوية
  const handleManualSync = async () => {
    setIsManualSyncing(true);
    try {
      console.log('🔄 تشغيل مزامنة يدوية للفواتير...');
      
      const { data, error } = await supabase.functions.invoke('sync-alwaseet-invoices', {
        body: { manual: true }
      });

      if (error) throw error;

      setLastSync(new Date().toISOString());
      
      toast({
        title: "مزامنة مكتملة",
        description: `تم مزامنة ${data.total_synced || 0} فاتورة لـ ${data.processed_employees || 0} موظف`,
      });
    } catch (error) {
      console.error('خطأ في المزامنة اليدوية:', error);
      toast({
        title: "خطأ في المزامنة",
        description: "حدث خطأ أثناء مزامنة الفواتير",
        variant: "destructive"
      });
    } finally {
      setIsManualSyncing(false);
    }
  };

  // تحديث إعداد واحد
  const updateSetting = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">جاري تحميل إعدادات المزامنة...</p>
        </CardContent>
      </Card>
    );
  }

  if (!settings) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-destructive" />
          <p className="text-destructive">تعذر تحميل إعدادات المزامنة</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <FileText className="w-4 h-4" />
          إعدادات مزامنة الفواتير
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* المزامنة التلقائية المتقدمة */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-medium">المزامنة التلقائية المتقدمة</Label>
              <p className="text-xs text-muted-foreground">
                تشغيل مزامنة تلقائية للفواتير من Al-Waseet
              </p>
            </div>
            <div className="flex items-center gap-2">
              {settings.daily_sync_enabled ? (
                <Bell className="w-4 h-4 text-green-600" />
              ) : (
                <BellOff className="w-4 h-4 text-muted-foreground" />
              )}
              <Switch
                checked={settings.daily_sync_enabled}
                onCheckedChange={(checked) => updateSetting('daily_sync_enabled', checked)}
                disabled={saving}
              />
            </div>
          </div>

          {/* تكرار المزامنة */}
          {settings.daily_sync_enabled && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">تكرار المزامنة</Label>
              <Select 
                value={settings.sync_frequency || 'once_daily'} 
                onValueChange={(value) => updateSetting('sync_frequency', value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="once_daily">مرة واحدة يومياً</SelectItem>
                  <SelectItem value="twice_daily">مرتين يومياً (صباح ومساء)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* أوقات المزامنة */}
        {settings.daily_sync_enabled && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">أوقات المزامنة</Label>
            
            {settings.sync_frequency === 'twice_daily' ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">مزامنة الصباح</Label>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <Input
                      type="time"
                      value={settings.morning_sync_time || '09:00'}
                      onChange={(e) => updateSetting('morning_sync_time', e.target.value)}
                      disabled={saving}
                      className="w-28"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">مزامنة المساء</Label>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <Input
                      type="time"
                      value={settings.evening_sync_time || '21:00'}
                      onChange={(e) => updateSetting('evening_sync_time', e.target.value)}
                      disabled={saving}
                      className="w-28"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <Input
                  type="time"
                  value={settings.daily_sync_time || '09:00'}
                  onChange={(e) => updateSetting('daily_sync_time', e.target.value)}
                  disabled={saving}
                  className="w-32"
                />
                <Badge variant="secondary" className="text-xs">
                  كل يوم
                </Badge>
              </div>
            )}
            
            <p className="text-xs text-muted-foreground">
              {settings.sync_frequency === 'twice_daily' 
                ? 'سيتم تشغيل المزامنة مرتين يومياً في الأوقات المحددة'
                : 'سيتم تشغيل المزامنة يومياً في الوقت المحدد'
              }
            </p>
          </div>
        )}

        <Separator />

        {/* إعدادات التنظيف */}
        <div className="space-y-4">
          <Label className="text-sm font-medium">إعدادات الأداء والتنظيف</Label>
          
          {/* عدد الأيام للبحث */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">عدد الأيام للبحث في API</Label>
            <Select 
              value={String(settings.lookback_days)} 
              onValueChange={(value) => updateSetting('lookback_days', parseInt(value))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">آخر أسبوع</SelectItem>
                <SelectItem value="15">آخر 15 يوم</SelectItem>
                <SelectItem value="30">آخر شهر (موصى)</SelectItem>
                <SelectItem value="60">آخر شهرين</SelectItem>
                <SelectItem value="90">آخر 3 أشهر</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* عدد الفواتير المحفوظة */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">عدد الفواتير المحفوظة لكل موظف</Label>
            <Select 
              value={String(settings.keep_invoices_per_employee)} 
              onValueChange={(value) => updateSetting('keep_invoices_per_employee', parseInt(value))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">آخر 5 فواتير</SelectItem>
                <SelectItem value="10">آخر 10 فواتير (موصى)</SelectItem>
                <SelectItem value="15">آخر 15 فاتورة</SelectItem>
                <SelectItem value="20">آخر 20 فاتورة</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* التنظيف التلقائي */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-xs font-medium">التنظيف التلقائي</Label>
              <p className="text-xs text-muted-foreground">
                حذف الفواتير القديمة تلقائياً مع كل مزامنة
              </p>
            </div>
            <Switch
              checked={settings.auto_cleanup_enabled}
              onCheckedChange={(checked) => updateSetting('auto_cleanup_enabled', checked)}
              disabled={saving}
            />
          </div>
        </div>

        <Separator />

        {/* المزامنة اليدوية */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-medium">مزامنة يدوية فورية</Label>
              <p className="text-xs text-muted-foreground">
                تشغيل مزامنة فورية لجميع الموظفين
              </p>
            </div>
            <Button
              onClick={handleManualSync}
              disabled={isManualSyncing || saving}
              variant="outline"
              size="sm"
            >
              {isManualSyncing && <RefreshCw className="w-4 h-4 ml-1 animate-spin" />}
              <Calendar className="w-4 h-4 ml-1" />
              مزامنة الآن
            </Button>
          </div>

          {lastSync && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle className="w-3 h-3 text-green-600" />
              آخر مزامنة: {new Date(lastSync).toLocaleString('ar-EG')}
            </div>
          )}
        </div>

        {/* معلومات إضافية */}
        <div className="text-xs text-muted-foreground bg-muted p-3 rounded">
          <strong>ملاحظات مهمة:</strong>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>سيتم الاحتفاظ بآخر {settings.keep_invoices_per_employee} فواتير لكل موظف فقط</li>
            <li>المزامنة التلقائية تتم {settings.sync_frequency === 'twice_daily' ? 'مرتين يومياً' : 'مرة واحدة يومياً'} بدون فتح التطبيق</li>
            <li>البيانات محفوظة محلياً لتوفير استهلاك الانترنت</li>
            <li>المدير يرى جميع الفواتير، الموظفون يرون فواتيرهم فقط</li>
            <li>يمكن للمدير مزامنة طلبات موظف محدد من صفحة متابعة الموظفين</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default InvoiceSyncSettings;