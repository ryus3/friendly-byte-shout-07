import React, { useEffect } from 'react';
import { useInventory } from '@/contexts/InventoryContext';

/**
 * مكون مساعد لتحميل البيانات الصحيحة في وضع التعديل
 */
export const EditOrderDataLoader = ({ aiOrderData, isEditMode, onDataLoaded }) => {
  const { allData, addToCart, clearCart } = useInventory();

  useEffect(() => {
    if (!isEditMode || !aiOrderData?.items || !Array.isArray(aiOrderData.items)) {
      return;
    }

    console.log('🔧 EditOrderDataLoader - بدء تحميل البيانات للتعديل');

    const loadRealProducts = async () => {
      // مسح السلة أولاً
      clearCart();

      // تحميل كل منتج بشكل صحيح
      for (const item of aiOrderData.items) {
        if (item?.product_id && item?.variant_id) {
          console.log('🔍 تحميل منتج:', item);

          // البحث عن المنتج الحقيقي في البيانات الموحدة
          const realProduct = allData?.products?.find(p => p.id === item.product_id);
          const realVariant = allData?.product_variants?.find(v => v.id === item.variant_id);

          if (realProduct && realVariant) {
            console.log('✅ تم العثور على المنتج والمتغير الحقيقي');
            
            // إضافة المنتج الحقيقي للسلة
            addToCart(realProduct, realVariant, item.quantity || 1, false);
          } else {
            console.log('⚠️ لم يتم العثور على المنتج، استخدام البيانات المؤقتة');
            
            // إنشاء كائنات مؤقتة مع البيانات الأصلية
            const tempProduct = {
              id: item.product_id,
              name: item.productName || item.product_name || 'منتج',
              images: [item.image || '/placeholder.svg'],
              price: item.unit_price || item.price || 0,
              cost_price: item.costPrice || item.cost_price || 0
            };

            const tempVariant = {
              id: item.variant_id,
              sku: item.sku || '',
              color: item.color || '',
              size: item.size || '',
              quantity: 999, // مخزون افتراضي
              reserved: 0,
              price: item.unit_price || item.price || 0,
              cost_price: item.costPrice || item.cost_price || 0,
              image: item.image || '/placeholder.svg',
              barcode: item.barcode || ''
            };

            addToCart(tempProduct, tempVariant, item.quantity || 1, false);
          }
        }
      }

      // إشعار بانتهاء التحميل
      if (onDataLoaded) {
        onDataLoaded();
      }
      
      console.log('✅ EditOrderDataLoader - تم تحميل جميع المنتجات');
    };

    loadRealProducts();
  }, [isEditMode, aiOrderData, allData, addToCart, clearCart, onDataLoaded]);

  // هذا المكون لا يعرض شيئاً - فقط يحمل البيانات
  return null;
};

export default EditOrderDataLoader;