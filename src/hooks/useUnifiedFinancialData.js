import { useState, useEffect, useMemo } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { startOfMonth, endOfMonth, parseISO, isValid, startOfWeek, startOfYear, subDays } from 'date-fns';

/**
 * Hook موحد لحساب البيانات المالية
 * يُستخدم في لوحة التحكم والمركز المالي وتقرير الأرباح والخسائر
 */
export const useUnifiedFinancialData = (datePeriod = 'month') => {
  const { orders, accounting } = useInventory();
  const { user: currentUser } = useAuth();
  const [allProfits, setAllProfits] = useState([]);
  const [loading, setLoading] = useState(true);

  // جلب بيانات الأرباح من قاعدة البيانات
  useEffect(() => {
    const fetchProfits = async () => {
      try {
        setLoading(true);
        const { data: profitsData } = await supabase
          .from('profits')
          .select(`
            *,
            order:orders(order_number, status, receipt_received),
            employee:profiles!employee_id(full_name)
          `);
        setAllProfits(profitsData || []);
      } catch (error) {
        console.error('خطأ في جلب بيانات الأرباح:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchProfits();
  }, []);

  // حساب النطاق الزمني
  const dateRange = useMemo(() => {
    const now = new Date();
    
    switch (datePeriod) {
      case 'today':
        return { from: subDays(now, 1), to: now };
      case 'week':
        return { from: startOfWeek(now, { weekStartsOn: 1 }), to: now };
      case 'year':
        return { from: startOfYear(now), to: now };
      case 'month':
      default:
        return { from: startOfMonth(now), to: endOfMonth(now) };
    }
  }, [datePeriod]);

  // دالة للحصول على ربح النظام من جدول الأرباح
  const getSystemProfitFromOrder = (orderId) => {
    const orderProfits = allProfits?.find(p => p.order_id === orderId);
    if (!orderProfits) return 0;
    return (orderProfits.profit_amount || 0) - (orderProfits.employee_profit || 0);
  };

  // حساب البيانات المالية الموحدة
  const financialData = useMemo(() => {
    if (!orders || !Array.isArray(orders) || loading) {
      return {
        totalRevenue: 0,
        deliveryFees: 0,
        salesWithoutDelivery: 0,
        cogs: 0,
        grossProfit: 0,
        systemProfit: 0,
        generalExpenses: 0,
        netProfit: 0,
        employeeSettledDues: 0,
        totalEmployeeProfits: 0,
        deliveredOrders: [],
        chartData: []
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
    
    // الطلبات المُستلمة الفواتير فقط
    const deliveredOrders = safeOrders.filter(o => 
      o && (o.status === 'delivered' || o.status === 'completed') && 
      o.receipt_received === true && 
      filterByDate(o.updated_at || o.created_at)
    );
    
    const expensesInRange = safeExpenses.filter(e => filterByDate(e.transaction_date));
    
    // حساب إجمالي الإيرادات
    const totalRevenue = deliveredOrders.reduce((sum, o) => {
      return sum + (o.final_amount || o.total_amount || 0);
    }, 0);
    
    // حساب رسوم التوصيل
    const deliveryFees = deliveredOrders.reduce((sum, o) => sum + (o.delivery_fee || 0), 0);
    const salesWithoutDelivery = totalRevenue - deliveryFees;
    
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
    
    const grossProfit = salesWithoutDelivery - cogs;
    
    // حساب ربح النظام
    const managerOrdersInRange = deliveredOrders.filter(o => !o.created_by || o.created_by === currentUser?.id);
    const employeeOrdersInRange = deliveredOrders.filter(o => o.created_by && o.created_by !== currentUser?.id);
    
    // ربح المدير من طلباته الشخصية
    const managerTotalProfit = managerOrdersInRange.reduce((sum, order) => {
      const orderProfit = (order.items || []).reduce((itemSum, item) => {
        const sellPrice = item.unit_price || item.price || 0;
        const costPrice = item.product_variants?.cost_price || item.products?.cost_price || 0;
        return itemSum + ((sellPrice - costPrice) * item.quantity);
      }, 0);
      return sum + orderProfit;
    }, 0);
    
    // ربح النظام من طلبات الموظفين
    const employeeSystemProfit = employeeOrdersInRange.reduce((sum, order) => {
      return sum + getSystemProfitFromOrder(order.id);
    }, 0);
    
    const systemProfit = managerTotalProfit + employeeSystemProfit;
    
    // المصاريف العامة (استبعاد المصاريف النظامية ومستحقات الموظفين والمشتريات)
    const generalExpenses = expensesInRange.filter(e => {
      if (e.expense_type === 'system') return false;
      if (e.category === 'مستحقات الموظفين') return false;
      if (e.related_data?.category === 'شراء بضاعة') return false;
      if (e.related_data?.type === 'employee_settlement') return false;
      if (e.related_data?.type === 'purchase') return false;
      return true;
    }).reduce((sum, e) => sum + (e.amount || 0), 0);
    
    // مستحقات الموظفين المسددة
    const employeeSettledDues = expensesInRange.filter(e => 
      e.expense_type === 'system' && e.category === 'مستحقات الموظفين'
    ).reduce((sum, e) => sum + (e.amount || 0), 0);
    
    // صافي الربح = ربح النظام - المصاريف العامة (مستحقات الموظفين والمشتريات تُخصم من القاصة مباشرة)
    const netProfit = systemProfit - generalExpenses;
    
    // أرباح الموظفين
    const totalEmployeeProfits = allProfits
      .filter(p => deliveredOrders.some(o => o.id === p.order_id))
      .reduce((sum, p) => sum + (p.employee_profit || 0), 0);

    // إعداد بيانات الرسم البياني
    const chartData = generateChartData(deliveredOrders, expensesInRange);

    console.log('💰 البيانات المالية الموحدة:', {
      totalRevenue,
      deliveryFees,
      salesWithoutDelivery,
      cogs,
      grossProfit,
      systemProfit,
      generalExpenses,
      netProfit,
      employeeSettledDues,
      totalEmployeeProfits,
      deliveredOrdersCount: deliveredOrders.length,
      expensesCount: expensesInRange.length
    });
    
    return {
      totalRevenue,
      deliveryFees,
      salesWithoutDelivery,
      cogs,
      grossProfit,
      systemProfit,
      generalExpenses,
      netProfit,
      employeeSettledDues,
      totalEmployeeProfits,
      deliveredOrders,
      chartData
    };
  }, [orders, accounting, allProfits, dateRange, currentUser, loading]);

  return {
    financialData,
    loading,
    dateRange
  };
};

// دالة مساعدة لإنشاء بيانات الرسم البياني
const generateChartData = (deliveredOrders, expensesInRange) => {
  const salesByDay = {};
  const expensesByDay = {};

  deliveredOrders.forEach(o => {
    const day = new Date(o.updated_at || o.created_at).getDate().toString().padStart(2, '0');
    if (!salesByDay[day]) salesByDay[day] = 0;
    salesByDay[day] += o.final_amount || o.total_amount || 0;
  });

  expensesInRange.forEach(e => {
    const day = new Date(e.transaction_date).getDate().toString().padStart(2, '0');
    if (!expensesByDay[day]) expensesByDay[day] = 0;
    expensesByDay[day] += e.amount;
  });

  const allDays = [...new Set([...Object.keys(salesByDay), ...Object.keys(expensesByDay)])].sort();
  
  return allDays.map(day => ({
    name: day,
    sales: salesByDay[day] || 0,
    expenses: expensesByDay[day] || 0,
    net: (salesByDay[day] || 0) - (expensesByDay[day] || 0)
  }));
};