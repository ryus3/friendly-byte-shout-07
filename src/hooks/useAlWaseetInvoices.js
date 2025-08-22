import { useState, useCallback, useEffect } from 'react';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import * as AlWaseetAPI from '@/lib/alwaseet-api';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

export const useAlWaseetInvoices = () => {
  const { token, isLoggedIn, activePartner } = useAlWaseet();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceOrders, setInvoiceOrders] = useState([]);

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
      await AlWaseetAPI.receiveInvoice(token, invoiceId);
      
      // Update invoice status locally
      setInvoices(prev => prev.map(invoice => 
        invoice.id === invoiceId 
          ? { ...invoice, status: 'تم الاستلام من قبل التاجر' }
          : invoice
      ));

      toast({
        title: 'تم تأكيد الاستلام',
        description: `تم تأكيد استلام الفاتورة رقم ${invoiceId}`,
        variant: 'success'
      });

      // Refresh invoices to get updated data
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
  }, [token, fetchInvoices]);

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