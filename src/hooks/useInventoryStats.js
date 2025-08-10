import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useInventory } from '@/contexts/InventoryContext';

/**
 * Hook موحد لإحصائيات المخزون
 * يستخدم الدالة الموحدة get_inventory_stats() معFallback محلي عند غياب البيانات
 */
const useInventoryStats = () => {
  const { orders, products } = useInventory();
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
      const reservedOrders = (orders || []).filter(o => ['pending','delivery','shipped'].includes(o.status));
      return reservedOrders.length;
    } catch {
      return 0;
    }
  };

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
        
        const reservedFallback = computeReservedFallback();
        const newStats = {
          totalProducts: parseInt(statsData.total_products) || (products?.length || 0),
          totalVariants: parseInt(statsData.total_variants) || 0,
          highStockCount: parseInt(statsData.high_stock_count) || 0,
          mediumStockCount: parseInt(statsData.medium_stock_count) || 0,
          lowStockCount: parseInt(statsData.low_stock_count) || 0,
          outOfStockCount: parseInt(statsData.out_of_stock_count) || 0,
          // نعتمد كلياً على البيانات الموحدة (الطلبات) لحساب المحجوز لضمان التطابق مع النافذة
          reservedStockCount: reservedFallback,
          archivedProductsCount: parseInt(statsData.archived_products_count) || 0,
          totalInventoryValue: parseFloat(statsData.total_inventory_value) || 0,
          departments: statsData.departments_data || []
        };
        
        console.log('🎯 [InventoryStats] الإحصائيات المحسوبة:', newStats);
        setStats(newStats);
      } else {
        console.warn('⚠️ [InventoryStats] لا توجد بيانات في الاستجابة، استخدام Fallback محلي');
        const reservedFallback = computeReservedFallback();
        setStats(prev => ({ ...prev, reservedStockCount: reservedFallback, totalProducts: products?.length || prev.totalProducts }));
      }
    } catch (err) {
      console.error('❌ [InventoryStats] خطأ في جلب إحصائيات المخزون، سيتم استخدام Fallback:', err);
      const reservedFallback = computeReservedFallback();
      setStats(prev => ({ ...prev, reservedStockCount: reservedFallback, totalProducts: products?.length || prev.totalProducts }));
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventoryStats();
    // أعد الحساب محلياً عند تغير الطلبات لضمان تطابق البطاقة مع النافذة
  }, []);

  // عندما تتغير الطلبات، حدّث قيمة المحجوز فوراً محلياً
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