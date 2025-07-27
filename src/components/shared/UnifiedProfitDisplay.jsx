import React from 'react';
import StatCard from '@/components/dashboard/StatCard';
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
 * يمكن استخدامه في لوحة التحكم والمركز المالي بتصاميم مختلفة
 */
const UnifiedProfitDisplay = ({
  profitData,
  displayMode = 'dashboard', // 'dashboard' | 'financial-center'
  canViewAll = true,
  onFilterChange = () => {},
  onExpensesClick = () => {},
  onSettledDuesClick = () => {},
  className = ''
}) => {

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

    if (canViewAll) {
      // للمدير: عرض بيانات النظام الكاملة
      if (displayMode === 'financial-center') {
        // في المركز المالي: التركيز على الجانب المالي
        cards.push(
          {
            key: 'net-system-profit',
            title: 'صافي ربح النظام',
            value: profitData.netSystemProfit || 0,
            icon: Wallet,
            colors: ['emerald-600', 'teal-600'],
            format: 'currency',
            description: 'بعد خصم المصاريف العامة'
          },
          {
            key: 'total-manager-profits',
            title: 'أرباح المؤسسة',
            value: profitData.totalManagerProfits || 0,
            icon: TrendingUp,
            colors: ['blue-600', 'indigo-600'],
            format: 'currency',
            description: 'قبل خصم المصاريف'
          },
          {
            key: 'total-employee-profits',
            title: 'أرباح الموظفين',
            value: profitData.totalEmployeeProfits || 0,
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
            title: 'صافي الربح',
            value: profitData.netSystemProfit || 0,
            icon: User,
            colors: ['green-500', 'emerald-500'],
            format: 'currency'
          },
          {
            key: 'manager-profit-from-employees',
            title: 'أرباح من الموظفين',
            value: profitData.totalManagerProfits || 0,
            icon: Users,
            colors: ['indigo-500', 'violet-500'],
            format: 'currency',
            onClick: () => onFilterChange('employeeId', 'employees')
          },
          {
            key: 'total-expenses',
            title: 'المصاريف العامة',
            value: profitData.totalExpenses || 0,
            icon: TrendingDown,
            colors: ['red-500', 'orange-500'],
            format: 'currency',
            onClick: onExpensesClick
          },
          {
            key: 'total-settled-dues',
            title: 'المستحقات المدفوعة',
            value: profitData.settledDues || 0,
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
          value: profitData.personalTotalProfit || 0,
          icon: User,
          colors: ['green-500', 'emerald-500'],
          format: 'currency'
        }
      );
    }

    // إضافة بطاقات الأرباح المعلقة والمستلمة (للجميع)
    cards.push(
      {
        key: 'pending-profit',
        title: 'الأرباح المعلقة',
        value: canViewAll 
          ? profitData.totalSystemProfit - profitData.settledDues 
          : profitData.personalPendingProfit || 0,
        icon: Hourglass,
        colors: ['yellow-500', 'amber-500'],
        format: 'currency',
        onClick: () => onFilterChange('profitStatus', 'pending')
      },
      {
        key: 'settled-profit',
        title: 'الأرباح المستلمة',
        value: canViewAll 
          ? profitData.settledDues 
          : profitData.personalSettledProfit || 0,
        icon: CheckCircle,
        colors: ['blue-500', 'sky-500'],
        format: 'currency',
        onClick: () => onFilterChange('profitStatus', 'settled')
      }
    );

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