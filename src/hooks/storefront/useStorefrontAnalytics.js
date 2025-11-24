import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Custom hook لتتبع وجلب إحصائيات المتجر
 */
export const useStorefrontAnalytics = (employeeId) => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  // جلب الإحصائيات
  const fetchAnalytics = useCallback(async (dateRange = 'week') => {
    if (!employeeId) return;

    try {
      setLoading(true);

      const today = new Date();
      let startDate = new Date();

      switch (dateRange) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate.setDate(today.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(today.getMonth() - 1);
          break;
        default:
          startDate.setDate(today.getDate() - 7);
      }

      const { data, error } = await supabase
        .from('storefront_analytics')
        .select('*')
        .eq('employee_id', employeeId)
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (error) throw error;

      // حساب الإجماليات
      const totals = data?.reduce((acc, day) => ({
        total_visitors: acc.total_visitors + (day.visitors || 0),
        total_page_views: acc.total_page_views + (day.page_views || 0),
        total_product_views: acc.total_product_views + (day.product_views || 0),
        total_cart_additions: acc.total_cart_additions + (day.cart_additions || 0),
        total_orders: acc.total_orders + (day.orders_placed || 0),
        total_revenue: acc.total_revenue + (day.revenue || 0)
      }), {
        total_visitors: 0,
        total_page_views: 0,
        total_product_views: 0,
        total_cart_additions: 0,
        total_orders: 0,
        total_revenue: 0
      });

      setAnalytics({
        daily: data || [],
        totals,
        conversion_rate: totals.total_visitors > 0 
          ? ((totals.total_orders / totals.total_visitors) * 100).toFixed(2)
          : 0
      });
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  // تتبع مشاهدة صفحة
  const trackPageView = useCallback(async () => {
    if (!employeeId) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { error } = await supabase.rpc('increment_analytics_metric', {
        p_employee_id: employeeId,
        p_date: today,
        p_metric: 'page_views'
      });

      if (error) throw error;
    } catch (err) {
      console.error('Error tracking page view:', err);
    }
  }, [employeeId]);

  // تتبع مشاهدة منتج
  const trackProductView = useCallback(async (productId) => {
    if (!employeeId) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { error } = await supabase.rpc('increment_analytics_metric', {
        p_employee_id: employeeId,
        p_date: today,
        p_metric: 'product_views'
      });

      if (error) throw error;
    } catch (err) {
      console.error('Error tracking product view:', err);
    }
  }, [employeeId]);

  // تتبع إضافة للسلة
  const trackCartAddition = useCallback(async () => {
    if (!employeeId) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { error } = await supabase.rpc('increment_analytics_metric', {
        p_employee_id: employeeId,
        p_date: today,
        p_metric: 'cart_additions'
      });

      if (error) throw error;
    } catch (err) {
      console.error('Error tracking cart addition:', err);
    }
  }, [employeeId]);

  // تتبع طلب جديد
  const trackOrder = useCallback(async (orderAmount) => {
    if (!employeeId) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { error } = await supabase.rpc('record_storefront_order', {
        p_employee_id: employeeId,
        p_date: today,
        p_amount: orderAmount
      });

      if (error) throw error;
    } catch (err) {
      console.error('Error tracking order:', err);
    }
  }, [employeeId]);

  useEffect(() => {
    fetchAnalytics('week');
  }, [fetchAnalytics]);

  return {
    analytics,
    loading,
    fetchAnalytics,
    trackPageView,
    trackProductView,
    trackCartAddition,
    trackOrder
  };
};
