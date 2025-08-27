import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { toast } from '@/components/ui/use-toast';
import { useLocalStorage } from '@/hooks/useLocalStorage.jsx';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './UnifiedAuthContext';
import { useNotificationsSystem } from './NotificationsSystemContext';
import * as AlWaseetAPI from '@/lib/alwaseet-api';
import { getStatusConfig } from '@/lib/alwaseet-statuses';

const AlWaseetContext = createContext();

export const useAlWaseet = () => useContext(AlWaseetContext);

export const AlWaseetProvider = ({ children }) => {
  const { user } = useAuth();
  
  // استخدام اختياري لنظام الإشعارات
  let createNotification = null;
  try {
    const notificationsSystem = useNotificationsSystem();
    createNotification = notificationsSystem.createNotification;
  } catch (error) {
    // NotificationsSystemProvider غير متاح بعد
    console.log('NotificationsSystem not ready yet');
  }
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
  const [syncMode, setSyncMode] = useState('standby'); // 'initial', 'countdown', 'syncing', 'standby'
  const [autoSyncEnabled, setAutoSyncEnabled] = useLocalStorage('auto_sync_enabled', true);
  const [correctionComplete, setCorrectionComplete] = useLocalStorage('orders_correction_complete', false);
  const [lastNotificationStatus, setLastNotificationStatus] = useLocalStorage('last_notification_status', {});

  // دالة محسنة لإرسال إشعارات تغيير حالة الطلبات مع منع التكرار الذكي
  const createOrderStatusNotification = useCallback((trackingNumber, stateId, statusText) => {
    if (!createNotification || !trackingNumber || !stateId) return;
    
    console.log('🔔 محاولة إرسال إشعار:', { trackingNumber, stateId, statusText });
    
    // الحالات المهمة التي تستحق إشعارات
    const importantStates = ['2', '4', '17', '25', '26', '31', '32'];
    if (!importantStates.includes(String(stateId))) {
      console.log('⏭️ تجاهل state_id غير مهم:', stateId);
      return;
    }
    
    // منع التكرار الذكي - فقط عند تغيير الحالة فعلياً
    const trackingKey = `${trackingNumber}`;
    const lastStateId = lastNotificationStatus[trackingKey];
    
    // إذا كانت نفس الحالة، لا ترسل إشعار
    if (lastStateId === String(stateId)) {
      console.log('🔄 منع تكرار - نفس الحالة:', { trackingNumber, stateId, lastStateId });
      return;
    }
    
    const statusConfig = getStatusConfig(Number(stateId));
    
    // تحسين النص حسب state_id مع تنسيق موحد
    let message = '';
    let priority = 'medium';
    
    switch (String(stateId)) {
      case '2':
        message = `${trackingNumber} تم الاستلام من قبل المندوب`;
        priority = 'medium';
        break;
      case '4':
        message = `${trackingNumber} تم التسليم بنجاح`;
        priority = 'high';
        break;
      case '17':
        message = `${trackingNumber} تم الإرجاع`;
        priority = 'medium';
        break;
      case '25':
      case '26':
        message = `${trackingNumber} العميل لا يرد`;
        priority = 'low';
        break;
      case '31':
      case '32':
        message = `${trackingNumber} تم الإلغاء`;
        priority = 'high';
        break;
      default:
        message = `${trackingNumber} ${statusConfig.text || statusText}`;
        priority = statusConfig.priority || 'medium';
    }
    
    console.log('✅ إرسال إشعار الوسيط:', {
      trackingNumber, 
      stateId, 
      message, 
      priority 
    });
    
    // إرسال الإشعار مع البيانات المطلوبة والتأكد من وجود state_id
    try {
      const notificationData = {
        type: 'alwaseet_status_change',
        title: 'تحديث حالة الطلب',
        message: message,
        priority: priority,
        data: {
          state_id: String(stateId), // التأكد من وجود state_id هنا
          tracking_number: trackingNumber,
          status_text: statusText,
          timestamp: new Date().toISOString(),
          // إضافة البيانات للتوافق مع الإشعارات القديمة
          order_id: trackingNumber,
          order_number: trackingNumber
        }
      };
      
      console.log('📤 بيانات الإشعار المرسلة:', notificationData);
      createNotification(notificationData);
      
      // تحديث آخر حالة مرسلة
      setLastNotificationStatus(prev => ({
        ...prev,
        [trackingKey]: String(stateId)
      }));
      
      console.log('🎯 تم إرسال إشعار الوسيط بنجاح');
      
    } catch (error) {
      console.error('❌ خطأ في إرسال إشعار الوسيط:', error);
    }
  }, [createNotification, lastNotificationStatus, setLastNotificationStatus]);

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

  // Auto-sync will be set up after functions are defined

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
  
  // تحميل حالات الطلبات وإنشاء خريطة التطابق الجديدة
  const loadOrderStatuses = useCallback(async () => {
    if (!token) return;
    
    try {
      console.log('🔄 تحميل حالات الطلبات من الوسيط...');
      const statuses = await AlWaseetAPI.getOrderStatuses(token);
      
      // استيراد النظام الجديد لحالات الوسيط
      const { getStatusConfig } = await import('@/lib/alwaseet-statuses');
      
      // إنشاء خريطة مطابقة الحالات بالنظام الجديد
      const statusMap = new Map();
      statuses.forEach(status => {
        const stateId = String(status.id || status.state_id);
        const statusConfig = getStatusConfig(stateId);
        
        // تطبيق الحالة الداخلية المناسبة
        statusMap.set(stateId, statusConfig.internalStatus);
        
        console.log(`📋 State ID ${stateId}: "${status.status}" → ${statusConfig.internalStatus} ${statusConfig.releasesStock ? '(يحرر المخزون)' : '(محجوز)'}`);
      });
      
      setOrderStatusesMap(statusMap);
      console.log('✅ تم تحميل حالات الطلبات بالنظام الجديد:', statusMap);
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
              if (t.includes('تسليم') && t.includes('مصادقة')) return 'completed';
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

  // دالة الحذف التلقائي للطلبات المحذوفة من الوسيط
  const handleAutoDeleteOrder = useCallback(async (orderId, source = 'manual') => {
    try {
      console.log(`🗑️ handleAutoDeleteOrder: بدء حذف الطلب ${orderId} من ${source}`);
      
      // 1. جلب تفاصيل الطلب قبل الحذف
      const { data: orderToDelete, error: fetchError } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', orderId)
        .single();
        
      if (fetchError || !orderToDelete) {
        console.error('❌ فشل في جلب الطلب للحذف:', fetchError);
        return false;
      }
      
      // 2. تحرير المخزون المحجوز
      if (orderToDelete.order_items && orderToDelete.order_items.length > 0) {
        for (const item of orderToDelete.order_items) {
          try {
            await supabase.rpc('release_stock_item', {
              p_product_id: item.product_id,
              p_variant_id: item.variant_id,
              p_quantity: item.quantity
            });
            console.log(`📦 تم تحرير ${item.quantity} قطعة من المنتج ${item.product_id}`);
          } catch (releaseError) {
            console.warn('⚠️ تعذر تحرير المخزون للعنصر:', item.product_id, releaseError);
          }
        }
      }
      
      // 3. حذف الطلب من قاعدة البيانات
      const { error: deleteError } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);
        
      if (deleteError) {
        console.error('❌ فشل في حذف الطلب:', deleteError);
        return false;
      }
      
      console.log(`✅ تم حذف الطلب ${orderToDelete.order_number || orderId} تلقائياً من ${source}`);
      
      // 4. إشعار المستخدم عند الحذف التلقائي
      if (source === 'fastSync') {
        toast({
          title: "حذف تلقائي",
          description: `تم حذف الطلب ${orderToDelete.order_number || orderToDelete.tracking_number} تلقائياً لأنه غير موجود في الوسيط`,
          variant: "default"
        });
      }
      
      return true;
    } catch (error) {
      console.error('❌ خطأ في الحذف التلقائي:', error);
      return false;
    }
  }, [supabase, toast]);

  // مزامنة طلبات معلّقة بسرعة عبر IDs (دفعات 25) - صامتة مع إشعارات ذكية + fallback search
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

      // 1) اجلب الطلبات المعلقة لدينا (سواء بمعرف وسيط أم لا)
      const targetStatuses = ['pending', 'delivery', 'shipped', 'returned'];
      const { data: pendingOrders, error: pendingErr } = await supabase
        .from('orders')
        .select('id, status, delivery_status, delivery_partner_order_id, order_number, qr_id, tracking_number, receipt_received, created_at')
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

      if (!pendingOrders || pendingOrders.length === 0) {
        if (showNotifications) {
          toast({ title: 'لا توجد تحديثات', description: 'لا توجد طلبات بحاجة لمزامنة سريعة.' });
        }
        return { updated: 0, checked: 0 };
      }

      // 2) اجلب جميع طلبات الوسيط لعمل fallback search
      const waseetOrders = await AlWaseetAPI.getMerchantOrders(token);
      console.log(`📦 تم جلب ${waseetOrders.length} طلب من الوسيط للمزامنة السريعة`);

      // 3) بناء خرائط للبحث السريع
      const byWaseetId = new Map();
      const byQrId = new Map();
      const byTracking = new Map();
      
      for (const wo of waseetOrders) {
        if (wo.id) byWaseetId.set(String(wo.id), wo);
        if (wo.qr_id) byQrId.set(String(wo.qr_id).trim(), wo);
        if (wo.tracking_number) byTracking.set(String(wo.tracking_number).trim(), wo);
      }

      // 4) معالجة كل طلب محلي
      let updated = 0;
      let checked = 0;
      let repaired = 0;
      const statusChanges = [];

      for (const localOrder of pendingOrders) {
        let waseetOrder = null;
        let needsIdRepair = false;

        // أولاً: البحث بمعرف الوسيط إذا كان موجوداً
        if (localOrder.delivery_partner_order_id) {
          waseetOrder = byWaseetId.get(String(localOrder.delivery_partner_order_id));
        }

        // ثانياً: fallback search بـ tracking_number أو qr_id
        if (!waseetOrder) {
          const tn = String(localOrder.tracking_number || localOrder.qr_id || '').trim();
          if (tn) {
            waseetOrder = byQrId.get(tn) || byTracking.get(tn);
            if (waseetOrder && !localOrder.delivery_partner_order_id) {
              needsIdRepair = true; // نحتاج لإصلاح المعرف
            }
          }
        }

        // حذف تلقائي فقط إذا لم يوجد في الوسيط وكان قبل الاستلام
        if (!waseetOrder && canAutoDeleteOrder(localOrder)) {
          // مهلة أمان 5 دقائق قبل أي حذف تلقائي
          const createdAt = new Date(localOrder.created_at);
          const ageMs = Date.now() - (createdAt?.getTime?.() || 0);
          const fiveMinutes = 5 * 60 * 1000;
          if (!createdAt || !Number.isFinite(createdAt.getTime()) || ageMs < fiveMinutes) {
            console.log('⏳ تخطي الحذف: الطلب أحدث من 5 دقائق أو تاريخ غير صالح', {
              orderId: localOrder.id,
              tracking: localOrder.tracking_number,
              created_at: localOrder.created_at,
              ageMs
            });
            // لا نحذف ونكمل للطلب التالي
          } else {
            // تحقق نهائي مباشر من الوسيط باستخدام QR/Tracking
            const confirmKey = String(localOrder.tracking_number || localOrder.qr_id || '').trim();
            if (!confirmKey) {
              console.log('⚠️ لا يوجد مفتاح تحقق (tracking/qr)، تخطي الحذف', localOrder.id);
            } else {
              let remoteCheck = null;
              try {
                remoteCheck = await AlWaseetAPI.getOrderByQR(token, confirmKey);
              } catch (e) {
                console.warn('⚠️ فشل التحقق النهائي من الوسيط قبل الحذف:', e);
              }
              if (!remoteCheck) {
                console.log('🗑️ الطلب غير موجود في الوسيط بعد التحقق النهائي، سيتم حذفه تلقائياً:', localOrder.tracking_number);
                await handleAutoDeleteOrder(localOrder.id, 'fastSync');
                continue;
              }
            }
          }
        }

        if (!waseetOrder) {
          continue; // لم نجد الطلب في الوسيط
        }

        checked++;

        // إصلاح معرف الوسيط إذا لزم الأمر
        if (needsIdRepair) {
          await supabase
            .from('orders')
            .update({ 
              delivery_partner_order_id: String(waseetOrder.id),
              updated_at: new Date().toISOString()
            })
            .eq('id', localOrder.id);
          repaired++;
          console.log(`🔧 تم إصلاح معرف الوسيط للطلب ${localOrder.tracking_number}: ${waseetOrder.id}`);
        }

        // إصلاح رقم التتبع إذا كان مساوياً لمعرف الوسيط (نمط الخطأ)
        const waseetQr = String(waseetOrder.qr_id || waseetOrder.tracking_number || '').trim();
        const localTn = String(localOrder.tracking_number || '').trim();
        const localDid = String(localOrder.delivery_partner_order_id || '').trim();
        if (localTn && localDid && localTn === localDid && waseetQr && waseetQr !== localTn) {
          await supabase
            .from('orders')
            .update({ 
              tracking_number: waseetQr,
              updated_at: new Date().toISOString()
            })
            .eq('id', localOrder.id);
          repaired++;
          console.log(`🔧 تم إصلاح رقم التتبع للطلب ${localOrder.id}: ${localTn} → ${waseetQr}`);
        }
        
        // 5) معالجة التحديثات
        const waseetStatusId = waseetOrder.status_id || waseetOrder.statusId || waseetOrder.status?.id;
        const waseetStatusText = waseetOrder.status || waseetOrder.status_text || waseetOrder.status_name || '';
        
        // تحسين التحويل للحالات الشائعة مثل "حالة ثابتة"
        const localStatus = statusMap.get(String(waseetStatusId)) || (() => {
          const t = String(waseetStatusText || '').toLowerCase();
          if (t.includes('تسليم') || t.includes('مسلم')) return 'delivered';
          if (t.includes('ملغي') || t.includes('إلغاء')) return 'cancelled';
          if (t.includes('راجع')) return 'returned';
          if (t.includes('مندوب') || t.includes('استلام')) return 'shipped';
          if (t.includes('جاري') || t.includes('توصيل')) return 'delivery';
          if (t.includes('حالة ثابتة') || t.includes('ثابت')) return 'delivered'; // إضافة مُحسَّنة
          return 'pending';
        })();

        // فحص ما إذا كانت هناك حاجة لتحديث
        const needsStatusUpdate = localOrder.status !== localStatus;
        const needsDeliveryStatusUpdate = localOrder.delivery_status !== waseetStatusText;
        const finConfirmed = Number(waseetOrder.deliver_confirmed_fin) === 1; // تطبيع مقارنة الأرقام
        const needsReceiptUpdate = finConfirmed && !localOrder.receipt_received;

        if (!needsStatusUpdate && !needsDeliveryStatusUpdate && !waseetOrder.delivery_price && !needsReceiptUpdate) {
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
        if (waseetOrder.delivery_price) {
          const dp = parseInt(String(waseetOrder.delivery_price)) || 0;
          if (dp >= 0) updates.delivery_fee = dp;
        }

        // تحديث استلام الإيصال والترقية للحالة المكتملة
        if (finConfirmed) {
          updates.receipt_received = true;
          // ترقية للحالة المكتملة إذا كان الطلب مُسَلَّم أو قيد التسليم
          if (localStatus === 'delivered' || localOrder.status === 'delivered') {
            updates.status = 'completed';
          }
        }

        const { error: upErr } = await supabase
          .from('orders')
          .update(updates)
          .eq('id', localOrder.id);

        if (!upErr) {
          updated++;
          console.log(`✅ تحديث سريع: ${localOrder.tracking_number} → ${updates.status || localStatus} | ${waseetStatusText}`);
          
          // تطبيق الحذف التلقائي إذا كان الطلب غير موجود في الوسيط
          if (!waseetOrder && canAutoDeleteOrder(localOrder)) {
            // تحقق نهائي من الوسيط عبر QR/Tracking قبل الحذف
            const confirmKey = String(localOrder.tracking_number || localOrder.qr_id || '').trim();
            let remoteCheck = null;
            if (confirmKey) {
              try {
                remoteCheck = await AlWaseetAPI.getOrderByQR(token, confirmKey);
              } catch (e) {
                console.warn('⚠️ فشل التحقق النهائي من الوسيط قبل الحذف (داخل التحديث):', e);
              }
            }
            if (!remoteCheck) {
              const createdAt = new Date(localOrder.created_at);
              const ageMs = Date.now() - (createdAt?.getTime?.() || 0);
              const fiveMinutes = 5 * 60 * 1000;
              if (!createdAt || !Number.isFinite(createdAt.getTime()) || ageMs < fiveMinutes) {
                console.log('⏳ تخطي الحذف: الطلب أحدث من 5 دقائق أو تاريخ غير صالح', {
                  orderId: localOrder.id,
                  tracking: localOrder.tracking_number,
                  created_at: localOrder.created_at,
                  ageMs
                });
              } else {
                console.log('🗑️ الطلب غير موجود في الوسيط بعد التحقق النهائي، سيتم حذفه تلقائياً:', localOrder.tracking_number);
                await handleAutoDeleteOrder(localOrder.id, 'fastSync');
              }
            }
          }
        } else {
          console.warn('⚠️ فشل تحديث الطلب (fast sync):', localOrder.id, upErr);
        }
      }

      // إشعار عن الإصلاحات إذا حدثت
      if (repaired > 0) {
        console.log(`🔧 تم إصلاح ${repaired} معرف وسيط في المزامنة السريعة`);
      }

      // إشعارات ذكية مجمعة
      if (showNotifications && statusChanges.length > 0) {
        const getStatusLabel = (status) => {
          const labels = {
            'pending': 'قيد التجهيز',
            'shipped': 'تم الشحن',
            'delivery': 'قيد التوصيل',
            'delivered': 'تم التسليم',
            'cancelled': 'ملغي',
            'returned': 'مرجع',
            'completed': 'مكتمل',
            'unknown': 'غير معروف'
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
            if (t.includes('حالة ثابتة') || t.includes('ثابت')) return 'delivered'; // إضافة مُحسَّنة
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
            
            // تأكيد الاستلام المالي مع تطبيع المقارنة
            const finConfirmed = Number(waseetOrder.deliver_confirmed_fin) === 1;
            if (finConfirmed && existingOrder.receipt_received !== true) {
              updates.receipt_received = true;
              // ملاحظة: لا نُحدث status إلى completed تلقائياً - فقط عند استلام الفاتورة يدوياً
              // فقط delivery_confirmed_fin = 1 يعني "تم التسليم والمصادقة المالية" من الوسيط
              if (finConfirmed && (localStatus === 'delivered' || existingOrder.status === 'delivered')) {
                updates.status = 'completed';
              }
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
              
              // إرسال إشعار تغيير الحالة للحالات المهمة مع تحديد state_id الصحيح
              const actualStateId = waseetOrder.state_id || waseetOrder.status_id || waseetOrder.statusId;
              if (actualStateId) {
                console.log('📢 إرسال إشعار تغيير حالة:', { trackingNumber, stateId: actualStateId, statusText: waseetStatusText });
                createOrderStatusNotification(trackingNumber, actualStateId, waseetStatusText);
              } else {
                console.warn('⚠️ لا يوجد state_id للطلب:', trackingNumber, waseetOrder);
              }
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
      
      // After status sync, check for orders that need deletion (not found in remote)
      await performDeletionPassAfterStatusSync();
      
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

  // دالة مزامنة طلب محدد بالـ QR/tracking number مع تحديث فوري
  const syncOrderByQR = useCallback(async (qrId) => {
    if (!token) {
      console.warn('❌ لا يوجد توكن للمزامنة');
      return null;
    }

    try {
      console.log(`🔄 مزامنة الطلب ${qrId} مع الوسيط...`);
      
      // جلب الطلب المحلي أولاً للتحقق من شروط الحذف التلقائي
      const { data: localOrder, error: localErr } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('tracking_number', qrId)
        .maybeSingle();

      if (localErr) {
        console.error('❌ خطأ في جلب الطلب المحلي:', localErr);
        return null;
      }

      // جلب الطلب من الوسيط
      const waseetOrder = await AlWaseetAPI.getOrderByQR(token, qrId);
      if (!waseetOrder) {
        console.warn(`❌ لم يتم العثور على الطلب ${qrId} في الوسيط`);
        
        // التحقق من إمكانية الحذف التلقائي
        if (localOrder && canAutoDeleteOrder(localOrder)) {
          console.log(`🗑️ حذف تلقائي للطلب ${qrId} - محذوف من الوسيط`);
          return await performAutoDelete(localOrder);
        }
        
        return null;
      }

      console.log('📋 بيانات الطلب من الوسيط:', waseetOrder);

      // تحميل حالات الطلبات إذا لم تكن محملة
      let statusMap = orderStatusesMap;
      if (statusMap.size === 0) {
        statusMap = await loadOrderStatuses();
      }

      // تحديد الحالة المحلية الصحيحة
      const waseetStatusId = waseetOrder.status_id || waseetOrder.statusId;
      const waseetStatusText = waseetOrder.status || waseetOrder.status_text || waseetOrder.status_name || '';
      
      const correctLocalStatus = statusMap.get(String(waseetStatusId)) || 
        (() => {
          const t = String(waseetStatusText || '').toLowerCase();
          if (t.includes('تسليم') && t.includes('مصادقة')) return 'completed';
          if (t.includes('تسليم') || t.includes('مسلم')) return 'delivered';
          if (t.includes('ملغي') || t.includes('إلغاء') || t.includes('رفض')) return 'cancelled';
          if (t.includes('راجع')) return 'returned';
          if (t.includes('مندوب') || t.includes('استلام')) return 'shipped';
          if (t.includes('جاري') || t.includes('توصيل') || t.includes('في الطريق')) return 'delivery';
          return 'pending';
        })();

      if (!localOrder) {
        console.warn(`❌ لم يتم العثور على الطلب ${qrId} محلياً`);
        return null;
      }

      // تحضير التحديثات
      const updates = {
        status: correctLocalStatus,
        delivery_status: waseetStatusText,
        delivery_partner_order_id: String(waseetOrder.id),
        updated_at: new Date().toISOString()
      };

      // تحديث رسوم التوصيل
      if (waseetOrder.delivery_price) {
        const deliveryPrice = parseInt(String(waseetOrder.delivery_price)) || 0;
        if (deliveryPrice >= 0) {
          updates.delivery_fee = deliveryPrice;
        }
      }

      // تحديث حالة استلام الإيصال - فقط عند تأكيد الوسيط المالي
      if (waseetOrder.deliver_confirmed_fin === 1) {
        updates.receipt_received = true;
        // ترقية إلى completed فقط عند التأكيد المالي من الوسيط
        if (correctLocalStatus === 'delivered') {
          updates.status = 'completed';
        }
      }

      // تطبيق التحديثات
      const { error: updateErr } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', localOrder.id);

      if (updateErr) {
        console.error('❌ خطأ في تحديث الطلب:', updateErr);
        return null;
      }

      console.log(`✅ تم تحديث الطلب ${qrId}: ${localOrder.status} → ${correctLocalStatus}`);
      
      return {
        needs_update: localOrder.status !== correctLocalStatus || localOrder.delivery_status !== waseetStatusText,
        updates,
        waseet_order: waseetOrder,
        local_order: { ...localOrder, ...updates }
      };

    } catch (error) {
      console.error(`❌ خطأ في مزامنة الطلب ${qrId}:`, error);
      throw error;
    }
  }, [token, orderStatusesMap, loadOrderStatuses]);

  // دالة المزامنة الموحدة الجديدة
  const runUnifiedSync = useCallback(async (showMessages = true) => {
    if (!token) {
      if (showMessages) {
        toast({
          title: "غير متاح",
          description: "يجب تسجيل الدخول للوسيط أولاً",
          variant: "destructive"
        });
      }
      return { success: false, error: "Not logged in" };
    }

    try {
      console.log('🚀 بدء المزامنة الموحدة...');
      
      // 1. جلب طلبات التاجر من الوسيط
      const merchantOrdersResult = await getMerchantOrders();
      if (!merchantOrdersResult.success) {
        throw new Error(merchantOrdersResult.message);
      }

      const waseetOrders = merchantOrdersResult.data || [];
      console.log(`📦 تم جلب ${waseetOrders.length} طلب من الوسيط`);

      // 2. جلب الطلبات المحلية من قاعدة البيانات
      const { data: localOrders, error: localError } = await supabase
        .from('orders')
        .select('*')
        .eq('delivery_partner', 'alwaseet')
        .not('tracking_number', 'is', null);

      if (localError) {
        throw new Error(localError.message);
      }

      console.log(`💾 تم جلب ${localOrders?.length || 0} طلب محلي`);

      let updatedCount = 0;
      let deletedCount = 0;
      const deletionCandidates = [];

      // 3. مزامنة الطلبات الموجودة في كلا الطرفين
      for (const localOrder of localOrders || []) {
        try {
          // البحث عن الطلب في بيانات الوسيط
          const waseetOrder = waseetOrders.find(wo => 
            String(wo.tracking_number || wo.qr_id) === String(localOrder.tracking_number) ||
            String(wo.id) === String(localOrder.delivery_partner_order_id)
          );

          if (waseetOrder) {
            // الطلب موجود - تحديث البيانات
            const syncResult = await syncSingleOrderData(localOrder.tracking_number, waseetOrder);
            if (syncResult && syncResult.needs_update) {
              updatedCount++;
              console.log(`✅ تم تحديث الطلب: ${localOrder.tracking_number}`);
            }
          } else {
            // الطلب غير موجود في الوسيط - مرشح للحذف التلقائي
            if (canAutoDeleteOrder(localOrder)) {
              // التحقق الإضافي بـ getOrderByQR قبل الحذف
              const now = new Date();
              const orderAge = now - new Date(localOrder.created_at);
              const fiveMinutes = 5 * 60 * 1000;
              
              if (orderAge > fiveMinutes) {
                deletionCandidates.push(localOrder);
              }
            }
          }
        } catch (error) {
          console.error(`❌ خطأ في مزامنة الطلب ${localOrder.tracking_number}:`, error);
        }
      }

      // 4. التحقق النهائي من مرشحي الحذف
      for (const candidate of deletionCandidates) {
        try {
          console.log(`🔍 فحص نهائي للطلب المرشح للحذف: ${candidate.tracking_number}`);
          
          // التحقق النهائي من عدم وجود الطلب
          const finalCheck = await verifyOrderExistence(candidate.tracking_number);
          
          if (!finalCheck.exists && !finalCheck.error) {
            // الطلب غير موجود فعلاً - تنفيذ الحذف التلقائي
            const deleteResult = await performAutoDelete(candidate);
            if (deleteResult.deleted) {
              deletedCount++;
              console.log(`🗑️ تم حذف الطلب تلقائياً: ${candidate.tracking_number}`);
            }
          } else if (finalCheck.exists) {
            console.log(`⚠️ الطلب موجود في الفحص النهائي، تم إلغاء الحذف: ${candidate.tracking_number}`);
          }
        } catch (error) {
          console.error(`❌ خطأ في الفحص النهائي للطلب ${candidate.tracking_number}:`, error);
        }
      }

      // 5. إشعارات النتائج
      if (showMessages) {
        if (updatedCount > 0 || deletedCount > 0) {
          toast({
            title: "تمت المزامنة بنجاح",
            description: `تم تحديث ${updatedCount} طلب${deletedCount > 0 ? ` وحذف ${deletedCount} طلب غير موجود` : ''}`,
            variant: "default"
          });
        } else {
          toast({
            title: "المزامنة مكتملة",
            description: "جميع الطلبات محدثة",
            variant: "default"
          });
        }
      }

      console.log(`✅ المزامنة الموحدة مكتملة: ${updatedCount} محدث، ${deletedCount} محذوف`);
      
      return { 
        success: true, 
        updated: updatedCount, 
        deleted: deletedCount,
        total_checked: localOrders?.length || 0
      };

    } catch (error) {
      console.error('❌ خطأ في المزامنة الموحدة:', error);
      
      if (showMessages) {
        toast({
          title: "خطأ في المزامنة",
          description: error.message,
          variant: "destructive"
        });
      }
      
      return { success: false, error: error.message };
    }
  }, [token, getMerchantOrders, verifyOrderExistence, performAutoDelete, canAutoDeleteOrder]);

  // دالة مساعدة لمزامنة بيانات طلب واحد (بدون API call إضافي)
  const syncSingleOrderData = useCallback(async (trackingNumber, waseetOrder) => {
    try {
      // تحميل حالات الطلبات إذا لم تكن محملة
      let statusMap = orderStatusesMap;
      if (statusMap.size === 0) {
        statusMap = await loadOrderStatuses();
      }

      // تحديد الحالة المحلية الصحيحة
      const waseetStatusId = waseetOrder.status_id || waseetOrder.statusId;
      const waseetStatusText = waseetOrder.status || waseetOrder.status_text || waseetOrder.status_name || '';
      
      const correctLocalStatus = statusMap.get(String(waseetStatusId)) || 
        (() => {
          const t = String(waseetStatusText || '').toLowerCase();
          if (t.includes('تسليم') && t.includes('مصادقة')) return 'completed';
          if (t.includes('تسليم') || t.includes('مسلم')) return 'delivered';
          if (t.includes('ملغي') || t.includes('إلغاء') || t.includes('رفض')) return 'cancelled';
          if (t.includes('راجع')) return 'returned';
          if (t.includes('مندوب') || t.includes('استلام')) return 'shipped';
          if (t.includes('جاري') || t.includes('توصيل') || t.includes('في الطريق')) return 'delivery';
          return 'pending';
        })();

      // البحث عن الطلب المحلي
      const { data: localOrder } = await supabase
        .from('orders')
        .select('*')
        .eq('tracking_number', trackingNumber)
        .single();

      if (!localOrder) {
        return null;
      }

      // تحضير التحديثات
      const updates = {
        status: correctLocalStatus,
        delivery_status: waseetStatusText,
        delivery_partner_order_id: String(waseetOrder.id),
        updated_at: new Date().toISOString()
      };

      // تحديث رسوم التوصيل
      if (waseetOrder.delivery_price) {
        const deliveryPrice = parseInt(String(waseetOrder.delivery_price)) || 0;
        if (deliveryPrice >= 0) {
          updates.delivery_fee = deliveryPrice;
        }
      }

      // تحديث حالة استلام الإيصال - فقط عند تأكيد الوسيط المالي
      if (waseetOrder.deliver_confirmed_fin === 1) {
        updates.receipt_received = true;
        // ترقية إلى completed فقط عند التأكيد المالي من الوسيط
        if (correctLocalStatus === 'delivered') {
          updates.status = 'completed';
        }
      }

      // التحقق من الحاجة للتحديث
      const needs_update = localOrder.status !== correctLocalStatus || 
                          localOrder.delivery_status !== waseetStatusText ||
                          !localOrder.delivery_partner_order_id ||
                          (waseetOrder.delivery_price && localOrder.delivery_fee !== parseInt(waseetOrder.delivery_price)) ||
                          (waseetOrder.deliver_confirmed_fin === 1 && !localOrder.receipt_received);

      if (needs_update) {
        // تطبيق التحديثات
        const { error: updateErr } = await supabase
          .from('orders')
          .update(updates)
          .eq('id', localOrder.id);

        if (updateErr) {
          console.error('❌ خطأ في تحديث الطلب:', updateErr);
          return null;
        }
      }

      return {
        needs_update,
        updates,
        waseet_order: waseetOrder,
        local_order: { ...localOrder, ...updates }
      };

    } catch (error) {
      console.error(`❌ خطأ في مزامنة بيانات الطلب ${trackingNumber}:`, error);
      return null;
    }
  }, [orderStatusesMap, loadOrderStatuses]);

  // Helper: التحقق أن الطلب قبل استلام المندوب (AlWaseet)
  const isPrePickupForWaseet = (order) => {
    if (!order) return false;
    if (order.delivery_partner !== 'alwaseet') return false;

    const deliveryText = String(order.delivery_status || '').toLowerCase().trim();
    if (!deliveryText) return false;
    const prePickupKeywords = [
      'فعال','active',
      'في انتظار استلام المندوب','waiting for pickup','pending pickup',
      'جديد','new',
      'معطل','غير فعال','disabled','inactive'
    ];
    return prePickupKeywords.some(s => deliveryText.includes(s.toLowerCase()));
  };

  const canAutoDeleteOrder = (order) => {
    return order?.delivery_partner === 'alwaseet' &&
           order?.receipt_received !== true &&
           String(order?.status || '').toLowerCase().trim() === 'pending' &&
           (!!order?.tracking_number || !!order?.delivery_partner_order_id);
  };

    try {
      // تحميل حالات الطلبات إذا لم تكن محملة
      let statusMap = orderStatusesMap;
      if (statusMap.size === 0) {
        statusMap = await loadOrderStatuses();
      }

      // تحديد الحالة المحلية الصحيحة
      const waseetStatusId = waseetOrder.status_id || waseetOrder.statusId;
      const waseetStatusText = waseetOrder.status || waseetOrder.status_text || waseetOrder.status_name || '';
      
      const correctLocalStatus = statusMap.get(String(waseetStatusId)) || 
        (() => {
          const t = String(waseetStatusText || '').toLowerCase();
          if (t.includes('تسليم') && t.includes('مصادقة')) return 'completed';
          if (t.includes('تسليم') || t.includes('مسلم')) return 'delivered';
          if (t.includes('ملغي') || t.includes('إلغاء') || t.includes('رفض')) return 'cancelled';
          if (t.includes('راجع')) return 'returned';
          if (t.includes('مندوب') || t.includes('استلام')) return 'shipped';
          if (t.includes('جاري') || t.includes('توصيل') || t.includes('في الطريق')) return 'delivery';
          return 'pending';
        })();

      // البحث عن الطلب المحلي
      const { data: localOrder } = await supabase
        .from('orders')
        .select('*')
        .eq('tracking_number', trackingNumber)
        .single();

      if (!localOrder) {
        return null;
      }

      // تحضير التحديثات
      const updates = {
        status: correctLocalStatus,
        delivery_status: waseetStatusText,
        delivery_partner_order_id: String(waseetOrder.id),
        updated_at: new Date().toISOString()
      };

      // تحديث رسوم التوصيل
      if (waseetOrder.delivery_price) {
        const deliveryPrice = parseInt(String(waseetOrder.delivery_price)) || 0;
        if (deliveryPrice >= 0) {
          updates.delivery_fee = deliveryPrice;
        }
      }

      // تحديث حالة استلام الإيصال - فقط عند تأكيد الوسيط المالي
      if (waseetOrder.deliver_confirmed_fin === 1) {
        updates.receipt_received = true;
        // ترقية إلى completed فقط عند التأكيد المالي من الوسيط
        if (correctLocalStatus === 'delivered') {
          updates.status = 'completed';
        }
      }

      // التحقق من الحاجة للتحديث
      const needs_update = localOrder.status !== correctLocalStatus || 
                          localOrder.delivery_status !== waseetStatusText ||
                          !localOrder.delivery_partner_order_id ||
                          (waseetOrder.delivery_price && localOrder.delivery_fee !== parseInt(waseetOrder.delivery_price)) ||
                          (waseetOrder.deliver_confirmed_fin === 1 && !localOrder.receipt_received);

      if (needs_update) {
        // تطبيق التحديثات
        const { error: updateErr } = await supabase
          .from('orders')
          .update(updates)
          .eq('id', localOrder.id);

        if (updateErr) {
          console.error('❌ خطأ في تحديث الطلب:', updateErr);
          return null;
        }
      }

      return {
        needs_update,
        updates,
        waseet_order: waseetOrder,
        local_order: { ...localOrder, ...updates }
      };

    } catch (error) {
      console.error(`❌ خطأ في مزامنة بيانات الطلب ${trackingNumber}:`, error);
      return null;
    }
  }, [orderStatusesMap, loadOrderStatuses]);

  // دالة الحذف الفردي
  const performAutoDelete = async (order) => {
    try {
      console.log(`🗑️ بدء الحذف التلقائي للطلب ${order.id}`);
      
      // تحرير المخزون المحجوز
      if (order.order_items && order.order_items.length > 0) {
        for (const item of order.order_items) {
          try {
            await supabase.rpc('release_stock_item', {
              p_product_id: item.product_id,
              p_variant_id: item.variant_id,
              p_quantity: item.quantity
            });
            console.log(`✅ تم تحرير ${item.quantity} من المنتج ${item.product_id}`);
          } catch (releaseErr) {
            console.warn(`⚠️ فشل في تحرير المخزون للعنصر:`, releaseErr);
          }
        }
      }

      // حذف الطلب من قاعدة البيانات
      const { error: deleteErr } = await supabase
        .from('orders')
        .delete()
        .eq('id', order.id);

      if (deleteErr) {
        console.error('❌ فشل في حذف الطلب:', deleteErr);
        return { success: false, error: deleteErr };
      }

      console.log(`✅ تم حذف الطلب ${order.id} تلقائياً`);
      
      return { 
        success: true, 
        autoDeleted: true,
        message: `تم حذف الطلب ${order.tracking_number} تلقائياً لأنه محذوف من شركة التوصيل`
      };
      
    } catch (error) {
      console.error('❌ خطأ في الحذف التلقائي:', error);
      return { success: false, error };
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
      
      // جلب جميع طلبات الوسيط والبحث عن الطلب المطلوب (تطبيع المقارنة لتجنب اختلاف النوع/المسافات)
      const waseetOrders = await AlWaseetAPI.getMerchantOrders(token);
      const norm = (v) => String(v ?? '').trim();
      const tn = norm(trackingNumber);
      let waseetOrder = waseetOrders.find(order => (
        norm(order.qr_id) === tn || norm(order.tracking_number) === tn
      ));
      
      // Fallback سريع باستخدام خرائط مطبّعة
      if (!waseetOrder) {
        const byQrId = new Map();
        const byTracking = new Map();
        for (const o of waseetOrders) {
          if (o?.qr_id) byQrId.set(norm(o.qr_id), o);
          if (o?.tracking_number) byTracking.set(norm(o.tracking_number), o);
        }
        waseetOrder = byQrId.get(tn) || byTracking.get(tn) || null;
      }
      
      if (!waseetOrder) {
        console.log(`❌ لم يتم العثور على الطلب ${trackingNumber} في الوسيط`);
        
        // التحقق من إمكانية الحذف التلقائي
        const { data: localOrder, error: localErr } = await supabase
          .from('orders')
          .select('*, order_items(*)')
          .eq('tracking_number', trackingNumber)
          .maybeSingle();

        if (!localErr && localOrder && canAutoDeleteOrder(localOrder)) {
          console.log(`🗑️ حذف تلقائي للطلب ${trackingNumber} - محذوف من الوسيط`);
          return await performAutoDelete(localOrder);
        }
        
        return null;
      }
      
      const waseetStatusText = waseetOrder.status_text || waseetOrder.status_name || waseetOrder.status || '';
      const waseetStatusId = waseetOrder.status_id || waseetOrder.status;
      // Enhanced Arabic status mapping focusing on qr_id tracking
      const localStatus =
        statusMap.get(String(waseetStatusId)) ||
        (() => {
          const t = String(waseetStatusText).toLowerCase();
          if (t.includes('تسليم') && t.includes('مصادقة')) return 'completed';
          if (t.includes('تسليم') || t.includes('مسلم') || t.includes('سُلم') || t.includes('مستلم')) return 'delivered';
          if (t.includes('ملغي') || t.includes('إلغاء') || t.includes('مرفوض') || t.includes('فاشل')) return 'cancelled';
          if (t.includes('راجع') || t.includes('مرتجع')) return 'returned';
          if (t.includes('مندوب') || t.includes('استلام') || t.includes('في الطريق')) return 'shipped';
          if (t.includes('جاري') || t.includes('توصيل') || t.includes('قيد التوصيل')) return 'delivery';
          if (t.includes('فعال') || t.includes('نشط') || t.includes('قيد المعالجة')) return 'pending';
          if (t.includes('جديد') || t.includes('تم الاستلام')) return 'pending';
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
      // تأكيد الاستلام المالي مع تطبيع المقارنة وترقية الحالة
      const finConfirmed = Number(waseetOrder.deliver_confirmed_fin) === 1;
      if (finConfirmed && existingOrder?.receipt_received !== true) {
        updates.receipt_received = true;
        // ترقية للحالة المكتملة فقط عند التأكيد المالي من الوسيط
        if (localStatus === 'delivered' || existingOrder?.status === 'delivered') {
          updates.status = 'completed';
        }
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

  // دالة للتحقق من وجود الطلب في الوسيط
  const verifyOrderExistence = useCallback(async (trackingNumber) => {
    if (!token || !trackingNumber) {
      return { exists: false, error: 'معطيات ناقصة' };
    }

    try {
      console.log(`🔍 فحص وجود الطلب ${trackingNumber} في الوسيط...`);
      
      const order = await AlWaseetAPI.getOrderByQR(token, trackingNumber);
      
      if (order) {
        console.log(`✅ الطلب ${trackingNumber} موجود في الوسيط:`, order);
        return { 
          exists: true, 
          order,
          deliveryPartnerId: String(order.id),
          statusId: order.status_id || order.statusId,
          statusText: order.status || order.status_text
        };
      } else {
        console.log(`❌ الطلب ${trackingNumber} غير موجود في الوسيط`);
        return { exists: false };
      }
    } catch (error) {
      console.error(`💥 خطأ في فحص الطلب ${trackingNumber}:`, error);
      return { exists: false, error: error.message };
    }
  }, [token]);

  // دالة لحذف الطلب المحلي إذا لم يعد موجوداً في الوسيط
  const autoDeleteMissingOrder = useCallback(async (localOrder) => {
    if (!localOrder || localOrder.status !== 'pending' || localOrder.receipt_received) {
      return { deleted: false, reason: 'الطلب لا يلبي شروط الحذف التلقائي' };
    }

    try {
      console.log(`🗑️ حذف تلقائي للطلب المفقود:`, localOrder.order_number);
      
      // حذف الطلب من قاعدة البيانات
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', localOrder.id);

      if (error) {
        console.error('❌ خطأ في حذف الطلب:', error);
        return { deleted: false, error: error.message };
      }

      // إشعار نجاح الحذف
      toast({
        title: "تم حذف الطلب تلقائياً",
        description: `الطلب ${localOrder.order_number} لم يعد موجوداً في شركة التوصيل`,
        variant: "default"
      });

      // إرسال إشعار للنظام
      if (createNotification) {
        createNotification({
          title: 'حذف طلب تلقائي',
          message: `تم حذف الطلب ${localOrder.order_number} لعدم وجوده في شركة التوصيل`,
          type: 'auto_deletion',
          priority: 'medium',
          data: {
            order_id: localOrder.id,
            order_number: localOrder.order_number,
            tracking_number: localOrder.tracking_number,
            reason: 'missing_from_delivery_partner'
          }
        });
      }

      console.log(`✅ تم حذف الطلب ${localOrder.order_number} تلقائياً`);
      return { deleted: true };

    } catch (error) {
      console.error('💥 خطأ في الحذف التلقائي:', error);
      return { deleted: false, error: error.message };
    }
  }, [createNotification]);

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

  // Perform sync with countdown - can be triggered manually even if autoSync is disabled
  const performSyncWithCountdown = useCallback(async () => {
    if (activePartner === 'local' || !isLoggedIn || isSyncing) return;

    // Start countdown mode WITHOUT setting isSyncing to true yet
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
        // NOW set syncing to true when actual sync starts
        setIsSyncing(true);
        setSyncMode('syncing');
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

  // Initial sync on login - respects autoSyncEnabled setting  
  useEffect(() => {
    if (isLoggedIn && activePartner === 'alwaseet' && syncMode === 'standby' && !lastSyncAt && autoSyncEnabled) {
      console.log('🚀 مزامنة أولية عند تسجيل الدخول...');
      performSyncWithCountdown();
    }
  }, [isLoggedIn, activePartner, syncMode, lastSyncAt, autoSyncEnabled, performSyncWithCountdown]);

  // Periodic sync every 10 minutes - respects autoSyncEnabled setting
  useEffect(() => {
    let intervalId;
    if (isLoggedIn && activePartner === 'alwaseet' && syncMode === 'standby' && autoSyncEnabled) {
      intervalId = setInterval(() => {
        if (!isSyncing) {
          console.log('⏰ مزامنة دورية تلقائية (كل 10 دقائق)...');
          performSyncWithCountdown();
        }
      }, syncInterval);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isLoggedIn, activePartner, syncMode, isSyncing, syncInterval, autoSyncEnabled, performSyncWithCountdown]);

  // Silent repair function for problematic orders
  const silentOrderRepair = useCallback(async () => {
    if (!token || correctionComplete) return;
    
    try {
      console.log('🔧 بدء الإصلاح الصامت للطلبات المشكوك فيها...');
      
      // اجلب الطلبات المشكوك فيها (pending/delivered/returned من آخر 30 يوم)
      const { data: problematicOrders, error } = await supabase
        .from('orders')
        .select('id, status, tracking_number, delivery_partner_order_id, qr_id, receipt_received')
        .eq('delivery_partner', 'alwaseet')
        .in('status', ['pending', 'delivered', 'returned'])
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .limit(100);
      
      if (error || !problematicOrders?.length) return;
      
      // اجلب جميع طلبات الوسيط لعمل المطابقة
      const waseetOrders = await AlWaseetAPI.getMerchantOrders(token);
      
      // بناء خرائط للبحث السريع
      const byWaseetId = new Map();
      const byQrId = new Map();
      const byTracking = new Map();
      
      for (const wo of waseetOrders) {
        if (wo.id) byWaseetId.set(String(wo.id), wo);
        if (wo.qr_id) byQrId.set(String(wo.qr_id).trim(), wo);
        if (wo.tracking_number) byTracking.set(String(wo.tracking_number).trim(), wo);
      }
      
      let repaired = 0;
      
      for (const localOrder of problematicOrders) {
        let waseetOrder = null;
        let needsRepair = false;
        
        // البحث عن الطلب في الوسيط
        if (localOrder.delivery_partner_order_id) {
          waseetOrder = byWaseetId.get(String(localOrder.delivery_partner_order_id));
        }
        
        if (!waseetOrder) {
          const tn = String(localOrder.tracking_number || localOrder.qr_id || '').trim();
          if (tn) {
            waseetOrder = byQrId.get(tn) || byTracking.get(tn);
            needsRepair = true; // نحتاج لإصلاح المعرف
          }
        }
        
        if (!waseetOrder) continue;
        
        const updates = { updated_at: new Date().toISOString() };
        
        // إصلاح معرف الوسيط
        if (needsRepair && waseetOrder.id) {
          updates.delivery_partner_order_id = String(waseetOrder.id);
        }
        
        // إصلاح الحالة بناءً على deliver_confirmed_fin
        const finConfirmed = Number(waseetOrder.deliver_confirmed_fin) === 1;
        if (finConfirmed) {
          updates.receipt_received = true;
          if (localOrder.status === 'delivered') {
            updates.status = 'completed';
          }
        }
        
        // تطبيق الإصلاحات إذا لزم الأمر
        if (Object.keys(updates).length > 1) {
          await supabase
            .from('orders')
            .update(updates)
            .eq('id', localOrder.id);
          repaired++;
        }
      }
      
      if (repaired > 0) {
        console.log(`🔧 تم إصلاح ${repaired} طلب صامتاً`);
      }
      
    } catch (error) {
      console.error('❌ خطأ في الإصلاح الصامت:', error);
    }
  }, [token, correctionComplete]);

  // دالة للتحقق من الطلبات المحذوفة بعد مزامنة الحالات
  const performDeletionPassAfterStatusSync = useCallback(async () => {
    if (!token) return;
    
    try {
      console.log('🔍 فحص الطلبات للحذف التلقائي بعد مزامنة الحالات...');
      
      // جلب الطلبات المحلية المرشحة للحذف (delivery_partner = alwaseet, has delivery_partner_order_id, pre-pickup status)
      const { data: localOrders, error } = await supabase
        .from('orders')
        .select('id, tracking_number, qr_id, delivery_partner_order_id, delivery_status, status, receipt_received, created_at')
        .eq('delivery_partner', 'alwaseet')
        .eq('receipt_received', false)
        .eq('status', 'pending')
        .limit(50);
        
      if (error || !localOrders?.length) return;
      
      // جلب جميع طلبات الوسيط للمقارنة
      const waseetOrders = await AlWaseetAPI.getMerchantOrders(token);
      const waseetOrderIds = new Set(waseetOrders.map(o => String(o.id)));
      
      let deletedCount = 0;
      
      for (const localOrder of localOrders) {
        // يجب أن يحتوي على tracking أو qr لاختبار الوجود
        const confirmKey = String(localOrder.tracking_number || localOrder.qr_id || '').trim();
        if (!confirmKey) continue;
        
        // التحقق من إمكانية الحذف التلقائي وفق الشروط المحلية
        if (!canAutoDeleteOrder(localOrder)) continue;
        
        // مهلة أمان 5 دقائق
        const createdAt = new Date(localOrder.created_at);
        const ageMs = Date.now() - (createdAt?.getTime?.() || 0);
        const fiveMinutes = 5 * 60 * 1000;
        if (!createdAt || !Number.isFinite(createdAt.getTime()) || ageMs < fiveMinutes) {
          console.log('⏳ تخطي الحذف (deletionPass): الطلب أحدث من 5 دقائق أو تاريخ غير صالح', {
            orderId: localOrder.id,
            tracking: localOrder.tracking_number,
            created_at: localOrder.created_at,
            ageMs
          });
          continue;
        }
        
        // تحقق نهائي مباشر من الوسيط باستخدام QR/Tracking
        let remoteCheck = null;
        try {
          remoteCheck = await AlWaseetAPI.getOrderByQR(token, confirmKey);
        } catch (e) {
          console.warn('⚠️ فشل التحقق النهائي من الوسيط قبل الحذف (deletion pass):', e);
          continue; // لا نحذف عند وجود خطأ API
        }
        
        if (!remoteCheck) {
          console.log('🗑️ حذف تلقائي للطلب بعد مزامنة الحالات:', localOrder.tracking_number);
          await handleAutoDeleteOrder(localOrder.id, 'deletionPass');
          deletedCount++;
        }
      }
      
      if (deletedCount > 0) {
        console.log(`🗑️ تم حذف ${deletedCount} طلب تلقائياً بعد مزامنة الحالات`);
      }
    } catch (error) {
      console.error('❌ خطأ في فحص الطلبات للحذف:', error);
    }
  }, [token, canAutoDeleteOrder, handleAutoDeleteOrder]);

  // Auto-sync and repair on login
  useEffect(() => {
    if (!isLoggedIn || !token || activePartner === 'local') return;

    // تشغيل الإصلاح الصامت والتصحيح الشامل
    const runInitialTasks = async () => {
      try {
        // الإصلاح الصامت أولاً
        await silentOrderRepair();
        
        // ثم التصحيح الشامل إذا لم يكن مكتملاً
        if (!correctionComplete) {
          console.log('🛠️ تنفيذ التصحيح الأولي للطلبات...');
          const correctionResult = await comprehensiveOrderCorrection();
          console.log('✅ نتيجة التصحيح الأولي:', correctionResult);
        }

        // المزامنة الأولية ستحدث تلقائياً عبر useEffect المخصص لذلك
        console.log('✅ تم الانتهاء من المهام الأولية');
      } catch (error) {
        console.error('❌ خطأ في المهام الأولية:', error);
      }
    };

    // Run initial tasks after 3 seconds
    const initialTimeout = setTimeout(runInitialTasks, 3000);

    return () => {
      if (initialTimeout) clearTimeout(initialTimeout);
    };
  }, [isLoggedIn, token, activePartner, correctionComplete, comprehensiveOrderCorrection, silentOrderRepair]);

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
    syncOrderByQR,
    orderStatusesMap,

    // Unified sync function
    runUnifiedSync,
    
    // New exports:
    fastSyncPendingOrders,
    linkRemoteIdsForExistingOrders,
    comprehensiveOrderCorrection,
    performDeletionPassAfterStatusSync,
    
    // Order verification functions
    verifyOrderExistence,
    autoDeleteMissingOrder,
    
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
