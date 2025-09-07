import { useEffect, useState, useCallback } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';

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
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, status: '' });

  // دالة المزامنة الشاملة عند بدء التطبيق
  const performComprehensiveSync = useCallback(async (visibleOrders = null, syncVisibleOrdersBatch = null) => {
    if (syncing) return;
    
    setSyncing(true);
    setSyncProgress({ current: 0, total: 4, status: 'بدء المزامنة الشاملة...' });
    
    try {
      console.log('🚀 بدء المزامنة الشاملة عند تشغيل التطبيق');

      // المرحلة 1: مزامنة الفواتير الجديدة
      setSyncProgress({ current: 1, total: 4, status: 'جلب الفواتير الجديدة...' });
      const { data: invoiceData, error: invoiceError } = await supabase.functions.invoke('smart-invoice-sync', {
        body: { 
          mode: 'smart',
          sync_invoices: true,
          sync_orders: false,
          force_refresh: false
        }
      });

      if (invoiceError) throw invoiceError;

      // المرحلة 2: تحديث حالات الطلبات الذكية (إذا توفرت الطلبات المرئية)
      setSyncProgress({ current: 2, total: 4, status: 'تحديث الطلبات المرئية...' });
      let ordersUpdated = 0;
      
      if (visibleOrders && Array.isArray(visibleOrders) && visibleOrders.length > 0 && syncVisibleOrdersBatch) {
        console.log(`📋 استخدام المزامنة الذكية للطلبات المرئية: ${visibleOrders.length} طلب`);
        
        const ordersResult = await syncVisibleOrdersBatch(visibleOrders);
        ordersUpdated = ordersResult?.updatedCount || 0;
        
        console.log(`✅ تحديث ذكي للطلبات المرئية: ${ordersUpdated} طلب محدث`);
      } else {
        // التراجع للمزامنة التقليدية إذا لم تتوفر الطلبات المرئية
        console.log('📋 استخدام المزامنة التقليدية للطلبات');
        const { data: ordersData, error: ordersError } = await supabase.functions.invoke('smart-invoice-sync', {
          body: { 
            mode: 'smart',
            sync_invoices: false,
            sync_orders: true,
            force_refresh: false
          }
        });

        if (ordersError) throw ordersError;
        ordersUpdated = ordersData?.orders_updated || 0;
      }

      // المرحلة 3: تنظيف البيانات القديمة
      setSyncProgress({ current: 3, total: 4, status: 'تنظيف البيانات القديمة...' });
      await supabase.rpc('cleanup_old_delivery_invoices');

      // المرحلة 4: إرسال إشعار النجاح
      setSyncProgress({ current: 4, total: 4, status: 'اكتمال المزامنة...' });
      
      const totalInvoices = invoiceData?.invoices_synced || 0;
      
      console.log(`✅ مزامنة شاملة مكتملة: ${totalInvoices} فاتورة، ${ordersUpdated} طلب`);
      
      // إرسال إشعار النجاح
      toast({
        title: "🎉 مزامنة شاملة مكتملة",
        description: `تم جلب ${totalInvoices} فاتورة جديدة وتحديث ${ordersUpdated} طلب`,
        variant: "default",
        duration: 8000
      });

      // تسجيل وقت المزامنة
      setLastAppStartSync(Date.now());
      setSessionSynced(true);

      // إرسال إشارة للنظام
      window.dispatchEvent(new CustomEvent('comprehensiveSyncCompleted', { 
        detail: { 
          invoices: totalInvoices, 
          orders: ordersUpdated,
          timestamp: new Date().toISOString()
        } 
      }));

    } catch (error) {
      console.error('⚠️ فشل في المزامنة الشاملة:', error);
      toast({
        title: "خطأ في المزامنة الشاملة",
        description: error.message || 'حدث خطأ غير متوقع',
        variant: "destructive",
        duration: 6000
      });
    } finally {
      setSyncing(false);
      setSyncProgress({ current: 0, total: 0, status: '' });
    }
  }, [syncing, setLastAppStartSync, setSessionSynced]);

  useEffect(() => {
    const checkAndPerformSync = async () => {
      // التحقق من إعدادات المزامنة
      if (
        !syncSettings.enabled || 
        !syncSettings.autoSyncOnAppStart ||
        !token || 
        !isLoggedIn || 
        activePartner !== 'alwaseet' ||
        sessionSynced
      ) {
        return;
      }

      // التحقق من آخر مزامنة (مرة واحدة يومياً)
      const today = new Date().toDateString();
      const lastSyncDate = lastAppStartSync ? new Date(lastAppStartSync).toDateString() : null;
      
      if (lastSyncDate === today) {
        setSessionSynced(true);
        return;
      }

      // تأخير قصير للتأكد من جاهزية النظام
      const timeoutId = setTimeout(performComprehensiveSync, 2000);
      
      return () => clearTimeout(timeoutId);
    };

    checkAndPerformSync();
  }, [token, isLoggedIn, activePartner, syncSettings, lastAppStartSync, sessionSynced, performComprehensiveSync]);

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
    sessionSynced
  };
};