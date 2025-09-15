/**
 * نظام مالي موحد مستقر - خالي من temporal dead zone
 */

import { useState, useEffect, useCallback } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';

export const useUnifiedFinancialSystem = (timePeriod = 'all', options = {}) => {
  const { loading: inventoryLoading } = useInventory();
  const { user } = useAuth();
  const { canViewAllData } = usePermissions();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [financialData, setFinancialData] = useState(null);
  
  // إعدادات النظام
  const { enableDebugLogs = true } = options;

  // دالة فلترة الوقت
  const applyTimeFilter = useCallback((items, getDate) => {
    if (timePeriod === 'all') return items || [];
    const now = new Date();
    const toDate = (v) => {
      const d = getDate(v);
      return d ? new Date(d) : null;
    };
    switch (timePeriod) {
      case 'today':
        return (items || []).filter(i => {
          const d = toDate(i);
          return d && d.toDateString() === now.toDateString();
        });
      case 'week': {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return (items || []).filter(i => {
          const d = toDate(i);
          return d && d >= weekAgo;
        });
      }
      case 'month': {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return (items || []).filter(i => {
          const d = toDate(i);
          return d && d >= monthAgo;
        });
      }
      case '3months': {
        const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        return (items || []).filter(i => {
          const d = toDate(i);
          return d && d >= threeMonthsAgo;
        });
      }
      default:
        return items || [];
    }
  }, [timePeriod]);

  // دالة تحميل البيانات
  const loadFinancialData = useCallback(async () => {
    if (loading) return;
    
    try {
      setLoading(true);
      setError(null);

      if (enableDebugLogs) {
        console.log('🔧 النظام المالي الموحد: بدء الحسابات...');
      }

      // جلب جميع البيانات بالتوازي
      const [ordersResponse, expensesResponse, cashResponse, inventoryResponse] = await Promise.all([
        supabase
          .from('orders')
          .select(`
            *,
            order_items (
              id,
              quantity,
              unit_price,
              total_price,
              product_variants (cost_price)
            )
          `)
          .in('status', ['completed', 'delivered'])
          .eq('receipt_received', true),
        
        supabase
          .from('expenses')
          .select('*')
          .eq('status', 'approved'),
        
        supabase
          .from('cash_sources')
          .select('current_balance')
          .eq('name', 'القاصة الرئيسية')
          .single(),
        
        supabase
          .from('inventory')
          .select(`
            quantity,
            product_variants (cost_price)
          `)
      ]);

      // فحص الأخطاء
      if (ordersResponse.error) throw ordersResponse.error;
      if (expensesResponse.error) throw expensesResponse.error;
      if (cashResponse.error && cashResponse.error.code !== 'PGRST116') throw cashResponse.error;
      if (inventoryResponse.error) throw inventoryResponse.error;

      // تطبيق فلتر الوقت
      const filteredOrders = applyTimeFilter(
        ordersResponse.data, 
        (o) => o.created_at || o.delivered_at || o.updated_at
      );
      
      const filteredExpenses = applyTimeFilter(
        expensesResponse.data, 
        (e) => e.created_at || e.transaction_date || e.date || e.expense_date
      );

      // حساب المؤشرات المالية
      const totalRevenue = filteredOrders.reduce((sum, order) => {
        return sum + (order.final_amount || order.total_amount || 0);
      }, 0);

      const deliveryFees = filteredOrders.reduce((sum, order) => {
        return sum + (order.delivery_fee || 0);
      }, 0);

      const salesWithoutDelivery = totalRevenue - deliveryFees;

      const cogs = filteredOrders.reduce((orderSum, order) => {
        if (!order.order_items || !Array.isArray(order.order_items)) return orderSum;
        
        return orderSum + order.order_items.reduce((itemSum, item) => {
          const costPrice = item.product_variants?.cost_price || 0;
          const quantity = item.quantity || 0;
          return itemSum + (costPrice * quantity);
        }, 0);
      }, 0);

      const grossProfit = salesWithoutDelivery - cogs;

      const generalExpenses = filteredExpenses.filter(expense => {
        const isEmployeeDue = (
          expense.category === 'مستحقات الموظفين' ||
          expense.related_data?.category === 'مستحقات الموظفين' ||
          expense.metadata?.category === 'مستحقات الموظفين'
        );
        const isSystem = expense.expense_type === 'system';
        const isPurchaseRelated = (
          expense.related_data?.category === 'شراء بضاعة' ||
          expense.metadata?.category === 'شراء بضاعة'
        );
        return !isSystem && !isEmployeeDue && !isPurchaseRelated;
      }).reduce((sum, expense) => sum + (expense.amount || 0), 0);

      const employeeDuesPaid = filteredExpenses.filter(expense => {
        const isEmployeeDue = (
          expense.category === 'مستحقات الموظفين' ||
          expense.related_data?.category === 'مستحقات الموظفين' ||
          expense.metadata?.category === 'مستحقات الموظفين'
        );
        return isEmployeeDue;
      }).reduce((sum, expense) => sum + (expense.amount || 0), 0);

      const netProfit = grossProfit - generalExpenses;
      const cashSurplus = totalRevenue - employeeDuesPaid;
      const cashBalance = cashResponse.data?.current_balance || 0;
      
      const inventoryTotalValue = inventoryResponse.data?.reduce((sum, item) => {
        const value = (item.quantity || 0) * (item.product_variants?.cost_price || 0);
        return sum + value;
      }, 0) || 0;
      
      const totalCapital = cashBalance + inventoryTotalValue;

      // النتائج النهائية
      const result = {
        totalRevenue,
        deliveryFees,
        salesWithoutDelivery,
        cogs,
        grossProfit,
        generalExpenses,
        employeeDuesPaid,
        netProfit,
        totalCapital,
        cashBalance,
        inventoryValue: inventoryTotalValue,
        cashSurplus,
        ordersCount: filteredOrders.length,
        avgOrderValue: filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0,
        profitMargin: salesWithoutDelivery > 0 ? ((netProfit / salesWithoutDelivery) * 100) : 0,
        lastCalculated: new Date(),
        timePeriod,
        dataSource: 'unified_system'
      };

      if (enableDebugLogs) {
        console.log('💰 النظام المالي الموحد - النتائج النهائية:', result);
      }

      setFinancialData(result);
      return result;

    } catch (error) {
      console.error('❌ خطأ في النظام المالي الموحد:', error);
      setError(error.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [timePeriod, enableDebugLogs, applyTimeFilter, loading]);

  // تحميل البيانات عند تغيير المعطيات
  useEffect(() => {
    if (!inventoryLoading) {
      loadFinancialData();
    }
  }, [loadFinancialData, inventoryLoading]);

  // دالة إعادة التحميل
  const refreshData = useCallback(() => {
    return loadFinancialData();
  }, [loadFinancialData]);

  // دوال التنسيق
  const formatCurrency = useCallback((amount) => {
    return new Intl.NumberFormat('ar-IQ', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0) + ' د.ع';
  }, []);

  const formatPercentage = useCallback((percentage) => {
    return `${(percentage || 0).toFixed(1)}%`;
  }, []);

  return {
    // البيانات الرئيسية
    ...financialData,
    
    // حالة النظام
    loading: loading || inventoryLoading,
    error,
    
    // دوال التحكم
    refreshData,
    
    // دوال التنسيق
    formatCurrency,
    formatPercentage,
    
    // معلومات النظام
    isDataValid: !error && !loading && financialData !== null,
    lastUpdate: financialData?.lastCalculated
  };
};

export default useUnifiedFinancialSystem;