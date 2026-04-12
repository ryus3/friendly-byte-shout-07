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
  TrendingUp,
  Archive,
  CreditCard,
  HandCoins,
  FolderArchive
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
  unifiedProfitData,
  displayMode = 'dashboard', // 'dashboard' | 'financial-center'
  canViewAll = true,
  onFilterChange = () => {},
  onExpensesClick = () => {},
  onSettledDuesClick = () => {},
  onManagerProfitsClick = () => {}, // إضافة handler لنافذة أرباح المدير
  onEmployeeReceivedClick = () => {}, // إضافة handler للأرباح المستلمة للموظف
  onPendingProfitsClick = () => {}, // إضافة handler للأرباح المعلقة
  onArchiveClick = () => {}, // إضافة handler للأرشيف
  className = '',
  datePeriod = 'month', // إضافة فترة التاريخ
  dateRange = null // تمرير نطاق التاريخ مباشرة
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

  // حساب النطاق الزمني بناءً على datePeriod أو استخدام النطاق الممرر مباشرة
  const effectiveDateRange = useMemo(() => {
    if (dateRange) return dateRange; // استخدام النطاق الممرر مباشرة
    
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
  }, [datePeriod, dateRange]);

  // حساب البيانات المالية - تحسين جذري للحسابات
  const unifiedFinancialData = useMemo(() => {
    if (!orders || !Array.isArray(orders)) {
      return {
        totalRevenue: 0, cogs: 0, grossProfit: 0, netProfit: 0,
        systemProfit: 0, generalExpenses: 0, managerProfitFromEmployees: 0,
        totalEmployeeProfits: 0, personalTotalProfit: 0, personalSettledProfit: 0,
        archivedOrdersCount: 0, personalPendingProfit: 0
      };
    }

    const safeOrders = Array.isArray(orders) ? orders : [];
    const safeExpenses = Array.isArray(accounting?.expenses) ? accounting.expenses : [];
    
    const filterByDate = (itemDateStr) => {
      if (!effectiveDateRange.from || !effectiveDateRange.to || !itemDateStr) return true;
      try {
        const itemDate = parseISO(itemDateStr);
        return isValid(itemDate) && itemDate >= effectiveDateRange.from && itemDate <= effectiveDateRange.to;
      } catch (e) {
        return false;
      }
    };
    
    // الطلبات المُستلمة الفواتير فقط
    const deliveredOrders = safeOrders.filter(o => 
      o && (o.status === 'delivered' || o.status === 'completed') && 
      o.receipt_received === true && 
      filterByDate(o.updated_at || o.created_at)
    );

    // حساب البيانات الشخصية للموظف
    let personalData = {
      personalTotalProfit: 0,
      personalSettledProfit: 0,
      personalPendingProfit: 0,
      archivedOrdersCount: 0
    };

    if (!canViewAll && currentUser?.id) {
      // طلبات الموظف المكتملة
      const userDeliveredOrders = deliveredOrders.filter(o => o.created_by === currentUser.id);
      
      // حساب الأرباح الشخصية من جدول profits
      const userProfits = allProfits.filter(p => p.employee_id === currentUser.id);
      
      personalData.personalTotalProfit = userProfits.reduce((sum, p) => sum + (p.employee_profit || 0), 0);
      
      // الأرباح المستلمة (المسواة)
      personalData.personalSettledProfit = userProfits
        .filter(p => p.status === 'settled')
        .reduce((sum, p) => sum + (p.employee_profit || 0), 0);
      
      // الأرباح المعلقة - تشمل كل الحالات غير المستلمة
      personalData.personalPendingProfit = userProfits
        .filter(p => ['pending', 'invoice_received', 'settlement_requested'].includes(p.status))
        .reduce((sum, p) => sum + (p.employee_profit || 0), 0);
      
      // الطلبات المؤرشفة للموظف = المدفوعة (settled) + بدون ربح (no_rule_settled)
      const userArchivedCount = safeOrders.filter(o => {
        if (o.created_by !== currentUser.id) return false;
        
        // الطلبات المدفوعة أو بدون ربح
        const profitRecord = allProfits.find(p => p.order_id === o.id);
        const hasSettledProfit = profitRecord?.status === 'settled';
        const hasNoRuleSettled = profitRecord?.status === 'no_rule_settled';
        
        // التحقق من تاريخ النطاق المحدد
        const orderDate = o.updated_at || o.created_at;
        const isInDateRange = orderDate ? filterByDate(orderDate) : true;
        
        return (hasSettledProfit || hasNoRuleSettled) && isInDateRange;
      }).length;
      
      personalData.archivedOrdersCount = userArchivedCount;

      console.log('📊 البيانات الشخصية للموظف:', {
        userId: currentUser.id,
        userProfitsCount: userProfits.length,
        personalTotalProfit: personalData.personalTotalProfit,
        personalSettledProfit: personalData.personalSettledProfit,
        personalPendingProfit: personalData.personalPendingProfit,
        archivedOrdersCount: personalData.archivedOrdersCount,
        userDeliveredOrdersCount: userDeliveredOrders.length
      });
    }
    
    const expensesInRange = safeExpenses.filter(e => filterByDate(e.transaction_date));
    
    // حساب إجمالي الإيرادات
    const salesSum = deliveredOrders.reduce((sum, o) => {
      const sales = (o.sales_amount != null)
        ? (Number(o.sales_amount) || 0)
        : (Number(o.final_amount || o.total_amount || 0) - Number(o.delivery_fee || 0));
      return sum + sales;
    }, 0);
    const totalRevenue = salesSum;
    
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
    const salesWithoutDelivery = salesSum;
    const grossProfit = salesWithoutDelivery - cogs;
    
    // حساب ربح النظام (نفس منطق AccountingPage)
    const managerOrdersInRange = deliveredOrders.filter(o => !o.created_by || o.created_by === currentUser?.id);
    const employeeOrdersInRange = deliveredOrders.filter(o => o.created_by && o.created_by !== currentUser?.id);
    
    const managerTotalProfit = managerOrdersInRange.reduce((sum, order) => {
      const orderProfit = (order.items || []).reduce((itemSum, item) => {
        const sellPrice = item.unit_price || item.price || 0;
        const costPrice = item.product_variants?.cost_price || item.products?.cost_price || 0;
        return itemSum + ((sellPrice - costPrice) * item.quantity);
      }, 0);
      return sum + orderProfit;
    }, 0);
    
    // حساب ربح النظام من طلبات الموظفين
    const employeeSystemProfit = employeeOrdersInRange.reduce((sum, order) => {
      return sum + getSystemProfitFromOrder(order.id, allProfits);
    }, 0);
    
    const systemProfit = managerTotalProfit + employeeSystemProfit;
    
    // المصاريف العامة (استبعاد المصاريف النظامية ومستحقات الموظفين والمحذوفة/الملغاة)
    const generalExpensesGross = expensesInRange.filter(e => {
      const isSystem = e.expense_type === 'system';
      const isEmployeeDue = (
        e.category === 'مستحقات الموظفين' ||
        e.related_data?.category === 'مستحقات الموظفين' ||
        e.metadata?.category === 'مستحقات الموظفين'
      );
      const isPurchaseRelated = (
        e.related_data?.category === 'شراء بضاعة' ||
        e.metadata?.category === 'شراء بضاعة'
      );
      if (isSystem) return false;
      if (isEmployeeDue) return false;
      if (isPurchaseRelated) return false;
      if (e.status && ['deleted', 'cancelled', 'refunded'].includes(e.status)) return false;
      if (e.status && e.status !== 'approved') return false;
      return true;
    }).reduce((sum, e) => sum + (e.amount || 0), 0);
    
    // خصم إرجاعات المصاريف المحذوفة من حركات النقد
    const expenseRefunds = (cashMovements || []).filter(m =>
      m.movement_type === 'in' && m.reference_type === 'expense_refund' && filterByDate(m.created_at)
    ).reduce((sum, m) => sum + Number(m.amount || 0), 0);
    const generalExpenses = Math.max(0, generalExpensesGross - expenseRefunds);
    
    // صافي الربح = من النظام الموحد فقط - بدون أي حسابات تقليدية احتياطية
    const netProfit = unifiedProfitData?.netProfit || 0;
    
    // حساب أرباح الموظفين
    const totalEmployeeProfits = allProfits
      .filter(p => deliveredOrders.some(o => o.id === p.order_id))
      .reduce((sum, p) => sum + (p.employee_profit || 0), 0);
    
    // المستحقات المدفوعة - نفس منطق متابعة الموظفين (من المصاريف المحاسبية)
    const totalSettledDues = expensesInRange
      .filter(expense => {
        const isEmployeeDue = (
          expense.category === 'مستحقات الموظفين' ||
          expense.related_data?.category === 'مستحقات الموظفين' ||
          expense.metadata?.category === 'مستحقات الموظفين'
        );
        const isApproved = expense.status ? expense.status === 'approved' : true;
        return isApproved && isEmployeeDue;
      })
      .reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
    
    console.log('💰 UnifiedProfitDisplay - البيانات المحسوبة:', {
      totalRevenue,
      cogs,
      grossProfit,
      systemProfit,
      generalExpenses,
      netProfit,
      totalEmployeeProfits,
      deliveredOrdersCount: deliveredOrders.length,
      expensesCount: expensesInRange.length
    });
    
    return {
      totalRevenue,
      cogs,
      grossProfit,
      systemProfit,
      generalExpenses,
      netProfit,
      managerProfitFromEmployees: systemProfit,
      totalEmployeeProfits,
      totalSettledDues,
      deliveredOrders, // إضافة الطلبات المستلمة للاستخدام في buildCards
      ...personalData // إضافة البيانات الشخصية للموظف
    };
  }, [orders, accounting, allProfits, effectiveDateRange, currentUser, settlementInvoices]);

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
          // في لوحة التحكم: عرض شامل (بدون كارت أرباح المدير من الموظفين - سيكون منفصل)
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
      // للموظف: البيانات الشخصية فقط مع ترتيب جديد
      cards.push(
        {
          key: 'my-total-profit',
          title: 'إجمالي أرباحي',
          value: profitData.totalPersonalProfit || 0,
          icon: User,
          colors: ['green-500', 'emerald-500'],
          format: 'currency'
        },
        {
          key: 'my-received-profits',
          title: 'أرباحي المستلمة',
          value: profitData.personalSettledProfit || unifiedFinancialData.personalSettledProfit || 0,
          icon: HandCoins, // أيقونة جميلة للأرباح المستلمة
          colors: ['sky-500', 'blue-500'], // لون سمائي بدلاً من المتدرج
          format: 'currency',
          onClick: onEmployeeReceivedClick
        }
      );
    }

    // إضافة بطاقة الأرباح المعلقة فقط للجميع - حساب صحيح بدون تضاعف
    if (canViewAll) {
      // الأرباح المعلقة من جدول profits (للطلبات المسلمة مع فواتير مستلمة)
      const pendingProfitsFromTable = allProfits
        .filter(p => {
          const isInDateRange = unifiedFinancialData.deliveredOrders?.some(o => o.id === p.order_id) || false;
          return p.status === 'pending' && isInDateRange;
        })
        .reduce((sum, p) => sum + (p.employee_profit || 0), 0);

      console.log('🔍 الأرباح المعلقة الصحيحة:', {
        pendingProfitsFromTable,
        deliveredOrdersCount: unifiedFinancialData.deliveredOrders?.length || 0,
        pendingProfitsCount: allProfits.filter(p => p.status === 'pending').length
      });

      cards.push({
        key: 'pending-profit',
        title: 'الأرباح المعلقة',
        value: pendingProfitsFromTable,
        icon: Hourglass,
        colors: ['yellow-500', 'amber-500'],
        format: 'currency',
        onClick: () => onFilterChange('profitStatus', 'pending')
      });
    } else {
      // للموظف: ترتيب الكروت - المعلقة ثم الأرشيف
      cards.push(
        {
          key: 'my-pending-profit',
          title: 'أرباحي المعلقة',
          value: profitData.personalPendingProfit || 0,
          icon: Hourglass,
          colors: ['yellow-500', 'amber-500'],
          format: 'currency',
          onClick: onPendingProfitsClick // إضافة إمكانية النقر للفلترة
        },
        {
          key: 'archived-profits',
          title: 'الأرشيف',
          value: profitData.archivedOrdersCount || unifiedFinancialData.archivedOrdersCount || 0, // عرض رقم حقيقي
          icon: FolderArchive,
          colors: ['orange-500', 'red-500'], // نفس لون أرشيف المدير
          format: 'number',
          onClick: onArchiveClick,
          description: 'الطلبات المدفوعة'
        }
      );
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