import { useState, useCallback } from 'react';
import { useSupabaseData } from './useSupabaseData';
import { toast } from '@/hooks/use-toast';

/**
 * Hook موحد لإدارة جميع المعاملات المالية
 * - إضافة وحذف المصاريف
 * - تحديث الأرصدة النقدية
 * - تسجيل الحركات المالية
 * - منع التداخل والتكرار
 */
export const useUnifiedFinancialTransactions = () => {
  const { supabase, user } = useSupabaseData();
  const [isProcessing, setIsProcessing] = useState(false);

  // الدالة الموحدة لجميع المعاملات المالية
  const processFinancialTransaction = useCallback(async (transactionData) => {
    if (isProcessing) {
      console.log('⚠️ معاملة مالية قيد التنفيذ، تم تجاهل الطلب');
      return { success: false, error: 'معاملة قيد التنفيذ' };
    }

    setIsProcessing(true);
    
    try {
      const {
        type, // 'add_expense' | 'delete_expense' | 'cash_movement'
        data,
        skipCashMovement = false,
        skipNotification = false
      } = transactionData;

      let result = { success: false };

      switch (type) {
        case 'add_expense':
          result = await handleAddExpense(data, skipCashMovement);
          break;
        case 'delete_expense':
          result = await handleDeleteExpense(data, skipCashMovement);
          break;
        case 'cash_movement':
          result = await handleCashMovement(data);
          break;
        default:
          throw new Error('نوع المعاملة غير صحيح');
      }

      // إشعار موحد للنجاح
      if (result.success && !skipNotification) {
        toast({
          title: "تمت العملية بنجاح",
          description: result.message || "تم تنفيذ المعاملة المالية",
          variant: "success"
        });
      }

      return result;

    } catch (error) {
      console.error('❌ خطأ في المعاملة المالية:', error);
      
      toast({
        title: "خطأ في المعاملة المالية",
        description: error.message || "حدث خطأ أثناء تنفيذ المعاملة",
        variant: "destructive"
      });

      return { success: false, error: error.message };
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, supabase, user]);

  // إضافة مصروف مع الحركة المالية
  const handleAddExpense = async (expenseData, skipCashMovement) => {
    console.log('💰 بدء إضافة مصروف:', expenseData.description);

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

    // تسجيل الحركة المالية إذا مطلوب
    if (!skipCashMovement && newExpense.status === 'approved' && newExpense.expense_type !== 'system') {
      const cashResult = await processCashMovement({
        amount: parseFloat(newExpense.amount),
        type: 'out',
        reference_type: 'expense',
        reference_id: newExpense.id,
        description: `مصروف: ${newExpense.description}`
      });

      if (!cashResult.success) {
        // في حالة فشل الحركة المالية، احذف المصروف
        await supabase.from('expenses').delete().eq('id', newExpense.id);
        throw new Error('فشل في تسجيل الحركة المالية: ' + cashResult.error);
      }
    }

    return {
      success: true,
      data: newExpense,
      message: `تم إضافة مصروف ${expenseData.description} بقيمة ${expenseData.amount.toLocaleString()} د.ع`
    };
  };

  // حذف مصروف مع إرجاع المبلغ
  const handleDeleteExpense = async (expenseId, skipCashMovement) => {
    console.log('🗑️ بدء حذف مصروف:', expenseId);

    // جلب بيانات المصروف
    const { data: expenseData, error: fetchError } = await supabase
      .from('expenses')
      .select('*')
      .eq('id', expenseId)
      .single();

    if (fetchError) throw fetchError;

    // حذف المصروف
    const { error: deleteError } = await supabase
      .from('expenses')
      .delete()
      .eq('id', expenseId);

    if (deleteError) throw deleteError;

    // إرجاع المبلغ إذا مطلوب
    if (!skipCashMovement && expenseData.status === 'approved' && expenseData.expense_type !== 'system') {
      const cashResult = await processCashMovement({
        amount: parseFloat(expenseData.amount),
        type: 'in',
        reference_type: 'expense_refund',
        reference_id: expenseId,
        description: `إرجاع مصروف محذوف: ${expenseData.description}`
      });

      if (!cashResult.success) {
        console.warn('⚠️ فشل في إرجاع المبلغ للقاصة:', cashResult.error);
      }
    }

    return {
      success: true,
      data: expenseData,
      message: `تم حذف مصروف ${expenseData.description}`
    };
  };

  // معالجة الحركات النقدية
  const processCashMovement = async (movementData) => {
    const { data: mainCashSource, error: cashError } = await supabase
      .from('cash_sources')
      .select('id')
      .eq('name', 'القاصة الرئيسية')
      .maybeSingle();

    if (cashError || !mainCashSource) {
      return { success: false, error: 'القاصة الرئيسية غير موجودة' };
    }

    const { data: result, error: balanceError } = await supabase.rpc('update_cash_source_balance', {
      p_cash_source_id: mainCashSource.id,
      p_amount: movementData.amount,
      p_movement_type: movementData.type,
      p_reference_type: movementData.reference_type,
      p_reference_id: movementData.reference_id,
      p_description: movementData.description,
      p_created_by: user?.user_id
    });

    if (balanceError) {
      return { success: false, error: balanceError.message };
    }

    return { success: true, data: result };
  };

  // دوال مختصرة للاستخدام السهل
  const addExpense = useCallback((expenseData) => {
    return processFinancialTransaction({
      type: 'add_expense',
      data: expenseData
    });
  }, [processFinancialTransaction]);

  const deleteExpense = useCallback((expenseId) => {
    return processFinancialTransaction({
      type: 'delete_expense',
      data: expenseId
    });
  }, [processFinancialTransaction]);

  const addCashMovement = useCallback((movementData) => {
    return processFinancialTransaction({
      type: 'cash_movement',
      data: movementData
    });
  }, [processFinancialTransaction]);

  return {
    // الدالة الموحدة الرئيسية
    processFinancialTransaction,
    
    // دوال مختصرة
    addExpense,
    deleteExpense,
    addCashMovement,
    
    // حالة التحميل
    isProcessing
  };
};