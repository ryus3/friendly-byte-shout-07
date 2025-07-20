import { useMemo } from 'react';
import { parseISO, isValid, subDays, startOfWeek, startOfMonth, startOfYear, endOfMonth } from 'date-fns';

// حساب صافي الأرباح الموحد - يستخدم في لوحة التحكم والمركز المالي
export const useNetProfitCalculator = (orders, accounting, products, period = 'month') => {
  return useMemo(() => {
    const now = new Date();
    let from, to;
    
    switch (period) {
      case 'today': 
        from = subDays(now, 1); 
        to = now; 
        break;
      case 'week': 
        from = startOfWeek(now, { weekStartsOn: 1 }); 
        to = now; 
        break;
      case 'year': 
        from = startOfYear(now); 
        to = now; 
        break;
      default: 
        from = startOfMonth(now); 
        to = endOfMonth(now); 
        break;
    }

    if (!orders || !accounting || !products) {
      return { 
        netProfit: 0, 
        totalRevenue: 0, 
        totalExpenses: 0, 
        grossProfit: 0, 
        deliveredOrders: [],
        salesWithoutDelivery: 0,
        cogs: 0
      };
    }
    
    const filterByDate = (itemDateStr) => {
      if (!from || !to || !itemDateStr) return true;
      const itemDate = parseISO(itemDateStr);
      return isValid(itemDate) && itemDate >= from && itemDate <= to;
    };
    
    // الطلبات المُوصلة والمُستلمة الفواتير فقط (الحساب الدقيق)
    const deliveredOrders = (orders || []).filter(o => 
      o.status === 'delivered' && 
      o.receipt_received === true && 
      filterByDate(o.updated_at || o.created_at)
    );
    
    const expensesInRange = (accounting.expenses || []).filter(e => filterByDate(e.transaction_date));
    
    // حساب الإيرادات
    const totalRevenue = deliveredOrders.reduce((sum, o) => sum + (o.final_amount || o.total_amount || 0), 0);
    const deliveryFees = deliveredOrders.reduce((sum, o) => sum + (o.delivery_fee || 0), 0);
    const salesWithoutDelivery = totalRevenue - deliveryFees;
    
    // حساب تكلفة البضاعة المُباعة
    const cogs = deliveredOrders.reduce((sum, o) => {
      const orderCogs = (o.items || []).reduce((itemSum, item) => {
        const costPrice = item.costPrice || item.cost_price || 0;
        return itemSum + (costPrice * item.quantity);
      }, 0);
      return sum + orderCogs;
    }, 0);
    
    const grossProfit = salesWithoutDelivery - cogs;
    
    // حساب المصاريف
    const generalExpenses = expensesInRange
      .filter(e => e.related_data?.category !== 'مستحقات الموظفين')
      .reduce((sum, e) => sum + e.amount, 0);
    const employeeSettledDues = expensesInRange
      .filter(e => e.related_data?.category === 'مستحقات الموظفين')
      .reduce((sum, e) => sum + e.amount, 0);
    const totalExpenses = generalExpenses + employeeSettledDues;
    
    // صافي الأرباح
    const netProfit = grossProfit - totalExpenses;
    
    return { 
      netProfit, 
      totalRevenue, 
      totalExpenses, 
      grossProfit, 
      deliveredOrders,
      salesWithoutDelivery,
      cogs,
      generalExpenses,
      employeeSettledDues,
      deliveryFees
    };
  }, [orders, accounting, products, period]);
};