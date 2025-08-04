/**
 * 🏗️ النظام المالي الموحد الأساسي
 * المحرك الرئيسي لجميع العمليات المالية في التطبيق
 * مصدر واحد للحقيقة - Single Source of Truth
 */

import { supabase } from '@/integrations/supabase/client';
import { parseISO, isValid } from 'date-fns';

/**
 * جلب جميع البيانات المالية من قاعدة البيانات
 */
export const fetchAllFinancialData = async () => {
  try {
    console.log('🔄 جاري جلب البيانات المالية الموحدة...');

    // 1. جلب الطلبات المكتملة مع تفاصيل العناصر
    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          product_variants (cost_price),
          products (cost_price)
        )
      `)
      .in('status', ['completed', 'delivered'])
      .eq('receipt_received', true);

    if (ordersError) throw ordersError;

    // 2. جلب المصاريف
    const { data: expensesData, error: expensesError } = await supabase
      .from('expenses')
      .select('*')
      .eq('status', 'approved');

    if (expensesError) throw expensesError;

    // 3. جلب بيانات الأرباح
    const { data: profitsData, error: profitsError } = await supabase
      .from('profits')
      .select(`
        *,
        orders (order_number, status, receipt_received),
        profiles (full_name, employee_code)
      `);

    if (profitsError) throw profitsError;

    // 4. جلب رأس المال من القاصة الرئيسية
    const { data: capitalData, error: capitalError } = await supabase
      .from('cash_sources')
      .select('current_balance')
      .eq('name', 'القاصة الرئيسية')
      .single();

    if (capitalError) throw capitalError;

    // 5. جلب المشتريات المعتمدة
    const { data: purchasesData, error: purchasesError } = await supabase
      .from('purchases')
      .select('total_amount')
      .eq('status', 'approved');

    if (purchasesError) throw purchasesError;

    // 6. جلب جميع مصادر النقد
    const { data: cashSourcesData, error: cashError } = await supabase
      .from('cash_sources')
      .select('*');

    if (cashError) throw cashError;

    const consolidatedData = {
      orders: ordersData || [],
      expenses: expensesData || [],
      profits: profitsData || [],
      capitalAmount: capitalData?.current_balance || 0,
      totalPurchases: purchasesData?.reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0) || 0,
      cashSources: cashSourcesData || [],
      lastUpdated: new Date()
    };

    console.log('✅ تم جلب البيانات المالية بنجاح:', {
      orders: consolidatedData.orders.length,
      expenses: consolidatedData.expenses.length,
      profits: consolidatedData.profits.length,
      capitalAmount: consolidatedData.capitalAmount,
      totalPurchases: consolidatedData.totalPurchases
    });

    return consolidatedData;

  } catch (error) {
    console.error('❌ خطأ في جلب البيانات المالية:', error);
    throw error;
  }
};

/**
 * حساب المؤشرات المالية الموحدة
 */
export const calculateUnifiedMetrics = (data, dateFilter = null) => {
  try {
    console.log('🧮 بدء حساب المؤشرات المالية الموحدة...');

    const { orders, expenses, profits, capitalAmount, totalPurchases } = data;

    // تطبيق الفلتر الزمني
    const filteredOrders = dateFilter ? 
      orders.filter(order => isDateInRange(order.updated_at || order.created_at, dateFilter)) : 
      orders;

    const filteredExpenses = dateFilter ? 
      expenses.filter(expense => isDateInRange(expense.transaction_date || expense.created_at, dateFilter)) : 
      expenses;

    // 1. حساب الإيرادات
    const totalRevenue = filteredOrders.reduce((sum, order) => {
      return sum + (Number(order.final_amount) || Number(order.total_amount) || 0);
    }, 0);

    const deliveryFees = filteredOrders.reduce((sum, order) => {
      return sum + (Number(order.delivery_fee) || 0);
    }, 0);

    const salesWithoutDelivery = totalRevenue - deliveryFees;

    // 2. حساب تكلفة البضاعة المباعة (COGS)
    const cogs = filteredOrders.reduce((sum, order) => {
      if (!order.order_items || !Array.isArray(order.order_items)) return sum;
      
      const orderCogs = order.order_items.reduce((itemSum, item) => {
        const costPrice = item.product_variants?.cost_price || item.products?.cost_price || 0;
        const quantity = Number(item.quantity) || 0;
        return itemSum + (Number(costPrice) * quantity);
      }, 0);
      
      return sum + orderCogs;
    }, 0);

    // 3. حساب الربح الإجمالي
    const grossProfit = salesWithoutDelivery - cogs;

    // 4. حساب المصاريف العامة (استبعاد النظامية ومستحقات الموظفين)
    const generalExpenses = filteredExpenses
      .filter(expense => {
        return expense.expense_type !== 'system' && 
               expense.category !== 'مستحقات الموظفين' &&
               !expense.related_data?.category?.includes('شراء');
      })
      .reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);

    // 5. حساب مستحقات الموظفين المدفوعة
    const employeeDuesPaid = filteredExpenses
      .filter(expense => expense.expense_type === 'system' && expense.category === 'مستحقات الموظفين')
      .reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);

    // 6. حساب مستحقات الموظفين المعلقة
    const employeeDuesPending = profits
      .filter(profit => profit.status === 'pending')
      .reduce((sum, profit) => sum + (Number(profit.employee_profit) || 0), 0);

    // 7. حساب ربح النظام
    const systemProfit = profits
      .reduce((sum, profit) => {
        return sum + ((Number(profit.profit_amount) || 0) - (Number(profit.employee_profit) || 0));
      }, 0);

    // 8. حساب صافي الربح النهائي
    const netProfit = systemProfit - generalExpenses;

    // 9. حساب إجمالي النقد الحقيقي
    const totalCashBalance = data.cashSources?.reduce((sum, source) => {
      return sum + (Number(source.current_balance) || 0);
    }, 0) || capitalAmount;

    // 10. حساب الهوامش
    const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const netProfitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    const metrics = {
      // الإيرادات
      totalRevenue,
      deliveryFees,
      salesWithoutDelivery,
      
      // التكاليف
      cogs,
      generalExpenses,
      employeeDuesPaid,
      employeeDuesPending,
      
      // الأرباح
      grossProfit,
      systemProfit,
      netProfit,
      
      // النقد ورأس المال
      capitalAmount,
      totalCashBalance,
      totalPurchases,
      
      // الهوامش
      grossProfitMargin,
      netProfitMargin,
      
      // إحصائيات
      ordersCount: filteredOrders.length,
      expensesCount: filteredExpenses.filter(e => e.expense_type !== 'system').length,
      
      // معلومات إضافية
      isFiltered: !!dateFilter,
      lastCalculated: new Date(),
      dataSource: 'unified_system'
    };

    console.log('✅ تم حساب المؤشرات المالية:', metrics);
    return metrics;

  } catch (error) {
    console.error('❌ خطأ في حساب المؤشرات المالية:', error);
    throw error;
  }
};

/**
 * فحص ما إذا كان التاريخ ضمن النطاق المحدد
 */
const isDateInRange = (dateString, dateFilter) => {
  if (!dateFilter || !dateFilter.from || !dateFilter.to || !dateString) {
    return true;
  }

  try {
    const itemDate = parseISO(dateString);
    return isValid(itemDate) && itemDate >= dateFilter.from && itemDate <= dateFilter.to;
  } catch (error) {
    console.warn('تاريخ غير صحيح:', dateString);
    return false;
  }
};

/**
 * تنسيق العملة
 */
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('ar-IQ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0) + ' د.ع';
};

/**
 * تنسيق النسبة المئوية
 */
export const formatPercentage = (percentage) => {
  return `${(percentage || 0).toFixed(1)}%`;
};