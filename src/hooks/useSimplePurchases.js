import { useState, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';

export const useSimplePurchases = () => {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(false);
  const { addExpense, refetchData } = useInventory();
  const { user } = useAuth();

  const addPurchase = useCallback(async (purchaseData) => {
    setLoading(true);
    console.log('🛒 بدء إضافة فاتورة شراء جديدة:', purchaseData);
    
    try {
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

      // 2. إنشاء الفاتورة (total_amount = فقط تكلفة المنتجات)
      const { data: newPurchase, error: purchaseError } = await supabase
        .from('purchases')
        .insert({
          supplier_name: purchaseData.supplier,
          supplier_contact: purchaseData.supplierContact || null,
          total_amount: itemsTotal, // فقط تكلفة المنتجات
          paid_amount: grandTotal, // المبلغ المدفوع الكامل
          shipping_cost: shippingCost,
          transfer_cost: transferCost,
          purchase_date: purchaseData.purchaseDate ? 
            new Date(purchaseData.purchaseDate + 'T' + new Date().toTimeString().split(' ')[0]).toISOString() : 
            new Date().toISOString(),
          cash_source_id: purchaseData.cashSourceId,
          status: 'completed',
          items: purchaseData.items,
          created_by: user?.user_id
        })
        .select()
        .single();

      if (purchaseError) throw purchaseError;
      console.log('✅ تم إنشاء الفاتورة:', newPurchase);

      // 3. معالجة كل منتج بشكل بسيط ومضمون
      for (const item of purchaseData.items) {
        await processProductSimple(item, newPurchase, user?.user_id);
      }

      // 4. خصم المبلغ الكامل من مصدر النقد
      if (purchaseData.cashSourceId && grandTotal > 0) {
        const { error: cashError } = await supabase.rpc('update_cash_source_balance', {
          p_cash_source_id: purchaseData.cashSourceId,
          p_amount: grandTotal,
          p_movement_type: 'out',
          p_reference_type: 'purchase',
          p_reference_id: newPurchase.id,
          p_description: `فاتورة شراء ${newPurchase.purchase_number} - ${purchaseData.supplier}`,
          p_created_by: user?.user_id
        });

        if (cashError) throw new Error(`فشل خصم المبلغ: ${cashError.message}`);
        console.log('✅ تم خصم المبلغ من مصدر النقد');
      }

      // 5. إضافة المصاريف
      await addExpensesForPurchase(newPurchase, itemsTotal, shippingCost, transferCost, purchaseData.supplier, addExpense);

      // 6. تحديث قائمة المشتريات
      setPurchases(prev => [newPurchase, ...prev]);
      
      // إعادة تحميل البيانات
      setTimeout(() => refetchData?.(), 500);

      console.log('🎉 تمت العملية بنجاح');
      toast({ 
        title: 'نجح', 
        description: `تمت إضافة فاتورة الشراء رقم ${newPurchase.purchase_number} بمبلغ ${grandTotal.toLocaleString()} د.ع`,
        variant: 'success'
      });

      return { success: true, purchase: newPurchase };
    } catch (error) {
      console.error("❌ خطأ في إضافة فاتورة الشراء:", error);
      toast({ 
        title: 'خطأ', 
        description: `فشل إضافة الفاتورة: ${error.message}`, 
        variant: 'destructive' 
      });
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [addExpense, refetchData, user]);

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('purchases')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPurchases(data || []);
    } catch (error) {
      console.error("خطأ في جلب المشتريات:", error);
      toast({ 
        title: 'خطأ', 
        description: 'فشل في جلب بيانات المشتريات', 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const deletePurchase = useCallback(async (purchaseId) => {
    try {
      setLoading(true);
      console.log('🗑️ بدء حذف الفاتورة:', purchaseId);
      
      const { data: result, error: deleteError } = await supabase.rpc('delete_purchase_completely', {
        p_purchase_id: purchaseId
      });

      if (deleteError) throw new Error(`فشل في حذف الفاتورة: ${deleteError.message}`);
      if (!result?.success) throw new Error(result?.error || 'فشل غير محدد في حذف الفاتورة');

      console.log('✅ نتيجة الحذف:', result);
      setPurchases(prev => prev.filter(p => p.id !== purchaseId));
      
      setTimeout(() => refetchData?.(), 500);
      
      toast({ 
        title: 'تم الحذف بنجاح', 
        description: result.message || 'تم حذف الفاتورة وجميع متعلقاتها بنجاح',
        variant: 'success'
      });
      
      return { success: true, purchase: { id: purchaseId, purchase_number: result.purchase_number } };
    } catch (error) {
      console.error("❌ خطأ في حذف فاتورة الشراء:", error);
      toast({ 
        title: 'خطأ في الحذف', 
        description: `فشل حذف الفاتورة: ${error.message}`, 
        variant: 'destructive' 
      });
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [refetchData]);

  return {
    purchases,
    setPurchases,
    loading,
    addPurchase,
    fetchPurchases,
    deletePurchase,
  };
};

// دالة بسيطة ومضمونة لمعالجة المنتجات
async function processProductSimple(item, purchase, userId) {
  try {
    console.log('📦 معالجة المنتج:', item.productName, '- SKU:', item.variantSku);
    
    // البحث عن المنتج الموجود بالاسم أولاً
    const { data: existingProducts } = await supabase
      .from('products')
      .select('id, name')
      .ilike('name', `%${item.productName.trim()}%`)
      .limit(1);

    let productId;
    let variantId;

    if (existingProducts?.length > 0) {
      // المنتج موجود - البحث عن متغير مناسب أو إنشاء جديد
      productId = existingProducts[0].id;
      console.log('📦 المنتج موجود:', existingProducts[0].name);
      
      // البحث عن متغير مناسب (نفس اللون والحجم إن أمكن)
      const { data: existingVariants } = await supabase
        .from('product_variants')
        .select('id, barcode')
        .eq('product_id', productId)
        .limit(5);

      // استخدام أول متغير موجود أو إنشاء جديد
      if (existingVariants?.length > 0) {
        variantId = existingVariants[0].id;
        console.log('🎨 استخدام متغير موجود:', existingVariants[0].barcode);
      } else {
        // إنشاء متغير جديد للمنتج الموجود
        const { data: newVariant, error } = await supabase
          .from('product_variants')
          .insert({
            product_id: productId,
            barcode: item.variantSku,
            sku: item.variantSku,
            price: item.costPrice * 1.3,
            cost_price: item.costPrice,
            is_active: true
          })
          .select('id')
          .single();

        if (error) throw error;
        variantId = newVariant.id;
        console.log('🎨 تم إنشاء متغير جديد');
      }
    } else {
      // إنشاء منتج جديد تماماً
      console.log('🆕 إنشاء منتج جديد:', item.productName);
      
      const { data: newProduct, error: productError } = await supabase
        .from('products')
        .insert({
          name: item.productName.trim(),
          cost_price: item.costPrice,
          base_price: item.costPrice * 1.3,
          is_active: true,
          created_by: userId
        })
        .select('id')
        .single();

      if (productError) throw productError;
      productId = newProduct.id;

      // إنشاء متغير للمنتج الجديد
      const { data: newVariant, error: variantError } = await supabase
        .from('product_variants')
        .insert({
          product_id: productId,
          barcode: item.variantSku,
          sku: item.variantSku,
          price: item.costPrice * 1.3,
          cost_price: item.costPrice,
          is_active: true
        })
        .select('id')
        .single();

      if (variantError) throw variantError;
      variantId = newVariant.id;
    }

    // تحديث أسعار التكلفة
    await supabase.from('products').update({ cost_price: item.costPrice }).eq('id', productId);
    await supabase.from('product_variants').update({ cost_price: item.costPrice }).eq('id', variantId);

    // تحديث/إنشاء المخزون
    const { data: inventory } = await supabase
      .from('inventory')
      .select('id, quantity')
      .eq('product_id', productId)
      .eq('variant_id', variantId)
      .single();

    if (inventory) {
      // تحديث الكمية الموجودة
      await supabase
        .from('inventory')
        .update({
          quantity: inventory.quantity + item.quantity,
          updated_at: new Date().toISOString(),
          last_updated_by: userId
        })
        .eq('id', inventory.id);
      console.log(`📈 تم تحديث المخزون: ${inventory.quantity} + ${item.quantity} = ${inventory.quantity + item.quantity}`);
    } else {
      // إنشاء سجل مخزون جديد
      await supabase
        .from('inventory')
        .insert({
          product_id: productId,
          variant_id: variantId,
          quantity: item.quantity,
          min_stock: 0,
          reserved_quantity: 0,
          last_updated_by: userId
        });
      console.log(`📈 تم إنشاء مخزون جديد: ${item.quantity}`);
    }

    // إضافة سجل تكلفة الشراء
    await supabase
      .from('purchase_cost_history')
      .insert({
        product_id: productId,
        variant_id: variantId,
        purchase_id: purchase.id,
        quantity: item.quantity,
        remaining_quantity: item.quantity,
        unit_cost: item.costPrice,
        purchase_date: purchase.purchase_date
      });

    // إضافة سجل في purchase_items
    await supabase
      .from('purchase_items')
      .insert({
        purchase_id: purchase.id,
        product_id: productId,
        variant_id: variantId,
        quantity: item.quantity,
        unit_cost: item.costPrice,
        total_cost: item.costPrice * item.quantity
      });

    console.log(`✅ تم معالجة المنتج ${item.productName} بنجاح`);
  } catch (error) {
    console.error(`❌ فشل معالجة المنتج ${item.productName}:`, error);
    throw error;
  }
}

// دالة لإضافة المصاريف
async function addExpensesForPurchase(purchase, itemsTotal, shippingCost, transferCost, supplier, addExpenseFunction) {
  
  try {
    // 1. مصروف المنتجات
    if (itemsTotal > 0) {
      await addExpenseFunction({
        category: 'مشتريات',
        expense_type: 'operational',
        description: `شراء بضاعة - فاتورة ${purchase.purchase_number} من ${supplier}`,
        amount: itemsTotal,
        vendor_name: supplier,
        receipt_number: purchase.purchase_number,
        status: 'approved'
      });
      console.log(`✅ مصروف المشتريات: ${itemsTotal} د.ع`);
    }

    // 2. مصروف الشحن
    if (shippingCost > 0) {
      await addExpenseFunction({
        category: 'شحن ونقل',
        expense_type: 'operational',
        description: `تكلفة شحن فاتورة شراء ${purchase.purchase_number} - ${supplier}`,
        amount: shippingCost,
        vendor_name: supplier,
        receipt_number: purchase.purchase_number + '-SHIP',
        status: 'approved'
      });
      console.log(`✅ مصروف الشحن: ${shippingCost} د.ع`);
    }

    // 3. مصروف التحويل
    if (transferCost > 0) {
      await addExpenseFunction({
        category: 'تكاليف التحويل',
        expense_type: 'operational',
        description: `تكلفة تحويل مالي فاتورة شراء ${purchase.purchase_number} - ${supplier}`,
        amount: transferCost,
        vendor_name: supplier,
        receipt_number: purchase.purchase_number + '-TRANSFER',
        status: 'approved'
      });
      console.log(`✅ مصروف التحويل: ${transferCost} د.ع`);
    }
  } catch (error) {
    console.error('❌ خطأ في إضافة المصاريف:', error);
    // لا نرمي خطأ هنا لأن الفاتورة تمت بنجاح
  }
}