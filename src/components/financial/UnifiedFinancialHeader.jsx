import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, Package, Wallet } from 'lucide-react';
import { useUnifiedFinancialSystem } from '@/hooks/useUnifiedFinancialSystem';

/**
 * رأس مالي موحد يعرض الأرقام الصحيحة
 */
const UnifiedFinancialHeader = ({ showCapital = true, showProfit = true, showRevenue = true }) => {
  const {
    totalRevenue,
    netProfit,
    totalCapital,
    salesWithoutDelivery,
    loading,
    error,
    formatCurrency
  } = useUnifiedFinancialSystem();

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-destructive p-4">
        خطأ في تحميل البيانات المالية: {error}
      </div>
    );
  }

  const cards = [];

  if (showRevenue) {
    cards.push({
      title: "إجمالي الإيرادات",
      value: formatCurrency(totalRevenue),
      subtitle: `المبيعات: ${formatCurrency(salesWithoutDelivery)}`,
      icon: DollarSign,
      color: "from-green-500 to-green-600"
    });
  }

  if (showProfit) {
    cards.push({
      title: "صافي ربح النظام", 
      value: formatCurrency(netProfit),
      subtitle: "الربح بعد جميع المصاريف",
      icon: TrendingUp,
      color: "from-blue-500 to-blue-600"
    });
  }

  if (showCapital) {
    cards.push({
      title: "رأس المال الإجمالي",
      value: formatCurrency(totalCapital),
      subtitle: "النقد + قيمة المخزون",
      icon: Wallet,
      color: "from-purple-500 to-purple-600"
    });
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map((card, index) => (
        <Card key={index} className="overflow-hidden">
          <CardHeader className={`bg-gradient-to-r ${card.color} text-white pb-2`}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-white/90">
                {card.title}
              </CardTitle>
              <card.icon className="h-4 w-4 text-white/80" />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-foreground mb-1">
              {card.value}
            </div>
            <p className="text-xs text-muted-foreground">
              {card.subtitle}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default UnifiedFinancialHeader;