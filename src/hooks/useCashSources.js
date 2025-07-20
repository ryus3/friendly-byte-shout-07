import { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';

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
          created_by: (await supabase.auth.getUser()).data.user?.id
        }])
        .select()
        .single();

      if (error) throw error;

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
        p_reference_type: 'withdrawal',
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

  // الحصول على إجمالي الرصيد
  const getTotalBalance = () => {
    return cashSources.reduce((total, source) => total + (source.current_balance || 0), 0);
  };

  // الحصول على القاصة الرئيسية
  const getMainCashSource = () => {
    return cashSources.find(source => source.name === 'القاصة الرئيسية') || cashSources[0];
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

    // Realtime subscriptions
    const cashSourcesSubscription = supabase
      .channel('cash_sources_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'cash_sources' },
        () => fetchCashSources()
      )
      .subscribe();

    const cashMovementsSubscription = supabase
      .channel('cash_movements_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'cash_movements' },
        () => fetchCashMovements()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(cashSourcesSubscription);
      supabase.removeChannel(cashMovementsSubscription);
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
    getMainCashSource
  };
};