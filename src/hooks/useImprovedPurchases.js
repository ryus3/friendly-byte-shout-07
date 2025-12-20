import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';
import devLog from '@/lib/devLogger';

export const useImprovedPurchases = () => {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processingPurchaseId, setProcessingPurchaseId] = useState(null);

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
      devLog.error('خطأ في جلب فواتير الشراء:', error);
      toast({
        title: "خطأ في جلب البيانات",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const addPurchase = async (purchaseData) => {
    const startTime = Date.now();
    const uniqueId = `purchase_${startTime}_${Math.random().toString(36).substr(2, 9)}`;
    
    devLog.info(`🛒 [${uniqueId}] بدء إضافة فاتورة شراء`);
    
    if (loading || processingPurchaseId) {
      devLog.warn(`⚠️ [${uniqueId}] تم تجاهل - عملية قيد التنفيذ`);
      return { success: false, error: 'عملية إضافة فاتورة قيد التنفيذ بالفعل' };
    }
    
    setProcessingPurchaseId(uniqueId);
    setLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('المستخدم غير مصرح له');

      const itemsTotal = purchaseData.items.reduce((sum, item) => 
        sum + (Number(item.costPrice) * Number(item.quantity)), 0
      );
      const shippingCost = Number(purchaseData.shippingCost) || 0;
      const transferCost = Number(purchaseData.transferCost) || 0;
      const grandTotal = itemsTotal + shippingCost + transferCost;

      devLog.info(`💰 [${uniqueId}] حساب التكاليف - إجمالي: ${grandTotal}`);

      if (grandTotal <= 0) {
        throw new Error('إجمالي المبلغ يجب أن يكون أكبر من الصفر');
      }

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
          created_by: user.id,
          currency: purchaseData.currency || 'IQD',
          exchange_rate: purchaseData.currency === 'USD' ? purchaseData.exchangeRate : 1.0,
          currency_amount: purchaseData.currency === 'USD' ? purchaseData.totalInUSD : null,
        })
        .select()
        .single();

      if (purchaseError) throw purchaseError;
      devLog.info(`✅ [${uniqueId}] تم إنشاء الفاتورة:`, newPurchase.purchase_number);

      const productProcessingPromises = purchaseData.items.map(async (item, index) => {
        return await processProductImproved(item, newPurchase, user.id, uniqueId);
      });

      await Promise.all(productProcessingPromises);

      devLog.info(`🎉 [${uniqueId}] تمت إضافة الفاتورة - رقم:`, newPurchase.purchase_number);
      
      toast({
        title: "نجح الحفظ",
        description: `تم إنشاء فاتورة رقم ${newPurchase.purchase_number} - إجمالي ${grandTotal.toLocaleString()} د.ع`,
      });

      await fetchPurchases();
      
      return { success: true, purchase: newPurchase };

    } catch (error) {
      devLog.error(`❌ [${uniqueId}] خطأ في إضافة فاتورة الشراء:`, error);
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
      devLog.error('خطأ في حذف فاتورة الشراء:', error);
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

// ============ دوال المساعدة ============

const processProductImproved = async (item, purchase, userId, uniqueId) => {
  devLog.log(`🔄 [${uniqueId}] معالجة منتج:`, {
    productName: item.productName,
    variantSku: item.variantSku,
    quantity: item.quantity
  });

  try {
    const baseProductName = extractBaseProductName(item.productName);
    devLog.log('📝 اسم المنتج الأساسي:', baseProductName);
    
    const { data: existingProducts, error: searchError } = await supabase
      .from('products')
      .select('id, name')
      .ilike('name', `%${baseProductName}%`)
      .limit(1);

    if (searchError) throw searchError;

    let productId;
    let variantId;

    if (existingProducts?.length > 0) {
      productId = existingProducts[0].id;
      devLog.log('✅ المنتج موجود:', existingProducts[0].name);
      
      const { data: existingVariant } = await supabase
        .from('product_variants')
        .select('id')
        .eq('product_id', productId)
        .or(`barcode.eq.${item.variantSku},sku.eq.${item.variantSku}`)
        .limit(1);

      if (existingVariant?.length > 0) {
        variantId = existingVariant[0].id;
        
        await supabase
          .from('product_variants')
          .update({ 
            cost_price: item.costPrice,
            price: Math.max(item.costPrice * 1.2, item.salePrice || 0),
            updated_at: new Date().toISOString()
          })
          .eq('id', variantId);
      } else {
        variantId = await createVariantForProduct(productId, item);
      }
    } else {
      productId = await createNewProduct(baseProductName, item, userId);
      variantId = await createVariantForProduct(productId, item);
    }

    await addPurchaseItem(purchase.id, productId, variantId, item);
    await updateInventory(productId, variantId, item.quantity, userId);
    await addCostRecord(productId, variantId, purchase.id, item, purchase.purchase_date);

  } catch (error) {
    devLog.error('❌ خطأ في معالجة المنتج:', error);
    throw error;
  }
};

const extractBaseProductName = (fullName) => {
  const words = fullName.split(' ');
  
  const colorWords = ['ليموني', 'سمائي', 'سماوي', 'جوزي', 'أسود', 'أبيض', 'أحمر', 'أزرق', 'ازرق', 'أخضر', 'وردي', 'بنفسجي', 'بني', 'رمادي', 'بيج'];
  const sizeWords = ['S', 'M', 'L', 'XL', 'XXL', 'فري', 'صغير', 'متوسط', 'كبير'];
  
  const filteredWords = words.filter(word => {
    if (colorWords.includes(word)) return false;
    if (sizeWords.includes(word)) return false;
    if (/^\d+$/.test(word) && Number(word) >= 30 && Number(word) <= 60) return false;
    return true;
  });
  
  return filteredWords.length > 0 ? filteredWords.join(' ').trim() : words[0];
};

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
  return newProduct.id;
};

