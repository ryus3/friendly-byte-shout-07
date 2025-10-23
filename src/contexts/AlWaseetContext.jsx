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
import devLog from '@/lib/devLogger';

const AlWaseetContext = createContext();

export const useAlWaseet = () => useContext(AlWaseetContext);

export const AlWaseetProvider = ({ children }) => {
  const { user } = useAuth();
  
  // Declare core state early to avoid TDZ in callbacks
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState(null);
  const [waseetUser, setWaseetUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activePartner, setActivePartner] = useLocalStorage('active_delivery_partner', 'local');
  
  // نظام البيانات الموحد للتأكد من الأمان وفصل الحسابات
  const { userUUID, getOrdersQuery, canViewData } = useUnifiedUserData();
  
  // Helper function to normalize username (declared early to avoid TDZ)
  const normalizeUsername = useCallback((username) => {
    return String(username || '').trim().toLowerCase();
  }, []);
  
  // دالة للحصول على توكن المستخدم من النظام الأصلي - دعم متعدد الحسابات
  const getTokenForUser = useCallback(async (userId, accountUsername = null) => {
    if (!userId) return null;
    
    try {
      let query = supabase
        .from('delivery_partner_tokens')
        .select('token, expires_at, account_username, merchant_id, account_label, is_default')
        .eq('user_id', userId)
        .eq('partner_name', 'alwaseet');
      
      if (accountUsername) {
        // البحث عن حساب محدد مع المقارنة المطبعة
        query = query.ilike('account_username', accountUsername.trim().toLowerCase());
      } else {
        // البحث عن الحساب الافتراضي أو الأحدث
        query = query.order('is_default', { ascending: false })
                    .order('last_used_at', { ascending: false })
                    .limit(1);
      }
      
      const { data, error } = await query.maybeSingle();
      
      if (error || !data) return null;
      
      // التحقق من صلاحية التوكن
      if (new Date(data.expires_at) <= new Date()) {
        return null;
      }
      
      return data;
    } catch (error) {
      return null;
    }
  }, []);

  // دالة لتفعيل حساب محدد وتسجيل الدخول الفعلي
  const activateAccount = useCallback(async (accountUsername) => {
    if (!user?.id || !accountUsername) {
      return false;
    }
    
    try {
      setLoading(true);
      
      // جلب بيانات الحساب المحدد
      const accountData = await getTokenForUser(user.id, accountUsername);
      
      if (!accountData) {
        toast({
          title: "خطأ في تسجيل الدخول",
          description: "لم يتم العثور على بيانات صالحة للحساب المحدد",
          variant: "destructive"
        });
        return false;
      }
      
      // تحديث حالة السياق
      setToken(accountData.token);
      setWaseetUser({
        username: accountData.account_username,
        merchantId: accountData.merchant_id,
        label: accountData.account_label
      });
      setIsLoggedIn(true);
      setActivePartner('alwaseet');
      
      // تحديث last_used_at في قاعدة البيانات
      await supabase
        .from('delivery_partner_tokens')
        .update({ last_used_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('partner_name', 'alwaseet')
        .ilike('account_username', accountUsername.trim().toLowerCase());
      
      
      toast({
        title: "✅ تم تسجيل الدخول بنجاح",
        description: `تم تسجيل الدخول للحساب: ${accountData.account_label || accountData.account_username}`,
        variant: "default"
      });
      
      return true;
    } catch (error) {
      
      toast({
        title: "خطأ في تسجيل الدخول",
        description: error.message,
        variant: "destructive"
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [user?.id, getTokenForUser]);

  // دالة للحصول على جميع حسابات المستخدم لشركة معينة مع إزالة التكرار
  const getUserDeliveryAccounts = useCallback(async (userId, partnerName = 'alwaseet') => {
    if (!userId) return [];
    
    try {
      const { data, error } = await supabase
        .from('delivery_partner_tokens')
        .select('account_username, merchant_id, account_label, is_default, last_used_at, created_at, partner_data, token, expires_at')
        .eq('user_id', userId)
        .eq('partner_name', partnerName)
        .eq('is_active', true)  // فقط التوكنات النشطة
        .not('token', 'is', null)  // فقط الحسابات التي لديها توكن صالح
        .neq('token', '')  // تجنب التوكنات الفارغة
        .order('is_default', { ascending: false })
        .order('last_used_at', { ascending: false });
      
      if (error) {
        console.error('خطأ في جلب حسابات المستخدم:', error);
        return [];
      }

      // إزالة الحسابات المكررة بناءً على اسم المستخدم المطبع
      const accounts = data || [];
      const uniqueAccounts = [];
      const seenUsernames = new Set();

      for (const account of accounts) {
        // فلترة التوكنات المنتهية
        if (account.expires_at && new Date(account.expires_at) <= new Date()) {
          continue;
        }
        
        const normalizedUsername = account.account_username?.trim()?.toLowerCase();
        if (normalizedUsername && !seenUsernames.has(normalizedUsername)) {
          seenUsernames.add(normalizedUsername);
          uniqueAccounts.push(account);
        }
      }
      
      devLog.log(`🔍 تم العثور على ${accounts.length} حساب نشط، بعد إزالة التكرار والمنتهية: ${uniqueAccounts.length}`);
      return uniqueAccounts;
    } catch (error) {
      console.error('خطأ في جلب حسابات المستخدم:', error);
      return [];
    }
  }, []);

  // دالة لتعيين الحساب الافتراضي
  const setDefaultDeliveryAccount = useCallback(async (userId, partnerName, accountUsername) => {
    if (!userId || !accountUsername) return false;
    
    try {
      const normalizedUsername = normalizeUsername(accountUsername);
      
      // إزالة الافتراضي من جميع الحسابات الأخرى
      await supabase
        .from('delivery_partner_tokens')
        .update({ is_default: false })
        .eq('user_id', userId)
        .eq('partner_name', partnerName);
      
      // تعيين الحساب الجديد كافتراضي باستخدام البحث المطبع
      const { error } = await supabase
        .from('delivery_partner_tokens')
        .update({ 
          is_default: true,
          last_used_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('partner_name', partnerName)
        .ilike('account_username', normalizedUsername);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('خطأ في تعيين الحساب الافتراضي:', error);
      return false;
    }
  }, [normalizeUsername]);

  // دالة مزامنة الطلبات المرئية بكفاءة (للطلبات الموجودة في الصفحة فقط)
  // دالة إصلاح المخزون المتضرر للطلبات المُسلّمة
  const fixDamagedAlWaseetStock = useCallback(async () => {
    try {
      toast({
        title: "🔄 جاري إصلاح المخزون المتضرر...",
        description: "فحص طلبات الوسيط وإصلاح المشاكل"
      });

      const { data: result, error } = await supabase.rpc('fix_all_damaged_alwaseet_orders');
      
      if (error) throw error;

      toast({
        title: "✅ تم إصلاح المخزون بنجاح",
        description: `تم فحص ${result.total_orders_checked} طلب وإصلاح ${result.orders_fixed} طلب متضرر`,
        variant: "default"
      });

      return result;
    } catch (error) {
      console.error('❌ خطأ في إصلاح المخزون:', error);
      toast({
        title: "❌ خطأ في إصلاح المخزون",
        description: error.message,
        variant: "destructive"
      });
      throw error;
    }
  }, [toast]);

  const syncVisibleOrdersBatch = useCallback(async (visibleOrders, onProgress) => {
    if (!visibleOrders || visibleOrders.length === 0) {
      devLog.log('لا توجد طلبات مرئية للمزامنة');
      return { success: true, updatedCount: 0 };
    }

    // ✅ فلترة مزدوجة - استبعاد الطلبات المكتملة والمرجعة
    const syncableOrders = visibleOrders.filter(order => {
      if (!order.created_by || order.delivery_partner !== 'alwaseet') return false;
      
      // استبعاد حالة delivery_status = 4 (تم التسليم للزبون)
      if (order.delivery_status === '4') return false;
      
      // استبعاد حالة delivery_status = 17 (تم الإرجاع للتاجر)
      if (order.delivery_status === '17') return false;
      
      return true;
    });

    if (syncableOrders.length === 0) {
      devLog.log('لا توجد طلبات نشطة للمزامنة (تم استبعاد المكتملة والمرجعة)');
      return { success: true, updatedCount: 0 };
    }

    devLog.log(`🚀 بدء مزامنة ${syncableOrders.length} طلب نشط من ${visibleOrders.length} طلب ظاهر...`);
    
    try {
      // تجميع الطلبات حسب منشئها (created_by)
      const ordersByEmployee = new Map();
      
      for (const order of syncableOrders) {
        if (!ordersByEmployee.has(order.created_by)) {
          ordersByEmployee.set(order.created_by, []);
        }
        ordersByEmployee.get(order.created_by).push(order);
      }

      devLog.log(`📊 تم تجميع الطلبات: ${ordersByEmployee.size} موظف`);
      
      let totalUpdated = 0;
      let processedEmployees = 0;
      
      // معالجة كل موظف على حدة باستخدام توكن منشئ الطلب
      for (const [employeeId, employeeOrders] of ordersByEmployee) {
        try {
          // الحصول على توكن منشئ الطلب (وليس المدير الحالي)
          const employeeTokenData = await getTokenForUser(employeeId);
          if (!employeeTokenData) {
            devLog.log(`⚠️ لا يوجد توكن صالح للموظف منشئ الطلب: ${employeeId}`);
            continue;
          }

          devLog.log(`🔄 مزامنة ${employeeOrders.length} طلب للموظف: ${employeeId} باستخدام توكنه الشخصي`);
          
          // جلب جميع طلبات الموظف من الوسيط باستخدام توكنه الشخصي
          const merchantOrders = await AlWaseetAPI.getMerchantOrders(employeeTokenData.token);
          
          if (!merchantOrders || !Array.isArray(merchantOrders)) {
            devLog.log(`⚠️ لم يتم الحصول على طلبات صالحة للموظف: ${employeeId}`);
            continue;
          }

          // تحديث كل طلب محلي بناءً على بيانات الوسيط
          for (const localOrder of employeeOrders) {
            const trackingIds = [
              localOrder.tracking_number,
              localOrder.qr_id,
              localOrder.delivery_partner_order_id
            ].filter(Boolean);

            // البحث عن الطلب في بيانات الوسيط
            const remoteOrder = merchantOrders.find(ro => 
              trackingIds.some(id => 
                ro.tracking_number === id || 
                ro.qr_id === id || 
                ro.id === id ||
                ro.order_id === id
              )
            );

            if (remoteOrder) {
              // تحديد الحالة المحلية بناءً على حالة الوسيط مع أولوية للمعرفات الرقمية
              const statusId = remoteOrder.status_id || remoteOrder.state_id;
              let newDeliveryStatus;
              
              // أولوية للمعرف الرقمي إن وجد
              if (statusId) {
                newDeliveryStatus = String(statusId);
              } else if (remoteOrder.status_text === 'تم التسليم للزبون') {
                newDeliveryStatus = '4';
              } else if (remoteOrder.status_text === 'تم الارجاع الى التاجر') {
                newDeliveryStatus = '17';
              } else {
                newDeliveryStatus = remoteOrder.status_text;
              }
              
              const statusConfig = getStatusConfig(newDeliveryStatus);
              const newStatus = statusConfig.localStatus;
              const newDeliveryFee = parseFloat(remoteOrder.delivery_fee) || 0;
              const newReceiptReceived = statusConfig.receiptReceived;

              // تحديث الطلب إذا تغيرت بياناته
              const needsUpdate = (
                localOrder.delivery_status !== newDeliveryStatus ||
                localOrder.status !== newStatus ||
                localOrder.delivery_fee !== newDeliveryFee ||
                localOrder.receipt_received !== newReceiptReceived ||
                !localOrder.delivery_partner_order_id
              );

              if (needsUpdate) {
                const updates = {
                  delivery_status: newDeliveryStatus,
                  status: newStatus,
                  delivery_fee: newDeliveryFee,
                  receipt_received: newReceiptReceived,
                  delivery_partner_order_id: remoteOrder.id || remoteOrder.order_id
                };

                // تحديث الطلب في قاعدة البيانات
                const { error } = await supabase
                  .from('orders')
                  .update(updates)
                  .eq('id', localOrder.id);

                if (!error) {
                  totalUpdated++;
                } else {
                  console.error(`❌ خطأ في تحديث الطلب ${localOrder.tracking_number}:`, error);
                }
              }
            }
          }

          processedEmployees++;
          
          // تحديث التقدم
          if (onProgress) {
            onProgress({
              processed: processedEmployees,
              total: ordersByEmployee.size,
              updated: totalUpdated,
              currentEmployee: employeeId
            });
          }

        } catch (error) {
          console.error(`❌ خطأ في مزامنة طلبات الموظف ${employeeId}:`, error);
        }
      }
      
      return {
        success: true, 
        updatedCount: totalUpdated,
        processedEmployees,
        totalEmployees: ordersByEmployee.size
      };

    } catch (error) {
      console.error('❌ خطأ في مزامنة الطلبات المرئية:', error);
      return { 
        success: false, 
        error: error.message,
        updatedCount: 0
      };
    }
  }, [getTokenForUser]);
  
  // دالة للتحقق من ملكية الطلب
  const isOrderOwner = useCallback((order, currentUser) => {
    if (!order || !currentUser) return false;
    return order.created_by === currentUser.id;
  }, []);
  
  // دالة للتحقق من إمكانية حذف الطلب
  const canAutoDeleteOrder = useCallback((order, currentUser = user) => {
    if (!order || !currentUser) {
      devLog.log('❌ canAutoDeleteOrder: فشل - طلب أو مستخدم غير موجود');
      return false;
    }
    
    // التحقق من أن الطلب من الوسيط
    if (order.delivery_partner !== 'alwaseet') {
      devLog.log('❌ canAutoDeleteOrder: فشل - ليس طلب وسيط');
      return false;
    }
    
    // لا يحذف الطلبات المستلمة الفواتير
    if (order.receipt_received) {
      devLog.log('❌ canAutoDeleteOrder: فشل - تم استلام الفاتورة');
      return false;
    }
    
    // ✅ فقط الطلبات pending تُحذف تلقائياً (لا shipped و لا delivery)
    const allowedStatuses = ['pending'];
    if (!allowedStatuses.includes(order.status)) {
      devLog.log(`❌ canAutoDeleteOrder: فشل - حالة غير مسموحة: ${order.status}`);
      return false;
    }
    
    // حماية زمنية: عمر الطلب أكبر من دقيقة واحدة
    const orderAge = Date.now() - new Date(order.created_at).getTime();
    const minAge = 1 * 60 * 1000; // دقيقة واحدة بالميلي ثانية
    if (orderAge < minAge) {
      devLog.log(`❌ canAutoDeleteOrder: فشل - الطلب جديد جداً (عمره ${Math.round(orderAge/60000)} دقيقة)`);
      return false;
    }
    
    // يجب وجود معرف تتبع
    if (!order.tracking_number && !order.qr_id && !order.delivery_partner_order_id) {
      devLog.log('❌ canAutoDeleteOrder: فشل - لا يوجد معرف تتبع');
      return false;
    }
    
  // التحقق من الملكية - حتى المدير لا يحذف طلبات الموظفين
  if (!isOrderOwner(order, currentUser)) {
    devLog.log('❌ canAutoDeleteOrder: فشل - المستخدم لا يملك الطلب (الحماية صالحة للجميع بما في ذلك المدير)');
    return false;
  }
    
    devLog.log(`✅ canAutoDeleteOrder: مسموح - الطلب ${order.tracking_number || order.qr_id} يمكن حذفه`);
    return true;
  }, [user, isOrderOwner]);
  
  // دالة مساعدة لتطبيق فصل الحسابات على جميع استعلامات الطلبات
  const scopeOrdersQuery = useCallback((query, restrictToOwnOrders = false) => {
    if (!user?.id) return query;
    
    // إذا كان restrictToOwnOrders = true، حتى المدير يحصل على طلباته فقط (للحذف الآمن)
    if (restrictToOwnOrders) {
      return query.eq('created_by', user.id);
    }
    
    // المدير يرى جميع الطلبات للعرض
    if (user.email === 'ryusbrand@gmail.com' || user.id === '91484496-b887-44f7-9e5d-be9db5567604') {
      return query;
    }
    
    // الموظفون يرون طلباتهم فقط
    return query.eq('created_by', user.id);
  }, [user]);
  
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
    devLog.log('NotificationsSystem not ready yet');
  }
// state moved earlier to avoid TDZ

  
  // دالة للتحقق من وجود توكن صالح بدون تغيير activePartner
  const hasValidToken = useCallback(async (partnerName = 'alwaseet') => {
    if (!user?.id) return false;
    
    try {
      const tokenData = await getTokenForUser(user.id);
      return tokenData && tokenData.token && new Date(tokenData.expires_at) > new Date();
    } catch (error) {
      console.error('خطأ في التحقق من التوكن:', error);
      return false;
    }
  }, [user?.id, getTokenForUser]);
  
  // دالة جلب التوكن وتحديث حالة السياق
  const fetchToken = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const tokenData = await getTokenForUser(user.id);
      
      if (tokenData) {
        setToken(tokenData.token);
        setWaseetUser({
          username: tokenData.account_username,
          merchantId: tokenData.merchant_id,
          label: tokenData.account_label
        });
        setIsLoggedIn(true);
        
        // فقط إذا لم يكن هناك شريك نشط محدد
        if (activePartner === 'local') {
          setActivePartner('alwaseet');
        }
      } else {
        setToken(null);
        setWaseetUser(null);
        setIsLoggedIn(false);
      }
    } catch (error) {
      console.error('خطأ في جلب التوكن:', error);
      setToken(null);
      setWaseetUser(null);
      setIsLoggedIn(false);
    }
  }, [user?.id, getTokenForUser, activePartner, setActivePartner]);
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
    devLog.log('🔕 تم إلغاء إرسال الإشعار من العميل - التريغر يتولى الأمر:', { trackingNumber, stateId, statusText });
    return;
    
    // منع التكرار الذكي - فقط عند تغيير الحالة فعلياً
    const trackingKey = `${trackingNumber}`;
    const lastStateId = lastNotificationStatus[trackingKey];
    
    // إذا كانت نفس الحالة، لا ترسل إشعار
    if (lastStateId === String(stateId)) {
      devLog.log('🔄 منع تكرار - نفس الحالة:', { trackingNumber, stateId, lastStateId });
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
    
    devLog.log('✅ تحديث إشعار الوسيط:', {
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
          devLog.error('❌ خطأ في تحديث الإشعار:', updateError);
        } else {
          devLog.log('🔄 تم تحديث الإشعار الموجود بنجاح');
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
        
        devLog.log('📤 بيانات الإشعار الجديدة:', newNotificationData);
        await createNotification(newNotificationData);
        devLog.log('🆕 تم إنشاء إشعار جديد');
      }
      
      // تحديث آخر حالة مرسلة
      setLastNotificationStatus(prev => ({
        ...prev,
        [trackingKey]: String(stateId)
      }));
      
      devLog.log('🎯 تم تحديث إشعار الوسيط بنجاح');
      
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


  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  // Auto-sync will be set up after functions are defined

  // normalizeUsername is declared earlier to avoid TDZ with dependency arrays
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

      // حفظ التوكن في قاعدة البيانات مع دعم تعدد الحسابات
      const normalizedUsername = normalizeUsername(username);
      const merchantId = tokenData.merchant_id || null;
      
      try {
        // البحث عن حسابات موجودة بنفس اسم المستخدم المطبع
        const { data: existingAccounts } = await supabase
          .from('delivery_partner_tokens')
          .select('id, created_at')
          .eq('user_id', user.id)
          .eq('partner_name', partner)
          .ilike('account_username', normalizedUsername)
          .order('created_at', { ascending: false });

        // إذا وُجدت حسابات متعددة، احذف الزائدة واحتفظ بالأحدث
        if (existingAccounts && existingAccounts.length > 1) {
          const accountsToDelete = existingAccounts.slice(1); // احتفظ بالأول (الأحدث)
          for (const account of accountsToDelete) {
            await supabase
              .from('delivery_partner_tokens')
              .delete()
              .eq('id', account.id);
          }
          devLog.log(`🧹 تم حذف ${accountsToDelete.length} حساب مكرر`);
        }

        const existingAccount = existingAccounts?.[0];

        if (existingAccount) {
          // تحديث الحساب الموجود
          const { error } = await supabase
            .from('delivery_partner_tokens')
            .update({
              token: tokenData.token,
              expires_at: expires_at.toISOString(),
              partner_data: partnerData,
              merchant_id: merchantId,
              account_username: normalizedUsername,
              last_used_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingAccount.id);
            
          if (error) throw error;
        } else {
          // إنشاء حساب جديد
          // التحقق من وجود حساب افتراضي
          const { data: defaultAccount } = await supabase
            .from('delivery_partner_tokens')
            .select('id')
            .eq('user_id', user.id)
            .eq('partner_name', partner)
            .eq('is_default', true)
            .maybeSingle();

          const isNewDefault = !defaultAccount;

          const { error } = await supabase
            .from('delivery_partner_tokens')
            .insert({
              user_id: user.id,
              partner_name: partner,
              account_username: normalizedUsername,
              token: tokenData.token,
              expires_at: expires_at.toISOString(),
              partner_data: partnerData,
              merchant_id: merchantId,
              is_default: isNewDefault,
              last_used_at: new Date().toISOString(),
            });
            
          if (error) throw error;
        }
          
      } catch (error) {
        console.error('خطأ في حفظ التوكن:', error);
        throw new Error('فشل في حفظ بيانات تسجيل الدخول: ' + error.message);
      }

      setToken(tokenData.token);
      setWaseetUser(partnerData);
      setIsLoggedIn(true);
      setActivePartner(partner);
      toast({ title: "نجاح", description: `تم تسجيل الدخول بنجاح في ${deliveryPartners[partner].name}.` });
      
      // تشغيل مزامنة سريعة بعد 5 ثواني من تجديد التوكن
      setTimeout(() => {
        console.log('🔄 تشغيل فحص الطلبات المحذوفة بعد تجديد التوكن...');
        fastSyncPendingOrders(false).then(result => {
          console.log('✅ نتيجة الفحص التلقائي بعد تجديد التوكن:', result);
        }).catch(error => {
          console.error('❌ خطأ في الفحص التلقائي:', error);
        });
      }, 5000);
      
      return { success: true };
    } catch (error) {
      toast({ title: "خطأ في تسجيل الدخول", description: error.message, variant: "destructive" });
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [setActivePartner, user, deliveryPartners]);

  const logout = useCallback(async (deleteAccount = false) => {
    const partnerName = deliveryPartners[activePartner]?.name || 'شركة التوصيل';
    
    // إذا طُلب حذف الحساب فقط احذفه من قاعدة البيانات
    if (deleteAccount && user && activePartner !== 'local') {
      await supabase
        .from('delivery_partner_tokens')
        .delete()
        .eq('user_id', user.id)
        .eq('partner_name', activePartner);
    }

    // تنظيف الحالة المحلية فقط
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
      devLog.log('🔄 تحميل حالات الطلبات من الوسيط...');
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
        
        devLog.log(`📋 State ID ${stateId}: "${status.status}" → ${statusConfig.internalStatus} ${statusConfig.releasesStock ? '(يحرر المخزون)' : '(محجوز)'}`);
      });
      
      setOrderStatusesMap(statusMap);
      devLog.log('✅ تم تحميل حالات الطلبات بالنظام الجديد:', statusMap);
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
      devLog.log('🛠️ بدء التصحيح الجذري للطلبات الحالية...');
      
      // تحميل حالات الطلبات إذا لم تكن محملة
      let statusMap = orderStatusesMap;
      if (statusMap.size === 0) {
        statusMap = await loadOrderStatuses();
      }
      
      // 1) جلب جميع طلبات الوسيط لبناء خريطة شاملة
      const waseetOrders = await AlWaseetAPI.getMerchantOrders(token);
      devLog.log(`📦 جلب ${waseetOrders.length} طلب من الوسيط للتصحيح`);
      
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
      const { data: localOrders, error: localErr } = await scopeOrdersQuery(
        supabase
          .from('orders')
          .select('id, tracking_number, delivery_partner_order_id, status, delivery_status')
          .eq('delivery_partner', 'alwaseet')
      ).limit(1000);
        
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
            devLog.log(`🔗 ربط الطلب ${localOrder.id} مع معرف الوسيط ${waseetOrder.id}`);
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
            devLog.log(`📝 تحديث حالة الطلب ${localOrder.id}: ${localOrder.status} → ${correctLocalStatus}`);
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
          
          // deliver_confirmed_fin = 1 يعني فقط "تم التسليم" - لا يعني استلام فاتورة
          // receipt_received يُحدّث فقط عند استلام فاتورة فعلية من واجهة الفواتير
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
            devLog.log(`✅ تصحيح الطلب ${localOrder.id} مكتمل`);
          } else {
            devLog.warn('⚠️ فشل تصحيح الطلب:', localOrder.id, updateErr);
          }
        }
      }
      
      // تسجيل إتمام التصحيح
      setCorrectionComplete(true);
      
      devLog.log(`✅ التصحيح الجذري مكتمل: ${corrected} طلب مُصحح، ${linked} طلب مربوط، ${updated} حالة محدثة`);
      
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
      devLog.log('🧩 محاولة ربط معرفات الوسيط للطلبات بدون معرف...');
      // 1) اجلب طلباتنا التي لا تملك delivery_partner_order_id مع تأمين فصل الحسابات
      const { data: localOrders, error: localErr } = await scopeOrdersQuery(
        supabase
          .from('orders')
          .select('id, tracking_number')
          .eq('delivery_partner', 'alwaseet')
          .is('delivery_partner_order_id', null)
      ).limit(500);
      if (localErr) {
        devLog.error('❌ خطأ في جلب الطلبات المحلية بدون معرف وسيط:', localErr);
        return { linked: 0 };
      }
      if (!localOrders || localOrders.length === 0) {
        devLog.log('✅ لا توجد طلبات بحاجة للربط حالياً');
        return { linked: 0 };
      }

      // 2) اجلب جميع طلبات الوسيط ثم ابنِ خريطة: qr_id -> waseet_id
      const waseetOrders = await AlWaseetAPI.getMerchantOrders(token);
      devLog.log(`📦 تم جلب ${waseetOrders.length} طلب من الوسيط لعملية الربط`);
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
            devLog.log(`🔗 تم ربط الطلب ${lo.id} بمعرف الوسيط ${remoteId}`);
          } else {
            devLog.warn('⚠️ فشل تحديث ربط معرف الوسيط للطلب:', lo.id, upErr);
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
      devLog.log(`🗑️ handleAutoDeleteOrder: بدء حذف الطلب ${orderId} من ${source}`);
      
      // 1. جلب تفاصيل الطلب قبل الحذف مع التحقق من الملكية
      const { data: orderToDelete, error: fetchError } = await scopeOrdersQuery(
        supabase
          .from('orders')
          .select('*, order_items(*)')
          .eq('id', orderId)
      ).single();
        
      if (fetchError || !orderToDelete) {
        devLog.error('❌ فشل في جلب الطلب للحذف:', fetchError);
        return false;
      }
      
      // 🔒 تأمين نهائي: التحقق من ملكية الطلب قبل الحذف الفعلي
      if (!verifyOrderOwnership(orderToDelete, user)) {
        logSecurityWarning('final_delete_attempt', orderId, user);
        devLog.error('🚫 منع الحذف: الطلب غير مملوك للمستخدم الحالي');
        return false;
      }
      
      // ✅ تسجيل الحذف في auto_delete_log قبل الحذف الفعلي
      const orderAge = Math.round(
        (Date.now() - new Date(orderToDelete.created_at).getTime()) / 60000
      );

      const deleteReason = {
        message: source === 'fastSync' 
          ? 'لم يُعثر على الطلب في قائمة الوسيط الكاملة'
          : source === 'syncOrderByQR'
          ? 'لم يُعثر على الطلب عبر QR'
          : source === 'syncAndApplyOrders'
          ? 'لم يُعثر على الطلب في مزامنة الطلبات الظاهرة'
          : 'حذف تلقائي',
        timestamp: new Date().toISOString(),
        source: source
      };

      try {
        await supabase.from('auto_delete_log').insert({
          order_id: orderToDelete.id,
          order_number: orderToDelete.order_number,
          tracking_number: orderToDelete.tracking_number,
          qr_id: orderToDelete.qr_id,
          delivery_partner_order_id: orderToDelete.delivery_partner_order_id,
          deleted_by: user?.id,
          delete_source: source,
          reason: deleteReason,
          order_status: orderToDelete.status,
          delivery_status: orderToDelete.delivery_status,
          order_age_minutes: orderAge,
          order_data: orderToDelete
        });
        devLog.log('📝 تم تسجيل الحذف في سجل الحذف التلقائي');
      } catch (logError) {
        console.error('⚠️ فشل تسجيل الحذف:', logError);
      }
      
      // 2. حذف الخصومات المطبقة أولاً (Fallback - CASCADE سيحذفها تلقائياً)
      try {
        const { error: discountsDeleteError } = await supabase
          .from('applied_customer_discounts')
          .delete()
          .eq('order_id', orderId);
        
        if (discountsDeleteError) {
          devLog.warn('⚠️ تعذر حذف الخصومات المرتبطة:', discountsDeleteError);
        } else {
          devLog.log('✅ تم حذف الخصومات المرتبطة للطلب');
        }
      } catch (discountError) {
        devLog.warn('⚠️ خطأ في حذف الخصومات:', discountError);
      }
      
      // 3. تحرير المخزون المحجوز
      if (orderToDelete.order_items && orderToDelete.order_items.length > 0) {
        for (const item of orderToDelete.order_items) {
          try {
            await supabase.rpc('release_stock_item', {
              p_product_id: item.product_id,
              p_variant_id: item.variant_id,
              p_quantity: item.quantity
            });
            devLog.log(`📦 تم تحرير ${item.quantity} قطعة من المنتج ${item.product_id}`);
          } catch (releaseError) {
            devLog.warn('⚠️ تعذر تحرير المخزون للعنصر:', item.product_id, releaseError);
          }
        }
      }
      
      // 4. حذف الطلب من قاعدة البيانات (مع فصل آمن للحسابات)
      const { error: deleteError } = await scopeOrdersQuery(
        supabase
          .from('orders')
          .delete()
          .eq('id', orderId)
      );
        
      if (deleteError) {
        devLog.error('❌ فشل في حذف الطلب:', deleteError);
        return false;
      }
      
      devLog.log(`✅ تم حذف الطلب ${orderToDelete.tracking_number || orderToDelete.order_number || orderId} تلقائياً من ${source}`);
      
      // 5. إشعار المستخدم عند الحذف التلقائي
      if (source === 'fastSync') {
        toast({
          title: "حذف طلب تلقائي",
          description: `تم حذف الطلب ${orderToDelete.tracking_number} وتم تحرير المخزون المحجوز تلقائياً`,
          variant: "default"
        });
      }
      
      return true;
    } catch (error) {
      devLog.error('❌ خطأ في الحذف التلقائي:', error);
      return false;
    }
  }, [supabase, toast, scopeOrdersQuery, user]);

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
          devLog.log(`✅ مزامنة الفواتير: تم تحديث ${invoiceSyncRes.updated_orders_count} طلب`);
        }
      } catch (invoiceError) {
        devLog.warn('⚠️ خطأ في مزامنة الفواتير:', invoiceError);
      }
      
      // تأكد من تحميل خريطة الحالات
      let statusMap = orderStatusesMap;
      if (statusMap.size === 0) {
        statusMap = await loadOrderStatuses();
      }

      // 1) اجلب الطلبات المعلقة لدينا مع تأمين فصل الحسابات
      const targetStatuses = ['pending', 'delivery', 'shipped', 'returned'];
      const { data: pendingOrders, error: pendingErr } = await scopeOrdersQuery(
        supabase
          .from('orders')
          .select('id, status, delivery_status, delivery_partner, delivery_partner_order_id, order_number, qr_id, tracking_number, receipt_received')
          .eq('delivery_partner', 'alwaseet')
          .in('status', targetStatuses)
      ).limit(200);

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

      // 2) اجلب جميع طلبات الوسيط لعمل fallback search مع معالجة أخطاء Rate Limit
      let waseetOrders = [];
      try {
        waseetOrders = await AlWaseetAPI.getMerchantOrders(token);
        devLog.log(`📦 تم جلب ${waseetOrders.length} طلب من الوسيط للمزامنة السريعة`);
      } catch (apiError) {
        // ⚠️ CRITICAL: إذا فشل جلب الطلبات، لا نحذف أي طلبات!
        console.error('❌ فشل جلب قائمة الطلبات من الوسيط:', apiError.message);
        
        if (apiError.message?.includes('تجاوزت الحد المسموح به') || apiError.message?.includes('rate limit')) {
          devLog.warn('⚠️ Rate Limit: تم إيقاف المزامنة مؤقتاً لتجنب الحذف الخاطئ');
          if (showNotifications) {
            toast({
              title: "تحذير: معدل الطلبات مرتفع",
              description: "تم تجاوز الحد المسموح به من الطلبات. المزامنة متوقفة مؤقتاً لحماية بياناتك.",
              variant: "destructive"
            });
          }
        }
        
        setLoading(false);
        // ✅ إرجاع فوري بدون حذف أي طلبات
        return { updated: 0, checked: 0, rateLimitHit: true };
      }

      // ✅ فحص إضافي: إذا كانت القائمة فارغة بشكل غير طبيعي
      if (!waseetOrders || waseetOrders.length === 0) {
        devLog.warn('⚠️ تحذير: قائمة الطلبات فارغة - قد يكون هناك خطأ في API');
        setLoading(false);
        return { updated: 0, checked: 0, emptyList: true };
      }

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
        if (!waseetOrder && canAutoDeleteOrder(localOrder, user)) {
          // ✅ حماية إضافية: لا نحذف إذا كانت قائمة الوسيط صغيرة بشكل مريب
          if (waseetOrders.length < 10) {
            devLog.warn(`⚠️ تحذير: قائمة الطلبات صغيرة جداً (${waseetOrders.length} طلب)، تجاهل الحذف التلقائي للطلب ${localOrder.tracking_number}`);
            continue;
          }
          
          // تحقق نهائي مباشر من الوسيط باستخدام QR/Tracking - فحص بجميع التوكنات
          const confirmKey = String(localOrder.tracking_number || localOrder.qr_id || '').trim();
          let remoteCheck = null;
          
          if (confirmKey) {
            try {
              // استخدام نفس دالة الفحص المتعدد المستخدمة في syncOrderByQR
              const orderOwnerId = localOrder.created_by;
              const ownerAccounts = await getUserDeliveryAccounts(orderOwnerId, 'alwaseet');
              
              devLog.log(`🔍 فحص نهائي للطلب ${confirmKey} في ${ownerAccounts.length} حساب قبل الحذف`);
              
              for (const account of ownerAccounts) {
                if (!account.token) continue;
                try {
                  const found = await AlWaseetAPI.getOrderByQR(account.token, confirmKey);
                  if (found) {
                    devLog.log(`✅ وُجد الطلب ${confirmKey} في حساب ${account.account_username} - لن يُحذف`);
                    remoteCheck = found;
                    break;
                  }
                } catch (e) {
                  devLog.warn(`⚠️ فشل البحث في حساب ${account.account_username}:`, e.message);
                }
              }
              
              if (!remoteCheck) {
                devLog.log(`❌ الطلب ${confirmKey} غير موجود في جميع الحسابات (${ownerAccounts.length}) - سيُحذف`);
              }
            } catch (e) {
              devLog.warn('⚠️ فشل التحقق النهائي من الوسيط قبل الحذف:', e);
            }
          }
          
          if (!remoteCheck) {
            devLog.log('🗑️ الطلب غير موجود في الوسيط بعد التحقق النهائي، سيتم حذفه تلقائياً:', localOrder.tracking_number);
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
          devLog.log(`🔧 تم إصلاح معرف الوسيط للطلب ${localOrder.tracking_number}: ${waseetOrder.id}`);
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
          devLog.log(`🔧 تم إصلاح رقم التتبع للطلب ${localOrder.id}: ${localTn} → ${waseetQr}`);
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

        // ✅ فحص تغيير السعر قبل تحديد ما إذا كان هناك حاجة للتحديث
        const waseetPrice = parseInt(String(waseetOrder.price || waseetOrder.final_price)) || 0;
        const currentTotalAmount = parseInt(String(localOrder.total_amount)) || 0;
        const currentDeliveryFee = parseInt(String(localOrder.delivery_fee)) || 0;
        const currentPrice = currentTotalAmount + currentDeliveryFee; // السعر الشامل الحالي (منتجات + توصيل)
        const needsPriceUpdate = waseetPrice !== currentPrice && waseetPrice > 0;

        // 🔍 LOGGING مفصّل لفهم تحديث السعر
        if (waseetPrice > 0) {
          devLog.info(`🔍 فحص السعر للطلب ${localOrder.order_number}:`, {
            waseetPrice: waseetPrice.toLocaleString(),
            waseetOrderPrice: waseetOrder.price,
            waseetOrderFinalPrice: waseetOrder.final_price,
            currentPrice: currentPrice.toLocaleString(),
            currentTotalAmount: currentTotalAmount.toLocaleString(),
            currentDeliveryFee: currentDeliveryFee.toLocaleString(),
            needsPriceUpdate,
            waseetOrderExists: true
          });
        }

        // 🔧 فحص حاجة الطلب لتصحيح price_increase الخاطئ
        const needsCorrection = localOrder.price_increase > 0 && 
          ((parseInt(String(localOrder.final_amount)) || 0) - currentTotalAmount - currentDeliveryFee) === 0;

        // ✅ الآن يفحص جميع الأسباب للتحديث (الحالة + السعر + الفاتورة + التصحيح)
        if (!needsStatusUpdate && !needsDeliveryStatusUpdate && !waseetOrder.delivery_price && !needsReceiptUpdate && !needsPriceUpdate && !needsCorrection) {
          continue; // لا حاجة للتحديث
        }

        const updates = {
          updated_at: new Date().toISOString(),
        };

        // 🔧 تصحيح الطلبات ذات price_increase الخاطئ
        if (localOrder.price_increase > 0) {
          const finalAmount = parseInt(String(localOrder.final_amount)) || 0;
          const shouldHaveIncrease = (finalAmount - currentTotalAmount - currentDeliveryFee) !== 0;

          if (!shouldHaveIncrease) {
            // إعادة تعيين price_increase إلى 0 للطلبات القديمة الخاطئة
            updates.price_increase = 0;
            updates.discount = 0;
            updates.price_change_type = null;
            devLog.log(`🔧 تصحيح price_increase الخاطئ للطلب ${localOrder.order_number}: كان ${localOrder.price_increase} → أصبح 0`);
            needsUpdate = true;
          }
        }

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
          updates.delivery_status = String(waseetOrder.state_id || waseetOrder.status_id || waseetStatusId || '');
        }

        // ✅ تحديث السعر إذا تغير (تم فحصه بالفعل في needsPriceUpdate)
        if (needsPriceUpdate) {
          const waseetTotalPrice = parseInt(String(waseetOrder.price)) || 0;
          const deliveryFee = parseInt(String(waseetOrder.delivery_price || localOrder.delivery_fee)) || 0;
          
          // ✅ قراءة جميع القيم من الطلب المحلي
          const localTotalAmount = parseInt(String(localOrder.total_amount)) || 0;
          const localFinalAmount = parseInt(String(localOrder.final_amount)) || 0;
          const localDeliveryFee = parseInt(String(localOrder.delivery_fee)) || 0;
          const currentPriceIncrease = parseInt(String(localOrder.price_increase)) || 0;

          // ✅ Log تفصيلي قبل أي حساب
          devLog.log(`🔍 قيم الطلب ${localOrder.order_number} قبل حساب السعر:`, {
            localTotalAmount,
            localFinalAmount,
            localDeliveryFee,
            currentPriceIncrease,
            waseetTotalPrice,
            waseetDeliveryFee: deliveryFee
          });

          // ✅ حماية من race condition: إذا كانت جميع القيم = 0، لا نفعل شيء
          if (localTotalAmount === 0 && localFinalAmount === 0 && localDeliveryFee === 0) {
            devLog.warn(`⚠️ race condition: تجاهل تحديث السعر للطلب ${localOrder.order_number} - جميع القيم = 0`);
            devLog.warn(`   - سيتم تحديث السعر في المزامنة التالية عندما تكون البيانات كاملة`);
            continue; // ✅ تجاوز هذا الطلب بالكامل - سيتم مزامنته لاحقاً
          }

          // ✅ فصل السعر: منتجات = الشامل - التوصيل
          const productsPriceFromWaseet = waseetTotalPrice - deliveryFee;
          
          // ✅ حساب السعر الأصلي الحقيقي (قبل أي تغييرات)
          // total_amount يمثل السعر الأصلي للمنتجات بالفعل - لا نحتاج إضافة/طرح شيء
          const currentDiscount = parseInt(String(localOrder.discount)) || 0;
          let originalProductsPrice = localTotalAmount;

          // فقط في حالة الطلبات القديمة التي لديها price_increase خاطئ
          if (currentPriceIncrease > 0 && currentDiscount === 0) {
            // الطلبات القديمة: السعر الأصلي = السعر الحالي - الزيادة
            originalProductsPrice = localTotalAmount - currentPriceIncrease;
          }

          devLog.log(`🔍 حساب السعر الأصلي للطلب ${localOrder.order_number}:`, {
            localTotalAmount,
            currentPriceIncrease,
            currentDiscount,
            originalProductsPrice
          });

          // إذا كان السعر الأصلي = 0، جرب final_amount - delivery_fee
          if (originalProductsPrice === 0 && localFinalAmount > 0) {
            originalProductsPrice = localFinalAmount - localDeliveryFee;
            devLog.warn(`⚠️ originalProductsPrice = 0، استخدام final_amount - delivery_fee = ${originalProductsPrice.toLocaleString()} د.ع`);
          }
          
          // ✅ حماية إضافية: إذا كان originalProductsPrice سالباً أو صفر ولكن productsPriceFromWaseet > 0
          if (originalProductsPrice <= 0 && productsPriceFromWaseet > 0) {
            devLog.warn(`⚠️ race condition: originalProductsPrice = ${originalProductsPrice}، productsPriceFromWaseet = ${productsPriceFromWaseet}`);
            devLog.warn(`   - تجاهل تحديث السعر - سيتم المحاولة في المزامنة التالية`);
            continue; // ✅ تجاوز هذا الطلب بالكامل - سيتم مزامنته في الجولة القادمة
          }
          
          // ✅ حساب الفرق
          const priceDiff = productsPriceFromWaseet - originalProductsPrice;
          
          devLog.log(`💰 حساب الفرق للطلب ${localOrder.order_number}:`, {
            originalProductsPrice,
            productsPriceFromWaseet,
            priceDiff,
            needsUpdate: priceDiff !== 0
          });
          
          // ✅ حماية خاصة: إذا كان currentPriceIncrease > 0 ولكن priceDiff = 0
          // هذا يعني price_increase خاطئ من مزامنة سابقة
          if (currentPriceIncrease > 0 && priceDiff === 0 && localTotalAmount > 0) {
            devLog.warn(`🔧 إصلاح price_increase خاطئ للطلب ${localOrder.order_number}`);
            devLog.warn(`   - price_increase الحالي: ${currentPriceIncrease.toLocaleString()} د.ع`);
            devLog.warn(`   - price_increase الصحيح: 0 (لا يوجد فرق فعلي)`);
            
            updates.price_increase = 0;
            updates.price_change_type = currentDiscount > 0 ? 'discount' : null;
            // ✅ لا نُصفّر الخصم - قد يكون خصم فعلي من إنشاء الطلب
            
            devLog.log(`✅ تم إصلاح price_increase للطلب ${localOrder.order_number}`);
          }

          const currentDeliveryFee = localDeliveryFee;
          
          if (priceDiff > 0) {
            // زيادة (السعر الجديد أكبر)
            updates.price_increase = priceDiff;
            updates.discount = 0;
            updates.price_change_type = 'increase';
            
            // ✅ تحديث السعر فقط عند وجود زيادة فعلية
            updates.total_amount = productsPriceFromWaseet;
            updates.sales_amount = productsPriceFromWaseet;
            
            devLog.log(`💰 تحديث السعر للطلب ${localOrder.order_number}:`);
            devLog.log(`   - السعر الأصلي للمنتجات: ${originalProductsPrice.toLocaleString()} د.ع`);
            devLog.log(`   - السعر الجديد للمنتجات: ${productsPriceFromWaseet.toLocaleString()} د.ع`);
            devLog.log(`   - رسوم التوصيل: ${deliveryFee.toLocaleString()} د.ع`);
            devLog.log(`   - 🔺 زيادة: ${priceDiff.toLocaleString()} د.ع`);
            devLog.log(`   - المجموع النهائي: ${waseetTotalPrice.toLocaleString()} د.ع`);
            
          } else if (priceDiff < 0) {
            // خصم (السعر الجديد أقل)
            updates.discount = Math.abs(priceDiff);
            updates.price_increase = 0;
            updates.price_change_type = 'discount';
            
            // ✅ تحديث السعر فقط عند وجود خصم فعلي
            updates.total_amount = productsPriceFromWaseet;
            updates.sales_amount = productsPriceFromWaseet;
            
            devLog.log(`💰 تحديث السعر للطلب ${localOrder.order_number}:`);
            devLog.log(`   - السعر الأصلي للمنتجات: ${originalProductsPrice.toLocaleString()} د.ع`);
            devLog.log(`   - السعر الجديد للمنتجات: ${productsPriceFromWaseet.toLocaleString()} د.ع`);
            devLog.log(`   - رسوم التوصيل: ${deliveryFee.toLocaleString()} د.ع`);
            devLog.log(`   - 🔻 خصم: ${Math.abs(priceDiff).toLocaleString()} د.ع`);
            devLog.log(`   - المجموع النهائي: ${waseetTotalPrice.toLocaleString()} د.ع`);
            
          } else {
            // ✅ لا تغيير - عدم تحديث total_amount على الإطلاق!
            updates.discount = 0;
            updates.price_increase = 0;
            updates.price_change_type = null;
            
            devLog.log(`✅ لا تغيير في سعر الطلب ${localOrder.order_number} (${originalProductsPrice.toLocaleString()} د.ع)`);
          }
          
          // ✅ تحديث delivery_fee فقط إذا تغير
          if (deliveryFee !== currentDeliveryFee) {
            updates.delivery_fee = deliveryFee;
            devLog.log(`📦 تحديث رسوم التوصيل: ${currentDeliveryFee.toLocaleString()} → ${deliveryFee.toLocaleString()} د.ع`);
          }
          
          // ✅ تحديث الأرباح
          try {
            const { data: profitRecord } = await supabase
              .from('profits')
              .select('id, total_cost, employee_percentage, profit_amount, employee_profit')
              .eq('order_id', localOrder.id)
              .maybeSingle();
            
            if (profitRecord) {
              const newProfit = productsPriceFromWaseet - profitRecord.total_cost;
              const employeeShare = (profitRecord.employee_percentage / 100.0) * newProfit;
              
              await supabase
                .from('profits')
                .update({
                  total_revenue: waseetTotalPrice,
                  profit_amount: newProfit,
                  employee_profit: employeeShare,
                  updated_at: new Date().toISOString()
                })
                .eq('id', profitRecord.id);
              
              devLog.log(`✅ تحديث الأرباح:`);
              devLog.log(`   - الربح الجديد: ${newProfit.toLocaleString()} د.ع`);
              devLog.log(`   - حصة الموظف: ${employeeShare.toLocaleString()} د.ع`);
            }
          } catch (profitError) {
            console.error('❌ خطأ في تحديث الأرباح:', profitError);
          }
          
          // ✅ معالجة التسليم الجزئي للطلبات متعددة المنتجات
          if (priceDiff !== 0) {
            const { data: orderItems } = await supabase
              .from('order_items')
              .select('id, item_status')
              .eq('order_id', localOrder.id);
            
            const hasMultipleItems = orderItems && orderItems.length > 1;
            const allItemsPending = orderItems?.every(item => 
              !item.item_status || item.item_status === 'pending'
            );
            
            if (hasMultipleItems && allItemsPending && String(waseetStatusId) === '4') {
              // ✅ إضافة علامة api_sync لتفعيل نظام التسليم الجزئي
              updates.price_change_type = 'api_sync';
              devLog.log(`📦 طلب متعدد المنتجات يحتاج تحديد المنتجات المُسلّمة: ${localOrder.order_number}`);
            }
          }
        }

        // ترقية للحالة المكتملة عند التأكيد المالي
        // ملاحظة: receipt_received يُحدّث فقط من واجهة الفواتير
        if (finConfirmed) {
          if (localStatus === 'delivered' || localOrder.status === 'delivered') {
            updates.status = 'completed';
          }
        }

        // ✅ معالجة إرجاع المنتجات في حالة 17
        if (String(waseetStatusId) === '17' && updates.status === 'returned') {
          try {
            const { returnUndeliveredItems } = require('@/utils/reservationSystem');
            const result = await returnUndeliveredItems(localOrder.id);
            if (result.success) {
              devLog.log(`✅ تم إرجاع ${result.returned} منتج للمخزون - طلب ${localOrder.order_number}`);
            }
          } catch (returnError) {
            console.error('❌ خطأ في إرجاع المنتجات:', returnError);
          }
        }

        const { error: upErr } = await supabase
          .from('orders')
          .update(updates)
          .eq('id', localOrder.id);

        if (!upErr) {
          updated++;
          devLog.log(`✅ تحديث سريع: ${localOrder.tracking_number} → ${updates.status || localStatus} | ${waseetStatusText}`);
          
          // تطبيق الحذف التلقائي إذا كان الطلب غير موجود في الوسيط
          if (!waseetOrder && canAutoDeleteOrder(localOrder, user)) {
            // تحقق نهائي من الوسيط عبر QR/Tracking قبل الحذف
            const confirmKey = String(localOrder.tracking_number || localOrder.qr_id || '').trim();
            let remoteCheck = null;
            if (confirmKey) {
              try {
                remoteCheck = await AlWaseetAPI.getOrderByQR(token, confirmKey);
              } catch (e) {
                devLog.warn('⚠️ فشل التحقق النهائي من الوسيط قبل الحذف (داخل التحديث):', e);
              }
            }
            if (!remoteCheck) {
              devLog.log('🗑️ الطلب غير موجود في الوسيط بعد التحقق النهائي، سيتم حذفه تلقائياً:', localOrder.tracking_number);
              await handleAutoDeleteOrder(localOrder.id, 'fastSync');
            }
          }
        } else {
          devLog.warn('⚠️ فشل تحديث الطلب (fast sync):', localOrder.id, upErr);
        }
      }

      // إشعار عن الإصلاحات إذا حدثت
      if (repaired > 0) {
        devLog.log(`🔧 تم إصلاح ${repaired} معرف وسيط في المزامنة السريعة`);
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
          devLog.log(`✅ مزامنة فواتير نهائية: تم تحديث ${finalInvoiceSyncRes.updated_orders_count} طلب إضافي`);
        }
      } catch (finalInvoiceError) {
        devLog.warn('⚠️ خطأ في المزامنة النهائية للفواتير:', finalInvoiceError);
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
      devLog.log('🔄 بدء المزامنة الشاملة للطلبات...');
      
      // تحميل حالات الطلبات إذا لم تكن محملة
      let statusMap = orderStatusesMap;
      if (statusMap.size === 0) {
        statusMap = await loadOrderStatuses();
      }
      
      // جلب طلبات الوسيط
      const waseetOrders = await AlWaseetAPI.getMerchantOrders(token);
      devLog.log(`📦 تم جلب ${waseetOrders.length} طلب من الوسيط`);
      
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
            // ✅ تخطي الطلبات النهائية (مكتملة أو مرجعة بالكامل)
            const terminalStatuses = ['completed', 'returned_in_stock'];
            const terminalDeliveryStatuses = ['4', '17'];
            
            if (terminalStatuses.includes(existingOrder.status) || 
                terminalDeliveryStatuses.includes(existingOrder.delivery_status)) {
              devLog.log(`⏭️ تخطي الطلب ${trackingNumber} - حالة نهائية: ${existingOrder.status} / ${existingOrder.delivery_status}`);
              continue;
            }
            
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
            // ملاحظة: receipt_received يُحدّث فقط من واجهة الفواتير
            if (finConfirmed && (localStatus === 'delivered' || existingOrder.status === 'delivered')) {
              updates.status = 'completed';
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
              devLog.log(`✅ تم تحديث الطلب ${trackingNumber}: ${existingOrder.status} → ${localStatus}`);
              
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
    try {
      console.log(`🔄 مزامنة الطلب ${qrId} مع الوسيط...`);
      
      // جلب الطلب المحلي أولاً للتحقق من شروط الحذف + تحديد صاحب الطلب
      // ✅ البحث بـ tracking_number أو qr_id أو delivery_partner_order_id
      const { data: localOrder, error: localErr } = await scopeOrdersQuery(
        supabase
          .from('orders')
          .select('*, order_items(*)')
          .or(`tracking_number.eq.${qrId},qr_id.eq.${qrId},delivery_partner_order_id.eq.${qrId}`)
      ).maybeSingle();

      if (localErr) {
        console.error('❌ خطأ في جلب الطلب المحلي:', localErr);
        return null;
      }

      // دالة للحصول على التوكن الفعال مع دعم متعدد الحسابات
      const getEffectiveTokenForOrder = async (order, fallbackToCurrentUser = true) => {
        if (!order) return { token: null, source: 'no_order' };
        
        const orderOwnerId = order.created_by;
        console.log(`🔍 البحث عن توكن فعال للطلب ${order.tracking_number || order.id} (مالك: ${orderOwnerId})`);
        
        // جلب جميع حسابات مالك الطلب
        const ownerAccounts = await getUserDeliveryAccounts(orderOwnerId, 'alwaseet');
        if (ownerAccounts.length > 0) {
          console.log(`👤 وُجد ${ownerAccounts.length} حساب لمالك الطلب ${orderOwnerId}`);
          
          // تجربة كل حساب على حدة
          for (const account of ownerAccounts) {
            if (account.token) {
              console.log(`🔑 تجربة حساب: ${account.account_username} لمالك الطلب`);
              return { 
                token: account.token, 
                source: `owner:${orderOwnerId}:${account.account_username}`,
                accountUsername: account.account_username
              };
            }
          }
        }
        
        // إذا لم نجد توكن لمالك الطلب وكان المستخدم الحالي مختلف
        if (fallbackToCurrentUser && user?.id && user.id !== orderOwnerId) {
          console.log(`🔄 لم يوجد توكن لمالك الطلب، التراجع للمستخدم الحالي ${user.id}`);
          const currentUserAccounts = await getUserDeliveryAccounts(user.id, 'alwaseet');
          
          for (const account of currentUserAccounts) {
            if (account.token) {
              console.log(`🔑 استخدام حساب المستخدم الحالي: ${account.account_username}`);
              return { 
                token: account.token, 
                source: `current_user:${user.id}:${account.account_username}`,
                accountUsername: account.account_username
              };
            }
          }
        }
        
        return { token: null, source: 'no_valid_token' };
      };

      // تحديد التوكن الفعّال للطلب
      const { token: effectiveToken, source: tokenSource, accountUsername } = await getEffectiveTokenForOrder(localOrder, true);

      if (!effectiveToken) {
        console.warn(`❌ لا يوجد توكن صالح للمزامنة للطلب ${qrId} (مصدر: ${tokenSource})`);
        return null;
      }

      console.log(`🔑 استخدام توكن من: ${tokenSource} للطلب ${qrId}`);

      // البحث المتقدم بجميع التوكنات المتاحة لمالك الطلب قبل اعتبار الطلب محذوف
      const checkOrderWithAllTokens = async (orderId) => {
        const orderOwnerId = localOrder?.created_by;
        if (!orderOwnerId) return null;
        
        // جلب جميع حسابات مالك الطلب
        const ownerAccounts = await getUserDeliveryAccounts(orderOwnerId, 'alwaseet');
        
        console.log(`🔍 فحص الطلب ${orderId} بجميع التوكنات (${ownerAccounts.length} حساب)`);
        
        // تجربة كل توكن
        for (const account of ownerAccounts) {
          if (!account.token) continue;
          
          try {
            console.log(`🔄 تجربة البحث بحساب: ${account.account_username}`);
            const foundOrder = await AlWaseetAPI.getOrderByQR(account.token, orderId);
            if (foundOrder) {
              console.log(`✅ وُجد الطلب ${orderId} بحساب: ${account.account_username}`);
              return foundOrder;
            }
          } catch (error) {
            console.warn(`⚠️ فشل البحث بحساب ${account.account_username}:`, error.message);
          }
        }
        
        console.log(`❌ الطلب ${orderId} غير موجود في جميع حسابات المالك (${ownerAccounts.length} حساب)`);
        return null;
      };

      // جلب الطلب من الوسيط باستخدام التوكن المناسب
      let waseetOrder = await AlWaseetAPI.getOrderByQR(effectiveToken, qrId);
      
      if (!waseetOrder) {
        console.warn(`❌ لم يتم العثور على الطلب ${qrId} بالتوكن الأولي (${tokenSource})`);
        
        // فحص متقدم بجميع التوكنات قبل الحذف
        console.log(`🔍 بدء الفحص المتقدم بجميع التوكنات للطلب ${qrId}...`);
        waseetOrder = await checkOrderWithAllTokens(qrId);
        
        if (!waseetOrder) {
          console.warn(`❌ تأكيد: الطلب ${qrId} غير موجود في جميع الحسابات`);
          
          // التحقق من إمكانية الحذف التلقائي مع حماية مضاعفة
          if (localOrder && canAutoDeleteOrder(localOrder, user)) {
            console.log(`⚠️ التحقق من حذف الطلب ${qrId} - مؤكد عدم وجوده في جميع الحسابات`);
            
            // انتظار إضافي للتأكد (قد يكون هناك تأخير في التزامن)
            await new Promise(resolve => setTimeout(resolve, 3000));
            const finalCheck = await checkOrderWithAllTokens(qrId);
            
            if (!finalCheck) {
              console.log(`🗑️ تأكيد نهائي: حذف الطلب ${qrId} - غير موجود في جميع حسابات المالك`);
              const deleteResult = await performAutoDelete(localOrder);
              if (deleteResult) {
                return { 
                  ...deleteResult, 
                  autoDeleted: true,
                  message: `تم حذف الطلب ${localOrder.tracking_number || qrId} تلقائياً - مؤكد عدم وجوده في جميع حسابات شركة التوصيل`
                };
              }
            } else {
              console.log(`✅ الطلب ${qrId} موجود فعلياً بعد الفحص النهائي - لن يُحذف`);
              waseetOrder = finalCheck;
            }
          } else {
            console.log(`🔒 الطلب ${qrId} محمي من الحذف التلقائي أو لا يملكه المستخدم الحالي`);
          }
          
          // ✅ **حماية**: لا تحدّث إذا لم يوجد الطلب في شركة التوصيل
          if (!waseetOrder) {
            return null;
          }
        } else {
          console.log(`✅ وُجد الطلب ${qrId} في أحد الحسابات الأخرى`);
        }
      }

      // ✅ **حماية إضافية**: التحقق من صحة البيانات المُسترجعة
      // ✅ قبول id أو qr_id من AlWaseet API
      if (!waseetOrder || (!waseetOrder.qr_id && !waseetOrder.id)) {
        console.error(`❌ البيانات المُسترجعة للطلب ${qrId} غير صالحة:`, waseetOrder);
        return {
          needs_update: false,
          invalid_data: true,
          message: 'البيانات المُسترجعة من شركة التوصيل غير صالحة أو قديمة'
        };
      }

      console.log('📋 بيانات الطلب من الوسيط:', { tokenSource, waseetOrder });

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
        delivery_status: String(waseetOrder.state_id || waseetOrder.status_id || ''),
        delivery_partner_order_id: String(waseetOrder.id),
        qr_id: waseetOrder.qr_id || localOrder.qr_id || qrId, // ✅ حفظ qr_id أيضاً
        updated_at: new Date().toISOString()
      };

      // تحديث رسوم التوصيل
      if (waseetOrder.delivery_price) {
        const deliveryPrice = parseInt(String(waseetOrder.delivery_price)) || 0;
        if (deliveryPrice >= 0) {
          updates.delivery_fee = deliveryPrice;
        }
      }

      // ✅ تحديث السعر دائماً إذا تغير من الوسيط
      if (waseetOrder.price !== undefined) {
        const waseetTotalPrice = parseInt(String(waseetOrder.price)) || 0;
        const deliveryFee = parseInt(String(waseetOrder.delivery_price || localOrder.delivery_fee)) || 0;
        
        // ✅ فصل السعر: منتجات = الشامل - التوصيل
        const productsPriceFromWaseet = waseetTotalPrice - deliveryFee;
        
        // ✅ السعر الأصلي للمنتجات (من final_amount)
        const originalFinalAmount = parseInt(String(localOrder.final_amount)) || 0;
        const originalProductsPrice = originalFinalAmount - deliveryFee;
        
        // ✅ المقارنة الصحيحة: سعر المنتجات الحالي مع السعر من الوسيط
        const currentProductsPrice = parseInt(String(localOrder.total_amount)) || 0;
        
        if (productsPriceFromWaseet !== currentProductsPrice) {
          // ✅ حساب الخصم/الزيادة بناءً على السعر الأصلي للمنتجات
          const priceDiff = originalProductsPrice - productsPriceFromWaseet;
          
          if (priceDiff > 0) {
            // خصم
            updates.discount = priceDiff;
            updates.price_increase = 0;
            updates.price_change_type = 'discount';
            console.log(`   - 🔻 خصم: ${priceDiff.toLocaleString()} د.ع`);
          } else if (priceDiff < 0) {
            // زيادة
            updates.discount = 0;
            updates.price_increase = Math.abs(priceDiff);
            updates.price_change_type = 'increase';
            console.log(`   - 🔺 زيادة: ${Math.abs(priceDiff).toLocaleString()} د.ع`);
          } else {
            updates.discount = 0;
            updates.price_increase = 0;
            updates.price_change_type = null;
          }
          
          console.log(`💰 تحديث السعر للطلب ${localOrder.order_number || qrId}:`);
          console.log(`   - السعر الأصلي للمنتجات: ${originalProductsPrice.toLocaleString()} د.ع`);
          console.log(`   - السعر الجديد للمنتجات: ${productsPriceFromWaseet.toLocaleString()} د.ع`);
          console.log(`   - رسوم التوصيل: ${deliveryFee.toLocaleString()} د.ع`);
          console.log(`   - المجموع النهائي: ${waseetTotalPrice.toLocaleString()} د.ع`);
          
          // ⚠️ لا نحدّث final_amount أبداً - يبقى السعر الأصلي
          updates.total_amount = productsPriceFromWaseet;  // سعر المنتجات فقط
          updates.sales_amount = productsPriceFromWaseet;  // = total_amount
          updates.delivery_fee = deliveryFee;
          
          // ✅ تحديث الأرباح
          try {
            const { data: profitRecord } = await supabase
              .from('profits')
              .select('id, total_cost, employee_percentage, profit_amount, employee_profit')
              .eq('order_id', localOrder.id)
              .maybeSingle();
            
            if (profitRecord) {
              const newProfit = productsPriceFromWaseet - profitRecord.total_cost;
              const employeeShare = (profitRecord.employee_percentage / 100.0) * newProfit;
              
              await supabase
                .from('profits')
                .update({
                  total_revenue: waseetTotalPrice,
                  profit_amount: newProfit,
                  employee_profit: employeeShare,
                  updated_at: new Date().toISOString()
                })
                .eq('id', profitRecord.id);
              
              console.log(`✅ تحديث الأرباح:`);
              console.log(`   - الربح الجديد: ${newProfit.toLocaleString()} د.ع`);
              console.log(`   - حصة الموظف: ${employeeShare.toLocaleString()} د.ع`);
            }
          } catch (profitError) {
            console.error('❌ خطأ في تحديث الأرباح:', profitError);
          }
        }
      }

      // ترقية إلى completed فقط عند التأكيد المالي من الوسيط
      // ملاحظة: receipt_received يُحدّث فقط من واجهة الفواتير
      if (waseetOrder.deliver_confirmed_fin === 1 && correctLocalStatus === 'delivered') {
        updates.status = 'completed';
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
  }, [token, orderStatusesMap, loadOrderStatuses, user, getTokenForUser]);

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
        toast({
          title: "حذف طلب تلقائي",
          description: `${order.tracking_number} - تم حذف الطلب وتحرير المخزون المحجوز تلقائياً`,
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

      // حذف الطلب من قاعدة البيانات (مع فصل آمن للحسابات)
      const { error: deleteErr } = await scopeOrdersQuery(
        supabase
          .from('orders')
          .delete()
          .eq('id', order.id)
      );

      if (deleteErr) {
        console.error('❌ فشل في حذف الطلب:', deleteErr);
        return { success: false, error: deleteErr };
      }

      console.log(`✅ تم حذف الطلب ${order.id} تلقائياً`);
      
      // إرسال حدث لتحديث الواجهة فوراً
      window.dispatchEvent(new CustomEvent('orderDeleted', { 
        detail: { 
          id: order.id, 
          tracking_number: order.tracking_number,
          order_number: order.order_number 
        } 
      }));
      
      return { 
        success: true, 
        autoDeleted: true,
        message: `${order.tracking_number} - تم حذف الطلب وتحرير المخزون المحجوز تلقائياً`
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
      
      // جلب طلبات الوسيط باستخدام التوكن الحالي
      const userToken = token;
      const waseetOrdersResult = await getMerchantOrders();
      const waseetOrders = waseetOrdersResult.success ? waseetOrdersResult.data : [];
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
        const { data: localOrder, error: localErr } = await scopeOrdersQuery(
          supabase
            .from('orders')
            .select('*, order_items(*)')
            .eq('tracking_number', trackingNumber)
        ).maybeSingle();

        if (!localErr && localOrder && canAutoDeleteOrder(localOrder, user)) {
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
      const { data: existingOrder } = await scopeOrdersQuery(
        supabase
          .from('orders')
          .select('id, status, delivery_status, delivery_fee, receipt_received, delivery_partner_order_id')
          .eq('tracking_number', trackingNumber)
      ).single();

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
      // ترقية للحالة المكتملة فقط عند التأكيد المالي من الوسيط
      // ملاحظة: receipt_received يُحدّث فقط من واجهة الفواتير
      const finConfirmed = Number(waseetOrder.deliver_confirmed_fin) === 1;
      if (finConfirmed && (localStatus === 'delivered' || existingOrder?.status === 'delivered')) {
        updates.status = 'completed';
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

  const getMerchantOrders = useCallback(async (userId = null) => {
    // إذا تم تمرير userId، استخدم توكن ذلك المستخدم
    let requestToken = token;
    if (userId && userId !== user?.id) {
      requestToken = await getTokenForUser(userId);
    }
    
    if (requestToken) {
      try {
        const orders = await AlWaseetAPI.getMerchantOrders(requestToken);
        return { success: true, data: orders };
      } catch (error) {
        return { success: false, message: error.message };
      }
    }
    return { success: false, message: "لم يتم تسجيل الدخول لشركة التوصيل." };
  }, [token, user, getTokenForUser]);

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
    // استخدام توكن المستخدم الحالي لإنشاء الطلب
    const userToken = token; // استخدام التوكن الأصلي
    
    if (userToken) {
      try {
        const result = await AlWaseetAPI.createAlWaseetOrder(orderData, userToken);

        // حفظ معرف الطلب من الوسيط في الطلب المحلي
        if (result && result.id && orderData?.tracking_number) {
          const { error: upErr } = await scopeOrdersQuery(
            supabase
              .from('orders')
              .update({
                delivery_partner_order_id: String(result.id),
                delivery_partner: 'alwaseet',
                delivery_account_code: orderData.account_code || waseetUser?.username,
                updated_at: new Date().toISOString(),
              })
              .eq('tracking_number', String(orderData.tracking_number))
          );
          
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
  }, [token, waseetUser, scopeOrdersQuery]);

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
      const { data: problematicOrders, error } = await scopeOrdersQuery(
        supabase
          .from('orders')
          .select('id, status, tracking_number, delivery_partner_order_id, qr_id, receipt_received')
          .eq('delivery_partner', 'alwaseet')
          .in('status', ['pending', 'delivered', 'returned'])
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      ).limit(100);
      
      if (error || !problematicOrders?.length) return;
      
      // اجلب طلبات الوسيط
      const waseetOrdersResult = await getMerchantOrders();
      const waseetOrders = waseetOrdersResult.success ? waseetOrdersResult.data : [];
      
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
        // ملاحظة: receipt_received يُحدّث فقط من واجهة الفواتير
        const finConfirmed = Number(waseetOrder.deliver_confirmed_fin) === 1;
        if (finConfirmed && localOrder.status === 'delivered') {
          updates.status = 'completed';
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

  // إضافة مستمع لحدث تشغيل مرور الحذف
  useEffect(() => {
    const handleDeletionPassTrigger = (event) => {
      console.log('🗑️ تشغيل مرور الحذف من الحدث:', event.detail?.reason);
      performDeletionPassAfterStatusSync();
    };

    window.addEventListener('triggerDeletionPass', handleDeletionPassTrigger);
    
    return () => {
      window.removeEventListener('triggerDeletionPass', handleDeletionPassTrigger);
    };
  }, []);

  // دالة للتحقق من الطلبات المحذوفة بعد مزامنة الحالات - استخدام نفس منطق زر "تحقق الآن"
  const performDeletionPassAfterStatusSync = useCallback(async () => {
    if (!token) return;
    
    try {
      console.log('🔍 فحص الطلبات للحذف التلقائي - استخدام نفس منطق زر "تحقق الآن"...');
      
      // جلب الطلبات المحلية المرشحة للحذف مع تأمين فصل الحسابات - فقط طلبات المستخدم الحالي
      // ✅ الحماية الأمنية: حتى المدير يحصل على طلباته فقط للحذف
      // ✅ فقط الطلبات pending تُفحص للحذف التلقائي
      const { data: localOrders, error } = await scopeOrdersQuery(
        supabase
          .from('orders')
          .select('id, order_number, tracking_number, qr_id, delivery_partner, delivery_partner_order_id, delivery_status, status, receipt_received, customer_name, created_by, created_at, order_items(*)')
          .eq('delivery_partner', 'alwaseet')
          .eq('receipt_received', false)
          .eq('status', 'pending')
          .or('tracking_number.not.is.null,qr_id.not.is.null'),
        true // restrictToOwnOrders = true لضمان حذف المستخدم لطلباته فقط
      ).limit(50);
      
      console.log('🔍 طلبات الوسيط المرشحة للفحص:', localOrders?.map(o => ({
        order_number: o.order_number,
        tracking_number: o.tracking_number,
        delivery_partner_order_id: o.delivery_partner_order_id,
        qr_id: o.qr_id,
        status: o.status
      })));
        
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
        // توسيع البحث عن المعرف ليشمل جميع المصادر المحتملة
        const trackingNumber = localOrder.delivery_partner_order_id || localOrder.tracking_number || localOrder.qr_id;
        if (!trackingNumber) {
          console.warn(`⚠️ لا يوجد معرف صالح للطلب ${localOrder.order_number} (ID: ${localOrder.id})`);
          continue;
        }
        
        // إضافة logging خاص للطلبات المحددة للاختبار
        if (['101025896', '101028161', '101029281'].some(testId => 
          localOrder.order_number === testId || 
          localOrder.tracking_number === testId ||
          localOrder.delivery_partner_order_id === testId
        )) {
          console.log('🎯 فحص طلب اختبار:', {
            order_number: localOrder.order_number,
            tracking_number: localOrder.tracking_number,
            delivery_partner_order_id: localOrder.delivery_partner_order_id,
            qr_id: localOrder.qr_id,
            status: localOrder.status,
            delivery_status: localOrder.delivery_status,
            used_identifier: trackingNumber,
            trigger_source: 'auto_deletion_pass'
          });
        }
        
        try {
          console.log(`🔄 فحص الطلب ${trackingNumber} (رقم: ${localOrder.order_number}, ID: ${localOrder.id}) باستخدام syncOrderByQR...`);
          console.log(`📋 معلومات الطلب:`, {
            order_number: localOrder.order_number,
            tracking_number: localOrder.tracking_number,
            qr_id: localOrder.qr_id,
            delivery_partner_order_id: localOrder.delivery_partner_order_id,
            has_remote_id: !!localOrder.delivery_partner_order_id,
            status: localOrder.status,
            delivery_status: localOrder.delivery_status,
            used_identifier: trackingNumber
          });
          
          // استدعاء نفس الدالة المستخدمة في زر "تحقق الآن"
          const syncResult = await syncOrderByQR(trackingNumber);
          checkedCount++;
          
          // التحقق من الحذف التلقائي
          if (syncResult?.autoDeleted) {
            deletedCount++;
            console.log(`🗑️ تم حذف الطلب ${trackingNumber} تلقائياً`);
            
            // ✅ تسجيل الحذف في auto_delete_log
            const orderAge = Math.round(
              (Date.now() - new Date(localOrder.created_at).getTime()) / 60000
            );
            
            try {
              await supabase.from('auto_delete_log').insert({
                order_id: localOrder.id,
                order_number: localOrder.order_number,
                tracking_number: localOrder.tracking_number,
                qr_id: localOrder.qr_id,
                delivery_partner_order_id: localOrder.delivery_partner_order_id,
                deleted_by: user?.id,
                delete_source: 'syncAndApplyOrders',
                reason: {
                  message: 'لم يُعثر على الطلب في شركة التوصيل بعد مزامنة الطلبات الظاهرة',
                  timestamp: new Date().toISOString()
                },
                order_status: localOrder.status,
                delivery_status: localOrder.delivery_status,
                order_age_minutes: orderAge,
                order_data: localOrder
              });
            } catch (logError) {
              console.error('⚠️ فشل تسجيل الحذف:', logError);
            }
          } else if (syncResult) {
            console.log(`✅ تم تحديث الطلب ${trackingNumber} بنجاح:`, {
              exists_in_remote: syncResult.foundInRemote !== false,
              action_taken: syncResult.action || 'update'
            });
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

  // تحميل التوكن عند تسجيل الدخول الأولي
  useEffect(() => {
    if (user?.id) {
      fetchToken();
    }
  }, [user?.id, fetchToken]);

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
        
        // تشغيل مرور الحذف فوراً لمعالجة الطلبات المحذوفة من الوسيط
        console.log('🧹 تشغيل مرور الحذف التلقائي للطلبات المحذوفة من الوسيط...');
        await performDeletionPassAfterStatusSync();
      } catch (error) {
        console.error('❌ خطأ في المهام الأولية:', error);
      }
    };

    // Run initial tasks after 3 seconds
    const initialTimeout = setTimeout(runInitialTasks, 3000);

    return () => {
      if (initialTimeout) clearTimeout(initialTimeout);
    };
  }, [isLoggedIn, token, activePartner, correctionComplete, comprehensiveOrderCorrection, silentOrderRepair, performDeletionPassAfterStatusSync]);

  // دالة تسجيل خروج حساب التوصيل (إلغاء التفعيل بدلاً من الحذف)
  const deleteDeliveryAccount = useCallback(async (userId, partnerName, accountUsername) => {
    if (!userId || !accountUsername) return false;
    
    try {
      const normalizedUsername = normalizeUsername(accountUsername);
      
      // جلب جميع الحسابات الصالحة للمستخدم أولاً
      const { data: allAccounts, error: fetchError } = await supabase
        .from('delivery_partner_tokens')
        .select('*')
        .eq('user_id', userId)
        .eq('partner_name', partnerName)
        .eq('is_active', true);
      
      if (fetchError) throw fetchError;
      
      // التحقق من عدم حذف الحساب الوحيد إذا كان افتراضياً
      const activeAccounts = allAccounts || [];
      const accountToDelete = activeAccounts.find(acc => 
        normalizeUsername(acc.account_username) === normalizedUsername
      );
      
      if (!accountToDelete) {
        toast({
          title: "خطأ",
          description: "لم يتم العثور على الحساب المحدد",
          variant: "destructive"
        });
        return false;
      }
      
      // منع حذف الحساب الافتراضي إذا كان الوحيد المتبقي
      if (accountToDelete.is_default && activeAccounts.length === 1) {
        toast({
          title: "تعذر الحذف",
          description: "لا يمكن حذف الحساب الافتراضي الوحيد. أضف حساب آخر أولاً",
          variant: "destructive"
        });
        return false;
      }
      
      // حذف الحساب نهائياً من قاعدة البيانات
      const { error: deleteError } = await supabase
        .from('delivery_partner_tokens')
        .delete()
        .eq('user_id', userId)
        .eq('partner_name', partnerName)
        .ilike('account_username', normalizedUsername);
      
      if (deleteError) throw deleteError;
      
      // إذا كان الحساب المحذوف افتراضياً، تعيين حساب آخر كافتراضي
      if (accountToDelete.is_default && activeAccounts.length > 1) {
        const remainingAccounts = activeAccounts.filter(acc => 
          normalizeUsername(acc.account_username) !== normalizedUsername
        );
        
        if (remainingAccounts.length > 0) {
          await supabase
            .from('delivery_partner_tokens')
            .update({ is_default: true })
            .eq('id', remainingAccounts[0].id);
        }
      }
      
      toast({
        title: "تم الحذف",
        description: "تم حذف الحساب بشكل نهائي من النظام",
        variant: "default"
      });
      
      return true;
    } catch (error) {
      console.error('خطأ في حذف حساب التوصيل:', error);
      toast({
        title: "خطأ",
        description: "فشل في حذف الحساب",
        variant: "destructive"
      });
      return false;
    }
  }, [normalizeUsername, toast]);

  const value = {
    isLoggedIn,
    token,
    waseetToken: token, // Alias for compatibility
    waseetUser,
    loading,
    login,
    logout,
    activePartner,
    // دوال النظام الأصلي المحسن - دعم متعدد الحسابات
    getTokenForUser,
    getUserDeliveryAccounts,
    setDefaultDeliveryAccount,
    activateAccount,
    deleteDeliveryAccount,
    isOrderOwner,
    canAutoDeleteOrder,
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
    syncVisibleOrdersBatch,
    fixDamagedAlWaseetStock,
    hasValidToken,
  };

  // Export linkRemoteIdsForExistingOrders to window for SuperProvider access
  useEffect(() => {
    window.linkRemoteIdsForExistingOrders = linkRemoteIdsForExistingOrders;
    return () => {
      delete window.linkRemoteIdsForExistingOrders;
    };
  }, [linkRemoteIdsForExistingOrders]);

  // 🔍 دالة فحص يدوية لتتبع مشكلة تحديث الأسعار
  useEffect(() => {
    window.debugOrderSync = async (trackingNumber) => {
      try {
        devLog.info(`🔍 بدء فحص الطلب ${trackingNumber}...`);
        
        // جلب الطلب المحلي
        const { data: localOrder, error: localError } = await supabase
          .from('orders')
          .select('*')
          .eq('tracking_number', trackingNumber)
          .single();

        if (localError) {
          devLog.error('❌ خطأ في جلب الطلب المحلي:', localError);
          return { error: localError };
        }

        devLog.info('📦 الطلب المحلي:', {
          order_number: localOrder.order_number,
          tracking_number: localOrder.tracking_number,
          status: localOrder.status,
          delivery_status: localOrder.delivery_status,
          total_amount: localOrder.total_amount,
          delivery_fee: localOrder.delivery_fee,
          final_amount: localOrder.final_amount,
          price_increase: localOrder.price_increase,
          discount: localOrder.discount
        });

        // جلب من API الوسيط
        if (!token) {
          devLog.error('❌ لا يوجد token - قم بتسجيل الدخول أولاً');
          return { localOrder, error: 'No token' };
        }

        devLog.info('🌐 جلب الطلبات من API الوسيط...');
        const waseetOrders = await getMerchantOrders(token);
        const waseetOrder = waseetOrders.find(o => String(o.id) === trackingNumber);

        if (!waseetOrder) {
          devLog.error(`❌ الطلب ${trackingNumber} غير موجود في استجابة API الوسيط`);
          devLog.info(`📊 عدد الطلبات في الاستجابة: ${waseetOrders.length}`);
          return { localOrder, waseetOrder: null, error: 'Order not found in API' };
        }

        devLog.info('🌐 الطلب من الوسيط:', {
          id: waseetOrder.id,
          price: waseetOrder.price,
          final_price: waseetOrder.final_price,
          delivery_price: waseetOrder.delivery_price,
          status: waseetOrder.status,
          status_id: waseetOrder.status_id,
          state_id: waseetOrder.state_id
        });

        // حساب التحديثات
        const waseetPrice = parseInt(String(waseetOrder.price || waseetOrder.final_price)) || 0;
        const currentPrice = (parseInt(String(localOrder.total_amount)) || 0) + (parseInt(String(localOrder.delivery_fee)) || 0);
        
        devLog.info('💰 مقارنة الأسعار:', {
          waseetPrice: waseetPrice.toLocaleString(),
          currentPrice: currentPrice.toLocaleString(),
          difference: (waseetPrice - currentPrice).toLocaleString(),
          needsUpdate: waseetPrice !== currentPrice && waseetPrice > 0
        });

        return { localOrder, waseetOrder, comparison: { waseetPrice, currentPrice } };
      } catch (error) {
        devLog.error('❌ خطأ في debugOrderSync:', error);
        return { error };
      }
    };

    devLog.info('✅ تم تفعيل دالة window.debugOrderSync(trackingNumber)');
    devLog.info('   مثال: window.debugOrderSync("108108910")');

    return () => {
      delete window.debugOrderSync;
    };
  }, [token]);

  return (
    <AlWaseetContext.Provider value={value}>
      {children}
    </AlWaseetContext.Provider>
  );
};
