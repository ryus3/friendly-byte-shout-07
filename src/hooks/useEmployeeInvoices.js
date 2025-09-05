import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useLocalStorage } from '@/hooks/useLocalStorage';

/**
 * هوك مخصص لإدارة فواتير الموظفين مع تحسين الأداء والحفظ المحلي
 */
export const useEmployeeInvoices = (employeeId) => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useLocalStorage(`invoices-sync-${employeeId}`, null);
  
  // جلب الفواتير مع نظام الحفظ المحلي والمزامنة الذكية
  const fetchInvoices = async (forceRefresh = false) => {
    if (!employeeId || employeeId === 'all') {
      setInvoices([]);
      return;
    }

    // التحقق من الحاجة للمزامنة (كل 10 دقائق للفواتير)
    const now = Date.now();
    const SYNC_INTERVAL = 10 * 60 * 1000; // 10 دقائق
    
    if (!forceRefresh && lastSync && (now - lastSync) < SYNC_INTERVAL) {
      console.log('🔄 استخدام البيانات المحفوظة محلياً');
      return;
    }

    setLoading(true);
    try {
      console.log('🔍 جلب فواتير الموظف:', employeeId);
      
      // استعلام محسن للفواتير الحقيقية مع join للطلبات
      let query = supabase
        .from('delivery_invoices')
        .select(`
          *,
          delivery_invoice_orders!inner(
            id,
            order_id,
            external_order_id
          )
        `)
        .eq('partner', 'alwaseet');

      // فلترة دقيقة للموظف
      if (employeeId === '91484496-b887-44f7-9e5d-be9db5567604') {
        query = query.or(`owner_user_id.eq.${employeeId},owner_user_id.is.null`);
      } else {
        query = query.eq('owner_user_id', employeeId);
      }

      const { data: employeeInvoices, error } = await query
        .order('issued_at', { ascending: false });

      if (error) {
        console.error('خطأ في جلب فواتير الموظف:', error);
        setInvoices([]);
      } else {
        console.log('✅ تم جلب الفواتير:', employeeInvoices?.length || 0);
        setInvoices(employeeInvoices || []);
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

  // إحصائيات الفواتير
  const stats = useMemo(() => {
    const totalInvoices = invoices.length;
    const pendingInvoices = invoices.filter(inv => !inv.received).length;
    const totalAmount = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const totalOrders = invoices.reduce((sum, inv) => sum + (inv.orders_count || 0), 0);
    
    return { totalInvoices, pendingInvoices, totalAmount, totalOrders };
  }, [invoices]);

  return {
    invoices,
    loading,
    stats,
    refetch: () => fetchInvoices(true),
    forceRefresh: () => fetchInvoices(true)
  };
};