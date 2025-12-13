import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useInventory } from '@/contexts/InventoryContext';
import { usePermissions } from '@/hooks/usePermissions';
import devLog from '@/lib/devLogger';

/**
 * Hook موحد لإحصائيات المخزون
 */
const useInventoryStats = () => {
  const { orders, products } = useInventory();
  const { user } = usePermissions();
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

  const computeReservedFallback = () => {
    try {
      const reservedOrders = (orders || []).filter(o => 
        ['pending', 'shipped', 'delivery', 'returned'].includes(o.status) &&
        o.status !== 'returned_in_stock' &&
        o.status !== 'completed'
      );
      
      const totalReservedQuantity = reservedOrders.reduce((total, order) => {
        const orderReserved = (order.items || []).reduce((sum, item) => {
          if (item.item_status === 'delivered') return sum;
          if (item.item_status === 'returned_in_stock' || item.item_status === 'returned') return sum;
          if (item.item_direction === 'incoming') return sum;
          
          return sum + (item.quantity || 0);
        }, 0);
        
        return total + orderReserved;
      }, 0);
      
      devLog.log('🔢 [InventoryStats] حساب المخزون المحجوز:', {
        reservedOrdersCount: reservedOrders.length,
        totalReservedQuantity
      });
      
      return totalReservedQuantity;
    } catch (err) {
      devLog.error('❌ [InventoryStats] خطأ في حساب المخزون المحجوز:', err);
      return 0;
    }
  };

  const fetchInventoryStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      devLog.log('🔍 [InventoryStats] بدء جلب إحصائيات المخزون...');

      const { data, error: statsError } = await supabase.rpc('get_unified_inventory_stats', {
        p_employee_id: user?.id
      });
      
      devLog.log('📊 [InventoryStats] استجابة قاعدة البيانات:', { data, error: statsError });
      
      if (statsError) {
        devLog.error('❌ [InventoryStats] خطأ في استدعاء get_inventory_stats:', statsError);
        throw statsError;
      }

      if (data && data.length > 0) {
        const statsData = data[0];
        devLog.log('✅ [InventoryStats] البيانات المستلمة:', statsData);
        
        const reservedFallback = computeReservedFallback();
        const newStats = {
          totalProducts: parseInt(statsData.total_products) || (products?.length || 0),
          totalVariants: parseInt(statsData.total_variants) || 0,
          highStockCount: parseInt(statsData.high_stock_count) || 0,
          mediumStockCount: parseInt(statsData.medium_stock_count) || 0,
          lowStockCount: parseInt(statsData.low_stock_count) || 0,
          outOfStockCount: parseInt(statsData.out_of_stock_count) || 0,
          reservedStockCount: reservedFallback,
          archivedProductsCount: parseInt(statsData.archived_products_count) || 0,
          totalInventoryValue: parseFloat(statsData.total_inventory_value) || 0,
          departments: statsData.departments_data || []
        };
        
        devLog.log('🎯 [InventoryStats] الإحصائيات المحسوبة:', newStats);
        setStats(newStats);
      } else {
        devLog.warn('⚠️ [InventoryStats] لا توجد بيانات، استخدام Fallback');
        const reservedFallback = computeReservedFallback();
        setStats(prev => ({ ...prev, reservedStockCount: reservedFallback, totalProducts: products?.length || prev.totalProducts }));
      }
    } catch (err) {
      devLog.error('❌ [InventoryStats] خطأ في جلب إحصائيات المخزون:', err);
      const reservedFallback = computeReservedFallback();
      setStats(prev => ({ ...prev, reservedStockCount: reservedFallback, totalProducts: products?.length || prev.totalProducts }));
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventoryStats();
  }, []);

  useEffect(() => {
    const reservedFallback = computeReservedFallback();
    setStats(prev => ({ ...prev, reservedStockCount: reservedFallback }));
  }, [orders]);

  return {
    stats,
    loading,
    error,
    refreshStats: fetchInventoryStats
  };
};

export default useInventoryStats;
