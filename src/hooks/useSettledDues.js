import { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * هوك موحد للمستحقات المدفوعة
 * يستخدم في متابعة الموظفين والمركز المالي وملخص الأرباح
 */
export const useSettledDues = () => {
  const [settledDuesData, setSettledDuesData] = useState({
    totalAmount: 0,
    records: [],
    loading: true,
    error: null
  });

  const fetchSettledDues = async () => {
    try {
      setSettledDuesData(prev => ({ ...prev, loading: true, error: null }));

      // جلب المستحقات المدفوعة من جدول المصاريف
      const { data: expenses, error } = await supabase
        .from('expenses')
        .select(`
          id,
          amount,
          description,
          created_at,
          vendor_name,
          receipt_number,
          category,
          expense_type
        `)
        .eq('status', 'approved')
        .in('category', ['مستحقات الموظفين', 'مستحقات مدفوعة'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      const totalAmount = expenses?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0;

      setSettledDuesData({
        totalAmount,
        records: expenses || [],
        loading: false,
        error: null
      });

      console.log('💰 المستحقات المدفوعة الموحدة:', {
        totalAmount,
        recordsCount: expenses?.length || 0,
        records: expenses?.map(e => ({
          amount: e.amount,
          description: e.description,
          date: e.created_at
        })) || []
      });

    } catch (error) {
      console.error('Error fetching settled dues:', error);
      setSettledDuesData(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }));
    }
  };

  useEffect(() => {
    fetchSettledDues();
  }, []);

  const refreshData = () => {
    fetchSettledDues();
  };

  return {
    settledDues: settledDuesData,
    refreshSettledDues: refreshData
  };
};

export default useSettledDues;