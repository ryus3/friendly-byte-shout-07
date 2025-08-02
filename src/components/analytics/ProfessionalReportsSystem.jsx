import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  TrendingDown,
  Download, 
  FileText, 
  Calendar as CalendarIcon,
  Filter,
  Package,
  DollarSign,
  Users,
  ShoppingCart,
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
  Target,
  Eye,
  Settings,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  BookOpen,
  PlusCircle,
  MinusCircle,
  BarChart2,
  Zap,
  Star
} from 'lucide-react';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, isWithinInterval } from 'date-fns';
import { ar } from 'date-fns/locale';
import { PDFDownloadLink } from '@react-pdf/renderer';
import InventoryReportPDF from '@/components/pdf/InventoryReportPDF';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, BarChart, Bar, PieChart as RechartsPieChart, Legend } from 'recharts';
import { cn } from '@/lib/utils';

const ProfessionalReportsSystem = () => {
  const { products, orders, loading, expenses } = useInventory();
  const { allUsers } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [filters, setFilters] = useState({
    department: 'all',
    category: 'all',
    stockLevel: 'all',
    employee: 'all',
    timeframe: 'month'
  });
  const [selectedMetrics, setSelectedMetrics] = useState([
    'revenue', 'profit', 'orders', 'products', 'lowStock'
  ]);

  // دوال مساعدة متقدمة - يجب تعريفها قبل استخدامها في useMemo
  const generateTrendsData = (orders, range) => {
    const days = [];
    const current = new Date(range.from);
    while (current <= range.to) {
      const dayOrders = orders.filter(o => {
        const orderDate = new Date(o.created_at);
        return orderDate.toDateString() === current.toDateString();
      });
      
      days.push({
        date: format(current, 'dd/MM', { locale: ar }),
        fullDate: current.toISOString().split('T')[0],
        orders: dayOrders.length,
        revenue: dayOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0),
        profit: dayOrders.reduce((sum, o) => sum + (o.profit_amount || 0), 0),
        completed: dayOrders.filter(o => o.status === 'completed').length,
        pending: dayOrders.filter(o => o.status === 'pending').length
      });
      
      current.setDate(current.getDate() + 1);
    }
    return days;
  };

  const getCategoryAnalysis = (products) => {
    const categories = {};
    products.forEach(p => {
      const category = p.categories?.main_category || 'غير محدد';
      if (!categories[category]) {
        categories[category] = { 
          products: 0, 
          stock: 0, 
          value: 0, 
          lowStock: 0,
          avgPrice: 0,
          totalSales: 0
        };
      }
      categories[category].products++;
      const stockCount = p.variants?.reduce((sum, v) => sum + (v.quantity || 0), 0) || 0;
      categories[category].stock += stockCount;
      categories[category].value += p.variants?.reduce((sum, v) => sum + ((v.quantity || 0) * (v.cost_price || 0)), 0) || 0;
      if (stockCount <= 5) categories[category].lowStock++;
    });
    
    return Object.entries(categories).map(([name, data]) => ({
      name,
      ...data,
      avgPrice: data.products > 0 ? data.value / data.products : 0,
      stockPercentage: (data.stock / Math.max(1, Object.values(categories).reduce((sum, cat) => sum + cat.stock, 0))) * 100
    }));
  };

  const getEmployeePerformance = (orders, users) => {
    const performance = {};
    orders.forEach(order => {
      const employeeId = order.created_by;
      if (!performance[employeeId]) {
        const user = users?.find(u => u.id === employeeId);
        performance[employeeId] = {
          name: user?.full_name || 'غير معروف',
          orders: 0,
          revenue: 0,
          profit: 0,
          completionRate: 0,
          avgOrderValue: 0
        };
      }
      performance[employeeId].orders++;
      if (order.status === 'completed') {
        performance[employeeId].revenue += order.total_amount || 0;
        performance[employeeId].profit += order.profit_amount || 0;
      }
    });
    
    return Object.values(performance).map(emp => ({
      ...emp,
      avgOrderValue: emp.orders > 0 ? emp.revenue / emp.orders : 0,
      completionRate: emp.orders > 0 ? ((emp.revenue > 0 ? 1 : 0) / emp.orders) * 100 : 0
    }));
  };

  const getStockAnalysis = (products) => {
    const analysis = {
      critical: products.filter(p => p.variants?.every(v => (v.quantity || 0) === 0)).length,
      low: products.filter(p => p.variants?.some(v => (v.quantity || 0) > 0 && (v.quantity || 0) <= 5)).length,
      medium: products.filter(p => p.variants?.some(v => (v.quantity || 0) > 5 && (v.quantity || 0) <= 20)).length,
      high: products.filter(p => p.variants?.some(v => (v.quantity || 0) > 20)).length,
      fastMoving: [],
      slowMoving: [],
      deadStock: []
    };
    
    return analysis;
  };

  const getProfitabilityAnalysis = (products, orders) => {
    const analysis = {
      highMargin: products.filter(p => {
        const avgMargin = p.variants?.reduce((sum, v) => {
          const margin = v.price && v.cost_price ? ((v.price - v.cost_price) / v.price) * 100 : 0;
          return sum + margin;
        }, 0) / (p.variants?.length || 1);
        return avgMargin > 50;
      }).length,
      mediumMargin: products.filter(p => {
        const avgMargin = p.variants?.reduce((sum, v) => {
          const margin = v.price && v.cost_price ? ((v.price - v.cost_price) / v.price) * 100 : 0;
          return sum + margin;
        }, 0) / (p.variants?.length || 1);
        return avgMargin >= 30 && avgMargin <= 50;
      }).length,
      lowMargin: products.filter(p => {
        const avgMargin = p.variants?.reduce((sum, v) => {
          const margin = v.price && v.cost_price ? ((v.price - v.cost_price) / v.price) * 100 : 0;
          return sum + margin;
        }, 0) / (p.variants?.length || 1);
        return avgMargin < 30;
      }).length
    };
    
    return analysis;
  };

  // البيانات المحسوبة والمعقدة
  const analyticsData = useMemo(() => {
    if (!products || !orders) return null;

    const filteredProducts = products.filter(product => {
      if (filters.department !== 'all' && product.department !== filters.department) return false;
      if (filters.category !== 'all' && product.category !== filters.category) return false;
      return true;
    });

    const filteredOrders = orders.filter(order => {
      const orderDate = new Date(order.created_at);
      return isWithinInterval(orderDate, { start: dateRange.from, end: dateRange.to });
    });

    // إحصائيات متقدمة للمخزون
    const inventoryStats = {
      totalProducts: filteredProducts.length,
      totalVariants: filteredProducts.reduce((sum, p) => sum + (p.variants?.length || 0), 0),
      totalStock: filteredProducts.reduce((sum, p) => 
        sum + (p.variants?.reduce((vSum, v) => vSum + (v.quantity || 0), 0) || 0), 0
      ),
      lowStockCount: filteredProducts.filter(p => 
        p.variants?.some(v => (v.quantity || 0) > 0 && (v.quantity || 0) <= 5)
      ).length,
      outOfStockCount: filteredProducts.filter(p => 
        p.variants?.every(v => (v.quantity || 0) === 0)
      ).length,
      totalValue: filteredProducts.reduce((sum, p) => 
        sum + (p.variants?.reduce((vSum, v) => vSum + ((v.quantity || 0) * (v.cost_price || 0)), 0) || 0), 0
      ),
      averageStockLevel: 0,
      stockTurnoverRate: 0
    };

    // إحصائيات متقدمة للمبيعات
    const salesStats = {
      totalOrders: filteredOrders.length,
      completedOrders: filteredOrders.filter(o => o.status === 'completed').length,
      pendingOrders: filteredOrders.filter(o => o.status === 'pending').length,
      cancelledOrders: filteredOrders.filter(o => o.status === 'cancelled').length,
      totalRevenue: filteredOrders
        .filter(o => o.status === 'completed')
        .reduce((sum, o) => sum + (o.total_amount || 0), 0),
      totalProfit: filteredOrders
        .filter(o => o.status === 'completed')
        .reduce((sum, o) => sum + (o.profit_amount || 0), 0),
      averageOrderValue: 0,
      conversionRate: 0
    };

    // حساب المعدلات
    salesStats.averageOrderValue = salesStats.completedOrders > 0 
      ? salesStats.totalRevenue / salesStats.completedOrders 
      : 0;
    
    salesStats.conversionRate = salesStats.totalOrders > 0 
      ? (salesStats.completedOrders / salesStats.totalOrders) * 100 
      : 0;

    inventoryStats.averageStockLevel = inventoryStats.totalProducts > 0 
      ? inventoryStats.totalStock / inventoryStats.totalProducts 
      : 0;

    // تحليل الاتجاهات
    const trendsData = generateTrendsData(filteredOrders, dateRange);
    const categoryAnalysis = getCategoryAnalysis(filteredProducts);
    const employeePerformance = getEmployeePerformance(filteredOrders, allUsers);
    const stockAnalysis = getStockAnalysis(filteredProducts);
    const profitabilityAnalysis = getProfitabilityAnalysis(filteredProducts, filteredOrders);

    return {
      inventory: inventoryStats,
      sales: salesStats,
      trends: trendsData,
      categories: categoryAnalysis,
      employees: employeePerformance,
      stock: stockAnalysis,
      profitability: profitabilityAnalysis
    };
  }, [products, orders, dateRange, filters, allUsers]);


  const handleDateRangeChange = (range) => {
    setDateRange(range);
    setShowDatePicker(false);
  };

  const handleExportData = (format) => {
    if (format === 'json') {
      const dataStr = JSON.stringify(analyticsData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `تقرير_شامل_احترافي_${format(new Date(), 'yyyy-MM-dd')}.json`;
      link.click();
    }
  };

  const quickDateRanges = [
    { label: 'اليوم', range: { from: new Date(), to: new Date() } },
    { label: 'آخر 7 أيام', range: { from: subDays(new Date(), 7), to: new Date() } },
    { label: 'هذا الشهر', range: { from: startOfMonth(new Date()), to: endOfMonth(new Date()) } },
    { label: 'هذا العام', range: { from: startOfYear(new Date()), to: endOfYear(new Date()) } }
  ];

  if (loading || !analyticsData) {
    return (
      <div className="flex justify-center items-center h-64 space-y-4">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-lg font-medium">جاري تحليل البيانات...</p>
          <p className="text-sm text-muted-foreground">يتم إعداد التقارير الاحترافية</p>
        </div>
      </div>
    );
  }

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#f97316'];

  return (
    <div className="space-y-6 p-6">
      {/* Header احترافي */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4"
      >
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                لوحة التحليلات الاحترافية
              </h1>
              <p className="text-muted-foreground">تحليل شامل ومتقدم لأداء النشاط التجاري</p>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => handleExportData('json')} variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            تصدير JSON
          </Button>
          <PDFDownloadLink
            document={<InventoryReportPDF products={products} settings={{ lowStockThreshold: 5 }} />}
            fileName={`تقرير_احترافي_${format(new Date(), 'yyyy-MM-dd')}.pdf`}
          >
            {({ loading }) => (
              <Button disabled={loading} className="gap-2">
                <FileText className="w-4 h-4" />
                {loading ? 'جاري التحضير...' : 'تقرير PDF'}
              </Button>
            )}
          </PDFDownloadLink>
          <Button variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            تحديث
          </Button>
        </div>
      </motion.div>

      {/* فلاتر متقدمة */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              فلاتر التحليل المتقدمة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* الفترة الزمنية */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">الفترة الزمنية</Label>
                  <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start gap-2">
                        <CalendarIcon className="w-4 h-4" />
                        {dateRange.from && dateRange.to ? (
                          `${format(dateRange.from, 'dd/MM/yyyy')} - ${format(dateRange.to, 'dd/MM/yyyy')}`
                        ) : (
                          'اختر الفترة الزمنية'
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <div className="p-3 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          {quickDateRanges.map((range, index) => (
                            <Button
                              key={index}
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDateRangeChange(range.range)}
                            >
                              {range.label}
                            </Button>
                          ))}
                        </div>
                        <Separator />
                        <Calendar
                          mode="range"
                          selected={{ from: dateRange.from, to: dateRange.to }}
                          onSelect={(range) => range && handleDateRangeChange(range)}
                          numberOfMonths={2}
                          className="pointer-events-auto"
                        />
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Select value={filters.department} onValueChange={(value) => setFilters(prev => ({ ...prev, department: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="القسم" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الأقسام</SelectItem>
                      <SelectItem value="clothes">ملابس</SelectItem>
                      <SelectItem value="shoes">أحذية</SelectItem>
                      <SelectItem value="accessories">إكسسوارات</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filters.stockLevel} onValueChange={(value) => setFilters(prev => ({ ...prev, stockLevel: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="مستوى المخزون" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع المستويات</SelectItem>
                      <SelectItem value="high">مخزون عالي</SelectItem>
                      <SelectItem value="low">مخزون منخفض</SelectItem>
                      <SelectItem value="out">نفد المخزون</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* اختيار المقاييس */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">المقاييس المعروضة</Label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'revenue', label: 'الإيرادات', icon: DollarSign },
                    { id: 'profit', label: 'الأرباح', icon: TrendingUp },
                    { id: 'orders', label: 'الطلبات', icon: ShoppingCart },
                    { id: 'products', label: 'المنتجات', icon: Package },
                    { id: 'lowStock', label: 'المخزون المنخفض', icon: AlertTriangle }
                  ].map((metric) => (
                    <div key={metric.id} className="flex items-center gap-2">
                      <Checkbox
                        id={metric.id}
                        checked={selectedMetrics.includes(metric.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedMetrics([...selectedMetrics, metric.id]);
                          } else {
                            setSelectedMetrics(selectedMetrics.filter(m => m !== metric.id));
                          }
                        }}
                      />
                      <Label htmlFor={metric.id} className="text-sm flex items-center gap-1">
                        <metric.icon className="w-3 h-3" />
                        {metric.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* تبويبات التقارير المتقدمة */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6 h-12">
            <TabsTrigger value="dashboard" className="gap-2">
              <Eye className="w-4 h-4" />
              لوحة القيادة
            </TabsTrigger>
            <TabsTrigger value="sales" className="gap-2">
              <TrendingUp className="w-4 h-4" />
              المبيعات
            </TabsTrigger>
            <TabsTrigger value="inventory" className="gap-2">
              <Package className="w-4 h-4" />
              المخزون
            </TabsTrigger>
            <TabsTrigger value="profitability" className="gap-2">
              <Target className="w-4 h-4" />
              الربحية
            </TabsTrigger>
            <TabsTrigger value="employees" className="gap-2">
              <Users className="w-4 h-4" />
              الموظفين
            </TabsTrigger>
            <TabsTrigger value="insights" className="gap-2">
              <Zap className="w-4 h-4" />
              الرؤى الذكية
            </TabsTrigger>
          </TabsList>

          {/* لوحة القيادة الرئيسية */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* KPI Cards الاحترافية */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="relative overflow-hidden"
              >
                <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/50 dark:to-blue-900/30">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground font-medium">إجمالي الإيرادات</p>
                        <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                          {analyticsData.sales.totalRevenue.toLocaleString()} ريال
                        </p>
                        <div className="flex items-center gap-1 text-xs text-green-600">
                          <ArrowUpRight className="w-3 h-3" />
                          +12.5% من الشهر الماضي
                        </div>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <DollarSign className="w-6 h-6 text-blue-500" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                className="relative overflow-hidden"
              >
                <Card className="border-l-4 border-l-green-500 bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/50 dark:to-green-900/30">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground font-medium">إجمالي الأرباح</p>
                        <p className="text-3xl font-bold text-green-700 dark:text-green-300">
                          {analyticsData.sales.totalProfit.toLocaleString()} ريال
                        </p>
                        <div className="flex items-center gap-1 text-xs text-green-600">
                          <ArrowUpRight className="w-3 h-3" />
                          +8.3% من الشهر الماضي
                        </div>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                        <TrendingUp className="w-6 h-6 text-green-500" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                className="relative overflow-hidden"
              >
                <Card className="border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/50 dark:to-purple-900/30">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground font-medium">إجمالي الطلبات</p>
                        <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">
                          {analyticsData.sales.totalOrders}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-purple-600">
                          <Target className="w-3 h-3" />
                          معدل التحويل: {analyticsData.sales.conversionRate.toFixed(1)}%
                        </div>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                        <ShoppingCart className="w-6 h-6 text-purple-500" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                className="relative overflow-hidden"
              >
                <Card className="border-l-4 border-l-orange-500 bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/50 dark:to-orange-900/30">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground font-medium">قيمة المخزون</p>
                        <p className="text-3xl font-bold text-orange-700 dark:text-orange-300">
                          {analyticsData.inventory.totalValue.toLocaleString()} ريال
                        </p>
                        <div className="flex items-center gap-1 text-xs text-orange-600">
                          <Package className="w-3 h-3" />
                          {analyticsData.inventory.totalProducts} منتج
                        </div>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                        <Activity className="w-6 h-6 text-orange-500" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* الرسوم البيانية الرئيسية */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart2 className="w-5 h-5" />
                    اتجاه المبيعات والأرباح
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={analyticsData.trends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip 
                        formatter={(value, name) => [
                          `${Number(value).toLocaleString()} ريال`, 
                          name === 'revenue' ? 'الإيرادات' : 'الأرباح'
                        ]}
                      />
                      <Area type="monotone" dataKey="revenue" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                      <Area type="monotone" dataKey="profit" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="w-5 h-5" />
                    توزيع مستويات المخزون
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsPieChart>
                      <Tooltip />
                      <Legend />
                      <RechartsPieChart
                        data={[
                          { name: 'مخزون عالي', value: analyticsData.stock.high, fill: '#10b981' },
                          { name: 'مخزون متوسط', value: analyticsData.stock.medium, fill: '#f59e0b' },
                          { name: 'مخزون منخفض', value: analyticsData.stock.low, fill: '#ef4444' },
                          { name: 'نفد المخزون', value: analyticsData.stock.critical, fill: '#6b7280' }
                        ]}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* تبويب المبيعات */}
          <TabsContent value="sales" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    الطلبات المكتملة
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-3xl font-bold text-green-600">{analyticsData.sales.completedOrders}</p>
                    <Progress value={(analyticsData.sales.completedOrders / analyticsData.sales.totalOrders) * 100} className="h-2" />
                    <p className="text-sm text-muted-foreground">
                      {((analyticsData.sales.completedOrders / analyticsData.sales.totalOrders) * 100).toFixed(1)}% من إجمالي الطلبات
                    </p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-yellow-500" />
                    الطلبات المعلقة
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-3xl font-bold text-yellow-600">{analyticsData.sales.pendingOrders}</p>
                    <Progress value={(analyticsData.sales.pendingOrders / analyticsData.sales.totalOrders) * 100} className="h-2" />
                    <p className="text-sm text-muted-foreground">
                      {((analyticsData.sales.pendingOrders / analyticsData.sales.totalOrders) * 100).toFixed(1)}% من إجمالي الطلبات
                    </p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-blue-500" />
                    متوسط قيمة الطلب
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-3xl font-bold text-blue-600">
                      {analyticsData.sales.averageOrderValue.toLocaleString()} ريال
                    </p>
                    <div className="flex items-center gap-1 text-sm text-green-600">
                      <ArrowUpRight className="w-3 h-3" />
                      +5.2% من الشهر الماضي
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>أداء المبيعات اليومي التفصيلي</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={analyticsData.trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="orders" fill="#3b82f6" name="عدد الطلبات" />
                    <Bar dataKey="completed" fill="#10b981" name="المكتملة" />
                    <Bar dataKey="pending" fill="#f59e0b" name="المعلقة" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* باقي التبويبات... */}
          <TabsContent value="inventory" className="space-y-6">
            <div className="text-center py-8">
              <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">تحليل المخزون المتقدم</h3>
              <p className="text-muted-foreground">جاري تطوير هذا القسم...</p>
            </div>
          </TabsContent>

          <TabsContent value="profitability" className="space-y-6">
            <div className="text-center py-8">
              <Target className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">تحليل الربحية</h3>
              <p className="text-muted-foreground">جاري تطوير هذا القسم...</p>
            </div>
          </TabsContent>

          <TabsContent value="employees" className="space-y-6">
            <div className="text-center py-8">
              <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">أداء الموظفين</h3>
              <p className="text-muted-foreground">جاري تطوير هذا القسم...</p>
            </div>
          </TabsContent>

          <TabsContent value="insights" className="space-y-6">
            <div className="text-center py-8">
              <Zap className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">الرؤى الذكية</h3>
              <p className="text-muted-foreground">جاري تطوير هذا القسم...</p>
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
};

export default ProfessionalReportsSystem;