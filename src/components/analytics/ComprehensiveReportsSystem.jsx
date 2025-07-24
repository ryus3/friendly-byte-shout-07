import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Download, 
  FileText, 
  Calendar,
  Filter,
  Package,
  DollarSign,
  Users,
  ShoppingCart,
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity
} from 'lucide-react';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { motion } from 'framer-motion';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { PDFDownloadLink } from '@react-pdf/renderer';
import InventoryReportPDF from '@/components/pdf/InventoryReportPDF';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const ComprehensiveReportsSystem = () => {
  const { products, orders, loading } = useInventory();
  const { allUsers } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });
  const [filters, setFilters] = useState({
    department: 'all',
    category: 'all',
    stockLevel: 'all',
    employee: 'all'
  });

  // البيانات المحسوبة
  const analyticsData = useMemo(() => {
    if (!products || !orders) return null;

    const filteredProducts = products.filter(product => {
      if (filters.department !== 'all' && product.department !== filters.department) return false;
      if (filters.category !== 'all' && product.category !== filters.category) return false;
      return true;
    });

    const filteredOrders = orders.filter(order => {
      const orderDate = new Date(order.created_at);
      return orderDate >= dateRange.from && orderDate <= dateRange.to;
    });

    // إحصائيات المخزون
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
      )
    };

    // إحصائيات المبيعات
    const salesStats = {
      totalOrders: filteredOrders.length,
      completedOrders: filteredOrders.filter(o => o.status === 'completed').length,
      pendingOrders: filteredOrders.filter(o => o.status === 'pending').length,
      totalRevenue: filteredOrders
        .filter(o => o.status === 'completed')
        .reduce((sum, o) => sum + (o.total_amount || 0), 0),
      totalProfit: filteredOrders
        .filter(o => o.status === 'completed')
        .reduce((sum, o) => sum + (o.profit_amount || 0), 0)
    };

    // بيانات الرسوم البيانية
    const chartData = {
      stockLevels: [
        { name: 'مخزون عالي', value: inventoryStats.totalProducts - inventoryStats.lowStockCount - inventoryStats.outOfStockCount, color: '#10b981' },
        { name: 'مخزون منخفض', value: inventoryStats.lowStockCount, color: '#f59e0b' },
        { name: 'نفد المخزون', value: inventoryStats.outOfStockCount, color: '#ef4444' }
      ],
      salesTrend: generateSalesTrend(filteredOrders, dateRange),
      topProducts: getTopProducts(filteredProducts),
      departmentAnalysis: getDepartmentAnalysis(filteredProducts)
    };

    return {
      inventory: inventoryStats,
      sales: salesStats,
      charts: chartData
    };
  }, [products, orders, dateRange, filters]);

  // دوال مساعدة
  const generateSalesTrend = (orders, range) => {
    const days = [];
    const current = new Date(range.from);
    while (current <= range.to) {
      const dayOrders = orders.filter(o => {
        const orderDate = new Date(o.created_at);
        return orderDate.toDateString() === current.toDateString();
      });
      
      days.push({
        date: format(current, 'dd/MM', { locale: ar }),
        orders: dayOrders.length,
        revenue: dayOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0),
        profit: dayOrders.reduce((sum, o) => sum + (o.profit_amount || 0), 0)
      });
      
      current.setDate(current.getDate() + 1);
    }
    return days;
  };

  const getTopProducts = (products) => {
    return products
      .map(p => ({
        name: p.name,
        sales: p.variants?.reduce((sum, v) => sum + (v.sold_quantity || 0), 0) || 0,
        revenue: p.variants?.reduce((sum, v) => sum + ((v.sold_quantity || 0) * (v.price || 0)), 0) || 0
      }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10);
  };

  const getDepartmentAnalysis = (products) => {
    const departments = {};
    products.forEach(p => {
      const dept = p.department || 'غير محدد';
      if (!departments[dept]) {
        departments[dept] = { products: 0, stock: 0, value: 0 };
      }
      departments[dept].products++;
      departments[dept].stock += p.variants?.reduce((sum, v) => sum + (v.quantity || 0), 0) || 0;
      departments[dept].value += p.variants?.reduce((sum, v) => sum + ((v.quantity || 0) * (v.cost_price || 0)), 0) || 0;
    });
    
    return Object.entries(departments).map(([name, data]) => ({
      name,
      ...data
    }));
  };

  const handleExportData = (format) => {
    if (format === 'json') {
      const dataStr = JSON.stringify(analyticsData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `تقرير_شامل_${format(new Date(), 'yyyy-MM-dd')}.json`;
      link.click();
    }
  };

  if (loading || !analyticsData) {
    return <div className="flex justify-center items-center h-64">جاري تحميل البيانات...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center"
      >
        <div>
          <h1 className="text-3xl font-bold gradient-text">نظام التقارير الشامل</h1>
          <p className="text-muted-foreground">تحليل متكامل للمخزون والمبيعات والأرباح</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => handleExportData('json')} variant="outline">
            <Download className="w-4 h-4 ml-2" />
            تصدير JSON
          </Button>
          <PDFDownloadLink
            document={<InventoryReportPDF products={products} settings={{ lowStockThreshold: 5 }} />}
            fileName={`تقرير_شامل_${format(new Date(), 'yyyy-MM-dd')}.pdf`}
          >
            {({ loading }) => (
              <Button disabled={loading}>
                <FileText className="w-4 h-4 ml-2" />
                {loading ? 'جاري التحضير...' : 'تصدير PDF'}
              </Button>
            )}
          </PDFDownloadLink>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              فلاتر التقرير
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>الفترة الزمنية</Label>
                <div className="flex gap-2">
                  <DatePicker
                    date={dateRange.from}
                    onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                  />
                  <DatePicker
                    date={dateRange.to}
                    onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                  />
                </div>
              </div>
              <div>
                <Label>القسم</Label>
                <Select value={filters.department} onValueChange={(value) => setFilters(prev => ({ ...prev, department: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الأقسام</SelectItem>
                    <SelectItem value="clothes">ملابس</SelectItem>
                    <SelectItem value="shoes">أحذية</SelectItem>
                    <SelectItem value="accessories">إكسسوارات</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>مستوى المخزون</Label>
                <Select value={filters.stockLevel} onValueChange={(value) => setFilters(prev => ({ ...prev, stockLevel: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع المستويات</SelectItem>
                    <SelectItem value="high">مخزون عالي</SelectItem>
                    <SelectItem value="low">مخزون منخفض</SelectItem>
                    <SelectItem value="out">نفد المخزون</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>الموظف</Label>
                <Select value={filters.employee} onValueChange={(value) => setFilters(prev => ({ ...prev, employee: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الموظفين</SelectItem>
                    {allUsers?.map(user => (
                      <SelectItem key={user.id} value={user.id}>{user.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Reports Tabs */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
            <TabsTrigger value="inventory">المخزون</TabsTrigger>
            <TabsTrigger value="sales">المبيعات</TabsTrigger>
            <TabsTrigger value="analytics">التحليلات</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="border-l-4 border-l-blue-500">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">إجمالي المنتجات</p>
                      <p className="text-2xl font-bold">{analyticsData.inventory.totalProducts}</p>
                    </div>
                    <Package className="w-8 h-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-l-4 border-l-green-500">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">إجمالي الإيرادات</p>
                      <p className="text-2xl font-bold">{analyticsData.sales.totalRevenue.toLocaleString()} ريال</p>
                    </div>
                    <DollarSign className="w-8 h-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-l-4 border-l-purple-500">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">إجمالي الطلبات</p>
                      <p className="text-2xl font-bold">{analyticsData.sales.totalOrders}</p>
                    </div>
                    <ShoppingCart className="w-8 h-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-l-4 border-l-orange-500">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">قيمة المخزون</p>
                      <p className="text-2xl font-bold">{analyticsData.inventory.totalValue.toLocaleString()} ريال</p>
                    </div>
                    <Activity className="w-8 h-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>توزيع مستويات المخزون</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Tooltip />
                      {analyticsData.charts.stockLevels.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>اتجاه المبيعات</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={analyticsData.charts.salesTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="inventory" className="space-y-6">
            {/* Inventory detailed reports content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    مخزون جيد
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-green-600">
                    {analyticsData.inventory.totalProducts - analyticsData.inventory.lowStockCount - analyticsData.inventory.outOfStockCount}
                  </p>
                  <p className="text-sm text-muted-foreground">منتجات بمخزون كافي</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                    مخزون منخفض
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-yellow-600">{analyticsData.inventory.lowStockCount}</p>
                  <p className="text-sm text-muted-foreground">منتجات تحتاج إعادة تموين</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-red-500" />
                    نفد المخزون
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-red-600">{analyticsData.inventory.outOfStockCount}</p>
                  <p className="text-sm text-muted-foreground">منتجات غير متوفرة</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="sales" className="space-y-6">
            {/* Sales detailed reports content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>أداء المبيعات اليومي</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={analyticsData.charts.salesTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="revenue" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                      <Area type="monotone" dataKey="profit" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>أفضل المنتجات مبيعاً</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analyticsData.charts.topProducts.slice(0, 5).map((product, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-muted-foreground">{product.sales} مبيعة</p>
                        </div>
                        <Badge variant="secondary">{product.revenue.toLocaleString()} ريال</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            {/* Analytics detailed reports content */}
            <Card>
              <CardHeader>
                <CardTitle>تحليل الأقسام</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analyticsData.charts.departmentAnalysis.map((dept, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{dept.name}</p>
                        <p className="text-sm text-muted-foreground">{dept.products} منتجات</p>
                      </div>
                      <div className="text-left">
                        <p className="font-bold">{dept.stock} قطعة</p>
                        <p className="text-sm text-muted-foreground">{dept.value.toLocaleString()} ريال</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
};

export default ComprehensiveReportsSystem;