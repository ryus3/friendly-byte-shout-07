import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingCart, 
  Calculator,
  PiggyBank,
  Users,
  Receipt
} from 'lucide-react';

/**
 * مكون محسن لعرض الملخص المالي مع فلترة الفترة
 */
const EnhancedFinancialSummary = ({ 
  financialData, 
  title = "الملخص المالي المحسن",
  timePeriod = 'all',
  onTimePeriodChange
}) => {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ar-IQ', { 
      style: 'currency', 
      currency: 'IQD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0 
    }).format(amount || 0).replace('د.ع.', '') + ' د.ع';
  };

  const financialItems = [
    {
      label: "رأس المال",
      value: financialData.capitalValue,
      icon: PiggyBank,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      description: "رأس المال المستثمر"
    },
    {
      label: "إجمالي الإيرادات",
      value: financialData.totalRevenue,
      icon: Receipt,
      color: "text-green-600",
      bgColor: "bg-green-50",
      description: "مبالغ الفواتير المستلمة"
    },
    {
      label: "تكلفة البضائع المباعة",
      value: financialData.totalCogs,
      icon: ShoppingCart,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      description: "التكلفة الفعلية للمنتجات"
    },
    {
      label: "الربح الخام",
      value: financialData.grossProfit,
      icon: TrendingUp,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      description: "الإيرادات - تكلفة البضائع"
    },
    {
      label: "المصاريف التشغيلية",
      value: financialData.totalExpenses,
      icon: TrendingDown,
      color: "text-red-600",
      bgColor: "bg-red-50",
      description: "المصاريف العامة (بدون مستحقات الموظفين)"
    },
    {
      label: "مستحقات الموظفين",
      value: financialData.employeeProfits,
      icon: Users,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      description: "أرباح الموظفين المدفوعة"
    },
    {
      label: "صافي الربح",
      value: financialData.netProfit,
      icon: Calculator,
      color: financialData.netProfit >= 0 ? "text-green-600" : "text-red-600",
      bgColor: financialData.netProfit >= 0 ? "bg-green-50" : "bg-red-50",
      description: "الربح النهائي بعد جميع التكاليف"
    },
    {
      label: "رصيد القاصة الرئيسية",
      value: financialData.finalBalance,
      icon: DollarSign,
      color: financialData.finalBalance >= 0 ? "text-blue-600" : "text-red-600",
      bgColor: financialData.finalBalance >= 0 ? "bg-blue-50" : "bg-red-50",
      description: "رأس المال + صافي الربح - المشتريات"
    }
  ];

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-right flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            {title}
          </CardTitle>
          {onTimePeriodChange && (
            <select 
              value={timePeriod} 
              onChange={(e) => onTimePeriodChange(e.target.value)}
              className="text-sm border rounded px-2 py-1"
            >
              <option value="all">كل الفترات</option>
              <option value="today">اليوم</option>
              <option value="week">هذا الأسبوع</option>
              <option value="month">هذا الشهر</option>
              <option value="year">هذا العام</option>
            </select>
          )}
        </div>
        <p className="text-sm text-muted-foreground text-right">
          حسابات مالية دقيقة ومطابقة للمعايير المحاسبية
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* قسم الإيرادات والتكاليف */}
        <div className="space-y-3">
          <h4 className="font-medium text-right text-sm text-muted-foreground">الإيرادات والتكاليف</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {financialItems.slice(1, 4).map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="text-right">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${item.color}`}>
                      {formatCurrency(item.value)}
                    </span>
                    <div className={`p-2 rounded-full ${item.bgColor}`}>
                      <Icon className={`h-4 w-4 ${item.color}`} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* قسم المصاريف والأرباح */}
        <div className="space-y-3">
          <h4 className="font-medium text-right text-sm text-muted-foreground">المصاريف والأرباح</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {financialItems.slice(4, 7).map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="text-right">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${item.color}`}>
                      {formatCurrency(item.value)}
                    </span>
                    <div className={`p-2 rounded-full ${item.bgColor}`}>
                      <Icon className={`h-4 w-4 ${item.color}`} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* قسم النتائج النهائية */}
        <div className="space-y-3">
          <h4 className="font-medium text-right text-sm text-muted-foreground">النتائج النهائية</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[financialItems[0], financialItems[7]].map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={index} className="flex items-center justify-between p-4 rounded-lg border-2 border-primary/20 bg-primary/5">
                  <div className="text-right">
                    <p className="text-base font-semibold">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-lg font-bold ${item.color}`}>
                      {formatCurrency(item.value)}
                    </span>
                    <div className={`p-3 rounded-full ${item.bgColor}`}>
                      <Icon className={`h-5 w-5 ${item.color}`} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* مؤشرات الأداء */}
        <Separator />
        
        <div className="flex flex-wrap gap-2 justify-center">
          <Badge variant={financialData.grossProfit > 0 ? "default" : "destructive"}>
            معدل الربح الخام: {financialData.totalRevenue > 0 ? 
              ((financialData.grossProfit / financialData.totalRevenue) * 100).toFixed(1) : 0}%
          </Badge>
          <Badge variant={financialData.netProfit > 0 ? "default" : "destructive"}>
            معدل صافي الربح: {financialData.totalRevenue > 0 ? 
              ((financialData.netProfit / financialData.totalRevenue) * 100).toFixed(1) : 0}%
          </Badge>
          <Badge variant="outline">
            معدل التكلفة: {financialData.totalRevenue > 0 ? 
              ((financialData.totalCogs / financialData.totalRevenue) * 100).toFixed(1) : 0}%
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};

export default EnhancedFinancialSummary;