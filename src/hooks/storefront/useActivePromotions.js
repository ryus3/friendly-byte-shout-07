import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Custom hook لجلب العروض النشطة للموظف
 */
export const useActivePromotions = (employeeId) => {
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!employeeId) {
      setLoading(false);
      return;
    }

    const fetchPromotions = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .rpc('get_active_promotions', { p_employee_id: employeeId });

        if (fetchError) throw fetchError;
        
        setPromotions(data || []);
      } catch (err) {
        console.error('Error fetching active promotions:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPromotions();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`promotions-${employeeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'employee_promotions',
          filter: `employee_id=eq.${employeeId}`
        },
        () => {
          fetchPromotions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [employeeId]);

  /**
   * حساب سعر المنتج بعد تطبيق العرض
   */
  const calculateDiscountedPrice = async (productId, originalPrice) => {
    try {
      const { data, error } = await supabase
        .rpc('calculate_promotion_discount', {
          p_employee_id: employeeId,
          p_product_id: productId,
          p_original_price: originalPrice
        });

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error calculating discount:', err);
      return originalPrice;
    }
  };

  return { promotions, loading, error, calculateDiscountedPrice };
};
