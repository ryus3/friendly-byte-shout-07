import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { toast } from '@/components/ui/use-toast';
import { useLocalStorage } from '@/hooks/useLocalStorage.jsx';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './UnifiedAuthContext';
import * as AlWaseetAPI from '@/lib/alwaseet-api';

const AlWaseetContext = createContext();

export const useAlWaseet = () => useContext(AlWaseetContext);

export const AlWaseetProvider = ({ children }) => {
  const { user } = useAuth();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState(null);
  const [waseetUser, setWaseetUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activePartner, setActivePartner] = useLocalStorage('active_delivery_partner', 'alwaseet');
  const [syncInterval, setSyncInterval] = useLocalStorage('sync_interval', 600000); // Default to 10 minutes
  const [orderStatusesMap, setOrderStatusesMap] = useState(new Map());

  // Sync state management
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncCountdown, setSyncCountdown] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [syncMode, setSyncMode] = useState('standby'); // 'initial', 'countdown', 'standby'
  const [autoSyncEnabled, setAutoSyncEnabled] = useLocalStorage('auto_sync_enabled', true);
  const [correctionComplete, setCorrectionComplete] = useLocalStorage('orders_correction_complete', false);
  const [lastNotificationStatus, setLastNotificationStatus] = useLocalStorage('last_notification_status', {});

  const [cities, setCities] = useState([]);
  const [regions, setRegions] = useState([]);
  const [packageSizes, setPackageSizes] = useState([]);

  const deliveryPartners = {
    local: { name: "توصيل محلي", api: null },
    alwaseet: { name: "الوسيط", api: "https://api.alwaseet-iq.net/v1/merchant" },
  };

  const fetchToken = useCallback(async () => {
    if (user) {
      const { data, error } = await supabase
        .from('delivery_partner_tokens')
        .select('token, expires_at, partner_data')
        .eq('user_id', user.id)
        .eq('partner_name', 'alwaseet')
        .maybeSingle();

      if (error) {
        console.error('Error fetching Al-Waseet token:', error.message);
        setToken(null);
        setWaseetUser(null);
        setIsLoggedIn(false);
        return;
      }

      if (data && new Date(data.expires_at) > new Date()) {
        setToken(data.token);
        setWaseetUser(data.partner_data);
        setIsLoggedIn(true);
      } else {
        if (data) {
            await supabase.from('delivery_partner_tokens').delete().match({ user_id: user.id, partner_name: 'alwaseet' });
            toast({ 
              title: "انتهت صلاحية التوكن", 
              description: "يجب تسجيل الدخول مرة أخرى لشركة التوصيل.", 
              variant: "destructive" 
            });
        }
        setToken(null);
        setWaseetUser(null);
        setIsLoggedIn(false);
      }
    }
  }, [user]);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  // مزامنة تلقائية ذكية مع تصحيح الطلبات الحالية
  useEffect(() => {
    if (!isLoggedIn || !token || activePartner === 'local') return;

    let intervalId;
    let initialSyncTimeout;

    const performAutoSync = async () => {
      if (!autoSyncEnabled) return;
      
      try {
        setIsSyncing(true);
        
        // تنفيذ التصحيح الجذري مرة واحدة فقط
        if (!correctionComplete) {
          console.log('🛠️ تنفيذ التصحيح الجذري للطلبات الحالية...');
          await comprehensiveOrderCorrection();
        }
        
        // مزامنة سريعة صامتة
        const result = await fastSyncPendingOrders(false);
        setLastSyncAt(new Date());
        
        console.log(`🔄 مزامنة تلقائية مكتملة: ${result.updated} تحديث، ${result.checked} فحص`);
      } catch (error) {
        console.error('❌ خطأ في المزامنة التلقائية:', error);
      } finally {
        setIsSyncing(false);
      }
    };

    // مزامنة أولية بعد 3 ثوان من تسجيل الدخول
    initialSyncTimeout = setTimeout(performAutoSync, 3000);

    // مزامنة دورية كل 10 دقائق
    if (autoSyncEnabled) {
      intervalId = setInterval(performAutoSync, syncInterval);
    }

    return () => {
      if (initialSyncTimeout) clearTimeout(initialSyncTimeout);
      if (intervalId) clearInterval(intervalId);
    };
  }, [isLoggedIn, token, activePartner, autoSyncEnabled, syncInterval, correctionComplete, comprehensiveOrderCorrection, fastSyncPendingOrders]);

  const login = useCallback(async (username, password, partner = 'alwaseet') => {
    if (partner === 'local') {
        setActivePartner('local');
        setIsLoggedIn(false);
        setToken(null);
        setWaseetUser(null);
        toast({ title: "تم التفعيل", description: "تم تفعيل وضع التوصيل المحلي." });
        return { success: true };
    }

    setLoading(true);
    try {
      const { data, error: proxyError } = await supabase.functions.invoke('alwaseet-proxy', {
        body: {
          endpoint: 'login',
          method: 'POST',
          payload: { username, password }
        }
      });

      if (proxyError) {
        const errorBody = await proxyError.context.json();
        throw new Error(errorBody.msg || 'فشل الاتصال بالخادم الوكيل.');
      }
      
      if (data.errNum !== "S000" || !data.status) {
        throw new Error(data.msg || 'فشل تسجيل الدخول. تحقق من اسم المستخدم وكلمة المرور.');
      }

      const tokenData = data.data;
      const expires_at = new Date();
      // Token validity: 7 days (604800 seconds) as requested
      expires_at.setSeconds(expires_at.getSeconds() + 604800);

      const partnerData = { username };

      // حفظ التوكن في قاعدة البيانات مع معالجة تضارب المفاتيح
      let dbError = null;
      
      try {
        const { error } = await supabase
          .from('delivery_partner_tokens')
          .upsert({
            user_id: user.id,
            partner_name: partner,
            token: tokenData.token,
            expires_at: expires_at.toISOString(),
            partner_data: partnerData,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id, partner_name' });
        dbError = error;
      } catch (error) {
        dbError = error;
      }

      // في حالة وجود خطأ تضارب، احذف السجل القديم وأدرج الجديد
      if (dbError && dbError.code === '23505') {
        await supabase
          .from('delivery_partner_tokens')
          .delete()
          .eq('user_id', user.id)
          .eq('partner_name', partner);
          
        const { error: insertError } = await supabase
          .from('delivery_partner_tokens')
          .insert({
            user_id: user.id,
            partner_name: partner,
            token: tokenData.token,
            expires_at: expires_at.toISOString(),
            partner_data: partnerData,
            is_active: true
          });
          
        if (insertError) {
          console.error('خطأ في إدراج التوكن الجديد:', insertError);
          throw new Error('فشل في حفظ بيانات تسجيل الدخول');
        }
      } else if (dbError) {
        console.error('خطأ في حفظ التوكن:', dbError);
        throw new Error('فشل في حفظ بيانات تسجيل الدخول: ' + dbError.message);
      }

      setToken(tokenData.token);
      setWaseetUser(partnerData);
      setIsLoggedIn(true);
      setActivePartner(partner);
      toast({ title: "نجاح", description: `تم تسجيل الدخول بنجاح في ${deliveryPartners[partner].name}.` });
      return { success: true };
    } catch (error) {
      toast({ title: "خطأ في تسجيل الدخول", description: error.message, variant: "destructive" });
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [setActivePartner, user, deliveryPartners]);

  const logout = useCallback(async () => {
    const partnerName = deliveryPartners[activePartner]?.name || 'شركة التوصيل';
    
    if (user && activePartner !== 'local') {
      await supabase
        .from('delivery_partner_tokens')
        .delete()
        .eq('user_id', user.id)
        .eq('partner_name', activePartner);
    }

    setIsLoggedIn(false);
    setToken(null);
    setWaseetUser(null);
    setCities([]);
    setRegions([]);
    setPackageSizes([]);
    setActivePartner('alwaseet');
    toast({ title: "تم تسجيل الخروج", description: `تم تسجيل الخروج من ${partnerName}.` });
  }, [activePartner, deliveryPartners, user, setActivePartner]);
  
  // تحميل حالات الطلبات وإنشاء خريطة التطابق
  const loadOrderStatuses = useCallback(async () => {
    if (!token) return;
    
    try {
      console.log('🔄 تحميل حالات الطلبات من الوسيط...');
      const statuses = await AlWaseetAPI.getOrderStatuses(token);
      
      // إنشاء خريطة مطابقة الحالات
      const statusMap = new Map();
      statuses.forEach(status => {
        const statusText = status.status?.toLowerCase() || '';
        const key = String(status.id);
        
        // مطابقة حالات الوسيط مع حالاتنا المحلية
        if (statusText.includes('استلام') && statusText.includes('مندوب')) {
          statusMap.set(key, 'shipped');
        } else if (statusText.includes('تسليم') || statusText.includes('مسلم')) {
          statusMap.set(key, 'delivered');
        } else if (statusText.includes('ملغي') || statusText.includes('إلغاء')) {
          statusMap.set(key, 'cancelled');
        } else if (statusText.includes('راجع') || statusText.includes('مرجع')) {
          statusMap.set(key, 'returned');
        } else if (statusText.includes('جاري') || statusText.includes('توصيل')) {
          statusMap.set(key, 'delivery');
        } else {
          statusMap.set(key, 'pending');
        }
      });
      
      setOrderStatusesMap(statusMap);
      console.log('✅ تم تحميل حالات الطلبات:', statusMap);
      return statusMap;
    } catch (error) {
      console.error('❌ خطأ في تحميل حالات الطلبات:', error);
      return new Map();
    }
  }, [token]);

  // Helper: chunking
  const chunkArray = useCallback((arr, size) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
    return chunks;
  }, []);

  // دالة التصحيح الجذري التلقائي للطلبات الحالية
  const comprehensiveOrderCorrection = useCallback(async () => {
    if (!token || correctionComplete) return { corrected: 0, linked: 0, updated: 0 };
    
    try {
      console.log('🛠️ بدء التصحيح الجذري للطلبات الحالية...');
      
      // تحميل حالات الطلبات إذا لم تكن محملة
      let statusMap = orderStatusesMap;
      if (statusMap.size === 0) {
        statusMap = await loadOrderStatuses();
      }
      
      // 1) جلب جميع طلبات الوسيط لبناء خريطة شاملة
      const waseetOrders = await AlWaseetAPI.getMerchantOrders(token);
      console.log(`📦 جلب ${waseetOrders.length} طلب من الوسيط للتصحيح`);
      
      // بناء خرائط للبحث السريع
      const byQrId = new Map(); // qr_id -> order
      const byTrackingNumber = new Map(); // tracking_number -> order
      
      waseetOrders.forEach(order => {
        if (order.qr_id) byQrId.set(String(order.qr_id), order);
        if (order.tracking_number && order.tracking_number !== order.qr_id) {
          byTrackingNumber.set(String(order.tracking_number), order);
        }
      });
      
      // 2) جلب جميع الطلبات المحلية للوسيط
      const { data: localOrders, error: localErr } = await supabase
        .from('orders')
        .select('id, tracking_number, delivery_partner_order_id, status, delivery_status')
        .eq('delivery_partner', 'alwaseet')
        .limit(1000);
        
      if (localErr) {
        console.error('❌ خطأ في جلب الطلبات المحلية:', localErr);
        return { corrected: 0, linked: 0, updated: 0 };
      }
      
      let corrected = 0;
      let linked = 0;
      let updated = 0;
      
      // 3) تصحيح كل طلب محلي
      for (const localOrder of localOrders || []) {
        let waseetOrder = null;
        let needsUpdate = false;
        const updates = {};
        
        // البحث عن الطلب في الوسيط
        if (localOrder.tracking_number) {
          waseetOrder = byQrId.get(String(localOrder.tracking_number)) || 
                       byTrackingNumber.get(String(localOrder.tracking_number));
        }
        
        if (waseetOrder) {
          // ربط معرف الوسيط إذا لم يكن موجوداً
          if (!localOrder.delivery_partner_order_id) {
            updates.delivery_partner_order_id = String(waseetOrder.id);
            needsUpdate = true;
            linked++;
            console.log(`🔗 ربط الطلب ${localOrder.id} مع معرف الوسيط ${waseetOrder.id}`);
          }
          
          // تحديث الحالة إذا كانت مختلفة
          const waseetStatusId = waseetOrder.status_id || waseetOrder.statusId || waseetOrder.status?.id;
          const waseetStatusText = waseetOrder.status || waseetOrder.status_text || waseetOrder.status_name || '';
          
          const correctLocalStatus = statusMap.get(String(waseetStatusId)) || 
            (() => {
              const t = String(waseetStatusText || '').toLowerCase();
              if (t.includes('تسليم') || t.includes('مسلم')) return 'delivered';
              if (t.includes('ملغي') || t.includes('إلغاء')) return 'cancelled';
              if (t.includes('راجع')) return 'returned';
              if (t.includes('مندوب') || t.includes('استلام')) return 'shipped';
              if (t.includes('جاري') || t.includes('توصيل')) return 'delivery';
              return 'pending';
            })();
          
          if (localOrder.status !== correctLocalStatus) {
            updates.status = correctLocalStatus;
            needsUpdate = true;
            updated++;
            console.log(`📝 تحديث حالة الطلب ${localOrder.id}: ${localOrder.status} → ${correctLocalStatus}`);
          }
          
          if (localOrder.delivery_status !== waseetStatusText) {
            updates.delivery_status = waseetStatusText;
            needsUpdate = true;
          }
          
          // تحديث رسوم التوصيل إن وُجدت
          if (waseetOrder.delivery_price) {
            const dp = parseInt(String(waseetOrder.delivery_price)) || 0;
            if (dp >= 0) {
              updates.delivery_fee = dp;
              needsUpdate = true;
            }
          }
          
          // تحديث حالة استلام الإيصال
          if (waseetOrder.deliver_confirmed_fin === 1) {
            updates.receipt_received = true;
            needsUpdate = true;
          }
        }
        
        // تطبيق التحديثات إذا كانت مطلوبة
        if (needsUpdate) {
          updates.updated_at = new Date().toISOString();
          
          const { error: updateErr } = await supabase
            .from('orders')
            .update(updates)
            .eq('id', localOrder.id);
            
          if (!updateErr) {
            corrected++;
            console.log(`✅ تصحيح الطلب ${localOrder.id} مكتمل`);
          } else {
            console.warn('⚠️ فشل تصحيح الطلب:', localOrder.id, updateErr);
          }
        }
      }
      
      // تسجيل إتمام التصحيح
      setCorrectionComplete(true);
      
      console.log(`✅ التصحيح الجذري مكتمل: ${corrected} طلب مُصحح، ${linked} طلب مربوط، ${updated} حالة محدثة`);
      
      if (corrected > 0) {
        toast({
          title: "🛠️ التصحيح التلقائي مكتمل",
          description: `تم تصحيح ${corrected} طلب وربط ${linked} طلب مع شركة التوصيل`,
          variant: "success",
          duration: 6000
        });
      }
      
      return { corrected, linked, updated };
    } catch (error) {
      console.error('❌ خطأ في التصحيح الجذري:', error);
      return { corrected: 0, linked: 0, updated: 0 };
    }
  }, [token, correctionComplete, orderStatusesMap, loadOrderStatuses, setCorrectionComplete]);

  // ربط معرفات الوسيط للطلبات الموجودة لدينا عبر الـ tracking_number
  const linkRemoteIdsForExistingOrders = useCallback(async () => {
    if (!token) return { linked: 0 };
    try {
      console.log('🧩 محاولة ربط معرفات الوسيط للطلبات بدون معرف...');
      // 1) اجلب طلباتنا التي لا تملك delivery_partner_order_id
      const { data: localOrders, error: localErr } = await supabase
        .from('orders')
        .select('id, tracking_number')
        .eq('delivery_partner', 'alwaseet')
        .is('delivery_partner_order_id', null)
        .limit(500);
      if (localErr) {
        console.error('❌ خطأ في جلب الطلبات المحلية بدون معرف وسيط:', localErr);
        return { linked: 0 };
      }
      if (!localOrders || localOrders.length === 0) {
        console.log('✅ لا توجد طلبات بحاجة للربط حالياً');
        return { linked: 0 };
      }

      // 2) اجلب جميع طلبات الوسيط ثم ابنِ خريطة: qr_id -> waseet_id
      const waseetOrders = await AlWaseetAPI.getMerchantOrders(token);
      console.log(`📦 تم جلب ${waseetOrders.length} طلب من الوسيط لعملية الربط`);
      const byQr = new Map();
      for (const o of waseetOrders) {
        const qr = o.qr_id || o.tracking_number;
        if (qr) byQr.set(String(qr), String(o.id));
      }

      // 3) حدّث الطلبات المحلية التي يمكن ربطها
      let linked = 0;
      for (const lo of localOrders) {
        const remoteId = byQr.get(String(lo.tracking_number));
        if (remoteId) {
          const { error: upErr } = await supabase
            .from('orders')
            .update({
              delivery_partner_order_id: remoteId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', lo.id);
          if (!upErr) {
            linked++;
            console.log(`🔗 تم ربط الطلب ${lo.id} بمعرف الوسيط ${remoteId}`);
          } else {
            console.warn('⚠️ فشل تحديث ربط معرف الوسيط للطلب:', lo.id, upErr);
          }
        }
      }

      if (linked > 0) {
        toast({ title: 'تم الربط', description: `تم ربط ${linked} طلب بمعرف الوسيط.` });
      }
      return { linked };
    } catch (e) {
      console.error('❌ خطأ أثناء ربط المعرفات:', e);
      return { linked: 0 };
    }
  }, [token]);

  // مزامنة طلبات معلّقة بسرعة عبر IDs (دفعات 25) - صامتة مع إشعارات ذكية
  const fastSyncPendingOrders = useCallback(async (showNotifications = false) => {
    if (activePartner === 'local' || !isLoggedIn || !token) {
      if (showNotifications) {
        toast({ title: "غير متاح", description: "المزامنة متاحة فقط عند تسجيل الدخول لشركة التوصيل." });
      }
      return { updated: 0, checked: 0 };
    }

    setLoading(true);
    try {
      // تأكد من تحميل خريطة الحالات
      let statusMap = orderStatusesMap;
      if (statusMap.size === 0) {
        statusMap = await loadOrderStatuses();
      }

      // 1) اجلب الطلبات المعلقة لدينا مع معرف الوسيط
      const targetStatuses = ['pending', 'delivery', 'shipped', 'returned'];
      const { data: pendingOrders, error: pendingErr } = await supabase
        .from('orders')
        .select('id, status, delivery_status, delivery_partner_order_id, order_number, qr_id')
        .eq('delivery_partner', 'alwaseet')
        .in('status', targetStatuses)
        .limit(200);

      if (pendingErr) {
        console.error('❌ خطأ في جلب الطلبات المعلقة:', pendingErr);
        if (showNotifications) {
          toast({ title: 'خطأ', description: 'فشل جلب الطلبات للمزامنة السريعة', variant: 'destructive' });
        }
        return { updated: 0, checked: 0 };
      }

      // إذا وجدت طلبات بدون معرف وسيط، حاول ربطها أولاً
      const missingIdCount = (pendingOrders || []).filter(o => !o.delivery_partner_order_id).length;
      if (missingIdCount > 0) {
        await linkRemoteIdsForExistingOrders();
      }

      // أعد الجلب بعد الربط
      const { data: pendingOrders2 } = await supabase
        .from('orders')
        .select('id, status, delivery_status, delivery_partner_order_id, order_number, qr_id')
        .eq('delivery_partner', 'alwaseet')
        .in('status', targetStatuses)
        .not('delivery_partner_order_id', 'is', null)
        .limit(500);

      const ordersToSync = pendingOrders2 || [];
      const ids = ordersToSync.map(o => String(o.delivery_partner_order_id)).filter(Boolean);
      if (ids.length === 0) {
        if (showNotifications) {
          toast({ title: 'لا توجد تحديثات', description: 'لا توجد طلبات بحاجة لمزامنة سريعة.' });
        }
        return { updated: 0, checked: 0 };
      }

      let updated = 0;
      let checked = 0;
      const statusChanges = [];

      // 2) نفّذ استدعاءات الدفعات (25 كحد أقصى لكل مرة)
      const batches = chunkArray(ids, 25);
      for (const batch of batches) {
        const waseetData = await AlWaseetAPI.getOrdersByIdsBulk(token, batch);
        checked += Array.isArray(waseetData) ? waseetData.length : 0;

        for (const o of (waseetData || [])) {
          const waseetStatusId = o.status_id || o.statusId || o.status?.id;
          const waseetStatusText = o.status || o.status_text || o.status_name || '';
          const localStatus =
            statusMap.get(String(waseetStatusId)) ||
            (() => {
              const t = String(waseetStatusText || '').toLowerCase();
              if (t.includes('تسليم') || t.includes('مسلم')) return 'delivered';
              if (t.includes('ملغي') || t.includes('إلغاء')) return 'cancelled';
              if (t.includes('راجع')) return 'returned';
              if (t.includes('مندوب') || t.includes('استلام')) return 'shipped';
              if (t.includes('جاري') || t.includes('توصيل')) return 'delivery';
              return 'pending';
            })();

          // العثور على الطلب المحلي للمقارنة
          const localOrder = ordersToSync.find(lo => String(lo.delivery_partner_order_id) === String(o.id));
          if (!localOrder) continue;

          // فحص ما إذا كانت هناك حاجة لتحديث
          const needsStatusUpdate = localOrder.status !== localStatus;
          const needsDeliveryStatusUpdate = localOrder.delivery_status !== waseetStatusText;

          if (!needsStatusUpdate && !needsDeliveryStatusUpdate && !o.delivery_price && o.deliver_confirmed_fin !== 1) {
            continue; // لا حاجة للتحديث
          }

          const updates = {
            updated_at: new Date().toISOString(),
          };

          if (needsStatusUpdate) {
            updates.status = localStatus;
            
            // إشعار ذكي فقط عند تغيير الحالة الفعلي
            const orderKey = localOrder.qr_id || localOrder.order_number || localOrder.id;
            const lastStatus = lastNotificationStatus[orderKey];
            
            if (showNotifications && lastStatus !== localStatus) {
              statusChanges.push({
                orderNumber: localOrder.qr_id || localOrder.order_number,
                oldStatus: localOrder.status,
                newStatus: localStatus,
                deliveryStatus: waseetStatusText
              });
              
              // تحديث آخر حالة تم إشعار المستخدم بها
              setLastNotificationStatus(prev => ({
                ...prev,
                [orderKey]: localStatus
              }));
            }
          }

          if (needsDeliveryStatusUpdate) {
            updates.delivery_status = waseetStatusText;
          }

          // تحديث رسوم التوصيل إن وُجدت
          if (o.delivery_price) {
            const dp = parseInt(String(o.delivery_price)) || 0;
            if (dp >= 0) updates.delivery_fee = dp;
          }

          // إذا تم تأكيد الاستلام المالي
          if (o.deliver_confirmed_fin === 1) {
            updates.receipt_received = true;
          }

          const { error: upErr } = await supabase
            .from('orders')
            .update(updates)
            .eq('delivery_partner_order_id', String(o.id));

          if (!upErr) {
            updated++;
            console.log(`✅ تحديث سريع: ${o.id} → ${localStatus} | ${waseetStatusText}`);
          } else {
            console.warn('⚠️ فشل تحديث الطلب (fast sync):', o.id, upErr);
          }
        }
      }

      // إشعارات ذكية مجمعة
      if (showNotifications && statusChanges.length > 0) {
        const getStatusLabel = (status) => {
          const labels = {
            'pending': 'قيد الانتظار',
            'shipped': 'تم الشحن',
            'delivery': 'قيد التوصيل',
            'delivered': 'تم التسليم',
            'cancelled': 'ملغي',
            'returned': 'مرجع',
            'completed': 'مكتمل'
          };
          return labels[status] || status;
        };

        if (statusChanges.length === 1) {
          const change = statusChanges[0];
          toast({
            title: "🔄 تحديث حالة طلب",
            description: `الطلب ${change.orderNumber}: ${getStatusLabel(change.oldStatus)} → ${getStatusLabel(change.newStatus)}`,
            variant: "info",
            duration: 5000
          });
        } else {
          toast({
            title: "🔄 تحديث حالات الطلبات",
            description: `تم تحديث ${statusChanges.length} طلب بحالات جديدة من شركة التوصيل`,
            variant: "info",
            duration: 5000
          });
        }
      }

      return { updated, checked, statusChanges: statusChanges.length };
    } catch (e) {
      console.error('❌ خطأ في المزامنة السريعة:', e);
      if (showNotifications) {
        toast({ title: 'خطأ في المزامنة', description: e.message, variant: 'destructive' });
      }
      return { updated: 0, checked: 0 };
    } finally {
      setLoading(false);
    }
  }, [activePartner, isLoggedIn, token, orderStatusesMap, loadOrderStatuses, linkRemoteIdsForExistingOrders, chunkArray, lastNotificationStatus, setLastNotificationStatus]);

  // مزامنة الطلبات مع تحديث الحالات في قاعدة البيانات
  const syncAndApplyOrders = async () => {
    if (activePartner === 'local' || !isLoggedIn || !token) {
      toast({ title: "غير متاح", description: "مزامنة الطلبات متاحة فقط عند تسجيل الدخول لشركة توصيل." });
      return [];
    }
    
    try {
      setLoading(true);
      console.log('🔄 بدء المزامنة الشاملة للطلبات...');
      
      // تحميل حالات الطلبات إذا لم تكن محملة
      let statusMap = orderStatusesMap;
      if (statusMap.size === 0) {
        statusMap = await loadOrderStatuses();
      }
      
      // جلب طلبات الوسيط
      const waseetOrders = await AlWaseetAPI.getMerchantOrders(token);
      console.log(`📦 تم جلب ${waseetOrders.length} طلب من الوسيط`);
      
      let updatedCount = 0;
      
      // تحديث حالة كل طلب في قاعدة البيانات
      for (const waseetOrder of waseetOrders) {
        const trackingNumber = waseetOrder.qr_id || waseetOrder.tracking_number;
        if (!trackingNumber) continue;
        
        const waseetStatusId = waseetOrder.status_id || waseetOrder.status;
        const waseetStatusText = waseetOrder.status_text || waseetOrder.status_name || waseetOrder.status || '';
        const localStatus =
          statusMap.get(String(waseetStatusId)) ||
          (() => {
            const t = String(waseetStatusText).toLowerCase();
            if (t.includes('تسليم') || t.includes('مسلم')) return 'delivered';
            if (t.includes('ملغي') || t.includes('إلغاء')) return 'cancelled';
            if (t.includes('راجع')) return 'returned';
            if (t.includes('مندوب') || t.includes('استلام')) return 'shipped';
            if (t.includes('جاري') || t.includes('توصيل')) return 'delivery';
            return 'pending';
          })();
        
        try {
          // البحث عن الطلب في قاعدة البيانات باستخدام tracking_number
          const { data: existingOrder } = await supabase
            .from('orders')
            .select('id, status, delivery_status, delivery_fee, receipt_received, delivery_partner_order_id')
            .eq('tracking_number', trackingNumber)
            .single();
        
          if (existingOrder) {
            // تحضير التحديثات
            const updates = {
              status: localStatus,
              delivery_status: waseetStatusText,
              updated_at: new Date().toISOString(),
            };
            
            // حفظ معرف طلب الوسيط إن كان مفقوداً
            if (!existingOrder.delivery_partner_order_id && waseetOrder.id) {
              updates.delivery_partner_order_id = String(waseetOrder.id);
              updates.delivery_partner = 'alwaseet';
            }
            
            // تحديث رسوم التوصيل إن وُجدت
            const dp = parseInt(String(waseetOrder.delivery_price || 0)) || 0;
            if (dp >= 0 && dp !== (existingOrder.delivery_fee || 0)) {
              updates.delivery_fee = dp;
            }
            
            // تأكيد الاستلام المالي
            if (waseetOrder.deliver_confirmed_fin === 1 && existingOrder.receipt_received !== true) {
              updates.receipt_received = true;
            }
            
            const needUpdate = (
              existingOrder.status !== updates.status ||
              (existingOrder.delivery_status || '') !== updates.delivery_status ||
              updates.delivery_fee !== undefined ||
              updates.receipt_received === true ||
              updates.delivery_partner_order_id !== undefined
            );
            
            if (needUpdate) {
              await supabase
                .from('orders')
                .update(updates)
                .eq('id', existingOrder.id);
              updatedCount++;
              console.log(`✅ تم تحديث الطلب ${trackingNumber}: ${existingOrder.status} → ${localStatus}`);
            }
          }
        } catch (error) {
          console.error(`❌ خطأ في تحديث الطلب ${trackingNumber}:`, error);
        }
      }
      
      const message = updatedCount > 0 
        ? `تم تحديث ${updatedCount} طلب من أصل ${waseetOrders.length}`
        : `تم فحص ${waseetOrders.length} طلب - لا توجد تحديثات مطلوبة`;
      
      // Silent sync - no toast notification
      
      return waseetOrders;
    } catch (error) {
      console.error('❌ خطأ في المزامنة:', error);
      toast({ 
        title: "خطأ في المزامنة", 
        description: error.message, 
        variant: "destructive" 
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  // مزامنة طلب واحد بـ tracking number
  const syncOrderByTracking = async (trackingNumber) => {
    if (activePartner === 'local' || !isLoggedIn || !token) {
      console.log('❌ مزامنة غير متاحة - وضع محلي أو غير مسجل دخول');
      return null;
    }
    
    try {
      console.log(`🔍 مزامنة الطلب: ${trackingNumber}`);
      
      // تحميل حالات الطلبات إذا لم تكن محملة
      let statusMap = orderStatusesMap;
      if (statusMap.size === 0) {
        statusMap = await loadOrderStatuses();
      }
      
      // جلب جميع طلبات الوسيط والبحث عن الطلب المطلوب
      const waseetOrders = await AlWaseetAPI.getMerchantOrders(token);
      const waseetOrder = waseetOrders.find(order => 
        order.qr_id === trackingNumber || order.tracking_number === trackingNumber
      );
      
      if (!waseetOrder) {
        console.log(`❌ لم يتم العثور على الطلب ${trackingNumber} في الوسيط`);
        return null;
      }
      
      const waseetStatusText = waseetOrder.status_text || waseetOrder.status_name || waseetOrder.status || '';
      const waseetStatusId = waseetOrder.status_id || waseetOrder.status;
      const localStatus =
        statusMap.get(String(waseetStatusId)) ||
        (() => {
          const t = String(waseetStatusText).toLowerCase();
          if (t.includes('تسليم') || t.includes('مسلم')) return 'delivered';
          if (t.includes('ملغي') || t.includes('إلغاء')) return 'cancelled';
          if (t.includes('راجع')) return 'returned';
          if (t.includes('مندوب') || t.includes('استلام')) return 'shipped';
          if (t.includes('جاري') || t.includes('توصيل')) return 'delivery';
          return 'pending';
        })();

      // جلب الطلب المحلي لفحص الحاجة للتحديث
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('id, status, delivery_status, delivery_fee, receipt_received, delivery_partner_order_id')
        .eq('tracking_number', trackingNumber)
        .single();

      const updates = {
        status: localStatus,
        delivery_status: waseetStatusText,
        updated_at: new Date().toISOString(),
      };
      
      if (waseetOrder.id && (!existingOrder?.delivery_partner_order_id)) {
        updates.delivery_partner_order_id = String(waseetOrder.id);
        updates.delivery_partner = 'alwaseet';
      }
      
      const dp = parseInt(String(waseetOrder.delivery_price || 0)) || 0;
      if (dp >= 0 && dp !== (existingOrder?.delivery_fee || 0)) {
        updates.delivery_fee = dp;
      }
      if (waseetOrder.deliver_confirmed_fin === 1 && existingOrder?.receipt_received !== true) {
        updates.receipt_received = true;
      }

      const needs_update = existingOrder ? (
        existingOrder.status !== updates.status ||
        (existingOrder.delivery_status || '') !== updates.delivery_status ||
        updates.delivery_fee !== undefined ||
        updates.receipt_received === true ||
        updates.delivery_partner_order_id !== undefined
      ) : true;
      
      return {
        tracking_number: trackingNumber,
        waseet_status: waseetStatusText,
        local_status: localStatus,
        updates,
        needs_update,
      };
    } catch (error) {
      console.error(`❌ خطأ في مزامنة الطلب ${trackingNumber}:`, error);
      return null;
    }
  };

  // للتوافق مع الإصدار السابق
  const syncOrders = syncAndApplyOrders;

  const getMerchantOrders = useCallback(async () => {
    if (token) {
      try {
        const orders = await AlWaseetAPI.getMerchantOrders(token);
        return { success: true, data: orders };
      } catch (error) {
        return { success: false, message: error.message };
      }
    }
    return { success: false, message: "لم يتم تسجيل الدخول لشركة التوصيل." };
  }, [token]);

  const getOrderStatuses = useCallback(async () => {
    if (token) {
      try {
        const statuses = await AlWaseetAPI.getOrderStatuses(token);
        return { success: true, data: statuses };
      } catch (error) {
        return { success: false, message: error.message };
      }
    }
    return { success: false, message: "لم يتم تسجيل الدخول لشركة التوصيل." };
  }, [token]);

  const fetchCities = useCallback(async () => {
    if (token) {
      try {
        const data = await AlWaseetAPI.getCities(token);
        if (Array.isArray(data)) {
          setCities(data);
        } else if (typeof data === 'object' && data !== null) {
          setCities(Object.values(data));
        } else {
          setCities([]);
        }
      } catch (error) {
        toast({ title: "خطأ", description: `فشل جلب المدن: ${error.message}`, variant: "destructive" });
        setCities([]);
      }
    }
  }, [token]);

  const fetchRegions = useCallback(async (cityId) => {
    if (token && cityId) {
      try {
        const data = await AlWaseetAPI.getRegionsByCity(token, cityId);
        if (Array.isArray(data)) {
          setRegions(data);
        } else if (typeof data === 'object' && data !== null) {
          setRegions(Object.values(data));
        } else {
          setRegions([]);
        }
      } catch (error) {
        toast({ title: "خطأ", description: `فشل جلب المناطق: ${error.message}`, variant: "destructive" });
        setRegions([]);
      }
    }
  }, [token]);

  const fetchPackageSizes = useCallback(async () => {
    if (token) {
      try {
        const data = await AlWaseetAPI.getPackageSizes(token);
        if (Array.isArray(data)) {
          setPackageSizes(data);
        } else if (typeof data === 'object' && data !== null) {
          setPackageSizes(Object.values(data));
        } else {
          setPackageSizes([]);
        }
      } catch (error) {
        toast({ title: "خطأ", description: `فشل جلب أحجام الطرود: ${error.message}`, variant: "destructive" });
        setPackageSizes([]);
      }
    }
  }, [token]);

  const createOrder = useCallback(async (orderData) => {
    if (token) {
      try {
        const result = await AlWaseetAPI.createAlWaseetOrder(orderData, token);

        // New: إذا أعاد الوسيط معرف الطلب، خزنه في طلبنا المحلي المطابق لـ tracking_number
        if (result && result.id && orderData?.tracking_number) {
          const { error: upErr } = await supabase
            .from('orders')
            .update({
              delivery_partner_order_id: String(result.id),
              delivery_partner: 'alwaseet',
              updated_at: new Date().toISOString(),
            })
            .eq('tracking_number', String(orderData.tracking_number));
          if (upErr) {
            console.warn('⚠️ فشل حفظ معرف الطلب من الوسيط في الطلب المحلي:', upErr);
          } else {
            console.log('🔗 تم حفظ معرف طلب الوسيط في الطلب المحلي:', result.id);
          }
        }

        return { success: true, data: result };
      } catch (error) {
        return { success: false, message: error.message };
      }
    }
    return { success: false, message: "لم يتم تسجيل الدخول لشركة التوصيل." };
  }, [token]);

  const editOrder = useCallback(async (orderData) => {
    if (token) {
      try {
        const result = await AlWaseetAPI.editAlWaseetOrder(orderData, token);
        return { success: true, data: result };
      } catch (error) {
        return { success: false, message: error.message };
      }
    }
    return { success: false, message: "لم يتم تسجيل الدخول لشركة التوصيل." };
  }, [token]);

  useEffect(() => {
    if (isLoggedIn && activePartner === 'alwaseet') {
      fetchCities();
      fetchPackageSizes();
      loadOrderStatuses();
    }
  }, [isLoggedIn, activePartner, fetchCities, fetchPackageSizes, loadOrderStatuses]);

  // Auto-fetch cities when token is available (even if not fully logged in)
  useEffect(() => {
    if (token && cities.length === 0) {
      fetchCities();
    }
    if (token && packageSizes.length === 0) {
      fetchPackageSizes();
    }
  }, [token, cities.length, packageSizes.length, fetchCities, fetchPackageSizes]);

  // Perform sync with countdown
  const performSyncWithCountdown = useCallback(async () => {
    if (activePartner === 'local' || !isLoggedIn || isSyncing) return;

    setIsSyncing(true);
    setSyncMode('countdown');
    setSyncCountdown(15);

    // Countdown timer
    const countdownInterval = setInterval(() => {
      setSyncCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Wait for countdown then sync
    setTimeout(async () => {
      try {
        console.log('🔄 تنفيذ المزامنة...');
        await fastSyncPendingOrders();
        setLastSyncAt(new Date());
        console.log('✅ تمت المزامنة بنجاح');
      } catch (error) {
        console.error('❌ خطأ في المزامنة:', error);
      } finally {
        setIsSyncing(false);
        setSyncMode('standby');
        setSyncCountdown(0);
      }
    }, 15000);

  }, [activePartner, isLoggedIn, isSyncing, fastSyncPendingOrders]);

  // Initial sync on login
  useEffect(() => {
    if (isLoggedIn && activePartner === 'alwaseet' && syncMode === 'standby' && !lastSyncAt) {
      console.log('🚀 مزامنة أولية عند تسجيل الدخول...');
      setSyncMode('initial');
      performSyncWithCountdown();
    }
  }, [isLoggedIn, activePartner, syncMode, lastSyncAt, performSyncWithCountdown]);

  // Periodic sync every 10 minutes
  useEffect(() => {
    let intervalId;
    if (isLoggedIn && activePartner === 'alwaseet' && syncMode === 'standby') {
      intervalId = setInterval(() => {
        if (!isSyncing) {
          console.log('⏰ مزامنة دورية (كل 10 دقائق)...');
          performSyncWithCountdown();
        }
      }, syncInterval);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isLoggedIn, activePartner, syncMode, isSyncing, syncInterval, performSyncWithCountdown]);

  const value = {
    isLoggedIn,
    token,
    waseetToken: token, // Alias for compatibility
    waseetUser,
    loading,
    login,
    logout,
    activePartner,
    setActivePartner,
    deliveryPartners,
    syncOrders,
    syncInterval,
    setSyncInterval,
    fetchToken,
    cities,
    regions,
    packageSizes,
    fetchCities,
    fetchRegions,
    fetchPackageSizes,
    createAlWaseetOrder: createOrder,
    editAlWaseetOrder: editOrder,
    getMerchantOrders,
    getOrderStatuses,
    loadOrderStatuses,
    syncAndApplyOrders,
    syncOrderByTracking,
    orderStatusesMap,

    // New exports:
    fastSyncPendingOrders,
    linkRemoteIdsForExistingOrders,
    comprehensiveOrderCorrection,
    
    // Sync status exports
    isSyncing,
    syncCountdown,
    syncMode,
    lastSyncAt,
    performSyncWithCountdown,
    autoSyncEnabled,
    setAutoSyncEnabled,
    correctionComplete,
    setCorrectionComplete,
  };

  return (
    <AlWaseetContext.Provider value={value}>
      {children}
    </AlWaseetContext.Provider>
  );
};
