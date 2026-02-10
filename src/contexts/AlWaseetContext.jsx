import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { toast } from '@/components/ui/use-toast';
import { useLocalStorage } from '@/hooks/useLocalStorage.jsx';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './UnifiedAuthContext';
import { useNotificationsSystem } from './NotificationsSystemContext';
import * as AlWaseetAPI from '@/lib/alwaseet-api';
import * as ModonAPI from '@/lib/modon-api';
import { getStatusConfig } from '@/lib/alwaseet-statuses';
import { getModonStatusConfig } from '@/lib/modon-statuses';
import { useUnifiedUserData } from '@/hooks/useUnifiedUserData';
import { verifyOrderOwnership, createSecureOrderFilter, logSecurityWarning } from '@/utils/alwaseetSecurityUtils';
import { displaySecuritySummary } from '@/utils/securityLogger';
import devLog from '@/lib/devLogger';

// 🔄 Context Version - لإجبار المتصفح على تحديث الكود
const CONTEXT_VERSION = '2.9.4';

// 🧠 Smart Cache - Module-level: تخزين الطلبات المجلوبة مؤقتاً
const CACHE_TTL = 10 * 60 * 1000; // ⚡ 10 دقائق بدلاً من 5

// ✅ Smart Cache باستخدام sessionStorage للاستمرارية
const getCachedOrder = (trackingNumber) => {
  try {
    const cached = sessionStorage.getItem(`order_${trackingNumber}`);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_TTL) {
      sessionStorage.removeItem(`order_${trackingNumber}`);
      return null;
    }
    return data;
  } catch {
    return null;
  }
};

