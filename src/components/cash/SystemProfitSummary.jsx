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
  enhancedData = null, // البيانات المحسنة الجديدة
  capitalAmount = 0,   // للتوافق مع النسخة القديمة
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
    // استخدام البيانات المحسنة إذا كانت متوفرة
    if (enhancedData) {
      const actualProfit = enhancedData.netProfit || 0;
      const systemProfit = enhancedData.systemProfit || 0; // ربح النظام الصحيح
      const grossProfit = enhancedData.grossProfit || 0; // للإحصائيات فقط
      const totalRevenue = enhancedData.totalRevenue || 0;
      
      // النسب المئوية والمؤشرات المحسنة
      const profitMargin = totalRevenue > 0 ? ((systemProfit / totalRevenue) * 100) : 0;
      const expenseRatio = totalRevenue > 0 ? ((enhancedData.totalExpenses / totalRevenue) * 100) : 0;
      const purchaseRatio = totalRevenue > 0 ? ((enhancedData.totalPurchases / totalRevenue) * 100) : 0;
      const roi = enhancedData.capitalValue > 0 ? ((actualProfit / enhancedData.capitalValue) * 100) : 0;
      
      return {
        netWorth: enhancedData.finalBalance || 0,
        actualProfit,
        systemProfit, // إضافة ربح النظام الصحيح
        profitMargin,
        expenseRatio,
        purchaseRatio,
        roi,
        isProfit: actualProfit > 0,
        isHealthy: expenseRatio < 25 && purchaseRatio < 70,
        riskLevel: expenseRatio > 30 ? 'عالي' : expenseRatio > 20 ? 'متوسط' : 'منخفض',
        liquidityRatio: (enhancedData.capitalValue + systemProfit) / (enhancedData.totalExpenses + enhancedData.totalPurchases || 1),
        assetTurnover: totalRevenue / (inventoryValue || 1),
        operatingMargin: totalRevenue > 0 ? ((systemProfit - enhancedData.totalExpenses) / totalRevenue) * 100 : 0
      };
    }
    
    // النظام القديم للتوافق العكسي
    const netWorth = capitalAmount + realizedProfits - totalPurchases - totalExpenses + inventoryValue;
    const actualProfit = netWorth - capitalAmount;
    
    const profitMargin = capitalAmount > 0 ? ((realizedProfits / capitalAmount) * 100) : 0;
    const expenseRatio = capitalAmount > 0 ? ((totalExpenses / capitalAmount) * 100) : 0;
    const purchaseRatio = capitalAmount > 0 ? ((totalPurchases / capitalAmount) * 100) : 0;
    const roi = capitalAmount > 0 ? ((actualProfit / capitalAmount) * 100) : 0;
    
    return {
      netWorth,
      actualProfit,
      profitMargin,
      expenseRatio,
      purchaseRatio,
      roi,
      isProfit: actualProfit > 0,
      isHealthy: expenseRatio < 25 && purchaseRatio < 70,
      riskLevel: expenseRatio > 30 ? 'عالي' : expenseRatio > 20 ? 'متوسط' : 'منخفض',
      liquidityRatio: (capitalAmount + realizedProfits) / (totalExpenses + totalPurchases || 1),
      assetTurnover: realizedProfits / (inventoryValue || 1),
      operatingMargin: ((realizedProfits - totalExpenses) / realizedProfits) * 100
    };
  }, [enhancedData, capitalAmount, realizedProfits, totalPurchases, totalExpenses, inventoryValue]);

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
        "bg-gradient-to-br from-card to-card/50 backdrop-blur-sm shadow-lg"
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

      {/* مركز السيطرة المالي */}
      <Card className={cn(
        "overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-primary/20 border-0",
        "bg-gradient-to-br from-card to-card/50 backdrop-blur-sm shadow-lg shadow-primary/5"
      )}>
        <CardHeader className={cn(
          "bg-gradient-to-br from-indigo-600 to-purple-600 text-white pb-6 relative",
          "before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:to-transparent before:pointer-events-none"
        )}>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-3 text-lg md:text-xl font-bold text-white">
                <div className="p-2 md:p-3 bg-white/20 rounded-xl shadow-lg">
                  <Calculator className="w-5 h-5 md:w-6 md:h-6" />
                </div>
                مركز السيطرة المالي
                <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs md:text-sm shadow-md">
                  {calculations.isProfit ? "نشاط ربحي" : "تحت المراقبة"}
                </Badge>
              </CardTitle>
              
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
                className="text-white hover:bg-white/20 transition-all duration-300 hover:scale-105 rounded-xl shadow-md"
              >
                <Eye className="w-4 h-4 ml-1" />
                <span className="hidden md:inline">
                  {showDetails ? 'إخفاء' : 'تفاصيل'}
                </span>
              </Button>
            </div>
            
            {/* الفلاتر المدمجة */}
            <div className="grid grid-cols-3 md:grid-cols-7 gap-1 md:gap-2">
              {[
                { value: 'today', label: 'اليوم' },
                { value: 'week', label: 'الأسبوع' },
                { value: 'month', label: 'الشهر' },
                { value: 'year', label: 'السنة' },
                { value: 'last30', label: 'آخر 30' },
                { value: 'last90', label: 'آخر 90' },
                { value: 'custom', label: 'مخصص' }
              ].map((period) => (
                <Button
                  key={period.value}
                  variant={filterPeriod === period.value ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => handleFilterChange(period.value)}
                  className={cn(
                    "text-xs px-2 py-1 transition-all duration-300",
                    filterPeriod === period.value 
                      ? 'bg-white/20 text-white border border-white/30 shadow-md' 
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  )}
                >
                  {period.label}
                </Button>
              ))}
            </div>
            
            {filterPeriod === 'custom' && (
              <div className="flex gap-2 items-center">
                <DateRangePicker
                  date={customDateRange}
                  onDateChange={setCustomDateRange}
                  className="flex-1"
                />
                <Button 
                  onClick={() => handleFilterChange('custom')}
                  disabled={!customDateRange?.from || !customDateRange?.to}
                  size="sm"
                  variant="secondary"
                  className="bg-white/20 text-white hover:bg-white/30"
                >
                  تطبيق
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        
          <CardContent className="space-y-6 md:space-y-8 p-4 md:p-8">
            {/* الكروت الأساسية - بتصميم منسق مع كروت المنتجات */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
              <Card className={cn(
                "overflow-hidden transition-all duration-300 border-0 group cursor-pointer",
                "shadow-lg shadow-black/10 dark:shadow-lg dark:shadow-primary/20",
                "bg-gradient-to-br from-indigo-600 to-purple-600 text-white",
                "hover:shadow-xl hover:shadow-indigo-500/20 hover:scale-[1.02]"
              )}>
                <CardContent className="p-3 md:p-6">
                  <div className="flex items-center gap-2 md:gap-4">
                    <div className="p-2 md:p-4 bg-white/20 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                      <Wallet className="w-4 h-4 md:w-6 md:h-6 transition-transform group-hover:rotate-12" />
                    </div>
                    <div>
                      <p className="text-xs md:text-sm text-white/80 font-medium">رأس المال</p>
                      <p className="text-sm md:text-xl font-bold text-white group-hover:scale-105 transition-transform">+{formatCurrency(capitalAmount)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card 
                className={cn(
                  "overflow-hidden transition-all duration-300 border-0 group cursor-pointer",
                  "shadow-lg shadow-black/10 dark:shadow-lg dark:shadow-primary/20",
                  "bg-gradient-to-br from-emerald-600 to-teal-600 text-white",
                  "hover:shadow-xl hover:shadow-emerald-500/20 hover:scale-[1.02]"
                )}
                onClick={() => {
                  // التنقل إلى صفحة تحليل الأرباح المتقدم
                  window.location.href = '/advanced-profits-analysis';
                }}
              >
                <CardContent className="p-3 md:p-6">
                  <div className="flex items-center gap-2 md:gap-4">
                    <div className="p-2 md:p-4 bg-white/20 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                      <TrendingUp className="w-4 h-4 md:w-6 md:h-6 transition-transform group-hover:rotate-12" />
                    </div>
                    <div>
                      <p className="text-xs md:text-sm text-white/80 font-medium">ربح النظام</p>
                      <p className="text-sm md:text-xl font-bold text-white group-hover:scale-105 transition-transform">+{formatCurrency(calculations.systemProfit || realizedProfits)}</p>
                      <p className="text-xs text-white/60 mt-1 flex items-center gap-1">
                        <Target className="w-3 h-3" />
                        اضغط للتحليل المتقدم
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className={cn(
                "overflow-hidden transition-all duration-300 border-0 group cursor-pointer",
                "shadow-lg shadow-black/10 dark:shadow-lg dark:shadow-primary/20",
                "bg-gradient-to-br from-orange-600 to-amber-600 text-white",
                "hover:shadow-xl hover:shadow-orange-500/20 hover:scale-[1.02]"
              )}>
                <CardContent className="p-3 md:p-6">
                  <div className="flex items-center gap-2 md:gap-4">
                    <div className="p-2 md:p-4 bg-white/20 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                      <Package className="w-4 h-4 md:w-6 md:h-6 transition-transform group-hover:rotate-12" />
                    </div>
                    <div>
                      <p className="text-xs md:text-sm text-white/80 font-medium">المشتريات</p>
                      <p className="text-sm md:text-xl font-bold text-white group-hover:scale-105 transition-transform">-{formatCurrency(totalPurchases)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className={cn(
                "overflow-hidden transition-all duration-300 border-0 group cursor-pointer",
                "shadow-lg shadow-black/10 dark:shadow-lg dark:shadow-primary/20",
                "bg-gradient-to-br from-red-600 to-pink-600 text-white",
                "hover:shadow-xl hover:shadow-red-500/20 hover:scale-[1.02]"
              )}>
                <CardContent className="p-3 md:p-6">
                  <div className="flex items-center gap-2 md:gap-4">
                    <div className="p-2 md:p-4 bg-white/20 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                      <TrendingDown className="w-4 h-4 md:w-6 md:h-6 transition-transform group-hover:rotate-12" />
                    </div>
                    <div>
                      <p className="text-xs md:text-sm text-white/80 font-medium">المصاريف</p>
                      <p className="text-sm md:text-xl font-bold text-white group-hover:scale-105 transition-transform">-{formatCurrency(totalExpenses)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          
          {/* النتيجة النهائية الاحترافية - صافي الثروة الإجمالية */}
          <Card className={cn(
            "overflow-hidden transition-all duration-300 border-0 group",
            "shadow-lg shadow-black/10 dark:shadow-lg dark:shadow-primary/20",
            "bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 text-white relative",
            "hover:shadow-xl hover:shadow-purple-500/20 hover:scale-[1.01]",
            "before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:to-transparent before:pointer-events-none",
            "after:absolute after:inset-0 after:bg-gradient-to-t after:from-black/20 after:to-transparent after:pointer-events-none"
          )}>
            <CardContent className="p-4 md:p-6 relative z-10">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="p-3 md:p-4 bg-white/20 rounded-xl shadow-lg group-hover:scale-110 transition-transform backdrop-blur-sm">
                    <DollarSign className="w-6 h-6 md:w-8 md:h-8 text-white transition-transform group-hover:rotate-12" />
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-white/90 font-medium">صافي الثروة الإجمالية</p>
                    <p className="text-xl md:text-3xl font-bold text-white group-hover:scale-105 transition-transform bg-gradient-to-r from-white to-white/90 bg-clip-text">
                      {formatCurrency(calculations.netWorth)} د.ع
                    </p>
                    <p className="text-xs md:text-sm text-white/80 mt-1">
                      الربح الفعلي: {calculations.actualProfit >= 0 ? '+' : ''}{formatCurrency(calculations.actualProfit)} د.ع
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-row md:flex-col gap-2 md:text-right">
                  <div className="px-3 py-2 md:px-4 md:py-2 bg-gradient-to-r from-white/20 to-white/10 rounded-lg transition-all duration-300 hover:scale-105 shadow-md backdrop-blur-sm border border-white/20">
                    <p className="text-xs font-medium text-white/90">عائد الاستثمار</p>
                    <p className="text-sm md:text-lg font-bold text-white bg-gradient-to-r from-yellow-300 to-amber-300 bg-clip-text text-transparent">{calculations.roi.toFixed(1)}%</p>
                  </div>
                  <div className="px-3 py-2 md:px-4 md:py-2 bg-gradient-to-r from-white/20 to-white/10 rounded-lg transition-all duration-300 hover:scale-105 shadow-md backdrop-blur-sm border border-white/20">
                    <p className="text-xs font-medium text-white/90">الحالة المالية</p>
                    <p className="text-xs md:text-sm font-bold text-white bg-gradient-to-r from-green-300 to-emerald-300 bg-clip-text text-transparent">{calculations.isHealthy ? 'ممتازة' : 'تحتاج مراقبة'}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* المؤشرات المالية المتقدمة */}
          {showDetails && (
            <Card className={cn(
              "overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-primary/20 border-0",
              "shadow-lg shadow-black/10 dark:shadow-lg dark:shadow-primary/20",
              "bg-gradient-to-br from-card to-card/50 backdrop-blur-sm"
            )}>
              <CardHeader className="pb-4">
                <h4 className="font-bold text-foreground flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  التحليل المالي المتقدم
                </h4>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className={cn(
                    "text-center transition-all duration-300 hover:shadow-xl hover:shadow-primary/20 hover:scale-105 border-0 group cursor-pointer",
                    "shadow-lg shadow-black/10 dark:shadow-lg dark:shadow-primary/20",
                    "bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950"
                  )}>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground mb-2">نسبة السيولة</p>
                      <p className="text-lg font-bold text-blue-600">{calculations.liquidityRatio.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                  <Card className={cn(
                    "text-center transition-all duration-300 hover:shadow-xl hover:shadow-primary/20 hover:scale-105 border-0 group cursor-pointer",
                    "shadow-lg shadow-black/10 dark:shadow-lg dark:shadow-primary/20",
                    "bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950 dark:to-indigo-950"
                  )}>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground mb-2">معدل دوران الأصول</p>
                      <p className="text-lg font-bold text-purple-600">{calculations.assetTurnover.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                  <Card className={cn(
                    "text-center transition-all duration-300 hover:shadow-xl hover:shadow-primary/20 hover:scale-105 border-0 group cursor-pointer",
                    "shadow-lg shadow-black/10 dark:shadow-lg dark:shadow-primary/20",
                    "bg-gradient-to-br from-green-50 to-teal-50 dark:from-green-950 dark:to-teal-950"
                  )}>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground mb-2">هامش التشغيل</p>
                      <p className="text-lg font-bold text-green-600">{calculations.operatingMargin.toFixed(1)}%</p>
                    </CardContent>
                  </Card>
                  <Card className={cn(
                    "text-center transition-all duration-300 hover:shadow-xl hover:shadow-primary/20 hover:scale-105 border-0 group cursor-pointer",
                    "shadow-lg shadow-black/10 dark:shadow-lg dark:shadow-primary/20",
                    "bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-950 dark:to-gray-950"
                  )}>
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
          
          {/* المؤشرات السريعة الاحترافية - بتصميم منسق مع كروت المنتجات */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className={cn(
              "overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-primary/20 hover:scale-105 border-0 group cursor-pointer",
              "shadow-lg shadow-black/10 dark:shadow-lg dark:shadow-primary/20",
              "bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950 dark:to-purple-950",
              "hover:shadow-2xl hover:shadow-indigo-500/30 dark:hover:shadow-2xl dark:hover:shadow-indigo-500/40"
            )}>
              <CardContent className="p-6 text-center">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <div className={cn(
                    "p-3 rounded-lg transition-all duration-300 group-hover:scale-110",
                    calculations.profitMargin > 15 
                      ? 'bg-gradient-to-br from-green-500 to-emerald-500 shadow-md shadow-green-500/30' 
                      : calculations.profitMargin > 5 
                      ? 'bg-gradient-to-br from-yellow-500 to-orange-500 shadow-md shadow-yellow-500/30' 
                      : 'bg-gradient-to-br from-red-500 to-pink-500 shadow-md shadow-red-500/30'
                  )}>
                    <Target className="w-5 h-5 text-white transition-transform group-hover:rotate-12" />
                  </div>
                  <p className="text-lg font-bold">هامش الربح</p>
                </div>
                <p className={cn(
                  "text-2xl font-bold transition-all duration-300 group-hover:scale-110",
                  calculations.profitMargin > 15 
                    ? 'text-emerald-600 dark:text-emerald-400' 
                    : calculations.profitMargin > 5 
                    ? 'text-amber-600 dark:text-amber-400' 
                    : 'text-red-600 dark:text-red-400'
                )}>
                  {calculations.profitMargin.toFixed(1)}%
                </p>
              </CardContent>
            </Card>
            
            <Card className={cn(
              "overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-primary/20 hover:scale-105 border-0 group cursor-pointer",
              "shadow-lg shadow-black/10 dark:shadow-lg dark:shadow-primary/20",
              "bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950",
              "hover:shadow-2xl hover:shadow-blue-500/30 dark:hover:shadow-2xl dark:hover:shadow-blue-500/40"
            )}>
              <CardContent className="p-6 text-center">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <div className={cn(
                    "p-3 rounded-lg transition-all duration-300 group-hover:scale-110",
                    calculations.purchaseRatio < 60 
                      ? 'bg-gradient-to-br from-blue-500 to-cyan-500 shadow-md shadow-blue-500/30' 
                      : 'bg-gradient-to-br from-orange-500 to-red-500 shadow-md shadow-orange-500/30'
                  )}>
                    <ShoppingCart className="w-5 h-5 text-white transition-transform group-hover:rotate-12" />
                  </div>
                  <p className="text-lg font-bold">نسبة المشتريات</p>
                </div>
                <p className={cn(
                  "text-2xl font-bold transition-all duration-300 group-hover:scale-110",
                  calculations.purchaseRatio < 60 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'
                )}>
                  {calculations.purchaseRatio.toFixed(1)}%
                </p>
              </CardContent>
            </Card>
            
            <Card className={cn(
              "overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-primary/20 hover:scale-105 border-0 group cursor-pointer",
              "shadow-lg shadow-black/10 dark:shadow-lg dark:shadow-primary/20",
              "bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950",
              "hover:shadow-2xl hover:shadow-emerald-500/30 dark:hover:shadow-2xl dark:hover:shadow-emerald-500/40"
            )}>
              <CardContent className="p-6 text-center">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <div className={cn(
                    "p-3 rounded-lg transition-all duration-300 group-hover:scale-110",
                    calculations.expenseRatio < 20 
                      ? 'bg-gradient-to-br from-green-500 to-teal-500 shadow-md shadow-green-500/30' 
                      : calculations.expenseRatio < 30 
                      ? 'bg-gradient-to-br from-yellow-500 to-orange-500 shadow-md shadow-yellow-500/30' 
                      : 'bg-gradient-to-br from-red-500 to-pink-500 shadow-md shadow-red-500/30'
                  )}>
                    <Activity className="w-5 h-5 text-white transition-transform group-hover:rotate-12" />
                  </div>
                  <p className="text-lg font-bold">نسبة المصاريف</p>
                </div>
                <p className={cn(
                  "text-2xl font-bold transition-all duration-300 group-hover:scale-110",
                  calculations.expenseRatio < 20 
                    ? 'text-emerald-600 dark:text-emerald-400' 
                    : calculations.expenseRatio < 30 
                    ? 'text-amber-600 dark:text-amber-400' 
                    : 'text-red-600 dark:text-red-400'
                )}>
                  {calculations.expenseRatio.toFixed(1)}%
                </p>
              </CardContent>
            </Card>
          </div>
          
          {/* تحذيرات ذكية - بتصميم منسق مع كروت المنتجات */}
          <div className="space-y-3">
            {calculations.expenseRatio > 30 && (
              <Card className={cn(
                "overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-red-500/20 hover:scale-105 border-0 group cursor-pointer",
                "shadow-lg shadow-black/10 dark:shadow-lg dark:shadow-primary/20",
                "bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-950 dark:to-pink-950"
              )}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-500 rounded-lg shadow-md group-hover:scale-110 transition-transform">
                      <AlertTriangle className="w-5 h-5 text-white transition-transform group-hover:rotate-12" />
                    </div>
                    <p className="text-sm text-red-700 dark:text-red-300">
                      <span className="font-bold">تحذير عالي:</span> نسبة المصاريف خطيرة ({calculations.expenseRatio.toFixed(1)}%)
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
            {calculations.expenseRatio > 20 && calculations.expenseRatio <= 30 && (
              <Card className={cn(
                "overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/20 hover:scale-105 border-0 group cursor-pointer",
                "shadow-lg shadow-black/10 dark:shadow-lg dark:shadow-primary/20",
                "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950"
              )}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500 rounded-lg shadow-md group-hover:scale-110 transition-transform">
                      <AlertTriangle className="w-5 h-5 text-white transition-transform group-hover:rotate-12" />
                    </div>
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      <span className="font-bold">تنبيه:</span> نسبة المصاريف مرتفعة ({calculations.expenseRatio.toFixed(1)}%)
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
            {calculations.roi < 5 && calculations.actualProfit > 0 && (
              <Card className={cn(
                "overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/20 hover:scale-105 border-0 group cursor-pointer",
                "shadow-lg shadow-black/10 dark:shadow-lg dark:shadow-primary/20",
                "bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950"
              )}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500 rounded-lg shadow-md group-hover:scale-110 transition-transform">
                      <Activity className="w-5 h-5 text-white transition-transform group-hover:rotate-12" />
                    </div>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      <span className="font-bold">توصية:</span> عائد الاستثمار منخفض، فكر في تحسين الاستراتيجية
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemProfitSummary;