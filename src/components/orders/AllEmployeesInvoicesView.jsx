import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion } from 'framer-motion';
import { RefreshCw, Search, Package, DollarSign, FileText, Clock, Users } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import * as AlWaseetAPI from '@/lib/alwaseet-api';
import AlWaseetInvoicesList from './AlWaseetInvoicesList';
import AlWaseetInvoiceDetailsDialog from './AlWaseetInvoiceDetailsDialog';

const AllEmployeesInvoicesView = () => {
  const { token, isLoggedIn } = useAlWaseet();
  const [allInvoices, setAllInvoices] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  // جلب جميع فواتير الموظفين
  const fetchAllEmployeesInvoices = async (forceSync = false) => {
    setLoading(true);
    try {
      // جلب الموظفين النشطين
      const { data: employeesData, error: empError } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, username, employee_code')
        .eq('is_active', true)
        .neq('user_id', '91484496-b887-44f7-9e5d-be9db5567604'); // استبعاد المدير

      if (empError) {
        console.error('خطأ في جلب الموظفين:', empError);
        return;
      }

      setEmployees(employeesData || []);

      // مزامنة من API إذا مطلوب
      if (forceSync && token && isLoggedIn) {
        try {
          const recentInvoices = await AlWaseetAPI.getMerchantInvoices(token);
          if (recentInvoices?.length > 0) {
            await supabase.rpc('upsert_alwaseet_invoice_list', {
              p_invoices: recentInvoices
            });
            console.log('✅ مزامنة الفواتير من API:', recentInvoices.length);
          }
        } catch (apiError) {
          console.warn('تحذير API:', apiError.message);
        }
      }

      // جلب جميع الفواتير من قاعدة البيانات
      const { data: invoicesData, error: invError } = await supabase
        .from('delivery_invoices')
        .select('*')
        .eq('partner', 'alwaseet')
        .order('issued_at', { ascending: false })
        .limit(50); // آخر 50 فاتورة

      if (invError) {
        console.error('خطأ في جلب الفواتير:', invError);
        return;
      }

      // ربط الفواتير بالموظفين
      const invoicesWithEmployees = (invoicesData || []).map(invoice => {
        const employee = employeesData?.find(emp => emp.user_id === invoice.owner_user_id) || null;
        return {
          ...invoice,
          employee_name: employee?.full_name || employee?.username || 'غير محدد',
          employee_code: employee?.employee_code || null
        };
      });

      setAllInvoices(invoicesWithEmployees);
      setLastSync(new Date().toISOString());
      
    } catch (error) {
      console.error('خطأ في جلب فواتير جميع الموظفين:', error);
    } finally {
      setLoading(false);
    }
  };

  // تأثير التحميل الأولي مع مزامنة تلقائية
  useEffect(() => {
    fetchAllEmployeesInvoices(true); // مع مزامنة فورية
  }, []);

  // فلترة الفواتير
  const filteredInvoices = useMemo(() => {
    return allInvoices.filter(invoice => {
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
        invoice.owner_user_id === employeeFilter;
      
      return matchesSearch && matchesStatus && matchesEmployee;
    });
  }, [allInvoices, searchTerm, statusFilter, employeeFilter]);

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

  const handleRefresh = () => {
    fetchAllEmployeesInvoices(true);
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
            <Button 
              onClick={handleRefresh} 
              disabled={loading}
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              تحديث
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* شريط الفلاتر */}
          <div className="flex flex-wrap gap-4">
            {/* البحث */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="البحث برقم الفاتورة أو اسم الموظف..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* فلتر الحالة */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="received">مستلمة</SelectItem>
                <SelectItem value="pending">معلقة</SelectItem>
              </SelectContent>
            </Select>

            {/* فلتر الموظف */}
            <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="الموظف" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الموظفين</SelectItem>
                {employees.map((emp) => (
                  <SelectItem key={emp.user_id} value={emp.user_id}>
                    {emp.full_name || emp.username} {emp.employee_code && `(${emp.employee_code})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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