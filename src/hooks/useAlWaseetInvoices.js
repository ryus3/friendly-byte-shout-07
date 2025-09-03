
import { useState, useCallback, useEffect } from 'react';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import * as AlWaseetAPI from '@/lib/alwaseet-api';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/UnifiedAuthContext';

export const useAlWaseetInvoices = () => {
  const { token, isLoggedIn, activePartner } = useAlWaseet();
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceOrders, setInvoiceOrders] = useState([]);
  const [autoSyncLoading, setAutoSyncLoading] = useState(false);

  // Fetch all merchant invoices
  const fetchInvoices = useCallback(async (timeFilter = 'week') => {
    if (!token || !isLoggedIn || activePartner !== 'alwaseet') {
      return;
    }

    setLoading(true);
    try {
      const invoicesData = await AlWaseetAPI.getMerchantInvoices(token);
      
      // Apply time filtering
      const filteredAndSortedInvoices = (invoicesData || [])
        .filter(invoice => {
          if (timeFilter === 'all') return true;
          
          const invoiceDate = new Date(invoice.updated_at || invoice.created_at);
          const now = new Date();
          
          switch (timeFilter) {
            case 'week':
              const weekAgo = new Date();
              weekAgo.setDate(weekAgo.getDate() - 7);
              return invoiceDate >= weekAgo;
            case 'month':
              const monthAgo = new Date();
              monthAgo.setMonth(monthAgo.getMonth() - 1);
              return invoiceDate >= monthAgo;
            case '3months':
              const threeMonthsAgo = new Date();
              threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
              return invoiceDate >= threeMonthsAgo;
            case '6months':
              const sixMonthsAgo = new Date();
              sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
              return invoiceDate >= sixMonthsAgo;
            case 'year':
              const yearAgo = new Date();
              yearAgo.setFullYear(yearAgo.getFullYear() - 1);
              return invoiceDate >= yearAgo;
            case 'custom':
              return invoice; // Handle custom range in the component
            default:
              return true;
          }
        })
        .sort((a, b) => {
          // First sort by status - pending invoices first
          const aIsPending = a.status !== 'تم الاستلام من قبل التاجر';
          const bIsPending = b.status !== 'تم الاستلام من قبل التاجر';
          
          if (aIsPending && !bIsPending) return -1;
          if (!aIsPending && bIsPending) return 1;
          
          // Then sort by date - newest first
          const aDate = new Date(a.updated_at || a.created_at);
          const bDate = new Date(b.updated_at || b.created_at);
          return bDate - aDate;
        });
      
      setInvoices(filteredAndSortedInvoices);
      return filteredAndSortedInvoices;
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast({
        title: 'خطأ في جلب الفواتير',
        description: error.message,
        variant: 'destructive'
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, [token, isLoggedIn, activePartner]);

  // Fetch orders for a specific invoice
  const fetchInvoiceOrders = useCallback(async (invoiceId) => {
    if (!token || !invoiceId) return null;

    setLoading(true);
    try {
      const invoiceData = await AlWaseetAPI.getInvoiceOrders(token, invoiceId);
      setInvoiceOrders(invoiceData?.orders || []);
      setSelectedInvoice(invoiceData?.invoice?.[0] || null);
      return invoiceData;
    } catch (error) {
      console.error('Error fetching invoice orders:', error);
      toast({
        title: 'خطأ في جلب طلبات الفاتورة',
        description: error.message,
        variant: 'destructive'
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Receive (confirm) an invoice
  const receiveInvoice = useCallback(async (invoiceId) => {
    if (!token || !invoiceId) return false;

    setLoading(true);
    try {
      // 1) Confirm invoice on Al-Waseet
      await AlWaseetAPI.receiveInvoice(token, invoiceId);

      // 2) Fetch invoice details (orders + invoice meta)
      const invoiceData = await fetchInvoiceOrders(invoiceId);
      const waseetOrders = invoiceData?.orders || [];
      const invoiceMeta = invoiceData?.invoice?.[0] || null;
      const invoiceDate = invoiceMeta?.updated_at || invoiceMeta?.created_at || new Date().toISOString();

      // 3) Map Waseet order IDs to strings for local matching
      const waseetOrderIds = waseetOrders.map(o => String(o.id));

      // 4) Fetch matching local orders
      let updatedOrdersCount = 0;
      let profitsUpdatedCount = 0;
      let missingMappingsCount = 0;

      if (waseetOrderIds.length > 0) {
        const { data: localOrders, error: localOrdersError } = await supabase
          .from('orders')
          .select('id, order_number, delivery_partner_order_id, delivery_partner, receipt_received')
          .eq('delivery_partner', 'alwaseet')
          .in('delivery_partner_order_id', waseetOrderIds);

        if (localOrdersError) {
          console.error('Error fetching local orders for invoice linking:', localOrdersError);
        }

        // Orders that couldn't be matched locally
        const matchedIds = new Set((localOrders || []).map(o => String(o.delivery_partner_order_id)));
        missingMappingsCount = waseetOrderIds.filter(id => !matchedIds.has(id)).length;

        // 5) Update matched local orders to mark receipt received and attach invoice meta
        if (localOrders && localOrders.length > 0) {
          const { data: updated, error: updateError } = await supabase
            .from('orders')
            .update({
              receipt_received: true,
              delivery_partner_invoice_id: String(invoiceId),
              delivery_partner_invoice_date: invoiceDate,
              invoice_received_at: new Date().toISOString(),
              invoice_received_by: user?.id || user?.user_id || null
            })
            .eq('delivery_partner', 'alwaseet')
            .in('id', localOrders.map(o => o.id))
            .select('id');

          if (updateError) {
            console.error('Error updating local orders with invoice receipt:', updateError);
          } else {
            updatedOrdersCount = updated?.length || 0;
          }

          // 6) Try updating related profits status to 'invoice_received' if not settled
          const localOrderIds = (localOrders || []).map(o => o.id);
          if (localOrderIds.length > 0) {
            const { data: updatedProfits, error: profitsError } = await supabase
              .from('profits')
              .update({ status: 'invoice_received', updated_at: new Date().toISOString() })
              .in('order_id', localOrderIds)
              .neq('status', 'settled')
              .select('id');

            if (profitsError) {
              console.warn('Skipping profits update due to RLS/permissions or other error:', profitsError.message);
            } else {
              profitsUpdatedCount = updatedProfits?.length || 0;
            }
          }
        }
      }

      // 7) Update invoice status locally for UI
      setInvoices(prev => prev.map(inv =>
        inv.id === invoiceId ? { ...inv, status: 'تم الاستلام من قبل التاجر' } : inv
      ));

      // 8) User feedback
      toast({
        title: 'تم تأكيد استلام الفاتورة',
        description: `تم تعليم ${updatedOrdersCount} طلب كمستلم للفاتورة${missingMappingsCount ? `، وتعذر ربط ${missingMappingsCount} طلب` : ''}${profitsUpdatedCount ? `، وتحديث ${profitsUpdatedCount} سجل أرباح` : ''}.`,
        variant: 'success'
      });

      // 9) Refresh invoices to get latest
      await fetchInvoices();
      return true;
    } catch (error) {
      console.error('Error receiving invoice:', error);
      toast({
        title: 'خطأ في تأكيد الاستلام',
        description: error.message,
        variant: 'destructive'
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [token, fetchInvoices, fetchInvoiceOrders, user?.id, user?.user_id]);

  // Link invoice with local orders based on merchant_invoice_id
  const linkInvoiceWithLocalOrders = useCallback(async (invoiceId) => {
    if (!invoiceId) return [];

    try {
      const { data: localOrders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('delivery_partner', 'alwaseet')
        .not('delivery_partner_order_id', 'is', null);

      if (error) {
        console.error('Error fetching local orders:', error);
        return [];
      }

      // Get Al-Waseet orders for this invoice
      const invoiceData = await fetchInvoiceOrders(invoiceId);
      const waseetOrders = invoiceData?.orders || [];

      // Match local orders with Al-Waseet orders by delivery_partner_order_id
      const linkedOrders = [];
      for (const waseetOrder of waseetOrders) {
        const localOrder = localOrders.find(lo => 
          lo.delivery_partner_order_id === String(waseetOrder.id)
        );
        
        if (localOrder) {
          linkedOrders.push({
            ...localOrder,
            waseet_data: waseetOrder
          });
        }
      }

      return linkedOrders;
    } catch (error) {
      console.error('Error linking invoice with local orders:', error);
      return [];
    }
  }, [fetchInvoiceOrders]);

  // Get invoice statistics
  const getInvoiceStats = useCallback(() => {
    const totalInvoices = invoices.length;
    const pendingInvoices = invoices.filter(inv => 
      inv.status !== 'تم الاستلام من قبل التاجر'
    ).length;
    const totalAmount = invoices.reduce((sum, inv) => 
      sum + (parseFloat(inv.merchant_price) || 0), 0
    );
    const totalOrders = invoices.reduce((sum, inv) => 
      sum + (parseInt(inv.delivered_orders_count) || 0), 0
    );

    return {
      totalInvoices,
      pendingInvoices,
      totalAmount,
      totalOrders
    };
  }, [invoices]);

  // Apply custom date range filtering
  const applyCustomDateRangeFilter = useCallback((invoices, dateRange) => {
    if (!dateRange?.from) return invoices;
    
    return invoices.filter(invoice => {
      const invoiceDate = new Date(invoice.updated_at || invoice.created_at);
      const fromDate = new Date(dateRange.from);
      const toDate = dateRange.to ? new Date(dateRange.to) : new Date();
      
      return invoiceDate >= fromDate && invoiceDate <= toDate;
    });
  }, []);

  // Automatic sync for received invoices
  const autoSyncReceivedInvoices = useCallback(async () => {
    if (!token || !isLoggedIn || activePartner !== 'alwaseet') return;

    // Rate limiting guard - only sync once every 10 minutes
    const lastSyncKey = 'alwaseet-auto-sync-last-time';
    const lastSyncTime = localStorage.getItem(lastSyncKey);
    const now = Date.now();
    const tenMinutes = 10 * 60 * 1000;
    
    if (lastSyncTime && (now - parseInt(lastSyncTime)) < tenMinutes) {
      console.log('🔄 تخطي المزامنة التلقائية - لم تمر 10 دقائق بعد');
      return;
    }

    setAutoSyncLoading(true);
    try {
      // Get current invoices and filter only received ones
      const currentInvoices = await AlWaseetAPI.getMerchantInvoices(token);
      const receivedInvoices = (currentInvoices || []).filter(inv => 
        inv.status === 'تم الاستلام من قبل التاجر'
      );

      if (receivedInvoices.length === 0) {
        console.log('📄 لا توجد فواتير مستلمة للمزامنة');
        return;
      }

      console.log(`🔄 بدء المزامنة التلقائية لـ ${receivedInvoices.length} فاتورة مستلمة`);

      // Check which received invoices need syncing (not already in local DB)
      const { data: existingInvoices, error: checkError } = await supabase
        .from('delivery_invoices')
        .select('external_id, received')
        .eq('partner', 'alwaseet')
        .in('external_id', receivedInvoices.map(inv => inv.id));

      if (checkError) {
        console.error('❌ خطأ في فحص الفواتير الموجودة:', checkError);
        return;
      }

      // Find invoices that need syncing (not in DB or not marked as received)
      const existingMap = new Map((existingInvoices || []).map(inv => [inv.external_id, inv.received]));
      const invoicesToSync = receivedInvoices.filter(inv => 
        !existingMap.has(inv.id) || !existingMap.get(inv.id)
      );

      if (invoicesToSync.length === 0) {
        console.log('✅ جميع الفواتير المستلمة متزامنة بالفعل');
        localStorage.setItem(lastSyncKey, now.toString());
        return;
      }

      console.log(`🔄 مزامنة ${invoicesToSync.length} فاتورة جديدة أو غير متزامنة`);

      // Limit to 3 invoices per sync to avoid rate limits and overload
      const limitedInvoices = invoicesToSync.slice(0, 3);
      let syncedCount = 0;

      for (const invoice of limitedInvoices) {
        try {
          // Get invoice orders
          const invoiceData = await AlWaseetAPI.getInvoiceOrders(token, invoice.id);
          const orders = invoiceData?.orders || [];

          if (orders.length > 0) {
            // Sync using existing database function
            const { data: syncResult, error: syncError } = await supabase.rpc(
              'sync_alwaseet_invoice_data',
              {
                p_invoice_data: invoice,
                p_orders_data: orders
              }
            );

            if (syncError) {
              console.error(`❌ خطأ في مزامنة الفاتورة ${invoice.id}:`, syncError);
            } else {
              syncedCount++;
              console.log(`✅ تمت مزامنة الفاتورة ${invoice.id} - ${orders.length} طلب`);
            }
          }

          // Small delay between API calls to be respectful
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`❌ خطأ في معالجة الفاتورة ${invoice.id}:`, error);
        }
      }

      if (syncedCount > 0) {
        console.log(`✅ تمت المزامنة التلقائية بنجاح - ${syncedCount} فاتورة`);
        toast({
          title: 'مزامنة تلقائية',
          description: `تم تحديث ${syncedCount} فاتورة وتعليم الطلبات المُسلمة كمستلمة الفاتورة`,
          variant: 'success'
        });
      }

      // Update last sync time
      localStorage.setItem(lastSyncKey, now.toString());

    } catch (error) {
      console.error('❌ خطأ في المزامنة التلقائية:', error);
    } finally {
      setAutoSyncLoading(false);
    }
  }, [token, isLoggedIn, activePartner]);

  // Auto-fetch invoices when token is available and trigger sync
  useEffect(() => {
    if (token && isLoggedIn && activePartner === 'alwaseet') {
      fetchInvoices().then(() => {
        // Auto-sync after fetching invoices
        autoSyncReceivedInvoices();
      });
    }
  }, [token, isLoggedIn, activePartner, fetchInvoices, autoSyncReceivedInvoices]);

  return {
    invoices,
    loading,
    autoSyncLoading,
    selectedInvoice,
    invoiceOrders,
    fetchInvoices,
    fetchInvoiceOrders,
    receiveInvoice,
    linkInvoiceWithLocalOrders,
    getInvoiceStats,
    applyCustomDateRangeFilter,
    autoSyncReceivedInvoices,
    setSelectedInvoice,
    setInvoiceOrders
  };
};
