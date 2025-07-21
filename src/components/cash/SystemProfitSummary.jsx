import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { cn } from '@/lib/utils';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  ShoppingCart, 
  Package,
  DollarSign,
  Calculator,
  AlertTriangle,
  Activity,
  Filter,
  Calendar,
  BarChart3,
  PieChart,
  Eye,
  Target
} from 'lucide-react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, subWeeks, subMonths, subYears } from 'date-fns';
import { ar } from 'date-fns/locale';

/**
 * مركز السيطرة الاحترافي العالمي لحساب الربح العام
 * يحسب: رأس المال + أرباح المبيعات - المشتريات - المصاريف = الربح العام
 */
const SystemProfitSummary = ({ 
  capitalAmount = 0,
  realizedProfits = 0, 
  totalPurchases = 0,
  totalExpenses = 0,
  inventoryValue = 0,
  onFilterChange = () => {},
  className = ""
}) => {
  
  const [filterPeriod, setFilterPeriod] = useState('month');
  const [customDateRange, setCustomDateRange] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  // حساب التواريخ حسب الفترة المختارة
  const getDateRange = () => {
    const now = new Date();
    let from, to;

    switch (filterPeriod) {
      case 'today':
        from = startOfDay(now);
        to = endOfDay(now);
        break;
      case 'week':
        from = startOfWeek(now, { weekStartsOn: 1 });
        to = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'month':
        from = startOfMonth(now);
        to = endOfMonth(now);
        break;
      case 'year':
        from = startOfYear(now);
        to = endOfYear(now);
        break;
      case 'last30':
        from = subDays(now, 30);
        to = now;
        break;
      case 'last90':
        from = subDays(now, 90);
        to = now;
        break;
      case 'custom':
        if (customDateRange?.from && customDateRange?.to) {
          from = startOfDay(customDateRange.from);
          to = endOfDay(customDateRange.to);
        } else {
          from = startOfMonth(now);
          to = endOfMonth(now);
        }
        break;
      default:
        from = startOfMonth(now);
        to = endOfMonth(now);
    }

    return { from, to };
  };

  const calculations = useMemo(() => {
    // الربح العام = رأس المال + أرباح المبيعات المحققة - المشتريات - المصاريف + قيمة المخزون
    const netWorth = capitalAmount + realizedProfits - totalPurchases - totalExpenses + inventoryValue;
    const actualProfit = netWorth - capitalAmount; // الربح الفعلي = الصافي - رأس المال
    
    // النسب المئوية والمؤشرات
    const profitMargin = capitalAmount > 0 ? ((realizedProfits / capitalAmount) * 100) : 0;
    const expenseRatio = capitalAmount > 0 ? ((totalExpenses / capitalAmount) * 100) : 0;
    const purchaseRatio = capitalAmount > 0 ? ((totalPurchases / capitalAmount) * 100) : 0;
    const roi = capitalAmount > 0 ? ((actualProfit / capitalAmount) * 100) : 0; // عائد الاستثمار
    
    // تحليل الحالة المالية
    const isProfit = actualProfit > 0;
    const isHealthy = expenseRatio < 25 && purchaseRatio < 70;
    const riskLevel = expenseRatio > 30 ? 'عالي' : expenseRatio > 20 ? 'متوسط' : 'منخفض';
    
    return {
      netWorth,
      actualProfit,
      profitMargin,
      expenseRatio,
      purchaseRatio,
      roi,
      isProfit,
      isHealthy,
      riskLevel,
      // مؤشرات إضافية
      liquidityRatio: (capitalAmount + realizedProfits) / (totalExpenses + totalPurchases || 1),
      assetTurnover: realizedProfits / (inventoryValue || 1),
      operatingMargin: ((realizedProfits - totalExpenses) / realizedProfits) * 100
    };
  }, [capitalAmount, realizedProfits, totalPurchases, totalExpenses, inventoryValue]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ar-IQ', {
      style: 'decimal',
      minimumFractionDigits: 0
    }).format(Math.abs(amount));
  };

  const handleFilterChange = (period) => {
    setFilterPeriod(period);
    const dateRange = getDateRange();
    onFilterChange(period, dateRange);
  };

  const getPeriodLabel = () => {
    const labels = {
      today: 'اليوم',
      week: 'هذا الأسبوع', 
      month: 'هذا الشهر',
      year: 'هذه السنة',
      last30: 'آخر 30 يوم',
      last90: 'آخر 90 يوم',
      custom: 'فترة مخصصة'
    };
    return labels[filterPeriod] || 'هذا الشهر';
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* فلاتر الفترة الزمنية */}
      <Card className={cn(
        "overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 border-0",
        "bg-gradient-to-br from-card to-card/50 backdrop-blur-sm"
      )}>
        <CardHeader className={cn(
          "bg-gradient-to-br from-indigo-600 to-purple-600 text-white pb-4 relative",
          "before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:to-transparent before:pointer-events-none"
        )}>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3 text-lg font-bold text-white">
              <div className="p-2 bg-white/20 rounded-lg">
                <Filter className="w-5 h-5 transition-transform hover:rotate-12" />
              </div>
              فلاتر الفترة الزمنية
            </CardTitle>
            <Badge variant="secondary" className="bg-white/20 text-white border-0">
              {getPeriodLabel()}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4 p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
            {[
              { value: 'today', label: 'اليوم', icon: Calendar },
              { value: 'week', label: 'الأسبوع', icon: Calendar },
              { value: 'month', label: 'الشهر', icon: Calendar },
              { value: 'year', label: 'السنة', icon: Calendar },
              { value: 'last30', label: 'آخر 30', icon: BarChart3 },
              { value: 'last90', label: 'آخر 90', icon: BarChart3 },
              { value: 'custom', label: 'مخصص', icon: PieChart }
            ].map((period) => (
              <Button
                key={period.value}
                variant={filterPeriod === period.value ? "default" : "outline"}
                size="sm"
                onClick={() => handleFilterChange(period.value)}
                className={cn(
                  "group relative overflow-hidden border-2 transition-all duration-300",
                  filterPeriod === period.value 
                    ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25 scale-105' 
                    : 'border-muted-foreground/20 hover:bg-primary/5 hover:border-primary/30 hover:shadow-md hover:scale-102'
                )}
              >
                <period.icon className="w-3 h-3 ml-1 transition-transform group-hover:scale-110" />
                <span className="transition-all duration-300">
                  {period.label}
                </span>
              </Button>
            ))}
          </div>
          
          {filterPeriod === 'custom' && (
            <div className="flex gap-2 items-center">
              <DateRangePicker
                date={customDateRange}
                onDateChange={setCustomDateRange}
              />
              <Button 
                onClick={() => handleFilterChange('custom')}
                disabled={!customDateRange?.from || !customDateRange?.to}
                size="sm"
              >
                تطبيق
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* لوحة الربح العام الاحترافية */}
      <Card className={cn(
        "overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-primary/20 hover:scale-[1.01] border-0",
        "bg-gradient-to-br from-card to-card/50 backdrop-blur-sm"
      )}>
        <CardHeader className={cn(
          `bg-gradient-to-br ${calculations.isProfit ? 'from-emerald-600 to-teal-600' : 'from-orange-600 to-red-600'} text-white pb-3 relative`,
          "before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:to-transparent before:pointer-events-none"
        )}>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3 text-xl font-bold text-white">
              <div className="p-3 bg-white/20 rounded-lg">
                <Calculator className="w-6 h-6 transition-transform hover:rotate-12" />
              </div>
              مركز السيطرة المالي العالمي
              <Badge variant="secondary" className="bg-white/20 text-white border-0 text-sm">
                {calculations.isProfit ? "نشاط ربحي" : "تحت المراقبة"}
              </Badge>
            </CardTitle>
            
            <div className="flex gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
                className="text-white hover:bg-white/20 transition-all duration-300 hover:scale-105"
              >
                <Eye className="w-4 h-4 ml-1 transition-transform hover:scale-110" />
                <span className="transition-all duration-300">
                  {showDetails ? 'إخفاء' : 'تفاصيل'}
                </span>
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* الحساب الأساسي */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className={cn(
              "overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-indigo-200/50 hover:scale-105 border-0",
              "bg-gradient-to-br from-indigo-600 to-purple-600 text-white"
            )}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/20 rounded-lg">
                    <Wallet className="w-5 h-5 transition-transform hover:scale-110" />
                  </div>
                  <div>
                    <p className="text-sm text-white/80 font-medium">رأس المال</p>
                    <p className="text-lg font-bold text-white">+{formatCurrency(capitalAmount)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className={cn(
              "overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-emerald-200/50 hover:scale-105 border-0",
              "bg-gradient-to-br from-emerald-600 to-teal-600 text-white"
            )}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/20 rounded-lg">
                    <TrendingUp className="w-5 h-5 transition-transform hover:scale-110" />
                  </div>
                  <div>
                    <p className="text-sm text-white/80 font-medium">أرباح المبيعات</p>
                    <p className="text-lg font-bold text-white">+{formatCurrency(realizedProfits)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className={cn(
              "overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-orange-200/50 hover:scale-105 border-0",
              "bg-gradient-to-br from-orange-600 to-amber-600 text-white"
            )}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/20 rounded-lg">
                    <Package className="w-5 h-5 transition-transform hover:scale-110" />
                  </div>
                  <div>
                    <p className="text-sm text-white/80 font-medium">المشتريات</p>
                    <p className="text-lg font-bold text-white">-{formatCurrency(totalPurchases)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className={cn(
              "overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-red-200/50 hover:scale-105 border-0",
              "bg-gradient-to-br from-red-600 to-pink-600 text-white"
            )}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/20 rounded-lg">
                    <TrendingDown className="w-5 h-5 transition-transform hover:scale-110" />
                  </div>
                  <div>
                    <p className="text-sm text-white/80 font-medium">المصاريف</p>
                    <p className="text-lg font-bold text-white">-{formatCurrency(totalExpenses)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* النتيجة النهائية الاحترافية */}
          <Card className={cn(
            "overflow-hidden transition-all duration-300 hover:shadow-2xl hover:scale-[1.01] border-0",
            calculations.isProfit 
              ? 'bg-gradient-to-br from-emerald-50 via-green-50 to-emerald-100 hover:shadow-emerald-200/50' 
              : 'bg-gradient-to-br from-orange-50 via-red-50 to-orange-100 hover:shadow-orange-200/50'
          )}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "p-4 rounded-xl transition-all duration-300 hover:scale-110",
                    calculations.isProfit ? 'bg-emerald-500 shadow-lg shadow-emerald-200' : 'bg-orange-500 shadow-lg shadow-orange-200'
                  )}>
                    <DollarSign className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">صافي الثروة الإجمالية</p>
                    <p className={cn(
                      "text-3xl font-bold",
                      calculations.isProfit ? 'text-emerald-700' : 'text-orange-700'
                    )}>
                      {formatCurrency(calculations.netWorth)} د.ع
                    </p>
                    <p className="text-sm text-muted-foreground">
                      الربح الفعلي: {calculations.actualProfit >= 0 ? '+' : ''}{formatCurrency(calculations.actualProfit)} د.ع
                    </p>
                  </div>
                </div>
                
                <div className="text-right space-y-2">
                  <div className={cn(
                    "px-4 py-2 rounded-lg transition-all duration-300 hover:scale-105",
                    calculations.roi > 10 ? 'bg-green-100 text-green-700 hover:bg-green-200' :
                    calculations.roi > 0 ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' :
                    'bg-red-100 text-red-700 hover:bg-red-200'
                  )}>
                    <p className="text-xs font-medium">عائد الاستثمار</p>
                    <p className="text-lg font-bold">{calculations.roi.toFixed(1)}%</p>
                  </div>
                  <div className={cn(
                    "px-4 py-2 rounded-lg transition-all duration-300 hover:scale-105",
                    calculations.isHealthy ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                  )}>
                    <p className="text-xs font-medium">الحالة المالية</p>
                    <p className="text-sm font-bold">{calculations.isHealthy ? 'ممتازة' : 'تحتاج مراقبة'}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* المؤشرات المالية المتقدمة */}
          {showDetails && (
            <Card className={cn(
              "overflow-hidden transition-all duration-300 hover:shadow-lg border-0",
              "bg-gradient-to-br from-muted/30 to-muted/10 backdrop-blur-sm"
            )}>
              <CardHeader className="pb-4">
                <h4 className="font-bold text-foreground flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  التحليل المالي المتقدم
                </h4>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="text-center transition-all duration-300 hover:shadow-md hover:scale-105 border-0 bg-card">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground mb-2">نسبة السيولة</p>
                      <p className="text-lg font-bold text-blue-600">{calculations.liquidityRatio.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                  <Card className="text-center transition-all duration-300 hover:shadow-md hover:scale-105 border-0 bg-card">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground mb-2">معدل دوران الأصول</p>
                      <p className="text-lg font-bold text-purple-600">{calculations.assetTurnover.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                  <Card className="text-center transition-all duration-300 hover:shadow-md hover:scale-105 border-0 bg-card">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground mb-2">هامش التشغيل</p>
                      <p className="text-lg font-bold text-green-600">{calculations.operatingMargin.toFixed(1)}%</p>
                    </CardContent>
                  </Card>
                  <Card className="text-center transition-all duration-300 hover:shadow-md hover:scale-105 border-0 bg-card">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground mb-2">مستوى المخاطر</p>
                      <p className={cn(
                        "text-lg font-bold",
                        calculations.riskLevel === 'منخفض' ? 'text-green-600' :
                        calculations.riskLevel === 'متوسط' ? 'text-yellow-600' : 'text-red-600'
                      )}>
                        {calculations.riskLevel}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* المؤشرات السريعة */}
          <div className="grid grid-cols-3 gap-3">
            <Card className={cn(
              "text-center transition-all duration-300 hover:shadow-lg hover:scale-105 border-0",
              "bg-gradient-to-br from-emerald-50 to-emerald-100 hover:shadow-emerald-200/50"
            )}>
              <CardContent className="p-4">
                <p className="text-xs text-emerald-600 font-medium mb-2">هامش الربح</p>
                <p className="text-lg font-bold text-emerald-700">{calculations.profitMargin.toFixed(1)}%</p>
              </CardContent>
            </Card>
            <Card className={cn(
              "text-center transition-all duration-300 hover:shadow-lg hover:scale-105 border-0",
              "bg-gradient-to-br from-orange-50 to-orange-100 hover:shadow-orange-200/50"
            )}>
              <CardContent className="p-4">
                <p className="text-xs text-orange-600 font-medium mb-2">نسبة المشتريات</p>
                <p className="text-lg font-bold text-orange-700">{calculations.purchaseRatio.toFixed(1)}%</p>
              </CardContent>
            </Card>
            <Card className={cn(
              "text-center transition-all duration-300 hover:shadow-lg hover:scale-105 border-0",
              "bg-gradient-to-br from-red-50 to-red-100 hover:shadow-red-200/50"
            )}>
              <CardContent className="p-4">
                <p className="text-xs text-red-600 font-medium mb-2">نسبة المصاريف</p>
                <p className="text-lg font-bold text-red-700">{calculations.expenseRatio.toFixed(1)}%</p>
              </CardContent>
            </Card>
          </div>
          
          {/* تحذيرات ذكية */}
          <div className="space-y-3">
            {calculations.expenseRatio > 30 && (
              <Card className={cn(
                "transition-all duration-300 hover:shadow-lg border-0",
                "bg-gradient-to-br from-red-50 to-red-100 hover:shadow-red-200/50"
              )}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 transition-transform hover:scale-110" />
                    <p className="text-sm text-red-700">
                      <span className="font-bold">تحذير عالي:</span> نسبة المصاريف خطيرة ({calculations.expenseRatio.toFixed(1)}%)
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
            {calculations.expenseRatio > 20 && calculations.expenseRatio <= 30 && (
              <Card className={cn(
                "transition-all duration-300 hover:shadow-lg border-0",
                "bg-gradient-to-br from-yellow-50 to-yellow-100 hover:shadow-yellow-200/50"
              )}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 transition-transform hover:scale-110" />
                    <p className="text-sm text-yellow-700">
                      <span className="font-bold">تنبيه:</span> نسبة المصاريف مرتفعة ({calculations.expenseRatio.toFixed(1)}%)
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
            {calculations.roi < 5 && calculations.actualProfit > 0 && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <Activity className="w-5 h-5 text-blue-600" />
                <p className="text-sm text-blue-700">
                  <span className="font-bold">توصية:</span> عائد الاستثمار منخفض، فكر في تحسين الاستراتيجية
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemProfitSummary;