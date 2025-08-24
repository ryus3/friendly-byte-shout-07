
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

  // Local automation settings and helpers
  const AUTO_MARK_ENABLED_KEY = 'waseet:autoMarkEnabled';
  const PROCESS_LATEST_ONLY_KEY = 'waseet:processLatestOnly';
  const LAST_PROCESSED_ID_KEY = 'waseet:lastProcessedInvoiceId';
  const LAST_PROCESSED_AT_KEY = 'waseet:lastProcessedAt';
  const PROCESSED_IDS_KEY = 'waseet:processedInvoiceIds';

  const isAutoMarkEnabled = () => {
    try {
      const v = localStorage.getItem(AUTO_MARK_ENABLED_KEY);
      return v === null ? true : v !== 'false';
    } catch {
      return true;
    }
  };
  const isProcessLatestOnly = () => {
    try {
      const v = localStorage.getItem(PROCESS_LATEST_ONLY_KEY);
      return v === null ? true : v !== 'false';
    } catch {
      return true;
    }
  };

  const getProcessedInvoiceIds = () => {
    try {
      const raw = localStorage.getItem(PROCESSED_IDS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.map(String) : [];
    } catch {
      return [];
    }
  };

  const addProcessedInvoiceId = (invoiceId) => {
    try {
      const current = new Set(getProcessedInvoiceIds());
      current.add(String(invoiceId));
      localStorage.setItem(PROCESSED_IDS_KEY, JSON.stringify(Array.from(current)));
      localStorage.setItem(LAST_PROCESSED_ID_KEY, String(invoiceId));
      localStorage.setItem(LAST_PROCESSED_AT_KEY, new Date().toISOString());
    } catch {}
  };

  const wasProcessedBefore = (invoiceId) => getProcessedInvoiceIds().includes(String(invoiceId));
  
  const autoProcessLatestReceivedInvoice = useCallback(async (allInvoices) => {
    try {
      if (!token || !isLoggedIn || activePartner !== 'alwaseet' || !Array.isArray(allInvoices)) return;
      if (!isAutoMarkEnabled()) return;

      const received = [...allInvoices].filter(inv => inv.status === 'تم الاستلام من قبل التاجر');
      if (received.length === 0) return;

      // Sort by date desc and pick target(s)
      received.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
      const targets = isProcessLatestOnly() ? [received[0]] : received;

      const lastProcessedId = localStorage.getItem(LAST_PROCESSED_ID_KEY);
      const target = targets.find(inv => String(inv.id) !== String(lastProcessedId));
      if (!target) return;

      // Fetch invoice details directly (avoid mutating hook state)
      const invoiceData = await AlWaseetAPI.getInvoiceOrders(token, target.id);
      const waseetOrders = invoiceData?.orders || [];
      const invoiceMeta = invoiceData?.invoice?.[0] || null;
      const invoiceDate = invoiceMeta?.updated_at || invoiceMeta?.created_at || new Date().toISOString();

      const waseetOrderIds = waseetOrders.map(o => String(o.id));
      if (waseetOrderIds.length === 0) return;

      const { data: localOrders } = await supabase
        .from('orders')
        .select('id, order_number, delivery_partner_order_id, delivery_partner, receipt_received, status')
        .in('delivery_partner_order_id', waseetOrderIds)
        .neq('receipt_received', true);

      const updateIds = (localOrders || []).map(o => o.id);

      if (updateIds.length === 0) {
        localStorage.setItem(LAST_PROCESSED_ID_KEY, String(target.id));
        localStorage.setItem(LAST_PROCESSED_AT_KEY, new Date().toISOString());
        return;
      }

      await supabase
        .from('orders')
        .update({
          receipt_received: true,
          delivery_partner: 'alwaseet',
          delivery_partner_invoice_id: String(target.id),
          delivery_partner_invoice_date: invoiceDate,
          invoice_received_at: new Date().toISOString(),
          invoice_received_by: user?.id || user?.user_id || null
        })
        .in('id', updateIds);

      localStorage.setItem(LAST_PROCESSED_ID_KEY, String(target.id));
      localStorage.setItem(LAST_PROCESSED_AT_KEY, new Date().toISOString());

      toast({
        title: 'تم تطبيق استلام الفاتورة تلقائياً',
        description: `تم تعليم ${updateIds.length} طلب من فاتورة #${target.id} كمستلم للفاتورة`,
        variant: 'success'
      });
     } catch (e) {
      console.warn('Auto-process latest invoice failed:', e?.message || e);
    }
  }, [token, isLoggedIn, activePartner, user?.id, user?.user_id]);

  // Smart auto-processing of only recent/unprocessed invoices (max 2)
  const autoProcessSmartRecentInvoices = useCallback(async (allInvoices) => {
    try {
      if (!token || !isLoggedIn || activePartner !== 'alwaseet' || !Array.isArray(allInvoices)) return;
      if (!isAutoMarkEnabled()) return;

      // Newest first
      const sorted = [...allInvoices].sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));

      // Skip invoices already marked as processed
      const recentNotProcessed = sorted.filter(inv => !wasProcessedBefore(inv.id));

      // Prefer received invoices first, else fallback to last two recent
      const receivedCandidates = recentNotProcessed.filter(inv => inv.status === 'تم الاستلام من قبل التاجر').slice(0, 2);
      const fallbackCandidates = receivedCandidates.length > 0 ? [] : recentNotProcessed.slice(0, 2);
      const candidates = [...receivedCandidates, ...fallbackCandidates].slice(0, 2);
      if (candidates.length === 0) return;

      // Helper: process a single invoice and return number of updated orders
      const processInvoice = async (invoiceId) => {
        try {
          const invoiceData = await AlWaseetAPI.getInvoiceOrders(token, invoiceId);
          const waseetOrders = invoiceData?.orders || [];
          const invoiceMeta = invoiceData?.invoice?.[0] || null;
          const invoiceDate = invoiceMeta?.updated_at || invoiceMeta?.created_at || new Date().toISOString();

          const waseetOrderIds = waseetOrders.map(o => String(o.id));
          let updatedCount = 0;

          // 1) Primary match by delivery_partner_order_id
          if (waseetOrderIds.length > 0) {
            const { data: localById } = await supabase
              .from('orders')
              .select('id, order_number, status, receipt_received, delivery_partner_order_id, delivery_partner')
              .in('delivery_partner_order_id', waseetOrderIds)
              .neq('receipt_received', true);

            const directUpdateIds = (localById || []).map(o => o.id);

            if (directUpdateIds.length > 0) {
              const { error: updateErr } = await supabase
                .from('orders')
                .update({
                  receipt_received: true,
                  delivery_partner: 'alwaseet',
                  delivery_partner_invoice_id: String(invoiceId),
                  delivery_partner_invoice_date: invoiceDate,
                  invoice_received_at: new Date().toISOString(),
                  invoice_received_by: user?.id || user?.user_id || null
                })
                .in('id', directUpdateIds);
              if (!updateErr) updatedCount += directUpdateIds.length;
            }
          }

          // 2) Fallback matching by tracking_number/qr_id
          const qrMap = new Map(); // qr -> remoteId
          for (const wo of waseetOrders) {
            const qr = String(wo.qr_id || wo.tracking_number || '').trim();
            if (qr) qrMap.set(qr, String(wo.id));
          }

          if (qrMap.size > 0) {
            const qrValues = Array.from(qrMap.keys());
            const { data: localByTracking } = await supabase
              .from('orders')
              .select('id, order_number, status, receipt_received, delivery_partner_order_id, delivery_partner, tracking_number')
              .in('tracking_number', qrValues)
              .neq('receipt_received', true);

            // Update each individually to also fix delivery_partner_order_id
            for (const lo of (localByTracking || [])) {
              const remoteId = qrMap.get(String(lo.tracking_number || '').trim());
              if (!remoteId) continue;

              const { error: upErr } = await supabase
                .from('orders')
                .update({
                  receipt_received: true,
                  delivery_partner: 'alwaseet',
                  delivery_partner_order_id: String(remoteId),
                  delivery_partner_invoice_id: String(invoiceId),
                  delivery_partner_invoice_date: invoiceDate,
                  invoice_received_at: new Date().toISOString(),
                  invoice_received_by: user?.id || user?.user_id || null
                })
                .eq('id', lo.id);
              if (!upErr) updatedCount += 1;
            }
          }

          return updatedCount;
        } catch (err) {
          console.warn('Process invoice failed:', err?.message || err);
          return 0;
        }
      };

      // Process up to 2 invoices
      for (const inv of candidates) {
        const updated = await processInvoice(inv.id);
        // Mark as processed only if we actually updated at least one order
        if (updated > 0) {
          addProcessedInvoiceId(inv.id);
          toast({
            title: 'تمت معالجة الفاتورة تلقائياً',
            description: `فاتورة #${inv.id}: تم تعليم ${updated} طلب كمستلم للفاتورة`,
            variant: 'success'
          });
        }
      }
    } catch (e) {
      console.warn('Smart auto-process invoices failed:', e?.message || e);
    }
  }, [token, isLoggedIn, activePartner, user?.id, user?.user_id]);

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
      
      // Background automation: process latest received or recent invoices smartly
      autoProcessSmartRecentInvoices(invoicesData);
      
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
              delivery_partner: 'alwaseet',
              delivery_partner_invoice_id: String(invoiceId),
              delivery_partner_invoice_date: invoiceDate,
              invoice_received_at: new Date().toISOString(),
              invoice_received_by: user?.id || user?.user_id || null
            })
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

  // Auto-fetch invoices when token is available
  useEffect(() => {
    if (token && isLoggedIn && activePartner === 'alwaseet') {
      fetchInvoices();
    }
  }, [token, isLoggedIn, activePartner, fetchInvoices]);

  return {
    invoices,
    loading,
    selectedInvoice,
    invoiceOrders,
    fetchInvoices,
    fetchInvoiceOrders,
    receiveInvoice,
    linkInvoiceWithLocalOrders,
    getInvoiceStats,
    applyCustomDateRangeFilter,
    setSelectedInvoice,
    setInvoiceOrders
  };
};
