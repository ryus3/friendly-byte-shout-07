import { useEffect } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import * as AlWaseetAPI from '@/lib/alwaseet-api';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Hook for handling app start synchronization
 * Runs once per app session based on settings
 */
export const useAppStartSync = () => {
  const { token, isLoggedIn, activePartner } = useAlWaseet();
  const [syncSettings] = useLocalStorage('delivery-invoice-sync-settings', {
    enabled: true,
    autoSyncOnAppStart: true
  });
  const [lastAppStartSync, setLastAppStartSync] = useLocalStorage('app-start-sync', null);
  const [sessionSynced, setSessionSynced] = useLocalStorage('session-synced', false);

  useEffect(() => {
    const performAppStartSync = async () => {
      // Check if we should sync on app start
      if (
        !syncSettings.enabled || 
        !syncSettings.autoSyncOnAppStart ||
        !token || 
        !isLoggedIn || 
        activePartner !== 'alwaseet' ||
        sessionSynced // Already synced this session
      ) {
        return;
      }

      // Check if we already synced today
      const today = new Date().toDateString();
      const lastSyncDate = lastAppStartSync ? new Date(lastAppStartSync).toDateString() : null;
      
      if (lastSyncDate === today) {
        setSessionSynced(true);
        return;
      }

      try {
        console.log('🚀 تشغيل مزامنة بداية التطبيق');
        
        // Fetch recent invoices from API
        const recentInvoices = await AlWaseetAPI.getMerchantInvoices(token);
        
        if (recentInvoices?.length > 0) {
          // Save to database
          await supabase.rpc('upsert_alwaseet_invoice_list', {
            p_invoices: recentInvoices
          });
          
          console.log('✅ مزامنة بداية التطبيق اكتملت:', recentInvoices.length, 'فاتورة');
          setLastAppStartSync(Date.now());
          setSessionSynced(true);
        }
      } catch (error) {
        console.warn('⚠️ فشل في مزامنة بداية التطبيق:', error.message);
      }
    };

    // Small delay to ensure contexts are ready
    const timeoutId = setTimeout(performAppStartSync, 1000);
    
    return () => clearTimeout(timeoutId);
  }, [token, isLoggedIn, activePartner, syncSettings, lastAppStartSync, sessionSynced]);

  // Reset session flag when app restarts (page reload)
  useEffect(() => {
    const handleBeforeUnload = () => {
      setSessionSynced(false);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);
};