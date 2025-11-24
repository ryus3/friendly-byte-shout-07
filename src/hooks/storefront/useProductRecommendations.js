import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Custom hook لجلب المنتجات المشابهة والموصى بها
 */
export const useProductRecommendations = (productId, categoryId, departmentId) => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!productId) {
      setLoading(false);
      return;
    }

    const fetchRecommendations = async () => {
      try {
        setLoading(true);

        // جلب المنتجات المشابهة (نفس الفئة أو القسم)
        let query = supabase
          .from('products')
          .select(`
            *,
            variants:product_variants(
              id,
              color,
              size,
              price,
              quantity,
              reserved_quantity,
              images
            )
          `)
          .neq('id', productId)
          .eq('is_active', true)
          .limit(8);

        // فلترة حسب الفئة أو القسم
        if (categoryId) {
          query = query.eq('category_id', categoryId);
        } else if (departmentId) {
          query = query.eq('department_id', departmentId);
        }

        const { data, error } = await query;

        if (error) throw error;

        // فلترة المنتجات التي لها variants متاحة
        const availableProducts = data?.filter(product => {
          return product.variants?.some(v => 
            (v.quantity - (v.reserved_quantity || 0)) > 0
          );
        }) || [];

        setRecommendations(availableProducts);
      } catch (err) {
        console.error('Error fetching recommendations:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [productId, categoryId, departmentId]);

  return { recommendations, loading };
};
