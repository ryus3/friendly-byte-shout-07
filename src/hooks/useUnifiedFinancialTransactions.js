import { useState, useCallback } from 'react';
import { useSupabaseData } from './useSupabaseData';
import { toast } from '@/hooks/use-toast';

/**
 * Hook موحد لإدارة جميع المعاملات المالية
 * - إضافة وحذف المصاريف بدالة واحدة
 * - منع التكرار والتداخل نهائياً 
 * - تسجيل حركة مالية واحدة فقط لكل عملية
 */
export const useUnifiedFinancialTransactions = () => {
  const { supabase, user } = useSupabaseData();
  const [isProcessing, setIsProcessing] = useState(false);

  // دالة إضافة مصروف موحدة 
  const addExpense = useCallback(async (expenseData) => {
    if (isProcessing) {
      console.log('⚠️ معاملة مالية قيد التنفيذ، تم تجاهل الطلب');
      return { success: false, error: 'معاملة قيد التنفيذ' };
    }

    setIsProcessing(true);
    
    try {
      console.log('💰 [UNIFIED] بدء إضافة مصروف:', expenseData.description);

      // إدراج المصروف
      const { data: newExpense, error: expenseError } = await supabase
        .from('expenses')
        .insert({
          category: expenseData.category,
          expense_type: expenseData.expense_type || 'operational',
          description: expenseData.description,
          amount: expenseData.amount,
          vendor_name: expenseData.vendor_name || null,
          receipt_number: expenseData.receipt_number || null,
          status: expenseData.status || 'approved',
          metadata: expenseData.metadata || {},
          created_by: user?.user_id
        })
        .select()
        .single();

      if (expenseError) throw expenseError;

      console.log('✅ [UNIFIED] تم إنشاء المصروف:', newExpense.id);

      // تسجيل الحركة المالية فقط للمصاريف المعتمدة وغير النظام
      if (newExpense.status === 'approved' && newExpense.expense_type !== 'system') {
        const { data: mainCashSource, error: cashError } = await supabase
          .from('cash_sources')
          .select('id')
          .eq('name', 'القاصة الرئيسية')
          .maybeSingle();

        if (cashError || !mainCashSource) {
          // في حالة عدم وجود القاصة، احذف المصروف
          await supabase.from('expenses').delete().eq('id', newExpense.id);
          throw new Error('القاصة الرئيسية غير موجودة');
        }

        console.log('🔄 [UNIFIED] تسجيل حركة مالية واحدة...');
        
        const { data: balanceResult, error: balanceError } = await supabase.rpc('update_cash_source_balance', {
          p_cash_source_id: mainCashSource.id,
          p_amount: parseFloat(newExpense.amount),
          p_movement_type: 'out',
          p_reference_type: 'expense',
          p_reference_id: newExpense.id,
          p_description: `مصروف: ${newExpense.description}`,
          p_created_by: user?.user_id
        });

        if (balanceError) {
          console.error('❌ [UNIFIED] خطأ في الحركة المالية:', balanceError);
          // احذف المصروف في حالة فشل الحركة المالية
          await supabase.from('expenses').delete().eq('id', newExpense.id);
          throw new Error('فشل في تسجيل الحركة المالية: ' + balanceError.message);
        }

        console.log('✅ [UNIFIED] تمت الحركة المالية بنجاح:', balanceResult);
      }

      // إشعار نجاح موحد
      if (expenseData.category !== 'مشتريات' && 
          expenseData.category !== 'شحن ونقل' && 
          expenseData.category !== 'تكاليف التحويل' && 
          expenseData.category !== 'مستحقات الموظفين') {
        toast({ 
          title: "تمت إضافة المصروف",
          description: `تم إضافة مصروف ${expenseData.description} بقيمة ${expenseData.amount.toLocaleString()} د.ع`,
          variant: "success" 
        });
      }

      return {
        success: true,
        data: newExpense,
        message: `تم إضافة مصروف ${expenseData.description} بقيمة ${expenseData.amount.toLocaleString()} د.ع`
      };

    } catch (error) {
      console.error('❌ [UNIFIED] فشل إضافة المصروف:', error);
      
      toast({
        title: "خطأ في إضافة المصروف",
        description: error.message || "حدث خطأ أثناء إضافة المصروف",
        variant: "destructive"
      });

      return { success: false, error: error.message };
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, supabase, user]);

  // دالة حذف مصروف موحدة
  const deleteExpense = useCallback(async (expenseId) => {
    if (isProcessing) {
      console.log('⚠️ معاملة مالية قيد التنفيذ، تم تجاهل الطلب');
      return { success: false, error: 'معاملة قيد التنفيذ' };
    }

    setIsProcessing(true);
    
    try {
      console.log('🗑️ [UNIFIED] بدء حذف مصروف:', expenseId);

      // جلب بيانات المصروف قبل حذفه
      const { data: expenseData, error: fetchError } = await supabase
        .from('expenses')
        .select('*')
        .eq('id', expenseId)
        .single();

      if (fetchError) throw fetchError;

      console.log('📋 [UNIFIED] بيانات المصروف:', expenseData.description);

      // حذف المصروف
      const { error: deleteError } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId);

      if (deleteError) throw deleteError;

      console.log('✅ [UNIFIED] تم حذف المصروف من قاعدة البيانات');

      // إرجاع المبلغ للقاصة إذا كان مصروف معتمد وليس نظام
      if (expenseData.status === 'approved' && expenseData.expense_type !== 'system') {
        const { data: mainCashSource, error: cashError } = await supabase
          .from('cash_sources')
          .select('id')
          .eq('name', 'القاصة الرئيسية')
          .maybeSingle();

        if (cashError || !mainCashSource) {
          console.warn('⚠️ [UNIFIED] لم يتم العثور على القاصة الرئيسية');
        } else {
          console.log('🔄 [UNIFIED] إرجاع مبلغ واحد للقاصة...');
          
          const { data: balanceResult, error: balanceError } = await supabase.rpc('update_cash_source_balance', {
            p_cash_source_id: mainCashSource.id,
            p_amount: parseFloat(expenseData.amount),
            p_movement_type: 'in',
            p_reference_type: 'expense_refund',
            p_reference_id: expenseId,
            p_description: `إرجاع مصروف محذوف: ${expenseData.description}`,
            p_created_by: user?.user_id
          });

          if (balanceError) {
            console.error('❌ [UNIFIED] خطأ في إرجاع المبلغ:', balanceError);
          } else {
            console.log('✅ [UNIFIED] تم إرجاع المبلغ للقاصة بنجاح:', balanceResult);
          }
        }
      }

      // إشعار نجاح
      toast({ 
        title: "تم بنجاح", 
        description: `تم حذف مصروف ${expenseData.description}`,
        variant: "success" 
      });

      return {
        success: true,
        data: expenseData,
        message: `تم حذف مصروف ${expenseData.description}`
      };

    } catch (error) {
      console.error('❌ [UNIFIED] فشل حذف المصروف:', error);
      
      toast({
        title: "خطأ في حذف المصروف",
        description: error.message || "حدث خطأ أثناء حذف المصروف",
        variant: "destructive"
      });

      return { success: false, error: error.message };
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, supabase, user]);

  return {
    addExpense,
    deleteExpense,
    isProcessing
  };
};