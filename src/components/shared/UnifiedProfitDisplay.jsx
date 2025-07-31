import React, { useState, useEffect, useMemo } from 'react';
import StatCard from '@/components/dashboard/StatCard';
import { useAdvancedProfitsAnalysis } from '@/hooks/useAdvancedProfitsAnalysis';
import { startOfMonth, endOfMonth, parseISO, isValid } from 'date-fns';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { 
  User, 
  Hourglass, 
  CheckCircle, 
  Users, 
  TrendingDown, 
  PackageCheck,
  Wallet,
  TrendingUp
} from 'lucide-react';

/**
 * عنصر موحد لعرض بيانات الأرباح
 * يمكن استخدامه في لوحة التحكم والمركز المالي بتصاميم مختلفة
 */
// دالة للحصول على ربح النظام من جدول الأرباح
const getSystemProfitFromOrder = (orderId, allProfits) => {
  const orderProfits = allProfits?.find(p => p.order_id === orderId);
  if (!orderProfits) return 0;
  return (orderProfits.profit_amount || 0) - (orderProfits.employee_profit || 0);
};

const UnifiedProfitDisplay = ({
  profitData,
  displayMode = 'dashboard', // 'dashboard' | 'financial-center'
  canViewAll = true,
  onFilterChange = () => {},
  onExpensesClick = () => {},
  onSettledDuesClick = () => {},
  onManagerProfitsClick = () => {}, // إضافة handler لنافذة أرباح المدير من الموظفين
  className = '',
  datePeriod = 'month' // إضافة فترة التاريخ
}) => {
  const { orders, accounting } = useInventory();
  const { user: currentUser } = useAuth();
  const [allProfits, setAllProfits] = useState([]);
  const [settlementInvoices, setSettlementInvoices] = useState([]);

  // جلب بيانات الأرباح وفواتير التسوية من قاعدة البيانات
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profitsResponse, invoicesResponse] = await Promise.all([
          supabase
            .from('profits')
            .select(`
              *,
              order:orders(order_number, status, receipt_received),
              employee:profiles!employee_id(full_name)
            `),
          supabase
            .from('settlement_invoices')
            .select('*')
        ]);
        
        setAllProfits(profitsResponse.data || []);
        setSettlementInvoices(invoicesResponse.data || []);
      } catch (error) {
        console.error('خطأ في جلب البيانات:', error);
      }
    };
    
    fetchData();
  }, []);

  // حساب النطاق الزمني بناءً على datePeriod
  const dateRange = useMemo(() => {
    const now = new Date();
    let from, to;
    
    switch (datePeriod) {
      case 'today':
        from = new Date(now.setHours(0, 0, 0, 0));
        to = new Date(now.setHours(23, 59, 59, 999));
        break;
      case 'week':
        from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        to = new Date();
        break;
      case 'month':
        from = startOfMonth(new Date());
        to = endOfMonth(new Date());
        break;
      case 'year':
        from = new Date(new Date().getFullYear(), 0, 1);
        to = new Date();
        break;
      default:
        from = startOfMonth(new Date());
        to = endOfMonth(new Date());
    }
    
    return { from, to };
  }, [datePeriod]);

  // حساب البيانات المالية باستخدام نفس منطق EmployeeFollowUpPage
  const unifiedFinancialData = useMemo(() => {
    if (!orders || !Array.isArray(orders)) {
      return {
        totalRevenue: 0, cogs: 0, grossProfit: 0, netProfit: 0,
        systemProfit: 0, generalExpenses: 0, managerProfitFromEmployees: 0,
        totalEmployeeProfits: 0
      };
    }

    const safeOrders = Array.isArray(orders) ? orders : [];
    const safeExpenses = Array.isArray(accounting?.expenses) ? accounting.expenses : [];
    
    const filterByDate = (itemDateStr) => {
      if (!dateRange.from || !dateRange.to || !itemDateStr) return true;
      try {
        const itemDate = parseISO(itemDateStr);
        return isValid(itemDate) && itemDate >= dateRange.from && itemDate <= dateRange.to;
      } catch (e) {
        return false;
      }
    };
    
    // معرف المدير الرئيسي - تصفية طلباته
    const ADMIN_ID = '91484496-b887-44f7-9e5d-be9db5567604';

    // الطلبات المفلترة (نفس منطق EmployeeFollowUpPage)
    const filteredOrders = safeOrders.filter(order => {
      if (!order) return false;
      
      // استبعاد طلبات المدير الرئيسي
      if (order.created_by === ADMIN_ID) return false;
      
      // فلترة التاريخ
      const orderDate = order.created_at ? parseISO(order.created_at) : null;
      if (!filterByDate(order.created_at)) return false;
      
      return true;
    });

    // الطلبات المسلمة فقط
    const deliveredOrders = filteredOrders.filter(order => 
      (order.status === 'delivered' || order.status === 'completed') && 
      order.receipt_received === true
    );
    
    // حساب إجمالي المبيعات (نفس منطق EmployeeFollowUpPage)
    const totalSales = deliveredOrders.reduce((sum, order) => {
      return sum + (order.final_amount || order.total_amount || 0);
    }, 0);

    // حساب أرباح المدير من الموظفين (نفس منطق EmployeeFollowUpPage)
    const managerProfitFromEmployees = deliveredOrders.reduce((sum, order) => {
      // البحث عن سجل الربح
      const profitRecord = allProfits?.find(p => p.order_id === order.id);
      
      if (profitRecord) {
        // ربح النظام = إجمالي الربح - ربح الموظف
        const systemProfit = (profitRecord.profit_amount || 0) - (profitRecord.employee_profit || 0);
        return sum + systemProfit;
      }
      return sum;
    }, 0);

    // المصاريف العامة (نفس منطق EmployeeFollowUpPage)
    const expensesInRange = safeExpenses.filter(e => filterByDate(e.transaction_date));
    const generalExpenses = expensesInRange.filter(e => {
      if (e.expense_type === 'system') return false;
      if (e.category === 'مستحقات الموظفين') return false;
      if (e.related_data?.category === 'شراء بضاعة') return false;
      if (e.related_data?.type === 'employee_settlement') return false;
      if (e.related_data?.type === 'purchase') return false;
      return true;
    }).reduce((sum, e) => sum + (e.amount || 0), 0);

    // المستحقات المدفوعة (نفس منطق EmployeeFollowUpPage)
    const totalSettledDues = expensesInRange
      .filter(expense => 
        expense.category === 'مستحقات الموظفين' && 
        expense.expense_type === 'system' && 
        expense.status === 'approved'
      )
      .reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);

    // حساب تكلفة البضاعة المباعة
    const cogs = deliveredOrders.reduce((sum, o) => {
      if (!o.order_items || !Array.isArray(o.order_items)) return sum;
      
      const orderCogs = o.order_items.reduce((itemSum, item) => {
        const costPrice = item.product_variants?.cost_price || item.products?.cost_price || 0;
        const quantity = item.quantity || 0;
        return itemSum + (costPrice * quantity);
      }, 0);
      return sum + orderCogs;
    }, 0);

    const deliveryFees = deliveredOrders.reduce((sum, o) => sum + (o.delivery_fee || 0), 0);
    const salesWithoutDelivery = totalSales - deliveryFees;
    const grossProfit = salesWithoutDelivery - cogs;
    
    // صافي الربح = ربح النظام - المصاريف العامة
    const netProfit = managerProfitFromEmployees - generalExpenses;

    // حساب أرباح الموظفين
    const totalEmployeeProfits = allProfits
      .filter(p => deliveredOrders.some(o => o.id === p.order_id))
      .reduce((sum, p) => sum + (p.employee_profit || 0), 0);

    console.log('💰 UnifiedProfitDisplay - البيانات المحسوبة (نفس منطق EmployeeFollowUpPage):', {
      filteredOrdersCount: filteredOrders.length,
      deliveredOrdersCount: deliveredOrders.length,
      totalSales,
      managerProfitFromEmployees,
      generalExpenses,
      netProfit,
      totalEmployeeProfits,
      totalSettledDues
    });
    
    return {
      totalRevenue: totalSales,
      cogs,
      grossProfit,
      systemProfit: managerProfitFromEmployees,
      generalExpenses,
      netProfit,
      managerProfitFromEmployees, // هذا هو الرقم الصحيح
      totalEmployeeProfits,
      totalSettledDues
    };
  }, [orders, accounting, allProfits, dateRange, currentUser, settlementInvoices]);

  // تحديد التصميم بناءً على المكان
  const getLayoutClasses = () => {
    if (displayMode === 'financial-center') {
      return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';
    }
    return canViewAll 
      ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6'
      : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6';
  };

  // بناء البطاقات للعرض باستخدام البيانات الموحدة
  const buildCards = () => {
    const cards = [];

    console.log('🔧 بناء كروت العرض (موحد):', { unifiedFinancialData, canViewAll, displayMode });

    if (canViewAll) {
      // للمدير: عرض بيانات النظام الكاملة
      if (displayMode === 'financial-center') {
        // في المركز المالي: التركيز على الجانب المالي
        cards.push(
          {
            key: 'net-system-profit',
            title: 'صافي ربح النظام',
            value: unifiedFinancialData.netProfit,
            icon: Wallet,
            colors: ['emerald-600', 'teal-600'],
            format: 'currency',
            description: 'بعد خصم المصاريف العامة'
          },
          {
            key: 'total-manager-profits',
            title: 'أرباح المؤسسة',
            value: unifiedFinancialData.managerProfitFromEmployees,
            icon: TrendingUp,
            colors: ['blue-600', 'indigo-600'],
            format: 'currency',
            description: 'قبل خصم المصاريف'
          },
          {
            key: 'total-employee-profits',
            title: 'أرباح الموظفين',
            value: unifiedFinancialData.totalEmployeeProfits,
            icon: Users,
            colors: ['purple-600', 'violet-600'],
            format: 'currency',
            onClick: () => onFilterChange('employeeId', 'employees')
          }
        );
      } else {
        // في لوحة التحكم: عرض شامل
        cards.push(
          {
            key: 'net-profit',
            title: 'صافي الربح',
            value: unifiedFinancialData.netProfit,
            icon: User,
            colors: ['green-500', 'emerald-500'],
            format: 'currency'
          },
          {
            key: 'manager-profit-from-employees',
            title: 'أرباحي من الموظفين',
            value: unifiedFinancialData.managerProfitFromEmployees,
            icon: Users,
            colors: ['indigo-500', 'violet-500'],
            format: 'currency',
            onClick: onManagerProfitsClick // استخدام الـ handler الجديد
          },
          {
            key: 'total-expenses',
            title: 'المصاريف العامة',
            value: unifiedFinancialData.generalExpenses,
            icon: TrendingDown,
            colors: ['red-500', 'orange-500'],
            format: 'currency',
            onClick: onExpensesClick
          },
          {
            key: 'total-settled-dues',
            title: 'المستحقات المدفوعة',
            value: unifiedFinancialData.totalSettledDues || profitData.totalSettledDues || 0,
            icon: PackageCheck,
            colors: ['purple-500', 'violet-500'],
            format: 'currency',
            onClick: onSettledDuesClick
          }
        );
      }
    } else {
      // للموظف: البيانات الشخصية فقط
      cards.push(
        {
          key: 'my-total-profit',
          title: 'إجمالي أرباحي',
          value: profitData.totalPersonalProfit || 0,
          icon: User,
          colors: ['green-500', 'emerald-500'],
          format: 'currency'
        }
      );
    }

    // إضافة بطاقة الأرباح المعلقة فقط للجميع
    if (canViewAll) {
      cards.push({
        key: 'pending-profit',
        title: 'الأرباح المعلقة',
        value: (profitData.detailedProfits || [])
          .filter(p => (p.profitStatus || 'pending') === 'pending')
          .reduce((sum, p) => sum + p.profit, 0),
        icon: Hourglass,
        colors: ['yellow-500', 'amber-500'],
        format: 'currency',
        onClick: () => onFilterChange('profitStatus', 'pending')
      });
    } else {
      cards.push({
        key: 'my-pending-profit',
        title: 'أرباحي المعلقة',
        value: profitData.personalPendingProfit || 0,
        icon: Hourglass,
        colors: ['yellow-500', 'amber-500'],
        format: 'currency'
      });
    }

    console.log('✅ تم بناء الكروت (موحد):', cards.map(c => ({ key: c.key, value: c.value })));
    return cards;
  };

  const cards = buildCards();

  return (
    <div className={`${getLayoutClasses()} ${className}`}>
      {cards.map(({ key, ...cardProps }) => (
        <StatCard 
          key={key} 
          {...cardProps}
          // إضافة ستايل خاص للمركز المالي
          className={displayMode === 'financial-center' ? 'financial-card' : ''}
        />
      ))}
    </div>
  );
};

export default UnifiedProfitDisplay;