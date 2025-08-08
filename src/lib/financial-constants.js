/**
 * ثوابت النظام المالي الموحد
 * تحتوي على جميع المعادلات والقواعد المالية المعتمدة
 */

// أنواع المصاريف المستبعدة من الحسابات العامة
export const EXCLUDED_EXPENSE_TYPES = {
  SYSTEM: 'system',
  EMPLOYEE_DUES: 'مستحقات الموظفين',
  PURCHASE_RELATED: 'شراء بضاعة'
};

// حالات الطلبات المعتمدة للحسابات المالية
export const VALID_ORDER_STATUSES = ['delivered', 'completed'];

// أنواع الحسابات المالية
export const FINANCIAL_CALCULATION_TYPES = {
  TOTAL_REVENUE: 'total_revenue',
  DELIVERY_FEES: 'delivery_fees', 
  SALES_WITHOUT_DELIVERY: 'sales_without_delivery',
  COGS: 'cogs',
  GROSS_PROFIT: 'gross_profit',
  GENERAL_EXPENSES: 'general_expenses',
  EMPLOYEE_DUES_PAID: 'employee_dues_paid',
  NET_PROFIT: 'net_profit'
};

// المعادلات المالية الأساسية
export const FINANCIAL_FORMULAS = {
  // المبيعات بدون التوصيل = إجمالي الإيرادات - رسوم التوصيل
  SALES_WITHOUT_DELIVERY: (totalRevenue, deliveryFees) => totalRevenue - deliveryFees,
  
  // الربح الإجمالي = المبيعات بدون التوصيل - تكلفة البضائع المباعة
  GROSS_PROFIT: (salesWithoutDelivery, cogs) => salesWithoutDelivery - cogs,
  
  // صافي الربح = الربح الإجمالي - المصاريف العامة (المستحقات المدفوعة لا تدخل في صافي الربح)
  NET_PROFIT: (grossProfit, generalExpenses, employeeDuesPaid) => 
    grossProfit - generalExpenses,
  
  // هامش الربح الإجمالي
  GROSS_PROFIT_MARGIN: (grossProfit, salesWithoutDelivery) => 
    salesWithoutDelivery > 0 ? (grossProfit / salesWithoutDelivery) * 100 : 0,
  
  // هامش الربح الصافي
  NET_PROFIT_MARGIN: (netProfit, salesWithoutDelivery) => 
    salesWithoutDelivery > 0 ? (netProfit / salesWithoutDelivery) * 100 : 0
};

// فترات زمنية معتمدة
export const TIME_PERIODS = {
  TODAY: 'today',
  WEEK: 'week', 
  MONTH: 'month',
  YEAR: 'year',
  ALL: 'all'
};

// رسائل الأخطاء
export const FINANCIAL_ERROR_MESSAGES = {
  NO_DATA: 'لا توجد بيانات متاحة للحساب',
  INVALID_PERIOD: 'الفترة الزمنية غير صحيحة',
  CALCULATION_ERROR: 'خطأ في العمليات الحسابية',
  DATABASE_ERROR: 'خطأ في جلب البيانات من قاعدة البيانات'
};

// إعدادات افتراضية
export const DEFAULT_FINANCIAL_VALUES = {
  totalRevenue: 0,
  deliveryFees: 0,
  salesWithoutDelivery: 0,
  cogs: 0,
  grossProfit: 0,
  generalExpenses: 0,
  employeeDuesPaid: 0,
  netProfit: 0,
  grossProfitMargin: 0,
  netProfitMargin: 0
};