
import { useState, useCallback, useEffect } from 'react';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import * as AlWaseetAPI from '@/lib/alwaseet-api';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import devLog from '@/lib/devLogger';

const LAST_SYNC_COOLDOWN_KEY = 'alwaseet_last_sync_timestamp';
const SYNC_COOLDOWN_MINUTES = 10;

export const useAlWaseetInvoices = () => {
  const { token, isLoggedIn, activePartner } = useAlWaseet();
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceOrders, setInvoiceOrders] = useState([]);

  // Enhanced smart fetch with instant loading and background sync - UNIFIED for all partners
  // 🛡️ Cache-first: نعرض فواتير قاعدة البيانات أولاً، ثم نحاول API بهدوء.
  //    لا نستبدل القائمة الحالية بـ [] أبداً عند فشل API/errNum:21/CF.
  const fetchInvoices = useCallback(async (timeFilter = 'week', forceRefresh = false) => {
    if (!isLoggedIn) return;

    if (forceRefresh) setLoading(true);

    // 1) تحميل فوري من قاعدة البيانات (لا يُمسح أبداً)
    let cachedFromDb = [];
    try {
      const { data: cached, error: cachedErr } = await supabase
        .from('delivery_invoices')
        .select('*')
        .in('partner', ['alwaseet', 'modon'])
        .eq('owner_user_id', user?.id)
        .order('issued_at', { ascending: false })
        .limit(200);

      if (!cachedErr && cached?.length) {
        cachedFromDb = cached.map(inv => ({
          id: inv.external_id,
          external_id: inv.external_id,
          merchant_price: inv.amount,
          delivered_orders_count: inv.orders_count,
          orders_count: inv.orders_count,
          status: inv.status,
          merchant_id: inv.merchant_id,
          updated_at: inv.issued_at || inv.updated_at,
          created_at: inv.created_at,
          raw: inv.raw,
          account_username: inv.account_username,
          partner: inv.partner,
          partner_name_ar: inv.partner_name_ar || (inv.partner === 'modon' ? 'مدن' : 'الوسيط'),
          received: inv.received,
          received_flag: inv.received_flag,
          status_normalized: inv.status_normalized
        }));
      }
    } catch {/* silent */}

    try {
      // 2) محاولة الجلب من توكنات المستخدم النشطة
      const { data: userTokens, error: tokensError } = await supabase
        .from('delivery_partner_tokens')
        .select('*')
        .eq('user_id', user?.id)
        .in('partner_name', ['alwaseet', 'modon'])
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString());

      if (tokensError) throw new Error('فشل جلب التوكنات');

      let allInvoicesData = [];
      let anyApiSuccess = false;
      let anyApiPermissionDenied = false;

      if (userTokens && userTokens.length > 0) {
        for (const tokenData of userTokens) {
          const partnerName = tokenData.partner_name;
          let invoicesFromThisToken = null;
          try {
            if (partnerName === 'modon') {
              const ModonAPI = await import('@/lib/modon-api');
              invoicesFromThisToken = await ModonAPI.getMerchantInvoices(tokenData.token);
            } else {
              invoicesFromThisToken = await AlWaseetAPI.getMerchantInvoices(tokenData.token);
            }
            anyApiSuccess = true;
          } catch (apiErr) {
            if (apiErr?.permissionDenied || apiErr?.isNoInvoicesError) {
              anyApiPermissionDenied = true;
              devLog.warn(`⚠️ ${partnerName}/${tokenData.account_username}: الوسيط لم يُعطِ صلاحية على endpoint الفواتير.`);
            } else {
              devLog.warn(`⚠️ فشل جلب فواتير ${partnerName}:`, apiErr?.message);
            }
            continue;
          }

          if (invoicesFromThisToken && invoicesFromThisToken.length > 0) {
            invoicesFromThisToken.forEach(inv => {
              inv.account_username = tokenData.account_username;
              inv.merchant_id = tokenData.merchant_id;
              inv.partner_name_ar = partnerName === 'modon' ? 'مدن' : 'الوسيط';
              inv.owner_user_id = user?.id;
              inv.partner = partnerName;
            });
            allInvoicesData.push(...invoicesFromThisToken);
          }
        }
      }

      // حفظ في DB (إذا حصلنا على بيانات فعلية)
      if (allInvoicesData.length > 0) {
        try {
          const { error: upsertErr } = await supabase.rpc('upsert_alwaseet_invoice_list', {
            p_invoices: allInvoicesData
          });
          if (upsertErr) {
            console.error('❌ خطأ في حفظ الفواتير:', upsertErr.message);
          }
        } catch (e) {
          console.error('❌ استثناء أثناء حفظ الفواتير:', e);
        }
      }

      // 3) قرار العرض:
      //    - إذا حصلنا فواتير من API → نُطبّق الفلتر ونعرضها.
      //    - إذا فشل API (لا توكن/permission_denied/CF) → نعرض cachedFromDb (لا تفريغ).
      const sourceList = (anyApiSuccess && allInvoicesData.length > 0) ? allInvoicesData : cachedFromDb;

      const filteredAndSortedInvoices = (sourceList || [])
        .filter(invoice => {
          if (timeFilter === 'all') {
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            const invoiceDate = new Date(invoice.updated_at || invoice.created_at);
            return invoiceDate >= sixMonthsAgo;
          }
          const invoiceDate = new Date(invoice.updated_at || invoice.created_at);
          switch (timeFilter) {
            case 'week': { const d = new Date(); d.setDate(d.getDate() - 7); return invoiceDate >= d; }
            case 'month': { const d = new Date(); d.setMonth(d.getMonth() - 1); return invoiceDate >= d; }
            case '3months': { const d = new Date(); d.setMonth(d.getMonth() - 3); return invoiceDate >= d; }
            case '6months': { const d = new Date(); d.setMonth(d.getMonth() - 6); return invoiceDate >= d; }
            case 'year': { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return invoiceDate >= d; }
            case 'custom': return true;
            default: return true;
          }
        })
        .sort((a, b) => {
          const aIsPending = a.status !== 'تم الاستلام من قبل التاجر';
          const bIsPending = b.status !== 'تم الاستلام من قبل التاجر';
          if (aIsPending && !bIsPending) return -1;
          if (!aIsPending && bIsPending) return 1;
          return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
        });

      // ⛔ لا نستبدل القائمة بـ [] إذا API فشل وكان لدينا كاش
      if (filteredAndSortedInvoices.length === 0 && cachedFromDb.length > 0 && !anyApiSuccess) {
        devLog.warn('⚠️ لم نتمكن من جلب الفواتير من API — نُبقي بيانات قاعدة البيانات.');
        // نترك القائمة الحالية كما هي (دون setInvoices)
      } else {
        setInvoices(filteredAndSortedInvoices);
      }

      if (forceRefresh && !anyApiSuccess && anyApiPermissionDenied) {
        toast({
          title: 'تعذر الجلب من شركة التوصيل',
          description: 'تم عرض البيانات المحفوظة. الوسيط رفض الـ endpoint مؤقتاً (errNum:21).',
        });
      }

      return filteredAndSortedInvoices;
    } catch (error) {
      // فشل عام — لا نمسح القائمة. نعرض الكاش إن وجد.
      if (cachedFromDb.length > 0 && invoices.length === 0) {
        setInvoices(cachedFromDb);
      }
      if (forceRefresh) {
        toast({
          title: 'خطأ في جلب الفواتير',
          description: error.message || 'سيتم عرض البيانات المحفوظة.',
          variant: 'destructive'
        });
      }
      return invoices;
    } finally {
      if (forceRefresh) setLoading(false);
    }
  }, [token, isLoggedIn, activePartner, user?.id]);

  // Enhanced smart sync for background updates
  const smartBackgroundSync = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('smart-invoice-sync', {
        body: { 
          mode: 'smart',
          employee_id: user?.id,
          sync_invoices: true,
          // CRITICAL: must be true so background sync creates delivery_invoice_orders
          // and triggers link_invoice_orders_to_orders automatically (no UI open required).
          sync_orders: true
        }
      });
      
      if (error) {
        // Silent error
      } else if (data?.invoices_synced > 0) {
        fetchInvoices('week', false);
      }
    } catch (error) {
      // Silent error
    }
  }, [fetchInvoices, user?.id]);

    // Enhanced instant loading with smart caching - UNIFIED for all partners
  useEffect(() => {
    if (!isLoggedIn) return;

    const loadInvoicesInstantly = async () => {
      // ✅ جلب جميع التوكنات النشطة للمستخدم - كل الشركات
      try {
        // جلب جميع التوكنات النشطة
        const { data: allTokens, error: tokensError } = await supabase
          .from('delivery_partner_tokens')
          .select('merchant_id, account_username, partner_name, user_id')
          .eq('user_id', user?.id)
          .in('partner_name', ['alwaseet', 'modon'])
          .eq('is_active', true)
          .gt('expires_at', new Date().toISOString());

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
        }

        // جلب الفواتير من قاعدة البيانات - كل الشركات
        const { data: cachedInvoices, error: invoicesError } = await supabase
          .from('delivery_invoices')
          .select('*')
          .in('partner', ['alwaseet', 'modon'])
          .eq('owner_user_id', user?.id)
          .order('issued_at', { ascending: false })
          .limit(100);

        if (invoicesError) throw invoicesError;

      if (cachedInvoices?.length > 0) {
          // ✅ استخدام البيانات المُخزنة مباشرة - مع إضافة حقل partner
          const transformedInvoices = cachedInvoices.map(inv => ({
            id: inv.external_id,
            external_id: inv.external_id,
            merchant_price: inv.amount,
            delivered_orders_count: inv.orders_count,
            status: inv.status,
            merchant_id: inv.merchant_id,
            updated_at: inv.issued_at,
            created_at: inv.created_at,
            raw: inv.raw,
            // استخدام account_username و partner_name_ar من قاعدة البيانات مباشرة
            account_username: inv.account_username,
            partner: inv.partner,
            partner_name_ar: inv.partner_name_ar || (inv.partner === 'modon' ? 'مدن' : 'الوسيط'),
            // ✅ إضافة الحقول المفقودة لتحديد حالة "مستلمة" بشكل صحيح
            received: inv.received,
            received_flag: inv.received_flag,
            status_normalized: inv.status_normalized
          }));
          
          // إحصائيات الحسابات للتتبع
          const accountsStats = {};
          transformedInvoices.forEach(inv => {
            const account = inv.account_username || `معرف ${inv.merchant_id}`;
            accountsStats[account] = (accountsStats[account] || 0) + 1;
          });
          
          setInvoices(transformedInvoices);
        }
      } catch (cacheError) {
        // Silent error
      }

      // 2. Then update from API in background (non-blocking)
      const lastSyncKey = `${LAST_SYNC_COOLDOWN_KEY}_${user?.id}`;
      const lastSync = localStorage.getItem(lastSyncKey);
      const timeSinceLastSync = lastSync ? Date.now() - parseInt(lastSync) : Infinity;
      const cooldownMs = SYNC_COOLDOWN_MINUTES * 60 * 1000;

      if (timeSinceLastSync > cooldownMs) {
        localStorage.setItem(lastSyncKey, Date.now().toString());
        
        // Smart background sync using edge function
        smartBackgroundSync();
      }
    };

    loadInvoicesInstantly();

    // Listen for invoice updates via custom events only
    const handleInvoiceReceived = (event) => {
      fetchInvoices('week', false);
    };

    const handleInvoiceUpdated = (event) => {
      fetchInvoices('week', false);
    };

    window.addEventListener('invoiceReceived', handleInvoiceReceived);
    window.addEventListener('invoiceUpdated', handleInvoiceUpdated);

    return () => {
      window.removeEventListener('invoiceReceived', handleInvoiceReceived);
      window.removeEventListener('invoiceUpdated', handleInvoiceUpdated);
    };
  }, [isLoggedIn, activePartner, fetchInvoices, user?.id]);

  // إصلاح fetchInvoiceOrders: للفواتير المستلمة نعتمد على القاعدة فقط (preferCache)
  const fetchInvoiceOrders = useCallback(async (invoiceId, options = {}) => {
    if (!invoiceId) return null;
    const { preferCache = false } = options;

    setLoading(true);
    try {
      let invoiceData = null;
      let dataSource = 'database';
      let selectedToken = token;

      // ✅ جلب معلومات الفاتورة + حالة الاستلام + عدد روابط الطلبات الموجودة
      const { data: invoiceRecord } = await supabase
        .from('delivery_invoices')
        .select('id, owner_user_id, partner, account_username, external_id, orders_count, orders_last_synced_at, received, received_flag, status, status_normalized')
        .eq('external_id', invoiceId)
        .single();

      // ✅ تحديد ما إذا كانت الفاتورة مستلمة
      const isReceivedInvoice = !!invoiceRecord && (
        invoiceRecord.received === true ||
        invoiceRecord.received_flag === true ||
        invoiceRecord.status === 'تم الاستلام من قبل التاجر' ||
        (invoiceRecord.status_normalized || '').toLowerCase() === 'received'
      );

      // ✅ تحقّق هل الكاش يحتوي طلبات فعلاً
      let cachedRowsCount = 0;
      if (invoiceRecord?.id) {
        const { count } = await supabase
          .from('delivery_invoice_orders')
          .select('id', { count: 'exact', head: true })
          .eq('invoice_id', invoiceRecord.id);
        cachedRowsCount = count || 0;
      }

      // ✅ نعتمد الكاش فقط إذا كان فعلاً ممتلئاً. إذا الفاتورة مستلمة لكن الكاش فارغ والعداد > 0
      //   نسمح بمحاولة الجلب من API لإصلاح الفجوة (السلوك الذي كان يعمل سابقاً).
      const expectedOrders = invoiceRecord?.orders_count || 0;
      const cacheLooksComplete = cachedRowsCount > 0 && (expectedOrders === 0 || cachedRowsCount >= expectedOrders);
      const cacheOnly = preferCache || (isReceivedInvoice && cacheLooksComplete);

      if (invoiceRecord?.owner_user_id && invoiceRecord?.partner && !cacheOnly) {
        // جلب التوكن الصحيح لصاحب الفاتورة (المدير أو الموظف)
        const { data: tokenData } = await supabase
          .from('delivery_partner_tokens')
          .select('token, partner_name')
          .eq('user_id', invoiceRecord.owner_user_id)
          .eq('partner_name', invoiceRecord.partner)
          .eq('is_active', true)
          .gt('expires_at', new Date().toISOString())
          .order('last_used_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (tokenData?.token) {
          selectedToken = tokenData.token;
        }
      }

      // محاولة API أولاً إذا كان التوكن متاحاً ولم نكن في وضع cacheOnly
      if (selectedToken && !cacheOnly) {
        try {
          if (invoiceRecord?.partner === 'modon') {
            const ModonAPI = await import('@/lib/modon-api');
            invoiceData = await ModonAPI.getInvoiceOrders(selectedToken, invoiceId);
          } else {
            invoiceData = await AlWaseetAPI.getInvoiceOrders(selectedToken, invoiceId);
          }
          dataSource = 'api';

          // ✅ نحفظ طلبات الفاتورة في الكاش فوراً (delivery_invoice_orders) ونشغّل الربط مع الطلبات المحلية
          if (invoiceRecord?.id && Array.isArray(invoiceData?.orders) && invoiceData.orders.length > 0) {
            try {
              const ordersToInsert = invoiceData.orders.map(o => ({
                invoice_id: invoiceRecord.id,
                external_order_id: String(o.id),
                raw: o,
                status: o.status,
                amount: o.price || o.amount || 0,
                owner_user_id: invoiceRecord.owner_user_id || null,
              }));
              await supabase
                .from('delivery_invoice_orders')
                .upsert(ordersToInsert, { onConflict: 'invoice_id,external_order_id' });
              await supabase
                .from('delivery_invoices')
                .update({ orders_last_synced_at: new Date().toISOString() })
                .eq('id', invoiceRecord.id);
              // ربط الطلبات المحلية تلقائياً
              await supabase.rpc('link_invoice_orders_to_orders');
            } catch (saveErr) {
              devLog.warn('⚠️ فشل حفظ طلبات الفاتورة في الكاش:', saveErr?.message);
            }
          }
        } catch (apiError) {
          devLog.warn(`⚠️ getInvoiceOrders(${invoiceId}) فشل من API، سنرجع للقاعدة:`, apiError?.message);
        }
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
          
          // 🆕 Self-heal موجّه: إذا الفاتورة موجودة لكن delivery_invoice_orders فارغة، ننفذ مزامنة موجهة
          // للـ external_id فقط عبر smart-invoice-sync (target_invoice_external_id). هذا لا يسبب
          // موجة طلبات لأن edge function تجلب فقط طلبات هذه الفاتورة وتكتفي.
          if (invoiceRecord?.orders_count > 0 && !cacheOnly) {
            const { data: existingOrders, error: checkError } = await supabase
              .from('delivery_invoice_orders')
              .select('id')
              .eq('invoice_id', finalInvoiceId)
              .limit(1);

            if (!checkError && (!existingOrders || existingOrders.length === 0)) {
              devLog.warn(`🩹 self-heal موجّه للفاتورة ${invoiceId}: استدعاء smart-invoice-sync لجلب طلباتها فقط`);
              try {
                await supabase.functions.invoke('smart-invoice-sync', {
                  body: {
                    mode: 'smart',
                    target_invoice_external_id: String(invoiceId),
                    target_invoice_partner: invoiceRecord?.partner || 'alwaseet',
                  }
                });
              } catch (selfHealErr) {
                devLog.warn('⚠️ self-heal الموجه فشل:', selfHealErr?.message);
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
            devLog.warn('خطأ في جلب الطلبات من قاعدة البيانات:', dbError);
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
            
            devLog.log('📋 طلبات الفاتورة من قاعدة البيانات:', {
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
            
            devLog.log('📄 طلبات من raw data للفاتورة:', orders.length);
          }

          invoiceData = { orders };
          dataSource = 'database';
          devLog.log('📊 جلب طلبات الفاتورة من قاعدة البيانات:', orders.length);
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
      devLog.log(`🔄 استلام الفاتورة ${invoiceId}...`);
      
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

        devLog.log(`📦 تحديث ${orderIds.length} طلب مرتبط...`);

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
          devLog.log(`✅ تم تحديث ${updatedOrdersCount} طلب:`, updated?.map(o => o.order_number));
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
          devLog.log(`💰 تم تحديث ${profitsUpdatedCount} سجل أرباح`);
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
      devLog.log(`🔗 جلب الطلبات المرتبطة بالفاتورة ${invoiceId} من قاعدة البيانات مباشرة`);
      
      // أولاً: جلب internal ID للفاتورة من external_id
      const { data: invoiceRecord, error: invoiceError } = await supabase
        .from('delivery_invoices')
        .select('id, orders_count')
        .eq('external_id', invoiceId)
        .single();

      if (invoiceError || !invoiceRecord) {
        devLog.warn(`⚠️ الفاتورة ${invoiceId} غير موجودة في قاعدة البيانات`);
        return [];
      }

      // ثانياً: جلب الطلبات المرتبطة مباشرة من قاعدة البيانات
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

      // ✅ Self-healing: إذا الفاتورة فيها طلبات لكن الجدول الوسيط فارغ
      const linkedWithOrders = (linkedOrders || []).filter(item => item.orders);
      
      if (linkedWithOrders.length === 0 && (invoiceRecord.orders_count > 0 || (linkedOrders || []).length === 0)) {
        devLog.warn('⚠️ Self-healing: محاولة إنشاء روابط الفاتورة من الطلبات المحلية...');
        try {
          const { data: healCount, error: healError } = await supabase
            .rpc('create_invoice_orders_from_local_orders', { p_invoice_id: invoiceRecord.id });
          
          if (!healError && healCount > 0) {
            devLog.log(`✅ Self-healing: تم إنشاء ${healCount} رابط جديد`);
            
            // إعادة الاستدعاء بعد self-healing
            await supabase.rpc('link_invoice_orders_to_orders');
            
            // إعادة جلب البيانات
            const { data: refreshedOrders } = await supabase
              .from('delivery_invoice_orders')
              .select(`
                id, external_order_id, amount, status, order_id,
                orders:order_id (
                  id, order_number, tracking_number, customer_name, customer_phone,
                  customer_address, customer_city, delivery_partner, delivery_partner_order_id,
                  delivery_partner_invoice_id, status, delivery_status, total_amount, discount,
                  delivery_fee, sales_amount, final_amount, receipt_received, created_at, updated_at
                )
              `)
              .eq('invoice_id', invoiceRecord.id);
            
            const refreshedFormatted = (refreshedOrders || [])
              .filter(item => item.orders)
              .map(item => ({
                ...item.orders,
                invoice_link_id: item.id,
                invoice_amount: item.amount,
                invoice_status: item.status
              }));
            
            devLog.log(`✅ بعد Self-healing: ${refreshedFormatted.length} طلب مرتبط`);
            return refreshedFormatted;
          }
        } catch (healErr) {
          console.error('❌ فشل Self-healing:', healErr);
        }
      }

      // تحويل البيانات للصيغة المتوقعة
      const formattedOrders = linkedWithOrders.map(item => ({
        ...item.orders,
        invoice_link_id: item.id,
        invoice_amount: item.amount,
        invoice_status: item.status
      }));

      devLog.log(`✅ تم جلب ${formattedOrders.length} طلب مرتبط من قاعدة البيانات`);
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
      devLog.warn('Cannot sync invoice: authentication or access required');
      return { success: false, error: 'Authentication required' };
    }

    try {
      devLog.log(`Starting sync for invoice ${externalId}...`);
      
      // Fetch the specific invoice from Al-Waseet
      const allInvoices = await AlWaseetAPI.getMerchantInvoices(token);
      const targetInvoice = allInvoices.find(inv => inv.id === externalId);
      
      if (!targetInvoice) {
        devLog.warn(`Invoice ${externalId} not found in Al-Waseet`);
        return { success: false, error: 'Invoice not found' };
      }

      // Fetch orders for this invoice
      const invoiceOrdersResponse = await AlWaseetAPI.getInvoiceOrders(token, externalId);
      const invoiceOrders = invoiceOrdersResponse?.orders || [];
      
      // Sync to database
      const result = await syncAlwaseetInvoiceData(targetInvoice, invoiceOrders);
      devLog.log(`Synced invoice ${externalId}:`, result);
      
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
          devLog.log(`Sync cooldown active. ${SYNC_COOLDOWN_MINUTES - Math.floor(diffMinutes)} minutes remaining`);
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
      devLog.log('Starting bulk sync of all recent invoices...');
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
          devLog.warn(`Failed to sync invoice ${invoice.id}:`, error);
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
      devLog.log('🔄 مزامنة سريعة - آخر فاتورتين...');
      
      // Use smart sync for quick updates
      const { data, error } = await supabase.functions.invoke('smart-invoice-sync', {
        body: { 
          mode: 'smart',
          employee_id: user?.id,
          sync_invoices: true,
          // CRITICAL: must be true to populate delivery_invoice_orders + auto-link.
          sync_orders: true,
          force_refresh: false
        }
      });
      
      if (error) {
        devLog.warn('تعذر المزامنة السريعة:', error.message);
        return { success: false, error: error.message };
      }
      
      const synced = data?.invoices_synced || 0;
      devLog.log('✅ مزامنة سريعة مكتملة:', synced, 'فاتورة');
      
      // Refresh state if we got new invoices
      if (synced > 0) {
        await fetchInvoices('week', false);
      }
      
      return { success: true, processed: synced };
    } catch (error) {
      devLog.warn('خطأ في المزامنة السريعة:', error);
      return { success: false, error: error.message };
    }
  }, [token, isLoggedIn, user?.id, fetchInvoices]);

  /**
   * إعادة معالجة فاتورة مستلمة لتحديث الطلبات المرتبطة بها
   */
  const reprocessReceivedInvoice = useCallback(async (invoiceExternalId) => {
    try {
      devLog.log(`🔄 بدء إعادة معالجة الفاتورة: ${invoiceExternalId}`);
      
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
        devLog.warn('⚠️ لا توجد طلبات مرتبطة بالفاتورة');
        toast.error('لا توجد طلبات مرتبطة بالفاتورة');
        return;
      }

      devLog.log(`📦 تم العثور على ${invoiceOrders.length} طلب مرتبط بالفاتورة`);

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
        devLog.log(`✅ تم تحديث الطلب ${invoiceOrder.order_id} بنجاح`);
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

      devLog.log(`✅ تمت إعادة معالجة الفاتورة بنجاح - تم تحديث ${updatedCount} طلب`);
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
