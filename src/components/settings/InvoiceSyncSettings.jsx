import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Clock, RefreshCw, Settings, Bell, BellOff,
  CheckCircle, AlertTriangle, FileText, Users, Activity,
  Wrench, Zap, Timer, AlertCircle, XCircle, Play, Pause,
  RotateCcw, Shield, Eye, Package, Key, Plus, Minus, MonitorSmartphone
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/hooks/use-toast';
import { toZonedTime, format as formatTz } from 'date-fns-tz';

/**
 * 🚀 لوحة التحكم الموحّدة لكل المزامنات (المعيار العالمي)
 * - الفواتير | الطلبات | التوكنات | الواجهة | التشخيص
 * - مصدر حقيقة واحد: auto_sync_schedule_settings + RPCs
 */
const InvoiceSyncSettings = () => {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [fixing, setFixing] = useState(false);

  const [stats, setStats] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [discrepancies, setDiscrepancies] = useState([]);
  const [tokens, setTokens] = useState([]);

  // الإعدادات الموحّدة (مرآة لـ auto_sync_schedule_settings)
  const [u, setU] = useState({
    invoice_sync_enabled: true,
    invoice_morning_time: '09:00',
    invoice_evening_time: '23:45',
    orders_sync_enabled: true,
    orders_sync_times: ['02:15', '21:00'],
    orders_working_hours_only: true,
    orders_working_hours_start: '08:00',
    orders_working_hours_end: '20:00',
    orders_max_per_sync: 100,
    smart_sync_enabled: true,
    tokens_auto_renew_enabled: true,
    tokens_check_time: '03:00',
    frontend_orders_page_auto_sync: true,
    frontend_employee_page_auto_sync: true,
    frontend_employee_followup_sync: true,
    employee_invoice_sync_enabled: true,
    frontend_login_sync: false,
    notifications_enabled: true,
    last_run_at: null,
    active_crons: []
  });

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, logsRes, employeesRes, discrepanciesRes, unifiedRes, tokensRes] = await Promise.all([
        supabase.rpc('get_invoice_sync_stats'),
        supabase.rpc('get_recent_sync_logs', { p_limit: 10 }),
        supabase.rpc('get_employee_invoice_stats'),
        supabase.rpc('get_invoice_discrepancies'),
        supabase.rpc('get_unified_sync_settings'),
        supabase.from('delivery_partner_tokens')
          .select('id, partner_name, account_username, expires_at, is_active, auto_renew_enabled, last_used_at')
          .eq('is_active', true)
          .order('expires_at', { ascending: true })
      ]);

      if (statsRes.data) setStats(statsRes.data[0] || {});
      if (logsRes.data) setRecentLogs(logsRes.data || []);
      if (employeesRes.data) setEmployees(employeesRes.data || []);
      if (discrepanciesRes.data) setDiscrepancies(discrepanciesRes.data || []);
      if (tokensRes.data) setTokens(tokensRes.data || []);
      if (unifiedRes.data) {
        const d = unifiedRes.data;
        setU(prev => ({
          ...prev,
          ...d,
          orders_sync_times: Array.isArray(d.orders_sync_times) && d.orders_sync_times.length > 0
            ? d.orders_sync_times.map(t => String(t).slice(0, 5))
            : prev.orders_sync_times,
          invoice_morning_time: String(d.invoice_morning_time || '09:00').slice(0, 5),
          invoice_evening_time: String(d.invoice_evening_time || '23:45').slice(0, 5),
          tokens_check_time: String(d.tokens_check_time || '03:00').slice(0, 5)
        }));
      }
    } catch (error) {
      console.error('Error fetching unified sync data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  // ============ Actions ============

  const saveInvoiceSchedule = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.rpc('update_invoice_sync_schedule', {
        p_morning_time: u.invoice_morning_time,
        p_evening_time: u.invoice_evening_time
      });
      if (error) throw error;
      toast({ title: '✅ تم حفظ جدولة الفواتير', description: `صباحاً ${u.invoice_morning_time} • مساءً ${u.invoice_evening_time}` });
      fetchAllData();
    } catch (e) {
      toast({ title: '❌ فشل الحفظ', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const saveOrdersSchedule = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.rpc('update_orders_sync_schedule', {
        p_enabled: u.orders_sync_enabled,
        p_sync_times: u.orders_sync_times,
        p_working_hours_only: u.orders_working_hours_only,
        p_working_hours_start: u.orders_working_hours_start,
        p_working_hours_end: u.orders_working_hours_end,
        p_max_per_sync: u.orders_max_per_sync,
        p_smart_sync_enabled: u.smart_sync_enabled
      });
      if (error) throw error;
      toast({ title: '✅ تم حفظ جدولة الطلبات', description: `${u.orders_sync_times.length} مرات يومياً` });
      fetchAllData();
    } catch (e) {
      toast({ title: '❌ فشل الحفظ', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const saveTokensSettings = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.rpc('update_tokens_renewal_settings', {
        p_auto_renew: u.tokens_auto_renew_enabled,
        p_check_time: u.tokens_check_time
      });
      if (error) throw error;
      toast({ title: '✅ تم حفظ إعدادات التوكنات', description: u.tokens_auto_renew_enabled ? `فحص يومي عند ${u.tokens_check_time}` : 'تم تعطيل التجديد التلقائي' });
      fetchAllData();
    } catch (e) {
      toast({ title: '❌ فشل الحفظ', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const saveFrontendSettings = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.rpc('update_frontend_sync_settings', {
        p_login_sync: u.frontend_login_sync,
        p_orders_page_auto_sync: u.frontend_orders_page_auto_sync,
        p_employee_page_auto_sync: u.frontend_employee_page_auto_sync,
        p_employee_followup_sync: u.frontend_employee_followup_sync,
        p_employee_invoice_sync: u.employee_invoice_sync_enabled,
        p_notifications_enabled: u.notifications_enabled
      });
      if (error) throw error;
      toast({ title: '✅ تم حفظ إعدادات الواجهة' });
      fetchAllData();
    } catch (e) {
      toast({ title: '❌ فشل الحفظ', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const runFullSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('smart-invoice-sync', {
        body: { mode: 'comprehensive', sync_invoices: true, sync_orders: true, force_refresh: false, run_reconciliation: true }
      });
      if (error) throw error;
      toast({ title: '✅ اكتملت المزامنة', description: `فواتير: ${data?.invoices_synced || 0} | طلبات: ${data?.orders_updated || 0}` });
      fetchAllData();
    } catch (e) {
      toast({ title: '❌ خطأ في المزامنة', description: e.message, variant: 'destructive' });
    } finally { setSyncing(false); }
  };

  const runOrdersSync = async () => {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke('sync-order-updates', { body: {} });
      if (error) throw error;
      toast({ title: '✅ تمت مزامنة الطلبات' });
      fetchAllData();
    } catch (e) {
      toast({ title: '❌ فشلت مزامنة الطلبات', description: e.message, variant: 'destructive' });
    } finally { setSyncing(false); }
  };

  const refreshTokensNow = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('refresh-delivery-partner-tokens', { body: {} });
      if (error) throw error;
      toast({ title: '✅ فحص التوكنات', description: `تم تجديد ${data?.renewed || 0} توكن` });
      fetchAllData();
    } catch (e) {
      toast({ title: '❌ فشل', description: e.message, variant: 'destructive' });
    } finally { setSyncing(false); }
  };

  const fixDiscrepancies = async () => {
    setFixing(true);
    try {
      const { data: fixedInvoices } = await supabase.rpc('fix_merchant_received_invoices');
      const { data: reconciledOrders } = await supabase.rpc('reconcile_invoice_receipts');
      toast({ title: '✅ تم الإصلاح', description: `${fixedInvoices || 0} فاتورة و ${reconciledOrders?.length || 0} طلب` });
      fetchAllData();
    } catch (e) {
      toast({ title: '❌ خطأ', description: e.message, variant: 'destructive' });
    } finally { setFixing(false); }
  };

  // ============ Helpers ============

  const formatDate = (date) => {
    if (!date) return 'غير متاح';
    try {
      const baghdadTime = toZonedTime(new Date(date), 'Asia/Baghdad');
      return formatTz(baghdadTime, 'yyyy/MM/dd HH:mm', { timeZone: 'Asia/Baghdad' });
    } catch {
      return new Date(date).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' });
    }
  };

  const daysUntilExpiry = (date) => {
    if (!date) return null;
    const ms = new Date(date).getTime() - Date.now();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  };

  const updateOrderTime = (idx, val) => {
    setU(s => {
      const next = [...s.orders_sync_times];
      next[idx] = val;
      return { ...s, orders_sync_times: next };
    });
  };
  const addOrderTime = () => {
    if (u.orders_sync_times.length >= 4) return;
    setU(s => ({ ...s, orders_sync_times: [...s.orders_sync_times, '12:00'] }));
  };
  const removeOrderTime = (idx) => {
    if (u.orders_sync_times.length <= 1) return;
    setU(s => ({ ...s, orders_sync_times: s.orders_sync_times.filter((_, i) => i !== idx) }));
  };

  const totalDiscrepancies = discrepancies.reduce((sum, d) => sum + (d.count || 0), 0);

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="p-8 text-center">
          <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin text-primary" />
          <p className="text-muted-foreground">جاري تحميل لوحة التحكم الموحّدة...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full overflow-hidden">
      <CardHeader className="pb-2 bg-gradient-to-r from-primary/5 to-transparent">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            <span>لوحة تحكم المزامنة الموحّدة</span>
          </div>
          <Button size="sm" variant="outline" onClick={fetchAllData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0 h-auto overflow-x-auto flex-nowrap">
            <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3">
              <Activity className="w-4 h-4 ml-2" /> الملخص
            </TabsTrigger>
            <TabsTrigger value="invoices" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3">
              <FileText className="w-4 h-4 ml-2" /> الفواتير
            </TabsTrigger>
            <TabsTrigger value="orders" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3">
              <Package className="w-4 h-4 ml-2" /> الطلبات
            </TabsTrigger>
            <TabsTrigger value="tokens" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3">
              <Key className="w-4 h-4 ml-2" /> التوكنات
            </TabsTrigger>
            <TabsTrigger value="diagnostics" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 relative">
              <Wrench className="w-4 h-4 ml-2" /> التشخيص
              {totalDiscrepancies > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -left-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                  {totalDiscrepancies}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ============ تبويب الملخص ============ */}
          <TabsContent value="overview" className="p-4 space-y-4">
            {/* إحصائيات */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <div className="text-2xl font-bold text-blue-600">{stats?.total_invoices || 0}</div>
                <div className="text-xs text-muted-foreground">إجمالي الفواتير</div>
              </div>
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="text-2xl font-bold text-green-600">{stats?.received_invoices || 0}</div>
                <div className="text-xs text-muted-foreground">فواتير مستلمة</div>
              </div>
              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="text-2xl font-bold text-amber-600">{stats?.pending_invoices || 0}</div>
                <div className="text-xs text-muted-foreground">فواتير معلقة</div>
              </div>
              <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <div className="text-2xl font-bold text-purple-600">{stats?.total_linked_orders || 0}</div>
                <div className="text-xs text-muted-foreground">طلبات مربوطة</div>
              </div>
            </div>

            {/* مزامنة شاملة */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm font-medium">آخر مزامنة شاملة</p>
                <p className="text-xs text-muted-foreground">{formatDate(stats?.last_sync_at)}</p>
              </div>
              <Button onClick={runFullSync} disabled={syncing} className="gap-2">
                {syncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                مزامنة شاملة الآن
              </Button>
            </div>

            {/* حالة الكرونات */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">حالة المهام المجدولة (الخلفية)</Label>
              <div className="grid gap-2">
                {(u.active_crons || []).length === 0 ? (
                  <div className="p-3 bg-muted/30 rounded-lg text-center text-muted-foreground text-sm">
                    لا توجد مهام مجدولة
                  </div>
                ) : (
                  u.active_crons.map((job, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        {job.active ? <Play className="w-4 h-4 text-green-600" /> : <Pause className="w-4 h-4 text-muted-foreground" />}
                        <span className="text-sm">
                          {job.jobname === 'smart-invoice-sync-morning' && 'مزامنة الفواتير - صباحاً'}
                          {job.jobname === 'smart-invoice-sync-evening' && 'مزامنة الفواتير - مساءً'}
                          {job.jobname === 'sync-order-updates-scheduled' && 'فاحص الطلبات (Tick Scheduler)'}
                          {job.jobname === 'refresh-delivery-tokens-daily' && 'فحص التوكنات يومياً'}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs font-mono">{job.schedule}</Badge>
                    </div>
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground">التوقيت بصيغة UTC. الإعدادات في الواجهة بتوقيت بغداد (UTC+3).</p>
            </div>

            <Separator />

            {/* تحكم بالواجهة */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <MonitorSmartphone className="w-4 h-4" /> مزامنات الواجهة (Frontend)
              </Label>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-sm">مزامنة تلقائية في صفحة الطلبات</p>
                    <p className="text-xs text-muted-foreground">عند فتح صفحة "الطلبات"</p>
                  </div>
                  <Switch checked={u.frontend_orders_page_auto_sync} onCheckedChange={(v) => setU(s => ({ ...s, frontend_orders_page_auto_sync: v }))} />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-sm">مزامنة تلقائية في صفحة متابعة الموظفين</p>
                    <p className="text-xs text-muted-foreground">عند فتح صفحة المتابعة</p>
                  </div>
                  <Switch checked={u.frontend_employee_page_auto_sync} onCheckedChange={(v) => setU(s => ({ ...s, frontend_employee_page_auto_sync: v }))} />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-sm">مزامنة عند تسجيل الدخول</p>
                    <p className="text-xs text-muted-foreground">سحب الفواتير الجديدة فور دخول الموقع</p>
                  </div>
                  <Switch checked={u.frontend_login_sync} onCheckedChange={(v) => setU(s => ({ ...s, frontend_login_sync: v }))} />
                </div>
              </div>
              <Button onClick={saveFrontendSettings} disabled={saving} className="w-full gap-2" variant="secondary">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
                حفظ إعدادات الواجهة
              </Button>
            </div>

            <Separator />

            {/* آخر السجلات */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">آخر عمليات المزامنة</Label>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {recentLogs.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-4">لا توجد سجلات</p>
                  ) : recentLogs.map((log, i) => (
                    <div key={i} className={`p-2 rounded-lg border text-xs ${log.success ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {log.success ? <CheckCircle className="w-3 h-3 text-green-600" /> : <XCircle className="w-3 h-3 text-red-600" />}
                          <span className="font-medium">{log.sync_type?.replace(/_/g, ' ')}</span>
                        </div>
                        <span className="text-muted-foreground">{formatDate(log.sync_time)}</span>
                      </div>
                      <div className="flex gap-3 mt-1 text-muted-foreground">
                        <span>فواتير: {log.invoices_synced || 0}</span>
                        <span>طلبات: {log.orders_updated || 0}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          {/* ============ تبويب الفواتير ============ */}
          <TabsContent value="invoices" className="p-4 space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
              <div>
                <Label className="text-sm font-medium">جدولة مزامنة الفواتير (الخلفية)</Label>
                <p className="text-xs text-muted-foreground">مرتين يومياً عبر Supabase Cron — تعمل حتى لو الموقع مغلق</p>
              </div>
              <div className="flex items-center gap-2">
                {u.invoice_sync_enabled ? <Bell className="w-4 h-4 text-green-600" /> : <BellOff className="w-4 h-4 text-muted-foreground" />}
                <Switch checked={u.invoice_sync_enabled} onCheckedChange={(v) => setU(s => ({ ...s, invoice_sync_enabled: v }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">المزامنة الصباحية</Label>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <Input type="time" value={u.invoice_morning_time}
                    onChange={(e) => setU(s => ({ ...s, invoice_morning_time: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">المزامنة المسائية</Label>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <Input type="time" value={u.invoice_evening_time}
                    onChange={(e) => setU(s => ({ ...s, invoice_evening_time: e.target.value }))} />
                </div>
              </div>
            </div>

            <Button onClick={saveInvoiceSchedule} disabled={saving} className="w-full gap-2">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
              حفظ جدولة الفواتير
            </Button>

            <Separator />

            <Button onClick={runFullSync} disabled={syncing} variant="secondary" className="w-full gap-2">
              {syncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              مزامنة الفواتير الآن (يدوياً)
            </Button>

            <Separator />

            {/* قواعد التفسير */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Shield className="w-4 h-4" /> قواعد تفسير حالات الفواتير
              </Label>
              <div className="grid gap-2 text-sm">
                <div className="flex items-center justify-between p-3 bg-amber-500/10 rounded-lg">
                  <span>"تم الاستلام من قبل المندوب"</span>
                  <Badge variant="secondary">معلقة</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg">
                  <span>"تم الاستلام من قبل التاجر" / "مستلم"</span>
                  <Badge variant="default">مستلمة ✓</Badge>
                </div>
              </div>
            </div>

            {/* إحصائيات الموظفين */}
            <Separator />
            <div className="space-y-2">
              <Label className="text-sm font-medium">إحصائيات فواتير الموظفين</Label>
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {employees.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-4">لا يوجد موظفين</p>
                  ) : employees.map((emp, i) => {
                    const isActive = (emp.token_status || '').toLowerCase() === 'active' ||
                      (emp.token_expires_at && new Date(emp.token_expires_at) > new Date());
                    return (
                      <div key={i} className="p-3 bg-muted/30 rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-primary" />
                            <span className="text-sm font-medium">{emp.employee_name || 'بدون اسم'}</span>
                            <span className="text-xs text-muted-foreground">({emp.account_username})</span>
                          </div>
                          <Badge variant={isActive ? 'default' : 'destructive'} className="text-xs">
                            {isActive ? 'Token نشط' : 'Token منتهي'}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-center text-xs">
                          <div className="p-2 bg-background rounded"><div className="font-bold">{emp.total_invoices}</div><div className="text-muted-foreground">إجمالي</div></div>
                          <div className="p-2 bg-green-500/10 rounded"><div className="font-bold text-green-600">{emp.received_invoices}</div><div className="text-muted-foreground">مستلمة</div></div>
                          <div className="p-2 bg-amber-500/10 rounded"><div className="font-bold text-amber-600">{emp.pending_invoices}</div><div className="text-muted-foreground">معلقة</div></div>
                          <div className="p-2 bg-blue-500/10 rounded"><div className="font-bold text-blue-600">{((emp.total_amount || 0) / 1000).toFixed(0)}K</div><div className="text-muted-foreground">المبلغ</div></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          {/* ============ تبويب الطلبات ============ */}
          <TabsContent value="orders" className="p-4 space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
              <div>
                <Label className="text-sm font-medium">جدولة مزامنة الطلبات (الخلفية)</Label>
                <p className="text-xs text-muted-foreground">يفحص حالات الطلبات من شركة التوصيل في الأوقات المحددة</p>
              </div>
              <Switch checked={u.orders_sync_enabled} onCheckedChange={(v) => setU(s => ({ ...s, orders_sync_enabled: v }))} />
            </div>

            {u.orders_sync_enabled && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">أوقات المزامنة (1-4 مرات يومياً)</Label>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="outline" onClick={removeOrderTime} disabled={u.orders_sync_times.length <= 1}>
                        <Minus className="w-3 h-3" />
                      </Button>
                      <Badge variant="outline">{u.orders_sync_times.length}</Badge>
                      <Button size="sm" variant="outline" onClick={addOrderTime} disabled={u.orders_sync_times.length >= 4}>
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {u.orders_sync_times.map((t, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 bg-muted/20 rounded">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <Input type="time" value={t} onChange={(e) => updateOrderTime(i, e.target.value)} className="h-8" />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <Label className="text-sm">تقييد بساعات العمل</Label>
                    <p className="text-xs text-muted-foreground">المزامنة فقط ضمن النافذة الزمنية المحددة (بغداد)</p>
                  </div>
                  <Switch checked={u.orders_working_hours_only}
                    onCheckedChange={(v) => setU(s => ({ ...s, orders_working_hours_only: v }))} />
                </div>

                {u.orders_working_hours_only && (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-muted/20 rounded-lg">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">بداية ساعات العمل</Label>
                      <Input type="time" value={u.orders_working_hours_start}
                        onChange={(e) => setU(s => ({ ...s, orders_working_hours_start: e.target.value }))} className="h-8" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">نهاية ساعات العمل</Label>
                      <Input type="time" value={u.orders_working_hours_end}
                        onChange={(e) => setU(s => ({ ...s, orders_working_hours_end: e.target.value }))} className="h-8" />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <Label className="text-sm flex items-center gap-2"><Zap className="w-3 h-3 text-amber-500" /> المزامنة الذكية</Label>
                    <p className="text-xs text-muted-foreground">تخطّي الطلبات المغلقة (مُسلّمة/مُرجعة نهائياً) لتقليل الضغط</p>
                  </div>
                  <Switch checked={u.smart_sync_enabled}
                    onCheckedChange={(v) => setU(s => ({ ...s, smart_sync_enabled: v }))} />
                </div>

                <div className="space-y-1 p-3 bg-muted/20 rounded-lg">
                  <Label className="text-xs text-muted-foreground">الحد الأقصى للطلبات في كل مزامنة</Label>
                  <Input type="number" min="10" max="500" value={u.orders_max_per_sync}
                    onChange={(e) => setU(s => ({ ...s, orders_max_per_sync: parseInt(e.target.value) || 100 }))} className="h-8" />
                  <p className="text-xs text-muted-foreground">يمنع تجاوز سعة API شركة التوصيل (الموصى به: 100)</p>
                </div>
              </>
            )}

            <Button onClick={saveOrdersSchedule} disabled={saving} className="w-full gap-2">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
              حفظ جدولة الطلبات
            </Button>

            <Separator />

            <Button onClick={runOrdersSync} disabled={syncing} variant="secondary" className="w-full gap-2">
              {syncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              مزامنة الطلبات الآن (يدوياً)
            </Button>

            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-700">
              <p className="font-medium mb-1">💡 ملاحظة فنية</p>
              <p>الكرون "sync-order-updates-scheduled" ينبض كل دقيقة ليفحص فقط، ويُشغّل المزامنة الفعلية عند مطابقة الوقت. لا يوجد ضغط على API.</p>
            </div>
          </TabsContent>

          {/* ============ تبويب التوكنات ============ */}
          <TabsContent value="tokens" className="p-4 space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
              <div>
                <Label className="text-sm font-medium">التجديد التلقائي للتوكنات (Lazy)</Label>
                <p className="text-xs text-muted-foreground">فحص يومي + تجديد فقط للتوكنات المنتهية خلال 24 ساعة</p>
              </div>
              <Switch checked={u.tokens_auto_renew_enabled}
                onCheckedChange={(v) => setU(s => ({ ...s, tokens_auto_renew_enabled: v }))} />
            </div>

            {u.tokens_auto_renew_enabled && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">وقت الفحص اليومي (بغداد)</Label>
                <div className="flex items-center gap-2 max-w-xs">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <Input type="time" value={u.tokens_check_time}
                    onChange={(e) => setU(s => ({ ...s, tokens_check_time: e.target.value }))} />
                </div>
              </div>
            )}

            <Button onClick={saveTokensSettings} disabled={saving} className="w-full gap-2">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
              حفظ إعدادات التوكنات
            </Button>

            <Separator />

            <Button onClick={refreshTokensNow} disabled={syncing} variant="secondary" className="w-full gap-2">
              {syncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              فحص + تجديد الآن (يدوياً)
            </Button>

            <Separator />

            <div className="space-y-2">
              <Label className="text-sm font-medium">التوكنات النشطة ({tokens.length})</Label>
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {tokens.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-4">لا توجد توكنات نشطة</p>
                  ) : tokens.map((t) => {
                    const days = daysUntilExpiry(t.expires_at);
                    const expiringSoon = days !== null && days <= 1;
                    const expired = days !== null && days < 0;
                    return (
                      <div key={t.id} className={`p-3 rounded-lg border ${expired ? 'bg-red-500/10 border-red-500/20' : expiringSoon ? 'bg-amber-500/10 border-amber-500/20' : 'bg-muted/30'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <Key className="w-3 h-3" />
                            <span className="text-sm font-medium">{t.account_username}</span>
                            <Badge variant="outline" className="text-[10px]">{t.partner_name}</Badge>
                          </div>
                          <Badge variant={expired ? 'destructive' : expiringSoon ? 'secondary' : 'default'} className="text-[10px]">
                            {expired ? 'منتهي' : days !== null ? `${days} يوم` : 'دائم'}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <div>ينتهي: {formatDate(t.expires_at)}</div>
                          <div className="flex items-center gap-2">
                            <span>تجديد تلقائي:</span>
                            {t.auto_renew_enabled ? <Badge variant="outline" className="text-[10px] h-4">مفعّل</Badge> : <Badge variant="secondary" className="text-[10px] h-4">معطّل</Badge>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          {/* ============ تبويب التشخيص ============ */}
          <TabsContent value="diagnostics" className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">فحص التناقضات</Label>
              <Button size="sm" variant="outline" onClick={fetchAllData}>
                <RotateCcw className="w-4 h-4 ml-1" /> تحديث
              </Button>
            </div>

            <div className="space-y-2">
              {discrepancies.map((d, i) => (
                <div key={i} className={`p-4 rounded-lg border ${d.count > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-green-500/10 border-green-500/20'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {d.count > 0 ? <AlertCircle className="w-5 h-5 text-red-600" /> : <CheckCircle className="w-5 h-5 text-green-600" />}
                      <span className="text-sm font-medium">{d.details}</span>
                    </div>
                    <Badge variant={d.count > 0 ? 'destructive' : 'default'}>{d.count}</Badge>
                  </div>
                </div>
              ))}
            </div>

            {totalDiscrepancies > 0 ? (
              <Button onClick={fixDiscrepancies} disabled={fixing} className="w-full gap-2" variant="destructive">
                {fixing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
                إصلاح جميع التناقضات ({totalDiscrepancies})
              </Button>
            ) : (
              <div className="text-center py-6 text-green-600">
                <CheckCircle className="w-12 h-12 mx-auto mb-2" />
                <p className="font-medium">لا توجد تناقضات</p>
                <p className="text-xs text-muted-foreground">جميع الفواتير والطلبات متزامنة بشكل صحيح</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default InvoiceSyncSettings;
