/**
 * دوال الحسابات المالية الأساسية
 * تحتوي على جميع العمليات الحسابية المالية المعتمدة
 */

import { parseISO, isValid, startOfMonth, endOfMonth, startOfWeek, startOfYear, subDays } from 'date-fns';
import { 
  EXCLUDED_EXPENSE_TYPES, 
  VALID_ORDER_STATUSES, 
  FINANCIAL_FORMULAS,
  TIME_PERIODS,
  DEFAULT_FINANCIAL_VALUES
} from './financial-constants';

/**
 * حساب نطاق التاريخ بناءً على الفترة المحددة
 */
export const calculateDateRange = (timePeriod) => {
  const now = new Date();
  
  switch (timePeriod) {
    case TIME_PERIODS.TODAY:
      return { from: subDays(now, 1), to: now };
    case TIME_PERIODS.WEEK:
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: now };
    case TIME_PERIODS.MONTH:
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case TIME_PERIODS.YEAR:
      return { from: startOfYear(now), to: now };
    case TIME_PERIODS.ALL:
      return { from: null, to: null };
    default:
      return { from: startOfMonth(now), to: endOfMonth(now) };
  }
};

/**
 * فلترة البيانات حسب الفترة الزمنية
 */
export const filterByDateRange = (items, dateRange, dateField = 'created_at') => {
  if (!items || !Array.isArray(items)) return [];
  if (!dateRange?.from || !dateRange?.to) return items;
  
  return items.filter(item => {
    const itemDateStr = item[dateField];
    if (!itemDateStr) return false;
    
    try {
      const itemDate = parseISO(itemDateStr);
      return isValid(itemDate) && itemDate >= dateRange.from && itemDate <= dateRange.to;
    } catch (e) {
      return false;
    }
  });
};

/**
 * حساب إجمالي الإيرادات من الطلبات المستلمة (بدون أجور التوصيل كما في ORD000004)
 */
export const calculateTotalRevenue = (orders, dateRange) => {
  if (!orders || !Array.isArray(orders)) return 0;
  
  const deliveredOrders = orders.filter(order => 
    VALID_ORDER_STATUSES.includes(order.status) && order.receipt_received === true
  );
  
  const filteredOrders = filterByDateRange(deliveredOrders, dateRange, 'updated_at');
  
  return filteredOrders.reduce((sum, order) => {
    const finalAmount = order.final_amount || order.total_amount || 0;
    const deliveryFee = order.delivery_fee || 0;
    // الإيراد = المبلغ النهائي - أجور التوصيل (لتطبيق نفس آلية ORD000004 الناجح)
    return sum + (finalAmount - deliveryFee);
  }, 0);
};

/**
 * حساب رسوم التوصيل - استبعاد طلبات الوسيط من الحسابات
 */
export const calculateDeliveryFees = (orders, dateRange) => {
  if (!orders || !Array.isArray(orders)) return 0;
  
  const deliveredOrders = orders.filter(order => 
    VALID_ORDER_STATUSES.includes(order.status) && 
    order.receipt_received === true &&
    // استبعاد طلبات الوسيط من حساب رسوم التوصيل (لأنها تُحسب في الفاتورة)
    order.delivery_partner !== 'alwaseet'
  );
  
  const filteredOrders = filterByDateRange(deliveredOrders, dateRange, 'updated_at');
  
  return filteredOrders.reduce((sum, order) => {
    return sum + (order.delivery_fee || 0);
  }, 0);
};

/**
 * حساب تكلفة البضائع المباعة (COGS)
 */
