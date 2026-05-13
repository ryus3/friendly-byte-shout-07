import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion } from 'framer-motion';
import { RefreshCw, Search, Package, DollarSign, FileText, Clock, Users, Calendar, Filter } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import * as AlWaseetAPI from '@/lib/alwaseet-api';
import AlWaseetInvoicesList from './AlWaseetInvoicesList';
import AlWaseetInvoiceDetailsDialog from './AlWaseetInvoiceDetailsDialog';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useSupervisedEmployees } from '@/hooks/useSupervisedEmployees';
import devLog from '@/lib/devLogger';

const AllEmployeesInvoicesView = () => {
  const { token, isLoggedIn } = useAlWaseet();
  const { user } = useAuth();
  const { supervisedEmployeeIds, loading: supervisedLoading } = useSupervisedEmployees();
  
  const [allInvoices, setAllInvoices] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true); // true للتحميل الأولي
  const [syncing, setSyncing] = useState(false); // للمزامنة الخلفية
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [timePeriodFilter, setTimePeriodFilter] = useState(() => {
    return localStorage.getItem('allEmployeesInvoicesTimePeriod') || 'week';
  });
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  // التحقق من الأدوار
  const isAdmin = user?.roles?.includes('admin') || user?.roles?.includes('super_admin');
  const isDepartmentManager = user?.roles?.includes('department_manager');
  const GENERAL_MANAGER_ID = '91484496-b887-44f7-9e5d-be9db5567604';

  // ============ نمط Cache-First: عرض سريع + مزامنة خلفية ============

  // 1️⃣ جلب البيانات المحفوظة من قاعدة البيانات (سريع جداً)
  const fetchFromDatabase = async () => {
    try {
      // جلب الموظفين النشطين
      const { data: employeesData, error: empError } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, username, employee_code')
        .eq('is_active', true)
        .neq('user_id', GENERAL_MANAGER_ID);

      if (empError) return;

      let filteredEmployees = employeesData || [];
      if (isDepartmentManager && !isAdmin) {
        if (!supervisedEmployeeIds || supervisedEmployeeIds.length === 0) {
          // مدير قسم بدون موظفين تحت إشرافه - لا يعرض شيء
          setEmployees([]);
          setAllInvoices([]);
          setLoading(false);
          return;
        }
        filteredEmployees = filteredEmployees.filter(emp => 
          supervisedEmployeeIds.includes(emp.user_id)
        );
      }
      setEmployees(filteredEmployees);

      // قائمة معرفات الموظفين المسموح لهم — (مدير القسم: موظفيه فقط، الأدمن: الجميع عدا المدير العام)
      const allowedEmployeeIds = (filteredEmployees || [])
        .map(e => e.user_id)
        .filter(id => id && id !== GENERAL_MANAGER_ID);

      // جلب الفواتير المحفوظة — الترتيب حسب تاريخ الفاتورة من شركة التوصيل (issued_at)
      const threshold = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data: invoicesData, error: invError } = await supabase
        .from('delivery_invoices')
        .select('*')
        .in('partner', ['alwaseet', 'modon'])
        .or(`issued_at.gte.${threshold},and(issued_at.is.null,created_at.gte.${threshold})`)
        .order('issued_at', { ascending: false, nullsFirst: false })
        .limit(300);

      if (invError) return;

      // 🆕 منطق الفاتورة المشتركة: نجلب من orders كل الطلبات المسلَّمة المربوطة بأي فاتورة من القائمة
      //    ونحسب أصحاب الطلبات الفعليين (created_by) لكل فاتورة. هذا يكشف الموظفين الذين شاركوا
      //    حساب شركة توصيل واحد مع المدير. فاتورة بدون أي طلب لموظف مسموح لا تظهر هنا.
      const invoiceExternalIds = (invoicesData || []).map(i => i.external_id).filter(Boolean);
      const ownersByInvoice = new Map(); // external_id => Set<creator_id>
      const accountOwnersByInvoice = new Map(); // invoice id => Set<employee user_id> by shared delivery account
      if (invoiceExternalIds.length > 0 && allowedEmployeeIds.length > 0) {
        // chunked IN to avoid URL limits
        const chunkSize = 100;
        for (let i = 0; i < invoiceExternalIds.length; i += chunkSize) {
          const chunk = invoiceExternalIds.slice(i, i + chunkSize);
          const { data: ordersRows } = await supabase
            .from('orders')
            .select('delivery_partner_invoice_id, created_by')
            .in('delivery_partner_invoice_id', chunk)
            .in('created_by', allowedEmployeeIds);
          (ordersRows || []).forEach(r => {
            if (!r.delivery_partner_invoice_id || !r.created_by) return;
            if (!ownersByInvoice.has(r.delivery_partner_invoice_id)) {
              ownersByInvoice.set(r.delivery_partner_invoice_id, new Set());
            }
            ownersByInvoice.get(r.delivery_partner_invoice_id).add(r.created_by);
          });
        }

        const { data: tokenRows } = await supabase
          .from('delivery_partner_tokens')
          .select('user_id, partner_name, account_username, normalized_username')
          .in('user_id', allowedEmployeeIds)
          .in('partner_name', ['alwaseet', 'modon'])
          .eq('is_active', true);

        const accountOwners = new Map();
        (tokenRows || []).forEach(t => {
          const username = String(t.normalized_username || t.account_username || '').trim().toLowerCase();
          if (!username || !t.user_id) return;
          const key = `${t.partner_name}:${username}`;
          if (!accountOwners.has(key)) accountOwners.set(key, new Set());
          accountOwners.get(key).add(t.user_id);
        });

        (invoicesData || []).forEach(inv => {
          const username = String(inv.account_username || '').trim().toLowerCase();
          const key = `${inv.partner}:${username}`;
          const owners = accountOwners.get(key);
          if (owners?.size) accountOwnersByInvoice.set(inv.id, owners);
        });
      }

      // بناء قائمة العرض النهائية: صف لكل (فاتورة × موظف فعلي مرتبط بها)
      const expanded = [];
      (invoicesData || []).forEach(invoice => {
        // 1) المالك الأصلي إذا كان موظفاً مسموحاً (وليس المدير العام)
        const ownerSet = new Set();
        if (
          invoice.owner_user_id &&
          invoice.owner_user_id !== GENERAL_MANAGER_ID &&
          allowedEmployeeIds.includes(invoice.owner_user_id)
        ) {
          ownerSet.add(invoice.owner_user_id);
        }
        // 2) الموظفون الذين لديهم طلبات محلية ضمن هذه الفاتورة (الفاتورة المشتركة)
        const linkedOwners = ownersByInvoice.get(invoice.external_id);
        if (linkedOwners) {
          linkedOwners.forEach(uid => ownerSet.add(uid));
        }
        // 3) الفواتير المشتركة تظهر أيضاً للموظف إذا كان لديه نفس حساب شركة التوصيل محفوظاً
        const accountOwners = accountOwnersByInvoice.get(invoice.id);
        if (accountOwners) {
          accountOwners.forEach(uid => ownerSet.add(uid));
        }
        if (ownerSet.size === 0) return;
        ownerSet.forEach(uid => {
          const emp = employeesData?.find(e => e.user_id === uid) || null;
          expanded.push({
            ...invoice,
            // مفتاح فريد للعرض حتى لا تتعارض الفاتورة المشتركة بين موظفين
            display_key: `${invoice.id}:${uid}`,
            attributed_user_id: uid,
            employee_name: emp?.full_name || emp?.username || 'غير محدد',
            employee_code: emp?.employee_code || null,
          });
        });
      });

      setAllInvoices(expanded);
      return { employeesData, invoicesWithEmployees: expanded };
    } catch (error) {
      console.error('Error fetching from database:', error);
    }
  };

  // 2️⃣ مزامنة خلفية مع API (لا تؤثر على الأداء)
  const syncInBackground = async () => {
    if (syncing) return; // تجنب التكرار
    setSyncing(true);
    
    try {
      // مزامنة شاملة لجميع حسابات الموظفين
      const { error: syncError } = await supabase.functions.invoke('smart-invoice-sync', {
        body: { 
          mode: 'comprehensive',
          force_refresh: true,
          sync_invoices: true,
          sync_orders: true
        }
      });
      
      if (!syncError) {
        // بعد نجاح المزامنة، تحديث البيانات من قاعدة البيانات
        await fetchFromDatabase();
        setLastSync(new Date().toISOString());
        devLog.log('✅ Background sync completed');
      }
    } catch (error) {
      devLog.warn('Background sync failed:', error);
    } finally {
      setSyncing(false);
    }
  };

  // 3️⃣ الوظيفة المجمعة للتحميل الأولي
  const initialLoad = async () => {
    setLoading(true);
    try {
      // أولاً: عرض البيانات المحفوظة فوراً
      await fetchFromDatabase();
    } finally {
      setLoading(false);
    }
    
    // ثانياً: مزامنة في الخلفية (بدون انتظار)
    syncInBackground();
  };

  // 4️⃣ تحديث يدوي (عند الضغط على زر التحديث)
  const handleRefresh = async () => {
    setSyncing(true);
    try {
      await supabase.functions.invoke('smart-invoice-sync', {
        body: { 
          mode: 'comprehensive',
          force_refresh: true,
          sync_invoices: true,
          sync_orders: true
        }
      });
      await fetchFromDatabase();
      setLastSync(new Date().toISOString());
    } finally {
      setSyncing(false);
    }
  };

  // تأثير التحميل الأولي: عرض فوري + مزامنة خلفية
  useEffect(() => {
    if (isDepartmentManager && !isAdmin && supervisedLoading) return;
    
    initialLoad(); // تحميل سريع + مزامنة خلفية
    
    // الاستماع لأحداث المزامنة من أجزاء أخرى من التطبيق
    const handleSyncEvent = () => {
      fetchFromDatabase();
    };
    window.addEventListener('invoicesSynced', handleSyncEvent);
    
    // مزامنة دورية كل 15 دقيقة
    const syncInterval = setInterval(() => {
      syncInBackground();
    }, 15 * 60 * 1000);
    
    return () => {
      clearInterval(syncInterval);
      window.removeEventListener('invoicesSynced', handleSyncEvent);
    };
  }, [token, isLoggedIn, supervisedEmployeeIds, supervisedLoading]);

  // فلترة الفواتير مع الفترة الزمنية (محسن)
  const filteredInvoices = useMemo(() => {
    return allInvoices.filter(invoice => {
      // الفلترة الآن تعتمد على attributed_user_id (الموظف المنسوبة له الفاتورة)
      const matchesSearch = !searchTerm || 
        invoice.external_id?.toString().includes(searchTerm) ||
        invoice.employee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.amount?.toString().includes(searchTerm);
      
      const matchesStatus = 
        statusFilter === 'all' || 
        (statusFilter === 'received' && (invoice.received === true || invoice.received_flag === true)) ||
        (statusFilter === 'pending' && !invoice.received && !invoice.received_flag);
      
      const matchesEmployee = 
        employeeFilter === 'all' || 
        invoice.attributed_user_id === employeeFilter ||
        invoice.owner_user_id === employeeFilter;

      // فلتر الفترة الزمنية
      let matchesTimePeriod = true;
      if (timePeriodFilter !== 'all') {
        const invoiceDate = new Date(invoice.issued_at || invoice.created_at);
        const now = new Date();
        
        switch (timePeriodFilter) {
          case 'today':
            matchesTimePeriod = invoiceDate.toDateString() === now.toDateString();
            break;
          case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            matchesTimePeriod = invoiceDate >= weekAgo;
            break;
          case 'month':
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            matchesTimePeriod = invoiceDate >= monthAgo;
            break;
          case '3months':
            const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            matchesTimePeriod = invoiceDate >= threeMonthsAgo;
            break;
          case '6months':
            const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
            matchesTimePeriod = invoiceDate >= sixMonthsAgo;
            break;
          case 'year':
            const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            matchesTimePeriod = invoiceDate >= yearAgo;
            break;
          default:
            matchesTimePeriod = true;
        }
      }
      
      return matchesSearch && matchesStatus && matchesEmployee && matchesTimePeriod;
    });
  }, [allInvoices, searchTerm, statusFilter, employeeFilter, timePeriodFilter]);

  // حساب الإحصائيات
  const stats = useMemo(() => {
    const total = filteredInvoices.length;
    const received = filteredInvoices.filter(inv => inv.received || inv.received_flag).length;
    const pending = total - received;
    const totalAmount = filteredInvoices.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);
    const totalOrders = filteredInvoices.reduce((sum, inv) => sum + (parseInt(inv.orders_count) || 0), 0);

    return { total, received, pending, totalAmount, totalOrders };
  }, [filteredInvoices]);

  const handleViewInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    setDetailsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* إحصائيات إجمالية */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* إجمالي الفواتير */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="group"
        >
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-100">إجمالي الفواتير</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <FileText className="h-8 w-8 text-blue-200" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* الفواتير المستلمة */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-100">مستلمة</p>
                  <p className="text-2xl font-bold">{stats.received}</p>
                </div>
                <Package className="h-8 w-8 text-green-200" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* الفواتير المعلقة */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-amber-100">معلقة</p>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                </div>
                <Clock className="h-8 w-8 text-amber-200" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* إجمالي المبلغ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-100">إجمالي المبلغ</p>
                  <p className="text-xl font-bold">{stats.totalAmount?.toLocaleString()} د.ع</p>
                </div>
                <DollarSign className="h-8 w-8 text-purple-200" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* إجمالي الطلبات */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="bg-gradient-to-br from-rose-500 to-pink-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-rose-100">إجمالي الطلبات</p>
                  <p className="text-2xl font-bold">{stats.totalOrders}</p>
                </div>
                <Users className="h-8 w-8 text-rose-200" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* الفلاتر وأدوات التحكم */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>فواتير جميع الموظفين</span>
            <div className="flex items-center gap-2">
              {syncing && (
                <span className="text-sm text-muted-foreground animate-pulse">
                  جاري المزامنة...
                </span>
              )}
              <Button
                onClick={handleRefresh}
                disabled={syncing}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                تحديث الفواتير
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* شريط الفلاتر في سطر واحد */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* البحث */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="البحث برقم الفاتورة أو اسم الموظف..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* فلتر الحالة */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 z-10" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="pl-10">
                  <SelectValue placeholder="جميع الحالات" />
                </SelectTrigger>
                <SelectContent className="bg-background border border-border shadow-lg">
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  <SelectItem value="received">مستلمة</SelectItem>
                  <SelectItem value="pending">معلقة</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* فلتر الموظف */}
            <div className="relative">
              <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 z-10" />
              <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                <SelectTrigger className="pl-10">
                  <SelectValue placeholder="جميع الموظفين" />
                </SelectTrigger>
                <SelectContent className="bg-background border border-border shadow-lg">
                  <SelectItem value="all">جميع الموظفين</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.user_id} value={emp.user_id}>
                      {emp.full_name || emp.username} {emp.employee_code && `(${emp.employee_code})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* فلتر الفترة الزمنية */}
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 z-10" />
              <Select value={timePeriodFilter} onValueChange={(value) => {
                setTimePeriodFilter(value);
                localStorage.setItem('allEmployeesInvoicesTimePeriod', value);
              }}>
                <SelectTrigger className="pl-10">
                  <SelectValue placeholder="آخر أسبوع" />
                </SelectTrigger>
                <SelectContent className="bg-background border border-border shadow-lg">
                  <SelectItem value="all">جميع الفترات</SelectItem>
                  <SelectItem value="today">اليوم</SelectItem>
                  <SelectItem value="week">آخر أسبوع</SelectItem>
                  <SelectItem value="month">آخر شهر</SelectItem>
                  <SelectItem value="3months">آخر 3 أشهر</SelectItem>
                  <SelectItem value="6months">آخر 6 أشهر</SelectItem>
                  <SelectItem value="year">آخر سنة</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* معلومات آخر مزامنة */}
          {lastSync && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              آخر مزامنة: {new Date(lastSync).toLocaleString('ar-EG')}
            </div>
          )}

          {/* قائمة الفواتير */}
          <AlWaseetInvoicesList 
            invoices={filteredInvoices}
            onViewInvoice={handleViewInvoice}
            loading={loading}
            showEmployeeName={true}
          />
        </CardContent>
      </Card>

      {/* نافذة تفاصيل الفاتورة */}
      <AlWaseetInvoiceDetailsDialog
        invoice={selectedInvoice}
        isOpen={detailsDialogOpen}
        onClose={() => {
          setDetailsDialogOpen(false);
          setSelectedInvoice(null);
        }}
      />
    </div>
  );
};

export default AllEmployeesInvoicesView;