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
 * حساب إجمالي الإيرادات من الطلبات المستلمة
 */
export const calculateTotalRevenue = (orders, dateRange) => {
  if (!orders || !Array.isArray(orders)) return 0;
  
  const deliveredOrders = orders.filter(order => 
    VALID_ORDER_STATUSES.includes(order.status) && order.receipt_received === true
  );
  
  const filteredOrders = filterByDateRange(deliveredOrders, dateRange, 'updated_at');
  
  return filteredOrders.reduce((sum, order) => {
    return sum + (order.final_amount || order.total_amount || 0);
  }, 0);
};

/**
 * حساب رسوم التوصيل
 */
export const calculateDeliveryFees = (orders, dateRange) => {
  if (!orders || !Array.isArray(orders)) return 0;
  
  const deliveredOrders = orders.filter(order => 
    VALID_ORDER_STATUSES.includes(order.status) && order.receipt_received === true
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
      const costPrice = item.product_variants?.cost_price || 
                       item.products?.cost_price || 
                       item.cost_price || 0;
      const quantity = item.quantity || 0;
      return itemSum + (costPrice * quantity);
    }, 0);
  }, 0);
};

/**
 * حساب المصاريف العامة (استبعاد النظامية ومستحقات الموظفين)
 */
export const calculateGeneralExpenses = (expenses, dateRange) => {
  if (!expenses || !Array.isArray(expenses)) return 0;
  
  const filteredExpenses = filterByDateRange(expenses, dateRange, 'transaction_date');
  
  return filteredExpenses.filter(expense => {
    const isSystemExpense = expense.expense_type === EXCLUDED_EXPENSE_TYPES.SYSTEM;
    const isEmployeeDue = (
      expense.category === EXCLUDED_EXPENSE_TYPES.EMPLOYEE_DUES ||
      expense.related_data?.category === EXCLUDED_EXPENSE_TYPES.EMPLOYEE_DUES ||
      expense.metadata?.category === EXCLUDED_EXPENSE_TYPES.EMPLOYEE_DUES
    );
    const isPurchaseRelated = (
      expense.related_data?.category === EXCLUDED_EXPENSE_TYPES.PURCHASE_RELATED ||
      expense.metadata?.category === EXCLUDED_EXPENSE_TYPES.PURCHASE_RELATED
    );

    // استبعاد: مصاريف نظامية + مستحقات الموظفين + مصاريف الشراء
    if (isSystemExpense) return false;
    if (isEmployeeDue) return false;
    if (isPurchaseRelated) return false;

    // اعتماد الحالة إذا وُجدت فقط
    if (expense.status && expense.status !== 'approved') return false;

    return true;
  }).reduce((sum, expense) => sum + (expense.amount || 0), 0);
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
export const calculateFinancialMetrics = (orders, expenses, timePeriod = TIME_PERIODS.ALL) => {
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
    const generalExpenses = calculateGeneralExpenses(expenses, dateRange);
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