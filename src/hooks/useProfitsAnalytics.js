import { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Hook موحد لجلب جميع إحصائيات الأرباح والمستحقات
 * يستبدل التكرار في PendingProfitsDialog, EmployeeSettlementDialog, SettledDuesDialog
 */
const useProfitsAnalytics = () => {
  const [profitsData, setProfitsData] = useState({
    // إحصائيات عامة
    totalPendingProfits: 0,
    totalSettledProfits: 0,
    totalEmployeesWithProfits: 0,
    
    // البيانات التفصيلية
    pendingProfitsByEmployee: [],
    recentSettledProfits: [],
    financialSummary: {
      profits_summary: {
        total_pending_amount: 0,
        total_settled_amount: 0,
        pending_employee_profits: 0,
        settled_employee_profits: 0
      },
      orders_summary: {
        orders_with_pending_profits: 0,
        orders_with_settled_profits: 0
      },
      employees_summary: {
        employees_with_pending_profits: 0,
        employees_with_settled_profits: 0
      }
    }
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchProfitsAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // استدعاء الدالة الموحدة الجديدة
      const { data, error: rpcError } = await supabase.rpc('get_unified_profits_analytics');
      
      if (rpcError) {
        console.error('خطأ في جلب إحصائيات الأرباح:', rpcError);
        setError(rpcError.message);
        return;
      }

      if (data) {
        setProfitsData({
          // إحصائيات عامة
          totalPendingProfits: parseFloat(data.total_pending_profits) || 0,
          totalSettledProfits: parseFloat(data.total_settled_profits) || 0,
          totalEmployeesWithProfits: parseInt(data.total_employees_with_profits) || 0,
          
          // البيانات التفصيلية
          pendingProfitsByEmployee: data.pending_profits_by_employee || [],
          recentSettledProfits: data.recent_settled_profits || [],
          financialSummary: data.financial_summary || {
            profits_summary: {
              total_pending_amount: 0,
              total_settled_amount: 0,
              pending_employee_profits: 0,
              settled_employee_profits: 0
            },
            orders_summary: {
              orders_with_pending_profits: 0,
              orders_with_settled_profits: 0
            },
            employees_summary: {
              employees_with_pending_profits: 0,
              employees_with_settled_profits: 0
            }
          }
        });
      }
    } catch (err) {
      console.error('خطأ غير متوقع في جلب إحصائيات الأرباح:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // جلب البيانات عند تحميل المكون
  useEffect(() => {
    fetchProfitsAnalytics();
  }, []);

  // إرجاع البيانات والوظائف
  return {
    profitsData,
    loading,
    error,
    refreshProfitsAnalytics: fetchProfitsAnalytics
  };
};

export default useProfitsAnalytics;