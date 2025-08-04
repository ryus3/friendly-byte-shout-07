/**
 * 🎯 النظام المالي الموحد الرئيسي
 * Hook واحد موحد لجميع العمليات المالية في التطبيق
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchAllFinancialData, calculateUnifiedMetrics, formatCurrency, formatPercentage } from '@/lib/unified-financial-core';
import { calculateDateRange, TIME_PERIODS } from '@/lib/unified-financial-filters';
import { usePermissions } from '@/hooks/usePermissions';

export const useUnifiedFinancialSystem = (initialTimePeriod = TIME_PERIODS.ALL) => {
  // الحالة الأساسية
  const [rawData, setRawData] = useState(null);
  const [timePeriod, setTimePeriod] = useState(initialTimePeriod);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // الصلاحيات
  const { canViewAllData, user } = usePermissions();

  // حساب نطاق التاريخ المحدد
  const dateRange = useMemo(() => {
    return calculateDateRange(timePeriod);
  }, [timePeriod]);

  // حساب المؤشرات المالية الموحدة
  const financialMetrics = useMemo(() => {
    if (!rawData) {
      return {
        totalRevenue: 0,
        deliveryFees: 0,
        salesWithoutDelivery: 0,
        cogs: 0,
        grossProfit: 0,
        systemProfit: 0,
        netProfit: 0,
        generalExpenses: 0,
        employeeDuesPaid: 0,
        employeeDuesPending: 0,
        capitalAmount: 0,
        totalCashBalance: 0,
        totalPurchases: 0,
        grossProfitMargin: 0,
        netProfitMargin: 0,
        ordersCount: 0,
        expensesCount: 0,
        isFiltered: false,
        lastCalculated: null,
        dataSource: 'unified_system'
      };
    }

    try {
      const metrics = calculateUnifiedMetrics(rawData, dateRange);
      
      console.log('🔥 النظام المالي الموحد - المؤشرات المحسوبة:', {
        period: timePeriod,
        dateRange: dateRange.label,
        netProfit: metrics.netProfit,
        totalRevenue: metrics.totalRevenue,
        ordersCount: metrics.ordersCount
      });
      
      return metrics;
    } catch (err) {
      console.error('❌ خطأ في حساب المؤشرات المالية:', err);
      setError(err.message);
      return {};
    }
  }, [rawData, dateRange, timePeriod]);

  // جلب البيانات من قاعدة البيانات
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 النظام المالي الموحد - جاري جلب البيانات...');
      
      const data = await fetchAllFinancialData();
      setRawData(data);
      setLastUpdated(new Date());
      
      console.log('✅ النظام المالي الموحد - تم جلب البيانات بنجاح');
      
    } catch (err) {
      console.error('❌ النظام المالي الموحد - خطأ في جلب البيانات:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // تحديث الفترة الزمنية
  const updateTimePeriod = useCallback((newPeriod) => {
    console.log('📅 النظام المالي الموحد - تحديث الفترة الزمنية:', newPeriod);
    setTimePeriod(newPeriod);
  }, []);

  // إعادة تحميل البيانات
  const refreshData = useCallback(() => {
    console.log('🔄 النظام المالي الموحد - إعادة تحميل البيانات...');
    fetchData();
  }, [fetchData]);

  // جلب البيانات عند بداية التشغيل
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // معلومات النظام
  const systemInfo = useMemo(() => ({
    isUnifiedSystem: true,
    lastUpdated,
    dateRange,
    timePeriod,
    dataSource: 'unified_financial_system',
    hasData: !!rawData,
    permissions: {
      canViewAllData,
      userId: user?.id || user?.user_id
    }
  }), [lastUpdated, dateRange, timePeriod, rawData, canViewAllData, user]);

  // إحصائيات سريعة
  const quickStats = useMemo(() => ({
    hasRevenue: financialMetrics.totalRevenue > 0,
    hasProfits: financialMetrics.netProfit > 0,
    hasExpenses: financialMetrics.generalExpenses > 0 || financialMetrics.employeeDuesPaid > 0,
    profitabilityStatus: financialMetrics.netProfit > 0 ? 'profitable' : 
                        financialMetrics.netProfit < 0 ? 'loss' : 'breakeven',
    ordersProcessed: financialMetrics.ordersCount || 0,
    totalTransactions: (financialMetrics.ordersCount || 0) + (financialMetrics.expensesCount || 0)
  }), [financialMetrics]);

  return {
    // البيانات المالية المحسوبة
    ...financialMetrics,
    
    // حالة النظام
    loading,
    error,
    
    // الفترة الزمنية والفلاتر
    timePeriod,
    dateRange,
    updateTimePeriod,
    
    // دوال التحكم
    refreshData,
    
    // معلومات النظام
    systemInfo,
    quickStats,
    
    // دوال مساعدة
    formatCurrency,
    formatPercentage,
    
    // التحقق من صحة البيانات
    isDataValid: !error && !loading && !!rawData,
    
    // البيانات الخام (للتطوير فقط)
    rawData: rawData
  };
};