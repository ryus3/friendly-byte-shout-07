import { useState, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { useInventory } from '@/contexts/InventoryContext';

export const useFullPurchases = () => {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(false);
  const { updateVariantStock, addExpense, refetchData } = useInventory();

  const addPurchase = useCallback(async (purchaseData) => {
    setLoading(true);
    try {
      // إضافة فاتورة الشراء
      const { data: newPurchase, error } = await supabase
        .from('purchases')
        .insert({
          supplier: purchaseData.supplier,
          purchase_date: purchaseData.purchaseDate,
          total_cost: purchaseData.totalCost,
          shipping_cost: purchaseData.shippingCost || 0,
          status: 'completed',
          items: purchaseData.items
        })
        .select()
        .single();

      if (error) throw error;

      // تحديث المخزون لكل منتج
      const stockUpdatePromises = purchaseData.items.map(async (item) => {
        try {
          const { error: stockError } = await supabase.rpc('update_variant_stock_from_purchase', {
            p_sku: item.variantSku,
            p_quantity_change: item.quantity,
            p_cost_price: item.costPrice
          });
          
          if (stockError) {
            console.error(`خطأ في تحديث مخزون ${item.variantSku}:`, stockError);
            throw stockError;
          }
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
        date: new Date(),
        category: 'شراء بضاعة',
        description: `فاتورة شراء رقم #${newPurchase.id} - ${purchaseData.supplier}`,
        amount: totalCost,
      });

      // إضافة مصروف الشحن إذا كان موجود
      if (purchaseData.shippingCost > 0) {
        await addExpense({
          date: new Date(),
          category: 'شحن',
          description: `تكلفة شحن فاتورة شراء #${newPurchase.id} - ${purchaseData.supplier}`,
          amount: purchaseData.shippingCost,
        });
      }

      // تحديث قائمة المشتريات
      setPurchases(prev => [newPurchase, ...prev]);

      // إعادة تحميل البيانات
      await refetchData();

      toast({ 
        title: 'نجح', 
        description: `تمت إضافة فاتورة الشراء رقم #${newPurchase.id} بنجاح وتم تحديث المخزون والمحاسبة.` 
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
  }, [addExpense, refetchData]);

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
      const { error } = await supabase
        .from('purchases')
        .delete()
        .eq('id', purchaseId);

      if (error) throw error;

      setPurchases(prev => prev.filter(p => p.id !== purchaseId));
      toast({ title: 'تم', description: 'تم حذف فاتورة الشراء بنجاح' });
      
      return { success: true };
    } catch (error) {
      console.error("خطأ في حذف فاتورة الشراء:", error);
      toast({ 
        title: 'خطأ', 
        description: 'فشل حذف فاتورة الشراء', 
        variant: 'destructive' 
      });
      return { success: false };
    }
  }, []);

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