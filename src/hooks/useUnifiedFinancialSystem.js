/**
 * نظام مالي موحد نهائي
 * يضمن عرض الأرقام الصحيحة في جميع أنحاء التطبيق
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';

export const useUnifiedFinancialSystem = (timePeriod = 'all', options = {}) => {
  const { orders, accounting, loading: inventoryLoading } = useInventory();
  const { user } = useAuth();
  const { canViewAllData } = usePermissions();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [financialData, setFinancialData] = useState(null);
  
  // إعدادات النظام
  const {
    enableDebugLogs = true,
    forceRefresh = false
  } = options;

  // حساب البيانات المالية الموحدة
  const calculateUnifiedFinancials = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (enableDebugLogs) {
        console.log('🔧 النظام المالي الموحد: بدء الحسابات...');
      }

      // جلب الطلبات المكتملة والمستلمة مع تفاصيل العناصر
      const { data: completedOrders, error: ordersError } = await supabase
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
        .eq('receipt_received', true);

      if (ordersError) throw ordersError;

      // جلب المصاريف المعتمدة
      const { data: approvedExpenses, error: expensesError } = await supabase
        .from('expenses')
        .select('*')
        .eq('status', 'approved');

      if (expensesError) throw expensesError;

      // جلب رصيد القاصة الرئيسية
      const { data: mainCash, error: cashError } = await supabase
        .from('cash_sources')
        .select('current_balance')
        .eq('name', 'القاصة الرئيسية')
        .single();

      if (cashError && cashError.code !== 'PGRST116') throw cashError;

      // جلب قيمة المخزون
      const { data: inventoryValue, error: inventoryError } = await supabase
        .from('inventory')
        .select(`
          quantity,
          product_variants (cost_price)
        `);

      if (inventoryError) throw inventoryError;

      // القوائم الأساسية قبل الفلترة الزمنية
      const allOrders = completedOrders || [];
      const allExpenses = approvedExpenses || [];

      // فلترة حسب الفترة الزمنية (مع الحفاظ على الافتراضي = الكل)
      const applyTimeFilter = (items, getDate) => {
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

      const safeOrders = applyTimeFilter(allOrders, (o) => o.created_at || o.delivered_at || o.updated_at);
      const safeExpenses = applyTimeFilter(allExpenses, (e) => e.created_at || e.transaction_date || e.date || e.expense_date);

      // 1. إجمالي الإيرادات
      const totalRevenue = safeOrders.reduce((sum, order) => {
        return sum + (order.final_amount || order.total_amount || 0);
      }, 0);

      // 2. رسوم التوصيل
      const deliveryFees = safeOrders.reduce((sum, order) => {
        return sum + (order.delivery_fee || 0);
      }, 0);

      // 3. المبيعات بدون توصيل
      const salesWithoutDelivery = totalRevenue - deliveryFees;

      // 4. تكلفة البضاعة المباعة
      const cogs = safeOrders.reduce((orderSum, order) => {
        if (!order.order_items || !Array.isArray(order.order_items)) return orderSum;
        
        return orderSum + order.order_items.reduce((itemSum, item) => {
          const costPrice = item.product_variants?.cost_price || 0;
          const quantity = item.quantity || 0;
          return itemSum + (costPrice * quantity);
        }, 0);
      }, 0);

      // 5. إجمالي الربح
      const grossProfit = salesWithoutDelivery - cogs;

      // 6. المصاريف العامة (استثناء المستحقات)
      const generalExpenses = safeExpenses.filter(expense => {
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
        if (isSystem) return false;
        if (isEmployeeDue) return false;
        if (isPurchaseRelated) return false;
        if (expense.status && expense.status !== 'approved') return false;
        return true;
      }).reduce((sum, expense) => sum + (expense.amount || 0), 0);

      // 7. المستحقات المدفوعة
      const employeeDuesPaid = safeExpenses.filter(expense => {
        const isEmployeeDue = (
          expense.category === 'مستحقات الموظفين' ||
          expense.related_data?.category === 'مستحقات الموظفين' ||
          expense.metadata?.category === 'مستحقات الموظفين'
        );
        const isApproved = expense.status ? expense.status === 'approved' : true;
        return isApproved && isEmployeeDue;
      }).reduce((sum, expense) => sum + (expense.amount || 0), 0);

      // 8. صافي ربح النظام
      const netProfit = grossProfit - generalExpenses;

      // 9. فائض النقد (إجمالي الإيرادات - المستحقات المدفوعة)
      const cashSurplus = totalRevenue - employeeDuesPaid;

      // 10. رأس المال
      const cashBalance = mainCash?.current_balance || 0;
      const inventoryTotalValue = inventoryValue?.reduce((sum, item) => {
        const value = (item.quantity || 0) * (item.product_variants?.cost_price || 0);
        return sum + value;
      }, 0) || 0;
      const totalCapital = cashBalance + inventoryTotalValue;

      // بيانات موحدة نهائية
      const unifiedData = {
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
        
        // إحصائيات إضافية
        ordersCount: safeOrders.length,
        avgOrderValue: safeOrders.length > 0 ? totalRevenue / safeOrders.length : 0,
        profitMargin: salesWithoutDelivery > 0 ? ((netProfit / salesWithoutDelivery) * 100) : 0,
        
        // معلومات النظام
        lastCalculated: new Date(),
        timePeriod,
        dataSource: 'unified_system'
      };

      if (enableDebugLogs) {
        console.log('💰 النظام المالي الموحد - النتائج النهائية:', unifiedData);
      }

      setFinancialData(unifiedData);
      return unifiedData;

    } catch (error) {
      console.error('❌ خطأ في النظام المالي الموحد:', error);
      setError(error.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [timePeriod, enableDebugLogs, canViewAllData, user?.id]);

  // تشغيل الحسابات عند تحميل البيانات
  useEffect(() => {
    if (!inventoryLoading) {
      calculateUnifiedFinancials();
    }
  }, [calculateUnifiedFinancials, inventoryLoading]);

  // دالة إعادة التحميل
  const refreshData = useCallback(() => {
    return calculateUnifiedFinancials();
  }, [calculateUnifiedFinancials]);

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