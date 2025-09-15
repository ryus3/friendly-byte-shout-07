/**
 * النظام المالي الرئيسي النهائي - استبدال كامل للنظام القديم
 * يضمن عدم وجود temporal dead zone أو conflicting dependencies
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';

// دالة مساعدة لفلترة البيانات حسب الوقت
const filterByTimePeriod = (items, timePeriod, getDate) => {
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
};

export const useFinancialSystem = (timePeriod = 'all', options = {}) => {
  const { loading: inventoryLoading } = useInventory();
  const { user } = useAuth();
  const { canViewAllData } = usePermissions();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [financialData, setFinancialData] = useState(null);
  
  const { enableDebugLogs = true } = options;

  // دالة جلب البيانات المالية - مبسطة بدون useCallback لتجنب التداخل
  const fetchFinancialData = async () => {
    if (loading && financialData) return; // منع التداخل
    
    try {
      setLoading(true);
      setError(null);

      if (enableDebugLogs) {
        console.log('🔧 النظام المالي: بدء تحميل البيانات...');
      }

      // جلب البيانات بالتوازي
      const [ordersRes, expensesRes, cashRes, inventoryRes] = await Promise.all([
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

      if (ordersRes.error) throw ordersRes.error;
      if (expensesRes.error) throw expensesRes.error;
      if (cashRes.error && cashRes.error.code !== 'PGRST116') throw cashRes.error;
      if (inventoryRes.error) throw inventoryRes.error;

      // فلترة البيانات
      const filteredOrders = filterByTimePeriod(
        ordersRes.data, 
        timePeriod, 
        (o) => o.created_at || o.delivered_at || o.updated_at
      );
      
      const filteredExpenses = filterByTimePeriod(
        expensesRes.data, 
        timePeriod, 
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
      const cashBalance = cashRes.data?.current_balance || 0;
      
      const inventoryTotalValue = inventoryRes.data?.reduce((sum, item) => {
        const value = (item.quantity || 0) * (item.product_variants?.cost_price || 0);
        return sum + value;
      }, 0) || 0;
      
      const totalCapital = cashBalance + inventoryTotalValue;

      const result = {
        // الإيرادات
        totalRevenue,
        deliveryFees,
        salesWithoutDelivery,
        
        // التكاليف والأرباح
        cogs,
        grossProfit,
        generalExpenses,
        employeeDuesPaid,
        netProfit,
        
        // رأس المال
        totalCapital,
        cashBalance,
        inventoryValue: inventoryTotalValue,
        cashSurplus,
        
        // إحصائيات
        ordersCount: filteredOrders.length,
        avgOrderValue: filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0,
        profitMargin: salesWithoutDelivery > 0 ? ((netProfit / salesWithoutDelivery) * 100) : 0,
        
        // نظام
        lastCalculated: new Date(),
        timePeriod,
        dataSource: 'unified_financial_system',
        
        // للتوافق مع النظام القديم
        capitalAmount: totalCapital,
        totalPurchases: 0,
        currentBalance: cashBalance,
        loading: false,
        error: null,
        isDataValid: true
      };

      if (enableDebugLogs) {
        console.log('✅ النظام المالي: تم تحميل البيانات بنجاح', result);
      }

      setFinancialData(result);
      setLoading(false);
      setError(null);
      
      return result;

    } catch (error) {
      console.error('❌ خطأ في النظام المالي:', error);
      setError(error.message);
      setLoading(false);
      return null;
    }
  };

  // تحميل البيانات عند التهيئة - مبسط
  useEffect(() => {
    if (!inventoryLoading) {
      fetchFinancialData();
    }
  }, [inventoryLoading, timePeriod]);  // فقط التبعيات الأساسية

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

  // دالة إعادة التحميل - مبسطة
  const refreshData = () => {
    return fetchFinancialData();
  };

  // إرجاع البيانات
  return {
    // البيانات الأساسية
    ...financialData,
    
    // حالة النظام
    loading: loading || inventoryLoading,
    error,
    
    // دوال التحكم
    refreshData,
    changePeriod: () => {}, // للتوافق مع النظام القديم
    
    // دوال التنسيق
    formatCurrency,
    formatPercentage,
    
    // معلومات النظام
    isDataValid: !error && !loading && financialData !== null,
    lastUpdate: financialData?.lastCalculated,
    
    // للتوافق مع النظام القديم
    filteredOrders: [],
    filteredExpenses: [],
    systemInfo: {
      lastCalculationTime: financialData?.lastCalculated,
      dataSource: {
        ordersCount: financialData?.ordersCount || 0,
        expensesCount: 0,
        hasFullAccess: canViewAllData
      }
    },
    quickStats: {
      hasRevenue: (financialData?.totalRevenue || 0) > 0,
      hasProfits: (financialData?.netProfit || 0) > 0,
      hasExpenses: (financialData?.generalExpenses || 0) > 0,
      profitabilityStatus: (financialData?.netProfit || 0) > 0 ? 'profitable' : 
                          (financialData?.netProfit || 0) < 0 ? 'loss' : 'breakeven'
    }
  };
};

export default useFinancialSystem;