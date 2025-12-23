import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useProfits } from '@/contexts/ProfitsContext';
import { supabase } from '@/integrations/supabase/client';
import { useUnifiedProfits } from '@/hooks/useUnifiedProfits';
import { useSupervisedEmployees } from '@/hooks/useSupervisedEmployees';
import { scrollToTopInstant } from '@/utils/scrollToTop';
import { getUserUUID } from '@/utils/userIdUtils';
import { isPendingStatus } from '@/utils/profitStatusHelper';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import SmartPagination from '@/components/ui/SmartPagination';
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

// Refactored Components
import ProfitStats from '@/components/profits/ProfitStats';
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
import UnifiedProfitDisplay from '@/components/shared/UnifiedProfitDisplay';
import { Button } from '@/components/ui/button';

const ProfitsSummaryPage = () => {
  const { orders, calculateProfit, accounting, requestProfitSettlement, settlementInvoices, addExpense, deleteExpense, calculateManagerProfit, updateOrder, deleteOrders } = useInventory();
  const { user, allUsers } = useAuth();
  const { hasPermission } = usePermissions();
  const { profits, createSettlementRequest, markInvoiceReceived, refreshProfits } = useProfits();
  
  // ✅ هوك الموظفين تحت الإشراف لفلترة البيانات حسب الصلاحيات
  const { supervisedEmployeeIds, isAdmin, isDepartmentManager } = useSupervisedEmployees();
  
  // استخدام النظام الموحد للحصول على صافي الربح الموحد - مع تمرير الموظفين المُشرف عليهم
  const { profitData: unifiedProfitData } = useUnifiedProfits('all', supervisedEmployeeIds);
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
  
  // حساب نطاق التاريخ بناء على الفلتر المحدد
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (periodFilter) {
      case 'day':
        return {
          from: startOfDay(now),
          to: endOfDay(now)
        };
      case 'week':
        return {
          from: startOfWeek(now, { weekStartsOn: 6 }), // السبت بداية الأسبوع
          to: endOfWeek(now, { weekStartsOn: 6 })
        };
      case 'month':
        return {
          from: startOfMonth(now),
          to: endOfMonth(now)
        };
      case 'year':
        return {
          from: startOfYear(now),
          to: endOfYear(now)
        };
      case 'all':
        return {
          from: new Date('2020-01-01'), // تاريخ بداية شامل
          to: new Date('2030-12-31')   // تاريخ نهاية شامل
        };
      default:
        return {
          from: startOfMonth(now),
          to: endOfMonth(now)
        };
    }
  }, [periodFilter]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [dialogs, setDialogs] = useState({ details: false, invoice: false, expenses: false, settledDues: false, employeeReceived: false });
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [isRequesting, setIsRequesting] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState([]);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  // تحديد الصلاحيات بناءً على الدور والصلاحيات
  const canViewAll = hasPermission('manage_profit_settlement') || hasPermission('view_all_profits') || hasPermission('view_all_data');
  const canRequestSettlement = hasPermission('request_profit_settlement');
  
  // تطبيق فلتر "جاهز للمحاسبة" للموظفين (يشمل pending و invoice_received)
  useEffect(() => {
    if (!canViewAll) {
      // الموظف يرى الطلبات المعلقة والجاهزة للمحاسبة (استبعاد المدفوعة فقط)
      setFilters(prev => ({ ...prev, profitStatus: 'not_settled' }));
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
  const employees = useMemo(() => {
    return allUsers?.filter(u => u.role === 'employee' || u.role === 'deputy') || [];
  }, [allUsers]);

    const profitData = useMemo(() => {
        const { from, to } = dateRange;
        console.log('🔍 حساب بيانات الأرباح:', { from, to, ordersCount: orders?.length, usersCount: allUsers?.length, profitsCount: profits?.length });
        
        if (!orders || !allUsers || !from || !to || !profits) {
            console.log('❌ بيانات ناقصة للحساب:', { 
                hasOrders: !!orders, 
                hasUsers: !!allUsers, 
                hasDateRange: !!from && !!to, 
                hasProfits: !!profits 
            });
            return {
                managerProfitFromEmployees: 0,
                detailedProfits: [],
                totalExpenses: 0,
                totalPersonalProfit: 0,
                personalPendingProfit: 0,
                personalSettledProfit: 0,
                totalSettledDues: 0,
                netProfit: 0,
                totalRevenue: 0,
                deliveryFees: 0,
                cogs: 0,
                generalExpenses: 0,
                employeeSettledDues: 0
            };
        }

        // فلترة الطلبات الموصلة التي تم استلام فواتيرها في النطاق الزمني المحدد
        // ✅ تشمل الطلبات المؤرشفة التي لم تُحاسب بعد
        const deliveredOrders = orders?.filter(o => {
            const orderDate = o.created_at ? parseISO(o.created_at) : null;
            const isDelivered = o.status === 'delivered' || o.status === 'completed';
            const hasReceipt = o.receipt_received === true;
            const inDateRange = orderDate && isValid(orderDate) && orderDate >= from && orderDate <= to;
            
            // إظهار الطلبات المؤرشفة أيضاً إذا كانت لم تُحاسب بعد
            // استثناء الطلبات بدون ربح (no_rule_settled) لأنها لا تحتاج تحاسب
            const profitRecord = profits?.find(p => p.order_id === o.id);
            const notSettled = !profitRecord || 
              (profitRecord.status !== 'settled' && profitRecord.status !== 'no_rule_settled');
            
            return isDelivered && hasReceipt && inDateRange && notSettled;
        }) || [];

        // الطلبات الموصلة بدون فواتير مستلمة (معلقة)
        const pendingDeliveredOrders = orders?.filter(o => {
            const orderDate = o.created_at ? parseISO(o.created_at) : null;
            return (o.status === 'delivered' || o.status === 'completed') && !o.receipt_received && orderDate && isValid(orderDate) && orderDate >= from && orderDate <= to;
        }) || [];

        // ربط الطلبات بسجلات الأرباح من قاعدة البيانات
        const detailedProfits = [];

        // معالجة الطلبات المستلمة
        deliveredOrders.forEach(order => {
            const orderCreator = allUsers.find(u => u.user_id === order.created_by || u.id === order.created_by);
            if (!orderCreator) return;

            // البحث عن سجل الأرباح في قاعدة البيانات
            const profitRecord = profits.find(p => p.order_id === order.id);
            
            let employeeProfitShare, profitStatus;
            if (profitRecord) {
                employeeProfitShare = profitRecord.employee_profit || 0;
                // استخدام status من قاعدة البيانات بدلاً من settled_at فقط
                profitStatus = profitRecord.status || 'pending';
            } else {
                employeeProfitShare = (order.items || []).reduce((sum, item) => sum + calculateProfit(item, order.created_by), 0);
                profitStatus = 'pending'; // معلق إذا لم يكن هناك سجل في الأرباح
            }
            
            const managerProfitShare = calculateManagerProfit(order);
            
            detailedProfits.push({
                ...order,
                profit: employeeProfitShare,
                managerProfitShare,
                employeeName: orderCreator.full_name,
                profitStatus,
                profitRecord,
            });
        });

        // معالجة الطلبات المعلقة (موصلة بدون فواتير)
        pendingDeliveredOrders.forEach(order => {
            const orderCreator = allUsers.find(u => u.user_id === order.created_by || u.id === order.created_by);
            if (!orderCreator) return;

            const employeeProfitShare = (order.items || []).reduce((sum, item) => sum + calculateProfit(item, order.created_by), 0);
            const managerProfitShare = calculateManagerProfit(order);
            
            detailedProfits.push({
                ...order,
                profit: employeeProfitShare,
                managerProfitShare,
                employeeName: orderCreator.full_name,
                profitStatus: 'pending', // معلقة لأن الفاتورة غير مستلمة
                profitRecord: null,
            });
        });

        // ✅ إضافة الطلبات المدفوعة (settled) وبدون ربح (no_rule_settled) من جدول profits مباشرة
        const settledProfits = profits?.filter(p => {
            const profitDate = p.settled_at ? parseISO(p.settled_at) : (p.created_at ? parseISO(p.created_at) : null);
            const isSettledOrNoRule = p.status === 'settled' || p.status === 'no_rule_settled';
            const inDateRange = profitDate && isValid(profitDate) && profitDate >= from && profitDate <= to;
            return isSettledOrNoRule && inDateRange;
        }) || [];

        settledProfits.forEach(profitRecord => {
            // تجنب التكرار - فحص إذا كان الطلب موجود مسبقاً
            if (detailedProfits.some(p => p.id === profitRecord.order_id)) return;

            const order = orders?.find(o => o.id === profitRecord.order_id);
            const orderCreator = allUsers?.find(u => 
                u.user_id === profitRecord.employee_id || u.id === profitRecord.employee_id
            );
            if (!orderCreator) return;

            detailedProfits.push({
                ...(order || {}),
                id: profitRecord.order_id,
                tracking_number: order?.tracking_number || profitRecord.tracking_number,
                order_number: order?.order_number || profitRecord.order_number,
                profit: profitRecord.employee_profit || 0,
                managerProfitShare: (profitRecord.profit_amount || 0) - (profitRecord.employee_profit || 0),
                employeeName: orderCreator.full_name,
                profitStatus: profitRecord.status, // استخدام الحالة الفعلية (settled أو no_rule_settled)
                profitRecord,
                created_by: profitRecord.employee_id,
                settled_at: profitRecord.settled_at,
                created_at: order?.created_at || profitRecord.created_at,
            });
        });

        // حساب الأرباح من الموظفين للمدير
        const managerProfitFromEmployees = detailedProfits.filter(p => {
            const pUser = allUsers.find(u => u.id === p.created_by);
            return pUser && (pUser.role === 'employee' || pUser.role === 'deputy');
        }).reduce((sum, p) => sum + p.managerProfitShare, 0);
        
        // حساب النفقات العامة
        const expensesInPeriod = canViewAll ? (accounting.expenses || []).filter(e => {
            const expenseDate = e.transaction_date ? parseISO(e.transaction_date) : null;
            return expenseDate && isValid(expenseDate) && expenseDate >= from && expenseDate <= to;
        }) : [];

        console.log('🔍 [DEBUG] فحص المصاريف في ملخص الأرباح:', {
            totalExpenses: expensesInPeriod.length,
            expensesInPeriod: expensesInPeriod.map(e => ({
                id: e.id,
                category: e.category,
                expense_type: e.expense_type,
                amount: e.amount,
                description: e.description
            }))
        });

        const generalExpenses = expensesInPeriod.filter(e => {
            // استبعاد جميع المصاريف النظامية
            if (e.expense_type === 'system') {
                console.log('🚫 [DEBUG] استبعاد مصروف نظامي:', e.category, e.amount);
                return false;
            }
            // استبعاد مستحقات الموظفين من أي حقل
            if (
                e.category === 'مستحقات الموظفين' ||
                e.related_data?.category === 'مستحقات الموظفين' ||
                e.metadata?.category === 'مستحقات الموظفين'
            ) {
                console.log('🚫 [DEBUG] استبعاد مستحقات موظفين:', e.amount);
                return false;
            }
            // استبعاد مصاريف الشراء المرتبطة بالمشتريات من أي حقل
            if (
                e.related_data?.category === 'شراء بضاعة' ||
                e.metadata?.category === 'شراء بضاعة'
            ) {
                console.log('🚫 [DEBUG] استبعاد مصاريف شراء:', e.amount);
                return false;
            }
            return true;
        }).reduce((sum, e) => sum + e.amount, 0);

        console.log('📊 [DEBUG] النتائج في ملخص الأرباح:', { generalExpenses });

        const employeeSettledDues = expensesInPeriod.filter(e => {
            const isEmployeeDue = (
                e.category === 'مستحقات الموظفين' ||
                e.related_data?.category === 'مستحقات الموظفين' ||
                e.metadata?.category === 'مستحقات الموظفين'
            );
            const isApproved = e.status ? e.status === 'approved' : true;
            return isApproved && isEmployeeDue;
        }).reduce((sum, e) => sum + e.amount, 0);

        const totalExpenses = generalExpenses + employeeSettledDues;

        // استخدام البيانات الموحدة لصافي الربح والإيرادات
        const totalRevenue = unifiedProfitData?.totalRevenue || 0;
        const deliveryFees = unifiedProfitData?.deliveryFees || 0;
        const salesWithoutDelivery = unifiedProfitData?.salesWithoutDelivery || 0;
        const cogs = unifiedProfitData?.cogs || 0;
        const grossProfit = unifiedProfitData?.grossProfit || 0;
        const netProfit = unifiedProfitData?.netProfit || 0;

        // حساب أرباح المدير الشخصية من طلباته الخاصة
        const personalProfits = detailedProfits.filter(p => p.created_by === getUserUUID(user));
        const totalPersonalProfit = personalProfits.reduce((sum, p) => sum + p.profit, 0);
      
        // حساب أرباح المدير الشخصية المعلقة فقط (من طلباته الخاصة)
        const personalPendingProfit = personalProfits
            .filter(p => isPendingStatus(p.profitStatus || 'pending'))
            .reduce((sum, p) => sum + p.profit, 0);

        const personalSettledProfit = personalProfits
            .filter(p => p.profitStatus === 'settled')
            .reduce((sum, p) => sum + p.profit, 0);

        const totalSettledDues = settlementInvoices?.filter(inv => {
            const invDate = parseISO(inv.settlement_date);
            return isValid(invDate) && invDate >= from && invDate <= to;
        }).reduce((sum, inv) => sum + inv.total_amount, 0) || 0;
        
        console.log('📊 نتائج الحساب:', {
            deliveredOrdersCount: deliveredOrders.length,
            pendingOrdersCount: pendingDeliveredOrders.length,
            detailedProfitsCount: detailedProfits.length,
            managerProfitFromEmployees,
            totalRevenue,
            netProfit,
            totalPersonalProfit,
            personalPendingProfit,
            personalSettledProfit,
            detailedProfitsSample: detailedProfits.slice(0, 2)
        });
        
        return { 
            managerProfitFromEmployees, 
            detailedProfits, 
            totalExpenses,
            totalPersonalProfit,
            personalPendingProfit,
            personalSettledProfit,
            totalSettledDues,
            // استخدام البيانات الموحدة بدلاً من الحساب المحلي
            netProfit: unifiedProfitData?.netProfit || 0,
            totalRevenue: unifiedProfitData?.totalRevenue || 0,
            deliveryFees: unifiedProfitData?.deliveryFees || 0,
            salesWithoutDelivery: unifiedProfitData?.salesWithoutDelivery || 0,
            cogs: unifiedProfitData?.cogs || 0,
            grossProfit: unifiedProfitData?.grossProfit || 0,
            generalExpenses: unifiedProfitData?.generalExpenses || 0,
            employeeSettledDues,
            generalExpensesFiltered: expensesInPeriod.filter(e => {
                if (e.expense_type === 'system') return false;
                if (e.category === 'مستحقات الموظفين') return false;
                if (e.related_data?.category === 'شراء بضاعة') return false;
                return true;
            })
        };
    }, [orders, allUsers, calculateProfit, dateRange, accounting.expenses, user.user_id, user.id, canViewAll, settlementInvoices, calculateManagerProfit, profits, unifiedProfitData]);

  const filteredDetailedProfits = useMemo(() => {
    // Add null safety check
    if (!profitData?.detailedProfits) {
      return [];
    }
    
    let filtered = profitData.detailedProfits;
    
        // إذا لم يكن المستخدم مدير، يرى أرباحه فقط
        if (!canViewAll) {
            filtered = filtered.filter(p => p.created_by === user?.user_id || p.created_by === user?.id);
        } else if (filters.employeeId !== 'all') {
      if (filters.employeeId === 'employees') {
        filtered = filtered.filter(p => {
            const pUser = allUsers?.find(u => u.id === p.created_by);
            return pUser && (pUser.role === 'employee' || pUser.role === 'deputy');
        });
      } else {
        filtered = filtered.filter(p => p.created_by === filters.employeeId);
      }
    }
    
    if (filters.profitStatus !== 'all') {
      if (filters.profitStatus === 'not_settled') {
        // عرض كل ما ليس مدفوع (pending + invoice_received + settlement_requested)
        // استثناء settled و no_rule_settled (الطلبات بدون ربح لا تحتاج تحاسب)
        filtered = filtered.filter(p => {
          const status = p.profitStatus || 'pending';
          return status !== 'settled' && status !== 'no_rule_settled';
        });
      } else {
        filtered = filtered.filter(p => (p.profitStatus || 'pending') === filters.profitStatus);
      }
    }

    return filtered;
  }, [profitData?.detailedProfits, filters, canViewAll, user?.user_id, user?.id, allUsers]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredDetailedProfits.length / ITEMS_PER_PAGE);
  const paginatedProfits = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredDetailedProfits.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredDetailedProfits, currentPage, ITEMS_PER_PAGE]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, periodFilter]);

  console.log('📋 بيانات مفلترة:', {
    canViewAll,
    canRequestSettlement,
    filteredCount: filteredDetailedProfits.length,
    filters,
    showCheckbox: canRequestSettlement,
    totalProfitData: profitData,
    userPermissions: Object.keys(user || {}).filter(k => user[k] === true),
    filteredSample: filteredDetailedProfits.slice(0, 2),
    allDetailedProfits: profitData?.detailedProfits?.length
  });

  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    if (key === 'profitStatus' && value !== 'pending') {
        setSelectedOrders([]);
    }
  }, []);

  const handleViewOrder = (order) => {
    setSelectedOrder(order);
    setDialogs(d => ({ ...d, details: true }));
  };
  
  const handleViewInvoice = (invoiceId) => {
    if (!invoiceId) return;

    const invoice = settlementInvoices?.find(inv => inv.id === invoiceId);
    if (invoice) {
        setSelectedInvoice(invoice);
        setDialogs(d => ({ ...d, invoice: true }));
    }
  };

  const handleRequestSettlement = async () => {
    if (selectedOrders.length === 0) {
        toast({ title: "خطأ", description: "الرجاء تحديد طلب واحد على الأقل للمحاسبة.", variant: "destructive" });
        return;
    }
    
    setIsRequesting(true);
    
    try {
      console.log('🔄 بدء عملية طلب التحاسب...');
      
      // التحقق من حالة المصادقة أولاً
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.error('❌ مشكلة في الجلسة:', sessionError);
        throw new Error('انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى');
      }

      console.log('✅ الجلسة صالحة، تحديث البيانات...');
      
      // تحديث البيانات أولاً مع retry - التحقق من وجود الدالة
      if (typeof refreshProfits === 'function') {
        await refreshProfits();
      }
      
      console.log('✅ تم تحديث البيانات، إرسال طلب التحاسب...');
      
      // استخراج معرفات الطلبات من الأرباح المحددة - تصحيح المقارنة
      const selectedProfits = filteredDetailedProfits.filter(p => selectedOrders.includes(p.id));
      const orderIds = selectedOrders; // استخدام selectedOrders مباشرة لأنها تحتوي على order IDs بالفعل
      
      const amountToSettle = selectedProfits.reduce((sum, p) => sum + p.profit, 0);

      console.log('🏦 طلب التحاسب:', {
        selectedOrdersCount: selectedOrders.length,
        selectedProfitsCount: selectedProfits.length,
        orderIds,
        amountToSettle,
        userId: user?.user_id || user?.id
      });

      if (orderIds.length > 0) {
        // استخدام النظام الجديد للتحاسب مع جلب البيانات المحدثة
        const result = await createSettlementRequest(orderIds, '');
        
        // التحقق من النتيجة بشكل صحيح
        if (result?.success === true) {
          setSelectedOrders([]);
          // لا حاجة لتوست إضافي لأن createSettlementRequest يرسل توست بالفعل
        } else if (result?.success === false) {
          // فشل مع رسالة - عرض الرسالة بدون مسح التحديد
          toast({
            title: "تنبيه",
            description: result.message || "بعض الطلبات غير مؤهلة للتحاسب",
            variant: "destructive"
          });
        } else if (result === null) {
          // خطأ عام - التوست يُرسل من createSettlementRequest
          console.log('⚠️ createSettlementRequest returned null');
        }
      } else {
        throw new Error('لا توجد طلبات صالحة للتحاسب');
      }
    } catch (error) {
      console.error('❌ خطأ في طلب التحاسب:', error);
      
      // رسائل خطأ مخصصة
      let errorMessage = "حدث خطأ غير متوقع";
      if (error.message?.includes('JWT') || error.message?.includes('انتهت صلاحية')) {
        errorMessage = "انتهت صلاحية الجلسة، يرجى تحديث الصفحة وتسجيل الدخول مرة أخرى";
      } else if (error.message?.includes('غير مؤهلة')) {
        errorMessage = error.message;
      } else if (error.message?.includes('فشل في جلب')) {
        errorMessage = "فشل في الاتصال بقاعدة البيانات، يرجى المحاولة مرة أخرى";
      }
      
      toast({
          title: "خطأ في طلب التحاسب", 
          description: errorMessage, 
          variant: "destructive" 
        });
    } finally {
      setIsRequesting(false);
    }
  };

  const handleSelectOrder = (orderId) => {
    setSelectedOrders(prev => 
        prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };

  const handleSelectAll = (checked) => {
    if (checked) {
        // تضمين الطلبات المؤهلة للتحاسب (فاتورة مستلمة أو طلب تحاسب معلق)
        setSelectedOrders(filteredDetailedProfits.filter(p => {
            const status = p.profitStatus || 'pending';
            return status === 'invoice_received' || status === 'settlement_requested';
        }).map(p => p.id));
    } else {
        setSelectedOrders([]);
    }
  };

  const handleSettleSelected = () => {
      const employeeIds = new Set(selectedOrders.map(id => filteredDetailedProfits.find(o => o.id === id)?.created_by));
      if (employeeIds.size > 1) {
          toast({ title: "خطأ", description: "لا يمكن تسوية أرباح عدة موظفين في نفس الوقت.", variant: "destructive" });
          return;
      }
      const employeeId = employeeIds.values().next().value;
      if (!employeeId) {
           toast({ title: "خطأ", description: "لم يتم العثور على الموظف للطلبات المحددة.", variant: "destructive" });
           return;
      }
      // التوجيه لصفحة متابعة الموظفين مع تحديد البيانات
      navigate(`/employee-follow-up?employee=${employeeId}&orders=${selectedOrders.join(',')}&highlight=settlement`);
  };

  const handleArchiveSelected = async () => {
      for (const orderId of selectedOrders) {
          await updateOrder(orderId, { isArchived: true });
      }
      toast({ title: "تم الأرشفة بنجاح", description: `تم أرشفة ${selectedOrders.length} طلبات بنجاح.` });
      setSelectedOrders([]);
  };

  const handleDeleteSelected = async () => {
      await deleteOrders(selectedOrders);
      setSelectedOrders([]);
  };

  const handleMarkReceived = async (orderId) => {
    await markInvoiceReceived(orderId);
  };

  // معالجات الكروت الجديدة للموظف
  const handleEmployeeReceivedClick = () => {
    setDialogs(d => ({ ...d, employeeReceived: true }));
  };

  const handlePendingProfitsClick = () => {
    // فلترة الأرباح المعلقة مباشرة
    setFilters(prev => ({ ...prev, profitStatus: 'pending' }));
  };

  const handleArchiveClick = () => {
    // فلترة الطلبات المؤرشفة أو المدفوعة
    setFilters(prev => ({ ...prev, profitStatus: 'settled' }));
  };

  return (
    <>
      <Helmet>
        <title>ملخص الأرباح - نظام RYUS</title>
        <meta name="description" content="عرض وتحليل جميع أرباحك وأرباح الموظفين." />
      </Helmet>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold gradient-text">ملخص الأرباح</h1>
            {/* فلتر الفترة الزمنية - يطبق على كل الصفحة */}
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="اختر الفترة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">اليوم</SelectItem>
                <SelectItem value="week">هذا الأسبوع</SelectItem>
                <SelectItem value="month">هذا الشهر</SelectItem>
                <SelectItem value="year">هذه السنة</SelectItem>
                <SelectItem value="all">كل الفترات</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* عرض الإحصائيات مع دمج كارت أرباح المدير */}
        <div className="space-y-6">
          {/* الكروت الأساسية من ProfitStats مع كارت أرباح المدير وكارت الموظف */}
          {/* استخدام UnifiedProfitDisplay مباشرة مع الكروت الجديدة */}
          <UnifiedProfitDisplay
            profitData={profitData}
            unifiedProfitData={unifiedProfitData}
            displayMode="dashboard"
            canViewAll={canViewAll}
            onFilterChange={handleFilterChange}
            onExpensesClick={() => setDialogs(d => ({ ...d, expenses: true }))}
            onSettledDuesClick={() => setDialogs(d => ({ ...d, settledDues: true }))}
            onEmployeeReceivedClick={handleEmployeeReceivedClick}
            onPendingProfitsClick={handlePendingProfitsClick}
            onArchiveClick={handleArchiveClick}
            dateRange={dateRange}
            className="mb-6"
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
                orders={paginatedProfits}
                canViewAll={canViewAll}
                canRequestSettlement={canRequestSettlement}
                selectedOrders={selectedOrders}
                onSelectOrder={handleSelectOrder}
                onViewOrder={handleViewOrder}
                onMarkReceived={handleMarkReceived}
              />
            ) : (
             <ProfitDetailsTable
                orders={paginatedProfits}
                canViewAll={canViewAll}
                canRequestSettlement={canRequestSettlement}
                selectedOrders={selectedOrders}
                onSelectOrder={handleSelectOrder}
                onSelectAll={handleSelectAll}
                onViewOrder={handleViewOrder}
                onViewInvoice={handleViewInvoice}
                onMarkReceived={handleMarkReceived}
             />
            )}
            
            {/* Pagination */}
            {totalPages > 1 && (
              <SmartPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={filteredDetailedProfits.length}
                itemsPerPage={ITEMS_PER_PAGE}
                className="mt-6"
              />
            )}
          </CardContent>
        </Card>
      </div>
      <OrderDetailsDialog order={selectedOrder} open={dialogs.details} onOpenChange={(open) => setDialogs(d => ({...d, details: open}))} canEditStatus={false} />
      
      <SettlementInvoiceDialog 
        invoice={selectedInvoice} 
        open={dialogs.invoice} 
        onOpenChange={(open) => setDialogs(d => ({...d, invoice: open}))} 
        allUsers={allUsers}
      />

      {canViewAll && (
        <>
          <ExpensesDialog 
            open={dialogs.expenses}
            onOpenChange={(open) => setDialogs(d => ({...d, expenses: open}))}
            expenses={profitData.generalExpensesFiltered || []}
            addExpense={addExpense}
            deleteExpense={deleteExpense}
          />
          <UnifiedSettledDuesDialog
            open={dialogs.settledDues}
            onOpenChange={(open) => setDialogs(d => ({...d, settledDues: open}))}
            invoices={settlementInvoices}
            allUsers={allUsers}
          />
        </>
      )}
      
      {/* نافذة الأرباح المستلمة للموظف */}
      {!canViewAll && (
        <EmployeeReceivedProfitsDialog
          isOpen={dialogs.employeeReceived}
          onClose={() => setDialogs(d => ({ ...d, employeeReceived: false }))}
          allUsers={allUsers}
        />
      )}
    </>
  );
};

export default ProfitsSummaryPage;