const setCachedOrder = (trackingNumber, data) => {
  try {
    sessionStorage.setItem(`order_${trackingNumber}`, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch {
    // Session storage full - ignore
  }
};

// 🔒 Global Sync Mutex - منع المزامنات المتزامنة
let globalSyncLock = false;
let globalSyncPromise = null;

// ⚡ Circuit Breaker Variables - Module-level
let consecutiveRateLimitErrors = 0;
const MAX_RATE_LIMIT_ERRORS = 5;

// ⚡ المرحلة 3: Debounce للمزامنة - منع المزامنات المتتالية
let lastSyncTime = 0;
const SYNC_DEBOUNCE_MS = 5000; // 5 ثواني minimum بين المزامنات

const AlWaseetContext = createContext();

export const useAlWaseet = () => useContext(AlWaseetContext);

export const AlWaseetProvider = ({ children }) => {
  const { user } = useAuth();
  
  // Declare core state early to avoid TDZ in callbacks
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useLocalStorage('alwaseet_token', null);
  const [tokenExpiry, setTokenExpiry] = useLocalStorage('alwaseet_token_expiry', null);
  const [waseetUser, setWaseetUser] = useLocalStorage('alwaseet_user', null);
  const [loading, setLoading] = useState(false);
  const [activePartner, setActivePartner] = useLocalStorage('active_delivery_partner', null);
  
  // ✅ فصل الحساب الافتراضي لكل شركة عن الشركة النشطة
  const [defaultAccounts, setDefaultAccounts] = useLocalStorage('delivery_default_accounts', {
    alwaseet: null,
    modon: null
  });
  
  // نظام البيانات الموحد للتأكد من الأمان وفصل الحسابات
  const { userUUID, getOrdersQuery, canViewData } = useUnifiedUserData();
  
  // Helper function to normalize username (declared early to avoid TDZ)
  const normalizeUsername = useCallback((username) => {
    return String(username || '').trim().toLowerCase();
  }, []);
  
  // دالة للحصول على توكن المستخدم من النظام الأصلي - دعم متعدد الحسابات
  // ✅ معامل strictMode: إذا كان true ولم يُمرر accountUsername، إرجاع null (بدون fallback)
  const getTokenForUser = useCallback(async (userId, accountUsername = null, partnerName = null, strictMode = false) => {
    if (!userId) return null;
    
    // استخدام activePartner إذا لم يتم تحديد partnerName
    const partner = partnerName || activePartner;
    
    try {
      let query = supabase
        .from('delivery_partner_tokens')
        .select('token, expires_at, account_username, merchant_id, account_label, is_default, partner_name')
        .eq('user_id', userId)
        .eq('partner_name', partner);
      
      if (accountUsername) {
        // تطبيع اسم الحساب: lowercase + trim + إزالة المسافات وتحويلها لشرطات
        const normalizedAccount = accountUsername.trim().toLowerCase().replace(/\s+/g, '-');
        query = query.ilike('account_username', normalizedAccount);
        devLog.log(`🔍 [getTokenForUser] بحث دقيق عن حساب: ${normalizedAccount} في ${partner}`);
      } else if (strictMode) {
        // ✅ Strict Mode: لا fallback - إرجاع null مباشرة
        devLog.warn(`⚠️ [getTokenForUser-STRICT] لم يتم تمرير accountUsername - إرجاع null`);
        return null;
      } else {
        // ✅ استخدام الحساب الافتراضي للشركة الحالية
        const defaultAccountForPartner = defaultAccounts[partner];
        
        if (defaultAccountForPartner) {
          const normalizedDefault = defaultAccountForPartner.trim().toLowerCase().replace(/\s+/g, '-');
          query = query.ilike('account_username', normalizedDefault);
          devLog.log(`🔍 [getTokenForUser] استخدام الحساب الافتراضي: ${normalizedDefault} في ${partner}`);
        } else {
          // البحث عن الحساب المحدد كافتراضي في DB أو الأحدث
          query = query.order('is_default', { ascending: false })
                      .order('last_used_at', { ascending: false })
                      .limit(1);
          devLog.log(`🔍 [getTokenForUser] استخدام fallback: الحساب الافتراضي أو الأحدث في ${partner}`);
        }
      }
      
      const { data, error } = await query
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      
      if (error || !data) return null;
      
      return data;
    } catch (error) {
      return null;
    }
  }, [activePartner, defaultAccounts]);

  // 🧹 تنظيف التوكنات المنتهية تلقائياً
  const cleanupExpiredTokens = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('delivery_partner_tokens')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .lt('expires_at', new Date().toISOString())
        .eq('is_active', true)
        .select('id');

      if (!error && data?.length > 0) {
        devLog.log(`🧹 تم تعطيل ${data.length} توكن منتهي الصلاحية`);
      }
    } catch (err) {
      console.error('خطأ في تنظيف التوكنات:', err);
    }
  }, []);

  // التحقق من صلاحية التوكن المحفوظ عند تحميل الصفحة
  useEffect(() => {
    if (!token || !tokenExpiry) return;
    
    const now = new Date();
    const expiry = new Date(tokenExpiry);
    
    if (expiry <= now) {
      // التوكن منتهي الصلاحية
      devLog.log('⏰ التوكن منتهي الصلاحية - تسجيل خروج تلقائي');
      setToken(null);
      setTokenExpiry(null);
      setIsLoggedIn(false);
      setWaseetUser(null);
    } else {
      // التوكن صالح - تفعيل الحساب تلقائياً
      devLog.log('✅ التوكن صالح - تسجيل دخول تلقائي:', {
        user: waseetUser?.username,
        partner: activePartner,
        expiresAt: tokenExpiry
      });
      setIsLoggedIn(true);
      
      // استرجاع بيانات المستخدم من قاعدة البيانات
      if (user?.id && activePartner) {
        getTokenForUser(user.id, null, activePartner).then(accountData => {
          if (accountData && accountData.token === token) {
            devLog.log('✅ تم استرجاع بيانات الحساب من قاعدة البيانات');
          }
        });
      }
    }
  }, [token, tokenExpiry, user?.id, activePartner, getTokenForUser]);

  // 🧹 تنظيف التوكنات المنتهية عند التهيئة
  useEffect(() => {
    if (user?.id) {
      cleanupExpiredTokens();
    }
  }, [user?.id, cleanupExpiredTokens]);

  // ✅ استعادة آخر شركة توصيل غير 'local' عند التحميل
  useEffect(() => {
    if (!activePartner || activePartner === 'local') {
      if (user?.id) {
        // محاولة استعادة alwaseet أولاً
        getTokenForUser(user.id, null, 'alwaseet').then(alwaseetData => {
          if (alwaseetData?.token) {
            devLog.log('✅ استعادة activePartner: alwaseet');
            setActivePartner('alwaseet');
            return;
          }
          
          // إذا لم يوجد، جرب modon
          getTokenForUser(user.id, null, 'modon').then(modonData => {
            if (modonData?.token) {
              devLog.log('✅ استعادة activePartner: modon');
              setActivePartner('modon');
            }
          });
        });
      }
    }
    // ✅ لا نضيف getTokenForUser لأنه يعتمد على activePartner ويسبب circular dependency
    // نحن نمرر partnerName صريحاً ('alwaseet', 'modon') فلا نحتاجه في dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, activePartner]);

  // دالة لإعادة تفعيل حساب منتهي الصلاحية
  const reactivateExpiredAccount = useCallback(async (accountUsername, partnerName = null) => {
    if (!user?.id || !accountUsername) {
      return false;
    }
    
    const partner = partnerName || activePartner;
    
    try {
      setLoading(true);
      
      // جلب بيانات الحساب المحفوظة
      const { data: accountRecord, error } = await supabase
        .from('delivery_partner_tokens')
        .select('account_username, merchant_id, account_label, partner_data')
        .eq('user_id', user.id)
        .eq('partner_name', partner)
        .ilike('account_username', accountUsername.trim().toLowerCase())
        .single();
      
      if (error || !accountRecord) {
        throw new Error('لم يتم العثور على بيانات الحساب');
      }
      
      // محاولة إعادة تسجيل الدخول باستخدام بيانات محفوظة
      let newToken = null;
      const savedPassword = accountRecord.partner_data?.password;
      
      if (!savedPassword) {
        throw new Error('كلمة المرور غير محفوظة. يرجى تسجيل الدخول يدوياً');
      }
      
      if (partner === 'alwaseet') {
        const loginResult = await AlWaseetAPI.loginToWaseet(accountUsername, savedPassword);
        newToken = loginResult.token;
      } else if (partner === 'modon') {
        const loginResult = await ModonAPI.loginToModon(accountUsername, savedPassword);
        if (!loginResult.success || !loginResult.token) {
          throw new Error('فشل تسجيل الدخول إلى مدن. تحقق من بيانات الدخول');
        }
        newToken = loginResult.token;
      }
      
      if (!newToken) {
        throw new Error('فشل إعادة تسجيل الدخول. يرجى تسجيل الدخول يدوياً');
      }
      
      // تحديث التوكن في قاعدة البيانات
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);
      
      await supabase
        .from('delivery_partner_tokens')
        .update({
          token: newToken,
          expires_at: expiresAt.toISOString(),
          last_used_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('partner_name', partner)
        .ilike('account_username', accountUsername.trim().toLowerCase());
      
      // تحديث حالة السياق
      setToken(newToken);
      setTokenExpiry(expiresAt.toISOString());
      setWaseetUser({
        username: accountRecord.account_username,
        merchantId: accountRecord.merchant_id,
        label: accountRecord.account_label
      });
      setIsLoggedIn(true);
      setActivePartner(partner);
      
      const partnerDisplayName = deliveryPartners[partner]?.name || partner;
      toast({
        title: "✅ تم تجديد الجلسة بنجاح",
        description: `تم تجديد تسجيل الدخول للحساب: ${accountRecord.account_label || accountRecord.account_username} في ${partnerDisplayName}`,
        variant: "default"
      });
      
      return true;
    } catch (error) {
      toast({
        title: "خطأ في تجديد الجلسة",
        description: error.message || 'يرجى تسجيل الدخول يدوياً',
        variant: "destructive"
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [user?.id, activePartner]);

  // دالة لتفعيل حساب محدد وتسجيل الدخول الفعلي
  const activateAccount = useCallback(async (accountUsername, partnerName = null, accountIsExpired = false) => {
    if (!user?.id || !accountUsername) {
      return false;
    }
    
    // استخدام activePartner إذا لم يتم تحديد partnerName
    const partner = partnerName || activePartner;
    
    // إذا كان الحساب منتهياً، محاولة إعادة التفعيل
    if (accountIsExpired) {
      return await reactivateExpiredAccount(accountUsername, partner);
    }
    
    try {
      setLoading(true);
      
      // جلب بيانات الحساب المحدد
      const accountData = await getTokenForUser(user.id, accountUsername, partner);
      
      if (!accountData) {
        toast({
          title: "انتهت صلاحية الحساب",
          description: "جاري محاولة تجديد تسجيل الدخول...",
          variant: "default"
        });
        // محاولة إعادة التفعيل
        return await reactivateExpiredAccount(accountUsername, partner);
      }
      
      // تحديث حالة السياق
      setToken(accountData.token);
      setTokenExpiry(accountData.expires_at);
      setWaseetUser({
        username: accountData.account_username,
        merchantId: accountData.merchant_id,
        label: accountData.account_label
      });
      setIsLoggedIn(true);
      setActivePartner(partner);
      
      // تحديث last_used_at في قاعدة البيانات
      await supabase
        .from('delivery_partner_tokens')
        .update({ last_used_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('partner_name', partner)
        .ilike('account_username', accountUsername.trim().toLowerCase());
      
      const partnerDisplayName = deliveryPartners[partner]?.name || partner;
      toast({
        title: "✅ تم تسجيل الدخول بنجاح",
        description: `تم تسجيل الدخول للحساب: ${accountData.account_label || accountData.account_username} في ${partnerDisplayName}`,
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
  }, [user?.id, getTokenForUser, reactivateExpiredAccount]);

  // دالة للحصول على جميع حسابات المستخدم لشركة معينة مع إزالة التكرار
  const getUserDeliveryAccounts = useCallback(async (userId, partnerName = 'alwaseet') => {
    if (!userId) return [];
    
    try {
      const { data, error } = await supabase
        .from('delivery_partner_tokens')
        .select('account_username, merchant_id, account_label, is_default, last_used_at, created_at, partner_data, token, expires_at, auto_renew_enabled')
        .eq('user_id', userId)
        .eq('partner_name', partnerName)
        .eq('is_active', true)
        .not('token', 'is', null)
        .neq('token', '')
        .order('is_default', { ascending: false })
        .order('last_used_at', { ascending: false });
      
      if (error) {
        return [];
      }

      // إزالة الحسابات المكررة بناءً على اسم المستخدم المطبع
      const accounts = data || [];
      const uniqueAccounts = [];
      const seenUsernames = new Set();

      for (const account of accounts) {
        const normalizedUsername = account.account_username?.trim()?.toLowerCase();
        if (normalizedUsername && !seenUsernames.has(normalizedUsername)) {
          seenUsernames.add(normalizedUsername);
          // إضافة حقل isExpired للحسابات المنتهية
          const isExpired = account.expires_at && new Date(account.expires_at) < new Date();
          uniqueAccounts.push({
            ...account,
            isExpired,
            expires_at: account.expires_at
          });
        }
      }
      
      return uniqueAccounts;
    } catch (error) {
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
      toast({
        title: "❌ خطأ في إصلاح المخزون",
        description: error.message,
        variant: "destructive"
      });
      throw error;
    }
  }, [toast]);

  const syncVisibleOrdersBatch = useCallback(async (visibleOrders, onProgress) => {
    // ✅ فحص الـ lock العالمي - منع المزامنات المتزامنة
    if (globalSyncLock) {
      console.log('⏸️ مزامنة قيد التقدم - انتظار...');
      if (globalSyncPromise) {
        await globalSyncPromise;
      }
      return { success: true, message: 'تم التخطي - مزامنة أخرى قيد التقدم', updatedCount: 0 };
    }
    
    if (!visibleOrders || visibleOrders.length === 0) {
      devLog.log('لا توجد طلبات مرئية للمزامنة');
      return { success: true, updatedCount: 0 };
    }
    
    // ✅ قفل المزامنة
    globalSyncLock = true;
    const syncStartTime = performance.now();
    
    // 📊 إحصائيات API - عداد الاستدعاءات
    let apiCallsCount = 0;
    
    const syncPromise = (async () => {
      try {
        // ✅ فلترة ذكية - استبعاد الحالات النهائية فقط
        const syncableOrders = visibleOrders.filter(order => {
          if (!order.created_by || !order.delivery_partner || order.delivery_partner === 'local') return false;
          
          // ✅ استبعاد الحالات النهائية والطلبات المستلمة فواتيرها:
          // 1. delivery_status = '17' (راجع للتاجر) - نهائية
          // 2. status = 'completed' (مكتمل) - نهائية
          // 3. status = 'returned_in_stock' (راجع للمخزن) - نهائية
          // 4. receipt_received = true (استلمت الفاتورة) - نهائية
          // 5. delivery_partner_invoice_id موجود (له فاتورة) - نهائية
          
          if (order.delivery_status === '17') return false;
          if (order.status === 'completed') return false;
          if (order.status === 'returned_in_stock') return false;
          if (order.receipt_received === true) return false;
          if (order.delivery_partner_invoice_id) return false;
          
          // ✅ السماح بمزامنة جميع الحالات الأخرى بما فيها:
          // - delivery_status = '4' (مسلّم) ← ليست نهائية، قد يحدث تحديثات
          // - delivery_status = '1','2','3' (معلق، جاري التوصيل، في المستودع)
          return true;
        });

        if (syncableOrders.length === 0) {
          devLog.log('لا توجد طلبات نشطة للمزامنة (تم استبعاد المكتملة والمرجعة)');
          return { success: true, updatedCount: 0 };
        }

        devLog.log(`🚀 بدء مزامنة ${syncableOrders.length} طلب نشط من ${visibleOrders.length} طلب ظاهر...`);
        
        // ✅ تجميع مركب: created_by + delivery_partner + delivery_account_used
        const ordersByKey = new Map();
        
        for (const order of syncableOrders) {
          // ✅ مفتاح مركب: employeeId|||partner|||account
          const syncKey = `${order.created_by}|||${order.delivery_partner}|||${order.delivery_account_used || 'افتراضي'}`;
          
          if (!ordersByKey.has(syncKey)) {
            ordersByKey.set(syncKey, []);
          }
          ordersByKey.get(syncKey).push(order);
        }

        devLog.log(`📊 تم تجميع الطلبات: ${ordersByKey.size} مجموعة مستقلة (موظف+شركة+حساب)`);
        
        const totalOrders = syncableOrders.length;  // إجمالي الطلبات القابلة للمزامنة
        let processedOrders = 0;  // عداد الطلبات التي تمت معالجتها
        let totalUpdated = 0;
        let processedGroups = 0;
        
        // إضافة تأخير بين المجموعات - زيادة من 1s إلى 2s
        const DELAY_BETWEEN_GROUPS = 2000; // 2 ثانية
        
        // معالجة كل مجموعة على حدة
        for (const [syncKey, groupOrders] of ordersByKey) {
          try {
            // ⚠️ فحص Circuit Breaker
        if (consecutiveRateLimitErrors >= MAX_RATE_LIMIT_ERRORS) {
          console.error(`🛑 تم إيقاف المزامنة - تجاوز الحد الأقصى لأخطاء Rate Limiting (${MAX_RATE_LIMIT_ERRORS})`);
          toast({
            title: "⚠️ تم إيقاف المزامنة مؤقتاً",
            description: "تم تجاوز الحد المسموح به. يُرجى الانتظار 5 دقائق.",
            variant: "destructive",
            duration: 10000
          });
          break;
        }
        
        processedGroups++;
        processedOrders += groupOrders.length;  // ✅ زيادة العداد بعدد طلبات المجموعة
        
        // ✅ إرسال تحديث التقدم
        if (onProgress) {
          onProgress({
            processed: processedGroups,
            total: ordersByKey.size,
            updated: totalUpdated,
            current: groupOrders.length,
            processedOrders,      // ✅ عدد الطلبات المعالجة
            totalOrders           // ✅ إجمالي الطلبات
          });
        }
          
          // ✅ استخراج البيانات من المفتاح
          const [employeeId, orderPartner, orderAccount] = syncKey.split('|||');
          
          devLog.log(`🔄 [SYNC-BATCH] معالجة ${groupOrders.length} طلب - Employee: ${employeeId}, Partner: ${orderPartner}, Account: ${orderAccount}`);
          
          // ✅ محاولة الحصول على التوكن بالوضع الصارم (strictMode)
          let employeeTokenData = await getTokenForUser(employeeId, orderAccount === 'افتراضي' ? null : orderAccount, orderPartner, true);
          
          // ✅ FALLBACK: استخدام توكن المستخدم الحالي بنفس الحساب
          if (!employeeTokenData && user?.id) {
            devLog.log(`⚠️ لا يوجد توكن للموظف ${employeeId} - محاولة استخدام توكن المستخدم الحالي...`);
            
            employeeTokenData = await getTokenForUser(user.id, orderAccount === 'افتراضي' ? null : orderAccount, orderPartner, true);
            
            if (employeeTokenData) {
              devLog.log(`✅ تم استخدام توكن المستخدم الحالي (${orderAccount}) لمزامنة طلبات الموظف ${employeeId}`);
            }
          }
          
          // ✅ إذا لم يوجد توكن: تحذير وتخطي
          if (!employeeTokenData) {
            devLog.warn(`❌ [SYNC-BATCH] لا يوجد توكن للحساب "${orderAccount}" في ${orderPartner} - تخطي ${groupOrders.length} طلب`);
            
            toast({
              title: "⚠️ تحذير: حساب غير متصل",
              description: `${groupOrders.length} طلب من ${orderPartner} (${orderAccount}) لم تتم مزامنتها - يرجى تسجيل الدخول لهذا الحساب`,
              variant: "destructive"
            });
            
            continue;
          }

          // ✅ التحقق من صلاحية Token لـ MODON
          if (employeeTokenData.partner_name === 'modon') {
            if (!employeeTokenData.token || employeeTokenData.token.length < 10) {
              devLog.log(`❌ MODON token غير صالح للموظف: ${employeeId}`);
              toast({
                title: "خطأ في token مدن",
                description: `يرجى تسجيل الدخول مجدداً إلى مدن`,
                variant: "destructive"
              });
              continue;
            }
            
            devLog.log(`✅ MODON token صالح للموظف: ${employeeId}`, {
              tokenLength: employeeTokenData.token.length,
              tokenPreview: employeeTokenData.token.substring(0, 15) + '...'
            });
          }

          // ✅ تعريف partnerName في البداية ليكون متاحاً في كل مكان
          const partnerName = employeeTokenData.partner_name === 'modon' ? 'مدن' : 'الوسيط';
          const accountUsed = employeeTokenData.account_username || employeeTokenData.account_label || 'افتراضي';
          
          devLog.log(`🔄 [SYNC-BATCH] مزامنة ${groupOrders.length} طلب ${partnerName} (${accountUsed}) - Employee: ${employeeId}`);
          
          // استدعاء API المناسب حسب partner_name
          let merchantOrders;
          try {
            console.log(`🚀 [${partnerName}] سيتم الآن استدعاء getMerchantOrders...`);
            console.log(`🔑 Token preview: ${employeeTokenData.token.substring(0, 20)}...`);
            
          if (employeeTokenData.partner_name === 'modon') {
              console.log('📞 ===== [MODON] استدعاء getMerchantOrders =====');
              console.log('🔑 Token preview:', employeeTokenData.token.substring(0, 20) + '...');
              console.log('🔑 Token length:', employeeTokenData.token.length);
              
              try {
                merchantOrders = await ModonAPI.getMerchantOrders(employeeTokenData.token);
                
                console.log('✅ ===== [MODON] تم استلام الرد =====');
                console.log('📊 عدد الطلبات:', merchantOrders?.length || 0);
                console.log('📦 نوع البيانات:', Array.isArray(merchantOrders) ? 'Array' : typeof merchantOrders);
                
                if (merchantOrders && merchantOrders.length > 0) {
                  console.log('📝 عينة من الطلب الأول:', {
                    id: merchantOrders[0].id,
                    qr_id: merchantOrders[0].qr_id,
                    status_id: merchantOrders[0].status_id,
                    client_name: merchantOrders[0].client_name
                  });
                }
              } catch (modonError) {
                console.error('❌ ===== [MODON] خطأ في getMerchantOrders =====');
                console.error('الخطأ:', modonError.message);
                console.error('Stack:', modonError.stack);
                
                toast({
                  title: "❌ خطأ في مزامنة مدن",
                  description: `فشل جلب الطلبات: ${modonError.message}\n\nتحقق من:\n• صلاحية Token\n• الاتصال بـ MODON\n• السجلات في Console`,
                  variant: 'destructive',
                  duration: 10000
                });
                
                // ❌ إيقاف المعالجة لهذا الموظف
                continue;
              }
            } else {
              // ✅ جلب الطلبات الظاهرة فقط باستخدام getOrdersByIdsBulk (أسرع وأدق)
              console.log('📞 استدعاء AlWaseetAPI.getOrdersByIdsBulk للطلبات الظاهرة...');
              
              // جمع IDs الطلبات الظاهرة للمجموعة الحالية
              const orderIds = groupOrders
                .map(o => o.delivery_partner_order_id || o.tracking_number || o.qr_id)
                .filter(Boolean);

              if (orderIds.length > 0) {
                // ⚡ حد API الوسيط الصحيح = 25 طلب لكل دفعة
                const ALWASEET_BULK_LIMIT = 25;
                const PARALLEL_LIMIT = 1; // ✅ طلب واحد فقط في كل مرة (تقليل من 2)
                const DELAY_BETWEEN_BATCHES = 500; // ✅ زيادة التأخير من 200ms إلى 500ms
                
                const chunks = [];
                for (let i = 0; i < orderIds.length; i += ALWASEET_BULK_LIMIT) {
                  chunks.push(orderIds.slice(i, i + ALWASEET_BULK_LIMIT));
                }
                
                merchantOrders = [];
                console.log(`📦 سيتم جلب ${orderIds.length} طلب في ${chunks.length} دفعة(s) بالتوازي (حد=${PARALLEL_LIMIT})`);
                
                // معالجة بالتوازي مع حد = 1 طلب متزامن فقط
                for (let i = 0; i < chunks.length; i += PARALLEL_LIMIT) {
                  const parallelChunks = chunks.slice(i, i + PARALLEL_LIMIT);
                  
                  const batchPromises = parallelChunks.map(async (chunk) => {
                    try {
                      apiCallsCount++; // ✅ زيادة عداد الاستدعاءات
                      const batchOrders = await AlWaseetAPI.getOrdersByIdsBulk(
                        employeeTokenData.token,
                        chunk
                      );
                      console.log(`✅ [Bulk] جلب ${batchOrders?.length || 0} طلب من ${chunk.length} مطلوب`);
                      return batchOrders || [];
                    } catch (err) {
                      console.error(`❌ خطأ في جلب دفعة:`, err);
                      return [];
                    }
                  });
                  
                  const results = await Promise.allSettled(batchPromises);
                  results.forEach(result => {
                    if (result.status === 'fulfilled') {
                      merchantOrders.push(...result.value);
                    }
                  });
                  
                  // تأخير بين مجموعات التوازي
                  if (i + PARALLEL_LIMIT < chunks.length) {
                    await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
                  }
                }
                
                console.log('✅ تم استلام رد من AlWaseet (Bulk):', {
                  ordersCount: merchantOrders?.length || 0,
                  requestedCount: orderIds.length,
                  isArray: Array.isArray(merchantOrders),
                  sampleOrder: merchantOrders?.[0] ? {
                    qr_id: merchantOrders[0].qr_id,
                    tracking_number: merchantOrders[0].tracking_number,
                    status_id: merchantOrders[0].status_id
                  } : 'لا توجد طلبات'
                });
              } else {
                merchantOrders = [];
                console.log('⚠️ لا توجد طلبات ظاهرة للمزامنة');
              }
            }
            
          if (!merchantOrders || !Array.isArray(merchantOrders) || merchantOrders.length === 0) {
            
            // ⚠️ إذا كانت MODON ولا توجد طلبات، قد يكون لا توجد فواتير
            if (employeeTokenData.partner_name === 'modon' && (!merchantOrders || merchantOrders.length === 0)) {
              devLog.log(`⚠️ لا توجد طلبات من ${partnerName} - قد لا تكون هناك فواتير مُستَلمة`);
              
              // محاولة التحقق من الفواتير
              try {
                const invoices = await ModonAPI.getMerchantInvoices(employeeTokenData.token);
                devLog.log(`📋 فواتير مدن المتاحة: ${invoices?.length || 0}`, {
                  hasInvoices: invoices && invoices.length > 0,
                  invoicesSample: invoices?.slice(0, 3)
                });
                
                if (!invoices || invoices.length === 0) {
                  devLog.log('💡 نصيحة: تأكد من وجود فواتير مُستَلمة في حساب مدن');
                }
              } catch (err) {
                console.error('❌ خطأ في التحقق من فواتير مدن:', err);
              }
            }
            
            devLog.log(`⚠️ لم يتم الحصول على طلبات صالحة من ${partnerName} للموظف: ${employeeId}`);
            
            toast({
              title: `تحذير: فشل مزامنة ${partnerName}`,
                description: `تعذر الحصول على طلبات الموظف من ${partnerName}. تحقق من تسجيل الدخول.`,
                variant: 'destructive',
                duration: 5000
              });
              continue;
            }
          } catch (apiError) {
            console.error(`❌ ===== [${partnerName}] خطأ في getMerchantOrders =====`);
            console.error('الخطأ:', apiError.message);
            console.error('Stack:', apiError.stack);
            
            // ⚡ تتبع أخطاء Rate Limiting للCircuit Breaker
            const isRateLimitError = 
              apiError.message?.includes('تجاوزت الحد المسموح به') || 
              apiError.message?.includes('rate limit') ||
              apiError.message?.includes('429');
            
            if (isRateLimitError) {
              consecutiveRateLimitErrors++;
              
              // ✅ Circuit Breaker: إيقاف المزامنة بعد 5 أخطاء متتالية
              if (consecutiveRateLimitErrors >= MAX_RATE_LIMIT_ERRORS) {
                console.error(`🛑 تم إيقاف المزامنة - تجاوز الحد الأقصى لأخطاء Rate Limiting (${MAX_RATE_LIMIT_ERRORS})`);
                toast({
                  title: "⚠️ تم إيقاف المزامنة مؤقتاً",
                  description: "تم تجاوز الحد المسموح به. يُرجى الانتظار 5 دقائق قبل المزامنة مجدداً.",
                  variant: "destructive",
                  duration: 10000
                });
                
                // إعادة تعيين بعد 5 دقائق
                setTimeout(() => {
                  consecutiveRateLimitErrors = 0;
                  console.log('✅ تم إعادة تعيين Circuit Breaker');
                }, 5 * 60 * 1000);
                
                break; // الخروج من المزامنة
              }
            } else {
              consecutiveRateLimitErrors = 0; // إعادة تعيين إذا لم يكن rate limit
            }
            
            toast({
              title: `❌ خطأ في مزامنة ${partnerName}`,
              description: `فشل جلب الطلبات: ${apiError.message}\n\nتحقق من:\n• صلاحية Token\n• الاتصال بـ ${partnerName}\n• السجلات في Console`,
              variant: 'destructive',
              duration: 10000
            });
            
            // ❌ إيقاف المعالجة لهذا الموظف
            continue;
          }

          devLog.log(`📦 تم جلب ${merchantOrders.length} طلب من ${partnerName}:`, {
            partnerName: employeeTokenData.partner_name,
            sampleOrder: merchantOrders[0],
            fields: merchantOrders[0] ? Object.keys(merchantOrders[0]) : [],
            trackingNumbers: merchantOrders.slice(0, 5).map(o => ({
              id: o.id,
              qr_id: o.qr_id,
              status_id: o.status_id,
              delivery_price: o.delivery_price,
              price: o.price
            }))
          });

          // تحديث كل طلب محلي بناءً على بيانات الوسيط
          let groupUpdated = 0;
          for (const localOrder of groupOrders) {
            const trackingIds = [
              localOrder.tracking_number,
              localOrder.qr_id,
              localOrder.delivery_partner_order_id
            ].filter(Boolean);

            // البحث عن الطلب في بيانات الوسيط
            const isModon = employeeTokenData.partner_name === 'modon';
            const remoteOrder = merchantOrders.find(ro => {
              if (isModon) {
                // MODON يستخدم: id, qr_id فقط
                return trackingIds.some(id => 
                  String(ro.id) === String(id) || 
                  String(ro.qr_id) === String(id)
                );
              } else {
                // AlWaseet يستخدم: tracking_number, qr_id, id, order_id
                return trackingIds.some(id => 
                  ro.tracking_number === id || 
                  ro.qr_id === id || 
                  ro.id === id ||
                  ro.order_id === id
                );
              }
            });

            if (remoteOrder) {
              // ✅ الطلب موجود في getMerchantOrders - تحديث عادي
              let statusId, newDeliveryStatus;
              
              if (isModon) {
                // MODON: استخدام status_id مباشرة
                statusId = remoteOrder.status_id;
                newDeliveryStatus = String(statusId);
              } else {
                // AlWaseet: منطق معقد للحالات
                statusId = remoteOrder.status_id || remoteOrder.state_id;
                
                if (statusId) {
                  newDeliveryStatus = String(statusId);
                } 
                // ✅ Fallback 1: state_id للتسليم
                else if (remoteOrder.state_id === 4 || remoteOrder.state_id === '4') {
                  newDeliveryStatus = '4';
                  
                }
                // ✅ Fallback 2: status_text يحتوي "تسليم"
                else if (remoteOrder.status_text && (
                  remoteOrder.status_text.includes('تسليم') || 
                  remoteOrder.status_text.toLowerCase().includes('deliver')
                )) {
                  newDeliveryStatus = '4';
                  
                }
                // ✅ Fallback 3: deliver_confirmed_fin
                else if (remoteOrder.deliver_confirmed_fin === 1 || remoteOrder.deliver_confirmed_fin === '1') {
                  newDeliveryStatus = '4';
                  
                }
                // Fallback 4: status_text للإرجاع
                else if (remoteOrder.status_text === 'تم الارجاع الى التاجر') {
                  newDeliveryStatus = '17';
                } 
                // Fallback 5: استخدام النص كما هو
                else {
                  newDeliveryStatus = remoteOrder.status_text;
                }
                
                // 🔍 Logging مفصّل للتشخيص
                console.log(`🔍 [SYNC-DETAIL] الطلب ${localOrder.tracking_number}:`, {
                  from_api: {
                    id: remoteOrder.id,
                    status_id: remoteOrder.status_id,
                    state_id: remoteOrder.state_id,
                    status_text: remoteOrder.status,
                    deliver_confirmed: remoteOrder.deliver_confirmed_fin
                  },
                  computed: {
                    statusId,
                    newDeliveryStatus
                  },
                  current_in_db: {
                    status: localOrder.status,
                    delivery_status: localOrder.delivery_status
                  }
                });
              }
              
              // استخدام التعريف الصحيح حسب الشريك
              const statusConfig = isModon 
                ? getModonStatusConfig(statusId, remoteOrder.status, localOrder.status)
                : getStatusConfig(newDeliveryStatus);
              
              // 🔍 الخطوة 1: التحقق من partial_delivery_history وجلب delivered_revenue
              // 🔒 حماية partial_delivery - لا تغيير لـ status عند المزامنة
              const isPartialDelivery = localOrder.order_type === 'partial_delivery';

              // ✅ منطق أولوية مطلقة لتحديد الحالة الصحيحة
              let newStatus;
              
              // 🔒 الأولوية 0: حماية الطلبات المستلمة فواتيرها (محمية 100%)
              if (localOrder.receipt_received === true || localOrder.delivery_partner_invoice_id) {
                newStatus = localOrder.status; // لا تغيير أبداً
                console.log(`🔒 [INVOICE-PROTECTED] ${localOrder.tracking_number} محمي (فاتورة مستلمة)`);
              }
              // 🔒 الأولوية 1: حماية delivered و completed
              else if (localOrder.status === 'delivered' || localOrder.status === 'completed') {
                newStatus = localOrder.status;
                console.log(`🔒 [FINAL-PROTECTED] ${localOrder.tracking_number} محمي (${localOrder.status})`);
              }
              // 📦 الأولوية 2: معالجة خاصة لطلبات partial_delivery
              else if (isPartialDelivery) {
                // ✅ partial_delivery: status يبقى كما هو - فقط delivery_status يتغير
                newStatus = localOrder.status;
                devLog.info(`📦 [PARTIAL-PROTECTED] ${localOrder.tracking_number} محمي - status: ${localOrder.status}`);
                
                // 🔥 جلب delivered_revenue من partial_delivery_history لتحديث final_amount
                const { data: partialHistory } = await supabase
                  .from('partial_delivery_history')
                  .select('delivered_revenue, delivery_fee_allocated')
                  .eq('order_id', localOrder.id)
                  .maybeSingle();
                
                if (partialHistory?.delivered_revenue) {
                  // 🔥 تحديث final_amount + discount = 0 مباشرة أثناء المزامنة
                  // Trigger في database سيضمن التزامن، لكن نحدث هنا للضمان الفوري
                  devLog.info(`💰 [PARTIAL-SYNC] تحديث final_amount للطلب ${localOrder.tracking_number}:`, {
                    deliveredRevenue: partialHistory.delivered_revenue,
                    discount: 0,
                    deliveryFeeAllocated: partialHistory.delivery_fee_allocated
                  });
                  
                  // ✅ تحديث مباشر لقاعدة البيانات بدلاً من orderUpdates غير المعرّف
                  await supabase
                    .from('orders')
                    .update({ 
                      final_amount: partialHistory.delivered_revenue,
                      discount: 0
                    })
                    .eq('id', localOrder.id);
                }
              }
              // ✅ الأولوية 3: delivery_status الصريح (للطلبات العادية)
              else if (newDeliveryStatus === '4') {
                newStatus = 'delivered';
              } else if (newDeliveryStatus === '17') {
                newStatus = 'returned_in_stock';
                
                // ✅ استدعاء النظام المثالي لمعالجة الحالة 17
                try {
                  const { handleReturnStatusChange } = await import('@/utils/return-status-handler');
                  const returnResult = await handleReturnStatusChange(localOrder.id, '17');
                  
                  if (returnResult.success) {
                    console.log('✅ [RETURN-17] تم معالجة الحالة 17 بنجاح:', {
                      order: localOrder.tracking_number,
                      processedItems: returnResult.processedItems,
                      financialResult: returnResult.financialResult
                    });
                    
                    // ✅ إشعار للطلبات العادية (التي يتم تخطيها في handleReturnStatusChange)
                    if (returnResult.skipped) {
                      await supabase.from('notifications').insert({
                        user_id: localOrder.created_by,
                        title: '📦 طلب مُرجع من شركة التوصيل',
                        message: `تم إرجاع الطلب ${localOrder.tracking_number} (${localOrder.customer_name}) من شركة التوصيل - الحالة 17`,
                        type: 'order_returned',
                        related_order_id: localOrder.id,
                        data: { 
                          tracking_number: localOrder.tracking_number,
                          delivery_status: '17',
                          order_type: localOrder.order_type || 'regular'
                        }
                      });
                      console.log('✅ [RETURN-17] تم إرسال إشعار للطلب العادي المُرجع');
                    }
                  } else {
                    console.error('❌ [RETURN-17] خطأ في معالجة الحالة 17:', returnResult.error);
                  }
                } catch (error) {
                  console.error('❌ [RETURN-17] خطأ في استدعاء handleReturnStatusChange:', error);
                }
              } else if (newDeliveryStatus === '31' || newDeliveryStatus === '32') {
                // ✅ مرفوض - يبقى محجوز حتى يرجع فعلياً (delivery_status = 17)
                newStatus = 'returned';
              }
              // ✅ الأولوية 4: استخدام statusConfig
              else {
                newStatus = statusConfig.localStatus || statusConfig.internalStatus || 'delivery';
              }
              
              // 🔍 Logging للحالة المحسوبة
              console.log(`📊 [SYNC-STATUS] الطلب ${localOrder.tracking_number}:`, {
                statusConfig: {
                  internalStatus: statusConfig.internalStatus,
                  localStatus: statusConfig.localStatus,
                  text: statusConfig.text
                },
                computed_newStatus: newStatus,
                will_change: localOrder.status !== newStatus,
                change_from_to: localOrder.status !== newStatus ? `${localOrder.status} → ${newStatus}` : 'no change'
              });
              
              // ✅ استخدام delivery_fee من الطلب المحلي (الإعدادات)، وليس من API
              const newDeliveryFee = localOrder.delivery_fee || 0;
              const newReceiptReceived = statusConfig.receiptReceived ?? false;

              // ✅ تخطي الطلبات المحمية تماماً
              const isProtected = (
                localOrder.receipt_received === true ||
                localOrder.delivery_partner_invoice_id ||
                localOrder.status === 'completed' ||
                localOrder.status === 'returned_in_stock'
              );

              if (isProtected) {
                console.log(`🔒 [PROTECTED] ${localOrder.tracking_number} محمي - لا تحديث`);
                continue; // تخطي التحديث تماماً
              }

              // تحديث الطلب إذا تغيرت بياناته
              const needsUpdate = (
                localOrder.delivery_status !== newDeliveryStatus ||
                localOrder.status !== newStatus ||
                localOrder.delivery_fee !== newDeliveryFee ||
                localOrder.receipt_received !== newReceiptReceived ||
                !localOrder.delivery_partner_order_id ||
                (remoteOrder.city_name && localOrder.customer_city !== remoteOrder.city_name) ||
                (remoteOrder.region_name && localOrder.customer_province !== remoteOrder.region_name)
              );
              
              // 🔍 Logging لسبب التحديث أو عدمه
              console.log(`🔄 [SYNC-UPDATE] الطلب ${localOrder.tracking_number}:`, {
                needsUpdate,
                reasons: {
                  delivery_status_changed: localOrder.delivery_status !== newDeliveryStatus,
                  status_changed: localOrder.status !== newStatus,
                  delivery_fee_changed: localOrder.delivery_fee !== newDeliveryFee,
                  receipt_changed: localOrder.receipt_received !== newReceiptReceived,
                  missing_partner_id: !localOrder.delivery_partner_order_id
                },
                changes: needsUpdate ? {
                  delivery_status: `${localOrder.delivery_status} → ${newDeliveryStatus}`,
                  status: `${localOrder.status} → ${newStatus}`,
                  delivery_fee: `${localOrder.delivery_fee} → ${newDeliveryFee}`,
                  receipt_received: `${localOrder.receipt_received} → ${newReceiptReceived}`
                } : 'لا توجد تغييرات'
              });

              if (needsUpdate) {
                const updates = {
                  delivery_status: newDeliveryStatus,
                  status: newStatus,
                  delivery_fee: newDeliveryFee,
                  receipt_received: newReceiptReceived,
                  delivery_partner_order_id: isModon ? String(remoteOrder.id) : (remoteOrder.id || remoteOrder.order_id),
                  updated_at: new Date().toISOString()
                };

                // ✅ تحويل order_type فوراً عند الحالة 21 لأول مرة
                if (newDeliveryStatus === '21' && localOrder.order_type !== 'partial_delivery') {
                  updates.order_type = 'partial_delivery';
                  console.log(`🔄 [PARTIAL-DELIVERY] تحويل نوع الطلب ${localOrder.tracking_number} إلى partial_delivery`);
                }

                // ✅ مزامنة المدينة/المنطقة من شركة التوصيل (بدون استهلاك API إضافي)
                if (remoteOrder.city_name && localOrder.customer_city !== remoteOrder.city_name) {
                  updates.customer_city = remoteOrder.city_name;
                }
                if (remoteOrder.region_name && localOrder.customer_province !== remoteOrder.region_name) {
                  updates.customer_province = remoteOrder.region_name;
                }

                // تحديث الطلب في قاعدة البيانات
                const { error } = await supabase
                  .from('orders')
                  .update(updates)
                  .eq('id', localOrder.id);

                if (!error) {
                  groupUpdated++;
                  totalUpdated++;
                  console.log(`✅ [SYNC-SUCCESS] تم تحديث ${localOrder.tracking_number} بنجاح`);
                  
                  // ✅ إرسال إشعار تغيير الحالة
                  if (localOrder.delivery_status !== newDeliveryStatus) {
                    devLog.log('📢 [SYNC] إرسال إشعار تغيير حالة:', { 
                      trackingNumber: localOrder.tracking_number, 
                      oldStatus: localOrder.delivery_status,
                      newStatus: newDeliveryStatus,
                      statusText: statusConfig.text 
                    });
                    createOrderStatusNotification(
                      localOrder.tracking_number, 
                      newDeliveryStatus, 
                      statusConfig.text,
                      localOrder.id // ✅ UUID الحقيقي
                    );
                  }
                } else {
                  // ✅ إضافة logging مفصّل للأخطاء
                  console.error(`❌ [SYNC-ERROR] فشل تحديث الطلب ${localOrder.tracking_number}:`, {
                    error_code: error.code,
                    error_message: error.message,
                    error_details: error.details,
                    error_hint: error.hint,
                    attempted_updates: updates,
                    order_id: localOrder.id,
                    tracking_number: localOrder.tracking_number
                  });
                  
                  // Toast للمستخدم مع تفاصيل الخطأ
                  toast({
                    title: '❌ خطأ في مزامنة الطلب',
                    description: `الطلب ${localOrder.tracking_number}: ${error.message || 'خطأ غير معروف'}`,
                    variant: 'destructive'
                  });
                }
              } else {
                // ✅ حتى لو لم تتغير البيانات، نحدث وقت المزامنة
                await supabase
                  .from('orders')
                  .update({ updated_at: new Date().toISOString() })
                  .eq('id', localOrder.id);
                
                console.log(`⏰ [SYNC-TIMESTAMP] تم تحديث وقت ${localOrder.tracking_number} فقط (لا تغيير في البيانات)`);
              }
            } else {
              // ⚠️ الطلب غير موجود في getMerchantOrders
              // (ربما مكتمل delivery_status=4 أو قديم)
              // استخدام getOrderById كـ fallback
              
              devLog.warn(`⚠️ الطلب ${localOrder.tracking_number} غير موجود في merchant-orders`);
              devLog.log(`   → جلبه مباشرة باستخدام getOrderById...`);
              
              try {
                const directOrder = await AlWaseetAPI.getOrderById(
                  employeeTokenData.token,
                  localOrder.qr_id || localOrder.tracking_number
                );
                
                if (directOrder) {
                  // تطبيق نفس منطق التحديث
                  const statusId = directOrder.status_id || directOrder.state_id;
                  let newDeliveryStatus;
                  
                  if (statusId) {
                    newDeliveryStatus = String(statusId);
                  } 
                  // ✅ Fallback 1: state_id للتسليم
                  else if (directOrder.state_id === 4 || directOrder.state_id === '4') {
                    newDeliveryStatus = '4';
                  }
                  // ✅ Fallback 2: status_text يحتوي "تسليم"
                  else if (directOrder.status_text && (
                    directOrder.status_text.includes('تسليم') || 
                    directOrder.status_text.toLowerCase().includes('deliver')
                  )) {
                    newDeliveryStatus = '4';
                  }
                  // ✅ Fallback 3: deliver_confirmed_fin
                  else if (directOrder.deliver_confirmed_fin === 1 || directOrder.deliver_confirmed_fin === '1') {
                    newDeliveryStatus = '4';
                  }
                  // Fallback 4: status_text للإرجاع
                  else if (directOrder.status_text === 'تم الارجاع الى التاجر') {
                    newDeliveryStatus = '17';
                  } 
                  // Fallback 5: استخدام النص كما هو
                  else {
                    newDeliveryStatus = directOrder.status_text;
                  }
                  
                  const statusConfig = getStatusConfig(newDeliveryStatus);
                  
                  // 🔒 فحص partial_delivery_history لحماية التسليم الجزئي
                  const { data: partialHistory } = await supabase
                    .from('partial_delivery_history')
                    .select('id, delivered_revenue, delivery_fee_allocated')
                    .eq('order_id', localOrder.id)
                    .maybeSingle();

                  const isPartialDeliveryFlagged = !!partialHistory;

                  // 🔧 تصحيح final_amount تلقائياً إذا كان الطلب تسليم جزئي
                  if (isPartialDeliveryFlagged && partialHistory.delivered_revenue) {
                    const correctFinalAmount = parseFloat(partialHistory.delivered_revenue);
                    const currentFinalAmount = parseFloat(localOrder.final_amount) || 0;
                    
                    if (Math.abs(correctFinalAmount - currentFinalAmount) > 1) {
                      console.log(`🔧 [AUTO-FIX-FALLBACK] تصحيح final_amount للطلب ${localOrder.tracking_number}: ${currentFinalAmount} → ${correctFinalAmount}`);
                      
                      await supabase
                        .from('orders')
                        .update({ 
                          final_amount: correctFinalAmount,
                          updated_at: new Date().toISOString()
                        })
                        .eq('id', localOrder.id);
                      
                      localOrder.final_amount = correctFinalAmount;
                    }
                  }

                  // ✅ منطق بسيط ومباشر - حماية التسليم الجزئي
                  let newStatus;

                  // 🔒 الأولوية 1: حماية التسليم الجزئي (ما عدا الحالة 17)
                  if (isPartialDeliveryFlagged && newDeliveryStatus !== '17') {
                    newStatus = 'partial_delivery';
                    console.log(`🔒 [PARTIAL-PROTECTED-FALLBACK] ${localOrder.tracking_number} محمي كتسليم جزئي (delivery_status: ${newDeliveryStatus})`);
                  }
                  // ✅ الأولوية 2: الحالة 17 - مرتجع في المخزون
                  else if (newDeliveryStatus === '17') {
                    newStatus = 'returned_in_stock';
                    console.log(`🔄 [STATUS-17-FALLBACK] ${localOrder.tracking_number} → returned_in_stock`);
                  }
                  // ✅ الأولوية 3: حماية completed
                  else if (localOrder.status === 'completed') {
                    newStatus = 'completed';
                    console.log(`🔒 [COMPLETED-PROTECTED-FALLBACK] ${localOrder.tracking_number} محمي كمكتمل`);
                  }
                  // ✅ الأولوية 4: استخدام statusConfig مباشرة
                  else {
                    newStatus = statusConfig.localStatus || statusConfig.internalStatus;
                    
                    // ✅ تحذير فقط إذا لم نجد mapping
                    if (!newStatus) {
                      console.error(`❌ [CRITICAL-FALLBACK] الحالة ${newDeliveryStatus} غير معرّفة!`);
                      newStatus = localOrder.status; // ✅ نترك الحالة كما هي
                    }
                  }
                  const newDeliveryFee = parseFloat(directOrder.delivery_fee) || 0;
                  const newReceiptReceived = statusConfig.receiptReceived ?? false;

                  const needsUpdate = (
                    localOrder.delivery_status !== newDeliveryStatus ||
                    localOrder.status !== newStatus ||
                    localOrder.delivery_fee !== newDeliveryFee ||
                    localOrder.receipt_received !== newReceiptReceived ||
                    !localOrder.delivery_partner_order_id ||
                    (directOrder.city_name && localOrder.customer_city !== directOrder.city_name) ||
                    (directOrder.region_name && localOrder.customer_province !== directOrder.region_name)
                  );

                  if (needsUpdate) {
                    const updates = {
                      delivery_status: newDeliveryStatus,
                      status: newStatus,
                      delivery_fee: newDeliveryFee,
                      receipt_received: newReceiptReceived,
                      delivery_partner_order_id: directOrder.id || directOrder.order_id,
                      updated_at: new Date().toISOString()
                    };

                    // ✅ مزامنة المدينة/المنطقة من شركة التوصيل (fallback)
                    if (directOrder.city_name && localOrder.customer_city !== directOrder.city_name) {
                      updates.customer_city = directOrder.city_name;
                    }
                    if (directOrder.region_name && localOrder.customer_province !== directOrder.region_name) {
                      updates.customer_province = directOrder.region_name;
                    }

                    const { error } = await supabase
                      .from('orders')
                      .update(updates)
                      .eq('id', localOrder.id);

                    if (!error) {
                      totalUpdated++;
                      devLog.log(`✅ تم تحديث ${localOrder.tracking_number} عبر getOrderById (fallback)`);
                      
                      // ✅ إرسال إشعار تغيير الحالة للـ fallback أيضاً
                      if (localOrder.delivery_status !== newDeliveryStatus) {
                        devLog.log('📢 [FALLBACK] إرسال إشعار تغيير حالة:', { 
                          trackingNumber: localOrder.tracking_number, 
                          oldStatus: localOrder.delivery_status,
                          newStatus: newDeliveryStatus,
                          statusText: statusConfig.text 
                        });
                        createOrderStatusNotification(
                          localOrder.tracking_number, 
                          newDeliveryStatus, 
                          statusConfig.text,
                          localOrder.id // ✅ UUID الحقيقي
                        );
                      }
                    } else {
                      console.error(`❌ خطأ تحديث ${localOrder.tracking_number}:`, error);
                    }
                  } else {
                    // تحديث الوقت فقط (لإظهار أن المزامنة حدثت)
                    await supabase
                      .from('orders')
                      .update({ updated_at: new Date().toISOString() })
                      .eq('id', localOrder.id);
                    
                    devLog.log(`⏰ تم تحديث وقت ${localOrder.tracking_number} عبر fallback (لا تغيير)`);
                  }
                } else {
                  devLog.warn(`❌ الطلب ${localOrder.tracking_number} غير موجود حتى في getOrderById!`);
                  
                  // ⚠️ الطلب غير موجود - فحص إمكانية الحذف التلقائي
                  if (canAutoDeleteOrder(localOrder, user)) {
                    devLog.log(`🗑️ [AUTO-DELETE-CHECK] الطلب ${localOrder.tracking_number} غير موجود - بدء فحص الحذف...`);
                    
                    // ✅ جلب توكن الحساب المحدد
                    const deleteToken = await getTokenForUser(
                      localOrder.created_by, 
                      localOrder.delivery_account_used, 
                      localOrder.delivery_partner, 
                      true // strict mode
                    );
                    
                    // ⛔ لا تحذف إذا لم يوجد توكن صالح
                    if (!deleteToken) {
                      devLog.warn(`⛔ إيقاف الحذف - لا يوجد توكن صالح للحساب "${localOrder.delivery_account_used}"`);
                      toast({
                        title: "⚠️ توكن منتهي",
                        description: `لم يتم التحقق من الطلب ${localOrder.tracking_number}. سجّل دخول للحساب أولاً.`,
                        variant: "warning",
                        duration: 8000
                      });
                    } else {
                      // ✅ فحص 3 مرات بتأخير
                      let foundOrder = false;
                      const RETRY_DELAYS = [0, 2000, 4000];
                      
                      for (let attempt = 1; attempt <= 3; attempt++) {
                        if (attempt > 1) await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt-1]));
                        
                        devLog.log(`🔍 محاولة ${attempt}/3: فحص ${localOrder.tracking_number}`);
                        
                        try {
                          // طريقة 1: بـ QR
                          let found = await AlWaseetAPI.getOrderByQR(deleteToken.token, localOrder.tracking_number);
                          
                          // طريقة 2: بـ ID (fallback)
                          if (!found && localOrder.delivery_partner_order_id) {
                            found = await AlWaseetAPI.getOrderById(deleteToken.token, localOrder.delivery_partner_order_id);
                          }
                          
                          if (found) {
                            foundOrder = true;
                            devLog.log(`✅ محاولة ${attempt}: الطلب موجود - لن يُحذف`);
                            break;
                          }
                        } catch (e) {
                          devLog.warn(`⚠️ محاولة ${attempt} فشلت: ${e.message}`);
                        }
                      }
                      
                      // ✅ حذف فقط بعد 3 محاولات فاشلة
                      if (!foundOrder) {
                        devLog.log(`🗑️ الطلب ${localOrder.tracking_number} غير موجود بعد 3 محاولات - سيُحذف`);
                        
                        toast({
                          title: "🗑️ طلب محذوف من شركة التوصيل",
                          description: `الطلب ${localOrder.tracking_number} غير موجود وتم حذفه محلياً`,
                          variant: "warning",
                          duration: 8000
                        });
                        
                        await handleAutoDeleteOrder(localOrder.id, 'syncVisibleBatch');
                      }
                    }
                  }
                }
              } catch (directError) {
                // ✅ معالجة خاصة لـ Rate Limiting - لا نوقف المزامنة
                if (directError.message?.includes('تجاوزت الحد المسموح به') || 
                    directError.message?.includes('rate limit')) {
                  devLog.warn(`⚠️ Rate limit للطلب ${localOrder.tracking_number} - سنحاول لاحقاً`);
                  // لا نرفع console.error هنا لتجنب إزعاج المستخدم
                } else {
                  console.error(`❌ خطأ جلب ${localOrder.tracking_number} مباشرة:`, directError);
                }
              }
            }
          }

            processedGroups++;
            devLog.log(`✅ تمت معالجة المجموعة ${processedGroups}/${ordersByKey.size} - تم تحديث ${groupUpdated} طلب`);
            
          } catch (groupError) {
            console.error(`❌ خطأ في معالجة المجموعة ${syncKey}:`, groupError);
          }
          
          // ✅ تأخير بين المجموعات للحفاظ على استقرار API
          if (processedGroups < ordersByKey.size) {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_GROUPS));
          }
        }
        
        // ✅ إعادة تعيين Circuit Breaker عند النجاح
        consecutiveRateLimitErrors = 0;
        
        devLog.log(`🎉 انتهت مزامنة الدفعة - ${totalUpdated} طلب محدث من ${processedGroups} مجموعة`);
        
        // ⏱️ عرض إحصائيات المزامنة الدقيقة
        const syncDuration = ((performance.now() - syncStartTime) / 1000).toFixed(2);
        console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 [SYNC-STATS] إحصائيات المزامنة النهائية
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ تمت مزامنة: ${totalOrders} طلب
🔄 تم تحديث: ${totalUpdated} طلب
📞 استدعاءات API: ${apiCallsCount}
⏱️  المدة الإجمالية: ${syncDuration} ثانية
📈 المعدل: ${(totalOrders / parseFloat(syncDuration)).toFixed(1)} طلب/ثانية
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `);
        
        return {
          success: true, 
          updatedCount: totalUpdated,
          processedGroups,
          totalGroups: ordersByKey.size,
          syncDuration: parseFloat(syncDuration),
          apiCallsCount,
          totalOrders
        };

      } catch (error) {
        const syncDuration = ((performance.now() - syncStartTime) / 1000).toFixed(2);
        console.error(`❌ [SYNC-PERF] فشلت المزامنة بعد ${syncDuration} ثانية:`, error);
        
        console.error('❌ خطأ في مزامنة الطلبات المرئية:', error);
        return { 
          success: false, 
          error: error.message,
          updatedCount: 0,
          syncDuration: parseFloat(syncDuration)
        };
      } finally {
        // ✅ إلغاء قفل المزامنة دائماً
        globalSyncLock = false;
        globalSyncPromise = null;
      }
    })();
    
    globalSyncPromise = syncPromise;
    return await syncPromise;
  }, [getTokenForUser]);
  
  // دالة للتحقق من ملكية الطلب
  const isOrderOwner = useCallback((order, currentUser) => {
    if (!order || !currentUser) return false;
    return order.created_by === currentUser.id;
  }, []);
  
  // 🛡️ دالة محسّنة للتحقق من إمكانية حذف الطلب مع حماية ثلاثية
  const canAutoDeleteOrder = useCallback((order, currentUser = user) => {
    if (!order || !currentUser) {
      return false;
    }
    
    // فقط طلبات الوسيط
    if (order.delivery_partner !== 'alwaseet') {
      return false;
    }
    
    // عدم حذف الطلبات التي تم استلام فاتورتها
    if (order.receipt_received) {
      return false;
    }
    
    // ✅ فقط الطلبات pending تُحذف تلقائياً
    const allowedStatuses = ['pending'];
    if (!allowedStatuses.includes(order.status)) {
      return false;
    }
    
    // ✅ الحماية 1: عمر الطلب أكبر من دقيقة واحدة (حسب طلب المستخدم)
    const orderAge = Date.now() - new Date(order.created_at).getTime();
    const minAge = 1 * 60 * 1000; // دقيقة واحدة
    if (orderAge < minAge) {
      return false;
    }
    
    // ✅ الحماية 2: التحقق من أن delivery_status ليس '2' أو أعلى (لم يستلمه المندوب)
    const deliveryStatusNum = parseInt(String(order.delivery_status || '0'));
    if (deliveryStatusNum >= 2) {
      return false;
    }
    
    // ✅ الحماية 3: عدم حذف الطلبات ذات القيمة الفعلية
    const totalAmount = parseFloat(String(order.total_amount || 0));
    if (totalAmount > 0 && !order.tracking_number && !order.qr_id) {
      return false;
    }
    
    // يجب وجود معرف تتبع
    if (!order.tracking_number && !order.qr_id && !order.delivery_partner_order_id) {
      return false;
    }
    
    // التحقق من الملكية - حتى المدير لا يحذف طلبات الموظفين
    if (!isOrderOwner(order, currentUser)) {
      return false;
    }
    
    return true;
  }, [user, isOrderOwner]);
  
  // دالة مساعدة لتطبيق فصل الحسابات على جميع استعلامات الطلبات
  const scopeOrdersQuery = useCallback((query, restrictToOwnOrders = false) => {
    const userUUID = user?.user_id || user?.id;
    if (!userUUID) return query;
    
    // إذا كان restrictToOwnOrders = true، حتى المدير يحصل على طلباته فقط (للحذف الآمن)
    if (restrictToOwnOrders) {
      return query.eq('created_by', userUUID);
    }
    
    // ✅ المدير يرى جميع الطلبات للعرض - باستخدام user_id الصحيح
    if (user?.email === 'ryusbrand@gmail.com' || userUUID === '91484496-b887-44f7-9e5d-be9db5567604') {
      return query;
    }
    
    // الموظفون يرون طلباتهم فقط
    return query.eq('created_by', userUUID);
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
  const hasValidToken = useCallback(async (partnerName = null) => {
    if (!user?.id) return false;
    
    // استخدام activePartner إذا لم يتم تحديد partnerName
    const partner = partnerName || activePartner;
    
    try {
      const tokenData = await getTokenForUser(user.id, null, partner);
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

  // ✅ دالة إرسال إشعارات تغيير الحالة - مفعلة الآن
  const createOrderStatusNotification = useCallback(async (trackingNumber, stateId, statusText, orderId = null) => {
    devLog.log('📢 إرسال إشعار تغيير حالة:', { trackingNumber, stateId, statusText, orderId });
    
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
        order_id: orderId || trackingNumber, // ✅ UUID الحقيقي إذا كان متاحاً
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
        // ✅ الإشعارات تُرسل تلقائياً من database trigger: trg_send_order_notifications
        // تم تعطيل إنشاء الإشعارات من هنا لمنع التكرار
        // إنشاء إشعار جديد
        // const newNotificationData = {
        //   type: 'order_status_update',
        //   title: 'تحديث حالة الطلب',
        //   message: message,
        //   priority: priority,
        //   data: notificationData
        // };
        
        // devLog.log('📤 بيانات الإشعار الجديدة:', newNotificationData);
        // await createNotification(newNotificationData);
        // devLog.log('🆕 تم إنشاء إشعار جديد');
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
    modon: { name: "مدن", api: "https://mcht.modon-express.net/v1/merchant" },
  };


  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  // 🧹 Cleanup: تنظيف localStorage من القيم الفاسدة - نسخة قوية
  useEffect(() => {
    const cleanupLocalStorage = () => {
      try {
        const storedValue = localStorage.getItem('active_delivery_partner');
        
        if (storedValue) {
          let parsedValue;
          
          try {
            // محاولة parse كـ JSON
            parsedValue = JSON.parse(storedValue);
          } catch (e) {
            // فشل parse - القيمة فاسدة (مثل "modon" بدون JSON)
            localStorage.removeItem('active_delivery_partner');
            
            // استخراج القيمة الفعلية إذا كانت محاطة بـ quotes
            const cleanValue = storedValue.replace(/^"|"$/g, '');
            if (cleanValue !== 'local' && ['alwaseet', 'modon'].includes(cleanValue)) {
              setActivePartner(cleanValue);
            } else {
              setActivePartner('alwaseet');
            }
            return;
          }
          
          // تم parse بنجاح - تحقق من القيمة
          if (parsedValue === 'local') {
            localStorage.removeItem('active_delivery_partner');
            setActivePartner('alwaseet');
          }
        }
      } catch (error) {
        console.error('❌ خطأ في cleanup localStorage:', error);
        localStorage.removeItem('active_delivery_partner');
        setActivePartner('alwaseet');
      }
    };
    
    cleanupLocalStorage();
  }, []);

  // 🔐 Auto-Login: استعادة الجلسة تلقائياً عند بدء التطبيق
  useEffect(() => {
    const restoreSession = async () => {
      if (!user?.id || isLoggedIn) return;
      
      try {
        devLog.log('🔍 محاولة استعادة جلسة شركة التوصيل...');
        
        // ✅ الطريقة الأولى: localStorage
        const savedDefaultToken = localStorage.getItem('delivery_partner_default_token');
        if (savedDefaultToken) {
          try {
            const defaultData = JSON.parse(savedDefaultToken);
            
            
            // ✅ تفعيل الجلسة مباشرة
            setToken(defaultData.token);
            setActivePartner(defaultData.partner_name);
            setIsLoggedIn(true);
            setWaseetUser({
              username: defaultData.username,
              merchantId: defaultData.merchant_id,
              label: defaultData.label
            });
            
            // ✅ استخدام setActivePartner للحفظ الصحيح
            // بدلاً من localStorage.setItem مباشرة
            
            // ✅ تحديث last_used_at
            await supabase
              .from('delivery_partner_tokens')
              .update({ last_used_at: new Date().toISOString() })
              .eq('user_id', user.id)
              .eq('partner_name', defaultData.partner_name)
              .eq('is_default', true);
            
            return; // ✅ انتهى
          } catch (err) {
            console.error('❌ خطأ في استخدام الجلسة المحفوظة:', err);
            localStorage.removeItem('delivery_partner_default_token');
          }
        }
        
        // ✅ الطريقة الثانية: قاعدة البيانات
        
        
        let tokenData = await supabase
          .from('delivery_partner_tokens')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_default', true)
          .gt('expires_at', new Date().toISOString())
          .order('last_used_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (tokenData.data) {
          
          
          // ✅ حفظ في localStorage للمرات القادمة
          localStorage.setItem('delivery_partner_default_token', JSON.stringify({
            token: tokenData.data.token,
            partner_name: tokenData.data.partner_name,
            username: tokenData.data.account_username,
            merchant_id: tokenData.data.merchant_id,
            label: tokenData.data.account_label
          }));
          
          // ✅ سيتم حفظ اسم الشريك عبر setActivePartner أدناه
          
          // ✅ تفعيل الجلسة
          setToken(tokenData.data.token);
          setActivePartner(tokenData.data.partner_name);
          setIsLoggedIn(true);
          setWaseetUser({
            username: tokenData.data.account_username,
            merchantId: tokenData.data.merchant_id,
            label: tokenData.data.account_label
          });
        } else {
          
          
          // ✅ Fallback: تحديد الشريك الافتراضي بناءً على order_creation_mode
          const { data: profile } = await supabase
            .from('profiles')
            .select('order_creation_mode')
            .eq('user_id', user.id)
            .maybeSingle();
          
          const creationMode = profile?.order_creation_mode || 'choice';
          
          // ✅ منع 'local' من أن يكون افتراضي أبداً
          if (creationMode === 'partner_only' || creationMode === 'local_only') {
            const firstPartner = Object.keys(deliveryPartners).find(k => k !== 'local') || 'alwaseet';
            setActivePartner(firstPartner);
          
          }
          // في وضع 'choice'، لا نفعل شيء ونترك المستخدم يختار
        }
      } catch (error) {
        console.error('❌ خطأ في استعادة الجلسة:', error);
      }
    };
    
    restoreSession();
  }, [user?.id, isLoggedIn]);

  // 🔔 فحص دوري لصلاحية التوكن والإشعار قبل 24 ساعة
  useEffect(() => {
    if (!user?.id || !isLoggedIn || !token) return;
    
    const checkTokenExpiry = async () => {
      try {
        const { data: tokenData } = await supabase
          .from('delivery_partner_tokens')
          .select('expires_at, account_username, account_label')
          .eq('user_id', user.id)
          .eq('partner_name', activePartner)
          .eq('token', token)
          .maybeSingle();
        
        if (!tokenData) return;
        
        const expiresAt = new Date(tokenData.expires_at);
        const now = new Date();
        const hoursUntilExpiry = (expiresAt - now) / (1000 * 60 * 60);
        
        // إشعار إذا باقي أقل من 24 ساعة ولم يتم الإشعار مؤخراً
        if (hoursUntilExpiry > 0 && hoursUntilExpiry <= 24) {
          const lastWarningKey = `token_expiry_warning_${user.id}_${activePartner}`;
          const lastWarning = localStorage.getItem(lastWarningKey);
          const lastWarningTime = lastWarning ? new Date(lastWarning) : null;
          
          // عرض الإشعار مرة واحدة كل 6 ساعات
          if (!lastWarningTime || (now - lastWarningTime) > (6 * 60 * 60 * 1000)) {
            const hoursRemaining = Math.floor(hoursUntilExpiry);
            const partnerDisplayName = deliveryPartners[activePartner]?.name || activePartner;
            
            toast({
              title: "⚠️ تنبيه: قرب انتهاء صلاحية التوكن",
              description: `ستنتهي صلاحية تسجيل الدخول لـ ${partnerDisplayName} (${tokenData.account_label || tokenData.account_username}) خلال ${hoursRemaining} ساعة. يرجى تسجيل الدخول مجدداً لتجديد الصلاحية.`,
              variant: "default",
              duration: 10000
            });
            
            localStorage.setItem(lastWarningKey, now.toISOString());
          }
        }
        
        // ✅ تجديد تلقائي للتوكن قبل 12 ساعة من انتهاء الصلاحية أو عند انتهائها
        if (hoursUntilExpiry <= 12) {
          devLog.log(`🔄 تجديد تلقائي للتوكن (باقي ${hoursUntilExpiry} ساعة)...`);
          
          try {
            // جلب بيانات الحساب (username + password المشفرة)
            const { data: accountData, error: fetchError } = await supabase
              .from('delivery_partner_tokens')
              .select('account_username, partner_data')
              .eq('user_id', user.id)
              .eq('token', token)
              .single();
            
            if (fetchError) throw fetchError;
            
            if (accountData?.partner_data?.password) {
              devLog.log('🔐 استخدام كلمة المرور المحفوظة للتجديد...');
              
              // استدعاء تسجيل الدخول للحصول على توكن جديد
              const newTokenData = await AlWaseetAPI.loginToWaseet(
                accountData.account_username,
                accountData.partner_data.password
              );
              
              if (!newTokenData?.token) {
                throw new Error('لم يتم الحصول على توكن جديد');
              }
              
              // تحديث التوكن في قاعدة البيانات
              const newExpiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
              const { error: updateError } = await supabase
                .from('delivery_partner_tokens')
                .update({
                  token: newTokenData.token,
                  expires_at: newExpiryDate.toISOString(),
                  last_used_at: new Date().toISOString()
                })
                .eq('user_id', user.id)
                .eq('account_username', accountData.account_username);
              
              if (updateError) throw updateError;
              
              // تحديث الحالة المحلية
              setToken(newTokenData.token);
              setTokenExpiry(newExpiryDate);
              
              devLog.log('✅ تم تجديد التوكن تلقائياً بنجاح');
              
              toast({
                title: "✅ تم تجديد التوكن تلقائياً",
                description: `تم تجديد صلاحية الحساب لـ 7 أيام جديدة`,
                variant: "default",
                duration: 5000
              });
            } else {
              throw new Error('كلمة المرور غير متوفرة للتجديد التلقائي');
            }
          } catch (error) {
            // فشل التجديد التلقائي - تسجيل خروج
            console.error('❌ فشل التجديد التلقائي:', error);
            devLog.log('⚠️ فشل التجديد التلقائي. تسجيل خروج...');
            
            setToken(null);
            setWaseetUser(null);
            setIsLoggedIn(false);
            
            const partnerDisplayName = deliveryPartners[activePartner]?.name || activePartner;
            toast({
              title: "⚠️ فشل التجديد التلقائي",
              description: `يرجى تسجيل الدخول يدوياً إلى ${partnerDisplayName}`,
              variant: "destructive",
              duration: 8000
            });
          }
        }
      } catch (error) {
        console.error('❌ خطأ في فحص صلاحية التوكن:', error);
      }
    };
    
    // فحص فوري عند التحميل
    checkTokenExpiry();
    
    // فحص دوري كل ساعة
    const intervalId = setInterval(checkTokenExpiry, 60 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, [user?.id, isLoggedIn, token, activePartner]);

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
      let tokenData, partnerData;
      const expires_at = new Date();
      expires_at.setSeconds(expires_at.getSeconds() + 604800); // 7 days validity

      // استخدام الـ API المناسب حسب الشريك
      if (partner === 'modon') {
        // استخدام loginToModon مباشرةً (لأنها تستخدم multipart/form-data)
        const result = await ModonAPI.loginToModon(username, password);
        
        if (!result.success) {
          throw new Error(result.error || 'فشل تسجيل الدخول في مدن');
        }
        
        tokenData = { token: result.token };
        partnerData = { username, password };
      } else {
        // الوسيط - استخدام alwaseet-proxy
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

        tokenData = data.data;
        partnerData = { username, password };
      }

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
              is_active: true, // ✅ تفعيل التوكن عند تسجيل الدخول
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
      
      const partnerName = deliveryPartners[partner]?.name || partner;
      toast({ 
        title: "نجاح", 
        description: `تم تسجيل الدخول بنجاح في ${partnerName}.` 
      });
      
      // تشغيل مزامنة سريعة بعد 5 ثواني من تجديد التوكن
      setTimeout(() => {
        devLog.log('🔄 تشغيل فحص الطلبات المحذوفة بعد تجديد التوكن...');
        fastSyncPendingOrders(false).then(result => {
          devLog.log('✅ نتيجة الفحص التلقائي بعد تجديد التوكن:', result);
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
    
    // في حالة deleteAccount = true نعطل الحساب بدلاً من الحذف
    if (deleteAccount && user && activePartner !== 'local') {
      const { error } = await supabase
        .from('delivery_partner_tokens')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('partner_name', activePartner);
        
      if (!error) {
        toast({ 
          title: "تم تعطيل الحساب", 
          description: `تم تعطيل الحساب من ${partnerName}. يمكنك إعادة تفعيله بتسجيل الدخول مجدداً.`,
          variant: "default"
        });
      }
    } else {
      // تسجيل خروج عادي بدون حذف
      toast({ 
        title: "تم تسجيل الخروج", 
        description: `تم تسجيل الخروج من ${partnerName}.` 
      });
    }

    // تنظيف الحالة المحلية
    setIsLoggedIn(false);
    setToken(null);
    setWaseetUser(null);
    setCities([]);
    setRegions([]);
    setPackageSizes([]);
    
    // عدم تغيير activePartner إلا إذا طُلب حذف الحساب
    if (deleteAccount) {
      setActivePartner('local');
    }
  }, [activePartner, deliveryPartners, user, setActivePartner]);
  
  // تحميل حالات الطلبات وإنشاء خريطة التطابق الجديدة
  const loadOrderStatuses = useCallback(async () => {
    if (!token) return;
    
    try {
      // ✅ فقط AlWaseet تستخدم statuses endpoint
      if (activePartner !== 'alwaseet') {
        devLog.log('ℹ️ تخطي جلب حالات الطلبات - MODON تستخدم نظام حالات مختلف');
        return;
      }
      
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

      // 1. حذف الخصومات المطبقة أولاً (Fallback - CASCADE سيحذفها تلقائياً)
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
      
      // ⚠️ ملاحظة مهمة: تحرير المخزون المحجوز يتم تلقائياً عبر trigger: auto_release_stock_on_order_delete
      // لا نستدعي release_stock_item يدوياً لأن ذلك يسبب تعارض ونقص خاطئ في المخزون
      // الـ trigger يُنقص reserved_quantity فقط بشكل صحيح
      
      // 2. حذف الطلب من قاعدة البيانات (✅ الصيغة الصحيحة من Supabase)
      const { error: deleteError, data } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId)
        .select();
        
      if (deleteError) {
        devLog.error('❌ خطأ في حذف الطلب:', deleteError);
        return false;
      }
      
      if (!data || data.length === 0) {
        devLog.error('❌ لم يُحذف أي سجل - قد يكون RLS يمنع الحذف أو الطلب غير موجود');
        return false;
      }
      
      // ✅ الحذف نجح فعلياً - الآن نسجل في auto_delete_log
      devLog.log(`✅ تم حذف ${data.length} طلب فعلياً`);
      
      // 4. تسجيل الحذف في سجل الحذف التلقائي (بعد نجاح الحذف)
      try {
        await supabase.from('auto_delete_log').insert({
          order_id: orderId,
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
      
      devLog.log(`✅ تم حذف الطلب ${orderToDelete.tracking_number || orderToDelete.order_number || orderId} تلقائياً من ${source}`);
      
      // 5. إشعار المستخدم عند الحذف التلقائي
      if (source === 'fastSync') {
        toast({
          title: "حذف طلب تلقائي",
          description: `تم حذف الطلب ${orderToDelete.tracking_number || orderToDelete.order_number} وتم تحرير المخزون المحجوز تلقائياً`,
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
      // ✅ مزامنة الفواتير المستلمة أولاً
      try {
        const { data: invoiceSyncRes, error: invoiceSyncErr } = await supabase.rpc('sync_recent_received_invoices');
        if (invoiceSyncErr) {
          devLog.warn('⚠️ خطأ في مزامنة الفواتير:', invoiceSyncErr.message);
        } else if (invoiceSyncRes?.updated_orders_count > 0) {
          devLog.log(`✅ مزامنة الفواتير: تم تحديث ${invoiceSyncRes.updated_orders_count} طلب`);
        }
      } catch (invoiceError) {
        devLog.warn('⚠️ استثناء في مزامنة الفواتير:', invoiceError);
      }
      
      // تأكد من تحميل خريطة الحالات
      let statusMap = orderStatusesMap;
      if (statusMap.size === 0) {
        statusMap = await loadOrderStatuses();
      }

      // 1) اجلب الطلبات المعلقة لدينا مع تأمين فصل الحسابات
      const targetStatuses = ['pending', 'delivery', 'shipped', 'delivered', 'returned']; // ✅ إضافة delivered
      // ✅ جلب طلبات الوسيط + مدن معاً
      const { data: pendingOrders, error: pendingErr } = await scopeOrdersQuery(
        supabase
          .from('orders')
          .select('id, status, delivery_status, delivery_partner, delivery_partner_order_id, order_number, qr_id, tracking_number, receipt_received, created_by, delivery_account_used')
          .in('delivery_partner', ['alwaseet', 'modon'])
          .in('status', targetStatuses)
          .neq('delivery_status', '17') // ✅ استثناء الحالة 17 (راجع للتاجر)
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

      // ✅ تقسيم الطلبات حسب الشريك
      const alwaseetOrders = pendingOrders.filter(o => o.delivery_partner === 'alwaseet');
      const modonOrdersLocal = pendingOrders.filter(o => o.delivery_partner === 'modon');

      // 2) جلب طلبات الوسيط + مدن من API
      let waseetOrders = [];
      let modonOrdersRemote = [];

      // جلب طلبات الوسيط
      if (alwaseetOrders.length > 0) {
        try {
          waseetOrders = await AlWaseetAPI.getMerchantOrders(token);
          devLog.log(`📦 تم جلب ${waseetOrders.length} طلب من الوسيط للمزامنة السريعة`);
        } catch (apiError) {
          console.error('❌ فشل جلب قائمة الطلبات من الوسيط:', apiError.message);
          if (apiError.message?.includes('تجاوزت الحد المسموح به') || apiError.message?.includes('rate limit')) {
            devLog.warn('⚠️ Rate Limit الوسيط: تم تخطي مزامنة الوسيط');
          }
        }
      }

      // ✅ جلب طلبات مدن
      if (modonOrdersLocal.length > 0) {
        try {
          const modonTokenData = await getTokenForUser(user?.id, null, 'modon');
          if (modonTokenData?.token) {
            modonOrdersRemote = await ModonAPI.getMerchantOrders(modonTokenData.token);
            devLog.log(`📦 تم جلب ${modonOrdersRemote.length} طلب من مدن للمزامنة السريعة`);
          }
        } catch (apiError) {
          console.error('❌ فشل جلب قائمة الطلبات من مدن:', apiError.message);
        }
      }

      // ✅ فحص إضافي: إذا كانت القوائم فارغة بشكل غير طبيعي
      if (waseetOrders.length === 0 && modonOrdersRemote.length === 0) {
        devLog.warn('⚠️ تحذير: قوائم الطلبات فارغة - قد يكون هناك خطأ في APIs');
        setLoading(false);
        return { updated: 0, checked: 0, emptyList: true };
      }

      // 3) بناء خرائط للبحث السريع (تشمل الوسيط ومدن)
      const byWaseetId = new Map();
      const byQrId = new Map();
      const byTracking = new Map();
      
      // ✅ إضافة طلبات الوسيط إلى الخرائط
      for (const wo of waseetOrders) {
        const waseetOrder = { ...wo, _partner: 'alwaseet' };
        if (wo.id) byWaseetId.set(String(wo.id), waseetOrder);
        if (wo.qr_id) byQrId.set(String(wo.qr_id).trim(), waseetOrder);
        if (wo.tracking_number) byTracking.set(String(wo.tracking_number).trim(), waseetOrder);
      }
      
      // ✅ إضافة طلبات مدن إلى الخرائط (الإصلاح الجديد!)
      for (const mo of modonOrdersRemote) {
        const modonOrder = { ...mo, _partner: 'modon' };
        if (mo.id) byWaseetId.set(String(mo.id), modonOrder);
        if (mo.qr_id) byQrId.set(String(mo.qr_id).trim(), modonOrder);
        if (mo.tracking_number) byTracking.set(String(mo.tracking_number).trim(), modonOrder);
      }
      
      devLog.log(`📊 خرائط البحث: ${byWaseetId.size} بمعرف، ${byQrId.size} بـQR، ${byTracking.size} بـtracking`);

      // 4) معالجة كل طلب محلي
      let updated = 0;
      let checked = 0;
      let repaired = 0;
      const statusChanges = [];

      for (const localOrder of pendingOrders) {
        // ✅ استخراج delivery_account_used و delivery_partner من الطلب
        const orderAccount = localOrder.delivery_account_used;
        const orderPartner = localOrder.delivery_partner;
        const orderCreatedBy = localOrder.created_by;
        
        // ✅ محاولة الحصول على توكن بالوضع الصارم
        let orderTokenData = await getTokenForUser(orderCreatedBy, orderAccount, orderPartner, true);
        
        // ✅ FALLBACK: استخدام توكن المستخدم الحالي
        if (!orderTokenData && user?.id) {
          orderTokenData = await getTokenForUser(user.id, orderAccount, orderPartner, true);
        }
        
        // ✅ تخطي الطلب إذا لم يوجد توكن صالح
        if (!orderTokenData) {
          devLog.warn(`⚠️ [FAST-SYNC] تخطي ${localOrder.tracking_number} - لا يوجد توكن للحساب "${orderAccount || 'افتراضي'}" في ${orderPartner}`);
          checked++;
          continue;
        }
        
        let waseetOrder = null;
        let needsIdRepair = false;

        // ✅ أولاً: البحث بمعرف الوسيط إذا كان موجوداً وصحيحاً
        if (localOrder.delivery_partner_order_id && localOrder.delivery_partner_order_id !== localOrder.tracking_number) {
          waseetOrder = byWaseetId.get(String(localOrder.delivery_partner_order_id));
        }

        // ✅ ثانياً: fallback search بـ tracking_number أو qr_id
        if (!waseetOrder) {
          const tn = String(localOrder.tracking_number || localOrder.qr_id || '').trim();
          if (tn) {
            waseetOrder = byQrId.get(tn) || byTracking.get(tn);
            
            // ✅ إصلاح: وضع علامة للإصلاح إذا كان delivery_partner_order_id خاطئ أو فارغ
            if (waseetOrder && (!localOrder.delivery_partner_order_id || localOrder.delivery_partner_order_id === localOrder.tracking_number)) {
              needsIdRepair = true;
              devLog.log(`🔧 [${localOrder.tracking_number}] يحتاج إصلاح delivery_partner_order_id`);
            }
          }
        }

        // ✅ Logging مفصّل للتشخيص
        if (!waseetOrder) {
          console.log(`❌ [${localOrder.tracking_number}] غير موجود في AlWaseet API`);
        } else {
          console.log(`✅ [${localOrder.tracking_number}] موجود في AlWaseet:`, {
            id: waseetOrder.id,
            qr_id: waseetOrder.qr_id,
            status_id: waseetOrder.status_id,
            state_id: waseetOrder.state_id
          });
        }

        // ✅ حذف تلقائي فقط إذا لم يوجد في الوسيط وكان قبل الاستلام
        if (!waseetOrder && canAutoDeleteOrder(localOrder, user)) {
          const confirmKey = String(localOrder.tracking_number || localOrder.qr_id || '').trim();
          
          // ✅ جلب توكن الحساب المحدد المرتبط بالطلب
          const orderAccount = localOrder.delivery_account_used;
          const orderPartner = localOrder.delivery_partner;
          
          const specificToken = await getTokenForUser(
            localOrder.created_by, 
            orderAccount, 
            orderPartner, 
            true // strict mode - يتطلب توكن صالح لهذا الحساب المحدد
          );
          
          // ✅ حماية: لا تحذف إذا لم يوجد توكن صالح للحساب المحدد
          if (!specificToken) {
            devLog.warn(`⛔ إيقاف الحذف - لا يوجد توكن صالح للحساب "${orderAccount || 'افتراضي'}" في ${orderPartner}`);
            toast({
              title: "⚠️ توكن منتهي",
              description: `لم يتم التحقق من الطلب ${confirmKey}. سجّل دخول لحساب "${orderAccount || 'الافتراضي'}" أولاً.`,
              variant: "warning",
              duration: 8000
            });
            continue; // ✅ تخطي هذا الطلب - لا تحذفه!
          }
          
          // ✅ فحص 3 مرات بتوكن الحساب المحدد فقط
          let foundOrder = false;
          const RETRY_DELAYS = [0, 2000, 4000]; // تأخير بين المحاولات
          
          for (let attempt = 1; attempt <= 3; attempt++) {
            if (attempt > 1) await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt-1]));
            
            devLog.log(`🔍 محاولة ${attempt}/3: فحص ${confirmKey} بحساب "${orderAccount || 'افتراضي'}"`);
            
            try {
              // طريقة 1: بـ QR
              let found = await AlWaseetAPI.getOrderByQR(specificToken.token, confirmKey);
              
              // طريقة 2: بـ ID (fallback)
              if (!found && localOrder.delivery_partner_order_id) {
                found = await AlWaseetAPI.getOrderById(specificToken.token, localOrder.delivery_partner_order_id);
              }
              
              if (found) {
                foundOrder = true;
                devLog.log(`✅ محاولة ${attempt}: الطلب ${confirmKey} موجود - لن يُحذف`);
                break;
              }
            } catch (e) {
              devLog.warn(`⚠️ محاولة ${attempt} فشلت: ${e.message}`);
            }
          }
          
          // ✅ حذف فقط بعد 3 محاولات فاشلة
          if (!foundOrder) {
            devLog.log(`🗑️ الطلب ${confirmKey} غير موجود في حساب "${orderAccount || 'افتراضي'}" بعد 3 محاولات`);
            
            toast({
              title: "🗑️ طلب محذوف من شركة التوصيل",
              description: `الطلب ${confirmKey} غير موجود في حساب "${orderAccount || 'الافتراضي'}" وتم حذفه محلياً`,
              variant: "warning",
              duration: 8000
            });
            
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
        
        // 🔍 LOGGING مفصّل لفهم ماذا يُرسل API
        console.log(`🔍 [SYNC DEBUG] الطلب ${localOrder.tracking_number}:`, {
          // من API الوسيط
          waseetStatusId,
          waseetStatusText,
          waseetOrder_state_id: waseetOrder.state_id,
          waseetOrder_status_id: waseetOrder.status_id,
          waseetOrder_status: waseetOrder.status,
          
          // من قاعدة البيانات المحلية
          localOrder_status: localOrder.status,
          localOrder_delivery_status: localOrder.delivery_status,
          
          // من الـ mapping
          statusMap_result: statusMap.get(String(waseetStatusId)),
          
          // الوقت
          timestamp: new Date().toISOString()
        });
        
        // ✅ CRITICAL: حماية الحالات النهائية - لا تحديث لـ completed أو returned_in_stock
        if (localOrder.status === 'completed' || localOrder.status === 'returned_in_stock') {
          devLog.info(`🔒 [ALWASEET-CTX-PROTECTED] ${localOrder.tracking_number} محمي كـ ${localOrder.status}`);
          
          // تحديث delivery_status فقط (بدون status)
          const waseetNumericStatus = String(waseetOrder.state_id || waseetOrder.status_id || waseetStatusId || '');
          if (localOrder.delivery_status !== waseetNumericStatus) {
            await supabase
              .from('orders')
              .update({ 
                delivery_status: waseetNumericStatus,
                updated_at: new Date().toISOString()
              })
              .eq('id', localOrder.id);
            devLog.info(`🔄 [ALWASEET-CTX] ${localOrder.tracking_number}: delivery_status → ${waseetNumericStatus}`);
          }
          
          continue; // ← تخطي باقي المعالجة
        }

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
        const waseetNumericStatus = String(waseetOrder.state_id || waseetOrder.status_id || waseetStatusId || '');
        const needsDeliveryStatusUpdate = localOrder.delivery_status !== waseetNumericStatus;
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

        // 🔍 فحص إذا كان هناك تغيير في delivery_fee
        const waseetDeliveryFee = parseInt(String(waseetOrder.delivery_price || 0)) || 0;
        const needsDeliveryFeeUpdate = waseetDeliveryFee !== currentDeliveryFee && waseetDeliveryFee > 0;


        // ✅ الآن يفحص جميع الأسباب للتحديث (الحالة + السعر + الفاتورة + التصحيح + delivery_fee)
        if (!needsStatusUpdate && !needsDeliveryStatusUpdate && !needsDeliveryFeeUpdate && !needsReceiptUpdate && !needsPriceUpdate && !needsCorrection) {
          // ✅ حتى لو لم تتغير البيانات، نحدث وقت المزامنة
          await supabase
            .from('orders')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', localOrder.id);
          continue;
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
          // ✅ DOUBLE-CHECK: حماية إضافية قبل تحديث الحالة
          if (localOrder.status === 'completed' || localOrder.status === 'returned_in_stock') {
            devLog.info(`🔒 [ALWASEET-CTX-DOUBLE-CHECK] ${localOrder.tracking_number} محمي - تم تخطي تحديث الحالة`);
          }
          // ✅ حماية partial_delivery - لا نغير status
          else if (localOrder.order_type === 'partial_delivery') {
            devLog.info(`🔒 [PARTIAL-DELIVERY-PROTECTED] ${localOrder.tracking_number}: order_type=partial_delivery - تخطي تحديث status`);
            // نحدث delivery_status فقط - status يبقى كما هو
          }
          else {
            updates.status = localStatus;
            
            // إشعار ذكي فقط عند تغيير الحالة الفعلي
            const orderKey = localOrder.qr_id || localOrder.order_number || localOrder.id;
            const lastStatus = lastNotificationStatus[orderKey];
            
            if (showNotifications && lastStatus !== localStatus) {
              statusChanges.push({
                trackingNumber: localOrder.tracking_number,
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
          
          // ✅ CRITICAL: حساب السعر الأصلي الحقيقي من order_items (قبل أي تغييرات)
          // يجب جلب سعر المنتجات من order_items وليس من total_amount لأن total_amount قد يكون بعد الخصم
          const currentDiscount = parseInt(String(localOrder.discount)) || 0;
          
          // جلب السعر الأصلي من order_items
          const { data: orderItemsData } = await supabase
            .from('order_items')
            .select('total_price')
            .eq('order_id', localOrder.id);
          
          // السعر الأصلي = مجموع total_price من order_items
          let originalProductsPrice = orderItemsData?.reduce((sum, item) => 
            sum + (parseFloat(item.total_price) || 0), 0) || localTotalAmount;

          devLog.log(`🔍 حساب السعر الأصلي للطلب ${localOrder.order_number}:`, {
            localTotalAmount,
            currentPriceIncrease,
            currentDiscount,
            originalProductsPriceFromItems: originalProductsPrice,
            orderItemsCount: orderItemsData?.length || 0
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
            description: `الطلب ${change.trackingNumber || change.orderNumber}: ${getStatusLabel(change.oldStatus)} → ${getStatusLabel(change.newStatus)}`,
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

      // ✅ Final invoice sync after order updates
      try {
        const { data: finalInvoiceSyncRes, error: finalInvoiceSyncErr } = await supabase.rpc('sync_recent_received_invoices');
        if (finalInvoiceSyncErr) {
          devLog.warn('⚠️ خطأ في المزامنة النهائية للفواتير:', finalInvoiceSyncErr.message);
        } else if (finalInvoiceSyncRes?.updated_orders_count > 0) {
          devLog.log(`✅ مزامنة فواتير نهائية: تم تحديث ${finalInvoiceSyncRes.updated_orders_count} طلب إضافي`);
        }
      } catch (finalInvoiceError) {
        devLog.warn('⚠️ استثناء في المزامنة النهائية للفواتير:', finalInvoiceError.message || finalInvoiceError);
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
      
      // ✅ جلب طلبات الوسيط + مدن معاً
      let allOrders = [];
      
      // جلب طلبات الوسيط
      try {
        const waseetOrders = await AlWaseetAPI.getMerchantOrders(token);
        devLog.log(`📦 تم جلب ${waseetOrders.length} طلب من الوسيط`);
        allOrders = [...waseetOrders.map(o => ({ ...o, _partner: 'alwaseet' }))];
      } catch (err) {
        console.error('❌ خطأ في جلب طلبات الوسيط:', err.message);
      }

      // ✅ جلب طلبات مدن
      try {
        const modonTokenData = await getTokenForUser(user?.id, null, 'modon');
        if (modonTokenData?.token) {
          const modonOrders = await ModonAPI.getMerchantOrders(modonTokenData.token);
          devLog.log(`📦 تم جلب ${modonOrders.length} طلب من مدن`);
          allOrders = [...allOrders, ...modonOrders.map(o => ({ ...o, _partner: 'modon' }))];
        }
      } catch (err) {
        console.error('❌ خطأ في جلب طلبات مدن:', err.message);
      }

      devLog.log(`📦 إجمالي الطلبات للمزامنة: ${allOrders.length} (الوسيط + مدن)`);
      
      let updatedCount = 0;
      
      // تحديث حالة كل طلب في قاعدة البيانات
      for (const waseetOrder of allOrders) {
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
              updates.delivery_partner = existingOrder.delivery_partner || 'alwaseet';
            }
            
            // تحديث رسوم التوصيل إن وُجدت
            const dp = parseInt(String(waseetOrder.delivery_price || 0)) || 0;
            if (dp >= 0 && dp !== (existingOrder.delivery_fee || 0)) {
              updates.delivery_fee = dp;
            }
            
            // تأكيد الاستلام المالي مع تطبيع المقارنة
            const finConfirmed = Number(waseetOrder.deliver_confirmed_fin) === 1;
            const receiptReceived = existingOrder?.receipt_received === true;
            const isEmployeeOrder = existingOrder?.employee_order === true;
            const employeeDebtPaid = !isEmployeeOrder || existingOrder?.employee_debt_paid === true;
            
            // الشروط الكاملة للتحويل إلى completed:
            // 1. deliver_confirmed_fin = 1 (تأكيد من الوسيط)
            // 2. receipt_received = true (استلام الفاتورة)
            // 3. إذا كان طلب موظف: employee_debt_paid = true
            if (finConfirmed && receiptReceived && employeeDebtPaid && (localStatus === 'delivered' || existingOrder.status === 'delivered')) {
              updates.status = 'completed';
              console.log(`🎯 [Auto Complete] تحويل الطلب إلى completed - شروط مستوفاة:`, {
                finConfirmed,
                receiptReceived,
                employeeDebtPaid,
                orderNumber: existingOrder?.order_number
              });
            } else if (finConfirmed && (localStatus === 'delivered' || existingOrder.status === 'delivered')) {
              // إذا كان deliver_confirmed_fin = 1 لكن بدون فاتورة، لا تحول إلى completed
              console.log(`⚠️ [Pending Receipt] الطلب ${existingOrder?.order_number} - delivered لكن بانتظار الفاتورة:`, {
                finConfirmed,
                receiptReceived,
                employeeDebtPaid
              });
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
              
              // ✅ الإشعارات تُرسل تلقائياً من database trigger: trg_send_order_notifications
              // تم تعطيل إرسال الإشعارات من هنا لمنع التكرار
              // const actualStateId = waseetOrder.state_id || waseetOrder.status_id || waseetOrder.statusId;
              // if (actualStateId) {
              //   devLog.log('📢 إرسال إشعار تغيير حالة:', { trackingNumber, stateId: actualStateId, statusText: waseetStatusText });
              //   createOrderStatusNotification(trackingNumber, actualStateId, waseetStatusText);
              // } else {
              //   devLog.warn('⚠️ لا يوجد state_id للطلب:', trackingNumber, waseetOrder);
              // }
            }
          }
        } catch (error) {
          console.error(`❌ خطأ في تحديث الطلب ${trackingNumber}:`, error);
        }
      }
      
      const message = updatedCount > 0 
        ? `تم تحديث ${updatedCount} طلب من أصل ${allOrders.length}`
        : `تم فحص ${allOrders.length} طلب - لا توجد تحديثات مطلوبة`;
      
      devLog.log(`✅ ${message}`);
      
      // After status sync, check for orders that need deletion (not found in remote)
      await performDeletionPassAfterStatusSync();
      
      return allOrders;
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

  // دالة مزامنة طلب محدد بالـ QR/tracking number مع تحديث فوري - متعدد الشركاء
  const syncOrderByQR = useCallback(async (qrId) => {
    try {
      devLog.log(`🔄 مزامنة الطلب ${qrId}...`);
      
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

      // ✅ تحديد شريك التوصيل من الطلب المحلي
      const orderPartner = localOrder?.delivery_partner || 'alwaseet';
      const isModonOrder = orderPartner === 'modon';
      const partnerDisplayName = isModonOrder ? 'مدن' : 'الوسيط';
      
      devLog.log(`🏢 شريك الطلب: ${partnerDisplayName} (${orderPartner})`);

      // دالة للحصول على التوكن الفعال مع دعم متعدد الحسابات والشركاء
      const getEffectiveTokenForOrder = async (order, fallbackToCurrentUser = true) => {
        if (!order) return { token: null, source: 'no_order' };
        
        const orderOwnerId = order.created_by;
        const partner = order.delivery_partner || 'alwaseet';
        devLog.log(`🔍 البحث عن توكن فعال للطلب ${order.tracking_number || order.id} (مالك: ${orderOwnerId}, شريك: ${partner})`);
        
        // جلب جميع حسابات مالك الطلب للشريك الصحيح
        const ownerAccounts = await getUserDeliveryAccounts(orderOwnerId, partner);
        if (ownerAccounts.length > 0) {
          devLog.log(`👤 وُجد ${ownerAccounts.length} حساب ${partner} لمالك الطلب ${orderOwnerId}`);
          
          // تجربة كل حساب على حدة
          for (const account of ownerAccounts) {
            if (account.token) {
              devLog.log(`🔑 تجربة حساب: ${account.account_username} لمالك الطلب`);
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
          devLog.log(`🔄 لم يوجد توكن لمالك الطلب، التراجع للمستخدم الحالي ${user.id}`);
          const currentUserAccounts = await getUserDeliveryAccounts(user.id, partner);
          
          for (const account of currentUserAccounts) {
            if (account.token) {
              devLog.log(`🔑 استخدام حساب المستخدم الحالي: ${account.account_username}`);
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
        devLog.warn(`❌ لا يوجد توكن صالح للمزامنة للطلب ${qrId} (مصدر: ${tokenSource})`);
        return null;
      }

      devLog.log(`🔑 استخدام توكن من: ${tokenSource} للطلب ${qrId}`);

      // البحث المتقدم بجميع التوكنات المتاحة لمالك الطلب قبل اعتبار الطلب محذوف
      const checkOrderWithAllTokens = async (orderId) => {
        const orderOwnerId = localOrder?.created_by;
        if (!orderOwnerId) return null;
        const partner = localOrder?.delivery_partner || 'alwaseet';
        // جلب جميع حسابات مالك الطلب
        const ownerAccounts = await getUserDeliveryAccounts(orderOwnerId, partner);
        
        // ✅ حماية: لا تحذف إذا لم يوجد توكن صالح
        if (ownerAccounts.length === 0) {
          devLog.warn(`⛔ إيقاف الحذف التلقائي للطلب ${orderId} - لا يوجد توكن صالح للتحقق`);
          return { noValidToken: true }; // إرجاع كائن خاص يمنع الحذف
        }
        
        devLog.log(`🔍 فحص الطلب ${orderId} بجميع التوكنات (${ownerAccounts.length} حساب)`);
        
        // تجربة كل توكن
        for (const account of ownerAccounts) {
          if (!account.token) continue;
          
          try {
            devLog.log(`🔄 تجربة البحث بحساب: ${account.account_username}`);
            let foundOrder;
            if (isModonOrder) {
              const modonOrders = await ModonAPI.getMerchantOrders(account.token);
              foundOrder = modonOrders.find(o => 
                String(o.qr_id) === String(orderId) || String(o.id) === String(orderId)
              );
            } else {
              foundOrder = await AlWaseetAPI.getOrderByQR(account.token, orderId);
            }
            if (foundOrder) {
              devLog.log(`✅ وُجد الطلب ${orderId} بحساب: ${account.account_username}`);
              return foundOrder;
            }
          } catch (error) {
            devLog.warn(`⚠️ فشل البحث بحساب ${account.account_username}:`, error.message);
          }
        }
        
        devLog.log(`❌ الطلب ${orderId} غير موجود في جميع حسابات المالك (${ownerAccounts.length} حساب)`);
        return null;
      };

      // ✅ جلب الطلب من الشريك المناسب باستخدام التوكن المناسب
      let remoteOrder;
      if (isModonOrder) {
        devLog.log(`🔄 جلب طلب مدن ${qrId}...`);
        const modonOrders = await ModonAPI.getMerchantOrders(effectiveToken);
        remoteOrder = modonOrders.find(o => 
          String(o.qr_id) === String(qrId) || String(o.id) === String(qrId) || String(o.tracking_number) === String(qrId)
        );
        if (remoteOrder) {
          devLog.log(`✅ وُجد طلب مدن ${qrId}:`, { id: remoteOrder.id, status_id: remoteOrder.status_id });
        }
      } else {
        remoteOrder = await AlWaseetAPI.getOrderByQR(effectiveToken, qrId);
      }
      
      if (!remoteOrder) {
        devLog.warn(`❌ لم يتم العثور على الطلب ${qrId} بالتوكن الأولي (${tokenSource})`);
        
        devLog.log(`🔍 بدء الفحص المتقدم بجميع التوكنات للطلب ${qrId}...`);
        remoteOrder = await checkOrderWithAllTokens(qrId);
        
        if (!remoteOrder) {
          devLog.warn(`❌ تأكيد: الطلب ${qrId} غير موجود في جميع الحسابات`);
          
          if (localOrder && canAutoDeleteOrder(localOrder, user)) {
            devLog.log(`⚠️ التحقق من حذف الطلب ${qrId} - مؤكد عدم وجوده في جميع الحسابات`);
            
            await new Promise(resolve => setTimeout(resolve, 3000));
            const finalCheck = await checkOrderWithAllTokens(qrId);
            
            if (!finalCheck) {
              devLog.log(`🗑️ تأكيد نهائي: حذف الطلب ${qrId} - غير موجود في جميع حسابات المالك`);
              const deleteResult = await performAutoDelete(localOrder);
              if (deleteResult) {
                return { 
                  ...deleteResult, 
                  autoDeleted: true,
                  message: `تم حذف الطلب ${localOrder.tracking_number || qrId} تلقائياً - مؤكد عدم وجوده في جميع حسابات ${partnerDisplayName}`
                };
              }
            } else {
              devLog.log(`✅ الطلب ${qrId} موجود فعلياً بعد الفحص النهائي - لن يُحذف`);
              remoteOrder = finalCheck;
            }
          } else {
            devLog.log(`🔒 الطلب ${qrId} محمي من الحذف التلقائي أو لا يملكه المستخدم الحالي`);
          }
          
          if (!remoteOrder) {
            return null;
          }
        } else {
          devLog.log(`✅ وُجد الطلب ${qrId} في أحد الحسابات الأخرى`);
        }
      }

      // ✅ حماية إضافية
      if (!remoteOrder || (!remoteOrder.qr_id && !remoteOrder.id)) {
        console.error(`❌ البيانات المُسترجعة للطلب ${qrId} غير صالحة:`, remoteOrder);
        return {
          needs_update: false,
          invalid_data: true,
          message: `البيانات المُسترجعة من ${partnerDisplayName} غير صالحة أو قديمة`
        };
      }

      devLog.log(`📋 بيانات الطلب من ${partnerDisplayName}:`, { tokenSource, remoteOrder });

      // تحميل حالات الطلبات إذا لم تكن محملة
      let statusMap = orderStatusesMap;
      if (statusMap.size === 0) {
        statusMap = await loadOrderStatuses();
      }

      // ✅ استخدام المصدر الموحد لتعريفات الحالات حسب الشريك
      const remoteStatusId = remoteOrder.status_id || remoteOrder.statusId || remoteOrder.state_id;
      const remoteStatusText = remoteOrder.status || remoteOrder.status_text || remoteOrder.status_name || '';
      const statusConfig = isModonOrder 
        ? getModonStatusConfig(remoteStatusId, remoteStatusText, localOrder?.status)
        : getStatusConfig(String(remoteStatusId));
      
      const correctLocalStatus = statusConfig?.localStatus || statusConfig?.internalStatus || 'pending';
      devLog.log(`✅ تحديث ${qrId}: ${localOrder.status} → ${correctLocalStatus} (${statusConfig?.text || 'غير معروف'})`);
      
      devLog.log(`🔄 تحديث ${qrId}:`, {
        delivery_status: { old: localOrder.delivery_status, new: String(remoteStatusId) },
        status: { old: localOrder.status, new: correctLocalStatus },
        protected: localOrder.status === 'partial_delivery' || localOrder.status === 'delivered' || localOrder.status === 'completed' ? '🔒 محمي' : 'مسموح',
        statusConfig: statusConfig?.text || 'غير معروف'
      });

      if (!localOrder) {
        devLog.warn(`❌ لم يتم العثور على الطلب ${qrId} محلياً`);
        return null;
      }

      // تحضير التحديثات
      const updates = {
        status: correctLocalStatus,
        delivery_status: isModonOrder ? String(remoteStatusId) : String(remoteStatusText),
        delivery_partner_order_id: String(remoteOrder.id),
        qr_id: remoteOrder.qr_id || localOrder.qr_id || qrId,
        updated_at: new Date().toISOString()
      };

      // تحديث رسوم التوصيل
      const deliveryPriceField = remoteOrder.delivery_price || remoteOrder.delivery_fee;
      if (deliveryPriceField) {
        const deliveryPrice = parseInt(String(deliveryPriceField)) || 0;
        if (deliveryPrice >= 0) {
          updates.delivery_fee = deliveryPrice;
        }
      }

      // ✅ تحديث السعر دائماً إذا تغير من الشريك
      const remotePriceField = remoteOrder.price !== undefined ? remoteOrder.price : remoteOrder.total_price;
      if (remotePriceField !== undefined) {
        const remoteTotalPrice = parseInt(String(remotePriceField)) || 0;
        const deliveryFee = parseInt(String(deliveryPriceField || localOrder.delivery_fee)) || 0;
        
        const productsPriceFromRemote = remoteTotalPrice - deliveryFee;
        const originalFinalAmount = parseInt(String(localOrder.final_amount)) || 0;
        const originalProductsPrice = originalFinalAmount - deliveryFee;
        const currentProductsPrice = parseInt(String(localOrder.total_amount)) || 0;
        
        if (productsPriceFromRemote !== currentProductsPrice) {
          const priceDiff = originalProductsPrice - productsPriceFromRemote;
          
          if (priceDiff > 0) {
            updates.discount = priceDiff;
            updates.price_increase = 0;
            updates.price_change_type = 'discount';
          } else if (priceDiff < 0) {
            updates.discount = 0;
            updates.price_increase = Math.abs(priceDiff);
            updates.price_change_type = 'increase';
          } else {
            updates.discount = 0;
            updates.price_increase = 0;
            updates.price_change_type = null;
          }
          
          updates.total_amount = productsPriceFromRemote;
          updates.sales_amount = productsPriceFromRemote;
          updates.delivery_fee = deliveryFee;
          
          try {
            const { data: profitRecord } = await supabase
              .from('profits')
              .select('id, total_cost, employee_percentage, profit_amount, employee_profit')
              .eq('order_id', localOrder.id)
              .maybeSingle();
            
            if (profitRecord) {
              const newProfit = productsPriceFromRemote - profitRecord.total_cost;
              const employeeShare = (profitRecord.employee_percentage / 100.0) * newProfit;
              
              await supabase
                .from('profits')
                .update({
                  total_revenue: remoteTotalPrice,
                  profit_amount: newProfit,
                  employee_profit: employeeShare,
                  updated_at: new Date().toISOString()
                })
                .eq('id', profitRecord.id);
            }
          } catch (profitError) {
            console.error('❌ خطأ في تحديث الأرباح:', profitError);
          }
        }
      }

      // ترقية إلى completed
      const finConfirmed = isModonOrder 
        ? (statusConfig?.localStatus === 'delivered' || statusConfig?.internalStatus === 'delivered')
        : (remoteOrder.deliver_confirmed_fin === 1);
      const receiptReceived = localOrder?.receipt_received === true;
      const isEmployeeOrder = localOrder?.employee_order === true;
      const employeeDebtPaid = !isEmployeeOrder || localOrder?.employee_debt_paid === true;
      
      if (finConfirmed && receiptReceived && employeeDebtPaid && correctLocalStatus === 'delivered') {
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

      devLog.log(`✅ تم تحديث الطلب ${qrId} من ${partnerDisplayName}: ${localOrder.status} → ${correctLocalStatus}`);
      
      return {
        needs_update: localOrder.status !== correctLocalStatus || localOrder.delivery_status !== String(remoteStatusId),
        updates,
        waseet_order: remoteOrder,
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

      devLog.log(`🔍 فحص ${ordersToCheck.length} طلب للحذف التلقائي...`);

      for (const order of ordersToCheck) {
        let verificationAttempts = 0;
        let orderExists = false;
        const maxAttempts = 3;

        // محاولات متعددة للتحقق
        while (verificationAttempts < maxAttempts && !orderExists) {
          try {
            verificationAttempts++;
            

            const response = await fetch('/api/alwaseet/check-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ trackingNumber: order.tracking_number })
            });

            if (response.ok) {
              const result = await response.json();
              
              if (result.exists && result.status !== 'not_found') {
                orderExists = true;
                
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
          
          
          // إشعار المدير
        toast({
          title: "حذف طلب تلقائي",
          description: `${order.tracking_number || order.order_number} - تم حذف الطلب وتحرير المخزون المحجوز تلقائياً`,
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
      // ⚠️ ملاحظة مهمة: تحرير المخزون المحجوز يتم تلقائياً عبر trigger: auto_release_stock_on_order_delete
      // لا نستدعي release_stock_item يدوياً لأن ذلك يمنع الـ trigger من العمل وإرسال الإشعارات
      // الـ trigger يُنقص reserved_quantity ويُسجل في product_tracking_log ويُرسل إشعار تلقائياً

      // حذف الطلب من قاعدة البيانات - الـ trigger يتولى تحرير المخزون والإشعار
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

      console.log(`✅ تم حذف الطلب ${order.id} تلقائياً - الـ trigger تولى تحرير المخزون والإشعار`);
      
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
        updates.delivery_partner = existingOrder.delivery_partner || 'alwaseet';
      }
      
      const dp = parseInt(String(waseetOrder.delivery_price || 0)) || 0;
      if (dp >= 0 && dp !== (existingOrder?.delivery_fee || 0)) {
        updates.delivery_fee = dp;
      }
      // ترقية للحالة المكتملة فقط عند استيفاء جميع الشروط
      const finConfirmed = Number(waseetOrder.deliver_confirmed_fin) === 1;
      const receiptReceived = existingOrder?.receipt_received === true;
      const isEmployeeOrder = existingOrder?.employee_order === true;
      const employeeDebtPaid = !isEmployeeOrder || existingOrder?.employee_debt_paid === true;
      
      if (finConfirmed && receiptReceived && employeeDebtPaid && (localStatus === 'delivered' || existingOrder?.status === 'delivered')) {
        updates.status = 'completed';
        console.log(`🎯 [Single Complete] تحويل الطلب إلى completed:`, {
          finConfirmed,
          receiptReceived,
          employeeDebtPaid,
          orderNumber: existingOrder?.order_number
        });
      } else if (finConfirmed && (localStatus === 'delivered' || existingOrder?.status === 'delivered')) {
        console.log(`⚠️ [Single Pending] الطلب ${existingOrder?.order_number} - delivered لكن بانتظار الفاتورة:`, {
          finConfirmed,
          receiptReceived,
          employeeDebtPaid
        });
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
        // ✅ فقط AlWaseet تستخدم statuses endpoint
        if (activePartner !== 'alwaseet') {
          devLog.log('ℹ️ MODON لا يحتاج statuses endpoint');
          return { success: true, data: [] };
        }
        
        const statuses = await AlWaseetAPI.getOrderStatuses(token);
        return { success: true, data: statuses };
      } catch (error) {
        return { success: false, message: error.message };
      }
    }
    return { success: false, message: "لم يتم تسجيل الدخول لشركة التوصيل." };
  }, [token, activePartner]);

  const fetchCities = useCallback(async () => {
    if (token) {
      try {
        let data;
        
        // ✅ استدعاء API المناسب حسب الشريك النشط
        if (activePartner === 'modon') {
          data = await ModonAPI.getCities(token);
          // تحويل صيغة مدن إلى صيغة موحدة
          data = data.map(city => ({
            id: city.id,
            name: city.city_name
          }));
        } else if (activePartner === 'alwaseet') {
          data = await AlWaseetAPI.getCities(token);
        } else {
          data = [];
        }
        
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
  }, [token, activePartner]);

  const fetchRegions = useCallback(async (cityId) => {
    if (token && cityId) {
      try {
        let data;
        
        // ✅ استدعاء API المناسب حسب الشريك النشط
        if (activePartner === 'modon') {
          data = await ModonAPI.getRegionsByCity(token, cityId);
          // تحويل صيغة مدن إلى صيغة موحدة
          data = data.map(region => ({
            id: region.id,
            name: region.region_name
          }));
        } else if (activePartner === 'alwaseet') {
          data = await AlWaseetAPI.getRegionsByCity(token, cityId);
        } else {
          data = [];
        }
        
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
  }, [token, activePartner]);

  const fetchPackageSizes = useCallback(async () => {
    if (token) {
      try {
        let data;
        
        // ✅ استدعاء API المناسب حسب الشريك النشط
        if (activePartner === 'modon') {
          data = await ModonAPI.getPackageSizes(token);
          // صيغة مدن مطابقة للوسيط، لا حاجة للتحويل
        } else if (activePartner === 'alwaseet') {
          data = await AlWaseetAPI.getPackageSizes(token);
        } else {
          data = [];
        }
        
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

  // ✅ المرحلة 1: دالة ربط الفواتير بالطلبات (استدعاء الدالة الجديدة)
  const linkInvoiceOrdersToOrders = useCallback(async () => {
    try {
      console.log('🔗 ربط طلبات الفواتير بالطلبات...');
      const { data, error } = await supabase.rpc('link_invoice_orders_to_orders');
      
      if (error) {
        console.warn('⚠️ فشل في ربط الفواتير:', error.message);
        return { success: false, error: error.message };
      }
      
      if (data && data.length > 0) {
        const result = data[0];
        console.log(`✅ تم ربط ${result.linked_count} طلب فاتورة، تحديث ${result.updated_orders_count} طلب (${result.processing_time_ms}ms)`);
        return { 
          success: true, 
          linkedCount: result.linked_count,
          updatedOrdersCount: result.updated_orders_count,
          processingTimeMs: result.processing_time_ms
        };
      }
      
      return { success: true, linkedCount: 0, updatedOrdersCount: 0 };
    } catch (error) {
      console.warn('⚠️ خطأ في ربط الفواتير:', error.message || error);
      return { success: false, error: error.message };
    }
  }, []);

  // ✅ المرحلة 2: دالة لإعادة مزامنة فاتورة محددة من API
  const resyncSpecificInvoice = useCallback(async (invoiceId, partnerName = null) => {
    if (!invoiceId) return { success: false, error: 'معرف الفاتورة مطلوب' };
    
    const partner = partnerName || activePartner;
    
    try {
      // جلب token نشط لشركة التوصيل
      const { data: tokenData, error: tokenError } = await supabase
        .from('delivery_partner_tokens')
        .select('token, account_username, merchant_id')
        .eq('partner_name', partner)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (tokenError || !tokenData?.token) {
        return { success: false, error: 'لا يوجد توكن نشط' };
      }

      console.log(`🔄 إعادة مزامنة الفاتورة ${invoiceId} من ${partner}...`);

      // جلب تفاصيل الفاتورة من API
      let invoiceOrders = null;
      if (partner === 'modon') {
        invoiceOrders = await ModonAPI.getInvoiceOrders(tokenData.token, invoiceId);
      } else {
        invoiceOrders = await AlWaseetAPI.getInvoiceOrders(tokenData.token, invoiceId);
      }

      if (!invoiceOrders?.orders || invoiceOrders.orders.length === 0) {
        return { success: false, error: 'لم يتم العثور على طلبات في الفاتورة' };
      }

      console.log(`📦 تم جلب ${invoiceOrders.orders.length} طلب من الفاتورة ${invoiceId}`);

      // حفظ الطلبات في قاعدة البيانات
      const { data: dbInvoice } = await supabase
        .from('delivery_invoices')
        .select('id')
        .eq('external_id', invoiceId)
        .eq('partner', partner)
        .maybeSingle();

      if (dbInvoice?.id) {
        // حفظ الطلبات في delivery_invoice_orders
        const invoiceOrdersData = invoiceOrders.orders.map(order => ({
          invoice_id: dbInvoice.id,
          external_order_id: order.id?.toString(),
          raw: order,
          partner: partner
        }));

        const { error: upsertError } = await supabase
          .from('delivery_invoice_orders')
          .upsert(invoiceOrdersData, {
            onConflict: 'invoice_id,external_order_id',
            ignoreDuplicates: false
          });

        if (upsertError) {
          console.warn('⚠️ خطأ في حفظ طلبات الفاتورة:', upsertError);
        } else {
          console.log(`✅ تم حفظ ${invoiceOrdersData.length} طلب للفاتورة ${invoiceId}`);
        }
      }

      toast({
        title: "✅ تم إعادة المزامنة بنجاح",
        description: `تم تحديث ${invoiceOrders.orders.length} طلب للفاتورة ${invoiceId}`,
        variant: "default"
      });

      return { success: true, ordersCount: invoiceOrders.orders.length };
    } catch (error) {
      console.error('❌ فشل في إعادة مزامنة الفاتورة:', error);
      return { success: false, error: error.message };
    }
  }, [activePartner]);

  // ✅ المرحلة 3: مزامنة كل التوكنات المتاحة
  const syncAllAvailableTokens = useCallback(async (onProgress = null) => {
    try {
      console.log('🔄 بدء مزامنة كل التوكنات المتاحة...');
      
      if (!user?.id) {
        console.warn('⚠️ لا يوجد مستخدم مسجل دخول');
        return { success: false, error: 'No user logged in' };
      }

      // جلب جميع التوكنات النشطة للمستخدم
      const { data: userTokens, error: tokensError } = await supabase
        .from('delivery_partner_tokens')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString());

      if (tokensError) {
        console.error('❌ خطأ في جلب التوكنات:', tokensError);
        return { success: false, error: tokensError.message };
      }

      if (!userTokens || userTokens.length === 0) {
        console.log('ℹ️ لا توجد توكنات نشطة للمزامنة');
        return { success: true, tokensSynced: 0 };
      }

      console.log(`📋 وُجد ${userTokens.length} توكن نشط للمزامنة`);
      
      let totalInvoicesSynced = 0;
      let totalOrdersUpdated = 0;
      let tokensProcessed = 0;

      for (const tokenData of userTokens) {
        try {
          const accountName = tokenData.account_username || 'غير معروف';
          const partnerName = tokenData.partner_name || 'alwaseet';
          const tokenValue = tokenData.token;
          
          console.log(`🔄 [${tokensProcessed + 1}/${userTokens.length}] مزامنة حساب: ${accountName} (${partnerName})`);
          
          if (onProgress) {
            onProgress({
              current: tokensProcessed + 1,
              total: userTokens.length,
              accountName,
              partnerName
            });
          }

          // ✅ المرحلة 4: جلب فواتير كل حساب من API وحفظها مع تفاصيلها الكاملة
          try {
            let invoicesData = [];
            
            if (partnerName === 'modon') {
              const ModonAPI = await import('@/lib/modon-api');
              invoicesData = await ModonAPI.getMerchantInvoices(tokenValue);
            } else {
              const AlWaseetAPI = await import('@/lib/alwaseet-api');
              invoicesData = await AlWaseetAPI.getMerchantInvoices(tokenValue);
            }
            
            // ✅ إضافة بيانات الحساب لكل فاتورة قبل الحفظ
            if (invoicesData?.length > 0) {
              const enrichedInvoices = invoicesData.map(inv => ({
                ...inv,
                owner_user_id: user.id,
                account_username: accountName,
                partner_name_ar: partnerName === 'modon' ? 'مدن' : 'الوسيط',
                merchant_id: inv.merchant_id || tokenData.merchant_id
              }));
              
              const { data: upsertRes, error: upsertErr } = await supabase.rpc('upsert_alwaseet_invoice_list', {
                p_invoices: enrichedInvoices
              });
              
              if (!upsertErr) {
                totalInvoicesSynced += invoicesData.length;
                console.log(`  ✅ حفظ ${invoicesData.length} فاتورة للحساب ${accountName} مع account_username`);
                
                // ✅ جلب تفاصيل أول 10 فواتير حديثة وحفظ طلباتها
                for (const invoice of invoicesData.slice(0, 10)) {
                  try {
                    let invoiceOrdersData;
                    
                    if (partnerName === 'modon') {
                      const ModonAPI = await import('@/lib/modon-api');
                      invoiceOrdersData = await ModonAPI.getInvoiceOrders(tokenValue, invoice.id);
                    } else {
                      const AlWaseetAPI = await import('@/lib/alwaseet-api');
                      invoiceOrdersData = await AlWaseetAPI.getInvoiceOrders(tokenValue, invoice.id);
                    }
                    
                    if (invoiceOrdersData?.orders?.length > 0) {
                      // البحث عن الفاتورة في قاعدة البيانات
                      const { data: dbInvoice } = await supabase
                        .from('delivery_invoices')
                        .select('id')
                        .eq('external_id', invoice.id)
                        .eq('partner', partnerName)
                        .maybeSingle();
                      
                      if (dbInvoice?.id) {
                        // حفظ الطلبات في delivery_invoice_orders
                        const invoiceOrdersList = invoiceOrdersData.orders.map(order => ({
                          invoice_id: dbInvoice.id,
                          external_order_id: order.id?.toString(),
                          raw: order,
                          partner: partnerName
                        }));
                        
                        await supabase
                          .from('delivery_invoice_orders')
                          .upsert(invoiceOrdersList, {
                            onConflict: 'invoice_id,external_order_id',
                            ignoreDuplicates: false
                          });
                        
                        console.log(`    📦 حفظ ${invoiceOrdersList.length} طلب للفاتورة ${invoice.id}`);
                      }
                    }
                  } catch (invoiceErr) {
                    console.warn(`    ⚠️ فشل في جلب تفاصيل الفاتورة ${invoice.id}:`, invoiceErr.message);
                  }
                }
              } else {
                console.error(`  ❌ فشل حفظ فواتير ${accountName}:`, upsertErr);
              }
            }
          } catch (apiErr) {
            console.warn(`  ⚠️ فشل في جلب فواتير من API للحساب ${accountName}:`, apiErr.message);
          }

          // ربط الفواتير بالطلبات أولاً
          const linkResult = await linkInvoiceOrdersToOrders();
          if (linkResult.success && linkResult.linkedCount > 0) {
            console.log(`  ✅ ربط ${linkResult.linkedCount} طلب فاتورة`);
          }

          // مزامنة الفواتير المستلمة
          const { data: syncRes, error: syncErr } = await supabase.rpc('sync_recent_received_invoices');
          
          if (!syncErr && syncRes) {
            totalOrdersUpdated += syncRes.updated_orders_count || 0;
            console.log(`  ✅ حساب ${accountName}: ${syncRes.updated_orders_count || 0} طلب مُحدَّث`);
          } else if (syncErr) {
            console.warn(`  ⚠️ فشل في مزامنة ${accountName}:`, syncErr.message);
          }

          tokensProcessed++;
        } catch (err) {
          console.error(`❌ خطأ في معالجة توكن ${tokenData.account_username}:`, err);
        }
      }

      console.log(`✅ اكتملت مزامنة ${tokensProcessed} حساب، تحديث ${totalOrdersUpdated} طلب`);
      
      return {
        success: true,
        tokensSynced: tokensProcessed,
        totalOrdersUpdated,
        totalInvoicesSynced
      };
    } catch (error) {
      console.error('❌ خطأ في مزامنة كل التوكنات:', error);
      return { success: false, error: error.message };
    }
    // ✅ لا نضيف linkInvoiceOrdersToOrders في dependencies لأنها useCallback مستقرة
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ✅ المرحلة 4: تحسين الزر الدائري - يقبل الطلبات الظاهرة و onProgress
  // Perform sync with countdown - can be triggered manually even if autoSync is disabled
  const performSyncWithCountdown = useCallback(async (visibleOrders = null, onProgress) => {
    if (activePartner === 'local' || !isLoggedIn || isSyncing) return;

    // Start countdown mode WITHOUT setting isSyncing to true yet
    setSyncMode('countdown');
    setSyncCountdown(5); // ✅ تقليل من 10 إلى 5 ثواني

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
    const startTime = Date.now();
    setTimeout(async () => {
      try {
        console.log('[SYNC-TIMING] 🚀 بدء المزامنة:', new Date().toISOString());
        // NOW set syncing to true when actual sync starts
        setIsSyncing(true);
        setSyncMode('syncing');

        let ordersToSync = visibleOrders;

        // ✅ إذا لم يتم تمرير الطلبات الظاهرة، محاولة الحصول عليها من window
        if (!ordersToSync || ordersToSync.length === 0) {
          ordersToSync = window.__visibleOrdersForSync || null;
          if (ordersToSync && ordersToSync.length > 0) {
            console.log(`✅ استخدام ${ordersToSync.length} طلب ظاهر من الصفحة الحالية`);
          }
        }

        // ✅ إذا لم توجد طلبات ظاهرة، جلب الطلبات النشطة (السلوك الافتراضي)
        if (!ordersToSync || ordersToSync.length === 0) {
          const { data: activeOrders, error } = await scopeOrdersQuery(
            supabase
              .from('orders')
              .select('*')
              .eq('delivery_partner', activePartner)
              .in('status', ['pending', 'shipped', 'delivery', 'delivered', 'partial_delivery']) // ✅ إضافة partial_delivery
              .neq('delivery_status', '17') // ✅ استثناء الحالة 17 (نهائية)
              .neq('status', 'returned_in_stock') // ✅ استثناء returned_in_stock (نهائية)
              .neq('status', 'completed') // ✅ استثناء completed (نهائية)
              .neq('status', 'cancelled') // ✅ استثناء cancelled (نهائية)
          ).limit(200);

          if (error) throw error;
          ordersToSync = activeOrders || [];
        }

        if (ordersToSync && ordersToSync.length > 0) {
          console.log(`🔄 مزامنة ${ordersToSync.length} طلب...`);
          // ✅ مزامنة باستخدام syncVisibleOrdersBatch مع تمرير onProgress
          await syncVisibleOrdersBatch(ordersToSync, onProgress);
          
          const syncEndTime = Date.now();
          console.log('[SYNC-TIMING] ✅ انتهاء syncVisibleOrdersBatch:', new Date().toISOString(), `(${syncEndTime - startTime}ms)`);
        }

        // ✅ الحذف التلقائي الآمن
        console.log('🧹 تمرير الحذف التلقائي الآمن...');
        await performDeletionPassAfterStatusSync();
        
        // ✅ ربط الفواتير بالطلبات أولاً (المرحلة 1)
        console.log('🔗 ربط الفواتير بالطلبات...');
        await linkInvoiceOrdersToOrders();
        
        // ✅ مزامنة الفواتير المستلمة تلقائياً
        console.log('📧 مزامنة الفواتير المستلمة تلقائياً...');
        try {
          const { data: syncRes, error: syncErr } = await supabase.rpc('sync_recent_received_invoices');
          if (syncErr) {
            console.warn('⚠️ فشل في مزامنة الفواتير المستلمة:', syncErr.message);
          } else if (syncRes?.updated_orders_count > 0) {
            console.log(`✅ تمت مزامنة ${syncRes.updated_orders_count} طلب من الفواتير المستلمة`);
          } else {
            console.log('ℹ️ لا توجد فواتير جديدة للمزامنة');
          }
        } catch (e) {
          console.warn('⚠️ خطأ في مزامنة الفواتير المستلمة:', e?.message || e);
        }
        
        // ✅ إصلاح تعارضات الحالات التلقائي بعد كل مزامنة
        console.log('🔧 فحص وإصلاح تعارضات الحالات...');
        const fixResult = await fixStatusMismatches();
        if (fixResult?.fixed > 0) {
          console.log(`✅ تم إصلاح ${fixResult.fixed} طلب تلقائياً`);
        }
        
        setLastSyncAt(new Date());
        console.log('✅ تمت المزامنة بنجاح');
      } catch (error) {
        console.error('❌ خطأ في المزامنة:', error);
      } finally {
        const finalEndTime = Date.now();
        console.log('[SYNC-TIMING] 🏁 تعيين isSyncing=false:', new Date().toISOString(), `(إجمالي: ${finalEndTime - startTime}ms)`);
        
        setIsSyncing(false);
        setSyncMode('standby');
        setSyncCountdown(0);
      }
    }, 5000); // ✅ تقليل من 10000 إلى 5000
    // ✅ لا نضيف الدوال useCallback في dependencies لأنها مستقرة
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePartner, isLoggedIn, isSyncing]);

  // Initial sync on login - respects autoSyncEnabled setting  
  useEffect(() => {
    if (isLoggedIn && activePartner === 'alwaseet' && syncMode === 'standby' && !lastSyncAt && autoSyncEnabled) {
      console.log('🚀 مزامنة أولية عند تسجيل الدخول...');
      performSyncWithCountdown();
    }
    // ✅ لا نضيف performSyncWithCountdown لأنها useCallback مستقرة
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, activePartner, syncMode, lastSyncAt, autoSyncEnabled]);

  // ✅ إعادة تفعيل المزامنة الدورية (كل 10 دقائق)
  useEffect(() => {
    let intervalId;
    if (isLoggedIn && 
        (activePartner === 'alwaseet' || activePartner === 'modon') && 
        syncMode === 'standby' && 
        !isSyncing &&
        autoSyncEnabled) {
      intervalId = setInterval(() => {
        console.log('⏰ مزامنة دورية تلقائية (كل 10 دقائق)...');
        performSyncWithCountdown();
      }, 10 * 60 * 1000); // 10 دقائق
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
    // ✅ لا نضيف performSyncWithCountdown لأنها useCallback مستقرة
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, activePartner, syncMode, isSyncing, autoSyncEnabled]);

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
        
        // إصلاح الحالة بناءً على جميع الشروط
        const finConfirmed = Number(waseetOrder.deliver_confirmed_fin) === 1;
        const receiptReceived = localOrder?.receipt_received === true;
        const isEmployeeOrder = localOrder?.employee_order === true;
        const employeeDebtPaid = !isEmployeeOrder || localOrder?.employee_debt_paid === true;
        
        if (finConfirmed && receiptReceived && employeeDebtPaid && localOrder.status === 'delivered') {
          updates.status = 'completed';
          console.log(`🎯 [Repair Complete] تحويل الطلب إلى completed:`, {
            finConfirmed,
            receiptReceived,
            employeeDebtPaid,
            orderNumber: localOrder?.order_number
          });
        } else if (finConfirmed && localOrder.status === 'delivered') {
          console.log(`⚠️ [Repair Pending] الطلب ${localOrder?.order_number} - delivered لكن بانتظار الفاتورة:`, {
            finConfirmed,
            receiptReceived,
            employeeDebtPaid
          });
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

  // ✅ دالة للتحقق من تعارضات الحالات وإصلاحها تلقائياً
  const fixStatusMismatches = useCallback(async () => {
    if (!token) {
      console.warn('⚠️ لا يوجد token - قم بتسجيل الدخول أولاً');
      return { fixed: 0, error: 'No token' };
    }
    
    console.log('🔧 فحص تعارضات الحالات...');
    
    try {
      const { data: conflictedOrders, error } = await scopeOrdersQuery(
        supabase
          .from('orders')
          .select('id, tracking_number, order_number, status, delivery_status')
          .eq('delivery_partner', 'alwaseet')
          .not('delivery_status', 'is', null)
          .not('status', 'in', '(completed)')
      );
      
      if (error) {
        console.error('❌ خطأ في جلب الطلبات:', error);
        return { fixed: 0, error };
      }
      
      if (!conflictedOrders?.length) {
        console.log('✅ لا توجد طلبات للفحص');
        return { fixed: 0 };
      }
      
      let fixedCount = 0;
      
      for (const order of conflictedOrders) {
        const statusConfig = getStatusConfig(order.delivery_status);
        const correctStatus = statusConfig.localStatus || statusConfig.internalStatus || 'pending';
        
        if (order.status !== correctStatus) {
          console.log(`🔧 إصلاح تعارض للطلب ${order.tracking_number} (${order.order_number}): ${order.status} → ${correctStatus} (delivery_status=${order.delivery_status})`);
          
          const { error: updateError } = await supabase
            .from('orders')
            .update({ 
              status: correctStatus,
              status_changed_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', order.id);
          
          if (!updateError) {
            fixedCount++;
          } else {
            console.error(`❌ خطأ في إصلاح الطلب ${order.tracking_number}:`, updateError);
          }
        }
      }
      
      console.log(`✅ تم إصلاح ${fixedCount} طلب من أصل ${conflictedOrders.length}`);
      return { fixed: fixedCount, total: conflictedOrders.length };
      
    } catch (error) {
      console.error('❌ خطأ في fixStatusMismatches:', error);
      return { fixed: 0, error };
    }
  }, [token]);


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
    reactivateExpiredAccount, // ✅ إضافة تجديد الجلسة
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
    
    // ✅ المراحل الجديدة - الحل الشامل
    linkInvoiceOrdersToOrders,      // المرحلة 1: ربط الفواتير بالطلبات
    resyncSpecificInvoice,           // المرحلة 2: إعادة مزامنة فاتورة محددة
    syncAllAvailableTokens,          // المرحلة 3: مزامنة كل التوكنات
    
    // Sync status exports
    isSyncing,
    syncCountdown,
    syncMode,
    lastSyncAt,
    performSyncWithCountdown,        // المرحلة 4: محسّن - يقبل الطلبات الظاهرة
    autoSyncEnabled,
    setAutoSyncEnabled,
    correctionComplete,
    setCorrectionComplete,
    syncVisibleOrdersBatch,
    fixDamagedAlWaseetStock,
    hasValidToken,
    fixStatusMismatches,  // ✅ دالة إصلاح التعارضات
  };

  // Export linkRemoteIdsForExistingOrders to window for SuperProvider access
  useEffect(() => {
    window.linkRemoteIdsForExistingOrders = linkRemoteIdsForExistingOrders;
    window.fixStatusMismatches = fixStatusMismatches;  // ✅ إتاحة من Console
    
    // ✅ دالة مفيدة لفحص طلب معين
    window.checkOrderStatus = async (trackingNumber) => {
      try {
        console.log(`🔍 فحص الطلب ${trackingNumber}...`);
        
        const { data: order, error } = await supabase
          .from('orders')
          .select('*')
          .eq('tracking_number', trackingNumber)
          .single();
        
        if (error) {
          console.error('❌ خطأ:', error);
          return;
        }
        
        const statusConfig = getStatusConfig(order.delivery_status);
        const expectedStatus = statusConfig.localStatus || statusConfig.internalStatus || 'pending';
        const hasMatch = order.status === expectedStatus;
        
        console.log(`📊 الطلب ${trackingNumber}:`, {
          order_number: order.order_number,
          current_status: order.status,
          delivery_status: order.delivery_status,
          expected_status: expectedStatus,
          status_text: statusConfig.text,
          match: hasMatch ? '✅ متطابق' : '❌ تعارض',
          updated_at: order.updated_at,
          status_changed_at: order.status_changed_at
        });
        
        if (!hasMatch) {
          console.warn(`⚠️ تعارض في الحالة! استخدم: await window.fixStatusMismatches()`);
        }
        
        return order;
      } catch (error) {
        console.error('❌ خطأ:', error);
      }
    };
    
    // ✅ دالة للتحقق من وجود توكن صالح لحساب محدد
    window.hasValidTokenForAccount = async (accountUsername, partnerName, userId = null) => {
      if (!accountUsername || !partnerName) return false;
      
      try {
        const normalizedAccount = accountUsername.trim().toLowerCase().replace(/\s+/g, '-');
        
        let query = supabase
          .from('delivery_partner_tokens')
          .select('id, expires_at, is_active')
          .eq('partner_name', partnerName)
          .ilike('account_username', normalizedAccount)
          .eq('is_active', true);
        
        if (userId) {
          query = query.eq('user_id', userId);
        }
        
        const { data, error } = await query.maybeSingle();
        
        if (error || !data) return false;
        
        // التحقق من انتهاء الصلاحية
        if (data.expires_at) {
          const expiryDate = new Date(data.expires_at);
          if (expiryDate < new Date()) {
            return false; // منتهي الصلاحية
          }
        }
        
        return true;
      } catch (error) {
        console.error('خطأ في hasValidTokenForAccount:', error);
        return false;
      }
    };
    
    return () => {
      delete window.linkRemoteIdsForExistingOrders;
      delete window.fixStatusMismatches;
      delete window.checkOrderStatus;
      delete window.hasValidTokenForAccount;
    };
  }, [linkRemoteIdsForExistingOrders, fixStatusMismatches]);

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
