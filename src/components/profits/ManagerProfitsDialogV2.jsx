import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/lib/customSupabaseClient';
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  FileText,
  Calendar,
  Filter,
  Eye,
  Download,
  BarChart3,
  PieChart,
  Target,
  Award,
  Crown,
  Coins,
  Package,
  ShoppingBag
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO, isValid } from 'date-fns';
import { ar } from 'date-fns/locale';

/**
 * نافذة "أرباحي من الموظفين" المحسّنة
 * تجلب البيانات مباشرة من قاعدة البيانات وتضمن الدقة الكاملة
 */
const ManagerProfitsDialogV2 = ({ 
  isOpen, 
  onClose,
  employees = []
}) => {
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  
  // البيانات المحمّلة من قاعدة البيانات
  const [orders, setOrders] = useState([]);
  const [profits, setProfits] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  console.log('🚀 ManagerProfitsDialogV2 - بدء التشغيل:', {
    isOpen,
    employeesCount: employees?.length || 0
  });

  // تحديد نطاق التاريخ
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (selectedPeriod) {
      case 'today':
        return { 
          start: new Date(now.getFullYear(), now.getMonth(), now.getDate()), 
          end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59) 
        };
      case 'week':
        const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
        const weekEnd = new Date(now.setDate(weekStart.getDate() + 6));
        weekEnd.setHours(23, 59, 59, 999);
        return { start: weekStart, end: weekEnd };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'year':
        return { 
          start: new Date(now.getFullYear(), 0, 1), 
          end: new Date(now.getFullYear(), 11, 31, 23, 59, 59) 
        };
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  }, [selectedPeriod]);

  // جلب البيانات من قاعدة البيانات عند فتح النافذة
  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        console.log('📡 جلب البيانات من قاعدة البيانات...', { dateRange });

        // جلب الطلبات مع عناصرها والأرباح
        const { data: ordersData } = await supabase
          .from('orders')
          .select(`
            *,
            order_items(
              *,
              product_variants(cost_price, selling_price),
              products(cost_price, name)
            ),
            profits(*)
          `)
          .in('status', ['delivered', 'completed'])
          .eq('receipt_received', true)
          .gte('created_at', dateRange.start.toISOString())
          .lte('created_at', dateRange.end.toISOString())
          .order('created_at', { ascending: false });

        // جلب بيانات المستخدمين
        const { data: usersData } = await supabase
          .from('profiles')
          .select('user_id, full_name, username, email');

        // جلب بيانات الأرباح المفصلة
        const { data: profitsData } = await supabase
          .from('profits')
          .select(`
            *,
            profiles!employee_id(full_name, username),
            orders!order_id(order_number, customer_name, total_amount, created_at)
          `)
          .order('created_at', { ascending: false });

        setOrders(ordersData || []);
        setAllUsers(usersData || []);
        setProfits(profitsData || []);

        console.log('✅ تم جلب البيانات بنجاح:', {
          ordersCount: ordersData?.length || 0,
          usersCount: usersData?.length || 0,
          profitsCount: profitsData?.length || 0
        });

      } catch (error) {
        console.error('❌ خطأ في جلب البيانات:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, dateRange]);

  // معالجة البيانات وحساب الأرباح
  const processedData = useMemo(() => {
    if (!orders.length || !allUsers.length) {
      return {
        detailedProfits: [],
        stats: {
          totalManagerProfit: 0,
          totalEmployeeProfit: 0,
          totalRevenue: 0,
          pendingProfit: 0,
          settledProfit: 0,
          totalOrders: 0,
          averageOrderValue: 0,
          profitMargin: '0.0',
          topEmployees: []
        }
      };
    }

    console.log('⚙️ معالجة البيانات المحمّلة...', {
      ordersCount: orders.length,
      selectedEmployee,
      searchTerm
    });

    // فلترة وتحضير الطلبات
    const filteredOrders = orders
      .filter(order => {
        // فلترة الموظف
        if (selectedEmployee && selectedEmployee !== 'all') {
          if (order.created_by !== selectedEmployee) return false;
        }

        // فلترة البحث
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          if (!order.order_number?.toLowerCase().includes(searchLower) &&
              !order.customer_name?.toLowerCase().includes(searchLower)) {
            return false;
          }
        }

        return true;
      })
      .map(order => {
        const employee = allUsers.find(u => u.user_id === order.created_by);
        const profitRecord = profits.find(p => p.order_id === order.id);

        // حساب الأرباح من البيانات الحقيقية
        let managerProfit = 0;
        let employeeProfit = 0;
        let totalProfit = 0;

        if (profitRecord) {
          // استخدام البيانات من جدول الأرباح
          totalProfit = Number(profitRecord.profit_amount || 0);
          employeeProfit = Number(profitRecord.employee_profit || 0);
          managerProfit = totalProfit - employeeProfit;
        } else if (order.order_items && Array.isArray(order.order_items)) {
          // حساب يدوي من عناصر الطلب
          totalProfit = order.order_items.reduce((sum, item) => {
            const sellPrice = Number(item.unit_price || 0);
            const costPrice = Number(item.product_variants?.cost_price || item.products?.cost_price || 0);
            const quantity = Number(item.quantity || 0);
            return sum + ((sellPrice - costPrice) * quantity);
          }, 0);

          // توزيع الأرباح (افتراضي: 70% للنظام، 30% للموظف)
          employeeProfit = totalProfit * 0.3;
          managerProfit = totalProfit * 0.7;
        }

        const orderTotal = Number(order.final_amount || order.total_amount || 0);
        const deliveryFee = Number(order.delivery_fee || 0);
        const orderTotalWithoutDelivery = Math.max(0, orderTotal - deliveryFee);

        return {
          ...order,
          employee: employee || { full_name: 'غير معروف', user_id: order.created_by },
          orderTotal: orderTotalWithoutDelivery,
          deliveryFee,
          totalWithDelivery: orderTotal,
          managerProfit: Math.round(managerProfit),
          employeeProfit: Math.round(employeeProfit),
          totalProfit: Math.round(totalProfit),
          profitPercentage: orderTotalWithoutDelivery > 0 ? 
            ((totalProfit / orderTotalWithoutDelivery) * 100).toFixed(1) : '0',
          isPaid: profitRecord?.status === 'settled' || !!profitRecord?.settled_at,
          settledAt: profitRecord?.settled_at,
          profitRecord
        };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // حساب الإحصائيات
    const totalRevenue = filteredOrders.reduce((sum, order) => sum + order.orderTotal, 0);
    const totalManagerProfit = filteredOrders.reduce((sum, order) => sum + order.managerProfit, 0);
    const totalEmployeeProfit = filteredOrders.reduce((sum, order) => sum + order.employeeProfit, 0);
    const settledProfit = filteredOrders
      .filter(order => order.isPaid)
      .reduce((sum, order) => sum + order.managerProfit, 0);
    const pendingProfit = totalManagerProfit - settledProfit;

    // أفضل الموظفين
    const employeeStats = {};
    filteredOrders.forEach(order => {
      const empId = order.created_by;
      if (!employeeStats[empId]) {
        employeeStats[empId] = {
          employee: order.employee,
          ordersCount: 0,
          totalRevenue: 0,
          totalProfit: 0,
          managerProfit: 0
        };
      }
      employeeStats[empId].ordersCount += 1;
      employeeStats[empId].totalRevenue += order.orderTotal;
      employeeStats[empId].totalProfit += order.totalProfit;
      employeeStats[empId].managerProfit += order.managerProfit;
    });

    const topEmployees = Object.values(employeeStats)
      .sort((a, b) => b.managerProfit - a.managerProfit)
      .slice(0, 5);

    const stats = {
      totalManagerProfit,
      totalEmployeeProfit,
      totalRevenue,
      pendingProfit,
      settledProfit,
      totalOrders: filteredOrders.length,
      averageOrderValue: filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0,
      profitMargin: totalRevenue > 0 ? ((totalManagerProfit / totalRevenue) * 100).toFixed(1) : '0.0',
      topEmployees
    };

    console.log('📊 النتائج النهائية:', {
      filteredOrdersCount: filteredOrders.length,
      stats
    });

    return {
      detailedProfits: filteredOrders,
      stats
    };
  }, [orders, allUsers, profits, selectedEmployee, searchTerm]);

  const { detailedProfits, stats } = processedData;

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">جاري تحميل البيانات...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-right">
            أرباحي من الموظفين - تقرير مفصل
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 h-full">
          {/* شريط الفلاتر */}
          <div className="flex flex-wrap gap-4 items-center justify-between bg-muted/30 p-4 rounded-lg">
            <div className="flex gap-2 items-center">
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="اختر موظف" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الموظفين</SelectItem>
                  {employees.map(emp => (
                    <SelectItem key={emp.user_id} value={emp.user_id}>
                      {emp.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">اليوم</SelectItem>
                  <SelectItem value="week">هذا الأسبوع</SelectItem>
                  <SelectItem value="month">هذا الشهر</SelectItem>
                  <SelectItem value="year">هذه السنة</SelectItem>
                </SelectContent>
              </Select>

              <Input
                placeholder="البحث في الطلبات..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-48"
              />
            </div>

            <div className="text-sm text-muted-foreground">
              الفترة: {format(dateRange.start, 'dd/MM/yyyy', { locale: ar })} - {format(dateRange.end, 'dd/MM/yyyy', { locale: ar })}
            </div>
          </div>

          {/* التبويبات */}
          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="flex-1">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
              <TabsTrigger value="details">تفاصيل الطلبات</TabsTrigger>
              <TabsTrigger value="employees">تفاصيل الموظفين</TabsTrigger>
            </TabsList>

            {/* نظرة عامة */}
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      إجمالي أرباحي
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-700">
                      {stats.totalManagerProfit.toLocaleString()} د.ع
                    </div>
                    <p className="text-xs text-green-600 mt-1">
                      نسبة الربح: {stats.profitMargin}%
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-50 to-sky-50 border-blue-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-600" />
                      أرباح الموظفين
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-700">
                      {stats.totalEmployeeProfit.toLocaleString()} د.ع
                    </div>
                    <p className="text-xs text-blue-600 mt-1">
                      من {stats.totalOrders} طلب
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Clock className="h-4 w-4 text-orange-600" />
                      أرباح معلقة
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-700">
                      {stats.pendingProfit.toLocaleString()} د.ع
                    </div>
                    <p className="text-xs text-orange-600 mt-1">
                      في انتظار التسوية
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-purple-600" />
                      أرباح مُستلمة
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-700">
                      {stats.settledProfit.toLocaleString()} د.ع
                    </div>
                    <p className="text-xs text-purple-600 mt-1">
                      تم استلامها
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* أفضل الموظفين */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    أفضل الموظفين (حسب الأرباح المحققة لي)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats.topEmployees.slice(0, 3).map((emp, index) => (
                      <div key={emp.employee.user_id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                            index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-500'
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium">{emp.employee.full_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {emp.ordersCount} طلب - {emp.totalRevenue.toLocaleString()} د.ع
                            </p>
                          </div>
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-green-600">
                            {emp.managerProfit.toLocaleString()} د.ع
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ربحي منه
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* تفاصيل الطلبات */}
            <TabsContent value="details" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>تفاصيل الطلبات ({detailedProfits.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <div className="space-y-2">
                      {detailedProfits.map(order => (
                        <div key={order.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{order.order_number}</p>
                              <Badge variant={order.isPaid ? 'default' : 'secondary'}>
                                {order.isPaid ? 'مُستلم' : 'معلق'}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {order.employee.full_name} - {order.customer_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(order.created_at), 'dd/MM/yyyy HH:mm', { locale: ar })}
                            </p>
                          </div>
                          <div className="text-left">
                            <p className="font-bold">{order.orderTotal.toLocaleString()} د.ع</p>
                            <p className="text-sm text-green-600 font-medium">
                              ربحي: {order.managerProfit.toLocaleString()} د.ع
                            </p>
                            <p className="text-xs text-muted-foreground">
                              نسبة: {order.profitPercentage}%
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* تفاصيل الموظفين */}
            <TabsContent value="employees" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>ملخص أداء الموظفين</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <div className="space-y-3">
                      {stats.topEmployees.map(emp => (
                        <div key={emp.employee.user_id} className="p-4 border rounded-lg">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium">{emp.employee.full_name}</h4>
                            <Badge>{emp.ordersCount} طلب</Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">إجمالي المبيعات</p>
                              <p className="font-medium">{emp.totalRevenue.toLocaleString()} د.ع</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">ربحه الشخصي</p>
                              <p className="font-medium text-blue-600">
                                {(emp.totalProfit - emp.managerProfit).toLocaleString()} د.ع
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">ربحي منه</p>
                              <p className="font-medium text-green-600">
                                {emp.managerProfit.toLocaleString()} د.ع
                              </p>
                            </div>
                          </div>
                          <div className="mt-3">
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                              <span>متوسط قيمة الطلب</span>
                              <span>{Math.round(emp.totalRevenue / emp.ordersCount).toLocaleString()} د.ع</span>
                            </div>
                            <Progress 
                              value={(emp.managerProfit / stats.totalManagerProfit) * 100} 
                              className="h-2" 
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManagerProfitsDialogV2;