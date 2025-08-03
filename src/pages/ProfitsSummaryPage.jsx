import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useProfits } from '@/contexts/ProfitsContext';
import { scrollToTopInstant } from '@/utils/scrollToTop';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { format, startOfMonth, endOfMonth, parseISO, isValid, startOfDay, startOfWeek, startOfYear, endOfDay, endOfWeek, endOfYear } from 'date-fns';
import { useLocation, useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import OrderDetailsDialog from '@/components/orders/OrderDetailsDialog';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { toast } from '@/components/ui/use-toast';
import { DollarSign, Archive, Trash2 } from 'lucide-react';
import { 
  AlertDialog, 
  AlertDialogTrigger, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';

// استخدام النظام الموحد بالكامل
import UnifiedProfitStats from '@/components/profits/UnifiedProfitStats';
import ProfitFilters from '@/components/profits/ProfitFilters';
import UnifiedSettlementRequest from '@/components/profits/UnifiedSettlementRequest';
import ProfitDetailsTable from '@/components/profits/ProfitDetailsTable';
import ProfitDetailsMobile from '@/components/profits/ProfitDetailsMobile';
import SettlementInvoiceDialog from '@/components/profits/SettlementInvoiceDialog';
import ExpensesDialog from '@/components/accounting/ExpensesDialog';
import UnifiedSettledDuesDialog from '@/components/shared/UnifiedSettledDuesDialog';
import ManagerProfitsDialog from '@/components/profits/ManagerProfitsDialog';
import ManagerProfitsCard from '@/components/shared/ManagerProfitsCard';
import EmployeeReceivedProfitsDialog from '@/components/shared/EmployeeReceivedProfitsDialog';
import { Button } from '@/components/ui/button';

const ProfitsSummaryPage = () => {
  console.log('🔄 تحميل صفحة ملخص الأرباح...');
  
  const { orders, calculateProfit, accounting, requestProfitSettlement, settlementInvoices, addExpense, deleteExpense, calculateManagerProfit, updateOrder, deleteOrders } = useInventory();
  const { user, allUsers } = useAuth();
  const { hasPermission } = usePermissions();
  const { profits, createSettlementRequest, markInvoiceReceived } = useProfits();
  
  console.log('✅ تم تحميل جميع السياقات بنجاح');
  const location = useLocation();
  const navigate = useNavigate();

  // Scroll to top when page loads
  useEffect(() => {
    scrollToTopInstant();
  }, []);

  const [filters, setFilters] = useState({
    employeeId: 'all',
    profitStatus: 'all',
  });
  
  // فلتر الفترة الزمنية - قائمة منسدلة مع حفظ الخيار - افتراضي كل الفترات
  const [periodFilter, setPeriodFilter] = useState(() => {
    return localStorage.getItem('profitsPeriodFilter') || 'all';
  });
  
  // حفظ الخيار عند التغيير
  useEffect(() => {
    localStorage.setItem('profitsPeriodFilter', periodFilter);
  }, [periodFilter]);
  
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [dialogs, setDialogs] = useState({ details: false, invoice: false, expenses: false, settledDues: false, employeeReceived: false });
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [isRequesting, setIsRequesting] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState([]);

  // تحديد الصلاحيات بناءً على الدور والصلاحيات
  const canViewAll = hasPermission('manage_profit_settlement') || hasPermission('view_all_profits') || hasPermission('view_all_data');
  const canRequestSettlement = hasPermission('request_profit_settlement');
  
  // تطبيق فلتر المعلقة مباشرة للموظفين
  useEffect(() => {
    if (!canViewAll) {
      setFilters(prev => ({ ...prev, profitStatus: 'pending' }));
    }
  }, [canViewAll]);
  
  console.log('🔧 صلاحيات المستخدم:', { 
    canViewAll, 
    canRequestSettlement, 
    userRole: user?.role,
    userId: user?.id,
    hasRequestPermission: hasPermission('request_profit_settlement'),
    hasManagePermission: hasPermission('manage_profit_settlement'),
    hasViewAllPermission: hasPermission('view_all_profits')
  });
  
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const invoiceId = params.get('invoice');
    if (invoiceId && settlementInvoices) {
        const invoice = settlementInvoices.find(inv => inv.id === parseInt(invoiceId));
        if (invoice) {
            setSelectedInvoice(invoice);
            setDialogs(d => ({ ...d, invoice: true }));
            // Clean up URL
            navigate(location.pathname, { replace: true });
        }
    }
  }, [location.search, settlementInvoices, navigate, location.pathname]);

  // تعريف الموظفين مبكراً لضمان الوصول إليهم
  const employees = allUsers?.filter(u => u.role === 'employee' || u.role === 'deputy') || [];

  // معالج تغيير الفلاتر - مبسط
  const handleFilterChange = (key, value) => {
    if (key === 'employeeId') {
      setFilters(prev => ({ ...prev, employeeId: value }));
    } else if (key === 'profitStatus') {
      setFilters(prev => ({ ...prev, profitStatus: value }));
    }
  };

  // معالجات بسيطة للحوارات
  const handleRequestSettlement = async () => {
    console.log('طلب تسوية للطلبات المحددة:', selectedOrders);
    // Implementation here
  };

  const handleSettleSelected = async () => {
    console.log('تسوية الطلبات المحددة:', selectedOrders);
    // Implementation here
  };

  const handleArchiveSelected = async () => {
    console.log('أرشفة الطلبات المحددة:', selectedOrders);
    // Implementation here
  };

  const handleDeleteSelected = async () => {
    console.log('حذف الطلبات المحددة:', selectedOrders);
    // Implementation here
  };

  const handleOrderSelect = (orderId, isSelected) => {
    if (isSelected) {
      setSelectedOrders(prev => [...prev, orderId]);
    } else {
      setSelectedOrders(prev => prev.filter(id => id !== orderId));
    }
  };

  // مرشح بسيط للطلبات
  const filteredOrders = orders?.filter(order => {
    if (filters.employeeId !== 'all' && order.created_by !== filters.employeeId) return false;
    if (filters.profitStatus !== 'all') {
      // تطبيق فلتر الحالة حسب الحاجة
    }
    return true;
  }) || [];

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">جاري التحميل...</h2>
          <p className="text-muted-foreground">يرجى الانتظار</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <Helmet>
        <title>ملخص الأرباح - ريانة للمجوهرات</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">ملخص الأرباح</h1>
            <p className="text-muted-foreground mt-1">عرض شامل لأرباح المتجر وتفاصيل التسويات</p>
          </div>
          
          <div className="flex items-center gap-2">
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="اختر الفترة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الفترات</SelectItem>
                <SelectItem value="day">اليوم</SelectItem>
                <SelectItem value="week">هذا الأسبوع</SelectItem>
                <SelectItem value="month">هذا الشهر</SelectItem>
                <SelectItem value="year">هذا العام</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* استخدام النظام الموحد للإحصائيات */}
        <div className="space-y-6">
          <UnifiedProfitStats
            onFilterChange={handleFilterChange}
            onExpensesClick={() => setDialogs(d => ({ ...d, expenses: true }))}
            onSettledDuesClick={() => setDialogs(d => ({ ...d, settledDues: true }))}
            onManagerProfitsClick={() => setDialogs(d => ({ ...d, managerProfits: true }))}
            dateRange={periodFilter}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>تفاصيل الأرباح</CardTitle>
            <CardDescription>عرض مفصل للأرباح من كل طلب. يمكنك استخدام الفلاتر لتخصيص العرض.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfitFilters
                filters={filters}
                onFilterChange={handleFilterChange}
                canViewAll={canViewAll}
                employees={employees}
                user={user}
                allUsers={allUsers}
            />
            
            <UnifiedSettlementRequest
                canRequestSettlement={canRequestSettlement}
                isRequesting={isRequesting}
                selectedOrdersCount={selectedOrders.length}
                onRequest={handleRequestSettlement}
            />
            
            {selectedOrders.length > 0 && (
                <Card className="p-4 bg-secondary border">
                    <CardContent className="p-0 flex flex-wrap items-center justify-between gap-4">
                        <p className="font-semibold text-sm">{selectedOrders.length} طلبات محددة</p>
                        <div className="flex gap-2 flex-wrap">
                            {canViewAll && filters.profitStatus === 'pending' && (
                                <Button size="sm" onClick={handleSettleSelected}>
                                    <DollarSign className="w-4 h-4 ml-2" />
                                    تسوية المبالغ المحددة
                                </Button>
                            )}
                             {canViewAll && (
                                 <Button size="sm" variant="outline" onClick={handleArchiveSelected}>
                                    <Archive className="w-4 h-4 ml-2" />
                                    أرشفة المحدد
                                 </Button>
                             )}
                             {canViewAll && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button size="sm" variant="destructive">
                                            <Trash2 className="w-4 h-4 ml-2" />
                                            حذف المحدد
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                                            <AlertDialogDescription>هل أنت متأكد من حذف الطلبات المحددة نهائياً؟ لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleDeleteSelected}>حذف</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                             )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {isMobile ? (
              <ProfitDetailsMobile
                orders={filteredOrders}
                onOrderSelect={handleOrderSelect}
                selectedOrders={selectedOrders}
                onDetailsClick={(order) => {
                  setSelectedOrder(order);
                  setDialogs(d => ({ ...d, details: true }));
                }}
                canViewAll={canViewAll}
                canRequestSettlement={canRequestSettlement}
              />
            ) : (
              <ProfitDetailsTable
                orders={filteredOrders}
                onOrderSelect={handleOrderSelect}
                selectedOrders={selectedOrders}
                onDetailsClick={(order) => {
                  setSelectedOrder(order);
                  setDialogs(d => ({ ...d, details: true }));
                }}
                canViewAll={canViewAll}
                canRequestSettlement={canRequestSettlement}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* الحوارات */}
      <OrderDetailsDialog
        order={selectedOrder}
        isOpen={dialogs.details}
        onClose={() => setDialogs(d => ({ ...d, details: false }))}
      />

      <SettlementInvoiceDialog
        invoice={selectedInvoice}
        isOpen={dialogs.invoice}
        onClose={() => setDialogs(d => ({ ...d, invoice: false }))}
      />

      <ExpensesDialog
        isOpen={dialogs.expenses}
        onClose={() => setDialogs(d => ({ ...d, expenses: false }))}
      />

      <UnifiedSettledDuesDialog
        isOpen={dialogs.settledDues}
        onClose={() => setDialogs(d => ({ ...d, settledDues: false }))}
      />

      <ManagerProfitsDialog
        isOpen={dialogs.managerProfits}
        onClose={() => setDialogs(d => ({ ...d, managerProfits: false }))}
      />

      <EmployeeReceivedProfitsDialog
        isOpen={dialogs.employeeReceived}
        onClose={() => setDialogs(d => ({ ...d, employeeReceived: false }))}
      />
    </div>
  );
};

export default ProfitsSummaryPage;