import { useState, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';

export const usePurchases = (initialPurchases, onExpenseAdd) => {
  const [purchases, setPurchases] = useState(initialPurchases);

  const addPurchase = useCallback(async (purchaseData) => {
    try {
      // حساب التكلفة الإجمالية
      const itemsTotal = purchaseData.items.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);
      const totalAmount = itemsTotal + (purchaseData.shippingCost || 0) + (purchaseData.transferCost || 0);

      // إدراج الفاتورة
      const { data: newPurchase, error } = await supabase
        .from('purchases')
        .insert({
          supplier_name: purchaseData.supplier,
          purchase_date: purchaseData.purchaseDate,
          items: purchaseData.items,
          total_amount: totalAmount,
          paid_amount: totalAmount,
          shipping_cost: purchaseData.shippingCost || 0,
          transfer_cost: purchaseData.transferCost || 0,
          cash_source_id: purchaseData.cashSourceId,
          status: 'completed'
        })
        .select()
        .single();

      if (error) throw error;

      // تحديث المخزون لكل منتج
      for (const item of purchaseData.items) {
        const { error: stockError } = await supabase.rpc('update_variant_stock_from_purchase', {
          p_sku: item.variantSku,
          p_quantity_change: item.quantity,
          p_cost_price: item.costPrice
        });
        
        if (stockError) {
          console.error('Stock update error:', stockError);
          throw new Error(`فشل في تحديث مخزون ${item.variantSku}: ${stockError.message}`);
        }
      }

      // خصم من مصدر النقد
      if (purchaseData.cashSourceId && totalAmount > 0) {
        const { error: cashError } = await supabase.rpc('update_cash_source_balance', {
          p_cash_source_id: purchaseData.cashSourceId,
          p_amount: totalAmount,
          p_movement_type: 'out',
          p_reference_type: 'purchase',
          p_reference_id: newPurchase.id,
          p_description: `فاتورة شراء ${newPurchase.purchase_number} - ${purchaseData.supplier}`,
          p_created_by: newPurchase.created_by
        });

        if (cashError) {
          console.error('Cash movement error:', cashError);
          throw new Error(`فشل في خصم المبلغ من مصدر النقد: ${cashError.message}`);
        }
      }

      // إضافة مصروف للشحن إذا وُجد
      if (purchaseData.shippingCost > 0) {
        await supabase.from('expenses').insert({
          category: 'شحن ونقل',
          expense_type: 'operational',
          description: `تكلفة شحن فاتورة شراء ${newPurchase.purchase_number} - ${purchaseData.supplier}`,
          amount: purchaseData.shippingCost,
          vendor_name: purchaseData.supplier,
          receipt_number: `${newPurchase.purchase_number}-SHIP`,
          status: 'approved'
        });
      }

      // إضافة مصروف للتحويل إذا وُجد
      if (purchaseData.transferCost > 0) {
        await supabase.from('expenses').insert({
          category: 'تحويلات مالية',
          expense_type: 'operational',
          description: `تكلفة تحويل فاتورة شراء ${newPurchase.purchase_number} - ${purchaseData.supplier}`,
          amount: purchaseData.transferCost,
          vendor_name: purchaseData.supplier,
          receipt_number: `${newPurchase.purchase_number}-TRANSFER`,
          status: 'approved'
        });
      }

      return { success: true, purchase: newPurchase };
    } catch (error) {
      console.error("Error adding purchase:", error);
      toast({ 
        title: 'خطأ', 
        description: error.message || 'فشل إضافة فاتورة الشراء.', 
        variant: 'destructive' 
      });
      return { success: false, error: error.message };
    }
  }, []);

  const deletePurchase = useCallback(async (purchaseId) => {
    try {
      // جلب تفاصيل الفاتورة أولاً
      const { data: purchase, error: fetchError } = await supabase
        .from('purchases')
        .select('*')
        .eq('id', purchaseId)
        .single();

      if (fetchError) throw fetchError;
      if (!purchase) throw new Error('الفاتورة غير موجودة');

      // إرجاع المبلغ لمصدر النقد
      if (purchase.cash_source_id && purchase.total_amount > 0) {
        const { error: cashError } = await supabase.rpc('update_cash_source_balance', {
          p_cash_source_id: purchase.cash_source_id,
          p_amount: purchase.total_amount,
          p_movement_type: 'in',
          p_reference_type: 'purchase_refund',
          p_reference_id: purchaseId,
          p_description: `استرداد حذف فاتورة شراء ${purchase.purchase_number}`,
          p_created_by: purchase.created_by
        });

        if (cashError) {
          console.error('Cash refund error:', cashError);
          throw new Error(`فشل في استرداد المبلغ: ${cashError.message}`);
        }
      }

      // تقليل المخزون للمنتجات
      if (purchase.items && Array.isArray(purchase.items)) {
        for (const item of purchase.items) {
          const { error: stockError } = await supabase.rpc('update_variant_stock_from_purchase', {
            p_sku: item.variantSku,
            p_quantity_change: -item.quantity, // تقليل الكمية
            p_cost_price: item.costPrice
          });
          
          if (stockError) {
            console.error('Stock reduction error:', stockError);
            // لا نوقف العملية، فقط نسجل الخطأ
          }
        }
      }

      // حذف المصاريف المرتبطة
      await supabase
        .from('expenses')
        .delete()
        .like('receipt_number', `${purchase.purchase_number}%`);

      // حذف عناصر الفاتورة
      await supabase
        .from('purchase_items')
        .delete()
        .eq('purchase_id', purchaseId);

      // حذف الفاتورة نفسها
      const { error: deleteError } = await supabase
        .from('purchases')
        .delete()
        .eq('id', purchaseId);

      if (deleteError) throw deleteError;

      toast({ 
        title: 'نجاح', 
        description: `تم حذف فاتورة الشراء ${purchase.purchase_number} بنجاح.`,
        variant: 'success'
      });

      return { success: true };
    } catch (error) {
      console.error("Error deleting purchase:", error);
      toast({ 
        title: 'خطأ', 
        description: error.message || 'فشل في حذف فاتورة الشراء.', 
        variant: 'destructive' 
      });
      return { success: false, error: error.message };
    }
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