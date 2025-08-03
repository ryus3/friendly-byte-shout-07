import { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Hook موحد لجلب جميع إحصائيات الطلبات والعملاء
 * يستبدل التكرار في TopCustomersDialog, TopProductsDialog, TopProvincesDialog, PendingProfitsDialog
 */
const useOrdersAnalytics = () => {
  const [analytics, setAnalytics] = useState({
    // إحصائيات عامة
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    totalRevenue: 0,
    
    // البيانات التفصيلية
    topCustomers: [],
    topProducts: [],
    topProvinces: [],
    pendingProfits: {
      total_pending_amount: 0,
      total_employee_profits: 0,
      employees_count: 0,
      orders_count: 0
    }
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // استدعاء الدالة الموحدة الجديدة
      const { data, error: rpcError } = await supabase.rpc('get_unified_orders_analytics');
      
      if (rpcError) {
        console.error('خطأ في جلب إحصائيات الطلبات:', rpcError);
        setError(rpcError.message);
        return;
      }

      if (data && data[0]) {
        const result = data[0];
        
        setAnalytics({
          // إحصائيات عامة
          totalOrders: parseInt(result.total_orders) || 0,
          pendingOrders: parseInt(result.pending_orders) || 0,
          completedOrders: parseInt(result.completed_orders) || 0,
          totalRevenue: parseFloat(result.total_revenue) || 0,
          
          // البيانات التفصيلية
          topCustomers: result.top_customers || [],
          topProducts: result.top_products || [],
          topProvinces: result.top_provinces || [],
          pendingProfits: result.pending_profits || {
            total_pending_amount: 0,
            total_employee_profits: 0,
            employees_count: 0,
            orders_count: 0
          }
        });
      }
    } catch (err) {
      console.error('خطأ غير متوقع في جلب إحصائيات الطلبات:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // جلب البيانات عند تحميل المكون
  useEffect(() => {
    fetchAnalytics();
  }, []);

  // إرجاع البيانات والوظائف
  return {
    analytics,
    loading,
    error,
    refreshAnalytics: fetchAnalytics
  };
};

export default useOrdersAnalytics;