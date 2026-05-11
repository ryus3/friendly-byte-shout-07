import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import * as AlWaseetAPI from '@/lib/alwaseet-api';
import devLog from '@/lib/devLogger';

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
      devLog.log('🔄 مزامنة ذكية موحدة لفواتير الموظف:', employeeId);
      
      // جلب أحدث الفواتير من API
      const recentInvoices = await AlWaseetAPI.getMerchantInvoices(token);
      
      // حفظ الفواتير مع تنظيف صارم (آخر 10 فقط)
      if (recentInvoices?.length > 0) {
        const { data, error } = await supabase.rpc('upsert_alwaseet_invoice_list_with_cleanup', {
          p_invoices: recentInvoices,
          p_employee_id: employeeId
        });
        
        if (error) {
          devLog.warn('خطأ في upsert_alwaseet_invoice_list_with_cleanup:', error.message);
        } else {
          devLog.log('✅ مزامنة موحدة:', data?.processed || 0, 'فاتورة، حذف', data?.deleted_old || 0, 'قديمة');
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
      devLog.warn('⚠️ Smart sync failed:', error.message);
    }
  };

  // جلب الفواتير من قاعدة البيانات الموحدة (نظام واحد للجميع)
  const fetchInvoices = async (forceRefresh = false, triggerSync = false) => {
    if (!employeeId) {
      setInvoices([]);
      return;
    }
    
  // استبعاد المدير من مزامنة الفواتير في صفحة متابعة الموظفين
    const ADMIN_ID = '91484496-b887-44f7-9e5d-be9db5567604';
    if (employeeId === 'all' || employeeId === ADMIN_ID) {
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
      devLog.log('🔄 استخدام البيانات المحفوظة محلياً');
      return;
    }

    setLoading(true);
    try {
      devLog.log('🔍 جلب فواتير الموظف عبر الطلبات المحلية المرتبطة:', employeeId);

      // ✅ نموذج جديد: نعتبر "فاتورة الموظف" أي فاتورة لها على الأقل طلب محلي
      //    أنشأه هذا الموظف (orders.created_by = employeeId) عبر delivery_invoice_orders.
      //    هذا يدعم حالة حساب شركة توصيل مشترك بين المدير وموظف، حيث الفاتورة الواحدة
      //    تظهر لكل مستخدم بحسب طلباته المحلية المرتبطة بها.

      // 1) جلب كل ids الفواتير المرتبطة بطلبات هذا الموظف
      const { data: dioRows, error: dioErr } = await supabase
        .from('delivery_invoice_orders')
        .select('invoice_id, order_id, orders!inner(id, created_by)')
        .eq('orders.created_by', employeeId);

      if (dioErr) {
        console.error('خطأ في جلب روابط فواتير الموظف:', dioErr);
        setInvoices([]);
        return;
      }

      const invoiceIds = Array.from(new Set((dioRows || []).map(r => r.invoice_id).filter(Boolean)));

      if (invoiceIds.length === 0) {
        setInvoices([]);
        setLastSync(now);
        return;
      }

      // 2) جلب الفواتير + كل روابطها (سنفلتر روابط الموظف فقط عند العرض)
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
          account_username,
          partner_name_ar,
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
        .in('id', invoiceIds)
        .in('partner', ['alwaseet', 'modon'])
        .order('issued_at', { ascending: false })
        .limit(100);

      const { data: employeeInvoices, error } = await query;

      if (error) {
        console.error('خطأ في جلب فواتير الموظف:', error);
        setInvoices([]);
      } else {
        devLog.log('✅ النظام الموحد: تم جلب', employeeInvoices?.length || 0, 'فاتورة');
        devLog.log('📊 عينة من البيانات:', employeeInvoices?.slice(0, 2));
        
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

        devLog.log('🔍 مراجعة عينة فاتورة:', processedInvoices[0] ? {
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
      devLog.log('🚀 جلب الفواتير المحفوظة للموظف:', employeeId);
      
      // جلب البيانات بدون مزامنة تلقائية لتجنب البطء
      fetchInvoices(false, false); // no force, no sync - just cached data
    }
  }, [employeeId]);

  // ✅ المزامنة الخلفية تتم عبر pg_cron + smart-invoice-sync فقط
  // أي interval هنا يضاعف الاستدعاءات ويسبب فرط طلبات على شركة التوصيل (WAF risk).
  // المستخدم يحدّث يدوياً عبر زر التحديث، أو ينتظر الدورة الخلفية.

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