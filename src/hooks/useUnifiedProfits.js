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

      // 3. جلب الطلبات المكتملة (سواء تم استلام الفاتورة أم لا)
      const { data: completedOrders, error: ordersError } = await supabase
        .from('orders')
        .select('id, status, receipt_received')
        .eq('status', 'completed');

      if (ordersError) throw ordersError;

      const completedOrderIds = completedOrders?.map(o => o.id) || [];
      const receiptReceivedOrderIds = completedOrders?.filter(o => o.receipt_received).map(o => o.id) || [];
      
      // 4. حساب البيانات العامة - الأرباح من الطلبات المكتملة
      const completedProfits = systemProfits?.filter(p => completedOrderIds.includes(p.order_id)) || [];
      const pendingProfits = systemProfits?.filter(p => !completedOrderIds.includes(p.order_id)) || [];
      
      const totalSystemProfit = completedProfits?.reduce((sum, p) => sum + (p.profit_amount || 0), 0) || 0;
      const totalEmployeeProfits = completedProfits?.reduce((sum, p) => sum + (p.employee_profit || 0), 0) || 0;
      const totalManagerProfits = totalSystemProfit - totalEmployeeProfits;
      
      // صافي الأرباح = أرباح الطلبات المكتملة - المصاريف
      const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
      const netSystemProfit = totalManagerProfits - totalExpenses;
      
      // الأرباح المعلقة = أرباح الطلبات غير المكتملة
      const pendingSystemProfits = pendingProfits.reduce((sum, p) => sum + (p.profit_amount || 0) - (p.employee_profit || 0), 0);

      // 4. حساب البيانات الشخصية (إذا تم تمرير معرف المستخدم)
      let personalData = {
        personalPendingProfit: 0,
        personalSettledProfit: 0,
        personalTotalProfit: 0
      };

      if (userId) {
        console.log('🔍 حساب الأرباح الشخصية للموظف:', {
          userId,
          systemProfitsCount: systemProfits?.length,
          completedOrderIds: completedOrderIds.length
        });
        
        const personalProfits = systemProfits?.filter(p => p.employee_id === userId && completedOrderIds.includes(p.order_id)) || [];
        console.log('📊 أرباح الموظف المفلترة:', {
          personalProfitsCount: personalProfits.length,
          personalProfits: personalProfits.map(p => ({
            order_id: p.order_id,
            employee_profit: p.employee_profit,
            status: p.status
          }))
        });
        
        const pendingPersonalProfits = personalProfits.filter(p => p.status === 'pending');
        const settledPersonalProfits = personalProfits.filter(p => p.status === 'settled');
        
        personalData = {
          personalPendingProfit: pendingPersonalProfits.reduce((sum, p) => sum + (p.employee_profit || 0), 0),
          personalSettledProfit: settledPersonalProfits.reduce((sum, p) => sum + (p.employee_profit || 0), 0),
          personalTotalProfit: personalProfits.reduce((sum, p) => sum + (p.employee_profit || 0), 0)
        };
        
        console.log('✅ البيانات الشخصية المحسوبة:', personalData);
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
        managerProfitFromEmployees: totalManagerProfits,
        netProfit: netSystemProfit, // صافي الأرباح من الطلبات المكتملة - المصاريف
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