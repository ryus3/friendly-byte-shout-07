
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

      // Try primary matching by delivery_partner_order_id
      const { data: localOrders, error: localErr } = await supabase
        .from('orders')
        .select('id, order_number, delivery_partner_order_id, delivery_partner, receipt_received, tracking_number, qr_id')
        .in('delivery_partner_order_id', waseetOrderIds)
        .neq('receipt_received', true);

      if (localErr) {
        console.warn('Error fetching local orders for auto-process:', localErr);
        return;
      }

      let matchedOrders = localOrders || [];

      // Fallback matching using tracking_number/qr_id if no direct matches
      if (matchedOrders.length === 0) {
        const { data: fallbackOrders, error: fallbackErr } = await supabase
          .from('orders')
          .select('id, order_number, delivery_partner_order_id, delivery_partner, receipt_received, tracking_number, qr_id')
          .in('tracking_number', waseetOrderIds)
          .neq('receipt_received', true);

        if (!fallbackErr && fallbackOrders?.length > 0) {
          matchedOrders = fallbackOrders;
          
          // Update delivery_partner_order_id for fallback matches
          for (const order of matchedOrders) {
            const waseetOrder = waseetOrders.find(w => String(w.id) === order.tracking_number);
            if (waseetOrder) {
              await supabase
                .from('orders')
                .update({ delivery_partner_order_id: String(waseetOrder.id) })
                .eq('id', order.id);
            }
          }
        }
      }

      const updateIds = matchedOrders.map(o => o.id);

      if (updateIds.length === 0) {
        // لا نعلم الفاتورة كمُعالجة إذا لم نجد طلبات محلية للتحديث
        return;
      }

      if (updateIds.length > 0) {
        // Use Edge Function for automatic processing
        const { data: updateResult, error: updateErr } = await supabase.functions.invoke('mark-invoice-received', {
          body: {
            orderIds: updateIds,
            invoiceId: target.id
          }
        });

        if (updateErr) {
          console.warn('Auto-process update failed:', updateErr?.message || updateErr);
          toast({
            title: 'تعذر تعليم استلام الفاتورة تلقائياً',
            description: 'تحقق من الصلاحيات أو أعد المحاولة من تبويب الفواتير.',
            variant: 'destructive'
          });
          return;
        }

        if (updateResult?.success) {
          const actualUpdates = updateResult.results.filter(r => r.updated).length;
          
          if (actualUpdates > 0) {
            localStorage.setItem(LAST_PROCESSED_ID_KEY, String(target.id));
            localStorage.setItem(LAST_PROCESSED_AT_KEY, new Date().toISOString());

            toast({
              title: 'تم تطبيق استلام الفاتورة تلقائياً',
              description: `تم تعليم ${actualUpdates} طلب من فاتورة #${target.id} كمستلم للفاتورة`,
              variant: 'success'
            });
          }
          
          if (updateResult.summary.failed > 0) {
            console.warn(`فشل في تحديث ${updateResult.summary.failed} طلب تلقائياً`);
          }
        }
      }
    } catch (e) {
      console.warn('Auto-process latest invoice failed:', e?.message || e);
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
      
      // Background automation: process latest received invoice if new
      autoProcessLatestReceivedInvoice(invoicesData);
      
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
      // 1) Confirm invoice on شركة التوصيل
      await AlWaseetAPI.receiveInvoice(token, invoiceId);

      // 2) Fetch invoice details (orders + invoice meta)
      const invoiceData = await fetchInvoiceOrders(invoiceId);
      const waseetOrders = invoiceData?.orders || [];

      // 3) Collect matching local order IDs
      const orderIds = [];
      
      for (const waseetOrder of waseetOrders) {
        // Try primary matching by delivery_partner_order_id first
        let { data: localOrders } = await supabase
          .from('orders')
          .select('id, order_number, delivery_partner_order_id')
          .eq('delivery_partner_order_id', waseetOrder.id.toString())
          .eq('receipt_received', false);
        
        // Fallback matching using tracking_number if no direct matches
        if (!localOrders || localOrders.length === 0) {
          if (waseetOrder.tracking_number) {
            const { data: trackingOrders } = await supabase
              .from('orders')
              .select('id, order_number, delivery_partner_order_id')
              .or(`tracking_number.eq.${waseetOrder.tracking_number},qr_id.eq.${waseetOrder.tracking_number}`)
              .eq('receipt_received', false);
            
            if (trackingOrders && trackingOrders.length > 0) {
              localOrders = trackingOrders;
              
              // Update delivery_partner_order_id for fallback matches
              for (const order of trackingOrders) {
                if (!order.delivery_partner_order_id) {
                  await supabase
                    .from('orders')
                    .update({ delivery_partner_order_id: waseetOrder.id.toString() })
                    .eq('id', order.id);
                }
              }
            }
          }
        }
        
        if (localOrders && localOrders.length > 0) {
          orderIds.push(...localOrders.map(order => order.id));
        }
      }

      if (orderIds.length > 0) {
        // Use Edge Function to update orders
        const { data: updateResult, error } = await supabase.functions.invoke('mark-invoice-received', {
          body: {
            orderIds,
            invoiceId
          }
        });
        
        if (error) {
          console.error('خطأ في Edge Function:', error);
          toast({
            title: "خطأ",
            description: "حدث خطأ أثناء تحديث الطلبات",
            variant: "destructive"
          });
        } else if (updateResult?.success) {
          const { summary } = updateResult;
          const actualUpdates = updateResult.results.filter(r => r.updated).length;
          
          if (actualUpdates > 0) {
            toast({
              title: "تم استقبال الفاتورة",
              description: `تم تحديث ${actualUpdates} طلب${actualUpdates > 1 ? 'اً' : ''} كمستلم الفاتورة`,
              variant: "success"
            });
          } else {
            toast({
              title: "تم استقبال الفاتورة",
              description: "جميع الطلبات كانت مستلمة الفاتورة مسبقاً",
              variant: "info"
            });
          }
          
          if (summary.failed > 0) {
            console.warn(`فشل في تحديث ${summary.failed} طلب`);
          }
        }
      } else {
        toast({
          title: "تم استقبال الفاتورة",
          description: "لم يتم العثور على طلبات محلية مطابقة",
          variant: "warning"
        });
      }

      // 7) Update invoice status locally for UI
      setInvoices(prev => prev.map(inv =>
        inv.id === invoiceId ? { ...inv, status: 'تم الاستلام من قبل التاجر' } : inv
      ));

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
