import React, { useMemo } from 'react';
import StatCard from '@/components/dashboard/StatCard';
import { DollarSign, ShoppingCart, Calendar, Package } from 'lucide-react';

const PurchasesStats = ({ purchases, onCardClick, onFilterChange }) => {
  
  const handleCardClick = (period) => {
    const today = new Date();
    let startDate, endDate;
    
    if (period === 'this_month') {
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    } else if (period === 'this_year') {
      startDate = new Date(today.getFullYear(), 0, 1);
      endDate = new Date(today.getFullYear(), 11, 31);
    }
    
    // تطبيق الفلتر عبر callback للمكون الأب
    if (startDate && endDate && onFilterChange) {
      onFilterChange({
        dateRange: { from: startDate, to: endDate }
      });
    }
    
    // استدعاء الدالة الأصلية إذا كانت موجودة
    if (onCardClick) {
      onCardClick(period);
    }
  };
  const stats = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const totalCost = purchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);
    const monthPurchases = purchases.filter(p => new Date(p.purchase_date || p.created_at) >= startOfMonth);
    const yearPurchases = purchases.filter(p => new Date(p.purchase_date || p.created_at) >= startOfYear);
    
    const totalMonthCost = monthPurchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);
    const totalYearCost = yearPurchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);
    const totalItems = purchases.reduce((sum, p) => sum + (p.items?.length || 0), 0);

    return {
      totalCost,
      totalMonthCost,
      totalYearCost,
      totalItems,
      totalInvoices: purchases.length,
      monthPurchases,
      yearPurchases,
    };
  }, [purchases]);

  const statCards = [
    { 
      title: 'إجمالي تكلفة المشتريات', 
      value: stats.totalCost, 
      icon: DollarSign, 
      colors: ['green-500', 'emerald-500'], 
      format: 'currency', 
      onClick: () => handleCardClick('all'),
      subtitle: `${stats.totalInvoices} فاتورة`
    },
    { 
      title: 'تكلفة مشتريات الشهر', 
      value: stats.totalMonthCost, 
      icon: Calendar, 
      colors: ['blue-500', 'sky-500'], 
      format: 'currency', 
      onClick: () => handleCardClick('this_month'),
      subtitle: `${stats.monthPurchases.length} فاتورة هذا الشهر`
    },
    { 
      title: 'تكلفة مشتريات السنة', 
      value: stats.totalYearCost, 
      icon: Calendar, 
      colors: ['purple-500', 'violet-500'], 
      format: 'currency', 
      onClick: () => handleCardClick('this_year'),
      subtitle: `${stats.yearPurchases.length} فاتورة هذه السنة`
    },
    { 
      title: 'إجمالي الأصناف', 
      value: stats.totalItems, 
      icon: Package, 
      colors: ['orange-500', 'amber-500'], 
      format: 'number', 
      onClick: () => handleCardClick('all'),
      subtitle: `في ${stats.totalInvoices} فاتورة`
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {statCards.map((stat, index) => (
        <StatCard key={index} {...stat} />
      ))}
    </div>
  );
};

export default PurchasesStats;