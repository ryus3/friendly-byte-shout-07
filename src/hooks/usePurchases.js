import { useState, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';

export const usePurchases = (initialPurchases, onExpenseAdd) => {
  const [purchases, setPurchases] = useState(initialPurchases);

  const addPurchase = useCallback(async (purchaseData) => {
    try {
      const { data: newPurchase, error } = await supabase
        .from('purchases')
        .insert(purchaseData)
        .select()
        .single();

      if (error) throw error;

      // Update stock for each item in the purchase
      const stockUpdatePromises = purchaseData.items.map(item =>
        supabase.rpc('update_variant_stock_from_purchase', {
          p_sku: item.variantSku,
          p_quantity_change: item.quantity,
          p_cost_price: item.costPrice
        })
      );
      await Promise.all(stockUpdatePromises);

      // Add to expenses
      const totalCost = purchaseData.items.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);
      onExpenseAdd({
        date: new Date(),
        category: 'شراء بضاعة',
        description: `فاتورة شراء رقم #${newPurchase.id}`,
        amount: totalCost,
      });
      if (purchaseData.shippingCost > 0) {
        onExpenseAdd({
          date: new Date(),
          category: 'شحن',
          description: `تكلفة شحن فاتورة شراء #${newPurchase.id}`,
          amount: purchaseData.shippingCost,
        });
      }

      return { success: true };
    } catch (error) {
      console.error("Error adding purchase:", error);
      toast({ title: 'خطأ', description: 'فشل إضافة فاتورة الشراء.', variant: 'destructive' });
      return { success: false };
    }
  }, [onExpenseAdd]);

  const deletePurchase = useCallback(async (purchaseId) => {
    toast({ title: 'تنبيه', description: 'حذف المشتريات لم يتم تنفيذه بعد.' });
    return { success: true };
  }, []);

  const deletePurchases = useCallback(async (purchaseIds) => {
    toast({ title: 'تنبيه', description: 'حذف المشتريات لم يتم تنفيذه بعد.' });
    return { success: true };
  }, []);

  return {
    purchases,
    setPurchases,
    addPurchase,
    deletePurchase,
    deletePurchases,
  };
};