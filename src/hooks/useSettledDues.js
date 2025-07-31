import { useState, useEffect, useMemo } from 'react';
import { useInventory } from '@/contexts/InventoryContext';

/**
 * Hook موحد لإدارة المستحقات المدفوعة
 * يجلب البيانات مرة واحدة ويوفرها لجميع المكونات
 */
const useSettledDues = (dateRange = null) => {
  const { accounting } = useInventory();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (accounting?.expenses) {
      setLoading(false);
    }
  }, [accounting]);

  // حساب المستحقات المدفوعة مع الفلترة حسب التاريخ
  const settledDuesData = useMemo(() => {
    if (!accounting?.expenses || !Array.isArray(accounting.expenses)) {
      return {
        total: 0,
        expenses: [],
        byEmployee: {},
        byMonth: {}
      };
    }

    // فلترة المصاريف للمستحقات المدفوعة فقط
    let settledExpenses = accounting.expenses.filter(expense => 
      expense.category === 'مستحقات الموظفين' && 
      expense.expense_type === 'system' && 
      expense.status === 'approved'
    );

    // تطبيق فلترة التاريخ إذا تم توفيرها
    if (dateRange && dateRange.from && dateRange.to) {
      settledExpenses = settledExpenses.filter(expense => {
        const expenseDate = new Date(expense.created_at || expense.approved_at);
        return expenseDate >= dateRange.from && expenseDate <= dateRange.to;
      });
    }

    // حساب الإجمالي
    const total = settledExpenses.reduce((sum, expense) => 
      sum + (Number(expense.amount) || 0), 0
    );

    // تجميع حسب الموظف
    const byEmployee = settledExpenses.reduce((acc, expense) => {
      // استخراج معرف الموظف من metadata أو description
      const metadata = expense.metadata || {};
      const employeeId = metadata.employee_id;
      const employeeName = metadata.employee_name || 'غير محدد';
      
      if (employeeId) {
        if (!acc[employeeId]) {
          acc[employeeId] = {
            employeeName,
            total: 0,
            expenses: []
          };
        }
        acc[employeeId].total += Number(expense.amount) || 0;
        acc[employeeId].expenses.push(expense);
      }
      
      return acc;
    }, {});

    // تجميع حسب الشهر
    const byMonth = settledExpenses.reduce((acc, expense) => {
      const date = new Date(expense.created_at || expense.approved_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!acc[monthKey]) {
        acc[monthKey] = {
          month: monthKey,
          total: 0,
          count: 0,
          expenses: []
        };
      }
      
      acc[monthKey].total += Number(expense.amount) || 0;
      acc[monthKey].count += 1;
      acc[monthKey].expenses.push(expense);
      
      return acc;
    }, {});

    return {
      total,
      expenses: settledExpenses,
      byEmployee,
      byMonth,
      count: settledExpenses.length
    };
  }, [accounting?.expenses, dateRange]);

  return {
    settledDuesData,
    loading,
    // دوال مساعدة
    getEmployeeSettledDues: (employeeId) => settledDuesData.byEmployee[employeeId] || { total: 0, expenses: [] },
    getMonthSettledDues: (monthKey) => settledDuesData.byMonth[monthKey] || { total: 0, expenses: [] },
    getTotalSettledDues: () => settledDuesData.total
  };
};

export default useSettledDues;