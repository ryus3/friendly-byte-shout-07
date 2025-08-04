import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUnifiedFinancialSystem } from '@/hooks/useUnifiedFinancialSystem';
import { 
  DollarSign, 
  Package, 
  TrendingUp, 
  TrendingDown,
  Users,
  Calculator
} from 'lucide-react';

/**
 * مؤشرات مالية موحدة مفصلة
 */
const UnifiedFinancialMetrics = ({ layout = 'grid', showDetails = true }) => {
  const {
    totalRevenue,
    salesWithoutDelivery,
    deliveryFees,
    cogs,
    grossProfit,
    generalExpenses,
    employeeDuesPaid,
    netProfit,
    profitMargin,
    ordersCount,
    avgOrderValue,
    loading,
    error,
    formatCurrency,
    formatPercentage
  } = useUnifiedFinancialSystem();

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-destructive p-4">
        خطأ في تحميل المؤشرات المالية: {error}
      </div>
    );
  }

  const metrics = [
    {
      title: "إجمالي الإيرادات",
      value: formatCurrency(totalRevenue),
      subtitle: `من ${ordersCount} طلب مكتمل`,
      icon: DollarSign,
      color: "from-green-500 to-green-600"
    },
    {
      title: "المبيعات بدون توصيل",
      value: formatCurrency(salesWithoutDelivery),
      subtitle: `رسوم التوصيل: ${formatCurrency(deliveryFees)}`,
      icon: Package,
      color: "from-blue-500 to-blue-600"
    },
    {
      title: "تكلفة البضاعة المباعة",
      value: formatCurrency(cogs),
      subtitle: "التكلفة الإجمالية للمنتجات",
      icon: TrendingDown,
      color: "from-red-500 to-red-600"
    },
    {
      title: "إجمالي الربح",
      value: formatCurrency(grossProfit),
      subtitle: "قبل المصاريف العامة",
      icon: TrendingUp,
      color: "from-emerald-500 to-emerald-600"
    },
    {
      title: "المستحقات المدفوعة",
      value: formatCurrency(employeeDuesPaid),
      subtitle: "أرباح الموظفين المستلمة",
      icon: Users,
      color: "from-orange-500 to-orange-600"
    },
    {
      title: "صافي ربح النظام",
      value: formatCurrency(netProfit),
      subtitle: `هامش الربح: ${formatPercentage(profitMargin)}`,
      icon: Calculator,
      color: "from-purple-500 to-purple-600"
    }
  ];

  if (showDetails) {
    metrics.push(
      {
        title: "متوسط قيمة الطلب",
        value: formatCurrency(avgOrderValue),
        subtitle: `من ${ordersCount} طلب`,
        icon: DollarSign,
        color: "from-indigo-500 to-indigo-600"
      },
      {
        title: "المصاريف العامة",
        value: formatCurrency(generalExpenses),
        subtitle: "مصاريف تشغيلية",
        icon: TrendingDown,
        color: "from-gray-500 to-gray-600"
      }
    );
  }

  const gridCols = layout === 'compact' ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';

  return (
    <div className={`grid ${gridCols} gap-4`}>
      {metrics.map((metric, index) => (
        <Card key={index} className="overflow-hidden">
          <CardHeader className={`bg-gradient-to-r ${metric.color} text-white pb-2`}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-white/90">
                {metric.title}
              </CardTitle>
              <metric.icon className="h-4 w-4 text-white/80" />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="text-xl font-bold text-foreground mb-1">
              {metric.value}
            </div>
            <p className="text-xs text-muted-foreground">
              {metric.subtitle}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default UnifiedFinancialMetrics;