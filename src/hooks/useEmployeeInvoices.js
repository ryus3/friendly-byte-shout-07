import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useLocalStorage } from '@/hooks/useLocalStorage';

/**
 * هوك محسن لإدارة فواتير الموظفين مع عرض البيانات الصحيحة للمديرين
 */
export const useEmployeeInvoices = (employeeId) => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useLocalStorage(`invoices-sync-${employeeId}`, null);
  
  // جلب الفواتير مع نظام محسن للمديرين والموظفين
  const fetchInvoices = async (forceRefresh = false) => {
    if (!employeeId || employeeId === 'all') {
      setInvoices([]);
      return;
    }

    // التحقق من الحاجة للمزامنة (كل 2 دقائق للفواتير الحية)
    const now = Date.now();
    const SYNC_INTERVAL = 2 * 60 * 1000; // 2 دقائق
    
    if (!forceRefresh && lastSync && (now - lastSync) < SYNC_INTERVAL) {
      console.log('🔄 استخدام البيانات المحفوظة محلياً');
      return;
    }

    setLoading(true);
    try {
      console.log('🔍 جلب فواتير الموظف:', employeeId);
      
      // استعلام شامل للفواتير مع ربطها بالطلبات الصحيحة
      const { data: employeeInvoices, error } = await supabase
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
        .or(`owner_user_id.eq.${employeeId},owner_user_id.is.null`)
        .gte('issued_at', new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString()) // آخر 6 أشهر
        .order('issued_at', { ascending: false })
        .limit(50); // أحدث 50 فاتورة

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

        // فلترة للموظف المحدد إذا لم يكن المدير
        let filteredInvoices = processedInvoices;
        if (employeeId !== '91484496-b887-44f7-9e5d-be9db5567604') {
          filteredInvoices = processedInvoices.filter(invoice => 
            invoice.owner_user_id === employeeId ||
            (invoice.delivery_invoice_orders && 
             invoice.delivery_invoice_orders.some(dio => 
               dio.orders && dio.orders.created_by === employeeId
             ))
          );
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

  // تحميل تلقائي عند تغيير الموظف
  useEffect(() => {
    fetchInvoices();
  }, [employeeId]);

  // إحصائيات الفواتير المحسنة
  const stats = useMemo(() => {
    const totalInvoices = invoices.length;
    const pendingInvoices = invoices.filter(inv => !inv.received && !inv.received_flag).length;
    const totalAmount = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const totalOrders = invoices.reduce((sum, inv) => sum + (inv.linked_orders_count || inv.orders_count || 0), 0);
    const receivedInvoices = invoices.filter(inv => inv.received || inv.received_flag).length;
    
    return { 
      totalInvoices, 
      pendingInvoices, 
      receivedInvoices,
      totalAmount, 
      totalOrders 
    };
  }, [invoices]);

  return {
    invoices,
    loading,
    stats,
    refetch: () => fetchInvoices(true),
    forceRefresh: () => fetchInvoices(true)
  };
};