import { useState, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';

export const useFullPurchases = () => {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(false);
  const { updateVariantStock, addExpense } = useInventory();
  const { user } = useAuth();

  const addPurchase = useCallback(async (purchaseData) => {
    setLoading(true);
    try {
      // إضافة فاتورة الشراء مع تعديل البيانات
      const { data: newPurchase, error } = await supabase
        .from('purchases')
        .insert({
          supplier_name: purchaseData.supplier,
          supplier_contact: purchaseData.supplierContact || null,
          total_amount: purchaseData.totalCost, // إجمالي المنتجات فقط
          paid_amount: purchaseData.totalCost + (purchaseData.shippingCost || 0) + (purchaseData.transferCost || 0), // المبلغ المدفوع
          shipping_cost: purchaseData.shippingCost || 0, // تكلفة الشحن منفصلة
          transfer_cost: purchaseData.transferCost || 0, // تكاليف التحويل منفصلة
          purchase_date: purchaseData.purchaseDate ? new Date(purchaseData.purchaseDate) : new Date(), // تاريخ الشراء الفعلي
          status: 'completed',
          notes: null, // إزالة الملاحظات
          items: purchaseData.items, // حفظ العناصر كـ JSON أيضاً
          created_by: user?.user_id
        })
        .select()
        .single();

      if (error) throw error;

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

      // تحديث المخزون لكل منتج
      const stockUpdatePromises = purchaseData.items.map(async (item) => {
        try {
          console.log('Updating stock for:', {
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
            console.error(`خطأ في تحديث مخزون ${item.variantSku}:`, stockError);
            throw stockError;
          }
          
          console.log(`تم تحديث مخزون ${item.variantSku} بنجاح`);
        } catch (error) {
          console.error(`فشل تحديث مخزون ${item.variantSku}:`, error);
          throw error;
        }
      });

      await Promise.all(stockUpdatePromises);

      // إضافة المصاريف
      const totalCost = purchaseData.items.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);
      
      // إضافة مصروف البضاعة
      await addExpense({
        category: 'شراء بضاعة',
        expense_type: 'operational',
        description: `فاتورة شراء رقم ${newPurchase.purchase_number} - ${purchaseData.supplier}`,
        amount: totalCost,
        vendor_name: purchaseData.supplier,
        receipt_number: newPurchase.purchase_number,
        status: 'approved'
      });

      // إضافة مصروف الشحن إذا كان موجود
      if (purchaseData.shippingCost && purchaseData.shippingCost > 0) {
        console.log(`إضافة مصروف الشحن: ${purchaseData.shippingCost} د.ع`);
        await addExpense({
          category: 'شحن ونقل',
          expense_type: 'operational',
          description: `تكلفة شحن فاتورة شراء ${newPurchase.purchase_number} - ${purchaseData.supplier}`,
          amount: purchaseData.shippingCost,
          vendor_name: purchaseData.supplier,
          receipt_number: newPurchase.purchase_number + '-SHIP',
          status: 'approved'
        });
        console.log(`تم إضافة مصروف الشحن بنجاح: ${purchaseData.shippingCost} د.ع`);
      } else {
        console.log('لا يوجد مصروف شحن لإضافته');
      }

      // إضافة مصروف التحويل إذا كان موجود
      if (purchaseData.transferCost && purchaseData.transferCost > 0) {
        console.log(`إضافة مصروف التحويل: ${purchaseData.transferCost} د.ع`);
        await addExpense({
          category: 'تكاليف التحويل',
          expense_type: 'operational',
          description: `تكلفة تحويل مالي فاتورة شراء ${newPurchase.purchase_number} - ${purchaseData.supplier}`,
          amount: purchaseData.transferCost,
          vendor_name: purchaseData.supplier,
          receipt_number: newPurchase.purchase_number + '-TRANSFER',
          status: 'approved'
        });
        console.log(`تم إضافة مصروف التحويل بنجاح: ${purchaseData.transferCost} د.ع`);
      } else {
        console.log('لا يوجد مصروف تحويل لإضافته');
      }

      // تحديث قائمة المشتريات فوراً
      setPurchases(prev => [newPurchase, ...prev]);

      // إعادة تحميل البيانات للتأكد من التحديث الكامل
      setTimeout(async () => {
        await fetchPurchases();
        console.log('🔄 تم إعادة تحميل البيانات بعد إضافة الفاتورة');
      }, 100);

      console.log('✅ تمت إضافة الفاتورة بنجاح:', newPurchase);
      
      toast({ 
        title: 'نجح', 
        description: `تمت إضافة فاتورة الشراء رقم ${newPurchase.purchase_number} بنجاح وتم تحديث المخزون والمحاسبة.`,
        variant: 'success'
      });

      return { success: true, purchase: newPurchase };
    } catch (error) {
      console.error("خطأ في إضافة فاتورة الشراء:", error);
      toast({ 
        title: 'خطأ', 
        description: `فشل إضافة فاتورة الشراء: ${error.message}`, 
        variant: 'destructive' 
      });
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [addExpense, fetchPurchases, user]);

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
      console.log('🗑️ بدء عملية حذف الفاتورة:', purchaseId);
      
      // الحصول على تفاصيل الفاتورة قبل الحذف
      const { data: purchaseData, error: fetchError } = await supabase
        .from('purchases')
        .select(`
          *,
          purchase_items (
            id,
            product_id,
            variant_id,
            quantity,
            unit_cost
          )
        `)
        .eq('id', purchaseId)
        .single();

      if (fetchError) {
        console.error('❌ خطأ في جلب بيانات الفاتورة:', fetchError);
        throw fetchError;
      }

      console.log('📋 بيانات الفاتورة المراد حذفها:', purchaseData);

      // 1. حذف المصاريف المرتبطة بالفاتورة (البضاعة والشحن والتحويل)
      console.log('🧾 حذف المصاريف المرتبطة...');
      const { error: expensesError } = await supabase
        .from('expenses')
        .delete()
        .or(`receipt_number.eq.${purchaseData.purchase_number},receipt_number.eq.${purchaseData.purchase_number}-SHIP,receipt_number.eq.${purchaseData.purchase_number}-TRANSFER`);

      if (expensesError) {
        console.error('❌ خطأ في حذف المصاريف:', expensesError);
      } else {
        console.log('✅ تم حذف المصاريف بنجاح');
      }

      // 2. حذف المعاملات المالية المرتبطة بالفاتورة
      console.log('💰 حذف المعاملات المالية...');
      const { error: transactionsError } = await supabase
        .from('financial_transactions')
        .delete()
        .eq('reference_type', 'purchase')
        .eq('reference_id', purchaseId);

      if (transactionsError) {
        console.error('❌ خطأ في حذف المعاملات المالية:', transactionsError);
      } else {
        console.log('✅ تم حذف المعاملات المالية بنجاح');
      }

      // 3. تقليل كمية المخزون للمنتجات المحذوفة
      if (purchaseData.purchase_items && purchaseData.purchase_items.length > 0) {
        console.log('📦 تقليل كمية المخزون...');
        const stockReductionPromises = purchaseData.purchase_items.map(async (item) => {
          try {
            console.log(`📉 تقليل مخزون المنتج ${item.product_id}/${item.variant_id}`);
            
            // الحصول على الكمية الحالية أولاً
            const { data: currentStock } = await supabase
              .from('inventory')
              .select('quantity')
              .eq('product_id', item.product_id)
              .eq('variant_id', item.variant_id)
              .single();

            if (currentStock) {
              const newQuantity = Math.max(0, currentStock.quantity - item.quantity);
              
              const { error: stockError } = await supabase
                .from('inventory')
                .update({ 
                  quantity: newQuantity,
                  updated_at: new Date().toISOString()
                })
                .eq('product_id', item.product_id)
                .eq('variant_id', item.variant_id);
              
              if (stockError) {
                console.error(`❌ خطأ في تقليل مخزون العنصر:`, stockError);
              } else {
                console.log(`✅ تم تقليل مخزون العنصر من ${currentStock.quantity} إلى ${newQuantity}`);
              }
            } else {
              console.log(`⚠️ لم يتم العثور على مخزون للمنتج ${item.product_id}/${item.variant_id}`);
            }
          } catch (error) {
            console.error(`❌ فشل تقليل مخزون العنصر:`, error);
          }
        });
        
        await Promise.all(stockReductionPromises);
        console.log('✅ تم تقليل كمية المخزون بنجاح');
      }

      // 4. حذف عناصر الفاتورة
      console.log('🗑️ حذف عناصر الفاتورة...');
      const { error: itemsError } = await supabase
        .from('purchase_items')
        .delete()
        .eq('purchase_id', purchaseId);

      if (itemsError) {
        console.error('❌ خطأ في حذف عناصر الفاتورة:', itemsError);
        throw itemsError;
      }
      console.log('✅ تم حذف عناصر الفاتورة بنجاح');

      // 5. حذف الفاتورة نفسها
      console.log('🗑️ حذف الفاتورة الأساسية...');
      const { error: purchaseError } = await supabase
        .from('purchases')
        .delete()
        .eq('id', purchaseId);

      if (purchaseError) {
        console.error('❌ خطأ في حذف الفاتورة:', purchaseError);
        throw purchaseError;
      }
      console.log('✅ تم حذف الفاتورة الأساسية بنجاح');

      // 6. تحديث القائمة المحلية
      setPurchases(prev => prev.filter(p => p.id !== purchaseId));
      
      // 7. إعادة تحميل البيانات من قاعدة البيانات
      console.log('🔄 إعادة تحميل قائمة المشتريات...');
      await fetchPurchases();
      
      console.log('🎉 تمت عملية الحذف بالكامل بنجاح!');
      
      toast({ 
        title: '✅ تم الحذف بنجاح', 
        description: 'تم حذف فاتورة الشراء وجميع عناصرها والمصاريف والمعاملات المرتبطة بها نهائياً',
        variant: 'success'
      });
      
      return { success: true };
    } catch (error) {
      console.error("❌ خطأ في حذف فاتورة الشراء:", error);
      toast({ 
        title: '❌ خطأ في الحذف', 
        description: `فشل حذف فاتورة الشراء: ${error.message}`, 
        variant: 'destructive' 
      });
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, [fetchPurchases]);

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