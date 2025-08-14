import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const useImprovedPurchases = () => {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processingPurchaseId, setProcessingPurchaseId] = useState(null);

  // جلب جميع فواتير الشراء
  const fetchPurchases = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('purchases')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPurchases(data || []);
    } catch (error) {
      console.error('خطأ في جلب فواتير الشراء:', error);
      toast({
        title: "خطأ في جلب البيانات",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // إضافة فاتورة شراء جديدة - محسّنة ومضمونة
  const addPurchase = async (purchaseData) => {
    const startTime = Date.now();
    const uniqueId = `purchase_${startTime}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`🛒 [${uniqueId}] بدء إضافة فاتورة شراء محسّنة`);
    
    // منع الاستدعاءات المتكررة بطرق متعددة
    if (loading || processingPurchaseId) {
      console.log(`⚠️ [${uniqueId}] تم تجاهل الاستدعاء - عملية قيد التنفيذ:`, {
        loading,
        processingPurchaseId
      });
      return { success: false, error: 'عملية إضافة فاتورة قيد التنفيذ بالفعل' };
    }
    
    setProcessingPurchaseId(uniqueId);
    setLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('المستخدم غير مصرح له');

      // 1. حساب التكاليف
      const itemsTotal = purchaseData.items.reduce((sum, item) => 
        sum + (Number(item.costPrice) * Number(item.quantity)), 0
      );
      const shippingCost = Number(purchaseData.shippingCost) || 0;
      const transferCost = Number(purchaseData.transferCost) || 0;
      const grandTotal = itemsTotal + shippingCost + transferCost;

      console.log(`💰 [${uniqueId}] حساب التكاليف:`, {
        itemsTotal,
        shippingCost,
        transferCost,
        grandTotal,
        supplier: purchaseData.supplier
      });

      // التحقق من صحة البيانات
      if (grandTotal <= 0) {
        throw new Error('إجمالي المبلغ يجب أن يكون أكبر من الصفر');
      }

      // 2. إنشاء الفاتورة
      const { data: newPurchase, error: purchaseError } = await supabase
        .from('purchases')
        .insert({
          supplier_name: purchaseData.supplier,
          supplier_contact: purchaseData.supplierContact || null,
          total_amount: itemsTotal,
          paid_amount: grandTotal,
          shipping_cost: shippingCost,
          transfer_cost: transferCost,
          purchase_date: purchaseData.purchaseDate || new Date().toISOString().split('T')[0],
          cash_source_id: purchaseData.cashSourceId,
          status: 'completed',
          items: purchaseData.items,
          created_by: user.id
        })
        .select()
        .single();

      if (purchaseError) throw purchaseError;
      console.log(`✅ [${uniqueId}] تم إنشاء الفاتورة:`, newPurchase.purchase_number);

      // 3. معالجة كل منتج بشكل محسّن
      console.log(`📦 [${uniqueId}] بدء معالجة المنتجات - عدد:`, purchaseData.items.length);
      
      const productProcessingPromises = purchaseData.items.map(async (item, index) => {
        console.log(`🔄 [${uniqueId}] معالجة منتج ${index + 1}:`, item.productName, 'SKU:', item.variantSku);
        return await processProductImproved(item, newPurchase, user.id, uniqueId);
      });

      // انتظار معالجة جميع المنتجات
      await Promise.all(productProcessingPromises);

      // 4. خصم المبلغ الكلي مرة واحدة من مصدر النقد
      if (purchaseData.cashSourceId && grandTotal > 0) {
        console.log(`💳 [${uniqueId}] خصم المبلغ من مصدر النقد:`, {
          amount: grandTotal,
          cashSourceId: purchaseData.cashSourceId,
          purchaseId: newPurchase.id,
          purchaseNumber: newPurchase.purchase_number
        });
        
        const { data: cashResult, error: cashError } = await supabase.rpc('update_cash_source_balance', {
          p_cash_source_id: purchaseData.cashSourceId,
          p_amount: grandTotal,
          p_movement_type: 'out',
          p_reference_type: 'purchase',
          p_reference_id: newPurchase.id,
          p_description: `شراء فاتورة رقم ${newPurchase.purchase_number} - إجمالي ${grandTotal.toLocaleString()} د.ع`,
          p_created_by: user.id
        });

        if (cashError) {
          console.error(`❌ [${uniqueId}] خطأ في تحديث رصيد مصدر النقد:`, cashError);
          throw cashError;
        }
        
        console.log(`✅ [${uniqueId}] تم خصم المبلغ من مصدر النقد بنجاح:`, cashResult);
      }

      // 5. إنشاء سجلات المصاريف المفصلة للتتبع (بدون خصم إضافي)
      console.log(`📊 [${uniqueId}] بدء إنشاء سجلات المصاريف المفصلة`);
      const expensePromises = [];
      let expenseCount = 0;
      // مصروف الشراء (تكلفة المنتجات)
      if (itemsTotal > 0) {
        expenseCount++;
        console.log(`📝 [${uniqueId}] إضافة مصروف الشراء: ${itemsTotal.toLocaleString()} د.ع`);
        expensePromises.push(
          supabase.from('expenses').insert({
            category: 'شراء',
            expense_type: 'purchase',
            amount: itemsTotal,
            description: `شراء مواد - فاتورة رقم ${newPurchase.purchase_number} من ${purchaseData.supplier}`,
            receipt_number: newPurchase.purchase_number,
            vendor_name: purchaseData.supplier,
            status: 'approved',
            created_by: user.id,
            approved_by: user.id,
            approved_at: new Date().toISOString(),
            metadata: {
              purchase_reference_id: newPurchase.id,
              auto_approved: true,
              expense_component: 'main_purchase',
              unique_processing_id: uniqueId
            }
          })
        );
      }

      // مصروف الشحن
      if (shippingCost > 0) {
        expenseCount++;
        console.log(`📝 [${uniqueId}] إضافة مصروف الشحن: ${shippingCost.toLocaleString()} د.ع`);
        expensePromises.push(
          supabase.from('expenses').insert({
            category: 'شحن ونقل',
            expense_type: 'shipping',
            amount: shippingCost,
            description: `مصاريف شحن - فاتورة رقم ${newPurchase.purchase_number}`,
            receipt_number: `${newPurchase.purchase_number}-SHIP`,
            vendor_name: purchaseData.supplier,
            status: 'approved',
            created_by: user.id,
            approved_by: user.id,
            approved_at: new Date().toISOString(),
            metadata: {
              purchase_reference_id: newPurchase.id,
              auto_approved: true,
              expense_component: 'shipping',
              unique_processing_id: uniqueId
            }
          })
        );
      }

      // مصروف التحويل
      if (transferCost > 0) {
        expenseCount++;
        console.log(`📝 [${uniqueId}] إضافة مصروف التحويل: ${transferCost.toLocaleString()} د.ع`);
        expensePromises.push(
          supabase.from('expenses').insert({
            category: 'تكاليف تحويل',
            expense_type: 'transfer',
            amount: transferCost,
            description: `تكاليف تحويل - فاتورة رقم ${newPurchase.purchase_number}`,
            receipt_number: `${newPurchase.purchase_number}-TRANSFER`,
            vendor_name: purchaseData.supplier,
            status: 'approved',
            created_by: user.id,
            approved_by: user.id,
            approved_at: new Date().toISOString(),
            metadata: {
              purchase_reference_id: newPurchase.id,
              auto_approved: true,
              expense_component: 'transfer',
              unique_processing_id: uniqueId
            }
          })
        );
      }

      // تنفيذ جميع المصاريف
      if (expensePromises.length > 0) {
        console.log(`📊 [${uniqueId}] تنفيذ ${expensePromises.length} مصروف`);
        const expenseResults = await Promise.all(expensePromises);
        let successCount = 0;
        for (const result of expenseResults) {
          if (result.error) {
            console.error(`❌ [${uniqueId}] خطأ في إنشاء مصروف:`, result.error);
          } else {
            successCount++;
            console.log(`✅ [${uniqueId}] تم إنشاء مصروف بنجاح`);
          }
        }
        console.log(`📈 [${uniqueId}] تم إنشاء ${successCount} من ${expensePromises.length} مصروف بنجاح`);
      }

      const processingTime = Date.now() - startTime;
      console.log(`🎉 [${uniqueId}] تمت إضافة الفاتورة بنجاح في ${processingTime}ms - رقم:`, newPurchase.purchase_number);
      
      toast({
        title: "نجح الحفظ",
        description: `تم إنشاء فاتورة رقم ${newPurchase.purchase_number} - إجمالي ${grandTotal.toLocaleString()} د.ع مع ${expenseCount} مصروف`,
      });

      // إعادة جلب البيانات
      await fetchPurchases();
      
      return { success: true, purchase: newPurchase };

    } catch (error) {
      console.error(`❌ [${uniqueId}] خطأ في إضافة فاتورة الشراء:`, error);
      toast({
        title: "فشل في الحفظ",
        description: error.message,
        variant: "destructive",
      });
      return { success: false, error: error.message };
    } finally {
      setProcessingPurchaseId(null);
      setLoading(false);
    }
  };

  // حذف فاتورة شراء
  const deletePurchase = async (purchaseId) => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.rpc('delete_purchase_completely', {
        p_purchase_id: purchaseId
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "تم الحذف بنجاح",
          description: data.message,
        });
        await fetchPurchases();
        return { success: true };
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('خطأ في حذف فاتورة الشراء:', error);
      toast({
        title: "فشل الحذف",
        description: error.message,
        variant: "destructive",
      });
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, []);

  return {
    purchases,
    setPurchases,
    loading,
    addPurchase,
    fetchPurchases,
    deletePurchase,
  };
};

// ============ دوال المساعدة المحسّنة ============

// دالة معالجة المنتج - محسّنة ومضمونة
const processProductImproved = async (item, purchase, userId, uniqueId) => {
  console.log(`🔄 [${uniqueId}] بدء معالجة منتج محسّن:`, {
    productName: item.productName,
    variantSku: item.variantSku,
    quantity: item.quantity,
    costPrice: item.costPrice
  });

  try {
    // 1. استخراج اسم المنتج الأساسي
    const baseProductName = extractBaseProductName(item.productName);
    console.log('📝 اسم المنتج الأساسي:', baseProductName);
    
    // 2. البحث عن المنتج الأساسي
    const { data: existingProducts, error: searchError } = await supabase
      .from('products')
      .select('id, name')
      .ilike('name', `%${baseProductName}%`)
      .limit(1);

    if (searchError) throw searchError;

    let productId;
    let variantId;

    if (existingProducts?.length > 0) {
      // المنتج موجود
      productId = existingProducts[0].id;
      console.log('✅ المنتج موجود:', existingProducts[0].name);
      
      // البحث عن متغير موجود بنفس الباركود/SKU
      const { data: existingVariant } = await supabase
        .from('product_variants')
        .select('id')
        .eq('product_id', productId)
        .or(`barcode.eq.${item.variantSku},sku.eq.${item.variantSku}`)
        .limit(1);

      if (existingVariant?.length > 0) {
        // وجد نفس المتغير
        variantId = existingVariant[0].id;
        console.log('✅ وجد نفس المتغير');
        
        // تحديث سعر التكلفة للمتغير الموجود
        await supabase
          .from('product_variants')
          .update({ 
            cost_price: item.costPrice,
            price: Math.max(item.costPrice * 1.2, item.salePrice || 0),
            updated_at: new Date().toISOString()
          })
          .eq('id', variantId);
      } else {
        // إنشاء متغير جديد للمنتج الموجود
        console.log('🆕 إنشاء متغير جديد للمنتج الموجود');
        variantId = await createVariantForProduct(productId, item);
      }
    } else {
      // إنشاء منتج جديد تماماً
      console.log('🆕 إنشاء منتج جديد تماماً');
      productId = await createNewProduct(baseProductName, item, userId);
      variantId = await createVariantForProduct(productId, item);
    }

    // 3. إضافة عنصر للفاتورة
    await addPurchaseItem(purchase.id, productId, variantId, item);

    // 4. تحديث المخزون
    await updateInventory(productId, variantId, item.quantity, userId);

    // 5. إضافة سجل تكلفة (للـ FIFO)
    await addCostRecord(productId, variantId, purchase.id, item, purchase.purchase_date);

    console.log('✅ تمت معالجة المنتج بنجاح');

  } catch (error) {
    console.error('❌ خطأ في معالجة المنتج:', error);
    throw error;
  }
};

// استخراج اسم المنتج الأساسي بطريقة ذكية
const extractBaseProductName = (fullName) => {
  // مثال: "سوت شيك ليموني 36" -> "سوت شيك"
  const words = fullName.split(' ');
  
  // إزالة الألوان والقياسات والأرقام المعروفة
  const colorWords = ['ليموني', 'سمائي', 'سماوي', 'جوزي', 'أسود', 'أبيض', 'أحمر', 'أزرق', 'ازرق', 'أخضر', 'وردي', 'بنفسجي', 'بني', 'رمادي', 'بيج'];
  const sizeWords = ['S', 'M', 'L', 'XL', 'XXL', 'فري', 'صغير', 'متوسط', 'كبير'];
  
  const filteredWords = words.filter(word => {
    // تجاهل الألوان المعروفة
    if (colorWords.includes(word)) return false;
    // تجاهل القياسات المعروفة
    if (sizeWords.includes(word)) return false;
    // تجاهل الأرقام المحتملة للقياسات
    if (/^\d+$/.test(word) && Number(word) >= 30 && Number(word) <= 60) return false;
    return true;
  });
  
  return filteredWords.length > 0 ? filteredWords.join(' ').trim() : words[0];
};

// إنشاء منتج جديد
const createNewProduct = async (productName, item, userId) => {
  const { data: newProduct, error } = await supabase
    .from('products')
    .insert({
      name: productName,
      cost_price: item.costPrice,
      base_price: Math.max(item.costPrice * 1.3, item.salePrice || 0),
      is_active: true,
      created_by: userId
    })
    .select('id')
    .single();

  if (error) throw error;
  console.log('✅ تم إنشاء منتج جديد:', newProduct.id);
  return newProduct.id;
};

// إنشاء متغير لمنتج بطريقة ذكية مع فحص التكرار
const createVariantForProduct = async (productId, item) => {
  // استخدام اللون والقياس المختارين من المستخدم (إذا كانوا متوفرين)
  // بدلاً من الاستخراج من اسم المنتج
  let colorId, sizeId;
  
  if (item.colorId && item.sizeId) {
    // استخدام البيانات المختارة من المستخدم
    colorId = item.colorId;
    sizeId = item.sizeId;
    console.log('✅ استخدام اللون والقياس المختارين:', { colorId, sizeId });
  } else {
    // استخراج اللون والقياس من اسم المنتج كخيار احتياطي
    const extracted = await extractAndCreateColorAndSize(item.productName);
    colorId = extracted.colorId;
    sizeId = extracted.sizeId;
    console.log('⚠️ استخراج اللون والقياس من اسم المنتج:', { colorId, sizeId });
  }
  
  // البحث عن متغير موجود بنفس المنتج واللون والقياس
  const { data: existingVariantByColorSize } = await supabase
    .from('product_variants')
    .select('id')
    .eq('product_id', productId)
    .eq('color_id', colorId)
    .eq('size_id', sizeId)
    .limit(1);

  if (existingVariantByColorSize?.length > 0) {
    // المتغير موجود، تحديث الباركود والأسعار
    const variantId = existingVariantByColorSize[0].id;
    console.log('✅ وجد متغير بنفس اللون والقياس، سيتم تحديثه:', variantId);
    
    await supabase
      .from('product_variants')
      .update({
        barcode: item.variantSku,
        sku: item.variantSku,
        price: Math.max(item.costPrice * 1.3, item.salePrice || 0),
        cost_price: item.costPrice,
        updated_at: new Date().toISOString()
      })
      .eq('id', variantId);
      
    return variantId;
  }
  
  // إنشاء متغير جديد
  const { data: newVariant, error } = await supabase
    .from('product_variants')
    .insert({
      product_id: productId,
      color_id: colorId,
      size_id: sizeId,
      barcode: item.variantSku,
      sku: item.variantSku,
      price: Math.max(item.costPrice * 1.3, item.salePrice || 0),
      cost_price: item.costPrice,
      is_active: true
    })
    .select('id')
    .single();

  if (error) {
    console.error('خطأ في إنشاء المتغير:', error);
    throw error;
  }
  
  console.log('✅ تم إنشاء متغير جديد:', newVariant.id);
  return newVariant.id;
};

// استخراج وإنشاء اللون والقياس بذكاء
const extractAndCreateColorAndSize = async (productName) => {
  console.log('🎨 استخراج اللون والقياس من:', productName);
  
  // خريطة الألوان المحسّنة
  const colorMap = {
    'ليموني': { name: 'ليموني', hex: '#FFFF00' },
    'سمائي': { name: 'سمائي', hex: '#87CEEB' },
    'سماوي': { name: 'سمائي', hex: '#87CEEB' },
    'جوزي': { name: 'جوزي', hex: '#8B4513' },
    'أسود': { name: 'أسود', hex: '#000000' },
    'أبيض': { name: 'أبيض', hex: '#FFFFFF' },
    'أحمر': { name: 'أحمر', hex: '#FF0000' },
    'أزرق': { name: 'أزرق', hex: '#0000FF' },
    'ازرق': { name: 'أزرق', hex: '#0000FF' },
    'أخضر': { name: 'أخضر', hex: '#008000' },
    'وردي': { name: 'وردي', hex: '#FFC0CB' },
    'بنفسجي': { name: 'بنفسجي', hex: '#8A2BE2' },
    'بني': { name: 'بني', hex: '#A52A2A' },
    'رمادي': { name: 'رمادي', hex: '#808080' },
    'بيج': { name: 'بيج', hex: '#F5F5DC' }
  };
  
  // خريطة القياسات المحسّنة
  const sizeMap = {
    'S': { name: 'S', type: 'letter' },
    'M': { name: 'M', type: 'letter' },
    'L': { name: 'L', type: 'letter' },
    'XL': { name: 'XL', type: 'letter' },
    'XXL': { name: 'XXL', type: 'letter' },
    'فري': { name: 'فري', type: 'letter' },
    'صغير': { name: 'صغير', type: 'letter' },
    'متوسط': { name: 'متوسط', type: 'letter' },
    'كبير': { name: 'كبير', type: 'letter' }
  };
  
  // إضافة القياسات الرقمية الشائعة
  for (let i = 30; i <= 50; i++) {
    sizeMap[i.toString()] = { name: i.toString(), type: 'number' };
  }
  
  const words = productName.split(' ');
  let detectedColor = null;
  let detectedSize = null;
  
  // البحث عن اللون
  for (const word of words) {
    if (colorMap[word]) {
      detectedColor = colorMap[word];
      break;
    }
  }
  
  // البحث عن القياس
  for (const word of words) {
    if (sizeMap[word]) {
      detectedSize = sizeMap[word];
      break;
    }
  }
  
  console.log('🔍 تم اكتشاف:', { detectedColor, detectedSize });
  
  // إنشاء أو الحصول على اللون
  let colorId = await getOrCreateColor(detectedColor);
  
  // إنشاء أو الحصول على القياس
  let sizeId = await getOrCreateSize(detectedSize);
  
  return { colorId, sizeId };
};

// الحصول على أو إنشاء لون
const getOrCreateColor = async (colorInfo) => {
  if (colorInfo) {
    // البحث عن اللون المحدد
    let { data: existingColor } = await supabase
      .from('colors')
      .select('id')
      .eq('name', colorInfo.name)
      .limit(1);
      
    if (existingColor?.length > 0) {
      console.log('✅ اللون موجود:', colorInfo.name);
      return existingColor[0].id;
    } else {
      const { data: newColor } = await supabase
        .from('colors')
        .insert({ name: colorInfo.name, hex_code: colorInfo.hex })
        .select('id')
        .single();
      console.log('🆕 تم إنشاء لون جديد:', colorInfo.name);
      return newColor.id;
    }
  } else {
    // استخدام اللون الافتراضي
    let { data: defaultColor } = await supabase
      .from('colors')
      .select('id')
      .eq('name', 'افتراضي')
      .limit(1);
      
    if (!defaultColor?.length) {
      const { data: newColor } = await supabase
        .from('colors')
        .insert({ name: 'افتراضي', hex_code: '#808080' })
        .select('id')
        .single();
      return newColor.id;
    }
    return defaultColor[0].id;
  }
};

// الحصول على أو إنشاء قياس
const getOrCreateSize = async (sizeInfo) => {
  if (sizeInfo) {
    // البحث عن القياس المحدد
    let { data: existingSize } = await supabase
      .from('sizes')
      .select('id')
      .eq('name', sizeInfo.name)
      .limit(1);
      
    if (existingSize?.length > 0) {
      console.log('✅ القياس موجود:', sizeInfo.name);
      return existingSize[0].id;
    } else {
      const { data: newSize } = await supabase
        .from('sizes')
        .insert({ name: sizeInfo.name, type: sizeInfo.type })
        .select('id')
        .single();
      console.log('🆕 تم إنشاء قياس جديد:', sizeInfo.name);
      return newSize.id;
    }
  } else {
    // استخدام القياس الافتراضي
    let { data: defaultSize } = await supabase
      .from('sizes')
      .select('id')
      .eq('name', 'افتراضي')
      .limit(1);
      
    if (!defaultSize?.length) {
      const { data: newSize } = await supabase
        .from('sizes')
        .insert({ name: 'افتراضي', type: 'letter' })
        .select('id')
        .single();
      return newSize.id;
    }
    return defaultSize[0].id;
  }
};

// إضافة عنصر للفاتورة
const addPurchaseItem = async (purchaseId, productId, variantId, item) => {
  const { error } = await supabase
    .from('purchase_items')
    .insert({
      purchase_id: purchaseId,
      product_id: productId,
      variant_id: variantId,
      quantity: item.quantity,
      unit_cost: item.costPrice,
      total_cost: item.costPrice * item.quantity
    });

  if (error) throw error;
  console.log('✅ تم إضافة عنصر للفاتورة');
};

// تحديث المخزون
const updateInventory = async (productId, variantId, quantity, userId) => {
  const { data: existingInventory } = await supabase
    .from('inventory')
    .select('quantity')
    .eq('product_id', productId)
    .eq('variant_id', variantId)
    .maybeSingle();

  if (existingInventory) {
    // تحديث الكمية الموجودة
    const { error } = await supabase
      .from('inventory')
      .update({
        quantity: existingInventory.quantity + quantity,
        updated_at: new Date().toISOString(),
        last_updated_by: userId
      })
      .eq('product_id', productId)
      .eq('variant_id', variantId);

    if (error) throw error;
    console.log('✅ تم تحديث المخزون من', existingInventory.quantity, 'إلى', existingInventory.quantity + quantity);
  } else {
    // إنشاء سجل مخزون جديد
    const { error } = await supabase
      .from('inventory')
      .insert({
        product_id: productId,
        variant_id: variantId,
        quantity: quantity,
        min_stock: 0,
        reserved_quantity: 0,
        last_updated_by: userId
      });

    if (error) throw error;
    console.log('✅ تم إنشاء سجل مخزون جديد بكمية:', quantity);
  }
};

// إضافة سجل التكلفة
const addCostRecord = async (productId, variantId, purchaseId, item, purchaseDate) => {
  const { error } = await supabase
    .from('purchase_cost_history')
    .insert({
      product_id: productId,
      variant_id: variantId,
      purchase_id: purchaseId,
      quantity: item.quantity,
      remaining_quantity: item.quantity,
      unit_cost: item.costPrice,
      purchase_date: purchaseDate
    });

  if (error) throw error;
  console.log('✅ تم إضافة سجل التكلفة');
};