import { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * هوك موحد لجلب بيانات الأرباح - يستخدم في لوحة التحكم والمركز المالي
 * يضمن عرض نفس البيانات بطريقتين مختلفتين في التصميم
 */
export const useUnifiedProfits = (userId = null) => {
  const [profitData, setProfitData] = useState({
    // البيانات العامة للنظام
    totalSystemProfit: 0,
    totalEmployeeProfits: 0,
    managerProfitFromEmployees: 0, // أرباح المدير من الطلبات المكتملة
    netProfit: 0, // صافي الربح بعد خصم المصاريف
    
    // البيانات الشخصية للموظف
    personalPendingProfit: 0,
    personalSettledProfit: 0,
    personalTotalProfit: 0,
    
    // إحصائيات إضافية للموظف
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    totalRevenue: 0,
    pendingProfits: 0,
    settledProfits: 0,
    totalProfits: 0,
    
    // بيانات إضافية
    totalExpenses: 0,
    settledDues: 0,
    settledOrders: 0
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUnifiedProfitData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. جلب إجمالي الأرباح من النظام
      const { data: systemProfits, error: systemError } = await supabase
        .from('profits')
        .select(`
          profit_amount,
          employee_profit,
          status,
          employee_id,
          order_id
        `);

      if (systemError) throw systemError;

      // 2. جلب المصاريف العامة
      const { data: expenses, error: expensesError } = await supabase
        .from('expenses')
        .select('amount')
        .eq('status', 'approved');

      if (expensesError) throw expensesError;

      // 3. جلب جميع الطلبات لحساب الإحصائيات
      const ordersQuery = userId ? 
        supabase.from('orders').select('*').eq('created_by', userId) :
        supabase.from('orders').select('*');
        
      const { data: allOrders, error: ordersError } = await ordersQuery;
      if (ordersError) throw ordersError;

      // فلترة الطلبات حسب المستخدم
      const userOrders = allOrders || [];
      const completedOrders = userOrders.filter(o => o.status === 'completed' || o.status === 'delivered');
      const pendingOrders = userOrders.filter(o => o.status === 'pending' || o.status === 'shipped');
      
      // حساب الإيرادات الإجمالية
      const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
      
      // حساب البيانات العامة للنظام
      const completedOrderIds = completedOrders.map(o => o.id);
      const completedProfits = systemProfits?.filter(p => completedOrderIds.includes(p.order_id)) || [];
      const allPendingProfits = systemProfits?.filter(p => !completedOrderIds.includes(p.order_id)) || [];
      
      const totalSystemProfit = completedProfits?.reduce((sum, p) => sum + (p.profit_amount || 0), 0) || 0;
      const totalEmployeeProfits = completedProfits?.reduce((sum, p) => sum + (p.employee_profit || 0), 0) || 0;
      const totalManagerProfits = totalSystemProfit - totalEmployeeProfits;
      
      // صافي الأرباح = أرباح الطلبات المكتملة - المصاريف
      const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
      const netSystemProfit = totalManagerProfits - totalExpenses;

      // حساب البيانات الشخصية للموظف
      let personalData = {
        personalPendingProfit: 0,
        personalSettledProfit: 0,
        personalTotalProfit: 0,
        totalOrders: userOrders.length,
        pendingOrders: pendingOrders.length,
        completedOrders: completedOrders.length,
        totalRevenue: totalRevenue,
        pendingProfits: 0,
        settledProfits: 0,
        totalProfits: 0
      };

      if (userId) {
        // جلب أرباح المستخدم من قاعدة البيانات
        const personalProfits = systemProfits?.filter(p => p.employee_id === userId) || [];
        const pendingPersonalProfits = personalProfits.filter(p => p.status === 'pending');
        const settledPersonalProfits = personalProfits.filter(p => p.status === 'settled');
        
        const pendingProfitAmount = pendingPersonalProfits.reduce((sum, p) => sum + (p.employee_profit || 0), 0);
        const settledProfitAmount = settledPersonalProfits.reduce((sum, p) => sum + (p.employee_profit || 0), 0);
        const totalProfitAmount = personalProfits.reduce((sum, p) => sum + (p.employee_profit || 0), 0);
        
        personalData = {
          ...personalData,
          personalPendingProfit: pendingProfitAmount,
          personalSettledProfit: settledProfitAmount,
          personalTotalProfit: totalProfitAmount,
          pendingProfits: pendingProfitAmount,
          settledProfits: settledProfitAmount,
          totalProfits: totalProfitAmount
        };
      }

      // 6. إحصائيات إضافية
      const settledOrdersCount = systemProfits?.filter(p => p.status === 'settled').length || 0;
      const pendingOrdersCount = allPendingProfits.length || 0;
      const settledDues = systemProfits?.filter(p => p.status === 'settled').reduce((sum, p) => sum + (p.employee_profit || 0), 0) || 0;

      // حساب الأرباح المعلقة
      const pendingSystemProfits = allPendingProfits.reduce((sum, p) => sum + (p.profit_amount || 0), 0);

      // 7. تجميع جميع البيانات
      setProfitData({
        // البيانات العامة
        totalSystemProfit,
        totalEmployeeProfits,
        managerProfitFromEmployees: totalManagerProfits,
        netProfit: netSystemProfit, // صافي الأرباح من الطلبات المكتملة - المصاريف
        pendingSystemProfits, // الأرباح المعلقة
        
        // البيانات الشخصية
        ...personalData,
        
        // بيانات إضافية
        totalExpenses,
        settledDues,
        pendingOrders: pendingOrdersCount,
        settledOrders: settledOrdersCount
      });

    } catch (error) {
      console.error('Error fetching unified profit data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnifiedProfitData();
  }, [userId]);

  // دالة لإعادة تحميل البيانات
  const refreshData = () => {
    fetchUnifiedProfitData();
  };

  return {
    profitData,
    loading,
    error,
    refreshData
  };
};

export default useUnifiedProfits;