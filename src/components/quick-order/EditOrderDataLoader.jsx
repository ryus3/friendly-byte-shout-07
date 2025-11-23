import React, { useEffect } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { supabase } from '@/integrations/supabase/client';

/**
 * مكون مساعد لتحميل البيانات الصحيحة في وضع التعديل
 */
export const EditOrderDataLoader = ({ aiOrderData, isEditMode, onDataLoaded }) => {
  const { allData, addToCart, clearCart } = useInventory();

  useEffect(() => {
    if (!isEditMode || !aiOrderData?.items || !Array.isArray(aiOrderData.items)) {
      return;
    }

    const loadRealProducts = async () => {
      clearCart();

      for (const item of aiOrderData.items) {
        if (item?.product_id && item?.variant_id) {
          try {
            const { data: productData, error: productError } = await supabase
              .from('products')
              .select(`
                *,
                product_variants!inner (
                  *,
                  colors (name, hex_code),
                  sizes (name),
                  inventory (quantity, reserved_quantity)
                )
              `)
              .eq('id', item.product_id)
              .eq('product_variants.id', item.variant_id)
              .single();

            if (productError) {
              throw new Error(productError.message);
            }

            if (productData && productData.product_variants?.[0]) {
              const realProduct = productData;
              const realVariant = productData.product_variants[0];
              
              addToCart(realProduct, realVariant, item.quantity || 1, false);
            } else {
              throw new Error('المنتج غير موجود في قاعدة البيانات');
            }
          } catch (error) {
            const realProduct = allData?.products?.find(p => p.id === item.product_id);
            const realVariant = allData?.product_variants?.find(v => v.id === item.variant_id);

            if (realProduct && realVariant) {
              addToCart(realProduct, realVariant, item.quantity || 1, false);
            } else {
              
              // إنشاء كائنات مؤقتة قابلة للتعديل
              const tempProduct = {
                id: item.product_id,
                name: item.productName || item.product_name || 'منتج',
                images: [item.image || '/placeholder.svg'],
                price: item.unit_price || item.price || 0,
                cost_price: item.costPrice || item.cost_price || 0,
                is_temp: true // تمييز المنتجات المؤقتة
              };

              const tempVariant = {
                id: item.variant_id,
                product_id: item.product_id,
                sku: item.sku || '',
                colors: { name: item.color || '' },
                sizes: { name: item.size || '' },
                quantity: 999, // مخزون افتراضي عالي للتعديل
                reserved_quantity: 0,
                price: item.unit_price || item.price || 0,
                cost_price: item.costPrice || item.cost_price || 0,
                images: [item.image || '/placeholder.svg'],
                barcode: item.barcode || '',
                is_temp: true // تمييز المتغيرات المؤقتة
              };

              addToCart(tempProduct, tempVariant, item.quantity || 1, false);
            }
          }
        }
      }

      // إشعار بانتهاء التحميل
      if (onDataLoaded) {
        onDataLoaded();
      }
      
      console.log('✅ EditOrderDataLoader - تم تحميل جميع المنتجات للتعديل');
    };

    loadRealProducts();
  }, [isEditMode, aiOrderData, allData, addToCart, clearCart, onDataLoaded]);

  // هذا المكون لا يعرض شيئاً - فقط يحمل البيانات
  return null;
};

export default EditOrderDataLoader;