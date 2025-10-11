import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Settings, 
  Clock, 
  Database, 
  Activity, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Calendar,
  Users,
  FileText,
  Trash2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useSmartSync } from '@/hooks/useSmartSync';

/**
 * نافذة إدارة التوصيل الشاملة - للمديرين فقط
 */
export const DeliveryManagementDialog = ({ open, onOpenChange }) => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState(null);
  const [syncLogs, setSyncLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('settings');
  
  const { syncing, smartSync, comprehensiveSync, syncOrdersOnly } = useSmartSync();

  // تحميل الإعدادات والإحصائيات
  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    setLoading(true);
    try {
      // تحميل إعدادات المزامنة
      const { data: settingsData } = await supabase
        .from('invoice_sync_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      setSettings(settingsData || getDefaultSettings());

      // تحميل الإحصائيات
      await loadStats();
      await loadSyncLogs();

    } catch (error) {
      toast({
        title: "خطأ في التحميل",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      // إحصائيات الفواتير
      const { data: invoicesCount } = await supabase
        .from('delivery_invoices')
        .select('id', { count: 'exact' });

      // إحصائيات الطلبات المحدثة مؤخراً
      const { data: recentOrders } = await supabase
        .from('orders')
        .select('id', { count: 'exact' })
        .eq('delivery_partner', 'alwaseet')
        .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      // آخر مزامنة
      const { data: lastSync } = await supabase
        .from('auto_sync_log')
        .select('completed_at, success, invoices_synced, orders_updated')
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setStats({
        totalInvoices: invoicesCount?.length || 0,
        recentOrdersUpdated: recentOrders?.length || 0,
        lastSync: lastSync?.completed_at ? new Date(lastSync.completed_at) : null,
        lastSyncSuccess: lastSync?.success || false,
        lastSyncInvoices: lastSync?.invoices_synced || 0,
        lastSyncOrders: lastSync?.orders_updated || 0
      });

    } catch (error) {
      // Error silently handled
    }
  };

  const loadSyncLogs = async () => {
    try {
      const { data } = await supabase
        .from('auto_sync_log')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(10);

      setSyncLogs(data || []);
    } catch (error) {
      // Error silently handled
    }
  };

  const getDefaultSettings = () => ({
    invoice_auto_sync: true,
    invoice_daily_sync: true,
    orders_auto_sync: true,
    orders_twice_daily: true,
    sync_work_hours_only: true,
    work_start_hour: 8,
    work_end_hour: 20,
    orders_sync_every_hours: 3,
    auto_cleanup_enabled: true,
    keep_invoices_per_employee: 10,
    morning_sync_time: '09:00:00',
    evening_sync_time: '18:00:00'
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('invoice_sync_settings')
        .upsert(settings);

      if (error) throw error;

      toast({
        title: "✅ تم حفظ الإعدادات",
        description: "سيتم تطبيق الإعدادات الجديدة فوراً",
        variant: "default"
      });

    } catch (error) {
      toast({
        title: "خطأ في الحفظ",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleManualSync = async (type) => {
    try {
      let result;
      switch (type) {
        case 'smart':
          result = await smartSync();
          break;
        case 'comprehensive':
          result = await comprehensiveSync();
          break;
        case 'orders':
          result = await syncOrdersOnly();
          break;
        default:
          return;
      }

      if (result.success) {
        await loadStats();
        await loadSyncLogs();
      }

    } catch (error) {
      // Error silently handled
    }
  };

  const cleanupOldData = async () => {
    try {
      setLoading(true);
      
      // تنظيف الفواتير القديمة
      await supabase.rpc('cleanup_old_delivery_invoices');
      
      // تنظيف الإشعارات القديمة
      await supabase.rpc('daily_notifications_cleanup');

      toast({
        title: "✅ تم تنظيف البيانات",
        description: "تم حذف البيانات القديمة بنجاح",
        variant: "default"
      });

      await loadStats();

    } catch (error) {
      toast({
        title: "خطأ في التنظيف",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="mr-2 text-muted-foreground">جاري التحميل...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Settings className="h-6 w-6 text-primary" />
            إدارة نظام التوصيل والمزامنة
          </DialogTitle>
        </DialogHeader>

        {/* علامات التبويب */}
        <div className="flex gap-2 border-b">
          {[
            { id: 'settings', label: 'الإعدادات', icon: Settings },
            { id: 'sync', label: 'المزامنة', icon: RefreshCw },
            { id: 'stats', label: 'الإحصائيات', icon: Activity },
            { id: 'logs', label: 'السجلات', icon: FileText }
          ].map(tab => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2"
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </Button>
          ))}
        </div>

        <div className="space-y-6">
          {/* تبويب الإعدادات */}
          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* إعدادات المزامنة الأساسية */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    إعدادات المزامنة الأساسية
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>مزامنة الفواتير التلقائية</Label>
                    <Switch
                      checked={settings?.invoice_auto_sync || false}
                      onCheckedChange={(checked) => 
                        setSettings(prev => ({ ...prev, invoice_auto_sync: checked }))
                      }
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label>مزامنة الطلبات التلقائية</Label>
                    <Switch
                      checked={settings?.orders_auto_sync || false}
                      onCheckedChange={(checked) => 
                        setSettings(prev => ({ ...prev, orders_auto_sync: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>المزامنة في ساعات العمل فقط</Label>
                    <Switch
                      checked={settings?.sync_work_hours_only || false}
                      onCheckedChange={(checked) => 
                        setSettings(prev => ({ ...prev, sync_work_hours_only: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>التنظيف التلقائي</Label>
                    <Switch
                      checked={settings?.auto_cleanup_enabled || false}
                      onCheckedChange={(checked) => 
                        setSettings(prev => ({ ...prev, auto_cleanup_enabled: checked }))
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              {/* إعدادات التوقيت */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    إعدادات التوقيت
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>بداية ساعات العمل</Label>
                      <Input
                        type="number"
                        min="0"
                        max="23"
                        value={settings?.work_start_hour || 8}
                        onChange={(e) => 
                          setSettings(prev => ({ ...prev, work_start_hour: parseInt(e.target.value) }))
                        }
                      />
                    </div>
                    <div>
                      <Label>نهاية ساعات العمل</Label>
                      <Input
                        type="number"
                        min="0"
                        max="23"
                        value={settings?.work_end_hour || 20}
                        onChange={(e) => 
                          setSettings(prev => ({ ...prev, work_end_hour: parseInt(e.target.value) }))
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <Label>مزامنة الطلبات كل (ساعات)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="24"
                      value={settings?.orders_sync_every_hours || 3}
                      onChange={(e) => 
                        setSettings(prev => ({ ...prev, orders_sync_every_hours: parseInt(e.target.value) }))
                      }
                    />
                  </div>

                  <div>
                    <Label>عدد الفواتير المحفوظة لكل موظف</Label>
                    <Input
                      type="number"
                      min="5"
                      max="50"
                      value={settings?.keep_invoices_per_employee || 10}
                      onChange={(e) => 
                        setSettings(prev => ({ ...prev, keep_invoices_per_employee: parseInt(e.target.value) }))
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* تبويب المزامنة */}
          {activeTab === 'sync' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-center">مزامنة ذكية</CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                  <p className="text-sm text-muted-foreground">
                    جلب الفواتير الجديدة فقط
                  </p>
                  <Button
                    onClick={() => handleManualSync('smart')}
                    disabled={syncing}
                    className="w-full"
                  >
                    {syncing ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                    مزامنة ذكية
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-center">مزامنة شاملة</CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                  <p className="text-sm text-muted-foreground">
                    جلب جميع البيانات وتحديثها
                  </p>
                  <Button
                    onClick={() => handleManualSync('comprehensive')}
                    disabled={syncing}
                    variant="secondary"
                    className="w-full"
                  >
                    {syncing ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                    مزامنة شاملة
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-center">مزامنة الطلبات</CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                  <p className="text-sm text-muted-foreground">
                    تحديث حالات الطلبات فقط
                  </p>
                  <Button
                    onClick={() => handleManualSync('orders')}
                    disabled={syncing}
                    variant="outline"
                    className="w-full"
                  >
                    {syncing ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                    تحديث الطلبات
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {/* تبويب الإحصائيات */}
          {activeTab === 'stats' && stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <Database className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <h3 className="text-2xl font-bold">{stats.totalInvoices}</h3>
                  <p className="text-sm text-muted-foreground">إجمالي الفواتير</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <RefreshCw className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <h3 className="text-2xl font-bold">{stats.recentOrdersUpdated}</h3>
                  <p className="text-sm text-muted-foreground">طلبات محدثة (24س)</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  {stats.lastSyncSuccess ? (
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  ) : (
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
                  )}
                  <h3 className="text-lg font-bold">
                    {stats.lastSync ? stats.lastSync.toLocaleTimeString('ar-SA') : 'غير متوفر'}
                  </h3>
                  <p className="text-sm text-muted-foreground">آخر مزامنة</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                  <h3 className="text-2xl font-bold">
                    {stats.lastSyncInvoices + stats.lastSyncOrders}
                  </h3>
                  <p className="text-sm text-muted-foreground">عناصر آخر مزامنة</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* تبويب السجلات */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">سجلات المزامنة الأخيرة</h3>
                <Button
                  onClick={cleanupOldData}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  تنظيف البيانات
                </Button>
              </div>
              
              <div className="space-y-2">
                {syncLogs.map((log) => (
                  <Card key={log.id}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {log.success ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-500" />
                        )}
                        <div>
                          <p className="font-medium">{log.sync_type}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(log.started_at).toLocaleString('ar-SA')}
                          </p>
                        </div>
                      </div>
                      <div className="text-left">
                        <Badge variant={log.success ? "default" : "destructive"}>
                          {log.success ? 'نجح' : 'فشل'}
                        </Badge>
                        {log.success && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {log.invoices_synced} فاتورة | {log.orders_updated} طلب
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* أزرار التحكم */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={onOpenChange}>
            إغلاق
          </Button>
          
          {activeTab === 'settings' && (
            <Button 
              onClick={handleSave} 
              disabled={saving}
              className="flex items-center gap-2"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              حفظ الإعدادات
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};