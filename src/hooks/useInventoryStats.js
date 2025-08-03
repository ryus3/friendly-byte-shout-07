import { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Hook موحد لإحصائيات المخزون
 * يستخدم الدالة الموحدة get_inventory_stats()
 */
const useInventoryStats = () => {
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalVariants: 0,
    highStockCount: 0,
    mediumStockCount: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    reservedStockCount: 0,
    archivedProductsCount: 0,
    totalInventoryValue: 0,
    departments: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchInventoryStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔍 [InventoryStats] بدء جلب إحصائيات المخزون...');

      const { data, error: statsError } = await supabase.rpc('get_unified_inventory_stats');
      
      console.log('📊 [InventoryStats] استجابة قاعدة البيانات:', { data, error: statsError });
      
      if (statsError) {
        console.error('❌ [InventoryStats] خطأ في استدعاء get_inventory_stats:', statsError);
        throw statsError;
      }

      if (data && data.length > 0) {
        const statsData = data[0];
        console.log('✅ [InventoryStats] البيانات المستلمة:', statsData);
        
        const newStats = {
          totalProducts: parseInt(statsData.total_products) || 0,
          totalVariants: parseInt(statsData.total_variants) || 0,
          highStockCount: parseInt(statsData.high_stock_count) || 0,
          mediumStockCount: parseInt(statsData.medium_stock_count) || 0,
          lowStockCount: parseInt(statsData.low_stock_count) || 0,
          outOfStockCount: parseInt(statsData.out_of_stock_count) || 0,
          reservedStockCount: parseInt(statsData.reserved_stock_count) || 0,
          archivedProductsCount: parseInt(statsData.archived_products_count) || 0,
          totalInventoryValue: parseFloat(statsData.total_inventory_value) || 0,
          departments: statsData.departments_data || []
        };
        
        console.log('🎯 [InventoryStats] الإحصائيات المحسوبة:', newStats);
        setStats(newStats);
      } else {
        console.warn('⚠️ [InventoryStats] لا توجد بيانات في الاستجابة');
      }
    } catch (err) {
      console.error('❌ [InventoryStats] خطأ في جلب إحصائيات المخزون:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventoryStats();
  }, []);

  return {
    stats,
    loading,
    error,
    refreshStats: fetchInventoryStats
  };
};

export default useInventoryStats;