import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Filter, 
  Download,
  Eye,
  Target,
  Layers,
  Palette,
  Ruler,
  Package,
  CalendarDays,
  Activity
} from 'lucide-react';
import { useAdvancedProfitsAnalysis } from '@/hooks/useAdvancedProfitsAnalysis';
import { motion } from 'framer-motion';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays } from 'date-fns';
import { PDFDownloadLink } from '@react-pdf/renderer';
import ProfitsAnalysisPDF from '@/components/pdf/ProfitsAnalysisPDF';


/**
 * صفحة تحليل الأرباح المتقدمة
 * تعرض تحليلاً شاملاً للأرباح مقسم حسب الأقسام والتصنيفات والمنتجات
 */
const AdvancedProfitsAnalysisPage = () => {
  // حالة الفلاتر - تحديث القيم الافتراضية لتشمل "كل الفترات"
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });
  
  const [filters, setFilters] = useState(() => {
    // تحميل آخر اختيار محفوظ أو استخدام القيم الافتراضية
    const savedFilters = localStorage.getItem('profitsAnalysisFilters');
    const defaultFilters = {
      period: 'all', // تغيير الافتراضي إلى "كل الفترات"
      department: 'all',
      category: 'all',
      productType: 'all',
      season: 'all',
      color: 'all',
      size: 'all',
      product: 'all'
    };
    
    return savedFilters ? { ...defaultFilters, ...JSON.parse(savedFilters) } : defaultFilters;
  });

  const [viewMode, setViewMode] = useState('overview'); // overview, detailed, charts

  // حفظ الفلاتر تلقائياً عند التغيير
  useEffect(() => {
    localStorage.setItem('profitsAnalysisFilters', JSON.stringify(filters));
  }, [filters]);

  // جلب البيانات
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
    refreshData 
  } = useAdvancedProfitsAnalysis(dateRange, filters);

  // تحديث الفترة الزمنية
  const handlePeriodChange = (period) => {
    const now = new Date();
    let from, to;

    switch (period) {
      case 'all':
        // لا تحديد أي فترة زمنية محددة، دع النظام يظهر كل البيانات
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

  // بيانات الملخص السريع
  const summaryCards = useMemo(() => [
    {
      title: 'إجمالي الأرباح',
      value: analysisData?.totalProfit || 0,
      icon: TrendingUp,
      color: 'from-emerald-600 to-teal-600',
      description: 'الأرباح الإجمالية للفترة المختارة'
    },
    {
      title: 'عدد الطلبات',
      value: analysisData?.totalOrders || 0,
      icon: Package,
      color: 'from-blue-600 to-indigo-600',
      description: 'إجمالي الطلبات المباعة'
    },
    {
      title: 'متوسط الربح',
      value: analysisData?.averageProfit || 0,
      icon: Target,
      color: 'from-purple-600 to-pink-600',
      description: 'متوسط الربح لكل طلب'
    },
    {
      title: 'هامش الربح',
      value: `${(analysisData?.profitMargin || 0).toFixed(1)}%`,
      icon: Activity,
      color: 'from-orange-600 to-amber-600',
      description: 'هامش الربح الإجمالي'
    }
  ], [analysisData]);

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
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
            <Button onClick={refreshData} className="mt-4">إعادة المحاولة</Button>
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
            تحليل شامل للأرباح مقسم حسب الأقسام والمنتجات والفترات الزمنية
          </p>
        </div>
        
        <div className="flex gap-2">
          <PDFDownloadLink
            document={<ProfitsAnalysisPDF analysisData={analysisData} dateRange={dateRange} filters={filters} />}
            fileName={`تحليل-الأرباح-${new Date().toLocaleDateString('ar-EG')}.pdf`}
          >
            {({ loading }) => (
              <Button variant="outline" size="sm" disabled={loading}>
                <Download className="w-4 h-4 ml-1" />
                {loading ? 'جاري التجهيز...' : 'تصدير PDF'}
              </Button>
            )}
          </PDFDownloadLink>
          
          <Button 
            variant={viewMode === 'overview' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setViewMode('overview')}
          >
            <Eye className="w-4 h-4 ml-1" />
            نظرة عامة
          </Button>
        </div>
      </div>

      {/* فلاتر مدمجة للهاتف */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* فلتر الفترة الزمنية */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="w-4 h-4" />
              الفترة الزمنية
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={filters.period} onValueChange={handlePeriodChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="اختر الفترة" />
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
            
            <DateRangePicker
              date={dateRange}
              onDateChange={setDateRange}
              className="w-full"
            />
          </CardContent>
        </Card>

        {/* فلاتر المنتجات */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="w-4 h-4" />
              فلاتر التحليل
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Select 
                value={filters.department} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, department: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="القسم" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الأقسام</SelectItem>
                  {departments?.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select 
                value={filters.category} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="التصنيف" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل التصنيفات</SelectItem>
                  {categories?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select 
                value={filters.productType} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, productType: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="نوع المنتج" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الأنواع</SelectItem>
                  {productTypes?.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select 
                value={filters.season} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, season: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="الموسم" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل المواسم</SelectItem>
                  {seasons?.map((season) => (
                    <SelectItem key={season.id} value={season.id}>
                      {season.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select 
                value={filters.color} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, color: value }))}
              >
                <SelectTrigger>
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

              <Select 
                value={filters.size} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, size: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="القياس" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل القياسات</SelectItem>
                  {sizes?.map((size) => (
                    <SelectItem key={size.id} value={size.id}>
                      {size.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={() => setFilters({
                period: 'all', // تغيير الافتراضي إلى "كل الفترات"
                department: 'all',
                category: 'all',
                productType: 'all',
                season: 'all',
                color: 'all',
                size: 'all',
                product: 'all'
              })}
              variant="outline"
              size="sm"
              className="w-full"
            >
              إعادة تعيين الفلاتر
            </Button>
          </CardContent>
        </Card>
      </div>


      {/* بطاقات الملخص - كارت خارجي */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg gradient-text">
            <TrendingUp className="w-5 h-5 text-primary" />
            تحليل أرباح المنتجات
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* الصف الأول: إجمالي الأرباح + عدد الطلبات */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0 }}
            >
              <Card className={cn(
                "overflow-hidden transition-all duration-300 border-0 group cursor-pointer",
                "shadow-lg shadow-black/10 dark:shadow-lg dark:shadow-primary/20",
                `bg-gradient-to-br ${summaryCards[0].color} text-white`,
                "hover:shadow-xl hover:scale-[1.02]"
              )}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-white/20 rounded-lg group-hover:scale-110 transition-transform">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white/80 font-medium truncate">إجمالي الأرباح</p>
                      <p className="text-sm font-bold text-white truncate">
                        {formatCurrency(analysisData?.totalProfit || 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className={cn(
                "overflow-hidden transition-all duration-300 border-0 group cursor-pointer",
                "shadow-lg shadow-black/10 dark:shadow-lg dark:shadow-primary/20",
                `bg-gradient-to-br ${summaryCards[1].color} text-white`,
                "hover:shadow-xl hover:scale-[1.02]"
              )}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-white/20 rounded-lg group-hover:scale-110 transition-transform">
                      <Package className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white/80 font-medium truncate">عدد الطلبات</p>
                      <p className="text-sm font-bold text-white truncate">
                        {formatCurrency(analysisData?.totalOrders || 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* الصف الثاني: متوسط الربح + هامش الربح */}
          <div className="grid grid-cols-2 gap-3">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className={cn(
                "overflow-hidden transition-all duration-300 border-0 group cursor-pointer",
                "shadow-lg shadow-black/10 dark:shadow-lg dark:shadow-primary/20",
                `bg-gradient-to-br ${summaryCards[2].color} text-white`,
                "hover:shadow-xl hover:scale-[1.02]"
              )}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-white/20 rounded-lg group-hover:scale-110 transition-transform">
                      <Target className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white/80 font-medium truncate">متوسط الربح</p>
                      <p className="text-sm font-bold text-white truncate">
                        {formatCurrency(analysisData?.averageProfit || 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className={cn(
                "overflow-hidden transition-all duration-300 border-0 group cursor-pointer",
                "shadow-lg shadow-black/10 dark:shadow-lg dark:shadow-primary/20",
                `bg-gradient-to-br ${summaryCards[3].color} text-white`,
                "hover:shadow-xl hover:scale-[1.02]"
              )}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-white/20 rounded-lg group-hover:scale-110 transition-transform">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white/80 font-medium truncate">هامش الربح</p>
                      <p className="text-sm font-bold text-white truncate">
                        {`${(analysisData?.profitMargin || 0).toFixed(1)}%`}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
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
              {analysisData?.departmentBreakdown?.map((dept, index) => (
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
                      {((dept.profit / analysisData.totalProfit) * 100).toFixed(1)}%
                    </p>
                  </div>
                </motion.div>
              ))}
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
              {analysisData?.topProducts?.slice(0, 5).map((product, index) => (
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
              ))}
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
              {analysisData?.colorBreakdown?.slice(0, 5).map((color) => (
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
              ))}
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
              {analysisData?.sizeBreakdown?.slice(0, 5).map((size) => (
                <div key={size.id} className="flex items-center justify-between text-sm">
                  <span>{size.name}</span>
                  <span className="font-medium text-emerald-600">
                    +{formatCurrency(size.profit)}
                  </span>
                </div>
              ))}
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
              {analysisData?.seasonBreakdown?.map((season) => (
                <div key={season.id} className="flex items-center justify-between text-sm">
                  <span>{season.name}</span>
                  <span className="font-medium text-emerald-600">
                    +{formatCurrency(season.profit)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdvancedProfitsAnalysisPage;