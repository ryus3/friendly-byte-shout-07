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
 * عنصر موحد لعرض بيانات الأرباح
 * يُستخدم في لوحة التحكم والمركز المالي وتقرير الأرباح والخسائر
 * يحسب البيانات مرة واحدة ويعرضها في جميع الأماكن
 */

const UnifiedProfitDisplay = ({
  profitData = {},
  displayMode = 'dashboard', // 'dashboard' | 'financial-center'
  canViewAll = true,
  onFilterChange = () => {},
  onExpensesClick = () => {},
  onSettledDuesClick = () => {},
  className = '',
  datePeriod = 'month'
}) => {
  // استخدام Hook الموحد للبيانات المالية
  const { financialData: unifiedFinancialData } = useUnifiedFinancialData(datePeriod);

  // تحديد التصميم بناءً على المكان
  const getLayoutClasses = () => {
    if (displayMode === 'financial-center') {
      return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';
    }
    return canViewAll 
      ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6'
      : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6';
  };

  // بناء البطاقات للعرض باستخدام البيانات الموحدة
  const buildCards = () => {
    const cards = [];

    if (canViewAll) {
      // للمدير: عرض بيانات النظام الكاملة
      if (displayMode === 'financial-center') {
        // في المركز المالي: التركيز على الجانب المالي
        cards.push(
          {
            key: 'net-system-profit',
            title: 'صافي ربح النظام',
            value: unifiedFinancialData.netProfit,
            icon: Wallet,
            colors: ['emerald-600', 'teal-600'],
            format: 'currency',
            description: 'بعد خصم المصاريف العامة'
          },
          {
            key: 'total-manager-profits',
            title: 'أرباح المؤسسة',
            value: unifiedFinancialData.systemProfit,
            icon: TrendingUp,
            colors: ['blue-600', 'indigo-600'],
            format: 'currency',
            description: 'قبل خصم المصاريف'
          },
          {
            key: 'total-employee-profits',
            title: 'أرباح الموظفين',
            value: unifiedFinancialData.totalEmployeeProfits,
            icon: Users,
            colors: ['purple-600', 'violet-600'],
            format: 'currency',
            onClick: () => onFilterChange('employeeId', 'employees')
          }
        );
      } else if (displayMode === 'dashboard') {
        // في لوحة التحكم: عرض كارت صافي أرباح المبيعات (نفس المركز المالي تماماً)
        cards.push(
          {
            key: 'net-sales-profit',
            title: 'صافي أرباح المبيعات',
            value: unifiedFinancialData.netProfit,
            icon: Wallet,
            colors: ['green-500', 'emerald-500'],
            format: 'currency',
            description: 'بعد خصم المصاريف'
          }
        );
      } else {
        // لتقرير الأرباح والخسائر أو أي مكان آخر
        cards.push(
          {
            key: 'net-profit',
            title: 'صافي الربح',
            value: unifiedFinancialData.netProfit,
            icon: Wallet,
            colors: ['green-500', 'emerald-500'],
            format: 'currency'
          },
          {
            key: 'manager-profit-from-employees',
            title: 'أرباح من الموظفين',
            value: unifiedFinancialData.systemProfit,
            icon: Users,
            colors: ['indigo-500', 'violet-500'],
            format: 'currency',
            onClick: () => onFilterChange('employeeId', 'employees')
          },
          {
            key: 'total-expenses',
            title: 'المصاريف العامة',
            value: unifiedFinancialData.generalExpenses,
            icon: TrendingDown,
            colors: ['red-500', 'orange-500'],
            format: 'currency',
            onClick: onExpensesClick
          },
          {
            key: 'total-settled-dues',
            title: 'المستحقات المدفوعة',
            value: unifiedFinancialData.employeeSettledDues || 0,
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
          value: profitData.totalPersonalProfit || 0,
          icon: User,
          colors: ['green-500', 'emerald-500'],
          format: 'currency'
        }
      );
    }

    // إضافة بطاقة الأرباح المعلقة فقط للجميع (إذا لم تكن في لوحة التحكم)
    if (canViewAll && displayMode !== 'dashboard') {
      cards.push({
        key: 'pending-profit',
        title: 'الأرباح المعلقة',
        value: (profitData.detailedProfits || [])
          .filter(p => (p.profitStatus || 'pending') === 'pending')
          .reduce((sum, p) => sum + p.profit, 0),
        icon: Hourglass,
        colors: ['yellow-500', 'amber-500'],
        format: 'currency',
        onClick: () => onFilterChange('profitStatus', 'pending')
      });
    } else if (!canViewAll) {
      cards.push({
        key: 'my-pending-profit',
        title: 'أرباحي المعلقة',
        value: profitData.personalPendingProfit || 0,
        icon: Hourglass,
        colors: ['yellow-500', 'amber-500'],
        format: 'currency'
      });
    }

    return cards;
  };

  const cards = buildCards();

  return (
    <div className={`${getLayoutClasses()} ${className}`}>
      {cards.map(({ key, ...cardProps }) => (
        <StatCard 
          key={key} 
          {...cardProps}
          // إضافة ستايل خاص للمركز المالي
          className={displayMode === 'financial-center' ? 'financial-card' : ''}
        />
      ))}
    </div>
  );
};

export default UnifiedProfitDisplay;