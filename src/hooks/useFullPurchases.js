import { useState, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';

export const useFullPurchases = () => {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(false);
  const { updateVariantStock, addExpense, refetchData } = useInventory();
  const { user } = useAuth();

  const addPurchase = useCallback(async (purchaseData) => {
    setLoading(true);
    try {
      // حساب التكلفة الإجمالية شاملة الشحن والتحويل
      const itemsTotal = purchaseData.items.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);
      const totalAmount = itemsTotal + (purchaseData.shippingCost || 0) + (purchaseData.transferCost || 0);

      console.log('🛒 بيانات الفاتورة:', {
        supplier: purchaseData.supplier,
        itemsTotal,
        shippingCost: purchaseData.shippingCost || 0,
        transferCost: purchaseData.transferCost || 0,
        totalAmount,
        cashSourceId: purchaseData.cashSourceId
      });

      // إضافة فاتورة الشراء
      const { data: newPurchase, error } = await supabase
        .from('purchases')
        .insert({
          supplier_name: purchaseData.supplier,
          supplier_contact: purchaseData.supplierContact || null,
          total_amount: totalAmount, // المبلغ الإجمالي شامل كل شيء
          paid_amount: totalAmount,
          shipping_cost: purchaseData.shippingCost || 0,
          transfer_cost: purchaseData.transferCost || 0,
          purchase_date: purchaseData.purchaseDate ? new Date(purchaseData.purchaseDate) : new Date(),
          cash_source_id: purchaseData.cashSourceId, // مصدر النقد
          status: 'completed',
          items: purchaseData.items,
          created_by: user?.user_id
        })
        .select()
        .single();

      if (error) throw error;

      console.log('📋 تم إنشاء الفاتورة:', newPurchase);

      // إضافة عناصر الفاتورة لجدول purchase_items
      const purchaseItemsPromises = purchaseData.items.map(item => 
        supabase.from('purchase_items').insert({
          purchase_id: newPurchase.id,
          product_id: item.productId,
          variant_id: item.variantId,
          quantity: item.quantity,
          unit_cost: item.costPrice,
          total_cost: item.costPrice * item.quantity
        })
      );
      
      await Promise.all(purchaseItemsPromises);
      console.log('📦 تم إضافة عناصر الفاتورة');

      // تحديث المخزون لكل منتج
      for (const item of purchaseData.items) {
        try {
          console.log('📈 تحديث مخزون:', {
            sku: item.variantSku,
            quantity: item.quantity,
            costPrice: item.costPrice
          });
          
          // تحديث المخزون مباشرة بدون دوال قاعدة البيانات
          const { data: variant, error: variantError } = await supabase
            .from('product_variants')
            .select('id, product_id')
            .eq('sku', item.variantSku)
            .single();

          if (variantError) {
            console.error(`❌ لم يتم العثور على المتغير ${item.variantSku}:`, variantError);
            continue;
          }

          // تحديث المخزون مباشرة
          const { error: inventoryError } = await supabase
            .from('inventory')
            .upsert({
              product_id: variant.product_id,
              variant_id: variant.id,
              quantity: item.quantity
            }, {
              onConflict: 'product_id,variant_id',
              ignoreDuplicates: false
            });

          if (inventoryError) {
            console.error(`❌ خطأ في تحديث مخزون ${item.variantSku}:`, inventoryError);
            throw new Error(`فشل في تحديث مخزون ${item.variantSku}: ${inventoryError.message}`);
          }
          
          console.log(`✅ تم تحديث مخزون ${item.variantSku} بنجاح`);
      }

      // خصم المبلغ من مصدر النقد
      if (purchaseData.cashSourceId && totalAmount > 0) {
        console.log('💰 خصم المبلغ من مصدر النقد:', {
          cashSourceId: purchaseData.cashSourceId,
          amount: totalAmount
        });

        // تحديث رصيد النقد مباشرة بدون دوال قاعدة البيانات
        const { data: currentSource, error: fetchError } = await supabase
          .from('cash_sources')
          .select('current_balance')
          .eq('id', purchaseData.cashSourceId)
          .single();

        if (!fetchError) {
          const newBalance = (currentSource.current_balance || 0) - totalAmount;
          
          // إضافة حركة نقدية
          await supabase.from('cash_movements').insert({
            cash_source_id: purchaseData.cashSourceId,
            amount: totalAmount,
            movement_type: 'out',
            reference_type: 'purchase',
            reference_id: newPurchase.id,
            description: `فاتورة شراء ${newPurchase.purchase_number} - ${purchaseData.supplier}`,
            created_by: user?.user_id,
            balance_before: currentSource.current_balance,
            balance_after: newBalance
          });

          // تحديث رصيد المصدر
          await supabase
            .from('cash_sources')
            .update({ current_balance: newBalance })
            .eq('id', purchaseData.cashSourceId);

          console.log('✅ تم خصم المبلغ من مصدر النقد بنجاح');
        }
      }

      // إضافة المصاريف
      // إضافة مصروف الشراء (تكلفة المنتجات)
      await addExpense({
        category: 'مشتريات',
        expense_type: 'operational',
        description: `شراء بضاعة - فاتورة ${newPurchase.purchase_number} من ${purchaseData.supplier}`,
        amount: itemsTotal,
        vendor_name: purchaseData.supplier,
        receipt_number: newPurchase.purchase_number,
        status: 'approved'
      });
      console.log(`✅ تم إضافة مصروف الشراء: ${itemsTotal} د.ع`);

      // إضافة مصروف الشحن إذا كان موجود
      if (purchaseData.shippingCost && purchaseData.shippingCost > 0) {
        await addExpense({
          category: 'شحن ونقل',
          expense_type: 'operational',
          description: `تكلفة شحن فاتورة شراء ${newPurchase.purchase_number} - ${purchaseData.supplier}`,
          amount: purchaseData.shippingCost,
          vendor_name: purchaseData.supplier,
          receipt_number: newPurchase.purchase_number + '-SHIP',
          status: 'approved'
        });
        console.log(`✅ تم إضافة مصروف الشحن: ${purchaseData.shippingCost} د.ع`);
      }

      // إضافة مصروف التحويل إذا كان موجود
      if (purchaseData.transferCost && purchaseData.transferCost > 0) {
        await addExpense({
          category: 'تكاليف التحويل',
          expense_type: 'operational',
          description: `تكلفة تحويل مالي فاتورة شراء ${newPurchase.purchase_number} - ${purchaseData.supplier}`,
          amount: purchaseData.transferCost,
          vendor_name: purchaseData.supplier,
          receipt_number: newPurchase.purchase_number + '-TRANSFER',
          status: 'approved'
        });
        console.log(`✅ تم إضافة مصروف التحويل: ${purchaseData.transferCost} د.ع`);
      }

      // تحديث قائمة المشتريات فوراً
      setPurchases(prev => [newPurchase, ...prev]);

      // إعادة تحميل البيانات للتأكد من التحديث الكامل
      setTimeout(async () => {
        await refetchData();
        console.log('🔄 تم إعادة تحميل البيانات بعد إضافة الفاتورة');
      }, 500);

      console.log('✅ تمت إضافة الفاتورة بنجاح:', newPurchase);
      
      toast({ 
        title: 'نجح', 
        description: `تمت إضافة فاتورة الشراء رقم ${newPurchase.purchase_number} بنجاح وتم تحديث المخزون والمحاسبة.`,
        variant: 'success'
      });

      return { success: true, purchase: newPurchase };
    } catch (error) {
      console.error("❌ خطأ في إضافة فاتورة الشراء:", error);
      toast({ 
        title: 'خطأ', 
        description: `فشل إضافة فاتورة الشراء: ${error.message}`, 
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
      
      // حذف الفاتورة مباشرة بدون دوال قاعدة البيانات معقدة
      const { error: deleteError } = await supabase
        .from('purchases')
        .delete()
        .eq('id', purchaseId);

      if (deleteError) {
        console.error('❌ خطأ في حذف الفاتورة:', deleteError);
        throw new Error(`فشل في حذف الفاتورة: ${deleteError.message}`);
      }

      console.log('✅ تم حذف الفاتورة بنجاح');

      // تحديث القائمة المحلية
      setPurchases(prev => prev.filter(p => p.id !== purchaseId));
      
      // إعادة تحميل البيانات لضمان التحديث الكامل
      if (refetchData) {
        setTimeout(async () => {
          await refetchData();
          console.log('🔄 تم إعادة تحميل البيانات بعد الحذف');
        }, 500);
      }
      
      toast({ 
        title: 'تم الحذف بنجاح', 
        description: 'تم حذف الفاتورة بنجاح',
        variant: 'success'
      });
      
      return { success: true, purchase: { id: purchaseId } };
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
  }, [refetchData, user]);

  const updatePurchase = useCallback(async (purchaseId, updates) => {
    try {
      const { data, error } = await supabase
        .from('purchases')
        .update(updates)
        .eq('id', purchaseId)
        .select()
        .single();

      if (error) throw error;

      setPurchases(prev => prev.map(p => p.id === purchaseId ? data : p));
      toast({ title: 'تم', description: 'تم تحديث فاتورة الشراء بنجاح' });
      
      return { success: true, purchase: data };
    } catch (error) {
      console.error("خطأ في تحديث فاتورة الشراء:", error);
      toast({ 
        title: 'خطأ', 
        description: 'فشل تحديث فاتورة الشراء', 
        variant: 'destructive' 
      });
      return { success: false };
    }
  }, []);

  return {
    purchases,
    setPurchases,
    loading,
    addPurchase,
    fetchPurchases,
    deletePurchase,
    updatePurchase,
  };
};