/**
 * سياق البيانات المالية الموحد
 * يوفر البيانات المالية لجميع المكونات في التطبيق
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useFinancialSystem } from '@/hooks/useFinancialSystem';
import { TIME_PERIODS } from '@/lib/financial-constants';

const FinancialContext = createContext(null);

export const useFinancialContext = () => {
  const context = useContext(FinancialContext);
  if (!context) {
    throw new Error('useFinancialContext must be used within a FinancialProvider');
  }
  return context;
};

export const FinancialProvider = ({ children }) => {
  // إدارة الفترات الزمنية لكل صفحة
  const [periods, setPeriods] = useState(() => {
    const saved = localStorage.getItem('financial-periods');
    return saved ? JSON.parse(saved) : {
      dashboard: TIME_PERIODS.ALL,
      accounting: TIME_PERIODS.ALL,
      profits: TIME_PERIODS.ALL,
      reports: TIME_PERIODS.MONTH
    };
  });
  
  // حفظ الفترات في localStorage
  useEffect(() => {
    localStorage.setItem('financial-periods', JSON.stringify(periods));
  }, [periods]);
  
  // النظام المالي للوحة التحكم
  const dashboardFinancials = useFinancialSystem(periods.dashboard, {
    enableDebugLogs: true,
    enableCache: true
  });
  
  // النظام المالي للمركز المالي
  const accountingFinancials = useFinancialSystem(periods.accounting, {
    enableDebugLogs: true,
    enableCache: true
  });
  
  // النظام المالي لملخص الأرباح
  const profitsFinancials = useFinancialSystem(periods.profits, {
    enableDebugLogs: true,
    enableCache: true
  });
  
  // دالة تحديث الفترة الزمنية لصفحة معينة
  const updatePeriod = useCallback((page, newPeriod) => {
    console.log(`📅 تحديث فترة ${page} إلى ${newPeriod}`);
    setPeriods(prev => ({
      ...prev,
      [page]: newPeriod
    }));
  }, []);
  
  // دالة إعادة تحميل البيانات لجميع الأنظمة
  const refreshAllData = useCallback(() => {
    console.log('🔄 إعادة تحميل جميع البيانات المالية...');
    dashboardFinancials.refreshData();
    accountingFinancials.refreshData();
    profitsFinancials.refreshData();
  }, [dashboardFinancials, accountingFinancials, profitsFinancials]);
  
  // معلومات النظام العامة
  const systemStatus = {
    isLoading: dashboardFinancials.loading || accountingFinancials.loading || profitsFinancials.loading,
    hasErrors: !!(dashboardFinancials.error || accountingFinancials.error || profitsFinancials.error),
    lastUpdate: Math.max(
      dashboardFinancials.systemInfo?.lastCalculationTime?.getTime() || 0,
      accountingFinancials.systemInfo?.lastCalculationTime?.getTime() || 0,
      profitsFinancials.systemInfo?.lastCalculationTime?.getTime() || 0
    )
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
      default:
        console.warn(`⚠️ صفحة غير معروفة: ${page}`);
        return dashboardFinancials; // افتراضي
    }
  }, [dashboardFinancials, accountingFinancials, profitsFinancials]);
  
  // إحصائيات مجمعة (بناءً على "كل الفترات")
  const aggregatedStats = {
    totalRevenue: accountingFinancials.totalRevenue || 0,
    netProfit: accountingFinancials.netProfit || 0,
    grossProfitMargin: accountingFinancials.grossProfitMargin || 0,
    netProfitMargin: accountingFinancials.netProfitMargin || 0,
    isProfitable: (accountingFinancials.netProfit || 0) > 0
  };
  
  const value = {
    // البيانات المالية المخصصة لكل صفحة
    dashboard: dashboardFinancials,
    accounting: accountingFinancials,
    profits: profitsFinancials,
    
    // إدارة الفترات الزمنية
    periods,
    updatePeriod,
    
    // دوال التحكم
    refreshAllData,
    getFinancialData,
    
    // معلومات النظام
    systemStatus,
    aggregatedStats,
    
    // دوال مساعدة مشتركة
    formatCurrency: dashboardFinancials.formatCurrency,
    formatPercentage: dashboardFinancials.formatPercentage,
    
    // ثوابت مفيدة
    TIME_PERIODS
  };
  
  return (
    <FinancialContext.Provider value={value}>
      {children}
    </FinancialContext.Provider>
  );
};

export default FinancialContext;