const createVariantForProduct = async (productId, item) => {
  let colorId, sizeId;
  
  if (item.colorId && item.sizeId) {
    colorId = item.colorId;
    sizeId = item.sizeId;
  } else {
    const extracted = await extractAndCreateColorAndSize(item.productName);
    colorId = extracted.colorId;
    sizeId = extracted.sizeId;
  }
  
  const { data: existingVariantByColorSize } = await supabase
    .from('product_variants')
    .select('id')
    .eq('product_id', productId)
    .eq('color_id', colorId)
    .eq('size_id', sizeId)
    .limit(1);

  if (existingVariantByColorSize?.length > 0) {
    const variantId = existingVariantByColorSize[0].id;
    
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

  if (error) throw error;
  return newVariant.id;
};

const extractAndCreateColorAndSize = async (productName) => {
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
  
  for (let i = 30; i <= 50; i++) {
    sizeMap[i.toString()] = { name: i.toString(), type: 'number' };
  }
  
  const words = productName.split(' ');
  let detectedColor = null;
  let detectedSize = null;
  
  for (const word of words) {
    if (colorMap[word]) {
      detectedColor = colorMap[word];
      break;
    }
  }
  
  for (const word of words) {
    if (sizeMap[word]) {
      detectedSize = sizeMap[word];
      break;
    }
  }
  
  let colorId = await getOrCreateColor(detectedColor);
  let sizeId = await getOrCreateSize(detectedSize);
  
  return { colorId, sizeId };
};

const getOrCreateColor = async (colorInfo) => {
  if (colorInfo) {
    let { data: existingColor } = await supabase
      .from('colors')
      .select('id')
      .eq('name', colorInfo.name)
      .limit(1);
      
    if (existingColor?.length > 0) {
      return existingColor[0].id;
    } else {
      const { data: newColor } = await supabase
        .from('colors')
        .insert({ name: colorInfo.name, hex_code: colorInfo.hex })
        .select('id')
        .single();
      return newColor.id;
    }
  } else {
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

const getOrCreateSize = async (sizeInfo) => {
  if (sizeInfo) {
    let { data: existingSize } = await supabase
      .from('sizes')
      .select('id')
      .eq('name', sizeInfo.name)
      .limit(1);
      
    if (existingSize?.length > 0) {
      return existingSize[0].id;
    } else {
      const { data: newSize } = await supabase
        .from('sizes')
        .insert({ name: sizeInfo.name, type: sizeInfo.type })
        .select('id')
        .single();
      return newSize.id;
    }
  } else {
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
};

const updateInventory = async (productId, variantId, quantity, userId) => {
  const { data: existingInventory } = await supabase
    .from('inventory')
    .select('id, quantity')
    .eq('product_id', productId)
    .eq('variant_id', variantId)
    .limit(1);

  if (existingInventory?.length > 0) {
    const { error } = await supabase
      .from('inventory')
      .update({ 
        quantity: existingInventory[0].quantity + quantity,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingInventory[0].id);
    
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('inventory')
      .insert({
        product_id: productId,
        variant_id: variantId,
        quantity: quantity,
        reserved_quantity: 0
      });
    
    if (error) throw error;
  }
};

const addCostRecord = async (productId, variantId, purchaseId, item, purchaseDate) => {
  const { error } = await supabase
    .from('purchase_cost_history')
    .insert({
      product_id: productId,
      variant_id: variantId,
      purchase_id: purchaseId,
      cost_price: item.costPrice,
      quantity: item.quantity,
      purchase_date: purchaseDate
    });

  if (error) throw error;
};
