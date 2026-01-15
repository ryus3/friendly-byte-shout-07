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
import { Progress } from '@/components/ui/progress';
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
  FileText,
  Users,
  Activity,
  Wrench,
  TrendingUp,
  Zap,
  Timer,
  AlertCircle,
  XCircle,
  Play,
  Pause,
  RotateCcw,
  Shield,
  Eye
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/hooks/use-toast';

/**
 * 🚀 لوحة تحكم مزامنة الفواتير الاحترافية
 * نظام شامل للتحكم بالمزامنة التلقائية والتشخيص والإصلاح
 */
const InvoiceSyncSettings = () => {
  const { toast } = useToast();
  
  // ============ States ============
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [fixing, setFixing] = useState(false);
  
  // Stats & Data
  const [stats, setStats] = useState(null);
  const [cronJobs, setCronJobs] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [discrepancies, setDiscrepancies] = useState([]);
  
  // Settings
  const [settings, setSettings] = useState({
    daily_sync_enabled: true,
    sync_frequency: 'twice_daily',
    morning_sync_time: '09:00',
    evening_sync_time: '21:00',
    lookback_days: 30,
    auto_cleanup_enabled: true,
    keep_invoices_per_employee: 10
  });

  // ============ Data Fetching ============
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all data in parallel
      const [statsRes, cronRes, logsRes, employeesRes, discrepanciesRes, settingsRes] = await Promise.all([
        supabase.rpc('get_invoice_sync_stats'),
        supabase.rpc('get_invoice_cron_status'),
        supabase.rpc('get_recent_sync_logs', { p_limit: 10 }),
        supabase.rpc('get_employee_invoice_stats'),
        supabase.rpc('get_invoice_discrepancies'),
        supabase.from('invoice_sync_settings').select('*').single()
      ]);

      if (statsRes.data) setStats(statsRes.data[0] || {});
      if (cronRes.data) setCronJobs(cronRes.data || []);
      if (logsRes.data) setRecentLogs(logsRes.data || []);
      if (employeesRes.data) setEmployees(employeesRes.data || []);
      if (discrepanciesRes.data) setDiscrepancies(discrepanciesRes.data || []);
      
      if (settingsRes.data) {
        setSettings(prev => ({
          ...prev,
          ...settingsRes.data,
          morning_sync_time: settingsRes.data.morning_sync_time?.slice(0, 5) || '09:00',
          evening_sync_time: settingsRes.data.evening_sync_time?.slice(0, 5) || '21:00'
        }));
      }
    } catch (error) {
      console.error('Error fetching invoice sync data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // ============ Actions ============
  
  // تحديث الجدولة
  const updateSchedule = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('update_invoice_sync_schedule', {
        p_enabled: settings.daily_sync_enabled,
        p_frequency: settings.sync_frequency,
        p_morning_time: settings.morning_sync_time + ':00',
        p_evening_time: settings.evening_sync_time + ':00'
      });

      if (error) throw error;

      toast({
        title: "✅ تم تحديث الجدولة",
        description: "تم تحديث جدولة المزامنة التلقائية بنجاح",
      });
      
      fetchAllData();
    } catch (error) {
      console.error('Error updating schedule:', error);
      toast({
        title: "❌ خطأ",
        description: "فشل في تحديث الجدولة",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  // مزامنة شاملة فورية
  const runFullSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('smart-invoice-sync', {
        body: { 
          mode: 'comprehensive',
          sync_invoices: true,
          sync_orders: true,
          force_refresh: false,
          run_reconciliation: true
        }
      });

      if (error) throw error;

      toast({
        title: "✅ اكتملت المزامنة",
        description: `فواتير: ${data?.invoices_synced || 0} | طلبات: ${data?.orders_updated || 0} | تسوية: ${data?.reconciled_count || 0}`,
      });
      
      fetchAllData();
    } catch (error) {
      console.error('Error running sync:', error);
      toast({
        title: "❌ خطأ في المزامنة",
        description: error.message || "حدث خطأ أثناء المزامنة",
        variant: "destructive"
      });
    } finally {
      setSyncing(false);
    }
  };

  // إصلاح التناقضات
  const fixDiscrepancies = async () => {
    setFixing(true);
    try {
      // إصلاح الفواتير بحالة "التاجر" لكن received=false
      const { data: fixedInvoices } = await supabase.rpc('fix_merchant_received_invoices');
      
      // تسوية الطلبات
      const { data: reconciledOrders } = await supabase.rpc('reconcile_invoice_receipts');

      toast({
        title: "✅ تم الإصلاح",
        description: `تم إصلاح ${fixedInvoices || 0} فاتورة و ${reconciledOrders?.length || 0} طلب`,
      });
      
      fetchAllData();
    } catch (error) {
      console.error('Error fixing discrepancies:', error);
      toast({
        title: "❌ خطأ",
        description: "فشل في إصلاح التناقضات",
        variant: "destructive"
      });
    } finally {
      setFixing(false);
    }
  };

  // ============ Render Helpers ============
  
  const formatDate = (date) => {
    if (!date) return 'غير متاح';
    return new Date(date).toLocaleString('ar-EG', {
      dateStyle: 'short',
      timeStyle: 'short'
    });
  };

  const totalDiscrepancies = discrepancies.reduce((sum, d) => sum + (d.count || 0), 0);

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="p-8 text-center">
          <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin text-primary" />
          <p className="text-muted-foreground">جاري تحميل بيانات المزامنة...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full overflow-hidden">
      <CardHeader className="pb-2 bg-gradient-to-r from-primary/5 to-transparent">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <span>لوحة تحكم مزامنة الفواتير</span>
          </div>
          <div className="flex items-center gap-2">
            {stats?.last_sync_success !== null && (
              <Badge variant={stats?.last_sync_success ? "default" : "destructive"} className="text-xs">
                {stats?.last_sync_success ? (
                  <><CheckCircle className="w-3 h-3 ml-1" /> آخر مزامنة ناجحة</>
                ) : (
                  <><XCircle className="w-3 h-3 ml-1" /> فشلت آخر مزامنة</>
                )}
              </Badge>
            )}
            <Button 
              size="sm" 
              variant="outline" 
              onClick={fetchAllData}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0 h-auto overflow-x-auto flex-nowrap">
            <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3">
              <Activity className="w-4 h-4 ml-2" />
              الملخص
            </TabsTrigger>
            <TabsTrigger value="scheduler" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3">
              <Timer className="w-4 h-4 ml-2" />
              الجدولة
            </TabsTrigger>
            <TabsTrigger value="employees" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3">
              <Users className="w-4 h-4 ml-2" />
              الموظفين
            </TabsTrigger>
            <TabsTrigger value="diagnostics" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 relative">
              <Wrench className="w-4 h-4 ml-2" />
              التشخيص
              {totalDiscrepancies > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -left-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                  {totalDiscrepancies}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="logs" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3">
              <Eye className="w-4 h-4 ml-2" />
              السجلات
            </TabsTrigger>
          </TabsList>

          {/* ============ تبويب الملخص ============ */}
          <TabsContent value="overview" className="p-4 space-y-4">
            {/* إحصائيات رئيسية */}
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

            {/* تحذير التناقضات */}
            {stats?.orders_awaiting_receipt > 0 && (
              <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-amber-700">يوجد {stats.orders_awaiting_receipt} طلب بحاجة لتسوية</p>
                  <p className="text-xs text-amber-600/80">طلبات مرتبطة بفواتير مستلمة لكن لم تُعلَّم كمستلمة</p>
                </div>
                <Button size="sm" variant="outline" onClick={fixDiscrepancies} disabled={fixing}>
                  {fixing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
                  إصلاح
                </Button>
              </div>
            )}

            {/* آخر مزامنة وزر التشغيل */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="space-y-1">
                <p className="text-sm font-medium">آخر مزامنة</p>
                <p className="text-xs text-muted-foreground">{formatDate(stats?.last_sync_at)}</p>
              </div>
              <Button onClick={runFullSync} disabled={syncing} className="gap-2">
                {syncing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                مزامنة شاملة الآن
              </Button>
            </div>

            {/* حالة Cron Jobs */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">حالة المهام المجدولة</Label>
              <div className="grid gap-2">
                {cronJobs.filter(j => j.job_name?.includes('smart')).map((job, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      {job.is_active ? (
                        <Play className="w-4 h-4 text-green-600" />
                      ) : (
                        <Pause className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className="text-sm">{job.job_name?.replace(/-/g, ' ')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={job.is_active ? "default" : "secondary"} className="text-xs">
                        {job.schedule}
                      </Badge>
                      <Badge variant={job.is_active ? "outline" : "secondary"} className="text-xs">
                        {job.is_active ? 'نشط' : 'معطل'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* ============ تبويب الجدولة ============ */}
          <TabsContent value="scheduler" className="p-4 space-y-4">
            {/* تفعيل/تعطيل */}
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
              <div className="space-y-1">
                <Label className="text-sm font-medium">المزامنة التلقائية</Label>
                <p className="text-xs text-muted-foreground">
                  تعمل تلقائياً حتى لو كان الموقع مغلقاً
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
                  onCheckedChange={(checked) => setSettings(s => ({ ...s, daily_sync_enabled: checked }))}
                />
              </div>
            </div>

            {settings.daily_sync_enabled && (
              <>
                {/* تكرار المزامنة */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">تكرار المزامنة</Label>
                  <Select 
                    value={settings.sync_frequency} 
                    onValueChange={(value) => setSettings(s => ({ ...s, sync_frequency: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="once_daily">مرة واحدة يومياً</SelectItem>
                      <SelectItem value="twice_daily">مرتين يومياً (صباح ومساء)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* أوقات المزامنة */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">أوقات المزامنة</Label>
                  
                  {settings.sync_frequency === 'twice_daily' ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">مزامنة الصباح</Label>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <Input
                            type="time"
                            value={settings.morning_sync_time}
                            onChange={(e) => setSettings(s => ({ ...s, morning_sync_time: e.target.value }))}
                            className="w-32"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">مزامنة المساء</Label>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <Input
                            type="time"
                            value={settings.evening_sync_time}
                            onChange={(e) => setSettings(s => ({ ...s, evening_sync_time: e.target.value }))}
                            className="w-32"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <Input
                        type="time"
                        value={settings.morning_sync_time}
                        onChange={(e) => setSettings(s => ({ ...s, morning_sync_time: e.target.value }))}
                        className="w-32"
                      />
                      <Badge variant="secondary" className="text-xs">كل يوم</Badge>
                    </div>
                  )}
                </div>

                {/* زر الحفظ */}
                <Button onClick={updateSchedule} disabled={saving} className="w-full gap-2">
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
                  حفظ إعدادات الجدولة
                </Button>

                {/* معلومات */}
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                    <div className="text-xs text-green-700">
                      <p className="font-medium mb-1">المزامنة التلقائية نشطة</p>
                      <p>تعمل في الخلفية حتى لو كان الموقع مغلقاً عبر Supabase Cron Jobs</p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* قواعد تفسير الحالات */}
            <Separator />
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Shield className="w-4 h-4" />
                قواعد تفسير حالات الفواتير
              </Label>
              <div className="grid gap-2 text-sm">
                <div className="flex items-center justify-between p-3 bg-amber-500/10 rounded-lg">
                  <span>"تم الاستلام من قبل المندوب"</span>
                  <Badge variant="secondary">معلقة</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg">
                  <span>"تم الاستلام من قبل التاجر"</span>
                  <Badge variant="default">مستلمة ✓</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg">
                  <span>"مستلم"</span>
                  <Badge variant="default">مستلمة ✓</Badge>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ============ تبويب الموظفين ============ */}
          <TabsContent value="employees" className="p-4 space-y-4">
            <Label className="text-sm font-medium">إحصائيات فواتير الموظفين</Label>
            
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {employees.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>لا يوجد موظفين مسجلين بعد</p>
                  </div>
                ) : (
                  employees.map((emp, i) => (
                    <div key={i} className="p-4 bg-muted/30 rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-primary" />
                          <span className="font-medium">{emp.employee_name || 'بدون اسم'}</span>
                          <span className="text-xs text-muted-foreground">({emp.account_username})</span>
                        </div>
                        <Badge variant={emp.token_active ? "default" : "destructive"} className="text-xs">
                          {emp.token_active ? 'Token نشط' : 'Token منتهي'}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="p-2 bg-background rounded">
                          <div className="text-lg font-bold">{emp.total_invoices}</div>
                          <div className="text-[10px] text-muted-foreground">إجمالي</div>
                        </div>
                        <div className="p-2 bg-green-500/10 rounded">
                          <div className="text-lg font-bold text-green-600">{emp.received_invoices}</div>
                          <div className="text-[10px] text-muted-foreground">مستلمة</div>
                        </div>
                        <div className="p-2 bg-amber-500/10 rounded">
                          <div className="text-lg font-bold text-amber-600">{emp.pending_invoices}</div>
                          <div className="text-[10px] text-muted-foreground">معلقة</div>
                        </div>
                        <div className="p-2 bg-blue-500/10 rounded">
                          <div className="text-lg font-bold text-blue-600">{(emp.total_amount / 1000).toFixed(0)}K</div>
                          <div className="text-[10px] text-muted-foreground">المبلغ</div>
                        </div>
                      </div>

                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>آخر مزامنة: {formatDate(emp.last_sync_at)}</span>
                        <span>انتهاء Token: {formatDate(emp.token_expires_at)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* ============ تبويب التشخيص ============ */}
          <TabsContent value="diagnostics" className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">فحص التناقضات</Label>
              <Button size="sm" variant="outline" onClick={fetchAllData}>
                <RotateCcw className="w-4 h-4 ml-1" />
                تحديث
              </Button>
            </div>

            <div className="space-y-3">
              {discrepancies.map((d, i) => (
                <div 
                  key={i} 
                  className={`p-4 rounded-lg border ${
                    d.count > 0 
                      ? 'bg-red-500/10 border-red-500/20' 
                      : 'bg-green-500/10 border-green-500/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {d.count > 0 ? (
                        <AlertCircle className="w-5 h-5 text-red-600" />
                      ) : (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      )}
                      <span className="font-medium">{d.details}</span>
                    </div>
                    <Badge variant={d.count > 0 ? "destructive" : "default"}>
                      {d.count}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>

            {totalDiscrepancies > 0 && (
              <Button 
                onClick={fixDiscrepancies} 
                disabled={fixing}
                className="w-full gap-2"
                variant="destructive"
              >
                {fixing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Wrench className="w-4 h-4" />
                )}
                إصلاح جميع التناقضات ({totalDiscrepancies})
              </Button>
            )}

            {totalDiscrepancies === 0 && (
              <div className="text-center py-6 text-green-600">
                <CheckCircle className="w-12 h-12 mx-auto mb-2" />
                <p className="font-medium">لا توجد تناقضات</p>
                <p className="text-xs text-muted-foreground">جميع الفواتير والطلبات متزامنة بشكل صحيح</p>
              </div>
            )}
          </TabsContent>

          {/* ============ تبويب السجلات ============ */}
          <TabsContent value="logs" className="p-4 space-y-4">
            <Label className="text-sm font-medium">آخر عمليات المزامنة</Label>
            
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {recentLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>لا توجد سجلات بعد</p>
                  </div>
                ) : (
                  recentLogs.map((log, i) => (
                    <div 
                      key={i} 
                      className={`p-3 rounded-lg border ${
                        log.success 
                          ? 'bg-green-500/5 border-green-500/20' 
                          : 'bg-red-500/5 border-red-500/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {log.success ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-600" />
                          )}
                          <span className="text-sm font-medium">{log.sync_type?.replace(/_/g, ' ')}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{formatDate(log.sync_time)}</span>
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>فواتير: {log.invoices_synced || 0}</span>
                        <span>طلبات: {log.orders_updated || 0}</span>
                      </div>
                      {log.error_message && (
                        <p className="text-xs text-red-600 mt-2">{log.error_message}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default InvoiceSyncSettings;
