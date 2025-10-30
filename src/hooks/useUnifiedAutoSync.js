import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

/**
 * Hook للمزامنة التلقائية الموحدة والذكية
 */
export const useUnifiedAutoSync = () => {
  const [syncSettings, setSyncSettings] = useState(null);
  const [lastAutoSync, setLastAutoSync] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // جلب إعدادات المزامنة
  const loadSyncSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('invoice_sync_settings')
        .select('*')
        .maybeSingle();

      if (error) throw error;

      // إعدادات افتراضية محسنة
      const defaultSettings = {
        // إعدادات الفواتير
        invoice_auto_sync: true,
        invoice_daily_sync: true,
        invoice_sync_time: '09:00:00',
        
        // إعدادات الطلبات
        orders_auto_sync: true,
        orders_twice_daily: true,
        orders_morning_time: '09:00:00',
        orders_evening_time: '18:00:00',
        
        // إعدادات عامة
        sync_only_visible_orders: true,
        sync_work_hours_only: true,
        work_start_hour: 8,
        work_end_hour: 20,
        
        lookback_days: 30,
        auto_cleanup_enabled: true,
        keep_invoices_per_employee: 10
      };

      setSyncSettings(data || defaultSettings);
      return data || defaultSettings;
    } catch (error) {
      console.error('خطأ في جلب إعدادات المزامنة:', error);
      return null;
    }
  }, []);

  // حفظ إعدادات المزامنة
  const saveSyncSettings = useCallback(async (newSettings) => {
    try {
      const { data, error } = await supabase
        .from('invoice_sync_settings')
        .upsert([{ id: 1, ...newSettings }])
        .select()
        .single();

      if (error) throw error;

      setSyncSettings(data);
      toast({
        title: "✅ تم حفظ إعدادات المزامنة",
        description: "تم تحديث إعدادات المزامنة التلقائية بنجاح",
        variant: "default"
      });

      return data;
    } catch (error) {
      console.error('خطأ في حفظ إعدادات المزامنة:', error);
      toast({
        title: "خطأ في حفظ الإعدادات",
        description: error.message,
        variant: "destructive"
      });
      return null;
    }
  }, []);

  // مزامنة تلقائية للفواتير فقط (خفيفة وسريعة)
  const autoSyncInvoices = useCallback(async () => {
    if (isSyncing || !syncSettings?.invoice_auto_sync) return;

    try {
      setIsSyncing(true);
      devLog.log('🔄 مزامنة تلقائية للفواتير...');

      const { data, error } = await supabase.functions.invoke('smart-invoice-sync', {
        body: { 
          mode: 'smart',
          sync_invoices: true,
          sync_orders: false,
          force_refresh: false
        }
      });

      if (error) throw error;

      if (data?.invoices_synced > 0) {
        devLog.log(`✅ مزامنة تلقائية: ${data.invoices_synced} فاتورة جديدة`);
        
        // إشعار خفيف (بدون toast مزعج)
        window.dispatchEvent(new CustomEvent('autoSyncCompleted', { 
          detail: { 
            type: 'invoices', 
            count: data.invoices_synced,
            timestamp: new Date()
          } 
        }));
      }

      setLastAutoSync(new Date());
      return { success: true, data };

    } catch (error) {
      console.error('خطأ في المزامنة التلقائية للفواتير:', error);
      return { success: false, error };
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, syncSettings]);

  // مزامنة تلقائية للطلبات الظاهرة فقط
  const autoSyncVisibleOrders = useCallback(async (visibleOrders = []) => {
    if (isSyncing || !syncSettings?.orders_auto_sync || visibleOrders.length === 0) return;

    try {
      setIsSyncing(true);
      devLog.log(`🔄 مزامنة تلقائية للطلبات الظاهرة: ${visibleOrders.length} طلب`);

      // استيراد دالة المزامنة الذكية
      const { useAlWaseet } = await import('../contexts/AlWaseetContext');
      const { syncVisibleOrdersBatch } = useAlWaseet();
      
      const result = await syncVisibleOrdersBatch(visibleOrders);

      if (result?.success && result.updatedCount > 0) {
        devLog.log(`✅ مزامنة تلقائية: ${result.updatedCount} طلب محدث`);
        
        // إشعار خفيف
        window.dispatchEvent(new CustomEvent('autoSyncCompleted', { 
          detail: { 
            type: 'orders', 
            count: result.updatedCount,
            timestamp: new Date()
          } 
        }));
      }

      setLastAutoSync(new Date());
      return result;

    } catch (error) {
      console.error('خطأ في المزامنة التلقائية للطلبات:', error);
      return { success: false, error };
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, syncSettings]);

  // التحقق من الحاجة للمزامنة التلقائية
  const shouldAutoSync = useCallback((type = 'invoices') => {
    if (!syncSettings) return false;

    const now = new Date();
    const currentHour = now.getHours();

    // التحقق من ساعات العمل
    if (syncSettings.sync_work_hours_only) {
      if (currentHour < syncSettings.work_start_hour || currentHour > syncSettings.work_end_hour) {
        return false;
      }
    }

    // التحقق من آخر مزامنة
    if (lastAutoSync) {
      const timeDiff = now - lastAutoSync;
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      
      // منع المزامنة المتكررة (مرة كل ساعة على الأقل)
      if (hoursDiff < 1) return false;
    }

    return true;
  }, [syncSettings, lastAutoSync]);

  // تهيئة المزامنة التلقائية عند فتح التطبيق
  useEffect(() => {
    loadSyncSettings();
  }, [loadSyncSettings]);

  // مزامنة واحدة عند فتح صفحة متابعة الموظفين
  useEffect(() => {
    const isEmployeeFollowUpPage = window.location.pathname === '/employee-follow-up';
    
    if (isEmployeeFollowUpPage && syncSettings?.invoice_auto_sync && shouldAutoSync('invoices')) {
      const timer = setTimeout(() => {
        devLog.log('🚀 مزامنة تلقائية عند فتح صفحة متابعة الموظفين');
        autoSyncInvoices();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [syncSettings, shouldAutoSync, autoSyncInvoices]);

  return {
    syncSettings,
    lastAutoSync,
    isSyncing,
    loadSyncSettings,
    saveSyncSettings,
    autoSyncInvoices,
    autoSyncVisibleOrders,
    shouldAutoSync
  };
};