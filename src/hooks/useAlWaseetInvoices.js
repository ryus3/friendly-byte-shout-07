
import { useState, useCallback, useEffect } from 'react';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import * as AlWaseetAPI from '@/lib/alwaseet-api';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { AutoSyncInvoiceService } from '@/components/orders/AutoSyncInvoiceService';

const LAST_SYNC_COOLDOWN_KEY = 'alwaseet_last_sync_timestamp';
const SYNC_COOLDOWN_MINUTES = 10;

export const useAlWaseetInvoices = () => {
  const { token, isLoggedIn, activePartner } = useAlWaseet();
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceOrders, setInvoiceOrders] = useState([]);

  console.log('🔧 useAlWaseetInvoices hook initialized');

  // Enhanced smart fetch with instant loading and background sync
  const fetchInvoices = useCallback(async (timeFilter = 'week', forceRefresh = false) => {
    if (!token || !isLoggedIn || activePartner !== 'alwaseet') {
      return;
    }

    // Only show loading if this is a force refresh or manual action
    if (forceRefresh) {
      setLoading(true);
    }

    try {
      // Smart fetch: only get recent invoices to avoid loading thousands
      console.log(`🔄 جلب الفواتير (${timeFilter}) - ${forceRefresh ? 'إجباري' : 'تلقائي'}`);
      const invoicesData = await AlWaseetAPI.getMerchantInvoices(token);
      
      // Persist invoices to DB (bulk upsert via RPC) - in background
      if (invoicesData?.length > 0) {
        try {
          const { data: upsertRes, error: upsertErr } = await supabase.rpc('upsert_alwaseet_invoice_list', {
            p_invoices: invoicesData
          });
          if (upsertErr) {
            console.warn('خطأ في حفظ الفواتير:', upsertErr.message);
          } else {
            console.log(`💾 حفظ ${invoicesData.length} فاتورة في قاعدة البيانات`);
          }
        } catch (e) {
          console.warn('تعذر حفظ الفواتير:', e?.message || e);
        }
      }
      
      // Enhanced smart filtering and sorting
      const filteredAndSortedInvoices = (invoicesData || [])
        .filter(invoice => {
          if (timeFilter === 'all') {
            // For "all", limit to last 6 months for performance
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            const invoiceDate = new Date(invoice.updated_at || invoice.created_at);
            return invoiceDate >= sixMonthsAgo;
          }
          
          const invoiceDate = new Date(invoice.updated_at || invoice.created_at);
          
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
              return true; // Handle custom range in the component
            default:
              return true;
          }
        })
        .sort((a, b) => {
          // Priority sort: pending invoices first
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
      console.log(`📊 عرض ${filteredAndSortedInvoices.length} فاتورة (${timeFilter})`);
      return filteredAndSortedInvoices;
    } catch (error) {
      console.error('خطأ في جلب الفواتير:', error);
      
      // Only show error toast for force refresh (manual actions)
      if (forceRefresh) {
        toast({
          title: 'خطأ في جلب الفواتير',
          description: error.message,
          variant: 'destructive'
        });
      } else {
        console.warn('تعذر التحديث التلقائي للفواتير:', error.message);
      }
      return [];
    } finally {
      if (forceRefresh) {
        setLoading(false);
      }
    }
  }, [token, isLoggedIn, activePartner]);

  // Enhanced smart sync for background updates
  const smartBackgroundSync = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('smart-invoice-sync', {
        body: { 
          mode: 'smart',
          employee_id: user?.id,
          sync_invoices: true,
          sync_orders: false // Only sync invoices in background
        }
      });
      
      if (error) {
        console.warn('مزامنة تلقائية فشلت:', error.message);
      } else if (data?.invoices_synced > 0) {
        console.log(`🔄 مزامنة تلقائية: ${data.invoices_synced} فاتورة جديدة`);
        // Refresh local state without loading indicator
        fetchInvoices('week', false);
      } else {
        console.log('✅ لا توجد فواتير جديدة للمزامنة');
      }
    } catch (error) {
      console.warn('خطأ في المزامنة التلقائية:', error);
    }
  }, [fetchInvoices, user?.id]);

  // Enhanced instant loading with smart caching
  useEffect(() => {
    if (!isLoggedIn || activePartner !== 'alwaseet') return;

    const loadInvoicesInstantly = async () => {
      // 1. Load cached invoices from database FIRST (instant)
      try {
        const { data: cachedInvoices, error } = await supabase
          .from('delivery_invoices')
          .select('*')
          .eq('partner', 'alwaseet')
          .eq('owner_user_id', user?.id)
          .order('issued_at', { ascending: false })
          .limit(50);

        if (!error && cachedInvoices?.length > 0) {
          // Transform to match API format for consistency
          const transformedInvoices = cachedInvoices.map(inv => ({
            id: inv.external_id,
            merchant_price: inv.amount,
            delivered_orders_count: inv.orders_count,
            status: inv.status,
            merchant_id: inv.merchant_id,
            updated_at: inv.issued_at,
            created_at: inv.created_at,
            raw: inv.raw
          }));
          
          setInvoices(transformedInvoices);
          console.log('⚡ تحميل فوري: عرض الفواتير المحفوظة -', transformedInvoices.length);
        }
      } catch (cacheError) {
        console.warn('تعذر تحميل الفواتير المحفوظة:', cacheError);
      }

      // 2. Then update from API in background (non-blocking)
      const lastSyncKey = `${LAST_SYNC_COOLDOWN_KEY}_${user?.id}`;
      const lastSync = localStorage.getItem(lastSyncKey);
      const timeSinceLastSync = lastSync ? Date.now() - parseInt(lastSync) : Infinity;
      const cooldownMs = SYNC_COOLDOWN_MINUTES * 60 * 1000;

      if (timeSinceLastSync > cooldownMs) {
        console.log('🔄 تحديث في الخلفية: جلب فواتير جديدة...');
        localStorage.setItem(lastSyncKey, Date.now().toString());
        
        // Smart background sync using edge function
        smartBackgroundSync().then(() => {
          console.log('✅ تم التحديث الذكي في الخلفية');
        }).catch(err => {
          console.warn('تعذر التحديث الذكي في الخلفية:', err);
        });
      } else {
        const remainingMinutes = Math.ceil((cooldownMs - timeSinceLastSync) / 60000);
        console.log(`⏰ تم التحديث مؤخراً، التالي خلال ${remainingMinutes} دقيقة`);
      }
    };

    loadInvoicesInstantly();

    // Listen for invoice updates via custom events only
    const handleInvoiceReceived = (event) => {
      console.log('تحديث فوري للفاتورة المستلمة:', event.detail);
      fetchInvoices('week', false); // Refresh without loading indicator
    };

    const handleInvoiceUpdated = (event) => {
      console.log('تحديث فوري للفاتورة:', event.detail);
      fetchInvoices('week', false); // Refresh without loading indicator
    };

    window.addEventListener('invoiceReceived', handleInvoiceReceived);
    window.addEventListener('invoiceUpdated', handleInvoiceUpdated);

    return () => {
      window.removeEventListener('invoiceReceived', handleInvoiceReceived);
      window.removeEventListener('invoiceUpdated', handleInvoiceUpdated);
    };
  }, [isLoggedIn, activePartner, fetchInvoices, user?.id]);

  // إصلاح fetchInvoiceOrders جذرياً لعرض البيانات من raw أو API
  const fetchInvoiceOrders = useCallback(async (invoiceId) => {
    if (!invoiceId) return null;

    setLoading(true);
    try {
      let invoiceData = null;
      let dataSource = 'database';

      // محاولة API أولاً إذا كان التوكن متاحاً - أولوية للبيانات الحية
      if (token && isLoggedIn) {
        try {
          invoiceData = await AlWaseetAPI.getInvoiceOrders(token, invoiceId);
          dataSource = 'api';
          console.log('✅ جلب طلبات الفاتورة من API مباشرة:', invoiceData?.orders?.length || 0);
          
          // تسجيل البيانات للمقارنة
          if (invoiceData?.orders?.length > 0) {
            console.log('📊 بيانات الطلبات من API:', {
              orders: invoiceData.orders.map(o => ({
                id: o.id,
                client_name: o.client_name,
                price: o.price
              }))
            });
          }
        } catch (apiError) {
          console.warn('⚠️ فشل الوصول للAPI، التبديل لقاعدة البيانات:', apiError.message);
        }
      } else {
        console.log('⚠️ لا يوجد token أو لست مسجل دخول، استخدام قاعدة البيانات مباشرة');
      }

      // البديل المحسن من قاعدة البيانات
      if (!invoiceData?.orders) {
        try {
          // البحث عن الفاتورة بـ external_id
          const { data: invoiceRecord, error: invoiceError } = await supabase
            .from('delivery_invoices')
            .select('id, external_id, raw')
            .eq('external_id', invoiceId)
            .limit(1)
            .single();

          if (invoiceError && invoiceError.code !== 'PGRST116') {
            throw invoiceError;
          }

          const finalInvoiceId = invoiceRecord?.id || invoiceId;

          // جلب الطلبات المرتبطة بالفاتورة
          const { data: dbOrders, error: dbError } = await supabase
            .from('delivery_invoice_orders')
            .select(`
              id,
              external_order_id,
              raw,
              invoice_id,
              order_id,
              orders (
                id,
                order_number,
                tracking_number,
                customer_name,
                customer_phone,
                final_amount,
                status,
                created_by
              )
            `)
            .eq('invoice_id', finalInvoiceId);

          if (dbError) {
            console.warn('خطأ في جلب الطلبات من قاعدة البيانات:', dbError);
          }

          // إنشاء الطلبات من raw data بشكل محسن
          const orders = [];
          
          if (dbOrders && dbOrders.length > 0) {
            // عرض الطلبات المرتبطة والطلبات من raw data
            orders.push(...dbOrders.map(dio => {
              const rawData = dio.raw || {};
              return {
                id: dio.external_order_id || rawData.id || `order-${dio.id}`,
                client_name: rawData.client_name || dio.orders?.customer_name || 'غير محدد',
                client_mobile: rawData.client_mobile || dio.orders?.customer_phone || '',
                city_name: rawData.city_name || 'غير محدد',
                price: rawData.price || dio.orders?.final_amount || 0,
                delivery_price: rawData.delivery_price || 0,
                local_order: dio.orders,
                source: dio.orders ? 'linked' : 'raw',
                tracking_number: dio.orders?.tracking_number,
                order_number: dio.orders?.order_number,
                order_status: dio.orders?.status,
                ...rawData
              };
            }));
            
            console.log('📋 طلبات الفاتورة من قاعدة البيانات:', {
              total: orders.length,
              linked: orders.filter(o => o.local_order).length,
              fromRaw: orders.filter(o => !o.local_order).length
            });
          } else if (invoiceRecord?.raw) {
            // كبديل، استخراج الطلبات من raw data للفاتورة
            const invoiceRawData = invoiceRecord.raw;
            
            // محاولة multiple sources للطلبات
            let rawOrders = [];
            if (invoiceRawData.orders && Array.isArray(invoiceRawData.orders)) {
              rawOrders = invoiceRawData.orders;
            } else if (invoiceRawData.data && Array.isArray(invoiceRawData.data)) {
              rawOrders = invoiceRawData.data;
            } else if (invoiceRawData.delivered_orders && Array.isArray(invoiceRawData.delivered_orders)) {
              rawOrders = invoiceRawData.delivered_orders;
            }
            
            orders.push(...rawOrders.map(order => ({
              id: order.id || `raw-order-${Math.random()}`,
              client_name: order.client_name || order.customer_name || 'غير محدد',
              client_mobile: order.client_mobile || order.phone || '',
              city_name: order.city_name || order.city || 'غير محدد',
              price: order.price || order.amount || 0,
              delivery_price: order.delivery_price || order.delivery_fee || 0,
              source: 'invoice_raw',
              ...order
            })));
            
            console.log('📄 طلبات من raw data للفاتورة:', orders.length);
          }

          invoiceData = { orders };
          dataSource = 'database';
          console.log('📊 جلب طلبات الفاتورة من قاعدة البيانات:', orders.length);
        } catch (dbError) {
          console.error('❌ فشل البديل من قاعدة البيانات:', dbError);
          // عرض فاتورة فارغة بدلاً من خطأ
          invoiceData = { orders: [] };
        }
      }

      const finalOrders = invoiceData?.orders || [];
      setInvoiceOrders(finalOrders);
      setSelectedInvoice({ 
        ...(invoiceData?.invoice?.[0] || null),
        dataSource,
        ordersCount: finalOrders.length
      });
      
      return { ...invoiceData, dataSource };
    } catch (error) {
      console.error('خطأ في جلب طلبات الفاتورة:', error);
      // عرض فاتورة فارغة بدلاً من toast خطأ
      setInvoiceOrders([]);
      setSelectedInvoice(null);
      return { orders: [], dataSource: 'error' };
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

  // Enhanced quick sync using smart edge function
  const syncLastTwoInvoices = useCallback(async () => {
    if (!token || !isLoggedIn) return { success: false };
    
    try {
      console.log('🔄 مزامنة سريعة - آخر فاتورتين...');
      
      // Use smart sync for quick updates
      const { data, error } = await supabase.functions.invoke('smart-invoice-sync', {
        body: { 
          mode: 'smart',
          employee_id: user?.id,
          sync_invoices: true,
          sync_orders: false,
          force_refresh: false
        }
      });
      
      if (error) {
        console.warn('تعذر المزامنة السريعة:', error.message);
        return { success: false, error: error.message };
      }
      
      const synced = data?.invoices_synced || 0;
      console.log('✅ مزامنة سريعة مكتملة:', synced, 'فاتورة');
      
      // Refresh state if we got new invoices
      if (synced > 0) {
        await fetchInvoices('week', false);
      }
      
      return { success: true, processed: synced };
    } catch (error) {
      console.warn('خطأ في المزامنة السريعة:', error);
      return { success: false, error: error.message };
    }
  }, [token, isLoggedIn, user?.id, fetchInvoices]);

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
    syncLastTwoInvoices,
    smartBackgroundSync,
    syncInvoiceById,
    syncAlwaseetInvoiceData,
    syncAllRecentInvoices
  };
};
