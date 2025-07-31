// Hook مشترك لحساب أرباح المدير من الموظفين - النظام الصحيح المعتمد
import { useMemo } from 'react';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { startOfMonth, endOfMonth } from 'date-fns';

export const useManagerProfitsFromEmployees = (
  orders = [], 
  employees = [], 
  profits = [],
  selectedPeriod = 'month',
  selectedEmployee = 'all'
) => {
  const { currentUser } = useAuth();

  // فلترة البيانات حسب الفترة
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (selectedPeriod) {
      case 'today':
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
        return { start: startOfDay, end: endOfDay };
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        return { start: weekStart, end: weekEnd };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'year':
        return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear(), 11, 31) };
      case 'all':
        return null;
      default:
        return null;
    }
  }, [selectedPeriod]);

  // حساب الأرباح المفصلة - فقط للطلبات التي أنشأها الموظفون
  const detailedProfits = useMemo(() => {
    console.log('🚀 Hook: بدء معالجة أرباح المدير من الموظفين:', {
      profitsCount: profits?.length || 0,
      employeesCount: employees?.length || 0,
      selectedPeriod,
      selectedEmployee,
      dateRange
    });

    if (!profits || !Array.isArray(profits) || profits.length === 0) {
      console.log('❌ Hook: لا توجد أرباح في جدول profits');
      return [];
    }

    // فلترة طلبات الموظفين فقط (تجاهل طلبات المدير)
    const employeeOrdersOnly = profits.filter(profit => {
      const relatedOrder = orders?.find(order => order.id === profit.order_id);
      if (!relatedOrder) return false;
      
      const isManagerOrder = relatedOrder.created_by === currentUser?.id;
      if (isManagerOrder) {
        console.log(`🚫 Hook: تجاهل طلب المدير: ${relatedOrder.order_number}`);
        return false;
      }
      
      return true;
    });

    const processed = employeeOrdersOnly
      .filter(profit => {
        if (!profit || !profit.id) return false;
        
        // فلترة التاريخ
        let withinPeriod = true;
        if (dateRange && profit.created_at) {
          const profitDate = new Date(profit.created_at);
          if (!isNaN(profitDate.getTime())) {
            withinPeriod = profitDate >= dateRange.start && profitDate <= dateRange.end;
          }
        }
        
        // فلترة الموظف
        const matchesEmployee = selectedEmployee === 'all' || profit.employee_id === selectedEmployee;
        
        return withinPeriod && matchesEmployee;
      })
      .map(profit => {
        try {
          const totalProfit = Number(profit.profit_amount || 0);
          const employeeProfit = Number(profit.employee_profit || 0);
          const systemProfit = totalProfit - employeeProfit;
          const totalRevenue = Number(profit.total_revenue || 0);
          const totalCost = Number(profit.total_cost || 0);
          
          const employee = employees.find(emp => emp.user_id === profit.employee_id);
          const relatedOrder = orders?.find(order => order.id === profit.order_id);
          
          return {
            id: profit.id,
            order_id: profit.order_id,
            order_number: relatedOrder?.order_number || `ORD-${profit.order_id?.slice(-6)}`,
            created_at: profit.created_at,
            employee,
            employee_id: profit.employee_id,
            orderTotal: totalRevenue,
            totalCost: totalCost,
            managerProfit: Math.round(systemProfit),
            employeeProfit: Math.round(employeeProfit),
            totalProfit: Math.round(totalProfit),
            systemProfit: Math.round(systemProfit),
            profitPercentage: totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0',
            isPaid: profit.status === 'settled' || profit.settled_at,
            settledAt: profit.settled_at,
            status: profit.status,
            customer_name: relatedOrder?.customer_name || 'غير محدد',
            delivery_fee: relatedOrder?.delivery_fee || 0
          };
        } catch (error) {
          console.error('❌ Hook: خطأ في معالجة الربح:', profit.id, error);
          return null;
        }
      })
      .filter(profit => profit !== null)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    console.log('✅ Hook: الأرباح المعالجة النهائية:', {
      processedCount: processed.length,
      totalManagerProfit: processed.reduce((sum, profit) => sum + profit.managerProfit, 0),
      totalEmployeeProfit: processed.reduce((sum, profit) => sum + profit.employeeProfit, 0)
    });

    return processed;
  }, [profits, employees, orders, dateRange, selectedEmployee, currentUser?.id]);

  // إحصائيات شاملة
  const stats = useMemo(() => {
    console.log('📊 Hook: حساب الإحصائيات من detailedProfits:', {
      detailedProfitsCount: detailedProfits?.length || 0,
      selectedPeriod
    });

    const defaultStats = {
      totalManagerProfit: 0,
      totalEmployeeProfit: 0,
      totalRevenue: 0,
      pendingProfit: 0,
      settledProfit: 0,
      settledEmployeeDues: 0,
      totalOrders: 0,
      averageOrderValue: 0,
      profitMargin: '0.0',
      topEmployees: []
    };

    if (!detailedProfits || !Array.isArray(detailedProfits) || detailedProfits.length === 0) {
      return defaultStats;
    }

    try {
      const totalManagerProfit = detailedProfits.reduce((sum, profit) => sum + (Number(profit.managerProfit) || 0), 0);
      const totalEmployeeProfit = detailedProfits.reduce((sum, profit) => sum + (Number(profit.employeeProfit) || 0), 0);
      const totalRevenue = detailedProfits.reduce((sum, profit) => sum + (Number(profit.orderTotal) || 0), 0);
      const pendingProfit = detailedProfits.filter(p => p.status === 'pending').reduce((sum, profit) => sum + (Number(profit.managerProfit) || 0), 0);
      const settledProfit = detailedProfits.filter(p => p.status === 'settled').reduce((sum, profit) => sum + (Number(profit.managerProfit) || 0), 0);
      const settledEmployeeDues = detailedProfits.filter(p => p.status === 'settled').reduce((sum, profit) => sum + (Number(profit.employeeProfit) || 0), 0);
      const totalOrders = detailedProfits.length;
      const averageOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders) : 0;
      const profitMargin = totalRevenue > 0 ? ((totalManagerProfit / totalRevenue) * 100).toFixed(1) : '0.0';

      // حساب أفضل الموظفين
      const employeeStats = {};
      detailedProfits.forEach(profit => {
        const empId = profit.employee_id;
        if (!employeeStats[empId]) {
          employeeStats[empId] = {
            employee: profit.employee,
            orders: 0,
            revenue: 0,
            managerProfit: 0,
            employeeProfit: 0
          };
        }
        employeeStats[empId].orders += 1;
        employeeStats[empId].revenue += Number(profit.orderTotal) || 0;
        employeeStats[empId].managerProfit += Number(profit.managerProfit) || 0;
        employeeStats[empId].employeeProfit += Number(profit.employeeProfit) || 0;
      });

      const topEmployees = Object.values(employeeStats)
        .sort((a, b) => (b.managerProfit || 0) - (a.managerProfit || 0))
        .slice(0, 5);

      const calculatedStats = {
        totalManagerProfit,
        totalEmployeeProfit,
        totalRevenue,
        pendingProfit,
        settledProfit,
        settledEmployeeDues,
        totalOrders,
        averageOrderValue,
        profitMargin,
        topEmployees
      };

      console.log('✅ Hook: الإحصائيات المحسوبة:', calculatedStats);
      return calculatedStats;
    } catch (error) {
      console.error('❌ Hook: خطأ في حساب الإحصائيات:', error);
      return defaultStats;
    }
  }, [detailedProfits]);

  return {
    detailedProfits,
    stats,
    dateRange
  };
};

export default useManagerProfitsFromEmployees;