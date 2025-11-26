
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

  console.log('🔧 useAlWaseetInvoices hook initialized');

  // Enhanced smart fetch with instant loading and background sync
  const fetchInvoices = useCallback(async (timeFilter = 'week', forceRefresh = false) => {
    if (!token || !isLoggedIn || (activePartner !== 'alwaseet' && activePartner !== 'modon')) {
      return;
    }

    // Only show loading if this is a force refresh or manual action
    if (forceRefresh) {
      setLoading(true);
    }

    try {
      // Smart fetch: only get recent invoices to avoid loading thousands
      console.log(`🔄 جلب الفواتير (${timeFilter}) - ${forceRefresh ? 'إجباري' : 'تلقائي'} من ${activePartner}`);
      
      // ✅ جلب جميع التوكنات النشطة للمستخدم
      const { data: userTokens, error: tokensError } = await supabase
        .from('delivery_partner_tokens')
        .select('*')
        .eq('user_id', user?.id)
        .eq('partner_name', activePartner)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString());
      
      if (tokensError) {
        console.error('❌ خطأ في جلب التوكنات:', tokensError);
        throw new Error('فشل جلب التوكنات');
      }
      
      console.log(`🔑 تم جلب ${userTokens?.length || 0} توكن نشط للمستخدم`);
      
      let allInvoicesData = [];
      
      // جلب الفواتير من كل توكن على حدة
      if (userTokens && userTokens.length > 0) {
        for (const tokenData of userTokens) {
          console.log(`🔄 جلب فواتير من حساب: ${tokenData.account_username}`);
          
          let invoicesFromThisToken;
          if (activePartner === 'modon') {
            const ModonAPI = await import('@/lib/modon-api');
            invoicesFromThisToken = await ModonAPI.getMerchantInvoices(tokenData.token);
          } else {
            invoicesFromThisToken = await AlWaseetAPI.getMerchantInvoices(tokenData.token);
          }
          
          // إضافة معلومات الحساب الصحيحة لكل فاتورة
          if (invoicesFromThisToken && invoicesFromThisToken.length > 0) {
            invoicesFromThisToken.forEach(inv => {
              inv.account_username = tokenData.account_username;
              inv.merchant_id = tokenData.merchant_id;
              inv.partner_name_ar = activePartner === 'modon' ? 'مدن' : 'الوسيط';
              inv.owner_user_id = user?.id;
              inv.partner = activePartner;
            });
            
            allInvoicesData.push(...invoicesFromThisToken);
            console.log(`✅ تم جلب ${invoicesFromThisToken.length} فاتورة من حساب ${tokenData.account_username}`);
          }
        }
      }
      
      const invoicesData = allInvoicesData;
      console.log(`📊 إجمالي الفواتير من جميع الحسابات: ${invoicesData.length}`);
      
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
    if (!isLoggedIn || (activePartner !== 'alwaseet' && activePartner !== 'modon')) return;

    const loadInvoicesInstantly = async () => {
      // ✅ جلب جميع التوكنات النشطة للمستخدم أولاً
      try {
        // جلب جميع التوكنات النشطة
        const { data: allTokens, error: tokensError } = await supabase
          .from('delivery_partner_tokens')
          .select('merchant_id, account_username, partner_name, user_id')
          .eq('user_id', user?.id)
          .eq('partner_name', activePartner)
          .eq('is_active', true)
          .gt('expires_at', new Date().toISOString());

        if (tokensError) {
          console.warn('⚠️ خطأ في جلب التوكنات:', tokensError);
        }

        // إنشاء خريطة للتوكنات (بـ merchant_id و user_id)
        const tokensMap = {};
        if (allTokens && allTokens.length > 0) {
          allTokens.forEach(token => {
            if (token.merchant_id) {
              tokensMap[token.merchant_id] = token;
            }
            // إضافة mapping بـ user_id كـ fallback
            tokensMap[`user_${token.user_id}`] = token;
          });
          console.log(`✅ تم جلب ${allTokens.length} توكن`, allTokens.map(t => `${t.account_username} (${t.merchant_id || 'بدون merchant_id'})`));
        }

        // جلب الفواتير من قاعدة البيانات
        const { data: cachedInvoices, error: invoicesError } = await supabase
          .from('delivery_invoices')
          .select('*')
          .eq('partner', activePartner)
          .eq('owner_user_id', user?.id)
          .order('issued_at', { ascending: false })
          .limit(50);

        if (invoicesError) throw invoicesError;

      if (cachedInvoices?.length > 0) {
          // ✅ استخدام البيانات المُخزنة مباشرة (تم تحديثها بواسطة backfill migration)
          const transformedInvoices = cachedInvoices.map(inv => ({
            id: inv.external_id,
            merchant_price: inv.amount,
            delivered_orders_count: inv.orders_count,
            status: inv.status,
            merchant_id: inv.merchant_id,
            updated_at: inv.issued_at,
            created_at: inv.created_at,
            raw: inv.raw,
            // استخدام account_username و partner_name_ar من قاعدة البيانات مباشرة
            account_username: inv.account_username,
            partner_name_ar: inv.partner_name_ar || (activePartner === 'modon' ? 'مدن' : 'الوسيط')
          }));
          
          // إحصائيات الحسابات للتتبع
          const accountsStats = {};
          transformedInvoices.forEach(inv => {
            const account = inv.account_username || `معرف ${inv.merchant_id}`;
            accountsStats[account] = (accountsStats[account] || 0) + 1;
          });
          
          setInvoices(transformedInvoices);
          console.log(`⚡ تحميل فوري: عرض ${transformedInvoices.length} فاتورة مع أسماء الحسابات`);
          console.log('📊 إحصائيات الفواتير حسب الحساب:', accountsStats);
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
      let selectedToken = token;

      // ✅ CRITICAL FIX: استخدام التوكن الصحيح للفاتورة بدلاً من التوكن العام
      const { data: invoiceRecord } = await supabase
        .from('delivery_invoices')
        .select('owner_user_id, partner, account_username, external_id, orders_count, orders_last_synced_at')
        .eq('external_id', invoiceId)
        .single();

      if (invoiceRecord?.owner_user_id && invoiceRecord?.partner) {
        // جلب التوكن الصحيح للمستخدم والشركة المحددة
        const { data: tokenData } = await supabase
          .from('delivery_partner_tokens')
          .select('token, partner_name')
          .eq('user_id', invoiceRecord.owner_user_id)
          .eq('partner_name', invoiceRecord.partner)
          .eq('is_active', true)
          .order('last_used_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (tokenData?.token) {
          selectedToken = tokenData.token;
          console.log(`✅ استخدام التوكن الصحيح للفاتورة ${invoiceId} (${invoiceRecord.partner})`);
        }
      }

      // محاولة API أولاً إذا كان التوكن متاحاً - أولوية للبيانات الحية
      if (selectedToken && isLoggedIn) {
        try {
          // استدعاء API المناسب حسب partner الفاتورة
          if (invoiceRecord?.partner === 'modon') {
            const ModonAPI = await import('@/lib/modon-api');
            invoiceData = await ModonAPI.getInvoiceOrders(selectedToken, invoiceId);
          } else {
            invoiceData = await AlWaseetAPI.getInvoiceOrders(selectedToken, invoiceId);
          }
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
            .select('id, external_id, raw, orders_count')
            .eq('external_id', invoiceId)
            .limit(1)
            .single();

          if (invoiceError && invoiceError.code !== 'PGRST116') {
            throw invoiceError;
          }

          const finalInvoiceId = invoiceRecord?.id || invoiceId;
          
          // ✅ إذا الفاتورة موجودة لكن delivery_invoice_orders فارغة - أعد المزامنة
          if (invoiceRecord?.orders_count > 0) {
            const { data: existingOrders, error: checkError } = await supabase
              .from('delivery_invoice_orders')
              .select('id')
              .eq('invoice_id', finalInvoiceId)
              .limit(1);
            
            if (!checkError && (!existingOrders || existingOrders.length === 0)) {
              console.warn('⚠️ الفاتورة موجودة لكن الطلبات فارغة - إجبار المزامنة');
              
              // محاولة جلب من API مرة أخرى مع retry
              if (selectedToken && isLoggedIn) {
                try {
                  let apiOrders;
                  if (invoiceRecord?.partner === 'modon') {
                    const ModonAPI = await import('@/lib/modon-api');
                    apiOrders = await ModonAPI.getInvoiceOrders(selectedToken, invoiceId);
                  } else {
                    apiOrders = await AlWaseetAPI.getInvoiceOrders(selectedToken, invoiceId);
                  }
                  
                  if (apiOrders?.orders && apiOrders.orders.length > 0) {
                    // حفظ في delivery_invoice_orders
                    const ordersToInsert = apiOrders.orders.map(order => ({
                      invoice_id: finalInvoiceId,
                      external_order_id: String(order.id),
                      raw: order,
                      status: order.status,
                      amount: order.price
                    }));
                    
                    const { error: insertError } = await supabase
                      .from('delivery_invoice_orders')
                      .upsert(ordersToInsert, { 
                        onConflict: 'invoice_id,external_order_id' 
                      });
                    
                    if (!insertError) {
                      // تحديث orders_last_synced_at
                      await supabase
                        .from('delivery_invoices')
                        .update({ orders_last_synced_at: new Date().toISOString() })
                        .eq('id', finalInvoiceId);

                      console.log(`✅ تم حفظ ${ordersToInsert.length} طلب للفاتورة ${invoiceId}`);
                      invoiceData = apiOrders;
                      dataSource = 'api_retry';
                    }
                  } else {
                    console.warn(`⚠️ الفاتورة ${invoiceId}: شركة التوصيل لم تُرجع طلبات. قد تكون قديمة أو محذوفة.`);
                  }
                } catch (retryError) {
                  console.error('❌ فشل retry للمزامنة:', retryError.message);
                }
              }
            }
          }

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
      console.log(`🔄 استلام الفاتورة ${invoiceId}...`);
      
      // 1) تأكيد الاستلام على API المناسب
      if (activePartner === 'modon') {
        const ModonAPI = await import('@/lib/modon-api');
        await ModonAPI.receiveInvoice(token, invoiceId);
      } else {
        await AlWaseetAPI.receiveInvoice(token, invoiceId);
      }

      // 2) جلب الفاتورة من قاعدة البيانات المحلية
      const { data: invoiceRecord, error: invoiceError } = await supabase
        .from('delivery_invoices')
        .select('id, external_id, issued_at, updated_at')
        .eq('external_id', String(invoiceId))
        .eq('partner', activePartner)
        .maybeSingle();

      if (invoiceError || !invoiceRecord) {
        throw new Error('لم يتم العثور على الفاتورة في قاعدة البيانات');
      }

      const dbInvoiceId = invoiceRecord.id;
      const invoiceDate = invoiceRecord.updated_at || invoiceRecord.issued_at || new Date().toISOString();

      // 3) جلب جميع الطلبات المرتبطة عبر delivery_invoice_orders
      const { data: linkedOrders, error: linkedError } = await supabase
        .from('delivery_invoice_orders')
        .select('order_id, external_order_id')
        .eq('invoice_id', dbInvoiceId)
        .not('order_id', 'is', null);

      if (linkedError) {
        console.error('خطأ في جلب الطلبات المرتبطة:', linkedError);
      }

      let updatedOrdersCount = 0;
      let profitsUpdatedCount = 0;

      // 4) تحديث الطلبات المرتبطة
      if (linkedOrders && linkedOrders.length > 0) {
        const orderIds = linkedOrders.map(lo => lo.order_id);

        console.log(`📦 تحديث ${orderIds.length} طلب مرتبط...`);

        // ✅ CRITICAL FIX: لا نُحدد receipt_received_at يدوياً
        // الـ trigger في قاعدة البيانات سيأخذ التاريخ من الفاتورة تلقائياً
        const { data: updated, error: updateError } = await supabase
          .from('orders')
          .update({
            receipt_received: true,
            receipt_received_by: user?.id || user?.user_id || null,
            delivery_partner_invoice_id: String(invoiceId),
            delivery_partner_invoice_date: invoiceDate,
            updated_at: new Date().toISOString()
          })
          .in('id', orderIds)
          .select('id, order_number');

        if (updateError) {
          console.error('خطأ في تحديث الطلبات:', updateError);
        } else {
          updatedOrdersCount = updated?.length || 0;
          console.log(`✅ تم تحديث ${updatedOrdersCount} طلب:`, updated?.map(o => o.order_number));
        }

        // تحديث جدول الأرباح
        const { data: updatedProfits, error: profitsError } = await supabase
          .from('profits')
          .update({ 
            status: 'invoice_received', 
            updated_at: new Date().toISOString() 
          })
          .in('order_id', orderIds)
          .neq('status', 'settled')
          .select('id');

        if (!profitsError) {
          profitsUpdatedCount = updatedProfits?.length || 0;
          console.log(`💰 تم تحديث ${profitsUpdatedCount} سجل أرباح`);
        }
      }

      // 5) تحديث الفاتورة محلياً
      await supabase
        .from('delivery_invoices')
        .update({
          received: true,
          received_flag: true,
          received_at: new Date().toISOString(),
          status: 'تم الاستلام من قبل التاجر',
          status_normalized: 'RECEIVED',
          updated_at: new Date().toISOString()
        })
        .eq('id', dbInvoiceId);

      // 6) تحديث UI
      setInvoices(prev => prev.map(inv =>
        inv.external_id === String(invoiceId) || inv.id === invoiceId
          ? { ...inv, received: true, status: 'تم الاستلام من قبل التاجر' }
          : inv
      ));

      // 7) إشعار المستخدم
      toast({
        title: '✅ تم تأكيد استلام الفاتورة',
        description: `تم تحديث ${updatedOrdersCount} طلب${profitsUpdatedCount ? ` و${profitsUpdatedCount} سجل أرباح` : ''}`,
        variant: 'success'
      });

      // 8) تحديث القائمة
      await fetchInvoices();
      
      // 9) إطلاق حدث مخصص
      window.dispatchEvent(new CustomEvent('invoiceReceived', {
        detail: {
          invoiceId: String(invoiceId),
          ordersCount: updatedOrdersCount
        }
      }));

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

  // ✅ FIXED: Link invoice with local orders - directly from database
  const linkInvoiceWithLocalOrders = useCallback(async (invoiceId) => {
    if (!invoiceId) return [];

    try {
      console.log(`🔗 جلب الطلبات المرتبطة بالفاتورة ${invoiceId} من قاعدة البيانات مباشرة`);
      
      // أولاً: جلب internal ID للفاتورة من external_id
      const { data: invoiceRecord, error: invoiceError } = await supabase
        .from('delivery_invoices')
        .select('id')
        .eq('external_id', invoiceId)
        .single();

      if (invoiceError || !invoiceRecord) {
        console.warn(`⚠️ الفاتورة ${invoiceId} غير موجودة في قاعدة البيانات`);
        return [];
      }

      // ثانياً: جلب الطلبات المرتبطة مباشرة من قاعدة البيانات
      // بدون الاعتماد على API - يضمن عرض جميع الطلبات المرتبطة
      const { data: linkedOrders, error } = await supabase
        .from('delivery_invoice_orders')
        .select(`
          id,
          external_order_id,
          amount,
          status,
          order_id,
          orders:order_id (
            id,
            order_number,
            tracking_number,
            customer_name,
            customer_phone,
            customer_address,
            customer_city,
            delivery_partner,
            delivery_partner_order_id,
            delivery_partner_invoice_id,
            status,
            delivery_status,
            total_amount,
            discount,
            delivery_fee,
            sales_amount,
            final_amount,
            receipt_received,
            created_at,
            updated_at
          )
        `)
        .eq('invoice_id', invoiceRecord.id);

      if (error) {
        console.error('❌ خطأ في جلب الطلبات المرتبطة:', error);
        return [];
      }

      // تحويل البيانات للصيغة المتوقعة
      const formattedOrders = (linkedOrders || [])
        .filter(item => item.orders) // فقط الطلبات الموجودة
        .map(item => ({
          ...item.orders,
          invoice_link_id: item.id,
          invoice_amount: item.amount,
          invoice_status: item.status
        }));

      console.log(`✅ تم جلب ${formattedOrders.length} طلب مرتبط من قاعدة البيانات`);
      return formattedOrders;
      
    } catch (error) {
      console.error('❌ خطأ في ربط الفاتورة بالطلبات المحلية:', error);
      return [];
    }
  }, []);

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

  /**
   * إعادة معالجة فاتورة مستلمة لتحديث الطلبات المرتبطة بها
   */
  const reprocessReceivedInvoice = useCallback(async (invoiceExternalId) => {
    try {
      console.log(`🔄 بدء إعادة معالجة الفاتورة: ${invoiceExternalId}`);
      
      // 1. جلب الفاتورة من قاعدة البيانات
      const { data: invoice, error: invoiceError } = await supabase
        .from('delivery_invoices')
        .select('*')
        .eq('external_id', invoiceExternalId)
        .eq('partner', 'alwaseet')
        .single();

      if (invoiceError || !invoice) {
        console.error('❌ خطأ في جلب الفاتورة:', invoiceError);
        toast.error('لم يتم العثور على الفاتورة');
        return;
      }

      // 2. جلب جميع الطلبات المرتبطة بالفاتورة
      const { data: invoiceOrders, error: ordersError } = await supabase
        .from('delivery_invoice_orders')
        .select('order_id, external_order_id')
        .eq('invoice_id', invoice.id);

      if (ordersError) {
        console.error('❌ خطأ في جلب طلبات الفاتورة:', ordersError);
        toast.error('خطأ في جلب طلبات الفاتورة');
        return;
      }

      if (!invoiceOrders || invoiceOrders.length === 0) {
        console.warn('⚠️ لا توجد طلبات مرتبطة بالفاتورة');
        toast.error('لا توجد طلبات مرتبطة بالفاتورة');
        return;
      }

      console.log(`📦 تم العثور على ${invoiceOrders.length} طلب مرتبط بالفاتورة`);

      // 3. تحديث كل طلب مرتبط
      let updatedCount = 0;
      const currentUserId = user?.id || '91484496-b887-44f7-9e5d-be9db5567604';

      for (const invoiceOrder of invoiceOrders) {
        if (!invoiceOrder.order_id) continue;

        // تحديث جدول orders
        const { error: updateOrderError } = await supabase
          .from('orders')
          .update({
            receipt_received: true,
            receipt_received_at: new Date().toISOString(),
            receipt_received_by: currentUserId,
            delivery_partner_invoice_id: invoiceExternalId,
            updated_at: new Date().toISOString()
          })
          .eq('id', invoiceOrder.order_id);

        if (updateOrderError) {
          console.error(`❌ خطأ في تحديث الطلب ${invoiceOrder.order_id}:`, updateOrderError);
          continue;
        }

        // تحديث جدول profits
        const { error: updateProfitError } = await supabase
          .from('profits')
          .update({
            status: 'invoice_received',
            updated_at: new Date().toISOString()
          })
          .eq('order_id', invoiceOrder.order_id);

        if (updateProfitError) {
          console.error(`❌ خطأ في تحديث الأرباح للطلب ${invoiceOrder.order_id}:`, updateProfitError);
        }

        updatedCount++;
        console.log(`✅ تم تحديث الطلب ${invoiceOrder.order_id} بنجاح`);
      }

      // 4. تحديث حالة الفاتورة إذا لم تكن مستلمة
      if (!invoice.received) {
        const { error: updateInvoiceError } = await supabase
          .from('delivery_invoices')
          .update({
            received: true,
            received_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', invoice.id);

        if (updateInvoiceError) {
          console.error('❌ خطأ في تحديث حالة الفاتورة:', updateInvoiceError);
        }
      }

      console.log(`✅ تمت إعادة معالجة الفاتورة بنجاح - تم تحديث ${updatedCount} طلب`);
      toast.success(`تمت إعادة معالجة الفاتورة - تم تحديث ${updatedCount} طلب`);

      // 5. تحديث القائمة
      window.dispatchEvent(new CustomEvent('invoiceReceived', { 
        detail: { invoiceId: invoiceExternalId } 
      }));

      return { success: true, updatedCount };
    } catch (error) {
      console.error('❌ خطأ في إعادة معالجة الفاتورة:', error);
      toast.error('خطأ في إعادة معالجة الفاتورة');
      return { success: false, error };
    }
  }, [user?.id]);

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
    reprocessReceivedInvoice,
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
