import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';

export const useCashSources = () => {
  const [cashSources, setCashSources] = useState([]);
  const [cashMovements, setCashMovements] = useState([]);
  const [loading, setLoading] = useState(true);

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

      // إضافة حركة افتتاحية إذا كان هناك رصيد ابتدائي
      if (sourceData.initial_balance > 0) {
        await supabase.rpc('update_cash_source_balance', {
          p_cash_source_id: data.id,
          p_amount: sourceData.initial_balance,
          p_movement_type: 'in',
          p_reference_type: 'capital_injection',
          p_reference_id: null,
          p_description: `رصيد افتتاحي لمصدر النقد: ${data.name}`,
          p_created_by: (await supabase.auth.getUser()).data.user?.id
        });
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

  // إضافة أموال لمصدر نقد
  const addCashToSource = async (sourceId, amount, description) => {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('المستخدم غير مسجل الدخول');

      const { data, error } = await supabase.rpc('update_cash_source_balance', {
        p_cash_source_id: sourceId,
        p_amount: amount,
        p_movement_type: 'in',
        p_reference_type: 'capital_injection',
        p_reference_id: null,
        p_description: description || 'إضافة أموال للقاصة',
        p_created_by: user.id
      });

      if (error) throw error;

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

  // سحب أموال من مصدر نقد
  const withdrawCashFromSource = async (sourceId, amount, description) => {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('المستخدم غير مسجل الدخول');

      const { data, error } = await supabase.rpc('update_cash_source_balance', {
        p_cash_source_id: sourceId,
        p_amount: amount,
        p_movement_type: 'out',
        p_reference_type: 'capital_withdrawal',
        p_reference_id: null,
        p_description: description || 'سحب أموال من القاصة',
        p_created_by: user.id
      });

      if (error) throw error;

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

  // الحصول على رصيد القاصة الرئيسية المحسن والصحيح
  const getMainCashBalance = async () => {
    try {
      // استخدام النظام المحسن لحساب رصيد القاصة الرئيسية
      const { data, error } = await supabase
        .rpc('calculate_enhanced_main_cash_balance');

      if (error) {
        console.error('خطأ في جلب الرصيد المحسن:', error);
        // العودة للطريقة القديمة في حالة الخطأ
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('cash_sources')
          .select('current_balance')
          .eq('name', 'القاصة الرئيسية')
          .eq('is_active', true)
          .single();
        
        return Number(fallbackData?.current_balance || 0);
      }

      const enhancedData = data?.[0] || {};
      const realBalance = Number(enhancedData.final_balance || 0);
      
      console.log('💰 رصيد القاصة الرئيسية المحسن:', {
        realBalance,
        formatted: realBalance.toLocaleString(),
        breakdown: {
          capital: Number(enhancedData.capital_value || 0),
          revenue: Number(enhancedData.total_revenue || 0),
          cogs: Number(enhancedData.total_cogs || 0),
          grossProfit: Number(enhancedData.gross_profit || 0),
          expenses: Number(enhancedData.total_expenses || 0),
          purchases: Number(enhancedData.total_purchases || 0),
          employeeProfits: Number(enhancedData.employee_profits || 0),
          netProfit: Number(enhancedData.net_profit || 0)
        }
      });

      return realBalance;
    } catch (error) {
      console.error('خطأ في حساب رصيد القاصة الرئيسية المحسن:', error);
      return 0;
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
  const getTotalAllSourcesBalance = async () => {
    const mainBalance = await getMainCashBalance(); // القاصة الرئيسية (رأس المال + الأرباح)
    const otherBalance = getTotalSourcesBalance(); // باقي المصادر
    return mainBalance + otherBalance;
  };

  // الحصول على القاصة الرئيسية
  const getMainCashSource = async () => {
    const mainSource = cashSources.find(source => source.name === 'القاصة الرئيسية') || cashSources[0];
    if (mainSource && mainSource.name === 'القاصة الرئيسية') {
      const calculatedBalance = await getMainCashBalance();
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