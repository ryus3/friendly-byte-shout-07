/**
 * 💼 عرض البيانات المالية الموحدة الجديد
 * يعرض البيانات من النظام المالي الموحد الجديد
 */

import React from 'react';
import { useUnifiedFinancialContext } from '@/contexts/UnifiedFinancialContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Receipt, 
  Package, 
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';

const MetricCard = ({ title, value, icon: Icon, trend, isGood, subtitle, onClick }) => (
  <Card className={`transition-colors hover:bg-accent/50 ${onClick ? 'cursor-pointer' : ''}`} onClick={onClick}>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      )}
      {trend && (
        <Badge variant={isGood ? "default" : "destructive"} className="mt-2">
          {trend}
        </Badge>
      )}
    </CardContent>
  </Card>
);

export const UnifiedFinancialDisplay = ({ page = 'dashboard', compact = false }) => {
  const { 
    getFinancialData, 
    formatCurrency, 
    formatPercentage, 
    systemStatus,
    isUnifiedSystem,
    systemVersion 
  } = useUnifiedFinancialContext();
  
  const financialData = getFinancialData(page);
  
  if (financialData.loading) {
    return (
      <div className="space-y-4">
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertDescription>جاري تحميل البيانات المالية...</AlertDescription>
        </Alert>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }
  
  if (financialData.error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>خطأ في تحميل البيانات المالية: {financialData.error}</AlertDescription>
      </Alert>
    );
  }
  
  if (!financialData.isDataValid) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>لا توجد بيانات مالية متاحة للعرض.</AlertDescription>
      </Alert>
    );
  }
  
  const metrics = [
    {
      title: "إجمالي الإيرادات",
      value: formatCurrency(financialData.totalRevenue),
      icon: DollarSign,
      subtitle: `شامل ${formatCurrency(financialData.deliveryFees)} رسوم توصيل`,
      isGood: financialData.totalRevenue > 0
    },
    {
      title: "المبيعات (بدون توصيل)",
      value: formatCurrency(financialData.salesWithoutDelivery),
      icon: Receipt,
      isGood: financialData.salesWithoutDelivery > 0
    },
    {
      title: "تكلفة البضائع",
      value: formatCurrency(financialData.cogs),
      icon: Package,
      isGood: financialData.cogs < financialData.salesWithoutDelivery
    },
    {
      title: "الربح الإجمالي",
      value: formatCurrency(financialData.grossProfit),
      icon: TrendingUp,
      subtitle: `هامش ${formatPercentage(financialData.grossProfitMargin)}`,
      isGood: financialData.grossProfit > 0,
      trend: financialData.grossProfit > 0 ? "ربحي" : "خسارة"
    }
  ];
  
  const expenseMetrics = [
    {
      title: "المصاريف العامة",
      value: formatCurrency(financialData.generalExpenses),
      icon: TrendingDown,
      isGood: false
    },
    {
      title: "مستحقات مدفوعة",
      value: formatCurrency(financialData.employeeDuesPaid),
      icon: TrendingDown,
      isGood: false
    }
  ];
  
  const netProfitCard = {
    title: "صافي الربح",
    value: formatCurrency(financialData.netProfit),
    icon: financialData.netProfit >= 0 ? CheckCircle : AlertTriangle,
    subtitle: `هامش ${formatPercentage(financialData.netProfitMargin)}`,
    isGood: financialData.netProfit > 0,
    trend: financialData.quickStats?.profitabilityStatus === 'profitable' ? "مربح" : 
           financialData.quickStats?.profitabilityStatus === 'loss' ? "خاسر" : "متعادل"
  };
  
  if (compact) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard {...metrics[1]} />
        <MetricCard {...metrics[3]} />
        <MetricCard {...netProfitCard} />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* البيانات الأساسية */}
      <div>
        <h3 className="text-lg font-semibold mb-4">الإيرادات والتكاليف</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((metric, index) => (
            <MetricCard key={index} {...metric} />
          ))}
        </div>
      </div>
      
      {/* المصاريف */}
      <div>
        <h3 className="text-lg font-semibold mb-4">المصاريف</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {expenseMetrics.map((metric, index) => (
            <MetricCard key={index} {...metric} />
          ))}
        </div>
      </div>
      
      {/* صافي الربح */}
      <div>
        <h3 className="text-lg font-semibold mb-4">النتيجة النهائية</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard {...netProfitCard} />
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">معلومات النظام</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <div className="space-y-1">
                <div>الطلبات: {financialData.systemInfo?.dataSource?.ordersCount || 0}</div>
                <div>المصاريف: {financialData.systemInfo?.dataSource?.expensesCount || 0}</div>
                <div>الفترة: {financialData.timePeriod}</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">حالة البيانات</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <div className="space-y-1">
                <Badge variant={financialData.quickStats?.hasRevenue ? "default" : "secondary"}>
                  {financialData.quickStats?.hasRevenue ? "يوجد إيرادات" : "لا توجد إيرادات"}
                </Badge>
                <Badge variant={financialData.quickStats?.hasProfits ? "default" : "secondary"}>
                  {financialData.quickStats?.hasProfits ? "يوجد أرباح" : "لا توجد أرباح"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* تحذير النظام الموحد */}
      <Alert className="border-green-200 bg-green-50">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          ✅ <strong>النظام المالي الموحد v{systemVersion} نشط!</strong> جميع الحسابات تتم من مصدر واحد موحد. 
          البيانات دقيقة وموحدة في جميع الصفحات. آخر تحديث: {new Date(systemStatus.lastUpdate).toLocaleTimeString('ar')}
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default UnifiedFinancialDisplay;