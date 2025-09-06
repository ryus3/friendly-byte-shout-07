import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Global hook for automatic invoice/order synchronization
export const useGlobalInvoiceSync = () => {
  const syncInvoices = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('sync_recent_received_invoices');
      if (error) {
        console.warn('Background invoice sync failed:', error.message);
      } else if (data?.updated_orders_count > 0) {
        console.log(`🔄 Background sync: Updated ${data.updated_orders_count} orders from received invoices`);
        window.dispatchEvent(new CustomEvent('invoicesSynced', { detail: { updatedOrders: data.updated_orders_count } }));
      }
    } catch (error) {
      console.warn('Background invoice sync error:', error);
    }
  }, []);

  const syncComprehensive = useCallback(async (reason = 'app_open') => {
    try {
      const { data, error } = await supabase.functions.invoke('sync-alwaseet-invoices', {
        body: { scheduled: false, force: true, sync_time: reason },
      });
      if (error) {
        console.warn('Comprehensive sync failed:', error.message);
      } else if (data?.orders_updated || data?.total_synced) {
        console.log(`✅ Comprehensive sync: invoices=${data?.total_synced || 0}, orders=${data?.orders_updated || 0}`);
        window.dispatchEvent(new CustomEvent('invoicesSynced', { detail: { updatedOrders: data?.orders_updated || 0 } }));
      }
    } catch (e) {
      console.warn('Comprehensive sync error:', e);
    }
  }, []);

  useEffect(() => {
    // Initial quick sync and comprehensive sync after 5 seconds
    const initialTimer = setTimeout(() => {
      syncInvoices();
      syncComprehensive('app_open');
    }, 5000);

    // Quick sync every 60s
    const intervalQuick = setInterval(syncInvoices, 60000);
    // Comprehensive sync every 15 minutes
    const intervalFull = setInterval(() => syncComprehensive('background_15m'), 15 * 60 * 1000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalQuick);
      clearInterval(intervalFull);
    };
  }, [syncInvoices, syncComprehensive]);

  return { syncInvoices, syncComprehensive };
};