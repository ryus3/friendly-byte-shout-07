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
  
  // Smart sync function موحد ومحسن
  const smartSync = async () => {
    if (!token || !isLoggedIn || activePartner !== 'alwaseet') return;
    
    try {
      console.log('🔄 مزامنة ذكية موحدة لفواتير الموظف:', employeeId);
      
      // جلب أحدث الفواتير من API
      const recentInvoices = await AlWaseetAPI.getMerchantInvoices(token);
      
      // حفظ الفواتير مع تنظيف صارم (آخر 10 فقط)
      if (recentInvoices?.length > 0) {
        const { data, error } = await supabase.rpc('upsert_alwaseet_invoice_list_with_cleanup', {
          p_invoices: recentInvoices,
          p_employee_id: employeeId
        });
        
        if (error) {
          console.warn('خطأ في upsert_alwaseet_invoice_list_with_cleanup:', error.message);
        } else {
          console.log('✅ مزامنة موحدة:', data?.processed || 0, 'فاتورة، حذف', data?.deleted_old || 0, 'قديمة');
          setLastAutoSync(Date.now());
          
          // ضمان وجود الفاتورة المستهدفة 1849184
          if (employeeId === 'aaf33986-9e8f-4aa7-97ff-8be81c5fab9b') { // Ahmed's ID
            await supabase.rpc('sync_missing_invoice_targeted', {
              p_invoice_id: '1849184',
              p_employee_id: employeeId
            });
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ Smart sync failed:', error.message);
    }
  };

  // جلب الفواتير من قاعدة البيانات الموحدة (نظام واحد للجميع)
  const fetchInvoices = async (forceRefresh = false, triggerSync = false) => {
    if (!employeeId) {
      setInvoices([]);
      return;
    }
    
    // استبعاد حالة "all" فقط - المدير يمكنه رؤية فواتير الموظفين
    if (employeeId === 'all') {
      setInvoices([]);
      return;
    }

    // مزامنة ذكية عند الطلب
    if (triggerSync) {
      await smartSync();
    }

    // استخدام التخزين المؤقت الذكي
    const now = Date.now();
    const CACHE_DURATION = 2 * 60 * 1000; // 2 دقيقة
    
    if (!forceRefresh && lastSync && (now - lastSync) < CACHE_DURATION) {
      console.log('🔄 استخدام البيانات المحفوظة محلياً');
      return;
    }

    setLoading(true);
    try {
      console.log('🔍 جلب فواتير من قاعدة البيانات الموحدة للموظف:', employeeId);
      
      // النظام الموحد: جميع المستخدمين يجلبون من قاعدة البيانات
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
          received_flag,
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
        .order('issued_at', { ascending: false })
        .limit(50);

      // في صفحة متابعة الموظفين: فواتير الموظف المحدد فقط
      query = query.eq('owner_user_id', employeeId);

      const { data: employeeInvoices, error } = await query;

      if (error) {
        console.error('خطأ في جلب فواتير الموظف:', error);
        setInvoices([]);
      } else {
        console.log('✅ النظام الموحد: تم جلب', employeeInvoices?.length || 0, 'فاتورة');
        console.log('📊 عينة من البيانات:', employeeInvoices?.slice(0, 2));
        
        // معالجة البيانات وحساب العداد الصحيح للطلبات
        const processedInvoices = (employeeInvoices || []).map(invoice => {
          const linkedOrders = invoice.delivery_invoice_orders?.filter(dio => 
            dio.orders && (
              !employeeId || 
              employeeId === '91484496-b887-44f7-9e5d-be9db5567604' || 
              dio.orders.created_by === employeeId
            )
          ) || [];
          
          // التأكد من أن الحالة تعتمد على قاعدة البيانات وليس API
          const isReceived = invoice.received || invoice.received_flag || false;
          const displayStatus = invoice.status || 'غير محدد';
          
          return {
            ...invoice,
            linked_orders_count: linkedOrders.length,
            linked_orders: linkedOrders,
            orders_count: linkedOrders.length || invoice.orders_count || 0,
            // ضمان الاعتماد على بيانات قاعدة البيانات
            display_status: displayStatus,
            is_received: isReceived,
            formatted_amount: (invoice.amount || 0).toLocaleString('ar-IQ'),
            display_date: invoice.issued_at ? new Date(invoice.issued_at).toLocaleDateString('ar-IQ') : 'غير محدد'
          };
        });

        console.log('🔍 مراجعة عينة فاتورة:', processedInvoices[0] ? {
          id: processedInvoices[0].external_id,
          status: processedInvoices[0].status,
          received: processedInvoices[0].received,
          received_flag: processedInvoices[0].received_flag,
          is_received: processedInvoices[0].is_received
        } : 'لا توجد فواتير');

        setInvoices(processedInvoices);
        setLastSync(now);
      }
    } catch (err) {
      console.error('خطأ غير متوقع في جلب الفواتير:', err);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  // تحميل بدون مزامنة تلقائية - فقط جلب البيانات المحفوظة
  useEffect(() => {
    if (employeeId && employeeId !== 'all') {
      console.log('🚀 جلب الفواتير المحفوظة للموظف:', employeeId);
      
      // جلب البيانات بدون مزامنة تلقائية لتجنب البطء
      fetchInvoices(false, false); // no force, no sync - just cached data
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