/**
 * Hook مخصص لتنظيف الطلبات الذكية المتبقية
 * يوفر وظائف آمنة لحذف وتنظيف الطلبات الذكية
 */
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useAiOrdersCleanup = () => {
  
  // حذف طلب ذكي واحد بأمان
  const deleteAiOrderSafely = useCallback(async (aiOrderId) => {
    try {
      const { data: result, error } = await supabase.rpc('delete_ai_order_safely', {
        p_ai_order_id: aiOrderId
      });
      
      if (error) {
        console.error('❌ فشل حذف الطلب الذكي بالدالة الآمنة:', error);
        return { success: false, error: error.message };
      }
      
      return { success: !!result };
    } catch (err) {
      console.error('❌ خطأ في حذف الطلب الذكي:', err);
      return { success: false, error: err.message };
    }
  }, []);

  // ربط طلب ذكي بطلب حقيقي
  const linkAiOrderToRealOrder = useCallback(async (aiOrderId, realOrderId) => {
    try {
      const { error } = await supabase
        .from('ai_orders')
        .update({ related_order_id: realOrderId })
        .eq('id', aiOrderId);
      
      if (error) {
        console.warn('⚠️ فشل ربط الطلب الذكي بالطلب الحقيقي:', error);
        return { success: false, error: error.message };
      }
      
      return { success: true };
    } catch (err) {
      console.error('❌ خطأ في ربط الطلب الذكي:', err);
      return { success: false, error: err.message };
    }
  }, []);

  // حذف طلب ذكي مع ربطه بطلب حقيقي أولاً
  const deleteAiOrderWithLink = useCallback(async (aiOrderId, realOrderId) => {
    try {
      // ربط أولاً للتتبع
      if (realOrderId) {
        await linkAiOrderToRealOrder(aiOrderId, realOrderId);
      }
      
      // ثم حذف بأمان
      return await deleteAiOrderSafely(aiOrderId);
    } catch (err) {
      console.error('❌ خطأ في معالجة الطلب الذكي:', err);
      return { success: false, error: err.message };
    }
  }, [linkAiOrderToRealOrder, deleteAiOrderSafely]);

  // تنظيف جميع الطلبات الذكية المتبقية - النسخة المحسنة
  const cleanupOrphanedAiOrders = useCallback(async () => {
    try {
      console.log('🧹 بدء تنظيف الطلبات الذكية المتبقية...');
      
      const { data: deletedCount, error } = await supabase.rpc('cleanup_orphaned_ai_orders');
      
      if (error) {
        console.error('❌ فشل تنظيف الطلبات الذكية:', error);
        return { success: false, error: error.message, deletedCount: 0 };
      }
      
      // إرسال إشعار للنافذة بتحديث البيانات
      window.dispatchEvent(new CustomEvent('aiOrdersCleanedUp', { 
        detail: { deletedCount: deletedCount || 0 } 
      }));
      
      console.log(`✅ تم حذف ${deletedCount || 0} طلب ذكي متبقي`);
      return { success: true, deletedCount: deletedCount || 0 };
    } catch (err) {
      console.error('❌ خطأ في تنظيف الطلبات الذكية:', err);
      return { success: false, error: err.message, deletedCount: 0 };
    }
  }, []);

  // التحقق من وجود طلبات ذكية متبقية
  const checkOrphanedAiOrders = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('ai_orders')
        .select('id, customer_name, source, created_at')
        .is('related_order_id', null)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('❌ فشل فحص الطلبات الذكية المتبقية:', error);
        return { success: false, orders: [] };
      }
      
      return { success: true, orders: data || [] };
    } catch (err) {
      console.error('❌ خطأ في فحص الطلبات الذكية:', err);
      return { success: false, orders: [] };
    }
  }, []);

  return {
    deleteAiOrderSafely,
    linkAiOrderToRealOrder,
    deleteAiOrderWithLink,
    cleanupOrphanedAiOrders,
    checkOrphanedAiOrders
  };
};