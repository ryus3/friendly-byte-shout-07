import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Global hook for automatic SMART invoice synchronization (no more conflicts!)
export const useGlobalInvoiceSync = () => {
  // استخدام المزامنة الذكية الحقيقية بدلاً من القديمة
  const smartSync = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('smart-invoice-sync', {
        body: { 
          mode: 'smart',
          sync_invoices: true,
          sync_orders: false,
          force_refresh: false // فقط الفواتير الجديدة
        }
      });
      
      if (error) {
        console.warn('🔄 Smart background sync failed:', error.message);
      } else if (data?.invoices_synced > 0) {
        console.log(`🔄 Smart sync: ${data.invoices_synced} new invoices synced`);
        window.dispatchEvent(new CustomEvent('invoicesSynced', { 
          detail: { updatedOrders: data.invoices_synced, syncType: 'smart' } 
        }));
      } else {
        console.log('🔄 Smart sync: No new invoices found');
      }
    } catch (error) {
      console.warn('Smart background sync error:', error);
    }
  }, []);

  // إبقاء وظيفة المزامنة الشاملة للاستخدام اليدوي فقط
  const syncComprehensive = useCallback(async (reason = 'manual') => {
    try {
      const { data, error } = await supabase.functions.invoke('smart-invoice-sync', {
        body: { 
          mode: 'comprehensive',
          sync_invoices: true,
          sync_orders: true,
          force_refresh: true
        }
      });
      
      if (error) {
        console.warn('Comprehensive sync failed:', error.message);
      } else if (data?.invoices_synced || data?.orders_updated) {
        console.log(`✅ Comprehensive sync: invoices=${data?.invoices_synced || 0}, orders=${data?.orders_updated || 0}`);
        window.dispatchEvent(new CustomEvent('invoicesSynced', { 
          detail: { 
            updatedOrders: data?.orders_updated || 0, 
            syncType: 'comprehensive' 
          } 
        }));
      }
    } catch (e) {
      console.warn('Comprehensive sync error:', e);
    }
  }, []);

  useEffect(() => {
    // مزامنة ذكية واحدة فقط عند فتح التطبيق (لا توجد مزامنة شاملة تلقائية)
    const initialTimer = setTimeout(() => {
      smartSync(); // فقط مزامنة ذكية سريعة
    }, 3000);

    // مزامنة ذكية كل 5 دقائق بدلاً من كل دقيقة (تقليل التداخل)
    const intervalSmart = setInterval(smartSync, 5 * 60 * 1000); // كل 5 دقائق

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalSmart);
    };
  }, [smartSync]);

  return { 
    syncInvoices: smartSync, // للتوافق مع الرمز الموجود
    syncComprehensive 
  };
};