/**
 * أداة لتحديث الباركود للمتغيرات الموجودة
 * تشغل مرة واحدة لضمان وجود باركود فريد لكل متغير
 */

import { supabase } from '@/lib/customSupabaseClient';
import { generateUniqueBarcode, isBarcodeUnique } from '@/lib/barcode-utils';

export const updateExistingVariantsBarcodes = async () => {
  try {
    console.log('🔄 بدء تحديث الباركود للمتغيرات الموجودة...');

    // جلب جميع المتغيرات التي لا تحتوي على باركود أو باركود غير صحيح
    const { data: variants, error: variantsError } = await supabase
      .from('product_variants')
      .select(`
        *,
        products (id, name),
        colors (name),
        sizes (name)
      `)
      .or('barcode.is.null,barcode.eq.');

    if (variantsError) {
      console.error('خطأ في جلب المتغيرات:', variantsError);
      return;
    }

    if (!variants || variants.length === 0) {
      console.log('✅ جميع المتغيرات تحتوي على باركود صحيح');
      return;
    }

    console.log(`📦 العثور على ${variants.length} متغير يحتاج لباركود`);

    // جلب جميع المنتجات لفحص تفرد الباركود
    const { data: allProducts } = await supabase
      .from('products')
      .select('*, variants:product_variants(*)');

    const updatedVariants = [];

    for (const variant of variants) {
      try {
        const productName = variant.products?.name || 'منتج';
        const colorName = variant.colors?.name || 'لون افتراضي';
        const sizeName = variant.sizes?.name || 'حجم افتراضي';

        let uniqueBarcode;
        let attempts = 0;
        const maxAttempts = 10;

        // محاولة توليد باركود فريد
        do {
          uniqueBarcode = generateUniqueBarcode(
            productName,
            colorName,
            sizeName,
            variant.product_id
          );
          attempts++;
        } while (
          !isBarcodeUnique(uniqueBarcode, allProducts, variant.id) && 
          attempts < maxAttempts
        );

        if (attempts >= maxAttempts) {
          console.warn(`⚠️ فشل في توليد باركود فريد للمتغير ${variant.id} بعد ${maxAttempts} محاولات`);
          continue;
        }

        updatedVariants.push({
          id: variant.id,
          barcode: uniqueBarcode
        });

        console.log(`✅ تم توليد باركود للمتغير: ${productName} - ${colorName} - ${sizeName} = ${uniqueBarcode}`);

      } catch (error) {
        console.error(`❌ خطأ في معالجة المتغير ${variant.id}:`, error);
      }
    }

    // تحديث المتغيرات في قاعدة البيانات على دفعات
    const batchSize = 50;
    for (let i = 0; i < updatedVariants.length; i += batchSize) {
      const batch = updatedVariants.slice(i, i + batchSize);
      
      for (const variant of batch) {
        const { error } = await supabase
          .from('product_variants')
          .update({ barcode: variant.barcode })
          .eq('id', variant.id);

        if (error) {
          console.error(`❌ خطأ في تحديث المتغير ${variant.id}:`, error);
        }
      }
      
      console.log(`📦 تم تحديث ${Math.min(i + batchSize, updatedVariants.length)} من ${updatedVariants.length} متغير`);
    }

    console.log(`🎉 تم الانتهاء من تحديث ${updatedVariants.length} متغير بنجاح!`);
    return { success: true, updated: updatedVariants.length };

  } catch (error) {
    console.error('❌ خطأ عام في تحديث الباركود:', error);
    return { success: false, error: error.message };
  }
};

/**
 * فحص تفرد جميع الباركود في النظام
 */
export const validateAllBarcodes = async () => {
  try {
    const { data: variants } = await supabase
      .from('product_variants')
      .select('id, barcode, products(name)');

    if (!variants) return { valid: true, duplicates: [] };

    const barcodeMap = new Map();
    const duplicates = [];

    variants.forEach(variant => {
      if (variant.barcode) {
        if (barcodeMap.has(variant.barcode)) {
          duplicates.push({
            barcode: variant.barcode,
            variants: [barcodeMap.get(variant.barcode), variant]
          });
        } else {
          barcodeMap.set(variant.barcode, variant);
        }
      }
    });

    return {
      valid: duplicates.length === 0,
      duplicates,
      totalVariants: variants.length,
      withBarcode: variants.filter(v => v.barcode).length
    };

  } catch (error) {
    console.error('خطأ في فحص الباركود:', error);
    return { valid: false, error: error.message };
  }
};