import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { motion } from 'framer-motion';
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
  Target,
  CreditCard
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
      <Card className="border-2 bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950/30 dark:via-teal-950/30 dark:to-cyan-950/30 border-emerald-200 dark:border-emerald-800/50 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg text-emerald-700 dark:text-emerald-300">
              <Filter className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              فلاتر الفترة الزمنية
            </CardTitle>
            <Badge variant="outline" className="bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700">
              {getPeriodLabel()}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
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
                className={`flex items-center gap-1 transition-all duration-300 ${
                  filterPeriod === period.value 
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg hover:from-emerald-600 hover:to-teal-600' 
                    : 'bg-white dark:bg-gray-800 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:scale-105'
                }`}
              >
                <period.icon className="w-3 h-3" />
                {period.label}
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
      <Card className="overflow-hidden border border-border/50 bg-gradient-to-br from-card via-card to-muted/20 shadow-lg hover:shadow-xl transition-all duration-300 mt-8">
        <CardHeader className="pb-3 relative">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/90 to-primary flex items-center justify-center text-primary-foreground shadow-lg">
                <Calculator className="w-5 h-5" />
              </div>
              مركز السيطرة المالي
              <Badge variant={calculations.isProfit ? "default" : "secondary"} className="bg-background/80 text-foreground border">
                {calculations.isProfit ? "نشاط ربحي" : "تحت المراقبة"}
              </Badge>
            </CardTitle>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
                className="bg-background/50 hover:bg-background/80"
              >
                <Eye className="w-4 h-4 mr-1" />
                {showDetails ? 'إخفاء' : 'تفاصيل'}
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6 relative">
          {/* الحساب الأساسي */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <motion.div 
              className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-100 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-blue-900/30 rounded-xl border border-blue-200 dark:border-blue-800/50 shadow-md hover:shadow-xl transition-all duration-300"
              whileHover={{ 
                y: -4, 
                scale: 1.02,
                transition: { type: 'spring', stiffness: 300, damping: 20 } 
              }}
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-blue-600 dark:text-blue-300">رأس المال</span>
                   <motion.div 
                     className="w-8 h-8 rounded-lg flex items-center justify-center text-white bg-gradient-to-br from-blue-500 to-sky-500 shadow-sm"
                     whileHover={{ 
                       rotate: [0, -10, 10, 0], 
                       scale: 1.1,
                       transition: { duration: 0.4 } 
                     }}
                   >
                     <Wallet className="h-4 w-4" />
                   </motion.div>
                </div>
                <p className="text-lg font-bold text-blue-700 dark:text-blue-200">+{formatCurrency(capitalAmount)}</p>
              </div>
            </motion.div>
            
            <motion.div 
              className="relative overflow-hidden bg-gradient-to-br from-green-50 via-emerald-50 to-green-100 dark:from-green-950/30 dark:via-emerald-950/30 dark:to-green-900/30 rounded-xl border border-green-200 dark:border-green-800/50 shadow-md hover:shadow-xl transition-all duration-300"
              whileHover={{ 
                y: -4, 
                scale: 1.02,
                transition: { type: 'spring', stiffness: 300, damping: 20 } 
              }}
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-green-600 dark:text-green-300">أرباح المبيعات</span>
                   <motion.div 
                     className="w-8 h-8 rounded-lg flex items-center justify-center text-white bg-gradient-to-br from-green-500 to-emerald-500 shadow-sm"
                     whileHover={{ 
                       y: [0, -3, 0], 
                       scale: 1.1,
                       transition: { duration: 0.4 } 
                     }}
                   >
                     <TrendingUp className="h-4 w-4" />
                   </motion.div>
                </div>
                <p className="text-lg font-bold text-green-700 dark:text-green-200">+{formatCurrency(realizedProfits)}</p>
              </div>
            </motion.div>
            
            <motion.div 
              className="relative overflow-hidden bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 dark:from-orange-950/30 dark:via-amber-950/30 dark:to-orange-900/30 rounded-xl border border-orange-200 dark:border-orange-800/50 shadow-md hover:shadow-xl transition-all duration-300"
              whileHover={{ 
                y: -4, 
                scale: 1.02,
                transition: { type: 'spring', stiffness: 300, damping: 20 } 
              }}
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-orange-600 dark:text-orange-300">المشتريات</span>
                   <motion.div 
                     className="w-8 h-8 rounded-lg flex items-center justify-center text-white bg-gradient-to-br from-orange-500 to-amber-500 shadow-sm"
                     whileHover={{ 
                       rotate: [0, 10, -10, 0], 
                       scale: 1.1,
                       transition: { duration: 0.4 } 
                     }}
                   >
                     <Package className="h-4 w-4" />
                   </motion.div>
                </div>
                <p className="text-lg font-bold text-orange-700 dark:text-orange-200">-{formatCurrency(totalPurchases)}</p>
              </div>
            </motion.div>
            
            <motion.div 
              className="relative overflow-hidden bg-gradient-to-br from-red-50 via-rose-50 to-red-100 dark:from-red-950/30 dark:via-rose-950/30 dark:to-red-900/30 rounded-xl border border-red-200 dark:border-red-800/50 shadow-md hover:shadow-xl transition-all duration-300"
              whileHover={{ 
                y: -4, 
                scale: 1.02,
                transition: { type: 'spring', stiffness: 300, damping: 20 } 
              }}
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-red-600 dark:text-red-300">المصاريف</span>
                   <motion.div 
                     className="w-8 h-8 rounded-lg flex items-center justify-center text-white bg-gradient-to-br from-red-500 to-rose-500 shadow-sm"
                     whileHover={{ 
                       x: [0, -2, 2, 0], 
                       scale: 1.1,
                       transition: { duration: 0.4 } 
                     }}
                   >
                     <TrendingDown className="h-4 w-4" />
                   </motion.div>
                </div>
                <p className="text-lg font-bold text-red-700 dark:text-red-200">-{formatCurrency(totalExpenses)}</p>
              </div>
            </motion.div>
          </div>
          
          {/* النتيجة النهائية الاحترافية */}
          <div className="relative">
            <div className="p-6 rounded-xl border border-border bg-gradient-to-br from-card via-card to-muted/20 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                   <div className="p-4 rounded-xl bg-gradient-to-br from-primary/90 to-primary shadow-lg">
                     <DollarSign className="w-8 h-8 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">صافي الثروة الإجمالية</p>
                    <p className="text-3xl font-bold text-foreground">
                      {formatCurrency(calculations.netWorth)} د.ع
                    </p>
                    <p className="text-sm text-muted-foreground">
                      الربح الفعلي: {calculations.actualProfit >= 0 ? '+' : ''}{formatCurrency(calculations.actualProfit)} د.ع
                    </p>
                  </div>
                </div>
                
                <div className="text-right space-y-2">
                  <div className="px-4 py-2 rounded-lg bg-background/80 border">
                    <p className="text-xs font-medium text-muted-foreground">عائد الاستثمار</p>
                    <p className="text-lg font-bold text-foreground">{calculations.roi.toFixed(1)}%</p>
                  </div>
                  <div className="px-4 py-2 rounded-lg bg-background/80 border">
                    <p className="text-xs font-medium text-muted-foreground">الحالة المالية</p>
                    <p className="text-sm font-bold text-foreground">{calculations.isHealthy ? 'ممتازة' : 'تحتاج مراقبة'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* المؤشرات المالية المتقدمة */}
          {showDetails && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-xl border">
              <h4 className="font-bold text-gray-700 flex items-center gap-2">
                <Target className="w-4 h-4" />
                التحليل المالي المتقدم
              </h4>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-white rounded-lg border">
                  <p className="text-xs text-gray-500">نسبة السيولة</p>
                  <p className="text-lg font-bold text-blue-600">{calculations.liquidityRatio.toFixed(2)}</p>
                </div>
                <div className="text-center p-3 bg-white rounded-lg border">
                  <p className="text-xs text-gray-500">معدل دوران الأصول</p>
                  <p className="text-lg font-bold text-purple-600">{calculations.assetTurnover.toFixed(2)}</p>
                </div>
                <div className="text-center p-3 bg-white rounded-lg border">
                  <p className="text-xs text-gray-500">هامش التشغيل</p>
                  <p className="text-lg font-bold text-green-600">{calculations.operatingMargin.toFixed(1)}%</p>
                </div>
                <div className="text-center p-3 bg-white rounded-lg border">
                  <p className="text-xs text-gray-500">مستوى المخاطر</p>
                  <p className={`text-lg font-bold ${
                    calculations.riskLevel === 'منخفض' ? 'text-green-600' :
                    calculations.riskLevel === 'متوسط' ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {calculations.riskLevel}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* المؤشرات السريعة */}
          <div className="grid grid-cols-3 gap-3">
            <motion.div 
              className="text-center p-4 bg-gradient-to-br from-emerald-50 via-green-50 to-emerald-100 dark:from-emerald-950/30 dark:via-green-950/30 dark:to-emerald-900/30 rounded-lg border border-emerald-200 dark:border-emerald-800/50 shadow-md hover:shadow-lg transition-all duration-300"
              whileHover={{ scale: 1.05, y: -2 }}
            >
              <p className="text-xs text-emerald-600 dark:text-emerald-300 font-medium">هامش الربح</p>
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-200">{calculations.profitMargin.toFixed(1)}%</p>
            </motion.div>
            <motion.div 
              className="text-center p-4 bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 dark:from-orange-950/30 dark:via-amber-950/30 dark:to-orange-900/30 rounded-lg border border-orange-200 dark:border-orange-800/50 shadow-md hover:shadow-lg transition-all duration-300"
              whileHover={{ scale: 1.05, y: -2 }}
            >
              <p className="text-xs text-orange-600 dark:text-orange-300 font-medium">نسبة المشتريات</p>
              <p className="text-lg font-bold text-orange-700 dark:text-orange-200">{calculations.purchaseRatio.toFixed(1)}%</p>
            </motion.div>
            <motion.div 
              className="text-center p-4 bg-gradient-to-br from-red-50 via-rose-50 to-red-100 dark:from-red-950/30 dark:via-rose-950/30 dark:to-red-900/30 rounded-lg border border-red-200 dark:border-red-800/50 shadow-md hover:shadow-lg transition-all duration-300"
              whileHover={{ scale: 1.05, y: -2 }}
            >
              <p className="text-xs text-red-600 dark:text-red-300 font-medium">نسبة المصاريف</p>
              <p className="text-lg font-bold text-red-700 dark:text-red-200">{calculations.expenseRatio.toFixed(1)}%</p>
            </motion.div>
          </div>
          
          {/* تحذيرات ذكية */}
          <div className="space-y-2">
            {calculations.expenseRatio > 30 && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <p className="text-sm text-red-700">
                  <span className="font-bold">تحذير عالي:</span> نسبة المصاريف خطيرة ({calculations.expenseRatio.toFixed(1)}%)
                </p>
              </div>
            )}
            {calculations.expenseRatio > 20 && calculations.expenseRatio <= 30 && (
              <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                <p className="text-sm text-yellow-700">
                  <span className="font-bold">تنبيه:</span> نسبة المصاريف مرتفعة ({calculations.expenseRatio.toFixed(1)}%)
                </p>
              </div>
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