export const calculateCOGS = (orders, dateRange) => {
  if (!orders || !Array.isArray(orders)) return 0;
  
  const deliveredOrders = orders.filter(order => 
    VALID_ORDER_STATUSES.includes(order.status) && order.receipt_received === true
  );
  
  const filteredOrders = filterByDateRange(deliveredOrders, dateRange, 'updated_at');
  
  return filteredOrders.reduce((orderSum, order) => {
    if (!order.order_items || !Array.isArray(order.order_items)) {
      // للتوافق مع البنية القديمة
      if (order.items && Array.isArray(order.items)) {
        return orderSum + order.items.reduce((itemSum, item) => {
          const costPrice = item.costPrice || item.cost_price || 0;
          const quantity = item.quantity || 0;
          return itemSum + (costPrice * quantity);
        }, 0);
      }
      return orderSum;
    }
    
    return orderSum + order.order_items.reduce((itemSum, item) => {
      // استخدام متوسط التكلفة المرجح أولاً، ثم cost_price
      const costPrice = item.product_variants?.weighted_avg_cost || 
                       item.product_variants?.cost_price || 
                       item.products?.cost_price || 
                       item.cost_price || 0;
      const quantity = item.quantity || 0;
      return itemSum + (costPrice * quantity);
    }, 0);
  }, 0);
};

/**
 * حساب المصاريف العامة (استبعاد النظامية ومستحقات الموظفين ومصاريف التوصيل)
 */
export const calculateGeneralExpenses = (expenses, dateRange, cashMovements) => {
  if (!expenses || !Array.isArray(expenses)) return 0;
  
  const filteredExpenses = filterByDateRange(expenses, dateRange, 'transaction_date');
  
  // حساب مبالغ إرجاع المصاريف المحذوفة (expense_refund) لخصمها من الإجمالي
  const expenseRefunds = Array.isArray(cashMovements) 
    ? filterByDateRange(cashMovements, dateRange, 'effective_at')
        .filter(m => m.reference_type === 'expense_refund')
        .reduce((sum, m) => sum + (m.amount || 0), 0)
    : 0;
  
  const total = filteredExpenses.filter(expense => {
    const isSystemExpense = expense.expense_type === EXCLUDED_EXPENSE_TYPES.SYSTEM;
    const isEmployeeDue = (
      expense.category === EXCLUDED_EXPENSE_TYPES.EMPLOYEE_DUES ||
      expense.related_data?.category === EXCLUDED_EXPENSE_TYPES.EMPLOYEE_DUES ||
      expense.metadata?.category === EXCLUDED_EXPENSE_TYPES.EMPLOYEE_DUES
    );
    
    // استبعاد COGS (شراء بضاعة)
    const isPurchaseGoods = (
      expense.related_data?.category === EXCLUDED_EXPENSE_TYPES.PURCHASE_RELATED ||
      expense.metadata?.category === EXCLUDED_EXPENSE_TYPES.PURCHASE_RELATED ||
      expense.category === 'شراء بضاعة' ||
      expense.category === 'purchase_goods' ||
      expense.category === 'شراء'
    );
    
    // استبعاد مصاريف التوصيل والشحن بجميع أشكالها (لمنع التكرار مع خصم الإيراد)
    const isDeliveryExpense = (
      expense.category === 'التوصيل والشحن' ||
      expense.related_data?.category === 'التوصيل والشحن' ||
      expense.metadata?.category === 'التوصيل والشحن' ||
      expense.description?.includes('التوصيل والشحن') ||
      expense.description?.includes('شحن ونقل') ||
      expense.description?.includes('توصيل الطلب') ||
      expense.description?.includes('رسوم توصيل') ||
      expense.description === 'رسوم التوصيل' ||
      expense.category === 'توصيل' ||
      expense.category === 'التوصيل'
    );
    
    // فقط المصاريف التي affects_cogs = false
    const affectsCOGS = expense.metadata?.affects_cogs === true;

    // استبعاد: مصاريف نظامية + مستحقات الموظفين + COGS + مصاريف التوصيل
    if (isSystemExpense) return false;
    if (isEmployeeDue) return false;
    if (isPurchaseGoods) return false;
    if (affectsCOGS) return false;
    if (isDeliveryExpense) return false; // منع تكرار مصاريف التوصيل

    // استبعاد المصاريف المحذوفة أو الملغاة
    if (expense.status === 'deleted' || expense.status === 'cancelled' || expense.status === 'refunded') return false;
    // اعتماد الحالة إذا وُجدت فقط
    if (expense.status && expense.status !== 'approved') return false;

    return true;
  }).reduce((sum, expense) => sum + (expense.amount || 0), 0);
  
  // خصم مبالغ الإرجاع من الإجمالي (المصاريف الملغاة تظهر بصافي صفر)
  return Math.max(0, total - expenseRefunds);
};

