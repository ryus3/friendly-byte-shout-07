/**
 * 🏦 السياق المالي الموحد الجديد
 * يحل محل جميع الأنظمة المالية القديمة
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useUnifiedFinancialSystem } from '@/hooks/useUnifiedFinancialSystem';
import { TIME_PERIODS } from '@/lib/unified-financial-filters';

const UnifiedFinancialContext = createContext(null);

export const useUnifiedFinancialContext = () => {
  const context = useContext(UnifiedFinancialContext);
  if (!context) {
    throw new Error('useUnifiedFinancialContext must be used within a UnifiedFinancialProvider');
  }
  return context;
};

export const UnifiedFinancialProvider = ({ children }) => {
  // إدارة الفترات الزمنية لكل صفحة
  const [periods, setPeriods] = useState(() => {
    const saved = localStorage.getItem('unified-financial-periods');
    return saved ? JSON.parse(saved) : {
      dashboard: TIME_PERIODS.ALL,
      accounting: TIME_PERIODS.ALL,
      profits: TIME_PERIODS.ALL,
      analytics: TIME_PERIODS.MONTH
    };
  });

  // حفظ الفترات في localStorage
  useEffect(() => {
    localStorage.setItem('unified-financial-periods', JSON.stringify(periods));
  }, [periods]);

  // النظام المالي للوحة التحكم
  const dashboardFinancials = useUnifiedFinancialSystem(periods.dashboard);
  
  // النظام المالي للمركز المالي (المحاسبة)
  const accountingFinancials = useUnifiedFinancialSystem(periods.accounting);
  
  // النظام المالي لإدارة الأرباح
  const profitsFinancials = useUnifiedFinancialSystem(periods.profits);
  
  // النظام المالي للتحليلات
  const analyticsFinancials = useUnifiedFinancialSystem(periods.analytics);

  // دالة تحديث الفترة الزمنية لصفحة معينة
  const updatePeriod = useCallback((page, newPeriod) => {
    console.log(`📅 تحديث فترة ${page} إلى ${newPeriod}`);
    setPeriods(prev => ({
      ...prev,
      [page]: newPeriod
    }));
    
    // تحديث الفترة في النظام المناسب
    switch (page) {
      case 'dashboard':
        dashboardFinancials.updateTimePeriod(newPeriod);
        break;
      case 'accounting':
        accountingFinancials.updateTimePeriod(newPeriod);
        break;
      case 'profits':
        profitsFinancials.updateTimePeriod(newPeriod);
        break;
      case 'analytics':
        analyticsFinancials.updateTimePeriod(newPeriod);
        break;
    }
  }, [dashboardFinancials, accountingFinancials, profitsFinancials, analyticsFinancials]);

  // دالة إعادة تحميل البيانات لجميع الأنظمة
  const refreshAllData = useCallback(() => {
    console.log('🔄 إعادة تحميل جميع البيانات المالية الموحدة...');
    dashboardFinancials.refreshData();
    accountingFinancials.refreshData();
    profitsFinancials.refreshData();
    analyticsFinancials.refreshData();
  }, [dashboardFinancials, accountingFinancials, profitsFinancials, analyticsFinancials]);

  // معلومات حالة النظام العامة
  const systemStatus = {
    isLoading: dashboardFinancials.loading || accountingFinancials.loading || 
               profitsFinancials.loading || analyticsFinancials.loading,
    hasErrors: !!(dashboardFinancials.error || accountingFinancials.error || 
                  profitsFinancials.error || analyticsFinancials.error),
    lastUpdate: Math.max(
      dashboardFinancials.systemInfo?.lastUpdated?.getTime() || 0,
      accountingFinancials.systemInfo?.lastUpdated?.getTime() || 0,
      profitsFinancials.systemInfo?.lastUpdated?.getTime() || 0,
      analyticsFinancials.systemInfo?.lastUpdated?.getTime() || 0
    ),
    dataSource: 'unified_financial_system',
    version: '2.0'
  };

  // دالة للحصول على البيانات المالية لصفحة معينة
  const getFinancialData = useCallback((page) => {
    switch (page) {
      case 'dashboard':
        return dashboardFinancials;
      case 'accounting':
        return accountingFinancials;
      case 'profits':
        return profitsFinancials;
      case 'analytics':
        return analyticsFinancials;
      default:
        console.warn(`⚠️ صفحة غير معروفة: ${page}`);
        return dashboardFinancials; // افتراضي
    }
  }, [dashboardFinancials, accountingFinancials, profitsFinancials, analyticsFinancials]);

  // إحصائيات مجمعة من البيانات الأساسية (بدون فلتر زمني)
  const aggregatedStats = {
    totalRevenue: accountingFinancials.totalRevenue || 0,
    netProfit: accountingFinancials.netProfit || 0,
    systemProfit: accountingFinancials.systemProfit || 0,
    grossProfitMargin: accountingFinancials.grossProfitMargin || 0,
    netProfitMargin: accountingFinancials.netProfitMargin || 0,
    totalCashBalance: accountingFinancials.totalCashBalance || 0,
    capitalAmount: accountingFinancials.capitalAmount || 0,
    isProfitable: (accountingFinancials.netProfit || 0) > 0,
    isSystemHealthy: (accountingFinancials.totalCashBalance || 0) > 0
  };

  // مقارنة البيانات بين الفترات (للتحليلات المتقدمة)
  const periodComparison = {
    dashboard: dashboardFinancials.quickStats,
    accounting: accountingFinancials.quickStats,
    profits: profitsFinancials.quickStats,
    analytics: analyticsFinancials.quickStats
  };

  const value = {
    // البيانات المالية المخصصة لكل صفحة
    dashboard: dashboardFinancials,
    accounting: accountingFinancials,
    profits: profitsFinancials,
    analytics: analyticsFinancials,
    
    // إدارة الفترات الزمنية
    periods,
    updatePeriod,
    
    // دوال التحكم
    refreshAllData,
    getFinancialData,
    
    // معلومات النظام
    systemStatus,
    aggregatedStats,
    periodComparison,
    
    // دوال مساعدة مشتركة
    formatCurrency: dashboardFinancials.formatCurrency,
    formatPercentage: dashboardFinancials.formatPercentage,
    
    // ثوابت مفيدة
    TIME_PERIODS,
    
    // معلومات النظام الموحد
    isUnifiedSystem: true,
    systemVersion: '2.0',
    systemType: 'unified_financial_system'
  };

  return (
    <UnifiedFinancialContext.Provider value={value}>
      {children}
    </UnifiedFinancialContext.Provider>
  );
};

export default UnifiedFinancialContext;