/**
 * مكتبة ترحيل وتحديث الباركود للمنتجات الموجودة
 */

import { supabase } from '@/lib/customSupabaseClient';
import { generateUniqueBarcode, validateBarcode } from '@/lib/barcode-utils';

/**
 * تحديث الباركود للمنتجات والمتغيرات الموجودة
 */
export const updateExistingBarcodes = async () => {
  try {
    console.log('🔄 بدء تحديث الباركود للمنتجات الموجودة...');
    
    // 1. تحديث باركود المنتجات الأساسية
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, barcode')
      .or('barcode.is.null,barcode.eq.""');
      
    if (productsError) throw productsError;
    
    console.log(`📦 العثور على ${products?.length || 0} منتج بحاجة لباركود`);
    
    // تحديث باركود المنتجات
    for (const product of products || []) {
      const newBarcode = generateUniqueBarcode(product.name, 'PRODUCT', 'MAIN', product.id);
      await supabase
        .from('products')
        .update({ barcode: newBarcode })
        .eq('id', product.id);
      console.log(`✅ تم تحديث باركود المنتج: ${product.name} -> ${newBarcode}`);
    }
    
    // 2. تحديث باركود المتغيرات
    const { data: variants, error: variantsError } = await supabase
      .from('product_variants')
      .select(`
        id, 
        product_id, 
        barcode,
        products!inner(name),
        colors(name),
        sizes(name)
      `)
      .or('barcode.is.null,barcode.eq.""');
      
    if (variantsError) throw variantsError;
    
    console.log(`🎨 العثور على ${variants?.length || 0} متغير بحاجة لباركود`);
    
    // تحديث باركود المتغيرات
    for (const variant of variants || []) {
      const productName = variant.products?.name || 'منتج';
      const colorName = variant.colors?.name || 'لون';
      const sizeName = variant.sizes?.name || 'مقاس';
      
      const newBarcode = generateUniqueBarcode(
        productName,
        colorName,
        sizeName,
        variant.product_id
      );
      
      await supabase
        .from('product_variants')
        .update({ barcode: newBarcode })
        .eq('id', variant.id);
        
      console.log(`✅ تم تحديث باركود المتغير: ${productName} (${colorName}-${sizeName}) -> ${newBarcode}`);
    }
    
    console.log('🎉 تم تحديث جميع الباركودات بنجاح!');
    return { success: true, updatedProducts: products?.length || 0, updatedVariants: variants?.length || 0 };
    
  } catch (error) {
    console.error('❌ خطأ في تحديث الباركودات:', error);
    return { success: false, error: error.message };
  }
};

/**
 * التحقق من صحة جميع الباركودات في النظام
 */
export const validateSystemBarcodes = async () => {
  try {
    console.log('🔍 بدء فحص صحة الباركودات...');
    
    // فحص باركود المنتجات
    const { data: products } = await supabase
      .from('products')
      .select('id, name, barcode');
      
    const invalidProducts = products?.filter(p => !validateBarcode(p.barcode)) || [];
    
    // فحص باركود المتغيرات
    const { data: variants } = await supabase
      .from('product_variants')
      .select('id, barcode, products!inner(name)');
      
    const invalidVariants = variants?.filter(v => !validateBarcode(v.barcode)) || [];
    
    console.log(`📊 نتائج الفحص:`);
    console.log(`   - منتجات صحيحة: ${(products?.length || 0) - invalidProducts.length}`);
    console.log(`   - منتجات غير صحيحة: ${invalidProducts.length}`);
    console.log(`   - متغيرات صحيحة: ${(variants?.length || 0) - invalidVariants.length}`);
    console.log(`   - متغيرات غير صحيحة: ${invalidVariants.length}`);
    
    return {
      success: true,
      totalProducts: products?.length || 0,
      invalidProducts: invalidProducts.length,
      totalVariants: variants?.length || 0,
      invalidVariants: invalidVariants.length,
      details: {
        invalidProducts,
        invalidVariants
      }
    };
    
  } catch (error) {
    console.error('❌ خطأ في فحص الباركودات:', error);
    return { success: false, error: error.message };
  }
};

/**
 * تشغيل تحديث الباركود تلقائياً عند تحميل النظام
 */
export const autoUpdateBarcodes = async () => {
  const validationResult = await validateSystemBarcodes();
  if (validationResult.success && (validationResult.invalidProducts > 0 || validationResult.invalidVariants > 0)) {
    console.log('🔧 العثور على باركودات غير صحيحة، سيتم تحديثها تلقائياً...');
    return await updateExistingBarcodes();
  }
  return { success: true, message: 'جميع الباركودات صحيحة' };
};