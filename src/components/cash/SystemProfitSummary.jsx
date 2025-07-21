import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
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
      <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="w-5 h-5 text-blue-600" />
              فلاتر الفترة الزمنية
            </CardTitle>
            <Badge variant="outline" className="bg-white/80">
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
                className={`flex items-center gap-1 ${
                  filterPeriod === period.value ? 'bg-blue-600 text-white' : 'hover:bg-blue-50'
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
      <Card className={`border-2 transition-all duration-300 ${calculations.isProfit ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50' : 'border-orange-200 bg-gradient-to-br from-orange-50 to-red-50'}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className={`p-2 rounded-lg ${calculations.isProfit ? 'bg-emerald-100' : 'bg-orange-100'}`}>
                <Calculator className={`w-6 h-6 ${calculations.isProfit ? 'text-emerald-600' : 'text-orange-600'}`} />
              </div>
              مركز السيطرة المالي العالمي
              <Badge variant={calculations.isProfit ? "default" : "destructive"} className="text-sm">
                {calculations.isProfit ? "نشاط ربحي" : "تحت المراقبة"}
              </Badge>
            </CardTitle>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
                className="bg-white/80"
              >
                <Eye className="w-4 h-4 mr-1" />
                {showDetails ? 'إخفاء' : 'تفاصيل'}
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* الحساب الأساسي */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
              <div className="p-3 bg-blue-500 rounded-lg">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-blue-600 font-medium">رأس المال</p>
                <p className="text-lg font-bold text-blue-700">+{formatCurrency(capitalAmount)}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl border border-emerald-200">
              <div className="p-3 bg-emerald-500 rounded-lg">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-emerald-600 font-medium">أرباح المبيعات</p>
                <p className="text-lg font-bold text-emerald-700">+{formatCurrency(realizedProfits)}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border border-orange-200">
              <div className="p-3 bg-orange-500 rounded-lg">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-orange-600 font-medium">المشتريات</p>
                <p className="text-lg font-bold text-orange-700">-{formatCurrency(totalPurchases)}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-red-50 to-red-100 rounded-xl border border-red-200">
              <div className="p-3 bg-red-500 rounded-lg">
                <TrendingDown className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-red-600 font-medium">المصاريف</p>
                <p className="text-lg font-bold text-red-700">-{formatCurrency(totalExpenses)}</p>
              </div>
            </div>
          </div>
          
          {/* النتيجة النهائية الاحترافية */}
          <div className="relative">
            <div className={`p-6 rounded-2xl border-2 bg-gradient-to-br ${
              calculations.isProfit 
                ? 'from-emerald-100 via-green-50 to-emerald-100 border-emerald-300' 
                : 'from-orange-100 via-red-50 to-orange-100 border-orange-300'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-4 rounded-xl ${
                    calculations.isProfit ? 'bg-emerald-500' : 'bg-orange-500'
                  }`}>
                    <DollarSign className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-medium">صافي الثروة الإجمالية</p>
                    <p className={`text-3xl font-bold ${
                      calculations.isProfit ? 'text-emerald-700' : 'text-orange-700'
                    }`}>
                      {formatCurrency(calculations.netWorth)} د.ع
                    </p>
                    <p className="text-sm text-gray-500">
                      الربح الفعلي: {calculations.actualProfit >= 0 ? '+' : ''}{formatCurrency(calculations.actualProfit)} د.ع
                    </p>
                  </div>
                </div>
                
                <div className="text-right space-y-2">
                  <div className={`px-4 py-2 rounded-lg ${
                    calculations.roi > 10 ? 'bg-green-100 text-green-700' :
                    calculations.roi > 0 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    <p className="text-xs font-medium">عائد الاستثمار</p>
                    <p className="text-lg font-bold">{calculations.roi.toFixed(1)}%</p>
                  </div>
                  <div className={`px-4 py-2 rounded-lg ${
                    calculations.isHealthy ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                  }`}>
                    <p className="text-xs font-medium">الحالة المالية</p>
                    <p className="text-sm font-bold">{calculations.isHealthy ? 'ممتازة' : 'تحتاج مراقبة'}</p>
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
            <div className="text-center p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <p className="text-xs text-emerald-600 font-medium">هامش الربح</p>
              <p className="text-lg font-bold text-emerald-700">{calculations.profitMargin.toFixed(1)}%</p>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg border border-orange-200">
              <p className="text-xs text-orange-600 font-medium">نسبة المشتريات</p>
              <p className="text-lg font-bold text-orange-700">{calculations.purchaseRatio.toFixed(1)}%</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
              <p className="text-xs text-red-600 font-medium">نسبة المصاريف</p>
              <p className="text-lg font-bold text-red-700">{calculations.expenseRatio.toFixed(1)}%</p>
            </div>
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