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

      // استخدام النظام المحسن للحسابات المالية
      const { data: enhancedData, error: enhancedError } = await supabase
        .rpc('calculate_enhanced_main_cash_balance');

      if (enhancedError) throw enhancedError;

      // البيانات المحسنة
      const enhanced = enhancedData?.[0] || {};
      
      // 1. جلب إجمالي الأرباح من النظام للعرض التفصيلي
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

      // 2. جلب الطلبات المكتملة
      const { data: completedOrders, error: ordersError } = await supabase
        .from('orders')
        .select('id, status, receipt_received')
        .eq('status', 'completed');

      if (ordersError) throw ordersError;

      const completedOrderIds = completedOrders?.map(o => o.id) || [];
      const receiptReceivedOrderIds = completedOrders?.filter(o => o.receipt_received).map(o => o.id) || [];
      
      // 3. حساب البيانات للعرض (باستخدام النتائج المحسنة)
      const completedProfits = systemProfits?.filter(p => completedOrderIds.includes(p.order_id)) || [];
      const pendingProfits = systemProfits?.filter(p => !completedOrderIds.includes(p.order_id)) || [];
      
      // استخدام النتائج المحسنة من الدالة الجديدة - تصحيح لاستخدام system_profit
      const totalSystemProfit = Number(enhanced.system_profit || 0); // ربح النظام الصحيح
      const totalEmployeeProfits = Number(enhanced.employee_profits || 0);
      const grossProfit = Number(enhanced.gross_profit || 0); // الربح الخام للإحصائيات
      
      // صافي الربح من النظام المحسن
      const netSystemProfit = Number(enhanced.net_profit || 0);
      
      // الأرباح المعلقة = أرباح الطلبات غير المكتملة
      const pendingSystemProfits = pendingProfits.reduce((sum, p) => sum + (p.profit_amount || 0) - (p.employee_profit || 0), 0);

      // 4. حساب البيانات الشخصية (إذا تم تمرير معرف المستخدم)
      let personalData = {
        personalPendingProfit: 0,
        personalSettledProfit: 0,
        personalTotalProfit: 0
      };

      if (userId) {
        const personalProfits = systemProfits?.filter(p => p.employee_id === userId && completedOrderIds.includes(p.order_id)) || [];
        const pendingPersonalProfits = personalProfits.filter(p => p.status === 'pending');
        const settledPersonalProfits = personalProfits.filter(p => p.status === 'settled');
        
        personalData = {
          personalPendingProfit: pendingPersonalProfits.reduce((sum, p) => sum + (p.employee_profit || 0), 0),
          personalSettledProfit: settledPersonalProfits.reduce((sum, p) => sum + (p.employee_profit || 0), 0),
          personalTotalProfit: personalProfits.reduce((sum, p) => sum + (p.employee_profit || 0), 0)
        };
      }

      // 6. إحصائيات إضافية
      const settledOrders = systemProfits?.filter(p => p.status === 'settled').length || 0;
      const pendingOrders = pendingProfits.length || 0;
      const settledDues = systemProfits?.filter(p => p.status === 'settled').reduce((sum, p) => sum + (p.employee_profit || 0), 0) || 0;

      // 7. تجميع جميع البيانات
      setProfitData({
        // البيانات العامة المحسنة
        totalSystemProfit,
        totalEmployeeProfits,
        managerProfitFromEmployees: totalManagerProfits,
        netProfit: netSystemProfit, // صافي الأرباح من النظام المحسن
        pendingSystemProfits, // الأرباح المعلقة
        
        // بيانات مالية إضافية من النظام المحسن
        totalRevenue: Number(enhanced.total_revenue || 0),
        totalCogs: Number(enhanced.total_cogs || 0),
        grossProfit: Number(enhanced.gross_profit || 0), // للإحصائيات فقط
        systemProfit: Number(enhanced.system_profit || 0), // ربح النظام الصحيح
        finalBalance: Number(enhanced.final_balance || 0),
        
        // البيانات الشخصية
        ...personalData,
        
        // بيانات إضافية
        totalExpenses: Number(enhanced.total_expenses || 0),
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