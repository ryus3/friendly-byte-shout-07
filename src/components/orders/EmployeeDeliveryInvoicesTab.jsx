import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion } from 'framer-motion';
import { 
  RefreshCw, 
  Search, 
  Package, 
  DollarSign, 
  FileText, 
  Clock,
  AlertTriangle,
  Calendar,
  Banknote,
  Receipt,
  User
} from 'lucide-react';
import { useInventory } from '@/contexts/InventoryContext';
import { supabase } from '@/lib/customSupabaseClient';
import AlWaseetInvoicesList from './AlWaseetInvoicesList';
import AlWaseetInvoiceDetailsDialog from './AlWaseetInvoiceDetailsDialog';

const EmployeeDeliveryInvoicesTab = ({ employeeId }) => {
  const { refreshOrders } = useInventory();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState([]);

  // جلب فواتير شركة التوصيل للموظف المحدد
  React.useEffect(() => {
    const fetchEmployeeInvoices = async () => {
      if (!employeeId || employeeId === 'all') {
        setInvoices([]);
        return;
      }

      setLoading(true);
      try {
        const { data: employeeInvoices, error } = await supabase
          .from('delivery_invoices')
          .select('*')
          .eq('partner', 'alwaseet')
          .eq('owner_user_id', employeeId)
          .order('issued_at', { ascending: false });

        if (error) {
          console.error('خطأ في جلب فواتير الموظف:', error);
          setInvoices([]);
        } else {
          setInvoices(employeeInvoices || []);
        }
      } catch (err) {
        console.error('خطأ غير متوقع:', err);
        setInvoices([]);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployeeInvoices();
  }, [employeeId]);

  // فلترة الفواتير
  const filteredInvoices = useMemo(() => {
    return invoices.filter(invoice => {
      const matchesSearch = 
        invoice.external_id?.toString().includes(searchTerm) ||
        invoice.amount?.toString().includes(searchTerm);
      
      const matchesStatus = 
        statusFilter === 'all' || 
        (statusFilter === 'received' && invoice.received === true) ||
        (statusFilter === 'pending' && invoice.received !== true);
      
      return matchesSearch && matchesStatus;
    });
  }, [invoices, searchTerm, statusFilter]);

  // إحصائيات الفواتير
  const getInvoiceStats = () => {
    const totalInvoices = invoices.length;
    const pendingInvoices = invoices.filter(inv => !inv.received).length;
    const totalAmount = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const totalOrders = invoices.reduce((sum, inv) => sum + (inv.orders_count || 0), 0);
    
    return { totalInvoices, pendingInvoices, totalAmount, totalOrders };
  };

  const stats = getInvoiceStats();

  const handleViewInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    setDetailsDialogOpen(true);
  };

  const handleRefresh = async () => {
    if (refreshOrders) {
      await refreshOrders();
    }
  };

  // إذا لم يتم تحديد موظف
  if (!employeeId || employeeId === 'all') {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <User className="h-12 w-12 mx-auto text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">اختر موظفاً لعرض فواتيره</h3>
          <p className="text-muted-foreground">
            يرجى اختيار موظف محدد من الفلاتر أعلاه لعرض فواتير شركة التوصيل الخاصة به
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* إحصائيات فواتير الموظف */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* إجمالي الفواتير */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          whileHover={{ y: -8, transition: { duration: 0.2 } }}
          className="group"
        >
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 shadow-2xl hover:shadow-blue-500/25 hover:shadow-2xl transition-all duration-500 min-h-[100px] h-full">
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:scale-125 transition-transform duration-700" />
            <CardContent className="p-4 relative z-10 h-full flex flex-col justify-between">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium text-blue-100 leading-tight">إجمالي الفواتير</p>
                  <motion.p 
                    className="text-2xl font-bold text-white drop-shadow-lg leading-none"
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.3 }}
                  >
                    {stats.totalInvoices}
                  </motion.p>
                </div>
                <motion.div
                  whileHover={{ rotate: 360, scale: 1.1 }}
                  transition={{ duration: 0.5 }}
                  className="p-2.5 bg-white/20 backdrop-blur-sm rounded-lg shadow-lg flex-shrink-0"
                >
                  <Receipt className="h-6 w-6 text-white drop-shadow-sm" />
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* فواتير معلقة */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="group"
        >
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-orange-500 via-orange-600 to-red-600 shadow-2xl hover:shadow-orange-500/25 hover:shadow-2xl transition-all duration-500 min-h-[100px] h-full">
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:scale-125 transition-transform duration-700" />
            <CardContent className="p-4 relative z-10 h-full flex flex-col justify-between">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium text-orange-100 leading-tight">فواتير معلقة</p>
                  <motion.p 
                    className="text-2xl font-bold text-white drop-shadow-lg leading-none"
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.4 }}
                  >
                    {stats.pendingInvoices}
                  </motion.p>
                </div>
                <motion.div
                  whileHover={{ rotate: 360, scale: 1.1 }}
                  transition={{ duration: 0.5 }}
                  className="p-2.5 bg-white/20 backdrop-blur-sm rounded-lg shadow-lg flex-shrink-0"
                >
                  <Clock className="h-6 w-6 text-white drop-shadow-sm" />
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* إجمالي المبالغ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="group"
        >
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 shadow-2xl hover:shadow-emerald-500/25 hover:shadow-2xl transition-all duration-500 min-h-[100px] h-full">
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:scale-125 transition-transform duration-700" />
            <CardContent className="p-4 relative z-10 h-full flex flex-col justify-between">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium text-emerald-100 leading-tight">إجمالي المبالغ</p>
                  <motion.p 
                    className="text-2xl font-bold text-white drop-shadow-lg leading-none"
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.5 }}
                  >
                    {stats.totalAmount.toLocaleString()}
                  </motion.p>
                  <p className="text-sm font-medium text-emerald-200">د.ع</p>
                </div>
                <motion.div
                  whileHover={{ rotate: 360, scale: 1.1 }}
                  transition={{ duration: 0.5 }}
                  className="p-2.5 bg-white/20 backdrop-blur-sm rounded-lg shadow-lg flex-shrink-0"
                >
                  <Banknote className="h-6 w-6 text-white drop-shadow-sm" />
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* إجمالي الطلبات */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="group"
        >
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-600 shadow-2xl hover:shadow-purple-500/25 hover:shadow-2xl transition-all duration-500 min-h-[100px] h-full">
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:scale-125 transition-transform duration-700" />
            <CardContent className="p-4 relative z-10 h-full flex flex-col justify-between">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium text-purple-100 leading-tight">إجمالي الطلبات</p>
                  <motion.p 
                    className="text-2xl font-bold text-white drop-shadow-lg leading-none"
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.6 }}
                  >
                    {stats.totalOrders}
                  </motion.p>
                </div>
                <motion.div
                  whileHover={{ rotate: 360, scale: 1.1 }}
                  transition={{ duration: 0.5 }}
                  className="p-2.5 bg-white/20 backdrop-blur-sm rounded-lg shadow-lg flex-shrink-0"
                >
                  <Package className="h-6 w-6 text-white drop-shadow-sm" />
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* فلاتر البحث */}
      <Card dir="rtl">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button 
                onClick={handleRefresh} 
                disabled={loading}
                size="sm"
              >
                تحديث
                <RefreshCw className={`h-4 w-4 ml-2 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <span className="text-right">فواتير شركة التوصيل للموظف</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 mb-6">
            {/* فلتر الحالة */}
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="flex-1" dir="rtl">
                  <SelectValue placeholder="الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع</SelectItem>
                  <SelectItem value="pending">معلقة</SelectItem>
                  <SelectItem value="received">مُستلمة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* فلتر البحث */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="البحث برقم الفاتورة أو المبلغ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* ملخص النتائج */}
          <div className="flex items-center justify-between mb-4">
            <Badge variant="outline" className="text-sm">
              {filteredInvoices.length} فاتورة
            </Badge>
            {searchTerm && (
              <div className="text-sm text-muted-foreground">
                البحث عن: "{searchTerm}"
              </div>
            )}
          </div>

          {/* قائمة الفواتير */}
          <AlWaseetInvoicesList
            invoices={filteredInvoices}
            loading={loading}
            onViewInvoice={handleViewInvoice}
          />
        </CardContent>
      </Card>

      {/* حوار تفاصيل الفاتورة */}
      <AlWaseetInvoiceDetailsDialog
        invoice={selectedInvoice}
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
      />
    </div>
  );
};

export default EmployeeDeliveryInvoicesTab;