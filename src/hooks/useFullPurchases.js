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
      // إضافة فاتورة الشراء
      const { data: newPurchase, error } = await supabase
        .from('purchases')
        .insert({
          supplier_name: purchaseData.supplier,
          supplier_contact: purchaseData.supplierContact || null,
          total_amount: purchaseData.totalCost + (purchaseData.shippingCost || 0),
          paid_amount: purchaseData.totalCost + (purchaseData.shippingCost || 0),
          status: 'completed',
          notes: `شحن: ${purchaseData.shippingCost || 0} د.ع`,
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
      if (purchaseData.shippingCost > 0) {
        await addExpense({
          category: 'شحن',
          expense_type: 'operational',
          description: `تكلفة شحن فاتورة شراء ${newPurchase.purchase_number} - ${purchaseData.supplier}`,
          amount: purchaseData.shippingCost,
          vendor_name: purchaseData.supplier,
          receipt_number: newPurchase.purchase_number + '-SHIP',
          status: 'approved'
        });
      }

      // تحديث قائمة المشتريات
      setPurchases(prev => [newPurchase, ...prev]);

      // إعادة تحميل البيانات
      await refetchData();

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
      
      // حذف عناصر الفاتورة أولاً
      const { error: itemsError } = await supabase
        .from('purchase_items')
        .delete()
        .eq('purchase_id', purchaseId);

      if (itemsError) {
        console.error('خطأ في حذف عناصر الفاتورة:', itemsError);
        throw itemsError;
      }

      // حذف الفاتورة
      const { error: purchaseError } = await supabase
        .from('purchases')
        .delete()
        .eq('id', purchaseId);

      if (purchaseError) {
        console.error('خطأ في حذف الفاتورة:', purchaseError);
        throw purchaseError;
      }

      // تحديث القائمة المحلية
      setPurchases(prev => prev.filter(p => p.id !== purchaseId));
      
      // إعادة تحميل البيانات
      await refetchData();
      
      toast({ 
        title: 'تم', 
        description: 'تم حذف فاتورة الشراء وجميع عناصرها بنجاح',
        variant: 'success'
      });
      
      return { success: true };
    } catch (error) {
      console.error("خطأ في حذف فاتورة الشراء:", error);
      toast({ 
        title: 'خطأ', 
        description: `فشل حذف فاتورة الشراء: ${error.message}`, 
        variant: 'destructive' 
      });
      return { success: false };
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