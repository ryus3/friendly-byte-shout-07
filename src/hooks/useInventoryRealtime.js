import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Hook مخصص لمراقبة تحديثات المخزون في الوقت الفعلي
 * يمنع التحديثات المكررة ويحسن الأداء
 */
export const useInventoryRealtime = (setProducts, user) => {
  const inventoryChannelRef = useRef(null);
  const updateTimeoutRef = useRef(null);

  useEffect(() => {
    if (!user || !setProducts) return;

    // إنشاء قناة جديدة لمراقبة المخزون
    inventoryChannelRef.current = supabase
      .channel('inventory-realtime-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'inventory'
        },
        (payload) => {
          console.log('🔄 تحديث المخزون الفوري:', payload);
          
          // استخدام debounce لتجنب التحديثات المفرطة
          if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current);
          }
          
          updateTimeoutRef.current = setTimeout(() => {
            const newData = payload.new;
            if (newData && newData.variant_id) {
              setProducts(prevProducts => 
                prevProducts.map(product => ({
                  ...product,
                  variants: product.variants?.map(variant => {
                    if (variant.id === newData.variant_id) {
                      return {
                        ...variant,
                        quantity: newData.quantity || 0,
                        reserved: newData.reserved_quantity || 0,
                        min_stock: newData.min_stock || 5,
                        location: newData.location || null,
                        inventoryId: newData.id,
                        updated_at: newData.updated_at
                      };
                    }
                    return variant;
                  })
                }))
              );
            }
          }, 300); // انتظار 300ms قبل التحديث
        }
      )
      .subscribe();

    return () => {
      console.log('🔌 إغلاق مراقب المخزون الفوري');
      if (inventoryChannelRef.current) {
        supabase.removeChannel(inventoryChannelRef.current);
        inventoryChannelRef.current = null;
      }
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [user, setProducts]);

  return null;
};