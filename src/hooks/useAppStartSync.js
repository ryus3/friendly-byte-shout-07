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
  const performComprehensiveSync = useCallback(async () => {
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

      // المرحلة 2: تحديث حالات الطلبات
      setSyncProgress({ current: 2, total: 4, status: 'تحديث حالات الطلبات...' });
      const { data: ordersData, error: ordersError } = await supabase.functions.invoke('smart-invoice-sync', {
        body: { 
          mode: 'smart',
          sync_invoices: false,
          sync_orders: true,
          force_refresh: false
        }
      });

      if (ordersError) throw ordersError;

      // المرحلة 3: تنظيف البيانات القديمة
      setSyncProgress({ current: 3, total: 4, status: 'تنظيف البيانات القديمة...' });
      await supabase.rpc('cleanup_old_delivery_invoices');

      // المرحلة 4: إرسال إشعار النجاح
      setSyncProgress({ current: 4, total: 4, status: 'اكتمال المزامنة...' });
      
      const totalInvoices = invoiceData?.invoices_synced || 0;
      const totalOrders = ordersData?.orders_updated || 0;
      
      console.log(`✅ مزامنة شاملة مكتملة: ${totalInvoices} فاتورة، ${totalOrders} طلب`);
      
      // إرسال إشعار النجاح
      toast({
        title: "🎉 مزامنة شاملة مكتملة",
        description: `تم جلب ${totalInvoices} فاتورة جديدة وتحديث ${totalOrders} طلب`,
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
          orders: totalOrders,
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