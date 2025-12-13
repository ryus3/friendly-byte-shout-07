import { useMemo } from 'react';
import { parseISO, isValid } from 'date-fns';
import devLog from '@/lib/devLogger';

/**
 * مكون موحد لحساب صافي الأرباح
 */
export const useUnifiedProfitCalculator = ({ 
  orders, 
  expenses, 
  currentUser, 
  allProfits, 
  dateRange,
  canViewAll = true 
}) => {
  return useMemo(() => {
    if (!orders || !Array.isArray(orders)) {
      return {
        totalRevenue: 0,
        cogs: 0,
        grossProfit: 0,
        netProfit: 0,
        deliveredOrders: [],
        generalExpenses: 0,
        employeeSettledDues: 0,
        employeePendingDues: 0
      };
    }

    const safeOrders = Array.isArray(orders) ? orders : [];
    const safeExpenses = Array.isArray(expenses) ? expenses : [];
    
    const filterByDate = (itemDateStr) => {
      if (!dateRange?.from || !dateRange?.to || !itemDateStr) return true;
      try {
        const itemDate = parseISO(itemDateStr);
        return isValid(itemDate) && itemDate >= dateRange.from && itemDate <= dateRange.to;
      } catch (e) {
        return false;
      }
    };

    const visibleOrders = canViewAll ? safeOrders : safeOrders.filter(order => 
      order.created_by === currentUser?.id || order.created_by === currentUser?.user_id
    );

    const deliveredOrders = visibleOrders.filter(o => 
      (o.status === 'delivered' || o.status === 'completed') && 
      o.receipt_received === true && 
      filterByDate(o.updated_at || o.created_at)
    );

    const salesSum = deliveredOrders.reduce((sum, o) => {
      const sales = (o.sales_amount != null)
        ? (Number(o.sales_amount) || 0)
        : (Number(o.final_amount ?? o.total_amount ?? 0) - Number(o.delivery_fee ?? 0));
      devLog.log('💰 حساب مبيعات الطلب:', {
        orderNumber: o.order_number,
        salesAmount: sales
      });
      return sum + sales;
    }, 0);
    const totalRevenue = salesSum;
    const salesWithoutDelivery = salesSum;
    
    const cogs = deliveredOrders.reduce((sum, o) => {
      const orderCogs = (o.items || []).reduce((itemSum, item) => {
        const costPrice = item.costPrice || item.cost_price || 0;
        return itemSum + (costPrice * item.quantity);
      }, 0);
      return sum + orderCogs;
    }, 0);

    const grossProfit = salesWithoutDelivery - cogs;

    const expensesInRange = safeExpenses.filter(e => filterByDate(e.transaction_date));
    const generalExpenses = expensesInRange.filter(e => {
      if (e.expense_type === 'system') return false;
      if (e.category === 'مستحقات الموظفين') return false;
      if (e.related_data?.category === 'شراء بضاعة') return false;
      return true;
    }).reduce((sum, e) => sum + e.amount, 0);

    const employeeSettledDues = expensesInRange
      .filter(e => (
        e.category === 'مستحقات الموظفين' ||
        e.related_data?.category === 'مستحقات الموظفين'
      ))
      .reduce((sum, e) => sum + e.amount, 0);

    const employeePendingDues = (allProfits || [])
      .filter(p => {
        if (p.status !== 'pending') return false;
        if (canViewAll && p.employee_id === currentUser?.id) return false;
        
        const order = orders?.find(o => o.id === p.order_id);
        if (!order) return false;
        
        const isDelivered = (order.status === 'delivered' || order.status === 'completed') && order.receipt_received;
        const isInDateRange = filterByDate(order.updated_at || order.created_at);
        
        return isDelivered && isInDateRange;
      })
      .reduce((sum, p) => sum + (p.employee_profit || 0), 0);

    const netProfit = grossProfit - generalExpenses;

    return {
      totalRevenue,
      cogs,
      grossProfit,
      netProfit,
      deliveredOrders,
      generalExpenses,
      employeeSettledDues,
      employeePendingDues,
      salesWithoutDelivery
    };
  }, [orders, expenses, currentUser, allProfits, dateRange, canViewAll]);
};