/**
 * حساب مستحقات الموظفين المدفوعة
 */
export const calculateEmployeeDuesPaid = (expenses, dateRange) => {
  if (!expenses || !Array.isArray(expenses)) return 0;
  
  const filteredExpenses = filterByDateRange(expenses, dateRange, 'transaction_date');
  
  return filteredExpenses.filter(expense => {
    const isEmployeeDue = (
      expense.category === EXCLUDED_EXPENSE_TYPES.EMPLOYEE_DUES ||
      expense.related_data?.category === EXCLUDED_EXPENSE_TYPES.EMPLOYEE_DUES ||
      expense.metadata?.category === EXCLUDED_EXPENSE_TYPES.EMPLOYEE_DUES
    );
    const isApproved = expense.status ? expense.status === 'approved' : true;
    return isApproved && isEmployeeDue;
  }).reduce((sum, expense) => sum + (expense.amount || 0), 0);
};

/**
 * حساب جميع المؤشرات المالية
 */
export const calculateFinancialMetrics = (orders, expenses, timePeriod = TIME_PERIODS.ALL, cashMovements = []) => {
  try {
    console.log('🔧 بدء حساب المؤشرات المالية:', { 
      ordersCount: orders?.length, 
      expensesCount: expenses?.length, 
      timePeriod 
    });
    
    const dateRange = calculateDateRange(timePeriod);
    
    // الحسابات الأساسية
    const totalRevenue = calculateTotalRevenue(orders, dateRange);
    const deliveryFees = calculateDeliveryFees(orders, dateRange);
    const salesWithoutDelivery = FINANCIAL_FORMULAS.SALES_WITHOUT_DELIVERY(totalRevenue, deliveryFees);
    const cogs = calculateCOGS(orders, dateRange);
    const grossProfit = FINANCIAL_FORMULAS.GROSS_PROFIT(salesWithoutDelivery, cogs);
    const generalExpenses = calculateGeneralExpenses(expenses, dateRange, cashMovements);
    const employeeDuesPaid = calculateEmployeeDuesPaid(expenses, dateRange);
    const netProfit = FINANCIAL_FORMULAS.NET_PROFIT(grossProfit, generalExpenses, employeeDuesPaid);
    
    // الهوامش
    const grossProfitMargin = FINANCIAL_FORMULAS.GROSS_PROFIT_MARGIN(grossProfit, salesWithoutDelivery);
    const netProfitMargin = FINANCIAL_FORMULAS.NET_PROFIT_MARGIN(netProfit, salesWithoutDelivery);
    
    const result = {
      totalRevenue,
      deliveryFees,
      salesWithoutDelivery,
      cogs,
      grossProfit,
      generalExpenses,
      employeeDuesPaid,
      netProfit,
      grossProfitMargin,
      netProfitMargin,
      dateRange,
      timePeriod
    };
    
    console.log('📊 نتائج الحسابات المالية:', result);
    
    return result;
    
  } catch (error) {
    console.error('❌ خطأ في حساب المؤشرات المالية:', error);
    return {
      ...DEFAULT_FINANCIAL_VALUES,
      error: error.message,
      dateRange: calculateDateRange(timePeriod),
      timePeriod
    };
  }
};

/**
 * فلترة الطلبات حسب صلاحيات المستخدم
 */
export const filterOrdersByPermissions = (orders, canViewAll, currentUserId) => {
  if (!orders || !Array.isArray(orders)) return [];
  
  if (canViewAll) return orders;
  
  return orders.filter(order => {
    const createdBy = order.created_by;
    return createdBy === currentUserId;
  });
};

/**
 * فلترة المصاريف حسب صلاحيات المستخدم
 */
export const filterExpensesByPermissions = (expenses, canViewAll, currentUserId) => {
  if (!expenses || !Array.isArray(expenses)) return [];
  
  if (canViewAll) return expenses;
  
  return expenses.filter(expense => {
    const createdBy = expense.created_by;
    return createdBy === currentUserId;
  });
};