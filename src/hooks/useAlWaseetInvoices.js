
import { useState, useCallback, useEffect } from 'react';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import * as AlWaseetAPI from '@/lib/alwaseet-api';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/UnifiedAuthContext';

const LAST_SYNC_COOLDOWN_KEY = 'alwaseet_last_sync_timestamp';
const SYNC_COOLDOWN_MINUTES = 10;

export const useAlWaseetInvoices = () => {
  const { token, isLoggedIn, activePartner } = useAlWaseet();
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceOrders, setInvoiceOrders] = useState([]);

  // نظام المزامنة التلقائية الشامل - جلب جميع الفواتير مع طلباتها وربطها
  const fetchAllInvoicesWithOrders = useCallback(async () => {
    if (!token || !isLoggedIn || activePartner !== 'alwaseet') {
      console.log('❌ لا يمكن جلب الفواتير - لا يوجد token أو غير مسجل دخول');
      return;
    }

    setLoading(true);
    try {
      console.log('📥 بدء المزامنة التلقائية الشاملة للفواتير...');
      
      // الخطوة 1: جلب جميع الفواتير من API الوسيط
      const invoicesData = await AlWaseetAPI.getMerchantInvoices(token);
      
      if (!invoicesData || invoicesData.length === 0) {
        console.log('⚠️ لا توجد فواتير أو استجابة فارغة');
        setInvoices([]);
        return;
      }

      console.log(`✅ تم جلب ${invoicesData.length} فاتورة من الوسيط`);
      
      // الخطوة 2: حفظ قائمة الفواتير أولاً
      try {
        const { data: upsertRes, error: upsertErr } = await supabase.rpc('upsert_alwaseet_invoice_list', {
          p_invoices: invoicesData
        });
        if (upsertErr) {
          console.warn('خطأ في حفظ الفواتير:', upsertErr.message);
        } else {
          console.log(`💾 تم حفظ ${upsertRes?.processed || invoicesData.length} فاتورة في قاعدة البيانات`);
        }
      } catch (e) {
        console.warn('فشل في حفظ الفواتير:', e?.message || e);
      }

      // الخطوة 3: جلب طلبات كل فاتورة وربطها تلقائياً
      let processedCount = 0;
      let linkedOrdersTotal = 0;
      
      for (const invoice of invoicesData) {
        try {
          console.log(`🔄 معالجة الفاتورة ${invoice.id}...`);
          
          // جلب طلبات هذه الفاتورة من API الوسيط
          const invoiceOrdersResponse = await AlWaseetAPI.getInvoiceOrders(token, invoice.id);
          
          if (invoiceOrdersResponse && invoiceOrdersResponse.orders && invoiceOrdersResponse.orders.length > 0) {
            // مزامنة الفاتورة مع طلباتها باستخدام الدالة المُصلحة
            const { data: syncResult, error: syncError } = await supabase.rpc('sync_alwaseet_invoice_data', {
              p_invoice_data: invoice,
              p_orders_data: invoiceOrdersResponse.orders
            });
            
            if (syncError) {
              console.error(`❌ فشل في ربط الفاتورة ${invoice.id}:`, syncError.message);
            } else if (syncResult && syncResult.success) {
              console.log(`✅ تم ربط الفاتورة ${invoice.id} مع ${syncResult.linked_orders} طلب من ${syncResult.total_orders}`);
              processedCount++;
              linkedOrdersTotal += syncResult.linked_orders || 0;
            }
          } else {
            console.log(`ℹ️ الفاتورة ${invoice.id} لا تحتوي على طلبات`);
          }
          
          // تأخير قصير لتجنب rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (error) {
          console.error(`❌ خطأ في معالجة الفاتورة ${invoice.id}:`, error.message);
        }
      }

      console.log(`🎯 المزامنة التلقائية مكتملة: تم معالجة ${processedCount} فاتورة من ${invoicesData.length} وربط ${linkedOrdersTotal} طلب`);
      
      // الخطوة 4: ترتيب وعرض الفواتير (الأحدث أولاً، المعلقة أولاً)
      const sortedInvoices = [...invoicesData].sort((a, b) => {
        // ترتيب أولاً حسب الحالة - الفواتير المعلقة أولاً
        const aIsPending = a.status !== 'تم الاستلام من قبل التاجر';
        const bIsPending = b.status !== 'تم الاستلام من قبل التاجر';
        
        if (aIsPending && !bIsPending) return -1;
        if (!aIsPending && bIsPending) return 1;
        
        // ثم ترتيب حسب التاريخ - الأحدث أولاً
        const aDate = new Date(a.updated_at || a.created_at);
        const bDate = new Date(b.updated_at || b.created_at);
        return bDate - aDate;
      });
      
      setInvoices(sortedInvoices);
      
      // إشعار المستخدم بالنتائج
      if (processedCount > 0) {
        toast({
          title: 'تمت المزامنة التلقائية',
          description: `تم ربط ${linkedOrdersTotal} طلب من ${processedCount} فاتورة`,
          variant: 'success'
        });
      }
      
      return sortedInvoices;
      
    } catch (error) {
      console.error('❌ خطأ في المزامنة التلقائية:', error);
      toast({
        title: 'خطأ في المزامنة التلقائية',
        description: error.message,
        variant: 'destructive'
      });
      setInvoices([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [token, isLoggedIn, activePartner]);

  // دالة مبسطة للتوافق مع الواجهة الحالية
  const fetchInvoices = useCallback(async (timeFilter = 'week') => {
    const allInvoices = await fetchAllInvoicesWithOrders();
    
    if (!allInvoices || allInvoices.length === 0) return [];
    
    // تطبيق التصفية الزمنية
    if (timeFilter === 'all') return allInvoices;
    
    const filteredInvoices = allInvoices.filter(invoice => {
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
    });
    
    setInvoices(filteredInvoices);
    return filteredInvoices;
  }, [fetchAllInvoicesWithOrders]);

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

  // Advanced sync function using the new database structure
  const syncAlwaseetInvoiceData = useCallback(async (invoiceData, ordersData) => {
    try {
      const { data, error } = await supabase.rpc('sync_alwaseet_invoice_data', {
        p_invoice_data: invoiceData,
        p_orders_data: ordersData
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error syncing invoice data:', error);
      throw error;
    }
  }, []);

  // Sync a specific invoice by ID
  const syncInvoiceById = useCallback(async (externalId) => {
    if (!isLoggedIn || !token) {
      console.warn('Cannot sync invoice: authentication or access required');
      return { success: false, error: 'Authentication required' };
    }

    try {
      console.log(`Starting sync for invoice ${externalId}...`);
      
      // Fetch the specific invoice from Al-Waseet
      const allInvoices = await AlWaseetAPI.getMerchantInvoices(token);
      const targetInvoice = allInvoices.find(inv => inv.id === externalId);
      
      if (!targetInvoice) {
        console.warn(`Invoice ${externalId} not found in Al-Waseet`);
        return { success: false, error: 'Invoice not found' };
      }

      // Fetch orders for this invoice
      const invoiceOrdersResponse = await AlWaseetAPI.getInvoiceOrders(token, externalId);
      const invoiceOrders = invoiceOrdersResponse?.orders || [];
      
      // Sync to database
      const result = await syncAlwaseetInvoiceData(targetInvoice, invoiceOrders);
      console.log(`Synced invoice ${externalId}:`, result);
      
      return { success: true, data: result };
      
    } catch (error) {
      console.error(`Error syncing invoice ${externalId}:`, error);
      return { success: false, error: error.message };
    }
  }, [isLoggedIn, token, syncAlwaseetInvoiceData]);

  // Check cooldown and sync received invoices automatically
  const syncReceivedInvoicesAutomatically = useCallback(async () => {
    try {
      // Check cooldown
      const lastSyncStr = localStorage.getItem(LAST_SYNC_COOLDOWN_KEY);
      if (lastSyncStr) {
        const lastSync = new Date(lastSyncStr);
        const now = new Date();
        const diffMinutes = (now - lastSync) / (1000 * 60);
        
        if (diffMinutes < SYNC_COOLDOWN_MINUTES) {
          console.log(`Sync cooldown active. ${SYNC_COOLDOWN_MINUTES - Math.floor(diffMinutes)} minutes remaining`);
          return;
        }
      }

      // Fetch latest invoices (limit to 5 most recent)
      const allInvoices = await AlWaseetAPI.getMerchantInvoices(token);
      if (!allInvoices?.length) return;

      const recentInvoices = allInvoices
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
        .slice(0, 5);

      let syncedCount = 0;
      let updatedOrders = 0;

      for (const invoice of recentInvoices) {
        try {
          // Only process invoices that are marked as received
          const isReceived = invoice.status?.includes('تم الاستلام من قبل التاجر');
          if (!isReceived) continue;

          // Fetch orders for this invoice
          const invoiceOrders = await AlWaseetAPI.getInvoiceOrders(token, invoice.id);
          if (!invoiceOrders?.orders?.length) continue;

          // Sync using the new database function
          const syncResult = await syncAlwaseetInvoiceData(invoice, invoiceOrders.orders);
          if (syncResult?.success) {
            syncedCount++;
            updatedOrders += syncResult.linked_orders || 0;
          }
        } catch (error) {
          console.error(`Error syncing invoice ${invoice.id}:`, error);
        }
      }

      // Update cooldown timestamp
      localStorage.setItem(LAST_SYNC_COOLDOWN_KEY, new Date().toISOString());

      // Show notification if any updates were made
      if (syncedCount > 0) {
        toast({
          title: "تمت مزامنة الفواتير المستلمة",
          description: `تم تحديث ${updatedOrders} طلب من ${syncedCount} فاتورة مستلمة`,
          variant: "success"
        });

        // Refresh the invoices list
        fetchInvoices();
      }

    } catch (error) {
      console.error('Error in automatic sync:', error);
    }
  }, [token, syncAlwaseetInvoiceData, fetchInvoices]);

  // Add bulk sync functionality for manual trigger
  const syncAllRecentInvoices = useCallback(async () => {
    if (!isLoggedIn || activePartner !== 'alwaseet' || !token) return { success: false, error: 'Not logged in' };
    
    try {
      console.log('Starting bulk sync of all recent invoices...');
      const invoicesData = await AlWaseetAPI.getMerchantInvoices(token);
      
      // Save all invoices to database
      const { data: upsertRes, error: upsertErr } = await supabase.rpc('upsert_alwaseet_invoice_list', {
        p_invoices: invoicesData || []
      });
      
      if (upsertErr) throw new Error(upsertErr.message);
      
      // Sync recent invoices (last 3 months) with their orders
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
      const recentInvoices = (invoicesData || [])
        .filter(inv => new Date(inv.updated_at) > threeMonthsAgo)
        .slice(0, 50); // Limit to 50 recent invoices
      
      let syncedCount = 0;
      for (const invoice of recentInvoices) {
        try {
          const result = await syncInvoiceById(invoice.id);
          if (result.success) {
            syncedCount++;
          }
        } catch (error) {
          console.warn(`Failed to sync invoice ${invoice.id}:`, error);
        }
      }
      
      return { 
        success: true, 
        data: { 
          totalInvoices: invoicesData?.length || 0,
          syncedInvoices: syncedCount,
          dbSaved: upsertRes?.processed || 0
        }
      };
    } catch (error) {
      console.error('Bulk sync failed:', error);
      return { success: false, error: error.message };
    }
  }, [isLoggedIn, activePartner, token, syncInvoiceById]);

  // Sync ONLY last two invoices (fetch their orders and upsert) - automatic and lightweight
  const syncLastTwoInvoices = useCallback(async () => {
    if (!isLoggedIn || activePartner !== 'alwaseet' || !token) return { success: false };
    try {
      const allInvoices = await AlWaseetAPI.getMerchantInvoices(token);
      if (!allInvoices?.length) return { success: true, processed: 0 };

      // Sort by most recently updated and take last two invoices
      const lastTwo = [...allInvoices]
        .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
        .slice(0, 2);

      let processed = 0;
      for (const inv of lastTwo) {
        try {
          const resp = await AlWaseetAPI.getInvoiceOrders(token, inv.id);
          const orders = resp?.orders || [];
          const result = await syncAlwaseetInvoiceData(inv, orders);
          if (result?.success) processed += 1;
        } catch (e) {
          console.warn('Failed syncing invoice', inv?.id, e?.message || e);
        }
      }

      // refresh list after syncing
      await fetchInvoices();
      return { success: true, processed };
    } catch (e) {
      console.warn('syncLastTwoInvoices failed:', e?.message || e);
      return { success: false, error: e?.message };
    }
  }, [isLoggedIn, activePartner, token, fetchInvoices, syncAlwaseetInvoiceData]);

  // Auto-fetch invoices then sync only last two when token is available
  useEffect(() => {
    if (token && isLoggedIn && activePartner === 'alwaseet') {
      fetchInvoices();
      syncLastTwoInvoices();
    }
  }, [token, isLoggedIn, activePartner, fetchInvoices, syncLastTwoInvoices]);

  // Clear invoices state when logged out or switched away from AlWaseet
  useEffect(() => {
    if (!token || !isLoggedIn || activePartner !== 'alwaseet') {
      setInvoices([]);
      setSelectedInvoice(null);
      setInvoiceOrders([]);
    }
  }, [token, isLoggedIn, activePartner]);

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
    setInvoiceOrders,
    syncReceivedInvoicesAutomatically,
    syncAlwaseetInvoiceData,
    syncInvoiceById,
    syncAllRecentInvoices,
    syncLastTwoInvoices
  };
};
