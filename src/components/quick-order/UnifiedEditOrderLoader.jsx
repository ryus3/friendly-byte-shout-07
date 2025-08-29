import React, { useEffect } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { supabase } from '@/integrations/supabase/client';

/**
 * مكون محسن لتحميل البيانات الحقيقية في وضع التعديل
 * يدعم التعديل الكامل للمنتجات (إضافة، حذف، تعديل)
 */
export const UnifiedEditOrderLoader = ({ aiOrderData, isEditMode, onDataLoaded }) => {
  const { allData, addToCart, clearCart } = useInventory();

  useEffect(() => {
    if (!isEditMode || !aiOrderData?.items || !Array.isArray(aiOrderData.items)) {
      return;
    }

    console.log('🔧 UnifiedEditOrderLoader - بدء تحميل البيانات للتعديل الكامل');

    const loadFullEditableProducts = async () => {
      try {
        // مسح السلة أولاً
        clearCart();

        // تحميل جميع المنتجات الحقيقية من قاعدة البيانات
        for (const item of aiOrderData.items) {
          if (item?.product_id && item?.variant_id) {
            console.log('🔍 تحميل منتج حقيقي للتعديل:', item);

            try {
              // تحميل المنتج والمتغير الكامل من قاعدة البيانات
              const { data: productData, error: productError } = await supabase
                .from('products')
                .select(`
                  *,
                  product_variants!inner (
                    *,
                    colors (id, name, hex_code),
                    sizes (id, name),
                    inventory (quantity, reserved_quantity, min_stock)
                  )
                `)
                .eq('id', item.product_id)
                .eq('product_variants.id', item.variant_id)
                .single();

              if (productError) {
                console.warn('⚠️ خطأ في تحميل المنتج من قاعدة البيانات:', productError);
                throw new Error(productError.message);
              }

              if (productData && productData.product_variants?.[0]) {
                const fullProduct = productData;
                const fullVariant = productData.product_variants[0];
                
                console.log('✅ تم تحميل المنتج الكامل للتعديل:', {
                  product: fullProduct.name,
                  variant: fullVariant.id,
                  color: fullVariant.colors?.name,
                  size: fullVariant.sizes?.name,
                  stock: fullVariant.inventory?.[0]?.quantity || 0
                });
                
                // إضافة المنتج الحقيقي للسلة مع إمكانية التعديل الكامل
                addToCart(fullProduct, fullVariant, item.quantity || 1, false);
              } else {
                throw new Error('المنتج غير موجود في قاعدة البيانات');
              }
            } catch (error) {
              console.log('⚠️ فشل تحميل المنتج من قاعدة البيانات، محاولة البحث في البيانات المحملة...');
              
              // البحث في البيانات المحملة كبديل
              const cachedProduct = allData?.products?.find(p => p.id === item.product_id);
              const cachedVariant = allData?.product_variants?.find(v => v.id === item.variant_id);

              if (cachedProduct && cachedVariant) {
                console.log('✅ تم العثور على المنتج في البيانات المحملة');
                addToCart(cachedProduct, cachedVariant, item.quantity || 1, false);
              } else {
                console.log('⚠️ إنشاء منتج مؤقت قابل للتعديل الكامل');
                
                // إنشاء كائنات مؤقتة قابلة للتعديل الكامل
                const editableProduct = {
                  id: item.product_id,
                  name: item.productName || item.product_name || 'منتج قابل للتعديل',
                  images: [item.image || '/placeholder.svg'],
                  price: item.unit_price || item.price || 0,
                  cost_price: item.costPrice || item.cost_price || 0,
                  is_active: true,
                  is_temp_editable: true // تمييز خاص للمنتجات المؤقتة القابلة للتعديل
                };

                const editableVariant = {
                  id: item.variant_id,
                  product_id: item.product_id,
                  sku: item.sku || `temp-${item.variant_id}`,
                  colors: { 
                    id: 'temp-color', 
                    name: item.color || 'افتراضي',
                    hex_code: '#808080'
                  },
                  sizes: { 
                    id: 'temp-size', 
                    name: item.size || 'افتراضي'
                  },
                  quantity: 999, // مخزون عالي للتعديل الحر
                  reserved_quantity: 0,
                  price: item.unit_price || item.price || 0,
                  cost_price: item.costPrice || item.cost_price || 0,
                  images: [item.image || '/placeholder.svg'],
                  barcode: item.barcode || '',
                  is_active: true,
                  is_temp_editable: true, // تمييز خاص للمتغيرات المؤقتة القابلة للتعديل
                  inventory: [{
                    quantity: 999,
                    reserved_quantity: 0,
                    min_stock: 0
                  }]
                };

                addToCart(editableProduct, editableVariant, item.quantity || 1, false);
                
                console.log('✅ تم إنشاء منتج مؤقت قابل للتعديل الكامل');
              }
            }
          }
        }

        // إشعار بانتهاء التحميل
        if (onDataLoaded) {
          onDataLoaded();
        }
        
        console.log('✅ UnifiedEditOrderLoader - تم تحميل جميع المنتجات للتعديل الكامل');
      } catch (error) {
        console.error('❌ خطأ في تحميل المنتجات للتعديل:', error);
        
        // في حالة الفشل، إشعار بانتهاء التحميل لمنع التجمد
        if (onDataLoaded) {
          onDataLoaded();
        }
      }
    };

    loadFullEditableProducts();
  }, [isEditMode, aiOrderData, allData, addToCart, clearCart, onDataLoaded]);

  // هذا المكون لا يعرض شيئاً - فقط يحمل البيانات
  return null;
};

export default UnifiedEditOrderLoader;