import { useState, useEffect, useMemo } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { parseISO, isValid, startOfMonth, endOfMonth, startOfWeek, startOfYear, subDays } from 'date-fns';

/**
 * النظام المحاسبي الموحد الوحيد في التطبيق
 * يُستخدم في: لوحة التحكم، المركز المالي، تقرير الأرباح والخسائر
 * 
 * القواعد المحاسبية:
 * 1. صافي الربح = ربح النظام - المصاريف العامة
 * 2. مستحقات الموظفين = تخصم من القاصة مباشرة (مصاريف نظامية)
 * 3. المشتريات = تخصم من القاصة مباشرة
 * 4. المصاريف العامة = تخصم من الأرباح (تسويق، شحن، إلخ)
 */

// دالة للحصول على ربح النظام من جدول الأرباح
const getSystemProfitFromOrder = (orderId, allProfits) => {
  const orderProfits = allProfits?.find(p => p.order_id === orderId);
  if (!orderProfits) return 0;
  return (orderProfits.profit_amount || 0) - (orderProfits.employee_profit || 0);
};

export const useUnifiedFinancialData = (datePeriod = 'month') => {
  const { orders, accounting } = useInventory();
  const { user: currentUser } = useAuth();
  const [allProfits, setAllProfits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // جلب بيانات الأرباح من قاعدة البيانات
  useEffect(() => {
    const fetchProfits = async () => {
      try {
        setLoading(true);
        const { data: profitsData, error: profitsError } = await supabase
          .from('profits')
          .select(`
            *,
            order:orders(order_number, status, receipt_received),
            employee:profiles!employee_id(full_name)
          `);
        
        if (profitsError) throw profitsError;
        setAllProfits(profitsData || []);
      } catch (err) {
        console.error('خطأ في جلب بيانات الأرباح:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchProfits();
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

  // الحسابات المالية الموحدة
  const financialData = useMemo(() => {
    if (!orders || !Array.isArray(orders) || loading) {
      return {
        // بيانات أساسية
        totalRevenue: 0,
        deliveryFees: 0,
        salesWithoutDelivery: 0,
        cogs: 0,
        grossProfit: 0,
        systemProfit: 0,
        generalExpenses: 0,
        netProfit: 0,
        
        // بيانات الموظفين
        managerSales: 0,
        employeeSales: 0,
        totalEmployeeProfits: 0,
        employeePendingDues: 0,
        employeeSettledDues: 0,
        
        // بيانات للرسوم البيانية
        chartData: [],
        deliveredOrders: [],
        
        // إجماليات أخرى
        totalOrders: 0,
        pendingOrders: 0,
        completedOrders: 0
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
    
    // الطلبات المُستلمة الفواتير فقط (الأساس المحاسبي)
    const deliveredOrders = safeOrders.filter(o => 
      o && (o.status === 'delivered' || o.status === 'completed') && 
      o.receipt_received === true && 
      filterByDate(o.updated_at || o.created_at)
    );
    
    const expensesInRange = safeExpenses.filter(e => filterByDate(e.transaction_date));
    
    // 1. حساب إجمالي الإيرادات
    const totalRevenue = deliveredOrders.reduce((sum, o) => {
      return sum + (o.final_amount || o.total_amount || 0);
    }, 0);
    
    const deliveryFees = deliveredOrders.reduce((sum, o) => sum + (o.delivery_fee || 0), 0);
    const salesWithoutDelivery = totalRevenue - deliveryFees;
    
    // 2. حساب تكلفة البضاعة المباعة
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
    
    // 3. حساب ربح النظام بالطريقة الصحيحة
    const managerOrdersInRange = deliveredOrders.filter(o => !o.created_by || o.created_by === currentUser?.id);
    const employeeOrdersInRange = deliveredOrders.filter(o => o.created_by && o.created_by !== currentUser?.id);
    
    // ربح المدير كاملاً
    const managerTotalProfit = managerOrdersInRange.reduce((sum, order) => {
      const orderProfit = (order.order_items || []).reduce((itemSum, item) => {
        const sellPrice = item.unit_price || item.price || 0;
        const costPrice = item.product_variants?.cost_price || item.products?.cost_price || 0;
        return itemSum + ((sellPrice - costPrice) * item.quantity);
      }, 0);
      return sum + orderProfit;
    }, 0);
    
    // ربح النظام من طلبات الموظفين (باستخدام جدول الأرباح)
    const employeeSystemProfit = employeeOrdersInRange.reduce((sum, order) => {
      return sum + getSystemProfitFromOrder(order.id, allProfits);
    }, 0);
    
    const systemProfit = managerTotalProfit + employeeSystemProfit;
    
    // 4. المصاريف العامة فقط (استبعاد النظامية)
    const generalExpenses = expensesInRange.filter(e => {
      // استبعاد المصاريف النظامية
      if (e.expense_type === 'system') return false;
      if (e.category === 'مستحقات الموظفين') return false;
      if (e.related_data?.category === 'شراء بضاعة') return false;
      if (e.related_data?.type === 'employee_settlement') return false;
      if (e.related_data?.type === 'purchase') return false;
      return true;
    }).reduce((sum, e) => sum + (e.amount || 0), 0);
    
    // 5. صافي الربح = ربح النظام - المصاريف العامة
    const netProfit = systemProfit - generalExpenses;
    
    // 6. حساب بيانات الموظفين
    const totalEmployeeProfits = allProfits
      .filter(p => deliveredOrders.some(o => o.id === p.order_id))
      .reduce((sum, p) => sum + (p.employee_profit || 0), 0);
    
    const employeePendingDues = allProfits
      .filter(p => p.status === 'pending' && deliveredOrders.some(o => o.id === p.order_id))
      .reduce((sum, p) => sum + (p.employee_profit || 0), 0);
    
    const employeeSettledDues = allProfits
      .filter(p => p.status === 'settled' && deliveredOrders.some(o => o.id === p.order_id))
      .reduce((sum, p) => sum + (p.employee_profit || 0), 0);
    
    // 7. حساب مبيعات المدير والموظفين للرسم البياني
    const managerSales = managerOrdersInRange.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const employeeSales = employeeOrdersInRange.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    
    // 8. بيانات الرسم البياني
    const salesByDay = {};
    const expensesByDay = {};
    
    deliveredOrders.forEach(o => {
      const day = (o.updated_at || o.created_at)?.split('T')[0];
      if (day) {
        salesByDay[day] = (salesByDay[day] || 0) + (o.total_amount || 0);
      }
    });
    
    expensesInRange.forEach(e => {
      const day = e.transaction_date?.split('T')[0];
      if (day) {
        expensesByDay[day] = (expensesByDay[day] || 0) + (e.amount || 0);
      }
    });
    
    const chartData = Object.keys(salesByDay).map(day => ({
      date: day,
      sales: salesByDay[day] || 0,
      expenses: expensesByDay[day] || 0,
      net: (salesByDay[day] || 0) - (expensesByDay[day] || 0)
    }));
    
    // 9. إحصائيات الطلبات
    const ordersInRange = safeOrders.filter(o => filterByDate(o.updated_at || o.created_at));
    const totalOrders = ordersInRange.length;
    const pendingOrders = ordersInRange.filter(o => o.status === 'pending').length;
    const completedOrders = deliveredOrders.length;
    
    console.log('💰 النظام المحاسبي الموحد - البيانات النهائية:', {
      totalRevenue,
      salesWithoutDelivery,
      cogs,
      grossProfit,
      systemProfit,
      generalExpenses,
      netProfit,
      totalEmployeeProfits,
      deliveredOrdersCount: deliveredOrders.length,
      datePeriod
    });
    
    return {
      // بيانات أساسية
      totalRevenue,
      deliveryFees,
      salesWithoutDelivery,
      cogs,
      grossProfit,
      systemProfit,
      generalExpenses,
      netProfit,
      
      // بيانات الموظفين
      managerSales,
      employeeSales,
      totalEmployeeProfits,
      employeePendingDues,
      employeeSettledDues,
      managerProfitFromEmployees: systemProfit, // للتوافق مع الكود القديم
      
      // بيانات للرسوم البيانية
      chartData,
      deliveredOrders,
      
      // إجماليات أخرى
      totalOrders,
      pendingOrders,
      completedOrders,
      
      // للتوافق مع ProfitLossDialog
      inventoryValue: 0, // سيتم حسابه لاحقاً إذا لزم الأمر
      myProfit: 0, // للموظفين
      cashOnHand: 0 // سيتم حسابه من مصادر النقد
    };
  }, [orders, accounting, allProfits, dateRange, currentUser]);

  return {
    ...financialData,
    loading,
    error,
    dateRange,
    refreshData: () => {
      // إعادة جلب البيانات
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
        } catch (err) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      };
      fetchProfits();
    }
  };
};

export default useUnifiedFinancialData;