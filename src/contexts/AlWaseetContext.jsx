import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { toast } from '@/components/ui/use-toast';
import { useLocalStorage } from '@/hooks/useLocalStorage.jsx';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './UnifiedAuthContext';
import { useNotificationsSystem } from './NotificationsSystemContext';
import * as AlWaseetAPI from '@/lib/alwaseet-api';
import { getStatusConfig } from '@/lib/alwaseet-statuses';
import { useUnifiedUserData } from '@/hooks/useUnifiedUserData';
import { verifyOrderOwnership, createSecureOrderFilter, logSecurityWarning } from '@/utils/alwaseetSecurityUtils';
import { displaySecuritySummary } from '@/utils/securityLogger';

const AlWaseetContext = createContext();

export const useAlWaseet = () => useContext(AlWaseetContext);

export const AlWaseetProvider = ({ children }) => {
  const { user } = useAuth();
  
  // نظام البيانات الموحد للتأكد من الأمان وفصل الحسابات
  const { userUUID, getOrdersQuery, canViewData } = useUnifiedUserData();
  
  // إنشاء فلتر أمان إضافي لطلبات الوسيط
  const secureOrderFilter = createSecureOrderFilter(user);
  
  // تسجيل نجاح تطبيق نظام الأمان (مرة واحدة فقط)
  React.useEffect(() => {
    if (user && userUUID) {
      displaySecuritySummary();
    }
  }, [user, userUUID]);
  
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
  const [activePartner, setActivePartner] = useLocalStorage('active_delivery_partner', 'local');
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

  // دالة معطلة مؤقتاً - الإشعارات تأتي الآن من database trigger فقط
  const createOrderStatusNotification = useCallback(async (trackingNumber, stateId, statusText) => {
    // تم تعطيل هذه الدالة لمنع الإشعارات المكررة
    // Database trigger notify_alwaseet_status_change() يتولى إرسال الإشعارات الآن
    console.log('🔕 تم إلغاء إرسال الإشعار من العميل - التريغر يتولى الأمر:', { trackingNumber, stateId, statusText });
    return;
    
    // منع التكرار الذكي - فقط عند تغيير الحالة فعلياً
    const trackingKey = `${trackingNumber}`;
    const lastStateId = lastNotificationStatus[trackingKey];
    
    // إذا كانت نفس الحالة، لا ترسل إشعار
    if (lastStateId === String(stateId)) {
      console.log('🔄 منع تكرار - نفس الحالة:', { trackingNumber, stateId, lastStateId });
      return;
    }
    
    const statusConfig = getStatusConfig(Number(stateId));
    
    // تحسين النص حسب state_id مع استخدام النص الصحيح من alwaseet-statuses
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
      case '13':
        message = `${trackingNumber} في مخزن مرتجع بغداد`;
        priority = 'medium';
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
    
    console.log('✅ تحديث إشعار الوسيط:', {
      trackingNumber, 
      stateId, 
      message, 
      priority 
    });
    
    // البحث عن الإشعار الموجود وتحديثه أو إنشاء جديد
    try {
      // البحث المحسن عن الإشعار الموجود باستخدام عدة معايير
      const { data: existingNotifications, error: searchError } = await supabase
        .from('notifications')
        .select('id')
        .eq('type', 'order_status_update')
        .or(`data->>'order_number'.eq.${trackingNumber},data->>'tracking_number'.eq.${trackingNumber},message.like.%${trackingNumber}%`)
        .limit(1);
        
      if (searchError) {
        console.error('❌ خطأ في البحث عن الإشعار الموجود:', searchError);
      }
      
      const notificationData = {
        state_id: String(stateId),
        tracking_number: trackingNumber,
        status_text: statusConfig.text || statusText,
        timestamp: new Date().toISOString(),
        order_id: trackingNumber,
        order_number: trackingNumber
      };
      
      if (existingNotifications && existingNotifications.length > 0) {
        // تحديث الإشعار الموجود مع تحديث created_at ليظهر كإشعار جديد
        const { error: updateError } = await supabase
          .from('notifications')
          .update({
            message: message,
            data: notificationData,
            is_read: false,
            created_at: new Date().toISOString(), // تحديث وقت الإنشاء ليصبح الإشعار في المقدمة
            updated_at: new Date().toISOString()
          })
          .eq('id', existingNotifications[0].id);
          
        if (updateError) {
          console.error('❌ خطأ في تحديث الإشعار:', updateError);
        } else {
          console.log('🔄 تم تحديث الإشعار الموجود بنجاح');
        }
      } else {
        // إنشاء إشعار جديد
        const newNotificationData = {
          type: 'order_status_update',
          title: 'تحديث حالة الطلب',
          message: message,
          priority: priority,
          data: notificationData
        };
        
        console.log('📤 بيانات الإشعار الجديدة:', newNotificationData);
        await createNotification(newNotificationData);
        console.log('🆕 تم إنشاء إشعار جديد');
      }
      
      // تحديث آخر حالة مرسلة
      setLastNotificationStatus(prev => ({
        ...prev,
        [trackingKey]: String(stateId)
      }));
      
      console.log('🎯 تم تحديث إشعار الوسيط بنجاح');
      
    } catch (error) {
      console.error('❌ خطأ في معالجة إشعار الوسيط:', error);
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
        setActivePartner('alwaseet');
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
    setActivePartner('local');
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
      
      // 2) جلب جميع الطلبات المحلية للوسيط مع تأمين فصل الحسابات
      const userFilter = getOrdersQuery(); // فلتر آمن حسب المستخدم
      const { data: localOrders, error: localErr } = await supabase
        .from('orders')
        .select('id, tracking_number, delivery_partner_order_id, status, delivery_status')
        .eq('delivery_partner', 'alwaseet')
        .match(userFilter) // 🔒 تأمين: فقط طلبات المستخدم الحالي
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
      // 1) اجلب طلباتنا التي لا تملك delivery_partner_order_id مع تأمين فصل الحسابات  
      const userFilter = getOrdersQuery(); // فلتر آمن حسب المستخدم
      const { data: localOrders, error: localErr } = await supabase
        .from('orders')
        .select('id, tracking_number')
        .eq('delivery_partner', 'alwaseet')
        .is('delivery_partner_order_id', null)
        .match(userFilter) // 🔒 تأمين: فقط طلبات المستخدم الحالي
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
      
      // 1. جلب تفاصيل الطلب قبل الحذف مع التحقق من الملكية
      const userFilter = getOrdersQuery(); // فلتر آمن حسب المستخدم
      const { data: orderToDelete, error: fetchError } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', orderId)
        .match(userFilter) // 🔒 تأمين: التحقق من ملكية الطلب قبل الحذف
        .single();
        
      if (fetchError || !orderToDelete) {
        console.error('❌ فشل في جلب الطلب للحذف:', fetchError);
        return false;
      }
      
      // 🔒 تأمين نهائي: التحقق من ملكية الطلب قبل الحذف الفعلي
      if (!verifyOrderOwnership(orderToDelete, user)) {
        logSecurityWarning('final_delete_attempt', orderId, user);
        console.error('🚫 منع الحذف: الطلب غير مملوك للمستخدم الحالي');
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
      // Auto-sync invoices first
      try {
        const { data: invoiceSyncRes, error: invoiceSyncErr } = await supabase.rpc('sync_recent_received_invoices');
        if (invoiceSyncRes?.updated_orders_count > 0) {
          console.log(`✅ مزامنة الفواتير: تم تحديث ${invoiceSyncRes.updated_orders_count} طلب`);
        }
      } catch (invoiceError) {
        console.warn('⚠️ خطأ في مزامنة الفواتير:', invoiceError);
      }
      
      // تأكد من تحميل خريطة الحالات
      let statusMap = orderStatusesMap;
      if (statusMap.size === 0) {
        statusMap = await loadOrderStatuses();
      }

      // 1) اجلب الطلبات المعلقة لدينا مع تأمين فصل الحسابات
      const targetStatuses = ['pending', 'delivery', 'shipped', 'returned'];
      const userFilter = getOrdersQuery(); // فلتر آمن حسب المستخدم
      const { data: pendingOrders, error: pendingErr } = await supabase
        .from('orders')
        .select('id, status, delivery_status, delivery_partner, delivery_partner_order_id, order_number, qr_id, tracking_number, receipt_received')
        .eq('delivery_partner', 'alwaseet')
        .in('status', targetStatuses)
        .match(userFilter) // 🔒 تأمين: فقط طلبات المستخدم الحالي
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
          // تحقق نهائي مباشر من الوسيط باستخدام QR/Tracking
          const confirmKey = String(localOrder.tracking_number || localOrder.qr_id || '').trim();
          let remoteCheck = null;
          if (confirmKey) {
            try {
              remoteCheck = await AlWaseetAPI.getOrderByQR(token, confirmKey);
            } catch (e) {
              console.warn('⚠️ فشل التحقق النهائي من الوسيط قبل الحذف:', e);
            }
          }
          if (!remoteCheck) {
            console.log('🗑️ الطلب غير موجود في الوسيط بعد التحقق النهائي، سيتم حذفه تلقائياً:', localOrder.tracking_number);
            await handleAutoDeleteOrder(localOrder.id, 'fastSync');
            continue;
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
              console.log('🗑️ الطلب غير موجود في الوسيط بعد التحقق النهائي، سيتم حذفه تلقائياً:', localOrder.tracking_number);
              await handleAutoDeleteOrder(localOrder.id, 'fastSync');
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

      // Final invoice sync after order updates
      try {
        const { data: finalInvoiceSyncRes } = await supabase.rpc('sync_recent_received_invoices');
        if (finalInvoiceSyncRes?.updated_orders_count > 0) {
          console.log(`✅ مزامنة فواتير نهائية: تم تحديث ${finalInvoiceSyncRes.updated_orders_count} طلب إضافي`);
        }
      } catch (finalInvoiceError) {
        console.warn('⚠️ خطأ في المزامنة النهائية للفواتير:', finalInvoiceError);
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
        
        // التحقق من إمكانية الحذف التلقائي مع حماية مضاعفة
        if (localOrder && canAutoDeleteOrder(localOrder)) {
          console.log(`⚠️ التحقق من حذف الطلب ${qrId} - لم يُعثر عليه في الوسيط`);
          
          // إعادة محاولة البحث للتأكد (قد يكون هناك تأخير في التزامن)
          await new Promise(resolve => setTimeout(resolve, 2000)); // انتظار ثانيتين
          const doubleCheckOrder = await AlWaseetAPI.getOrderByQR(token, qrId);
          
          if (!doubleCheckOrder) {
            console.log(`🗑️ تأكيد الحذف التلقائي للطلب ${qrId} - غير موجود فعلياً في الوسيط`);
            const deleteResult = await performAutoDelete(localOrder);
            if (deleteResult) {
              return { 
                ...deleteResult, 
                autoDeleted: true,
                message: `تم حذف الطلب ${qrId} تلقائياً - مؤكد عدم وجوده في شركة التوصيل`
              };
            }
          } else {
            console.log(`✅ الطلب ${qrId} موجود فعلياً - لن يُحذف`);
            // معالجة الطلب الموجود
            return await processWaseetOrderUpdate(localOrder, doubleCheckOrder);
          }
        } else {
          console.log(`🔒 الطلب ${qrId} محمي من الحذف التلقائي`);
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

  // دالة للتحقق من إمكانية الحذف التلقائي (محسّنة ومحمية)
  const canAutoDeleteOrder = (order) => {
    if (!order?.delivery_partner === 'alwaseet' || order?.receipt_received === true) {
      return false;
    }
    
    // 🔒 تأمين متقدم: التحقق من ملكية الطلب قبل السماح بالحذف
    if (!verifyOrderOwnership(order, user)) {
      logSecurityWarning('auto_delete_attempt', order?.id, user);
      console.warn('🚫 منع حذف طلب غير مملوك للمستخدم الحالي:', order?.id);
      return false;
    }
    
    // 🔒 تأمين: التحقق من ملكية الطلب قبل السماح بالحذف
    if (!canViewData(order?.created_by)) {
      console.warn('🚫 منع حذف طلب غير مملوك للمستخدم الحالي:', order?.id);
      return false;
    }
    
    // التحقق من وجود رقم تتبع
    if (!order?.tracking_number && !order?.qr_id) {
      return false;
    }
    
    // حماية زمنية: عدم حذف الطلبات الجديدة (أقل من 15 دقيقة)
    const orderAge = Date.now() - new Date(order.created_at).getTime();
    const minAgeForDeletion = 15 * 60 * 1000; // 15 دقيقة
    if (orderAge < minAgeForDeletion) {
      console.log(`⏰ الطلب ${order.order_number} جديد جداً (${Math.round(orderAge/60000)} دقيقة) - لن يُحذف`);
      return false;
    }
    
    // حماية حالة الطلب: فقط الطلبات في حالات معينة
    const safeStatusesForDeletion = ['pending', 'shipped', 'delivery'];
    if (!safeStatusesForDeletion.includes(order.status)) {
      console.log(`🔒 الطلب ${order.order_number} في حالة ${order.status} - لن يُحذف`);
      return false;
    }
    
    return true;
  };

  // دالة محسنة للحذف التلقائي مع تحقق متعدد
  const performAutoCleanup = async () => {
    try {
      const ordersToCheck = orders.filter(shouldDeleteOrder);
      
      if (ordersToCheck.length === 0) return;

      console.log(`🔍 فحص ${ordersToCheck.length} طلب للحذف التلقائي...`);

      for (const order of ordersToCheck) {
        let verificationAttempts = 0;
        let orderExists = false;
        const maxAttempts = 3;

        // محاولات متعددة للتحقق
        while (verificationAttempts < maxAttempts && !orderExists) {
          try {
            verificationAttempts++;
            console.log(`🔄 محاولة ${verificationAttempts}/${maxAttempts} للطلب: ${order.tracking_number}`);

            const response = await fetch('/api/alwaseet/check-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ trackingNumber: order.tracking_number })
            });

            if (response.ok) {
              const result = await response.json();
              
              if (result.exists && result.status !== 'not_found') {
                orderExists = true;
                console.log(`✅ الطلب موجود في الوسيط (محاولة ${verificationAttempts}): ${order.tracking_number}`);
                break;
              }
            }

            // انتظار بين المحاولات
            if (verificationAttempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          } catch (error) {
            console.error(`❌ خطأ في المحاولة ${verificationAttempts} للطلب ${order.tracking_number}:`, error);
          }
        }

        // إذا لم يوجد الطلب بعد كل المحاولات، احذفه
        if (!orderExists) {
          console.log(`🗑️ حذف الطلب غير الموجود بعد ${maxAttempts} محاولات: ${order.tracking_number}`);
          
          // إشعار المدير
          showToast({
            title: "تنبيه: حذف طلب تلقائي",
            description: `تم حذف الطلب ${order.tracking_number} لعدم وجوده في شركة التوصيل`,
            variant: "destructive"
          });

          await performAutoDelete(order);
        }
      }
    } catch (error) {
      console.error('❌ خطأ في الحذف التلقائي:', error);
    }
  };

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
        
        // التحقق من إمكانية الحذف التلقائي مع تأمين فصل الحسابات
        const userFilter = getOrdersQuery(); // فلتر آمن حسب المستخدم  
        const { data: localOrder, error: localErr } = await supabase
          .from('orders')
          .select('*, order_items(*)')
          .eq('tracking_number', trackingNumber)
          .match(userFilter) // 🔒 تأمين: فقط طلبات المستخدم الحالي
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

      // جلب الطلب المحلي لفحص الحاجة للتحديث مع تأمين فصل الحسابات
      const userFilter = getOrdersQuery(); // فلتر آمن حسب المستخدم
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('id, status, delivery_status, delivery_fee, receipt_received, delivery_partner_order_id')
        .eq('tracking_number', trackingNumber)
        .match(userFilter) // 🔒 تأمين: فقط طلبات المستخدم الحالي
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
    setSyncCountdown(10);

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
        console.log('🧹 تمرير الحذف بعد المزامنة السريعة...');
        await performDeletionPassAfterStatusSync();
        
        // Sync received invoices automatically after order sync
        console.log('📧 مزامنة الفواتير المستلمة تلقائياً...');
        try {
          const { data: syncRes, error: syncErr } = await supabase.rpc('sync_recent_received_invoices');
          if (syncErr) {
            console.warn('⚠️ فشل في مزامنة الفواتير المستلمة:', syncErr.message);
          } else if (syncRes?.updated_orders_count > 0) {
            console.log(`✅ تمت مزامنة ${syncRes.updated_orders_count} طلب من الفواتير المستلمة`);
          }
        } catch (e) {
          console.warn('⚠️ خطأ في مزامنة الفواتير المستلمة:', e?.message || e);
        }
        setLastSyncAt(new Date());
        console.log('✅ تمت المزامنة بنجاح');
      } catch (error) {
        console.error('❌ خطأ في المزامنة:', error);
      } finally {
        setIsSyncing(false);
        setSyncMode('standby');
        setSyncCountdown(0);
      }
    }, 10000);

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
      
      // اجلب الطلبات المشكوك فيها مع تأمين فصل الحسابات
      const userFilter = getOrdersQuery(); // فلتر آمن حسب المستخدم
      const { data: problematicOrders, error } = await supabase
        .from('orders')
        .select('id, status, tracking_number, delivery_partner_order_id, qr_id, receipt_received')
        .eq('delivery_partner', 'alwaseet')
        .in('status', ['pending', 'delivered', 'returned'])
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .match(userFilter) // 🔒 تأمين: فقط طلبات المستخدم الحالي
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

  // دالة للتحقق من الطلبات المحذوفة بعد مزامنة الحالات - استخدام نفس منطق زر "تحقق الآن"
  const performDeletionPassAfterStatusSync = useCallback(async () => {
    if (!token) return;
    
    try {
      console.log('🔍 فحص الطلبات للحذف التلقائي - استخدام نفس منطق زر "تحقق الآن"...');
      
      // جلب الطلبات المحلية المرشحة للحذف مع تأمين فصل الحسابات
      const userFilter = getOrdersQuery(); // فلتر آمن حسب المستخدم
      const { data: localOrders, error } = await supabase
        .from('orders')
        .select('id, tracking_number, qr_id, delivery_partner, delivery_partner_order_id, delivery_status, status, receipt_received')
        .eq('delivery_partner', 'alwaseet')
        .not('delivery_partner_order_id', 'is', null)
        .eq('receipt_received', false)
        .match(userFilter) // 🔒 تأمين: فقط طلبات المستخدم الحالي
        .limit(50); // إزالة فلتر status لأن syncOrderByQR تتعامل مع جميع الحالات
        
      if (error) {
        console.error('❌ خطأ في جلب الطلبات المحلية:', error);
        return;
      }
      
      if (!localOrders?.length) {
        console.log('✅ لا توجد طلبات مرشحة للفحص');
        return;
      }
      
      console.log(`🔍 سيتم فحص ${localOrders.length} طلب باستخدام syncOrderByQR...`);
      
      let checkedCount = 0;
      let deletedCount = 0;
      
      // استخدام نفس منطق زر "تحقق الآن" - استدعاء syncOrderByQR لكل طلب
      for (const localOrder of localOrders) {
        const trackingNumber = localOrder.tracking_number || localOrder.qr_id;
        if (!trackingNumber) {
          console.warn(`⚠️ لا يوجد tracking_number للطلب ${localOrder.id}`);
          continue;
        }
        
        try {
          console.log(`🔄 فحص الطلب ${trackingNumber} باستخدام syncOrderByQR...`);
          
          // استدعاء نفس الدالة المستخدمة في زر "تحقق الآن"
          const syncResult = await syncOrderByQR(trackingNumber);
          checkedCount++;
          
          // التحقق من الحذف التلقائي
          if (syncResult?.autoDeleted) {
            deletedCount++;
            console.log(`🗑️ تم حذف الطلب ${trackingNumber} تلقائياً`);
          } else if (syncResult) {
            console.log(`✅ تم تحديث الطلب ${trackingNumber} بنجاح`);
          } else {
            console.log(`ℹ️ لا توجد تحديثات للطلب ${trackingNumber}`);
          }
          
        } catch (error) {
          console.error(`❌ خطأ في فحص الطلب ${trackingNumber}:`, error);
        }
      }
      
      console.log(`✅ انتهاء الفحص التلقائي: تم فحص ${checkedCount} طلب، حذف ${deletedCount} طلب`);
      
      if (deletedCount > 0) {
        console.log(`🗑️ إجمالي الطلبات المحذوفة تلقائياً: ${deletedCount}`);
      }
      
    } catch (error) {
      console.error('❌ خطأ في فحص الطلبات للحذف التلقائي:', error);
    }
  }, [token, syncOrderByQR]);

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

    // New exports:
    fastSyncPendingOrders,
    linkRemoteIdsForExistingOrders,
    comprehensiveOrderCorrection,
    performDeletionPassAfterStatusSync,
    
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
