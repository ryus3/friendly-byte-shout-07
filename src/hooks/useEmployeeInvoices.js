import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import * as AlWaseetAPI from '@/lib/alwaseet-api';

/**
 * هوك محسن لإدارة فواتير الموظفين مع عرض البيانات الصحيحة للمديرين
 */
export const useEmployeeInvoices = (employeeId) => {
  const { token, isLoggedIn, activePartner } = useAlWaseet();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useLocalStorage(`invoices-sync-${employeeId}`, null);
  const [lastAutoSync, setLastAutoSync] = useLocalStorage('invoices-auto-sync', null);
  const [syncSettings] = useLocalStorage('delivery-invoice-sync-settings', {
    enabled: true,
    frequency: 'daily', // daily, manual
    dailyTime: '09:00'
  });
  
  // Smart sync function محسن للمدير لرؤية فواتير جديدة
  const smartSync = async () => {
    if (!token || !isLoggedIn || activePartner !== 'alwaseet') return;
    
    try {
      console.log('🔄 مزامنة ذكية لفواتير الموظف:', employeeId);
      
      // جلب أحدث الفواتير من API
      const recentInvoices = await AlWaseetAPI.getMerchantInvoices(token);
      
      // حفظ الفواتير في قاعدة البيانات مع owner_user_id صحيح + تنظيف تلقائي لآخر 10
      if (recentInvoices?.length > 0) {
        const { data, error } = await supabase.rpc('upsert_alwaseet_invoice_list_with_cleanup', {
          p_invoices: recentInvoices,
          p_employee_id: employeeId
        });
        
        if (error) {
          console.warn('خطأ في upsert_alwaseet_invoice_list_with_cleanup:', error.message);
        } else {
          console.log('✅ مزامنة الفواتير من API مع تنظيف:', recentInvoices.length);
          setLastAutoSync(Date.now());
        }
      }
    } catch (error) {
      console.warn('⚠️ Smart sync failed:', error.message);
    }
  };

  // جلب الفواتير مع نظام محسن للمديرين والموظفين
  const fetchInvoices = async (forceRefresh = false, triggerSync = false) => {
    if (!employeeId) {
      setInvoices([]);
      return;
    }
    
    // للمدير عرض "الكل" - جلب جميع فواتير الموظفين
    if (employeeId === 'all') {
      // سيتم التعامل مع هذا في component منفصل
      setInvoices([]);
      return;
    }

    // Trigger smart sync if requested (entry to tab or manual refresh)
    if (triggerSync) {
      await smartSync();
    }

    // Smart caching - use DB data, sync when needed
    const now = Date.now();
    const CACHE_DURATION = 2 * 60 * 1000; // 2 دقيقة للمزامنة السريعة
    
    if (!forceRefresh && lastSync && (now - lastSync) < CACHE_DURATION) {
      console.log('🔄 استخدام البيانات المحفوظة محلياً');
      return;
    }

    setLoading(true);
    try {
      console.log('🔍 جلب فواتير الموظف:', employeeId);
      
      // استعلام محسن للمديرين لرؤية جميع الفواتير
      let query = supabase
        .from('delivery_invoices')
        .select(`
          id,
          external_id,
          partner,
          amount,
          orders_count,
          issued_at,
          received,
          received_at,
          status,
          status_normalized,
          owner_user_id,
          created_at,
          updated_at,
          delivery_invoice_orders!left(
            id,
            order_id,
            external_order_id,
            orders!left(
              id,
              tracking_number,
              order_number,
              customer_name,
              customer_phone,
              final_amount,
              status,
              created_by
            )
          )
        `)
        .eq('partner', 'alwaseet')
        .gte('issued_at', new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString()) // آخر 6 أشهر
        .order('issued_at', { ascending: false })
        .limit(50); // أحدث 50 فاتورة

      // المدير يرى جميع الفواتير بدون قيود على owner_user_id
      if (employeeId !== '91484496-b887-44f7-9e5d-be9db5567604') {
        // للموظفين: فلترة بـ owner_user_id أو الفواتير القديمة
        query = query.or(`owner_user_id.eq.${employeeId},owner_user_id.is.null`);
      }
      // للمدير: لا توجد فلترة إضافية - يرى جميع الفواتير

      const { data: employeeInvoices, error } = await query;

      if (error) {
        console.error('خطأ في جلب فواتير الموظف:', error);
        setInvoices([]);
      } else {
        console.log('✅ تم جلب الفواتير:', employeeInvoices?.length || 0);
        
        // معالجة البيانات وحساب العداد الصحيح للطلبات
        const processedInvoices = (employeeInvoices || []).map(invoice => {
          const linkedOrders = invoice.delivery_invoice_orders?.filter(dio => 
            dio.orders && (
              !employeeId || 
              employeeId === '91484496-b887-44f7-9e5d-be9db5567604' || 
              dio.orders.created_by === employeeId
            )
          ) || [];
          
          return {
            ...invoice,
            linked_orders_count: linkedOrders.length,
            linked_orders: linkedOrders,
            // إعادة حساب عدد الطلبات بناءً على الطلبات المربوطة الحقيقية
            orders_count: linkedOrders.length || invoice.orders_count || 0
          };
        });

        // فلترة محسنة - المدير يرى جميع الفواتير، الموظفون يرون فواتيرهم فقط
        let filteredInvoices = processedInvoices;
        if (employeeId !== '91484496-b887-44f7-9e5d-be9db5567604') {
          filteredInvoices = processedInvoices.filter(invoice => 
            invoice.owner_user_id === employeeId ||
            invoice.owner_user_id === null ||  // الفواتير القديمة بدون مالك
            (invoice.delivery_invoice_orders && 
             invoice.delivery_invoice_orders.some(dio => 
               dio.orders && dio.orders.created_by === employeeId
             ))
          );
        } else {
          // المدير يرى جميع الفواتير بما في ذلك الجديدة
          filteredInvoices = processedInvoices;
          console.log('👑 المدير يرى جميع الفواتير:', processedInvoices.length, {
            withOwner: processedInvoices.filter(inv => inv.owner_user_id).length,
            withoutOwner: processedInvoices.filter(inv => !inv.owner_user_id).length
          });
        }

        setInvoices(filteredInvoices);
        setLastSync(now);
      }
    } catch (err) {
      console.error('خطأ غير متوقع في جلب الفواتير:', err);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  // تحميل تلقائي ومحسن للمديرين مع تجنب التحميل المتكرر
  useEffect(() => {
    if (employeeId && employeeId !== 'all') {
      console.log('🚀 تحميل تلقائي للفواتير للموظف:', employeeId);
      
      // مزامنة فورية لجميع الحالات لضمان أحدث البيانات
      console.log('🔄 مزامنة فورية عند دخول التبويب');
      fetchInvoices(true, true); // force refresh + trigger sync لجميع المستخدمين
    }
  }, [employeeId]);

  // Scheduled daily sync based on settings
  useEffect(() => {
    if (!syncSettings.enabled || syncSettings.frequency !== 'daily') return;
    
    const checkDailySync = () => {
      const now = new Date();
      const [hour, minute] = syncSettings.dailyTime.split(':');
      const syncTime = new Date();
      syncTime.setHours(parseInt(hour), parseInt(minute), 0, 0);
      
      // Check if it's sync time and we haven't synced today
      const lastSyncDate = lastAutoSync ? new Date(lastAutoSync).toDateString() : null;
      const today = now.toDateString();
      
      if (
        now >= syncTime && 
        lastSyncDate !== today &&
        Math.abs(now - syncTime) < 60000 // Within 1 minute of sync time
      ) {
        console.log('🕘 تشغيل المزامنة اليومية المجدولة');
        smartSync();
      }
    };

    // Check every minute for scheduled sync
    const syncInterval = setInterval(checkDailySync, 60000);
    checkDailySync(); // Check immediately

    return () => clearInterval(syncInterval);
  }, [syncSettings, lastAutoSync, token]);

  // إحصائيات الفواتير المحسنة مع فلترة زمنية
  const getFilteredStats = (filteredInvoices) => {
    const totalInvoices = filteredInvoices.length;
    const pendingInvoices = filteredInvoices.filter(inv => !inv.received && !inv.received_flag).length;
    const totalAmount = filteredInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const totalOrders = filteredInvoices.reduce((sum, inv) => sum + (inv.linked_orders_count || inv.orders_count || 0), 0);
    const receivedInvoices = filteredInvoices.filter(inv => inv.received || inv.received_flag).length;
    
    return { 
      totalInvoices, 
      pendingInvoices, 
      receivedInvoices,
      totalAmount, 
      totalOrders 
    };
  };

  const stats = useMemo(() => {
    return getFilteredStats(invoices);
  }, [invoices]);

  return {
    invoices,
    loading,
    stats,
    getFilteredStats, // إضافة دالة لحساب إحصائيات مفلترة
    refetch: () => fetchInvoices(true, true), // Force refresh with sync
    forceRefresh: () => fetchInvoices(true, true),
    smartSync, // Expose smart sync for manual trigger
    lastAutoSync,
    syncSettings
  };
};