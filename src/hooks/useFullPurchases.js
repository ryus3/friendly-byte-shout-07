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
          
          const { error: stockError } = await supabase.rpc('update_variant_stock_from_purchase', {
            p_sku: item.variantSku,
            p_quantity_change: item.quantity,
            p_cost_price: item.costPrice
          });
          
          if (stockError) {
            console.error(`❌ خطأ في تحديث مخزون ${item.variantSku}:`, stockError);
            throw new Error(`فشل في تحديث مخزون ${item.variantSku}: ${stockError.message}`);
          }
          
          console.log(`✅ تم تحديث مخزون ${item.variantSku} بنجاح`);
        } catch (error) {
          console.error(`❌ فشل تحديث مخزون ${item.variantSku}:`, error);
          throw error;
        }
      }

      // خصم المبلغ من مصدر النقد
      if (purchaseData.cashSourceId && totalAmount > 0) {
        console.log('💰 خصم المبلغ من مصدر النقد:', {
          cashSourceId: purchaseData.cashSourceId,
          amount: totalAmount
        });

        const { error: cashError } = await supabase.rpc('update_cash_source_balance', {
          p_cash_source_id: purchaseData.cashSourceId,
          p_amount: totalAmount,
          p_movement_type: 'out',
          p_reference_type: 'purchase',
          p_reference_id: newPurchase.id,
          p_description: `فاتورة شراء ${newPurchase.purchase_number} - ${purchaseData.supplier}`,
          p_created_by: user?.user_id
        });

        if (cashError) {
          console.error('❌ خطأ في خصم المبلغ:', cashError);
          throw new Error(`فشل في خصم المبلغ من مصدر النقد: ${cashError.message}`);
        }

        console.log('✅ تم خصم المبلغ من مصدر النقد بنجاح');
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
      
      // استخدام الوظيفة الجديدة للحذف الشامل
      const { data: result, error: deleteError } = await supabase.rpc('delete_purchase_completely', {
        p_purchase_id: purchaseId
      });

      if (deleteError) {
        console.error('❌ خطأ في حذف الفاتورة:', deleteError);
        throw new Error(`فشل في حذف الفاتورة: ${deleteError.message}`);
      }

      if (!result?.success) {
        console.error('❌ فشل حذف الفاتورة:', result?.error);
        throw new Error(result?.error || 'فشل غير محدد في حذف الفاتورة');
      }

      console.log('✅ نتيجة الحذف:', result);

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