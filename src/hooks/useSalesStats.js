import { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Hook مركزي للحصول على إحصائيات المبيعات
 * يحسب البيانات مرة واحدة من database views ويشاركها
 */
export const useSalesStats = (options = {}) => {
  const { refreshTrigger = null } = options;
  const [salesData, setSalesData] = useState({
    productsSold: new Map(), // Map(variant_id -> sold_data)
    summaryStats: null,
    loading: true,
    error: null
  });

  useEffect(() => {
    fetchSalesStats();
  }, [refreshTrigger]);

  const fetchSalesStats = async () => {
    try {
      setSalesData(prev => ({ ...prev, loading: true, error: null }));

      // جلب إحصائيات المنتجات المباعة من الـ function
      const { data: productsSoldData, error: productsError } = await supabase
        .rpc('get_products_sold_stats');

      if (productsError) throw productsError;

      // جلب الإحصائيات العامة من الـ function
      const { data: summaryData, error: summaryError } = await supabase
        .rpc('get_sales_summary_stats');

      if (summaryError) throw summaryError;

      // أخذ أول عنصر من النتيجة (function ترجع array)
      const summaryStats = summaryData?.[0] || {};

      // تحويل بيانات المنتجات إلى Map للوصول السريع
      const productsSoldMap = new Map();
      productsSoldData.forEach(item => {
        productsSoldMap.set(item.variant_id, {
          soldQuantity: item.sold_quantity || 0,
          ordersCount: item.orders_count || 0,
          totalRevenue: item.total_revenue || 0,
          totalCost: item.total_cost || 0,
          lastSoldDate: item.last_sold_date
        });
      });

      setSalesData({
        productsSold: productsSoldMap,
        summaryStats: {
          totalOrders: summaryStats.total_orders || 0,
          totalProductsSold: summaryStats.total_products_sold || 0,
          totalRevenue: summaryStats.total_revenue || 0,
          totalCogs: summaryStats.total_cogs || 0,
          totalDeliveryFees: summaryStats.total_delivery_fees || 0
        },
        loading: false,
        error: null
      });

      console.log('📊 تم جلب إحصائيات المبيعات بنجاح:', {
        productsCount: productsSoldMap.size,
        totalProductsSold: summaryStats.total_products_sold
      });

    } catch (error) {
      console.error('❌ خطأ في جلب إحصائيات المبيعات:', error);
      setSalesData(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }));
    }
  };

  // دالة للحصول على بيانات منتج معين
  const getVariantSoldData = (variantId) => {
    return salesData.productsSold.get(variantId) || {
      soldQuantity: 0,
      ordersCount: 0,
      totalRevenue: 0,
      totalCost: 0,
      lastSoldDate: null
    };
  };

  // دالة لإعادة تحميل البيانات
  const refreshSalesStats = () => {
    fetchSalesStats();
  };

  return {
    // البيانات
    productsSold: salesData.productsSold,
    summaryStats: salesData.summaryStats,
    
    // الحالة
    loading: salesData.loading,
    error: salesData.error,
    
    // الوظائف المساعدة
    getVariantSoldData,
    refreshSalesStats
  };
};

export default useSalesStats;