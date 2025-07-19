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
        await refetchData();
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
      
      console.log('🚀 بدء حذف الفاتورة بشكل شامل:', purchaseId);
      
      // استخدام الدالة المحسنة لحذف الفاتورة بشكل شامل
      const { data: result, error } = await supabase.rpc('delete_purchase_completely', {
        p_purchase_id: purchaseId
      });

      if (error) {
        console.error('خطأ في تنفيذ دالة الحذف الشامل:', error);
        throw error;
      }

      console.log('📊 نتائج عملية الحذف الشامل:', result);

      if (!result.success) {
        throw new Error(result.error || 'فشل في حذف الفاتورة');
      }

      // تحديث القائمة المحلية
      setPurchases(prev => prev.filter(p => p.id !== purchaseId));
      
      // إعادة تحميل البيانات لضمان التحديث الكامل
      if (refetchData) {
        await refetchData();
      }
      
      console.log('✅ تم حذف الفاتورة بشكل شامل:', {
        purchase: result.deleted_purchase,
        inventory_updated: result.inventory_updated,
        expenses_deleted: result.expenses_deleted,
        transactions_deleted: result.transactions_deleted,
        items_deleted: result.items_deleted
      });
      
      toast({ 
        title: 'تم الحذف بنجاح', 
        description: `تم حذف فاتورة رقم ${result.deleted_purchase} وجميع البيانات المرتبطة بها (${result.expenses_deleted} مصروف، ${result.items_deleted} عنصر، تحديث ${result.inventory_updated} مخزون)`,
        variant: 'success'
      });
      
      return { success: true, result };
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