import React, { useState, useMemo } from 'react';
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
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ar } from 'date-fns/locale';

const ManagerProfitsDialog = ({ 
  isOpen, 
  onClose, 
  orders = [], 
  employees = [], 
  calculateProfit,
  profits = [],
  managerId,
  stats: externalStats // الإحصائيات المحسوبة من الصفحة الرئيسية
}) => {
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState('overview');

  console.log('🔍 ManagerProfitsDialog البيانات المستلمة:', {
    ordersCount: orders?.length || 0,
    employeesCount: employees?.length || 0,
    profitsCount: profits?.length || 0,
    hasCalculateProfit: !!calculateProfit,
    externalStats
  });

  // فلترة البيانات حسب الفترة
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (selectedPeriod) {
      case 'today':
        return { start: new Date(now.setHours(0, 0, 0, 0)), end: new Date(now.setHours(23, 59, 59, 999)) };
      case 'week':
        const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
        const weekEnd = new Date(now.setDate(weekStart.getDate() + 6));
        return { start: weekStart, end: weekEnd };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'year':
        return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear(), 11, 31) };
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  }, [selectedPeriod]);

  // حساب الأرباح المفصلة مع تحسينات
  const detailedProfits = useMemo(() => {
    console.log('🚀 بدء معالجة detailedProfits...');

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      console.log('❌ لا توجد طلبات للمعالجة');
      return [];
    }

    const processed = orders
      .filter(order => {
        if (!order || !order.id) return false;
        
        // فلترة التاريخ
        let withinPeriod = true;
        if (order.created_at && dateRange.start && dateRange.end) {
          const orderDate = new Date(order.created_at);
          if (!isNaN(orderDate.getTime())) {
            withinPeriod = orderDate >= dateRange.start && orderDate <= dateRange.end;
          }
        }
        
        // فلترة الحالة
        const isValidStatus = ['delivered', 'completed'].includes(order.status);
        
        // فلترة الموظف
        const matchesEmployee = selectedEmployee === 'all' || order.created_by === selectedEmployee;
        
        // فلترة البحث
        const matchesSearch = !searchTerm || 
          order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase());
        
        return withinPeriod && isValidStatus && matchesEmployee && matchesSearch;
      })
      .map(order => {
        try {
          // حساب المبلغ بدون أجور التوصيل
          const totalWithDelivery = Number(order.final_amount || order.total_amount || 0);
          const deliveryFee = Number(order.delivery_fee || 0);
          const totalWithoutDelivery = Math.max(0, totalWithDelivery - deliveryFee);
          
          let managerProfit = 0;
          let employeeProfit = 0;
          let totalProfit = 0;

          // البحث عن سجل الربح في قاعدة البيانات
          const profitRecord = profits?.find(p => p.order_id === order.id);
          
          if (profitRecord) {
            // استخدام البيانات الحقيقية من قاعدة البيانات
            const totalProfitFromDB = Number(profitRecord.profit_amount || 0);
            const employeeProfitFromDB = Number(profitRecord.employee_profit || 0); 
            const managerProfitFromDB = totalProfitFromDB - employeeProfitFromDB;
            
            managerProfit = managerProfitFromDB;
            employeeProfit = employeeProfitFromDB; 
            totalProfit = totalProfitFromDB;
            
            console.log(`💎 استخدام بيانات حقيقية للطلب ${order.order_number}:`, {
              totalProfit: totalProfitFromDB,
              employeeProfit: employeeProfitFromDB,
              managerProfit: managerProfitFromDB
            });
          } else if (calculateProfit && order.items && Array.isArray(order.items)) {
            // حساب الربح باستخدام دالة calculateProfit
            employeeProfit = order.items.reduce((sum, item) => {
              return sum + (calculateProfit(item, order.created_by) || 0);
            }, 0);
            
            // حساب إجمالي الربح من التكلفة والسعر
            totalProfit = order.items.reduce((sum, item) => {
              const sellPrice = item.unit_price || item.price || 0;
              const costPrice = item.cost_price || item.product_variants?.cost_price || item.products?.cost_price || 0;
              const quantity = item.quantity || 0;
              return sum + ((sellPrice - costPrice) * quantity);
            }, 0);
            
            managerProfit = Math.max(0, totalProfit - employeeProfit);
            
            console.log(`🧮 حساب دالة calculateProfit للطلب ${order.order_number}:`, {
              totalProfit,
              employeeProfit,
              managerProfit
            });
          } else {
            // حساب تقديري كبديل أخير
            totalProfit = totalWithoutDelivery * 0.15; // 15% ربح إجمالي
            employeeProfit = totalProfit * 0.3; // 30% للموظف 
            managerProfit = totalProfit * 0.7; // 70% للمدير
            
            console.log(`⚠️ حساب تقديري للطلب ${order.order_number}:`, {
              totalWithoutDelivery,
              totalProfit,
              employeeProfit,
              managerProfit
            });
          }
          
          const employee = employees.find(emp => emp.user_id === order.created_by);
          const profitStatus = profits.find(p => p.order_id === order.id);
          
          return {
            ...order,
            employee,
            orderTotal: totalWithoutDelivery,
            deliveryFee: deliveryFee,
            totalWithDelivery: totalWithDelivery,
            managerProfit: Math.round(managerProfit),
            employeeProfit: Math.round(employeeProfit),
            totalProfit: Math.round(totalProfit),
            profitPercentage: totalWithoutDelivery > 0 ? ((totalProfit / totalWithoutDelivery) * 100).toFixed(1) : '0',
            isPaid: profitStatus?.status === 'settled' || profitStatus?.settled_at,
            settledAt: profitStatus?.settled_at,
            items: order.items || []
          };
        } catch (error) {
          console.error('❌ خطأ في حساب الربح للطلب:', order.id, error);
          return null;
        }
      })
      .filter(order => order !== null)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    console.log('✅ الطلبات المعالجة النهائية:', {
      count: processed.length,
      totalManagerProfit: processed.reduce((sum, order) => sum + order.managerProfit, 0),
      totalEmployeeProfit: processed.reduce((sum, order) => sum + order.employeeProfit, 0)
    });

    return processed;
  }, [orders, dateRange, selectedEmployee, searchTerm, calculateProfit, employees, profits]);

  // إحصائيات شاملة
  const stats = useMemo(() => {
    // استخدم الإحصائيات الخارجية إذا كانت متوفرة، وإلا احسبها من detailedProfits
    if (externalStats && typeof externalStats === 'object') {
      console.log('📊 استخدام الإحصائيات الخارجية:', externalStats);
      
      // حساب أرباح الموظفين من البيانات المفلترة
      const totalEmployeeProfit = detailedProfits.reduce((sum, order) => sum + order.employeeProfit, 0);
      
      // حساب أفضل الموظفين من البيانات المفلترة
      const employeeStats = detailedProfits.reduce((acc, order) => {
        if (order.employee && order.employeeProfit > 0) {
          const empId = order.employee.user_id;
          if (!acc[empId]) {
            acc[empId] = {
              employee: order.employee,
              totalProfit: 0,
              totalOrders: 0,
              totalSales: 0
            };
          }
          acc[empId].totalProfit += order.employeeProfit;
          acc[empId].totalOrders += 1;
          acc[empId].totalSales += order.orderTotal;
        }
        return acc;
      }, {});
      
      const topEmployees = Object.values(employeeStats)
        .sort((a, b) => b.totalProfit - a.totalProfit)
        .slice(0, 5);
      
      return {
        totalManagerProfit: externalStats.totalManagerProfits || 0,
        totalEmployeeProfit,
        totalRevenue: externalStats.totalSales || 0,
        pendingProfit: externalStats.pendingDues || 0,
        settledProfit: externalStats.paidDues || 0,
        totalOrders: externalStats.totalOrders || detailedProfits.length,
        averageOrderValue: externalStats.totalOrders > 0 ? (externalStats.totalSales / externalStats.totalOrders) : 0,
        profitMargin: externalStats.totalSales > 0 ? ((externalStats.totalManagerProfits / externalStats.totalSales) * 100).toFixed(1) : '0.0',
        topEmployees
      };
    }

    // حساب من detailedProfits
    if (!detailedProfits || !Array.isArray(detailedProfits)) {
      return {
        totalManagerProfit: 0,
        totalEmployeeProfit: 0,
        totalRevenue: 0,
        pendingProfit: 0,
        settledProfit: 0,
        totalOrders: 0,
        averageOrderValue: 0,
        profitMargin: '0.0',
        topEmployees: []
      };
    }

    const totalManagerProfit = detailedProfits.reduce((sum, order) => sum + order.managerProfit, 0);
    const totalEmployeeProfit = detailedProfits.reduce((sum, order) => sum + order.employeeProfit, 0);
    const totalRevenue = detailedProfits.reduce((sum, order) => sum + order.orderTotal, 0);
    const pendingProfit = detailedProfits.filter(order => !order.isPaid).reduce((sum, order) => sum + order.employeeProfit, 0);
    const settledProfit = detailedProfits.filter(order => order.isPaid).reduce((sum, order) => sum + order.employeeProfit, 0);

    // حساب أفضل الموظفين
    const employeeStats = detailedProfits.reduce((acc, order) => {
      if (order.employee && order.employeeProfit > 0) {
        const empId = order.employee.user_id;
        if (!acc[empId]) {
          acc[empId] = {
            employee: order.employee,
            totalProfit: 0,
            totalOrders: 0,
            totalSales: 0
          };
        }
        acc[empId].totalProfit += order.employeeProfit;
        acc[empId].totalOrders += 1;
        acc[empId].totalSales += order.orderTotal;
      }
      return acc;
    }, {});

    const topEmployees = Object.values(employeeStats)
      .sort((a, b) => b.totalProfit - a.totalProfit)
      .slice(0, 5);

    return {
      totalManagerProfit,
      totalEmployeeProfit,
      totalRevenue,
      pendingProfit,
      settledProfit,
      totalOrders: detailedProfits.length,
      averageOrderValue: detailedProfits.length > 0 ? totalRevenue / detailedProfits.length : 0,
      profitMargin: totalRevenue > 0 ? ((totalManagerProfit / totalRevenue) * 100).toFixed(1) : '0.0',
      topEmployees
    };
  }, [detailedProfits, externalStats]);

  // مكونات العرض
  const StatCard = ({ title, value, icon: Icon, color = "blue", subtitle }) => (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className={`p-3 rounded-full bg-${color}-500/10`}>
            <Icon className={`w-6 h-6 text-${color}-500`} />
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-transparent to-white/5"></div>
      </CardContent>
    </Card>
  );

  const EmployeeCard = ({ employeeData }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
              {employeeData.employee?.full_name?.charAt(0) || 'م'}
            </div>
            <div>
              <h4 className="font-semibold">{employeeData.employee?.full_name || 'غير معروف'}</h4>
              <p className="text-sm text-muted-foreground">{employeeData.totalOrders} طلب</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-bold text-lg text-green-600">{employeeData.totalProfit.toLocaleString()} د.ع</p>
            <p className="text-sm text-muted-foreground">متوسط: {Math.round(employeeData.totalProfit / employeeData.totalOrders).toLocaleString()} د.ع</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const OrderRow = ({ order }) => (
    <div className="flex items-center justify-between p-4 border-b last:border-b-0 hover:bg-muted/50">
      <div className="flex-1">
        <div className="font-medium">{order.order_number}</div>
        <div className="text-sm text-muted-foreground">{order.customer_name}</div>
        <div className="text-xs text-muted-foreground">{order.employee?.full_name}</div>
      </div>
      <div className="text-center">
        <div className="font-medium">{order.orderTotal.toLocaleString()} د.ع</div>
        <div className="text-sm text-muted-foreground">المبيعات</div>
      </div>
      <div className="text-center">
        <div className="font-medium text-blue-600">{order.employeeProfit.toLocaleString()} د.ع</div>
        <div className="text-sm text-muted-foreground">ربح الموظف</div>
      </div>
      <div className="text-center">
        <div className="font-medium text-green-600">{order.managerProfit.toLocaleString()} د.ع</div>
        <div className="text-sm text-muted-foreground">ربح المدير</div>
      </div>
      <div className="text-center">
        <Badge variant={order.isPaid ? "success" : "warning"}>
          {order.isPaid ? "مدفوع" : "معلق"}
        </Badge>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="w-6 h-6 text-yellow-500" />
            تفاصيل أرباحي من الموظفين
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col h-full">
          {/* الفلاتر */}
          <div className="flex flex-wrap gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="الفترة الزمنية" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">اليوم</SelectItem>
                <SelectItem value="week">هذا الأسبوع</SelectItem>
                <SelectItem value="month">هذا الشهر</SelectItem>
                <SelectItem value="year">هذا العام</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="الموظف" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الموظفين</SelectItem>
                {employees.map(emp => (
                  <SelectItem key={emp.user_id} value={emp.user_id}>
                    {emp.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="ابحث بالطلب أو اسم العميل..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-xs"
            />

            <Button variant="outline" onClick={() => {
              setSelectedPeriod('month');
              setSelectedEmployee('all');
              setSearchTerm('');
            }}>
              إعادة تعيين
            </Button>
          </div>

          {/* المحتوى الرئيسي */}
          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="flex-1">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
              <TabsTrigger value="employees">أفضل الموظفين</TabsTrigger>
              <TabsTrigger value="orders">تفاصيل الطلبات</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* إحصائيات سريعة */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="إجمالي أرباحي"
                  value={`${stats.totalManagerProfit.toLocaleString()} د.ع`}
                  icon={Crown}
                  color="yellow"
                  subtitle={`من ${stats.totalOrders} طلب`}
                />
                <StatCard
                  title="أرباح الموظفين"
                  value={`${stats.totalEmployeeProfit.toLocaleString()} د.ع`}
                  icon={Users}
                  color="blue"
                />
                <StatCard
                  title="الأرباح المعلقة"
                  value={`${stats.pendingProfit.toLocaleString()} د.ع`}
                  icon={Clock}
                  color="orange"
                />
                <StatCard
                  title="الأرباح المدفوعة"
                  value={`${stats.settledProfit.toLocaleString()} د.ع`}
                  icon={CheckCircle}
                  color="green"
                />
              </div>

              {/* تحليل مفصل */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      تحليل مفصل
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between">
                      <span>إجمالي الإيرادات</span>
                      <span className="font-bold">{stats.totalRevenue.toLocaleString()} د.ع</span>
                    </div>
                    <div className="flex justify-between">
                      <span>أرباح الموظفين</span>
                      <span className="text-blue-600">{stats.totalEmployeeProfit.toLocaleString()} د.ع</span>
                    </div>
                    <div className="flex justify-between">
                      <span>أرباحي الإجمالية</span>
                      <span className="text-green-600">{stats.totalManagerProfit.toLocaleString()} د.ع</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span>هامش الربح</span>
                      <span className="font-bold">{stats.profitMargin}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>متوسط قيمة الطلب</span>
                      <span className="font-bold">{Math.round(stats.averageOrderValue).toLocaleString()} د.ع</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="w-5 h-5" />
                      نسبة توزيع الأرباح
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-2">
                          <span>أرباحي</span>
                          <span>{stats.totalManagerProfit > 0 ? Math.round((stats.totalManagerProfit / (stats.totalManagerProfit + stats.totalEmployeeProfit)) * 100) : 0}%</span>
                        </div>
                        <Progress 
                          value={stats.totalManagerProfit > 0 ? (stats.totalManagerProfit / (stats.totalManagerProfit + stats.totalEmployeeProfit)) * 100 : 0} 
                          className="h-2" 
                        />
                      </div>
                      <div>
                        <div className="flex justify-between mb-2">
                          <span>أرباح الموظفين</span>
                          <span>{stats.totalEmployeeProfit > 0 ? Math.round((stats.totalEmployeeProfit / (stats.totalManagerProfit + stats.totalEmployeeProfit)) * 100) : 0}%</span>
                        </div>
                        <Progress 
                          value={stats.totalEmployeeProfit > 0 ? (stats.totalEmployeeProfit / (stats.totalManagerProfit + stats.totalEmployeeProfit)) * 100 : 0} 
                          className="h-2" 
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="employees" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">أفضل الموظفين (حسب أرباحي منهم)</h3>
                <Badge variant="outline">{stats.topEmployees?.length || 0} موظف</Badge>
              </div>
              
              {stats.topEmployees && stats.topEmployees.length > 0 ? (
                <div className="space-y-3">
                  {stats.topEmployees.map((emp, index) => (
                    <div key={emp.employee.user_id} className="relative">
                      {index === 0 && <Award className="absolute -top-2 -right-2 w-6 h-6 text-yellow-500" />}
                      <EmployeeCard employeeData={emp} />
                    </div>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-8">
                    <Users className="w-12 h-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">لا توجد بيانات موظفين</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      تأكد من وجود طلبات مكتملة في الفترة المحددة
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="orders" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">تفاصيل الطلبات</h3>
                <Badge variant="outline">{detailedProfits?.length || 0} طلب</Badge>
              </div>
              
              {detailedProfits && detailedProfits.length > 0 ? (
                <Card>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[400px]">
                      {detailedProfits.map(order => (
                        <OrderRow key={order.id} order={order} />
                      ))}
                    </ScrollArea>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-8">
                    <Package className="w-12 h-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">لا توجد طلبات تطابق الفلاتر</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      جرب تغيير الفترة الزمنية أو الموظف
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>

          {/* أزرار الإجراءات */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              إغلاق
            </Button>
            <Button onClick={() => {/* تصدير التقرير */}}>
              <Download className="w-4 h-4 mr-2" />
              تصدير التقرير
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManagerProfitsDialog;