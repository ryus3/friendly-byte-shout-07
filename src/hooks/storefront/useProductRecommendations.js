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
            category:categories(id, name),
            department:departments(id, name),
            variants:product_variants(
              id,
              price,
              images,
              color:colors(id, name, hex_code),
              size:sizes(id, name),
              inventory!inventory_variant_id_fkey(quantity, reserved_quantity)
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

        // فلترة المنتجات التي لها variants متاحة - دعم هيكل مرن
        const availableProducts = data?.filter(product => {
          return product.variants?.some(v => {
            const qty = v.inventory?.quantity ?? v.quantity ?? 0;
            const reserved = v.inventory?.reserved_quantity ?? v.reserved_quantity ?? 0;
            return (qty - reserved) > 0;
          });
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
