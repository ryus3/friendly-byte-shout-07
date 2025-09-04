import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Global hook for automatic invoice synchronization
export const useGlobalInvoiceSync = () => {
  const syncInvoices = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('sync_recent_received_invoices');
      if (error) {
        console.warn('Background invoice sync failed:', error.message);
      } else if (data?.updated_orders_count > 0) {
        console.log(`🔄 Background sync: Updated ${data.updated_orders_count} orders from received invoices`);
        
        // Dispatch event for other components to react
        window.dispatchEvent(new CustomEvent('invoicesSynced', { 
          detail: { updatedOrders: data.updated_orders_count } 
        }));
      }
    } catch (error) {
      console.warn('Background invoice sync error:', error);
    }
  }, []);

  useEffect(() => {
    // Run initial sync after 5 seconds
    const initialTimer = setTimeout(syncInvoices, 5000);
    
    // Run sync every 60 seconds
    const interval = setInterval(syncInvoices, 60000);
    
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [syncInvoices]);

  return { syncInvoices };
};