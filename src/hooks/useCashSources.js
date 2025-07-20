import { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { useFinancialCalculations } from './useFinancialCalculations';

export const useCashSources = () => {
  const [cashSources, setCashSources] = useState([]);
  const [cashMovements, setCashMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // استخدام النظام الجديد للحسابات المالية
  const { getMainCashBalance: calculateMainBalance } = useFinancialCalculations();

  // جلب مصادر النقد
  const fetchCashSources = async () => {
    try {
      const { data, error } = await supabase
        .from('cash_sources')
        .select('*')
        .eq('is_active', true)
        .order('created_at');

      if (error) throw error;
      setCashSources(data || []);
    } catch (error) {
      console.error('خطأ في جلب مصادر النقد:', error);
      toast({
        title: "خطأ",
        description: "فشل في جلب بيانات مصادر النقد",
        variant: "destructive"
      });
    }
  };

  // جلب حركات النقد
  const fetchCashMovements = async (sourceId = null, limit = 50) => {
    try {
      let query = supabase
        .from('cash_movements')
        .select(`
          *,
          cash_sources (name, type)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (sourceId) {
        query = query.eq('cash_source_id', sourceId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setCashMovements(data || []);
    } catch (error) {
      console.error('خطأ في جلب حركات النقد:', error);
      toast({
        title: "خطأ",
        description: "فشل في جلب حركات النقد",
        variant: "destructive"
      });
    }
  };

  // إضافة مصدر نقد جديد
  const addCashSource = async (sourceData) => {
    try {
      const { data, error } = await supabase
        .from('cash_sources')
        .insert([{
          ...sourceData,
          current_balance: sourceData.initial_balance || 0,
          created_by: (await supabase.auth.getUser()).data.user?.id
        }])
        .select()
        .single();

      if (error) throw error;

      // إضافة حركة افتتاحية مباشرة - بدون دوال قاعدة البيانات
      if (sourceData.initial_balance > 0) {
        const { error: movementError } = await supabase
          .from('cash_movements')
          .insert([{
            cash_source_id: data.id,
            amount: sourceData.initial_balance,
            movement_type: 'in',
            reference_type: 'capital_injection',
            reference_id: null,
            description: `رصيد افتتاحي لمصدر النقد: ${data.name}`,
            created_by: (await supabase.auth.getUser()).data.user?.id,
            balance_before: 0,
            balance_after: sourceData.initial_balance
          }]);
        
        if (movementError) throw movementError;
        
        // تحديث رصيد المصدر مباشرة
        await supabase
          .from('cash_sources')
          .update({ current_balance: sourceData.initial_balance })
          .eq('id', data.id);
      }

      setCashSources(prev => [...prev, data]);
      toast({
        title: "تم بنجاح",
        description: "تم إضافة مصدر النقد الجديد"
      });

      return { success: true, data };
    } catch (error) {
      console.error('خطأ في إضافة مصدر النقد:', error);
      toast({
        title: "خطأ",
        description: error.message || "فشل في إضافة مصدر النقد",
        variant: "destructive"
      });
      return { success: false, error };
    }
  };

  // إضافة أموال لمصدر نقد - بدون دوال قاعدة البيانات
  const addCashToSource = async (sourceId, amount, description) => {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('المستخدم غير مسجل الدخول');

      // الحصول على الرصيد الحالي
      const { data: currentSource, error: fetchError } = await supabase
        .from('cash_sources')
        .select('current_balance')
        .eq('id', sourceId)
        .single();

      if (fetchError) throw fetchError;

      const oldBalance = currentSource.current_balance || 0;
      const newBalance = oldBalance + amount;

      // إضافة الحركة مباشرة
      const { error: movementError } = await supabase
        .from('cash_movements')
        .insert([{
          cash_source_id: sourceId,
          amount: amount,
          movement_type: 'in',
          reference_type: 'capital_injection',
          reference_id: null,
          description: description || 'إضافة أموال للقاصة',
          created_by: user.id,
          balance_before: oldBalance,
          balance_after: newBalance
        }]);

      if (movementError) throw movementError;
      
      // تحديث رصيد المصدر مباشرة
      const { error: updateError } = await supabase
        .from('cash_sources')
        .update({ current_balance: newBalance })
        .eq('id', sourceId);

      if (updateError) throw updateError;

      // تحديث البيانات
      await fetchCashSources();
      await fetchCashMovements();

      toast({
        title: "تم بنجاح",
        description: `تم إضافة ${amount.toLocaleString()} د.ع للقاصة`
      });

      return { success: true };
    } catch (error) {
      console.error('خطأ في إضافة الأموال:', error);
      toast({
        title: "خطأ",
        description: error.message || "فشل في إضافة الأموال",
        variant: "destructive"
      });
      return { success: false, error };
    }
  };

  // سحب أموال من مصدر نقد - بدون دوال قاعدة البيانات
  const withdrawCashFromSource = async (sourceId, amount, description) => {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('المستخدم غير مسجل الدخول');

      // الحصول على الرصيد الحالي
      const { data: currentSource, error: fetchError } = await supabase
        .from('cash_sources')
        .select('current_balance, name')
        .eq('id', sourceId)
        .single();

      if (fetchError) throw fetchError;

      const oldBalance = currentSource.current_balance || 0;
      const newBalance = oldBalance - amount;

      // التحقق من كفاية الرصيد (إلا للقاصة الرئيسية)
      if (newBalance < 0 && currentSource.name !== 'القاصة الرئيسية') {
        throw new Error(`الرصيد غير كافي. الرصيد الحالي: ${oldBalance.toLocaleString()}, المطلوب سحبه: ${amount.toLocaleString()}`);
      }

      // إضافة الحركة مباشرة
      const { error: movementError } = await supabase
        .from('cash_movements')
        .insert([{
          cash_source_id: sourceId,
          amount: amount,
          movement_type: 'out',
          reference_type: 'capital_withdrawal',
          reference_id: null,
          description: description || 'سحب أموال من القاصة',
          created_by: user.id,
          balance_before: oldBalance,
          balance_after: newBalance
        }]);

      if (movementError) throw movementError;
      
      // تحديث رصيد المصدر مباشرة
      const { error: updateError } = await supabase
        .from('cash_sources')
        .update({ current_balance: newBalance })
        .eq('id', sourceId);

      if (updateError) throw updateError;

      // تحديث البيانات
      await fetchCashSources();
      await fetchCashMovements();

      toast({
        title: "تم بنجاح",
        description: `تم سحب ${amount.toLocaleString()} د.ع من القاصة`
      });

      return { success: true };
    } catch (error) {
      console.error('خطأ في سحب الأموال:', error);
      toast({
        title: "خطأ",
        description: error.message || "فشل في سحب الأموال",
        variant: "destructive"
      });
      return { success: false, error };
    }
  };

  // الحصول على إجمالي الرصيد من قاعدة البيانات
  const getTotalBalance = () => {
    return cashSources.reduce((total, source) => total + (source.current_balance || 0), 0);
  };

  // حساب رصيد القاصة الرئيسية باستخدام النظام الجديد فقط
  const getMainCashBalance = () => {
    try {
      const result = calculateMainBalance();
      const balance = result?.balance || 0;
      
      console.log('💰 رصيد القاصة الرئيسية المحسوب (النظام الجديد):', {
        balance,
        breakdown: result?.breakdown,
        formatted: balance.toLocaleString()
      });

      return result; // إرجاع الكائن الكامل بدلاً من الرقم فقط
    } catch (error) {
      console.error('خطأ في حساب رصيد القاصة الرئيسية:', error);
      return { balance: 0, breakdown: {} };
    }
  };

  // الحصول على مجموع أرصدة المصادر الفعلية (بدون القاصة الرئيسية)
  const getTotalSourcesBalance = () => {
    return cashSources
      .filter(source => source.name !== 'القاصة الرئيسية')
      .reduce((total, source) => total + (source.current_balance || 0), 0);
  };

  // دالة للتوافق مع النسخة السابقة - تعيد مجموع المصادر
  const getRealCashBalance = () => {
    return getTotalSourcesBalance();
  };

  // حساب مجموع جميع المصادر بما في ذلك القاصة الرئيسية الحقيقية
  const getTotalAllSourcesBalance = () => {
    const mainBalance = getMainCashBalance().balance; // القاصة الرئيسية (رأس المال + الأرباح)
    const otherBalance = getTotalSourcesBalance(); // باقي المصادر
    return mainBalance + otherBalance;
  };

  // الحصول على القاصة الرئيسية
  const getMainCashSource = () => {
    const mainSource = cashSources.find(source => source.name === 'القاصة الرئيسية') || cashSources[0];
    if (mainSource && mainSource.name === 'القاصة الرئيسية') {
      const calculatedBalance = getMainCashBalance().balance;
      return {
        ...mainSource,
        calculatedBalance
      };
    }
    return mainSource;
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchCashSources(),
        fetchCashMovements()
      ]);
      setLoading(false);
    };

    loadData();

    // Realtime subscriptions للجداول المالية
    const cashSourcesSubscription = supabase
      .channel('cash_sources_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'cash_sources' },
        () => {
          console.log('🔄 Cash sources changed, refreshing...');
          fetchCashSources();
        }
      )
      .subscribe();

    const cashMovementsSubscription = supabase
      .channel('cash_movements_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'cash_movements' },
        () => {
          console.log('🔄 Cash movements changed, refreshing...');
          fetchCashMovements();
        }
      )
      .subscribe();

    // Real-time subscription للطلبات لتحديث الأرباح
    const ordersSubscription = supabase
      .channel('orders_changes')
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => {
          console.log('🔄 Order updated, refreshing cash sources...');
          // إذا تم تحديث حالة الطلب للتسليم، قم بتحديث الأرباح
          if (payload.new.status === 'delivered' || payload.new.receipt_received) {
            fetchCashSources();
          }
        }
      )
      .subscribe();

    // Real-time subscription للمشتريات
    const purchasesSubscription = supabase
      .channel('purchases_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'purchases' },
        () => {
          console.log('🔄 Purchases changed, refreshing cash sources...');
          fetchCashSources();
          fetchCashMovements();
        }
      )
      .subscribe();

    // Real-time subscription للمصاريف - تحديث مبسط لتجنب التكرار
    const expensesSubscription = supabase
      .channel('expenses_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'expenses' },
        (payload) => {
          console.log('🔄 Expense changed:', payload.eventType, payload.new?.id);
          // تحديث مؤجل لتجنب التكرار
          setTimeout(() => {
            fetchCashMovements();
          }, 500);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(cashSourcesSubscription);
      supabase.removeChannel(cashMovementsSubscription);
      supabase.removeChannel(ordersSubscription);
      supabase.removeChannel(purchasesSubscription);
      supabase.removeChannel(expensesSubscription);
    };
  }, []);

  return {
    cashSources,
    cashMovements,
    loading,
    addCashSource,
    addCashToSource,
    withdrawCashFromSource,
    fetchCashSources,
    fetchCashMovements,
    getTotalBalance,
    getRealCashBalance,
    getMainCashBalance,
    getTotalSourcesBalance,
    getTotalAllSourcesBalance,
    getMainCashSource
  };
};