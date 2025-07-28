import React from 'react';
import StatCard from '@/components/dashboard/StatCard';
import { useUnifiedFinancialData } from '@/hooks/useUnifiedFinancialData';
import { 
  User, 
  Hourglass, 
  CheckCircle, 
  Users, 
  TrendingDown, 
  PackageCheck,
  Wallet,
  TrendingUp
} from 'lucide-react';

/**
 * عنصر موحد لعرض البيانات المالية
 * يستخدم النظام المحاسبي الموحد الوحيد في التطبيق
 * يُستخدم في: لوحة التحكم، المركز المالي، تقرير الأرباح والخسائر
 */
const UnifiedProfitDisplay = ({
  displayMode = 'dashboard', // 'dashboard' | 'financial-center'
  canViewAll = true,
  onFilterChange = () => {},
  onExpensesClick = () => {},
  onSettledDuesClick = () => {},
  className = '',
  datePeriod = 'month'
}) => {
  // استخدام النظام المحاسبي الموحد الوحيد
  const financialData = useUnifiedFinancialData(datePeriod);

  // تحديد التصميم بناءً على المكان
  const getLayoutClasses = () => {
    if (displayMode === 'financial-center') {
      return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';
    }
    return canViewAll 
      ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6'
      : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6';
  };

  // بناء البطاقات للعرض
  const buildCards = () => {
    const cards = [];

    console.log('🔧 عرض البيانات المالية الموحدة:', { 
      displayMode, 
      canViewAll, 
      datePeriod,
      netProfit: financialData.netProfit,
      generalExpenses: financialData.generalExpenses 
    });

    if (canViewAll) {
      // للمدير: عرض بيانات النظام الكاملة
      if (displayMode === 'financial-center') {
        // في المركز المالي: التركيز على الجانب المالي
        cards.push(
          {
            key: 'net-system-profit',
            title: 'صافي أرباح المبيعات',
            value: financialData.netProfit,
            icon: Wallet,
            colors: ['emerald-600', 'teal-600'],
            format: 'currency',
            description: 'بعد خصم المصاريف العامة'
          },
          {
            key: 'total-manager-profits',
            title: 'أرباح المؤسسة',
            value: financialData.systemProfit,
            icon: TrendingUp,
            colors: ['blue-600', 'indigo-600'],
            format: 'currency',
            description: 'قبل خصم المصاريف'
          },
          {
            key: 'total-employee-profits',
            title: 'أرباح الموظفين',
            value: financialData.totalEmployeeProfits,
            icon: Users,
            colors: ['purple-600', 'violet-600'],
            format: 'currency',
            onClick: () => onFilterChange('employeeId', 'employees')
          }
        );
      } else {
        // في لوحة التحكم: عرض شامل
        cards.push(
          {
            key: 'net-profit',
            title: 'صافي أرباح المبيعات',
            value: financialData.netProfit,
            icon: Wallet,
            colors: ['blue-500', 'sky-500'],
            format: 'currency',
            description: 'بعد خصم المصاريف العامة'
          },
          {
            key: 'manager-profit-from-employees',
            title: 'أرباح من الموظفين',
            value: financialData.managerProfitFromEmployees,
            icon: Users,
            colors: ['indigo-500', 'violet-500'],
            format: 'currency',
            onClick: () => onFilterChange('employeeId', 'employees')
          },
          {
            key: 'total-expenses',
            title: 'المصاريف العامة',
            value: financialData.generalExpenses,
            icon: TrendingDown,
            colors: ['red-500', 'orange-500'],
            format: 'currency',
            onClick: onExpensesClick
          },
          {
            key: 'total-settled-dues',
            title: 'المستحقات المدفوعة',
            value: financialData.employeeSettledDues,
            icon: PackageCheck,
            colors: ['purple-500', 'violet-500'],
            format: 'currency',
            onClick: onSettledDuesClick
          }
        );
      }
    } else {
      // للموظف: البيانات الشخصية فقط
      cards.push(
        {
          key: 'my-total-profit',
          title: 'إجمالي أرباحي',
          value: financialData.myProfit || 0,
          icon: User,
          colors: ['green-500', 'emerald-500'],
          format: 'currency'
        }
      );
    }

    // إضافة بطاقة الأرباح المعلقة
    if (canViewAll) {
      cards.push({
        key: 'pending-profit',
        title: 'الأرباح المعلقة',
        value: financialData.employeePendingDues,
        icon: Hourglass,
        colors: ['yellow-500', 'amber-500'],
        format: 'currency',
        onClick: () => onFilterChange('profitStatus', 'pending')
      });
    } else {
      cards.push({
        key: 'my-pending-profit',
        title: 'أرباحي المعلقة',
        value: financialData.myProfit || 0,
        icon: Hourglass,
        colors: ['yellow-500', 'amber-500'],
        format: 'currency'
      });
    }

    console.log('✅ تم بناء البطاقات الموحدة:', cards.map(c => ({ key: c.key, value: c.value })));
    return cards;
  };

  const cards = buildCards();

  if (financialData.loading) {
    return (
      <div className={`${getLayoutClasses()} ${className}`}>
        {Array.from({ length: canViewAll ? 4 : 2 }).map((_, i) => (
          <div key={i} className="h-32 bg-secondary/50 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (financialData.error) {
    return (
      <div className="text-red-500 text-center p-4">
        خطأ في تحميل البيانات المالية: {financialData.error}
      </div>
    );
  }

  return (
    <div className={`${getLayoutClasses()} ${className}`}>
      {cards.map(({ key, ...cardProps }) => (
        <StatCard 
          key={key} 
          {...cardProps}
          className={displayMode === 'financial-center' ? 'financial-card' : ''}
        />
      ))}
    </div>
  );
};

export default UnifiedProfitDisplay;