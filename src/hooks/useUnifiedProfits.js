import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * هوك موحد لجلب بيانات الأرباح - يستخدم في لوحة التحكم والمركز المالي
 * يضمن عرض نفس البيانات بطريقتين مختلفتين في التصميم
 */
export const useUnifiedProfits = (userId = null) => {
  const [profitData, setProfitData] = useState({
    // البيانات العامة للنظام
    totalSystemProfit: 0,
    totalEmployeeProfits: 0,
    totalManagerProfits: 0,
    netSystemProfit: 0,
    
    // البيانات الشخصية للموظف
    personalPendingProfit: 0,
    personalSettledProfit: 0,
    personalTotalProfit: 0,
    
    // بيانات إضافية
    totalExpenses: 0,
    settledDues: 0,
    pendingOrders: 0,
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

      // 3. جلب الطلبات التي تم استلام فواتيرها للأرباح المحققة فقط
      const { data: realizedOrders, error: ordersError } = await supabase
        .from('orders')
        .select('id, receipt_received')
        .eq('receipt_received', true);

      if (ordersError) throw ordersError;

      const realizedOrderIds = realizedOrders?.map(o => o.id) || [];
      
      // 4. حساب البيانات العامة - الأرباح المحققة فقط (التي تم استلام فواتيرها)
      const realizedProfits = systemProfits?.filter(p => realizedOrderIds.includes(p.order_id)) || [];
      const pendingProfits = systemProfits?.filter(p => !realizedOrderIds.includes(p.order_id)) || [];
      
      const totalSystemProfit = systemProfits?.reduce((sum, p) => sum + (p.profit_amount || 0), 0) || 0;
      const totalEmployeeProfits = systemProfits?.reduce((sum, p) => sum + (p.employee_profit || 0), 0) || 0;
      const totalManagerProfits = totalSystemProfit - totalEmployeeProfits;
      
      // صافي الأرباح = الأرباح المحققة فقط - المصاريف
      const realizedManagerProfits = realizedProfits.reduce((sum, p) => sum + (p.profit_amount || 0) - (p.employee_profit || 0), 0);
      const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
      const netSystemProfit = realizedManagerProfits - totalExpenses;
      
      // الأرباح المعلقة = أرباح الطلبات التي لم يتم استلام فواتيرها
      const pendingSystemProfits = pendingProfits.reduce((sum, p) => sum + (p.profit_amount || 0) - (p.employee_profit || 0), 0);

      // 4. حساب البيانات الشخصية (إذا تم تمرير معرف المستخدم)
      let personalData = {
        personalPendingProfit: 0,
        personalSettledProfit: 0,
        personalTotalProfit: 0
      };

      if (userId) {
        const personalProfits = systemProfits?.filter(p => p.employee_id === userId) || [];
        const pendingProfits = personalProfits.filter(p => p.status === 'pending');
        const settledProfits = personalProfits.filter(p => p.status === 'settled');
        
        personalData = {
          personalPendingProfit: pendingProfits.reduce((sum, p) => sum + (p.employee_profit || 0), 0),
          personalSettledProfit: settledProfits.reduce((sum, p) => sum + (p.employee_profit || 0), 0),
          personalTotalProfit: personalProfits.reduce((sum, p) => sum + (p.employee_profit || 0), 0)
        };
      }

      // 6. إحصائيات إضافية
      const settledOrders = systemProfits?.filter(p => p.status === 'settled').length || 0;
      const pendingOrders = pendingProfits.length || 0;
      const settledDues = systemProfits?.filter(p => p.status === 'settled').reduce((sum, p) => sum + (p.employee_profit || 0), 0) || 0;

      // 7. تجميع جميع البيانات
      setProfitData({
        // البيانات العامة
        totalSystemProfit,
        totalEmployeeProfits,
        totalManagerProfits,
        netSystemProfit, // صافي الأرباح المحققة فقط - المصاريف
        pendingSystemProfits, // الأرباح المعلقة
        
        // البيانات الشخصية
        ...personalData,
        
        // بيانات إضافية
        totalExpenses,
        settledDues,
        pendingOrders,
        settledOrders
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