import { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * هوك لجلب البيانات المالية المحسنة والصحيحة
 * يطبق المبادئ المحاسبية الصحيحة لحساب الأرباح والخسائر
 */
export const useEnhancedFinancialData = () => {
  const [financialData, setFinancialData] = useState({
    capitalValue: 0,
    totalRevenue: 0,
    totalCogs: 0,
    grossProfit: 0,
    totalExpenses: 0,
    totalPurchases: 0,
    employeeProfits: 0,
    netProfit: 0,
    finalBalance: 0
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEnhancedFinancialData = async () => {
    try {
      setLoading(true);
      setError(null);

      // استخدام الدالة المحسنة الجديدة
      const { data, error } = await supabase
        .rpc('calculate_enhanced_main_cash_balance');

      if (error) throw error;

      if (data && data.length > 0) {
        const result = data[0];
        setFinancialData({
          capitalValue: Number(result.capital_value || 0),
          totalRevenue: Number(result.total_revenue || 0),
          totalCogs: Number(result.total_cogs || 0),
          grossProfit: Number(result.gross_profit || 0),
          totalExpenses: Number(result.total_expenses || 0),
          totalPurchases: Number(result.total_purchases || 0),
          employeeProfits: Number(result.employee_profits || 0),
          netProfit: Number(result.net_profit || 0),
          finalBalance: Number(result.final_balance || 0)
        });
      }

    } catch (error) {
      console.error('Error fetching enhanced financial data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEnhancedFinancialData();
  }, []);

  // دالة لإعادة تحميل البيانات
  const refreshData = () => {
    fetchEnhancedFinancialData();
  };

  return {
    financialData,
    loading,
    error,
    refreshData
  };
};

export default useEnhancedFinancialData;