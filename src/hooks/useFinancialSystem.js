/**
 * النظام المالي الرئيسي الموحد
 * Hook شامل لجميع العمليات والحسابات المالية
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
// ثوابت النظام المالي الداخلية
const TIME_PERIODS = {
  TODAY: 'today',
  WEEK: 'week', 
  MONTH: 'month',
  YEAR: 'year',
  ALL: 'all'
};

export const useFinancialSystem = (timePeriod = TIME_PERIODS.ALL, options = {}) => {
  const { orders, accounting, loading: inventoryLoading } = useInventory();
  const { user } = useAuth();
  const { canViewAllData, hasPermission } = usePermissions();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastCalculationTime, setLastCalculationTime] = useState(null);
  
  // الإعدادات
  const {
    enableCache = true,
    enableDebugLogs = true,
    forceRefresh = false
  } = options;
  
  // حالة إضافية للبيانات المالية الموحدة
  const [capitalAmount, setCapitalAmount] = useState(0);
  const [totalPurchases, setTotalPurchases] = useState(0);
  const [currentBalance, setCurrentBalance] = useState(0);
  
  // فلترة البيانات حسب الصلاحيات - بدون دوال خارجية
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    if (canViewAllData) return orders;
    return orders.filter(order => order.created_by === (user?.id || user?.user_id));
  }, [orders, canViewAllData, user?.id, user?.user_id]);
  
  const filteredExpenses = useMemo(() => {
    if (!accounting?.expenses) return [];
    if (canViewAllData) return accounting.expenses;
    return accounting.expenses.filter(expense => expense.created_by === (user?.id || user?.user_id));
  }, [accounting?.expenses, canViewAllData, user?.id, user?.user_id]);
  
  // حساب المؤشرات المالية
  const financialMetrics = useMemo(() => {
    if (inventoryLoading) {
      if (enableDebugLogs) {
        console.log('⏳ النظام المالي: في انتظار تحميل البيانات...');
      }
      return { totalRevenue: 0, netProfit: 0, generalExpenses: 0, loading: true };
    }
    
    if (!filteredOrders.length && !filteredExpenses.length) {
      if (enableDebugLogs) {
        console.log('⚠️ النظام المالي: لا توجد بيانات للحساب');
      }
      return { 
        totalRevenue: 0, 
        netProfit: 0, 
        generalExpenses: 0,
        error: 'لا توجد بيانات للحساب',
        loading: false 
      };
    }
    
    try {
      if (enableDebugLogs) {
        console.log('🔧 النظام المالي: بدء الحسابات...', {
          ordersCount: filteredOrders.length,
          expensesCount: filteredExpenses.length,
          timePeriod,
          userCanViewAll: canViewAllData
        });
      }
      
      // حساب مبسط للمقاييس المالية
      const completedOrders = filteredOrders.filter(o => ['completed', 'delivered'].includes(o.status));
      const totalRevenue = completedOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
      const approvedExpenses = filteredExpenses.filter(e => e.status === 'approved');
      const generalExpenses = approvedExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      const netProfit = totalRevenue - generalExpenses;
      
      const metrics = {
        totalRevenue,
        netProfit,
        generalExpenses,
        employeeDuesPaid: 0,
        ordersCount: completedOrders.length,
        avgOrderValue: completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0
      };
      
      if (enableDebugLogs) {
        console.log('✅ النظام المالي: اكتملت الحسابات بنجاح', metrics);
      }
      
      setLastCalculationTime(new Date());
      setError(null);
      
      return { ...metrics, loading: false };
      
    } catch (err) {
      console.error('❌ النظام المالي: خطأ في الحسابات:', err);
      setError(err.message);
      
      return { 
        totalRevenue: 0, 
        netProfit: 0, 
        generalExpenses: 0,
        error: err.message,
        loading: false 
      };
    }
  }, [filteredOrders, filteredExpenses, timePeriod, inventoryLoading, canViewAllData, enableDebugLogs]);
  
  // جلب البيانات المالية الإضافية
  useEffect(() => {
    const fetchAdditionalFinancialData = async () => {
      try {
        // رأس المال من القاصة الرئيسية
        const { data: cashData } = await supabase
          .from('cash_sources')
          .select('current_balance')
          .eq('name', 'القاصة الرئيسية')
          .single();
        
        // إجمالي المشتريات
        const { data: purchasesData } = await supabase
          .from('purchases')
          .select('total_amount')
          .eq('status', 'approved');
        
        const totalPurchasesSum = purchasesData?.reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0) || 0;
        
        setCapitalAmount(cashData?.current_balance || 0);
        setTotalPurchases(totalPurchasesSum);
        setCurrentBalance(cashData?.current_balance || 0);
        
        if (enableDebugLogs) {
          console.log('💰 البيانات المالية الإضافية:', {
            capitalAmount: cashData?.current_balance || 0,
            totalPurchases: totalPurchasesSum,
            currentBalance: cashData?.current_balance || 0
          });
        }
      } catch (error) {
        console.error('❌ خطأ في جلب البيانات المالية الإضافية:', error);
      }
    };
    
    fetchAdditionalFinancialData();
  }, [timePeriod, enableDebugLogs]);

  // تحديث حالة التحميل
  useEffect(() => {
    setLoading(inventoryLoading || financialMetrics.loading);
  }, [inventoryLoading, financialMetrics.loading]);
  
  // دالة إعادة التحميل
  const refreshData = useCallback(() => {
    if (enableDebugLogs) {
      console.log('🔄 النظام المالي: إعادة تحميل البيانات...');
    }
    setError(null);
    setLastCalculationTime(new Date());
  }, [enableDebugLogs]);
  
  // دالة تغيير الفترة الزمنية
  const changePeriod = useCallback((newPeriod) => {
    if (enableDebugLogs) {
      console.log('📅 النظام المالي: تغيير الفترة الزمنية:', { from: timePeriod, to: newPeriod });
    }
  }, [timePeriod, enableDebugLogs]);
  
  // معلومات إضافية
  const systemInfo = useMemo(() => ({
    lastCalculationTime,
    dateRange: timePeriod,
    dataSource: {
      ordersCount: filteredOrders.length,
      expensesCount: filteredExpenses.length,
      hasFullAccess: canViewAllData
    },
    permissions: {
      canViewAllData,
      canManageFinances: hasPermission('manage_finances'),
      canViewReports: hasPermission('view_reports')
    }
  }), [lastCalculationTime, timePeriod, filteredOrders.length, filteredExpenses.length, canViewAllData, hasPermission]);
  
  return {
    // البيانات المالية الرئيسية
    ...financialMetrics,
    
    // البيانات المالية الإضافية
    capitalAmount,
    totalPurchases,
    currentBalance,
    
    // حالة النظام
    loading,
    error,
    
    // البيانات المفلترة
    filteredOrders,
    filteredExpenses,
    
    // معلومات النظام
    systemInfo,
    
    // دوال التحكم
    refreshData,
    changePeriod,
    
    // دوال مساعدة للمكونات
    formatCurrency: (amount) => {
      return new Intl.NumberFormat('ar-IQ', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount || 0) + ' د.ع';
    },
    
    formatPercentage: (percentage) => {
      return `${(percentage || 0).toFixed(1)}%`;
    },
    
    // التحقق من صحة البيانات
    isDataValid: !error && !loading && (filteredOrders.length > 0 || filteredExpenses.length > 0),
    
    // إحصائيات سريعة
    quickStats: {
      hasRevenue: financialMetrics.totalRevenue > 0,
      hasProfits: financialMetrics.netProfit > 0,
      hasExpenses: financialMetrics.generalExpenses > 0 || financialMetrics.employeeDuesPaid > 0,
      profitabilityStatus: financialMetrics.netProfit > 0 ? 'profitable' : 
                          financialMetrics.netProfit < 0 ? 'loss' : 'breakeven'
    }
  };
};

export default useFinancialSystem;