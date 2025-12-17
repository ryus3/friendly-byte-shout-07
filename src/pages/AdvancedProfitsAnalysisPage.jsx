import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Filter, 
  Target,
  Palette,
  Ruler,
  Package,
  CalendarDays,
  Activity,
  ChevronDown,
  Users
} from 'lucide-react';
import { useAdvancedProfitsAnalysis } from '@/hooks/useAdvancedProfitsAnalysis';
import { motion } from 'framer-motion';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays } from 'date-fns';

/**
 * صفحة تحليل الأرباح المتقدمة v2.0
 * تحليل شامل لكل النظام مع دعم فلتر الموظف والتحميل الفوري
 */
const AdvancedProfitsAnalysisPage = () => {
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });
  
  const [filters, setFilters] = useState(() => {
    const savedFilters = localStorage.getItem('profitsAnalysisFilters');
    const defaultFilters = {
      period: 'all',
      department: 'all',
      category: 'all',
      productType: 'all',
      season: 'all',
      color: 'all',
      size: 'all',
      product: 'all',
      employee: 'all' // ⭐ فلتر الموظف الجديد
    };
    
    return savedFilters ? { ...defaultFilters, ...JSON.parse(savedFilters) } : defaultFilters;
  });

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  useEffect(() => {
    localStorage.setItem('profitsAnalysisFilters', JSON.stringify(filters));
  }, [filters]);

  const { 
    analysisData, 
    loading, 
    error, 
    departments,
    categories,
    productTypes,
    seasons,
    colors,
    sizes,
    products,
    employees
  } = useAdvancedProfitsAnalysis(dateRange, filters);

  const handlePeriodChange = (period) => {
    const now = new Date();
    let from, to;

    switch (period) {
      case 'all':
        from = null;
        to = null;
        break;
      case 'today':
        from = startOfDay(now);
        to = endOfDay(now);
        break;
      case 'week':
        from = subDays(now, 7);
        to = now;
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
      default:
        return;
    }

    if (from && to) {
      setDateRange({ from, to });
    }
    setFilters(prev => ({ ...prev, period }));
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ar-IQ', {
      style: 'decimal',
      minimumFractionDigits: 0
    }).format(Math.abs(amount || 0));
  };

  const summaryCards = useMemo(() => [
    {
      title: 'ربح النظام',
      value: analysisData?.totalProfit || 0,
      icon: TrendingUp,
      color: 'from-emerald-600 to-teal-600',
      description: 'أرباح النظام الإجمالية'
    },
    {
      title: 'ربح الموظفين',
      value: analysisData?.totalEmployeeProfit || 0,
      icon: Users,
      color: 'from-cyan-600 to-blue-600',
      description: 'أرباح الموظفين الإجمالية'
    },
    {
      title: 'عدد الطلبات',
      value: analysisData?.totalOrders || 0,
      icon: Package,
      color: 'from-blue-600 to-indigo-600',
      description: 'إجمالي الطلبات المسلمة'
    },
    {
      title: 'هامش الربح',
      value: `${(analysisData?.profitMargin || 0).toFixed(1)}%`,
      icon: Activity,
      color: 'from-orange-600 to-amber-600',
      description: 'هامش الربح الإجمالي'
    }
  ], [analysisData]);

  // ⚡ شرط تحميل ذكي - لا ينتظر إذا كانت البيانات موجودة
  if (loading && !analysisData) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">جاري تحليل الأرباح...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-destructive">
          <CardContent className="p-6">
            <p className="text-destructive">خطأ في تحميل البيانات: {error}</p>
            <Button onClick={() => window.location.reload()} className="mt-4">إعادة المحاولة</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* العنوان والأدوات */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-3xl font-bold gradient-text">
            تحليل أرباح المنتجات
          </h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            تحليل شامل لأرباح كل النظام مقسم حسب الأقسام والمنتجات والموظفين
          </p>
        </div>
        
      </div>

      {/* فلاتر عالمية */}
      <Card className="shadow-lg border-primary/10">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* فلتر الفترة الزمنية */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium text-foreground">الفترة:</span>
              </div>
              <Select value={filters.period} onValueChange={handlePeriodChange}>
                <SelectTrigger className="w-36 h-9 border-primary/20 bg-background/80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الفترات</SelectItem>
                  <SelectItem value="today">اليوم</SelectItem>
                  <SelectItem value="week">أسبوع</SelectItem>
                  <SelectItem value="month">شهر</SelectItem>
                  <SelectItem value="year">سنة</SelectItem>
                  <SelectItem value="last30">آخر 30 يوم</SelectItem>
                  <SelectItem value="last90">آخر 90 يوم</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ⭐ فلتر الموظف الجديد */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium text-foreground">الموظف:</span>
              </div>
              <Select 
                value={filters.employee} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, employee: value }))}
              >
                <SelectTrigger className="w-40 h-9 border-primary/20 bg-background/80">
                  <SelectValue placeholder="كل الموظفين" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الموظفين</SelectItem>
                  {employees?.map((emp) => (
                    <SelectItem key={emp.user_id} value={emp.user_id}>
                      {emp.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* زر الفلاتر المتقدمة */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="flex items-center gap-2 border-primary/20 hover:bg-primary/5"
            >
              <Filter className="w-4 h-4" />
              فلاتر متقدمة
              <ChevronDown className={cn("w-4 h-4 transition-transform", showAdvancedFilters && "rotate-180")} />
            </Button>
          </div>

          {/* الفلاتر المتقدمة */}
          {showAdvancedFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 pt-4 border-t border-border/50"
            >
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* القسم */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">القسم</label>
                  <Select 
                    value={filters.department} 
                    onValueChange={(value) => setFilters(prev => ({ ...prev, department: value }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="القسم" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الأقسام</SelectItem>
                      {departments?.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* التصنيف */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">التصنيف</label>
                  <Select 
                    value={filters.category} 
                    onValueChange={(value) => setFilters(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="التصنيف" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل التصنيفات</SelectItem>
                      {categories?.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* نوع المنتج */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">النوع</label>
                  <Select 
                    value={filters.productType} 
                    onValueChange={(value) => setFilters(prev => ({ ...prev, productType: value }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="النوع" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الأنواع</SelectItem>
                      {productTypes?.map((type) => (
                        <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* الموسم */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">الموسم</label>
                  <Select 
                    value={filters.season} 
                    onValueChange={(value) => setFilters(prev => ({ ...prev, season: value }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="الموسم" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل المواسم</SelectItem>
                      {seasons?.map((season) => (
                        <SelectItem key={season.id} value={season.id}>{season.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* اللون */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">اللون</label>
                  <Select 
                    value={filters.color} 
                    onValueChange={(value) => setFilters(prev => ({ ...prev, color: value }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="اللون" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الألوان</SelectItem>
                      {colors?.map((color) => (
                        <SelectItem key={color.id} value={color.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full border" 
                              style={{ backgroundColor: color.hex_code }}
                            />
                            {color.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* القياس */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">القياس</label>
                  <Select 
                    value={filters.size} 
                    onValueChange={(value) => setFilters(prev => ({ ...prev, size: value }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="القياس" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل القياسات</SelectItem>
                      {sizes?.map((size) => (
                        <SelectItem key={size.id} value={size.id}>{size.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* زر إعادة التعيين */}
              <div className="flex justify-center mt-4">
                <Button 
                  onClick={() => setFilters({
                    period: 'all',
                    department: 'all',
                    category: 'all',
                    productType: 'all',
                    season: 'all',
                    color: 'all',
                    size: 'all',
                    product: 'all',
                    employee: 'all'
                  })}
                  variant="outline"
                  size="sm"
                  className="px-6"
                >
                  إعادة تعيين
                </Button>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>


      {/* بطاقات الملخص */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg gradient-text">
            <TrendingUp className="w-5 h-5 text-primary" />
            تحليل أرباح المنتجات
            {filters.employee !== 'all' && (
              <Badge variant="secondary" className="mr-2">
                موظف محدد
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* الصف الأول: ربح النظام + ربح الموظفين */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            {summaryCards.slice(0, 2).map((card, index) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className={cn(
                  "overflow-hidden transition-all duration-300 border-0 group cursor-pointer",
                  "shadow-lg shadow-black/10 dark:shadow-lg dark:shadow-primary/20",
                  `bg-gradient-to-br ${card.color} text-white`,
                  "hover:shadow-xl hover:scale-[1.02]"
                )}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-white/20 rounded-lg group-hover:scale-110 transition-transform">
                        <card.icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white/80 font-medium truncate">{card.title}</p>
                        <p className="text-sm font-bold text-white truncate">
                          {typeof card.value === 'number' ? formatCurrency(card.value) : card.value}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* الصف الثاني: عدد الطلبات + هامش الربح */}
          <div className="grid grid-cols-2 gap-3">
            {summaryCards.slice(2, 4).map((card, index) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (index + 2) * 0.1 }}
              >
                <Card className={cn(
                  "overflow-hidden transition-all duration-300 border-0 group cursor-pointer",
                  "shadow-lg shadow-black/10 dark:shadow-lg dark:shadow-primary/20",
                  `bg-gradient-to-br ${card.color} text-white`,
                  "hover:shadow-xl hover:scale-[1.02]"
                )}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-white/20 rounded-lg group-hover:scale-110 transition-transform">
                        <card.icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white/80 font-medium truncate">{card.title}</p>
                        <p className="text-sm font-bold text-white truncate">
                          {typeof card.value === 'number' ? formatCurrency(card.value) : card.value}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* محتوى التحليل الرئيسي */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* الأرباح حسب الأقسام */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              الأرباح حسب الأقسام
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysisData?.departmentBreakdown?.length > 0 ? (
                analysisData.departmentBreakdown.map((dept, index) => (
                  <motion.div
                    key={dept.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-3 h-3 rounded-full",
                        `bg-gradient-to-br ${dept.color || 'from-blue-500 to-blue-600'}`
                      )} />
                      <div>
                        <p className="font-medium">{dept.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {dept.orderCount} طلب
                        </p>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-emerald-600">
                        +{formatCurrency(dept.profit)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {analysisData.totalProfit > 0 ? ((dept.profit / analysisData.totalProfit) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                  </motion.div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-4">لا توجد بيانات</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* الأرباح حسب المنتجات */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="w-5 h-5" />
              أفضل المنتجات ربحاً
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysisData?.topProducts?.length > 0 ? (
                analysisData.topProducts.slice(0, 5).map((product, index) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                  >
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {product.salesCount} مبيعة
                      </p>
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-emerald-600">
                        +{formatCurrency(product.profit)}
                      </p>
                      <Badge variant="secondary" className="text-xs">
                        #{index + 1}
                      </Badge>
                    </div>
                  </motion.div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-4">لا توجد بيانات</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* تحليلات إضافية */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* الأرباح حسب الألوان */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Palette className="w-4 h-4" />
              الأرباح حسب الألوان
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analysisData?.colorBreakdown?.length > 0 ? (
                analysisData.colorBreakdown.slice(0, 5).map((color) => (
                  <div key={color.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full border" 
                        style={{ backgroundColor: color.hex_code }}
                      />
                      <span>{color.name}</span>
                    </div>
                    <span className="font-medium text-emerald-600">
                      +{formatCurrency(color.profit)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-2 text-xs">لا توجد بيانات</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* الأرباح حسب القياسات */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Ruler className="w-4 h-4" />
              الأرباح حسب القياسات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analysisData?.sizeBreakdown?.length > 0 ? (
                analysisData.sizeBreakdown.slice(0, 5).map((size) => (
                  <div key={size.id} className="flex items-center justify-between text-sm">
                    <span>{size.name}</span>
                    <span className="font-medium text-emerald-600">
                      +{formatCurrency(size.profit)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-2 text-xs">لا توجد بيانات</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* الأرباح حسب المواسم */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <CalendarDays className="w-4 h-4" />
              الأرباح حسب المواسم
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analysisData?.seasonBreakdown?.length > 0 ? (
                analysisData.seasonBreakdown.map((season) => (
                  <div key={season.id} className="flex items-center justify-between text-sm">
                    <span>{season.name}</span>
                    <span className="font-medium text-emerald-600">
                      +{formatCurrency(season.profit)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-2 text-xs">لا توجد بيانات</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdvancedProfitsAnalysisPage;
