import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { 
  TrendingUp, DollarSign, Package, Users, 
  BarChart3, PieChart, Calendar, Download,
  Star, Award, Zap, Target, Eye, Filter
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, subDays, 
         startOfWeek, endOfWeek, startOfYear, endOfYear, subMonths } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart as RechartsPieChart, 
         Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// مكون نظام التقارير المتقدم
const AdvancedReportsSystem = ({ open, onOpenChange }) => {
  const { toast } = useToast();
  
  // حالات البيانات
  const [loading, setLoading] = useState(false);
  const [activeReport, setActiveReport] = useState('overview');
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });
  const [filters, setFilters] = useState({
    period: 'this_month',
    category: 'all',
    employee: 'all',
    status: 'all'
  });

  // بيانات النظام
  const [systemData, setSystemData] = useState({
    orders: [],
    products: [],
    profits: [],
    expenses: [],
    customers: [],
    inventory: []
  });

  // تحميل البيانات
  useEffect(() => {
    if (open) {
      loadSystemData();
    }
  }, [open, dateRange]);

  const loadSystemData = async () => {
    setLoading(true);
    try {
      const [ordersRes, productsRes, profitsRes, expensesRes, customersRes, inventoryRes] = await Promise.all([
        supabase.from('orders').select(`
          *, 
          order_items(*, products(*), product_variants(*)),
          profiles!orders_created_by_fkey(full_name)
        `).gte('created_at', dateRange.from?.toISOString()).lte('created_at', dateRange.to?.toISOString()),
        
        supabase.from('products').select('*, product_variants(*, inventory(*))'),
        
        supabase.from('profits').select(`
          *, 
          orders(*),
          profiles!profits_employee_id_fkey(full_name)
        `).gte('created_at', dateRange.from?.toISOString()).lte('created_at', dateRange.to?.toISOString()),
        
        supabase.from('expenses').select('*').gte('created_at', dateRange.from?.toISOString()).lte('created_at', dateRange.to?.toISOString()),
        supabase.from('customers').select('*'),
        supabase.from('inventory').select('*, products(*), product_variants(*)')
      ]);

      setSystemData({
        orders: ordersRes.data || [],
        products: productsRes.data || [],
        profits: profitsRes.data || [],
        expenses: expensesRes.data || [],
        customers: customersRes.data || [],
        inventory: inventoryRes.data || []
      });
    } catch (error) {
      console.error('خطأ في تحميل البيانات:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحميل بيانات التقارير",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // حساب المؤشرات الرئيسية
  const kpis = useMemo(() => {
    const { orders, profits, expenses, inventory, customers } = systemData;
    
    const totalRevenue = orders.reduce((sum, order) => sum + (order.final_amount || 0), 0);
    const totalOrders = orders.length;
    const totalExpenses = expenses.filter(e => e.status === 'approved').reduce((sum, exp) => sum + exp.amount, 0);
    const totalProfit = profits.reduce((sum, profit) => sum + profit.profit_amount, 0);
    const totalProducts = systemData.products.length;
    const lowStock = inventory.filter(item => item.quantity <= 5).length;
    const outOfStock = inventory.filter(item => item.quantity === 0).length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    return {
      totalRevenue,
      totalOrders,
      totalExpenses,
      netProfit: totalProfit - totalExpenses,
      totalProducts,
      lowStock,
      outOfStock,
      avgOrderValue,
      totalCustomers: customers.length,
      growthRate: 12.5, // يمكن حسابها بناء على الفترات السابقة
    };
  }, [systemData]);

  // بيانات الرسوم البيانية
  const chartData = useMemo(() => {
    const { orders, profits } = systemData;
    
    // بيانات المبيعات اليومية
    const dailySales = orders.reduce((acc, order) => {
      const date = format(new Date(order.created_at), 'yyyy-MM-dd');
      acc[date] = (acc[date] || 0) + order.final_amount;
      return acc;
    }, {});

    const salesChart = Object.entries(dailySales).map(([date, amount]) => ({
      date: format(new Date(date), 'dd/MM'),
      amount,
      orders: orders.filter(o => format(new Date(o.created_at), 'yyyy-MM-dd') === date).length
    }));

    // بيانات الأرباح الشهرية
    const monthlyProfits = profits.reduce((acc, profit) => {
      const month = format(new Date(profit.created_at), 'yyyy-MM');
      acc[month] = (acc[month] || 0) + profit.profit_amount;
      return acc;
    }, {});

    const profitsChart = Object.entries(monthlyProfits).map(([month, amount]) => ({
      month: format(new Date(month + '-01'), 'MMM'),
      profit: amount
    }));

    return { salesChart, profitsChart };
  }, [systemData]);

  // تطبيق الفلاتر
  const applyDateFilter = (period) => {
    const now = new Date();
    let from, to;

    switch (period) {
      case 'today':
        from = startOfDay(now);
        to = endOfDay(now);
        break;
      case 'yesterday':
        from = startOfDay(subDays(now, 1));
        to = endOfDay(subDays(now, 1));
        break;
      case 'this_week':
        from = startOfWeek(now);
        to = endOfWeek(now);
        break;
      case 'this_month':
        from = startOfMonth(now);
        to = endOfMonth(now);
        break;
      case 'last_month':
        from = startOfMonth(subMonths(now, 1));
        to = endOfMonth(subMonths(now, 1));
        break;
      case 'this_year':
        from = startOfYear(now);
        to = endOfYear(now);
        break;
      default:
        return;
    }

    setDateRange({ from, to });
    setFilters(prev => ({ ...prev, period }));
  };

  // تصدير التقرير
  const exportReport = async (format = 'json') => {
    try {
      const reportData = {
        period: `${format(dateRange.from, 'dd/MM/yyyy')} - ${format(dateRange.to, 'dd/MM/yyyy')}`,
        kpis,
        orders: systemData.orders,
        summary: {
          totalRevenue: kpis.totalRevenue,
          totalOrders: kpis.totalOrders,
          avgOrderValue: kpis.avgOrderValue,
          netProfit: kpis.netProfit
        }
      };

      if (format === 'json') {
        const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `تقرير-${format(new Date(), 'yyyy-MM-dd')}.json`;
        a.click();
      }

      toast({
        title: "تم التصدير",
        description: "تم تصدير التقرير بنجاح"
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في تصدير التقرير",
        variant: "destructive"
      });
    }
  };

  if (loading && !systemData.orders.length) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-7xl h-[90vh]">
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-lg">جاري تحميل بيانات التقارير...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl h-[95vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            🎯 مركز التقارير والتحليل المتقدم
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col h-full overflow-hidden">
          {/* شريط الفلاتر */}
          <div className="flex flex-wrap gap-3 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg mb-4">
            <Select value={filters.period} onValueChange={applyDateFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="اختر الفترة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">اليوم</SelectItem>
                <SelectItem value="yesterday">أمس</SelectItem>
                <SelectItem value="this_week">هذا الأسبوع</SelectItem>
                <SelectItem value="this_month">هذا الشهر</SelectItem>
                <SelectItem value="last_month">الشهر الماضي</SelectItem>
                <SelectItem value="this_year">هذا العام</SelectItem>
              </SelectContent>
            </Select>

            <DatePickerWithRange 
              date={dateRange} 
              onDateChange={setDateRange}
              className="w-64"
            />

            <Button 
              onClick={() => exportReport('json')}
              className="bg-green-600 hover:bg-green-700"
            >
              <Download className="w-4 h-4 mr-2" />
              تصدير JSON
            </Button>
          </div>

          {/* المؤشرات الرئيسية */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
            <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm">إجمالي الإيرادات</p>
                    <p className="text-2xl font-bold">{kpis.totalRevenue.toLocaleString()}</p>
                    <p className="text-xs text-green-200">د.ع</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-green-200" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-500 to-cyan-600 text-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm">إجمالي الطلبات</p>
                    <p className="text-2xl font-bold">{kpis.totalOrders}</p>
                    <p className="text-xs text-blue-200">طلب</p>
                  </div>
                  <Package className="w-8 h-8 text-blue-200" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-500 to-pink-600 text-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-sm">صافي الربح</p>
                    <p className="text-2xl font-bold">{kpis.netProfit.toLocaleString()}</p>
                    <p className="text-xs text-purple-200">د.ع</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-purple-200" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-500 to-red-600 text-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-100 text-sm">متوسط قيمة الطلب</p>
                    <p className="text-2xl font-bold">{kpis.avgOrderValue.toLocaleString()}</p>
                    <p className="text-xs text-orange-200">د.ع</p>
                  </div>
                  <Target className="w-8 h-8 text-orange-200" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-indigo-100 text-sm">العملاء</p>
                    <p className="text-2xl font-bold">{kpis.totalCustomers}</p>
                    <p className="text-xs text-indigo-200">عميل</p>
                  </div>
                  <Users className="w-8 h-8 text-indigo-200" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* التقارير المفصلة */}
          <Tabs value={activeReport} onValueChange={setActiveReport} className="flex-1 overflow-hidden">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                نظرة عامة
              </TabsTrigger>
              <TabsTrigger value="sales" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                المبيعات
              </TabsTrigger>
              <TabsTrigger value="profits" className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                الأرباح
              </TabsTrigger>
              <TabsTrigger value="inventory" className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                المخزون
              </TabsTrigger>
            </TabsList>

            <div className="mt-4 overflow-auto flex-1">
              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* رسم المبيعات اليومية */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-blue-600" />
                        المبيعات اليومية
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={chartData.salesChart}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Area type="monotone" dataKey="amount" stroke="#3b82f6" fill="#3b82f680" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* رسم الأرباح الشهرية */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-green-600" />
                        الأرباح الشهرية
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={chartData.profitsChart}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip />
                          <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="sales" className="space-y-6">
                {/* تفاصيل المبيعات */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle>أحدث الطلبات</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4 max-h-96 overflow-auto">
                        {systemData.orders.slice(0, 10).map(order => (
                          <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <p className="font-medium">{order.customer_name}</p>
                              <p className="text-sm text-gray-600">{order.order_number}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-green-600">{order.final_amount.toLocaleString()} د.ع</p>
                              <Badge variant={order.status === 'completed' ? 'default' : 'secondary'}>
                                {order.status === 'completed' ? 'مكتمل' : 'معلق'}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>إحصائيات سريعة</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span>طلبات اليوم:</span>
                        <Badge className="bg-blue-100 text-blue-800">
                          {systemData.orders.filter(o => 
                            format(new Date(o.created_at), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                          ).length}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>معدل النمو:</span>
                        <Badge className="bg-green-100 text-green-800">+{kpis.growthRate}%</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>أعلى طلب:</span>
                        <Badge className="bg-purple-100 text-purple-800">
                          {Math.max(...systemData.orders.map(o => o.final_amount)).toLocaleString()} د.ع
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="profits" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>تفاصيل الأرباح</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-auto max-h-96">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-right p-2">الموظف</th>
                            <th className="text-right p-2">رقم الطلب</th>
                            <th className="text-right p-2">إجمالي الربح</th>
                            <th className="text-right p-2">ربح الموظف</th>
                            <th className="text-right p-2">التاريخ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {systemData.profits.map(profit => (
                            <tr key={profit.id} className="border-b hover:bg-gray-50">
                              <td className="p-2">{profit.profiles?.full_name || 'غير محدد'}</td>
                              <td className="p-2">{profit.orders?.order_number}</td>
                              <td className="p-2 text-green-600 font-medium">
                                {profit.profit_amount.toLocaleString()} د.ع
                              </td>
                              <td className="p-2 text-blue-600">
                                {profit.employee_profit.toLocaleString()} د.ع
                              </td>
                              <td className="p-2 text-gray-600">
                                {format(new Date(profit.created_at), 'dd/MM/yyyy')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="inventory" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-red-600">تحذيرات المخزون</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                          <span>نفذ من المخزون:</span>
                          <Badge variant="destructive">{kpis.outOfStock} منتج</Badge>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                          <span>مخزون منخفض:</span>
                          <Badge className="bg-yellow-500">{kpis.lowStock} منتج</Badge>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                          <span>إجمالي المنتجات:</span>
                          <Badge className="bg-green-500">{kpis.totalProducts} منتج</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>المنتجات الأكثر مبيعا</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 max-h-64 overflow-auto">
                        {systemData.orders
                          .flatMap(order => order.order_items || [])
                          .reduce((acc, item) => {
                            const key = item.products?.name || 'منتج غير محدد';
                            acc[key] = (acc[key] || 0) + item.quantity;
                            return acc;
                          }, {})
                          && Object.entries(
                            systemData.orders
                              .flatMap(order => order.order_items || [])
                              .reduce((acc, item) => {
                                const key = item.products?.name || 'منتج غير محدد';
                                acc[key] = (acc[key] || 0) + item.quantity;
                                return acc;
                              }, {})
                          )
                          .sort(([,a], [,b]) => b - a)
                          .slice(0, 5)
                          .map(([product, quantity], index) => (
                            <div key={product} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <div className="flex items-center gap-2">
                                <Badge className="w-6 h-6 rounded-full flex items-center justify-center text-xs">
                                  {index + 1}
                                </Badge>
                                <span className="text-sm">{product}</span>
                              </div>
                              <Badge variant="outline">{quantity} قطعة</Badge>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdvancedReportsSystem;