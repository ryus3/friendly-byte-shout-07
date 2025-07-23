import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';

export const useSimplePurchases = () => {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(false);

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

  // إضافة فاتورة شراء جديدة
  const addPurchase = async (purchaseData) => {
    console.log('🛒 بدء إضافة فاتورة شراء جديدة:', purchaseData);
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

      console.log('💰 حساب التكاليف:', {
        itemsTotal,
        shippingCost,
        transferCost,
        grandTotal
      });

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
      console.log('✅ تم إنشاء الفاتورة:', newPurchase);

      // 3. معالجة كل منتج
      console.log('📦 بدء معالجة المنتجات - عدد:', purchaseData.items.length);
      for (const item of purchaseData.items) {
        console.log('🔄 معالجة منتج:', item.productName, 'SKU:', item.variantSku);
        await processProductSimple(item, newPurchase, user.id);
      }

      // 4. خصم المبلغ الكلي مرة واحدة من مصدر النقد
      if (purchaseData.cashSourceId) {
        const result = await supabase.rpc('update_cash_source_balance', {
          p_cash_source_id: purchaseData.cashSourceId,
          p_amount: grandTotal,
          p_movement_type: 'out',
          p_reference_type: 'purchase',
          p_reference_id: newPurchase.id,
          p_description: `شراء فاتورة رقم ${newPurchase.purchase_number}`,
          p_created_by: user.id
        });

        if (result.error) {
          console.error('خطأ في تحديث رصيد مصدر النقد:', result.error);
          throw result.error;
        }
      }

      // 5. إنشاء سجلات المصاريف للتتبع فقط (بدون خصم مصدر النقد)
      const expensePromises = [];
      
      // مصروف الشراء (تكلفة المنتجات)
      if (itemsTotal > 0) {
        expensePromises.push(supabase
          .from('expenses')
          .insert({
            category: 'شراء',
            expense_type: 'purchase',
            amount: itemsTotal,
            description: `شراء مواد - فاتورة رقم ${newPurchase.purchase_number}`,
            receipt_number: newPurchase.purchase_number,
            vendor_name: purchaseData.supplier,
            status: 'approved',
            created_by: user.id,
            approved_by: user.id,
            approved_at: new Date().toISOString(),
            metadata: {
              purchase_reference_id: newPurchase.id,
              auto_approved: true,
              cash_deducted_via_purchase: true
            }
          }));
      }

      // مصروف الشحن
      if (shippingCost > 0) {
        expensePromises.push(supabase
          .from('expenses')
          .insert({
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
              cash_deducted_via_purchase: true
            }
          }));
      }

      // مصروف التحويل
      if (transferCost > 0) {
        expensePromises.push(supabase
          .from('expenses')
          .insert({
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
              cash_deducted_via_purchase: true
            }
          }));
      }

      // تنفيذ جميع المصاريف مرة واحدة
      if (expensePromises.length > 0) {
        const expenseResults = await Promise.all(expensePromises);
        for (const result of expenseResults) {
          if (result.error) {
            console.error('خطأ في إنشاء مصروف:', result.error);
          }
        }
      }

      console.log('🎉 تمت إضافة الفاتورة بنجاح');
      toast({
        title: "نجح الحفظ",
        description: `تم إنشاء فاتورة رقم ${newPurchase.purchase_number}`,
      });

      // إعادة جلب البيانات
      await fetchPurchases();
      
      return { success: true, purchase: newPurchase };

    } catch (error) {
      console.error('❌ خطأ في إضافة فاتورة الشراء:', error);
      toast({
        title: "فشل في الحفظ",
        description: error.message,
        variant: "destructive",
      });
      return { success: false, error: error.message };
    } finally {
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

// ============ دوال المساعدة ============

// دالة معالجة المنتج - مبسطة ومضمونة
const processProductSimple = async (item, purchase, userId) => {
  console.log('🔄 بدء معالجة منتج:', {
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

// استخراج اسم المنتج الأساسي
const extractBaseProductName = (fullName) => {
  // مثال: "سوت شيك ليموني 36" -> "سوت شيك"
  const words = fullName.split(' ');
  
  // إزالة الألوان والقياسات المعروفة
  const colorWords = ['ليموني', 'سمائي', 'جوزي', 'أسود', 'أبيض', 'أحمر', 'أزرق', 'أخضر', 'وردي', 'بنفسجي'];
  const sizeWords = ['S', 'M', 'L', 'XL', 'XXL', 'فري', 'صغير', 'متوسط', 'كبير'];
  
  return words.filter(word => 
    !colorWords.includes(word) && 
    !sizeWords.includes(word) && 
    isNaN(word) // ليس رقم
  ).join(' ').trim() || fullName.split(' ')[0]; // إذا لم يبق شيء، خذ أول كلمة
};

// إنشاء منتج جديد
const createNewProduct = async (productName, item, userId) => {
  const { data: newProduct, error } = await supabase
    .from('products')
    .insert({
      name: productName,
      cost_price: item.costPrice,
      base_price: item.costPrice * 1.3,
      is_active: true,
      created_by: userId
    })
    .select('id')
    .single();

  if (error) throw error;
  console.log('✅ تم إنشاء منتج جديد:', newProduct.id);
  return newProduct.id;
};

// إنشاء متغير لمنتج
const createVariantForProduct = async (productId, item) => {
  // الحصول على أو إنشاء لون وقياس افتراضي
  const { colorId, sizeId } = await getOrCreateDefaultColorSize();
  
  const { data: newVariant, error } = await supabase
    .from('product_variants')
    .insert({
      product_id: productId,
      color_id: colorId,
      size_id: sizeId,
      barcode: item.variantSku,
      sku: item.variantSku,
      price: item.costPrice * 1.3,
      cost_price: item.costPrice,
      is_active: true
    })
    .select('id')
    .single();

  if (error) throw error;
  console.log('✅ تم إنشاء متغير جديد:', newVariant.id);
  return newVariant.id;
};

// الحصول على أو إنشاء لون وقياس افتراضي
const getOrCreateDefaultColorSize = async () => {
  // البحث عن اللون الافتراضي أو إنشاؤه
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
    defaultColor = [newColor];
  }

  // البحث عن القياس الافتراضي أو إنشاؤه  
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
    defaultSize = [newSize];
  }

  return {
    colorId: defaultColor[0].id,
    sizeId: defaultSize[0].id
  };
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

// إنشاء سجل مصروف وتحديث رصيد مصدر النقد
const createExpenseRecord = async ({ 
  category, 
  expense_type, 
  amount, 
  description, 
  receipt_number, 
  vendor_name, 
  userId, 
  referenceId,
  skipCashDeduction = false
}) => {
  try {
    // 1. إنشاء سجل المصروف
    const { data: expense, error: expenseError } = await supabase
      .from('expenses')
      .insert({
        category,
        expense_type,
        amount,
        description,
        receipt_number,
        vendor_name,
        status: 'approved', // معتمد تلقائياً للمشتريات
        created_by: userId,
        approved_by: userId,
        approved_at: new Date().toISOString(),
        metadata: {
          purchase_reference_id: referenceId,
          auto_approved: true
        }
      })
      .select()
      .single();

    if (expenseError) throw expenseError;

    console.log(`✅ تم إنشاء مصروف ${category} بمبلغ ${amount}`);
    return expense;

  } catch (error) {
    console.error(`❌ خطأ في إنشاء مصروف ${category}:`, error);
    throw error;
  }
};
