import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';
import { useSuper } from '@/components/providers/SuperProvider';

export const useCashSources = () => {
  // ⚡ استخدام SuperProvider للبيانات المحملة مسبقاً
  const { allData } = useSuper();
  
  // البيانات من الـ cache - تحميل فوري!
  const cashSources = useMemo(() => {
    const sources = allData?.cashSources || [];
    return sources.filter(s => s.is_active !== false);
  }, [allData?.cashSources]);
  
  const cashMovements = useMemo(() => {
    return allData?.cashMovements || [];
  }, [allData?.cashMovements]);
  
  // حالة التحميل - false لأن البيانات موجودة في الـ cache
  const loading = !allData;

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

  // الحصول على رصيد القاصة الرئيسية من الـ cache
  const getMainCashBalance = useCallback(() => {
    const mainSource = cashSources.find(s => s.name === 'القاصة الرئيسية');
    return mainSource?.current_balance || 0;
  }, [cashSources]);

  // الحصول على مجموع أرصدة المصادر الفعلية (بدون القاصة الرئيسية)
  const getTotalSourcesBalance = useCallback(() => {
    return cashSources
      .filter(source => source.name !== 'القاصة الرئيسية')
      .reduce((total, source) => total + (source.current_balance || 0), 0);
  }, [cashSources]);

  // دالة للتوافق مع النسخة السابقة
  const getRealCashBalance = useCallback(() => {
    return getTotalSourcesBalance();
  }, [getTotalSourcesBalance]);

  // حساب مجموع جميع المصادر بما في ذلك القاصة الرئيسية
  const getTotalAllSourcesBalance = useCallback(() => {
    return cashSources
      .filter(source => source.is_active !== false)
      .reduce((sum, source) => sum + (source.current_balance || 0), 0);
  }, [cashSources]);

  // الحصول على إجمالي الرصيد
  const getTotalBalance = useCallback(() => {
    return getMainCashBalance() + getTotalSourcesBalance();
  }, [getMainCashBalance, getTotalSourcesBalance]);

  // الحصول على القاصة الرئيسية
  const getMainCashSource = useCallback(() => {
    const mainSource = cashSources.find(source => source.name === 'القاصة الرئيسية') || cashSources[0];
    if (mainSource) {
      return {
        ...mainSource,
        calculatedBalance: mainSource.current_balance || 0
      };
    }
    return mainSource;
  }, [cashSources]);

  // دوال إعادة الجلب للتوافق (لكن الآن تعتمد على Real-time)
  const fetchCashSources = useCallback(() => {
    // البيانات تُحدث تلقائياً عبر Real-time في SuperProvider
  }, []);

  const fetchCashMovements = useCallback(() => {
    // البيانات تُحدث تلقائياً عبر Real-time في SuperProvider
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
