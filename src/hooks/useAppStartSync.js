import { useEffect, useState, useCallback } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';
import devLog from '@/lib/devLogger';

/**
 * Hook for handling comprehensive app start synchronization
 * Runs comprehensive sync once per app session
 */
export const useAppStartSync = () => {
  const { token, isLoggedIn, activePartner } = useAlWaseet();
  const [syncSettings] = useLocalStorage('delivery-invoice-sync-settings', {
    enabled: true,
    autoSyncOnAppStart: true,
    comprehensiveOnStart: true
  });
  const [lastAppStartSync, setLastAppStartSync] = useLocalStorage('app-start-sync', null);
  const [sessionSynced, setSessionSynced] = useLocalStorage('session-synced', false);
  const [syncing, setSyncing] = useState(false);
  const [isAutoSync, setIsAutoSync] = useState(false); // معرفة إذا كانت المزامنة تلقائية
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, status: '' });

  // دالة المزامنة الشاملة عند بدء التطبيق - محسنة لاستخدام syncVisibleOrdersBatch
  const performComprehensiveSync = useCallback(async (visibleOrders = null, syncVisibleOrdersBatch = null, autoSync = false) => {
    if (syncing) return;
    
    setSyncing(true);
    setIsAutoSync(autoSync); // تحديد إذا كانت المزامنة تلقائية
    setSyncProgress({ current: 0, total: 4, status: 'بدء المزامنة الشاملة...' });
    
    try {
      devLog.log('🚀 بدء المزامنة الشاملة الذكية عند تشغيل التطبيق');

      // المرحلة 1: مزامنة الطلبات المرئية بالأولوية القصوى
      setSyncProgress({ current: 1, total: 3, status: 'مزامنة الطلبات المرئية...' });
      let ordersUpdated = 0;
      
      if (visibleOrders && Array.isArray(visibleOrders) && visibleOrders.length > 0 && syncVisibleOrdersBatch) {
        devLog.log(`📋 مزامنة الطلبات المرئية: ${visibleOrders.length} طلب`);
        
        const ordersResult = await syncVisibleOrdersBatch(visibleOrders, (progress) => {
          devLog.log(`📊 تقدم المزامنة: ${progress.processed}/${progress.total} موظفين، ${progress.updated} طلب محدث`);
        });
        
        if (ordersResult.success) {
          ordersUpdated = ordersResult.updatedCount || 0;
          devLog.log(`✅ مزامنة الطلبات المرئية: ${ordersUpdated} طلب محدث`);
        }
      }

      // المرحلة 2: تنظيف البيانات القديمة
      setSyncProgress({ current: 2, total: 3, status: 'تنظيف البيانات القديمة...' });
      await supabase.rpc('cleanup_old_delivery_invoices');

      // المرحلة 3: إرسال إشعار النجاح
      setSyncProgress({ current: 3, total: 3, status: 'اكتمال المزامنة...' });
      
      const totalInvoices = 0; // لا يتم جلب الفواتير في المزامنة الشاملة
      
      devLog.log(`✅ مزامنة شاملة ذكية مكتملة: ${totalInvoices} فاتورة، ${ordersUpdated} طلب`);
      
      // إرسال إشعار النجاح محسن فقط للمزامنة اليدوية
      if (!autoSync) {
        toast({
          title: "🎉 مزامنة شاملة ذكية مكتملة",
          description: `تم تحديث ${ordersUpdated} طلب وجلب ${totalInvoices} فاتورة جديدة بنجاح`,
          variant: "default",
          duration: 8000
        });
      }

      // تسجيل وقت المزامنة
      setLastAppStartSync(Date.now());
      setSessionSynced(true);

      // إرسال إشارة للنظام مع بيانات محسنة
      window.dispatchEvent(new CustomEvent('comprehensiveSyncCompleted', { 
        detail: { 
          invoices: totalInvoices, 
          orders: ordersUpdated,
          smartSync: true,
          timestamp: new Date().toISOString()
        } 
      }));

    } catch (error) {
      console.error('⚠️ فشل في المزامنة الشاملة الذكية:', error);
      toast({
        title: "خطأ في المزامنة الشاملة",
        description: error.message || 'حدث خطأ غير متوقع',
        variant: "destructive",
        duration: 6000
      });
    } finally {
      setSyncing(false);
      setIsAutoSync(false); // إعادة تعيين حالة المزامنة التلقائية
      setSyncProgress({ current: 0, total: 0, status: '' });
    }
  }, [syncing, setLastAppStartSync, setSessionSynced]);

  useEffect(() => {
    // ⛔ تعطيل المزامنة الشاملة - AlWaseetContext يتولى المزامنة الأولية
    devLog.log('ℹ️ مزامنة AppStartSync معطلة - AlWaseetContext يتولى المزامنة');
    return;
  }, []);

  // إعادة تعيين علامة الجلسة عند إعادة تحميل التطبيق
  useEffect(() => {
    const handleBeforeUnload = () => {
      setSessionSynced(false);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [setSessionSynced]);

  return { 
    syncing, 
    syncProgress,
    performComprehensiveSync,
    sessionSynced,
    isAutoSync
  };
};