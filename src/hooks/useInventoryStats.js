import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient.js';
import { useAuth } from '@/contexts/UnifiedAuthContext';

/**
 * Hook موحد لإحصائيات المخزون - يحل محل جميع الحسابات المتكررة
 * استخدم هذا Hook بدلاً من الحسابات اليدوية في الملفات الأخرى
 */
export const useInventoryStats = (options = {}) => {
  const { user } = useAuth();
  const {
    departmentIds = null,
    categoryIds = null,
    autoRefresh = true,
    refreshInterval = 30000, // 30 ثانية
    refreshTrigger = null
  } = options;

  const [statsData, setStatsData] = useState({
    // الإحصائيات الأساسية
    totalProducts: 0,
    totalVariants: 0,
    totalQuantity: 0,
    totalCostValue: 0,
    totalSaleValue: 0,
    totalExpectedProfit: 0,
    reservedQuantity: 0,
    
    // تصنيف مستويات المخزون
    highStockCount: 0,
    mediumStockCount: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    archivedProductsCount: 0,
    
    // حالة التحميل والأخطاء
    loading: true,
    error: null,
    lastUpdated: null
  });

  // جلب إحصائيات المخزون من database function الموحدة
  const fetchInventoryStats = async () => {
    try {
      setStatsData(prev => ({ ...prev, loading: true, error: null }));

      const { data, error } = await supabase.rpc('get_inventory_stats', {
        p_department_ids: departmentIds,
        p_category_ids: categoryIds,
        p_user_id: user?.id || null
      });

      if (error) throw error;

      const stats = data?.[0] || {};

      setStatsData({
        // الإحصائيات الأساسية
        totalProducts: Number(stats.total_products) || 0,
        totalVariants: Number(stats.total_variants) || 0,
        totalQuantity: Number(stats.total_quantity) || 0,
        totalCostValue: Number(stats.total_cost_value) || 0,
        totalSaleValue: Number(stats.total_sale_value) || 0,
        totalExpectedProfit: Number(stats.total_expected_profit) || 0,
        reservedQuantity: Number(stats.reserved_quantity) || 0,
        
        // تصنيف مستويات المخزون
        highStockCount: Number(stats.high_stock_count) || 0,
        mediumStockCount: Number(stats.medium_stock_count) || 0,
        lowStockCount: Number(stats.low_stock_count) || 0,
        outOfStockCount: Number(stats.out_of_stock_count) || 0,
        archivedProductsCount: Number(stats.archived_products_count) || 0,
        
        // حالة النظام
        loading: false,
        error: null,
        lastUpdated: new Date()
      });

    } catch (error) {
      console.error('خطأ في جلب إحصائيات المخزون:', error);
      setStatsData(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }));
    }
  };

  // تحديث البيانات عند تغيير المعاملات
  useEffect(() => {
    fetchInventoryStats();
  }, [departmentIds, categoryIds, user?.id, refreshTrigger]);

  // التحديث التلقائي (اختياري)
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchInventoryStats, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  // دوال مساعدة محسوبة للوصول السريع
  const computedStats = useMemo(() => {
    const { 
      totalCostValue, 
      totalSaleValue, 
      totalQuantity,
      highStockCount,
      mediumStockCount,
      lowStockCount,
      outOfStockCount,
      totalProducts,
      archivedProductsCount
    } = statsData;

    return {
      // نسب الربحية
      profitMargin: totalSaleValue > 0 ? ((totalSaleValue - totalCostValue) / totalSaleValue * 100) : 0,
      
      // متوسط التكلفة والسعر
      averageCostPerItem: totalQuantity > 0 ? totalCostValue / totalQuantity : 0,
      averageSalePricePerItem: totalQuantity > 0 ? totalSaleValue / totalQuantity : 0,
      
      // نسب مستويات المخزون
      stockLevelPercentages: {
        high: totalProducts > 0 ? (highStockCount / totalProducts * 100) : 0,
        medium: totalProducts > 0 ? (mediumStockCount / totalProducts * 100) : 0,
        low: totalProducts > 0 ? (lowStockCount / totalProducts * 100) : 0,
        outOfStock: totalProducts > 0 ? (outOfStockCount / totalProducts * 100) : 0
      },
      
      // مؤشرات الصحة
      healthIndicators: {
        stockHealthScore: totalProducts > 0 ? 
          ((highStockCount * 4 + mediumStockCount * 3 + lowStockCount * 1) / (totalProducts * 4) * 100) : 0,
        archivedPercentage: totalProducts > 0 ? (archivedProductsCount / totalProducts * 100) : 0,
        activeProductsCount: totalProducts - archivedProductsCount
      }
    };
  }, [statsData]);

  // دالة إعادة تحميل البيانات
  const refreshStats = () => {
    fetchInventoryStats();
  };

  // إرجاع جميع البيانات والدوال
  return {
    // الإحصائيات الأساسية
    ...statsData,
    
    // الإحصائيات المحسوبة
    ...computedStats,
    
    // دوال التحكم
    refreshStats,
    
    // حالة النظام
    isLoading: statsData.loading,
    hasError: !!statsData.error,
    isHealthy: !statsData.loading && !statsData.error && statsData.lastUpdated
  };
};

export default useInventoryStats;