import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Truck, 
  RefreshCw, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Settings, 
  Bell,
  BellOff,
  RefreshCcw,
  Search,
  Copy,
  Download,
  Eye,
  Package,
  AlertTriangle,
  Trash2,
  TrendingUp,
  Users,
  FileText,
  Activity,
  Archive,
  Zap,
  Timer,
  Target,
  BarChart3,
  Calendar,
  MapPin,
  Shield,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { OrdersSyncProgress } from '@/components/orders/OrdersSyncProgress';

import { useLocalStorage } from '@/hooks/useLocalStorage';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const ComprehensiveDeliveryManagementDialog = ({ open, onOpenChange }) => {
  // حالات التطبيق
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({});
  const [syncLogs, setSyncLogs] = useState([]);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, syncing: false });

  // إعدادات شاملة للنظام
  const [settings, setSettings] = useLocalStorage('comprehensive-delivery-settings', {
    // إعدادات عامة
    general: {
      autoSyncEnabled: true,
      globalSyncInterval: 1800000, // 30 دقيقة
      workingHours: { start: '09:00', end: '21:00' },
      enableNotifications: true,
      enableSmartSync: true
    },
    // إعدادات صفحة الطلبات
    orders: {
      autoSync: true,
      syncInterval: 900000, // 15 دقيقة  
      syncVisibleOnly: true,
      maxOrdersPerSync: 100,
      enableRealTimeUpdates: false
    },
    // إعدادات صفحة الموظفين
    employees: {
      autoSync: true,
      syncInterval: 1800000, // 30 دقيقة
      syncOnPageLoad: true,
      batchSize: 50,
      smartEmployeeSync: true
    },
    // إعدادات الفواتير
    invoices: {
      autoSync: true,
      syncInterval: 3600000, // 60 دقيقة
      employeeInvoicesSync: true,
      cleanupOldInvoices: true,
      retentionDays: 30
    },
    // إعدادات متقدمة
    advanced: {
      enableDebugLogs: false,
      maxRetries: 3,
      timeoutMs: 30000,
      compressionEnabled: true,
      cacheEnabled: true
    }
  });

  // السياق والدوال
  const { 
    isLoggedIn, 
    activePartner, 
    autoSyncEnabled,
    setAutoSyncEnabled,
    lastSyncAt,
    isSyncing
  } = useAlWaseet();
  

  // حالات المزامنة اليدوية
  const [manualSyncStates, setManualSyncStates] = useState({
    smart: false,
    comprehensive: false,
    orders: false,
    invoices: false,
    employees: false
  });

  // تحميل البيانات عند فتح النافذة
  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadStats(),
        loadSyncLogs()
      ]);
    } catch (error) {
      console.error('خطأ في تحميل البيانات:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, status, delivery_partner, created_at, updated_at')
        .eq('delivery_partner', 'alwaseet')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      // حساب الإحصائيات
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      const todayOrders = data.filter(o => new Date(o.created_at) >= todayStart);
      const weekOrders = data.filter(o => new Date(o.created_at) >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
      const recentlyUpdated = data.filter(o => new Date(o.updated_at) >= new Date(now.getTime() - 60 * 60 * 1000));

      setStats({
        totalOrders: data.length,
        todayOrders: todayOrders.length,
        weekOrders: weekOrders.length,
        recentlyUpdated: recentlyUpdated.length,
        lastSync: lastSyncAt
      });
    } catch (error) {
      console.error('خطأ في تحميل الإحصائيات:', error);
    }
  };

  const loadSyncLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('auto_sync_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setSyncLogs(data || []);
    } catch (error) {
      console.error('خطأ في تحميل سجلات المزامنة:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // تطبيق الإعدادات على السياق
      setAutoSyncEnabled(settings.general.autoSyncEnabled);
      
      toast({
        title: "تم حفظ الإعدادات",
        description: "تم تطبيق جميع الإعدادات بنجاح",
        variant: "default"
      });
    } catch (error) {
      toast({
        title: "خطأ في حفظ الإعدادات",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleManualSync = async (type) => {
    setManualSyncStates(prev => ({ ...prev, [type]: true }));
    setSyncProgress({ current: 0, total: 0, syncing: true });
    
    try {
      // جلب الطلبات المرئية
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .eq('delivery_partner', 'alwaseet')
        .order('created_at', { ascending: false })
        .limit(100);
      
      await syncVisibleOrdersBatch(orders || [], (progress) => {
        setSyncProgress({
          current: progress?.updated || 0,
          total: orders?.length || 0,
          syncing: true
        });
      });
      
      toast({
        title: "✅ تمت المزامنة",
        description: "تم تحديث الطلبات بنجاح",
      });
      
      await loadStats();
      await loadSyncLogs();
    } catch (error) {
      toast({
        title: "خطأ في المزامنة",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setManualSyncStates(prev => ({ ...prev, [type]: false }));
      setTimeout(() => {
        setSyncProgress({ current: 0, total: 0, syncing: false });
      }, 1500);
    }
  };

  const updateSetting = (section, key, value) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  if (!isLoggedIn || activePartner !== 'alwaseet') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          {/* شريط التقدم العائم */}
          <OrdersSyncProgress 
            syncing={syncProgress.syncing}
            current={syncProgress.current}
            total={syncProgress.total}
          />
          
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5" />
              إدارة التوصيل الشاملة
            </DialogTitle>
          </DialogHeader>
          
          <Card className="bg-muted">
            <CardContent className="p-6 text-center">
              <XCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                غير متصل بشركة الوسيط
              </p>
              <Badge variant="secondary" className="mt-2">
                الرجاء تسجيل الدخول أولاً
              </Badge>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-6 h-6" />
            نظام إدارة التوصيل الشامل
            <Badge variant="default" className="ml-2">الوسيط</Badge>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="mr-2">جاري التحميل...</span>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="general" className="flex items-center gap-1">
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">عام</span>
              </TabsTrigger>
              <TabsTrigger value="orders" className="flex items-center gap-1">
                <Package className="w-4 h-4" />
                <span className="hidden sm:inline">الطلبات</span>
              </TabsTrigger>
              <TabsTrigger value="employees" className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">الموظفين</span>
              </TabsTrigger>
              <TabsTrigger value="invoices" className="flex items-center gap-1">
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">الفواتير</span>
              </TabsTrigger>
              <TabsTrigger value="sync" className="flex items-center gap-1">
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">مزامنة</span>
              </TabsTrigger>
              <TabsTrigger value="stats" className="flex items-center gap-1">
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">إحصائيات</span>
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[60vh] mt-4">
              {/* تبويب الإعدادات العامة */}
              <TabsContent value="general" className="space-y-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="w-5 h-5" />
                        إعدادات النظام العامة
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>تفعيل المزامنة التلقائية</Label>
                          <p className="text-sm text-muted-foreground">تشغيل النظام التلقائي للمزامنة</p>
                        </div>
                        <Switch
                          checked={settings.general.autoSyncEnabled}
                          onCheckedChange={(value) => updateSetting('general', 'autoSyncEnabled', value)}
                        />
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <Label>فترة المزامنة الرئيسية</Label>
                        <Select 
                          value={settings.general.globalSyncInterval.toString()}
                          onValueChange={(value) => updateSetting('general', 'globalSyncInterval', parseInt(value))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="900000">15 دقيقة</SelectItem>
                            <SelectItem value="1800000">30 دقيقة</SelectItem>
                            <SelectItem value="3600000">60 دقيقة</SelectItem>
                            <SelectItem value="7200000">120 دقيقة</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>بداية العمل</Label>
                          <Input
                            type="time"
                            value={settings.general.workingHours.start}
                            onChange={(e) => updateSetting('general', 'workingHours', {
                              ...settings.general.workingHours,
                              start: e.target.value
                            })}
                          />
                        </div>
                        <div>
                          <Label>نهاية العمل</Label>
                          <Input
                            type="time"
                            value={settings.general.workingHours.end}
                            onChange={(e) => updateSetting('general', 'workingHours', {
                              ...settings.general.workingHours,
                              end: e.target.value
                            })}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>تفعيل الإشعارات</Label>
                          <p className="text-sm text-muted-foreground">إشعارات حالة المزامنة والتحديثات</p>
                        </div>
                        <Switch
                          checked={settings.general.enableNotifications}
                          onCheckedChange={(value) => updateSetting('general', 'enableNotifications', value)}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>المزامنة الذكية</Label>
                          <p className="text-sm text-muted-foreground">استخدام الذكاء الاصطناعي لتحسين المزامنة</p>
                        </div>
                        <Switch
                          checked={settings.general.enableSmartSync}
                          onCheckedChange={(value) => updateSetting('general', 'enableSmartSync', value)}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>

              {/* تبويب إعدادات الطلبات */}
              <TabsContent value="orders" className="space-y-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Package className="w-5 h-5" />
                        إعدادات مزامنة الطلبات
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>مزامنة تلقائية للطلبات</Label>
                          <p className="text-sm text-muted-foreground">تحديث الطلبات في صفحة متابعة الطلبات</p>
                        </div>
                        <Switch
                          checked={settings.orders.autoSync}
                          onCheckedChange={(value) => updateSetting('orders', 'autoSync', value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>فترة مزامنة الطلبات</Label>
                        <Select 
                          value={settings.orders.syncInterval.toString()}
                          onValueChange={(value) => updateSetting('orders', 'syncInterval', parseInt(value))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="300000">5 دقائق</SelectItem>
                            <SelectItem value="600000">10 دقائق</SelectItem>
                            <SelectItem value="900000">15 دقيقة</SelectItem>
                            <SelectItem value="1800000">30 دقيقة</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>مزامنة الطلبات المرئية فقط</Label>
                          <p className="text-sm text-muted-foreground">تحسين الأداء بمزامنة الطلبات الظاهرة فقط</p>
                        </div>
                        <Switch
                          checked={settings.orders.syncVisibleOnly}
                          onCheckedChange={(value) => updateSetting('orders', 'syncVisibleOnly', value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>أقصى عدد طلبات لكل مزامنة</Label>
                        <Input
                          type="number"
                          value={settings.orders.maxOrdersPerSync}
                          onChange={(e) => updateSetting('orders', 'maxOrdersPerSync', parseInt(e.target.value))}
                          min="10"
                          max="500"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>

              {/* تبويب إعدادات الموظفين */}
              <TabsContent value="employees" className="space-y-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        إعدادات مزامنة الموظفين
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>مزامنة تلقائية للموظفين</Label>
                          <p className="text-sm text-muted-foreground">تحديث طلبات الموظفين في صفحة المتابعة</p>
                        </div>
                        <Switch
                          checked={settings.employees.autoSync}
                          onCheckedChange={(value) => updateSetting('employees', 'autoSync', value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>فترة مزامنة الموظفين</Label>
                        <Select 
                          value={settings.employees.syncInterval.toString()}
                          onValueChange={(value) => updateSetting('employees', 'syncInterval', parseInt(value))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="900000">15 دقيقة</SelectItem>
                            <SelectItem value="1800000">30 دقيقة</SelectItem>
                            <SelectItem value="3600000">60 دقيقة</SelectItem>
                            <SelectItem value="7200000">120 دقيقة</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>مزامنة عند فتح الصفحة</Label>
                          <p className="text-sm text-muted-foreground">تشغيل مزامنة تلقائية عند دخول صفحة الموظفين</p>
                        </div>
                        <Switch
                          checked={settings.employees.syncOnPageLoad}
                          onCheckedChange={(value) => updateSetting('employees', 'syncOnPageLoad', value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>حجم دفعة المزامنة</Label>
                        <Select 
                          value={settings.employees.batchSize.toString()}
                          onValueChange={(value) => updateSetting('employees', 'batchSize', parseInt(value))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="25">25 طلب</SelectItem>
                            <SelectItem value="50">50 طلب</SelectItem>
                            <SelectItem value="100">100 طلب</SelectItem>
                            <SelectItem value="200">200 طلب</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>المزامنة الذكية للموظفين</Label>
                          <p className="text-sm text-muted-foreground">تحسين أولوية المزامنة حسب نشاط الموظف</p>
                        </div>
                        <Switch
                          checked={settings.employees.smartEmployeeSync}
                          onCheckedChange={(value) => updateSetting('employees', 'smartEmployeeSync', value)}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>

              {/* تبويب إعدادات الفواتير */}
              <TabsContent value="invoices" className="space-y-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        إعدادات مزامنة الفواتير
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>مزامنة تلقائية للفواتير</Label>
                          <p className="text-sm text-muted-foreground">جلب الفواتير الجديدة تلقائياً</p>
                        </div>
                        <Switch
                          checked={settings.invoices.autoSync}
                          onCheckedChange={(value) => updateSetting('invoices', 'autoSync', value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>فترة مزامنة الفواتير</Label>
                        <Select 
                          value={settings.invoices.syncInterval.toString()}
                          onValueChange={(value) => updateSetting('invoices', 'syncInterval', parseInt(value))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1800000">30 دقيقة</SelectItem>
                            <SelectItem value="3600000">60 دقيقة</SelectItem>
                            <SelectItem value="7200000">120 دقيقة</SelectItem>
                            <SelectItem value="14400000">240 دقيقة</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>مزامنة فواتير الموظفين</Label>
                          <p className="text-sm text-muted-foreground">جلب فواتير كل موظف منفصلة</p>
                        </div>
                        <Switch
                          checked={settings.invoices.employeeInvoicesSync}
                          onCheckedChange={(value) => updateSetting('invoices', 'employeeInvoicesSync', value)}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>تنظيف الفواتير القديمة</Label>
                          <p className="text-sm text-muted-foreground">حذف الفواتير القديمة تلقائياً</p>
                        </div>
                        <Switch
                          checked={settings.invoices.cleanupOldInvoices}
                          onCheckedChange={(value) => updateSetting('invoices', 'cleanupOldInvoices', value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>مدة الاحتفاظ بالفواتير (أيام)</Label>
                        <Input
                          type="number"
                          value={settings.invoices.retentionDays}
                          onChange={(e) => updateSetting('invoices', 'retentionDays', parseInt(e.target.value))}
                          min="7"
                          max="365"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>

              {/* تبويب المزامنة اليدوية */}
              <TabsContent value="sync" className="space-y-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <RefreshCw className="w-5 h-5" />
                        عمليات المزامنة اليدوية
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Button
                          onClick={() => handleManualSync('smart')}
                          disabled={manualSyncStates.smart}
                          className="h-20 flex flex-col gap-2"
                          variant="outline"
                        >
                          {manualSyncStates.smart ? (
                            <Loader2 className="w-6 h-6 animate-spin" />
                          ) : (
                            <Zap className="w-6 h-6" />
                          )}
                          <div className="text-center">
                            <div className="font-medium">مزامنة ذكية</div>
                            <div className="text-xs text-muted-foreground">فواتير جديدة فقط</div>
                          </div>
                        </Button>

                        <Button
                          onClick={() => handleManualSync('comprehensive')}
                          disabled={manualSyncStates.comprehensive}
                          className="h-20 flex flex-col gap-2"
                          variant="outline"
                        >
                          {manualSyncStates.comprehensive ? (
                            <Loader2 className="w-6 h-6 animate-spin" />
                          ) : (
                            <Target className="w-6 h-6" />
                          )}
                          <div className="text-center">
                            <div className="font-medium">مزامنة شاملة</div>
                            <div className="text-xs text-muted-foreground">جميع البيانات</div>
                          </div>
                        </Button>

                        <Button
                          onClick={() => handleManualSync('orders')}
                          disabled={manualSyncStates.orders}
                          className="h-20 flex flex-col gap-2"
                          variant="outline"
                        >
                          {manualSyncStates.orders ? (
                            <Loader2 className="w-6 h-6 animate-spin" />
                          ) : (
                            <Package className="w-6 h-6" />
                          )}
                          <div className="text-center">
                            <div className="font-medium">مزامنة الطلبات</div>
                            <div className="text-xs text-muted-foreground">حالات الطلبات فقط</div>
                          </div>
                        </Button>

                        <Button
                          onClick={() => handleManualSync('invoices')}
                          disabled={manualSyncStates.invoices}
                          className="h-20 flex flex-col gap-2"
                          variant="outline"
                        >
                          {manualSyncStates.invoices ? (
                            <Loader2 className="w-6 h-6 animate-spin" />
                          ) : (
                            <FileText className="w-6 h-6" />
                          )}
                          <div className="text-center">
                            <div className="font-medium">مزامنة الفواتير</div>
                            <div className="text-xs text-muted-foreground">فواتير التوصيل</div>
                          </div>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>

              {/* تبويب الإحصائيات */}
              <TabsContent value="stats" className="space-y-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                          <Package className="w-5 h-5 text-blue-500" />
                          <div>
                            <p className="text-sm text-muted-foreground">إجمالي الطلبات</p>
                            <p className="text-2xl font-bold">{stats.totalOrders || 0}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-5 h-5 text-green-500" />
                          <div>
                            <p className="text-sm text-muted-foreground">طلبات اليوم</p>
                            <p className="text-2xl font-bold">{stats.todayOrders || 0}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-purple-500" />
                          <div>
                            <p className="text-sm text-muted-foreground">طلبات الأسبوع</p>
                            <p className="text-2xl font-bold">{stats.weekOrders || 0}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                          <Activity className="w-5 h-5 text-orange-500" />
                          <div>
                            <p className="text-sm text-muted-foreground">محدث مؤخراً</p>
                            <p className="text-2xl font-bold">{stats.recentlyUpdated || 0}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Archive className="w-5 h-5" />
                        سجل المزامنة الأخير
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-40">
                        {syncLogs.length > 0 ? (
                          <div className="space-y-2">
                            {syncLogs.map((log, index) => (
                              <div key={index} className="flex items-center justify-between p-2 rounded border">
                                <div>
                                  <p className="text-sm font-medium">{log.operation_type}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(log.created_at).toLocaleString('ar-EG')}
                                  </p>
                                </div>
                                <Badge variant={log.success ? "default" : "destructive"}>
                                  {log.success ? "نجح" : "فشل"}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-center text-muted-foreground">لا توجد سجلات مزامنة</p>
                        )}
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>
            </ScrollArea>

            {/* أزرار التحكم */}
            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={onOpenChange}>
                إغلاق
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 ml-1 animate-spin" />}
                حفظ الإعدادات
              </Button>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ComprehensiveDeliveryManagementDialog;