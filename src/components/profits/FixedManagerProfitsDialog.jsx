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
import { format, startOfMonth, endOfMonth, isValid, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';

const FixedManagerProfitsDialog = ({ 
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

  console.log('🔍 FixedManagerProfitsDialog Props:', {
    isOpen,
    ordersCount: orders?.length || 0,
    employeesCount: employees?.length || 0,
    profitsCount: profits?.length || 0,
    calculateProfitExists: !!calculateProfit,
    externalStats
  });

  // فلترة البيانات حسب الفترة
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (selectedPeriod) {
      case 'today':
        const today = new Date();
        return { 
          start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0), 
          end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59) 
        };
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        return { start: weekStart, end: weekEnd };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'all':
      default:
        return { start: new Date(2020, 0, 1), end: new Date(2030, 11, 31) };
    }
  }, [selectedPeriod]);

  // الطلبات المفصلة مع حساب الأرباح
  const detailedProfits = useMemo(() => {
    console.log('🔧 معالجة detailedProfits:', {
      ordersCount: orders?.length || 0,
      employeesCount: employees?.length || 0,
      selectedPeriod,
      dateRange: { start: dateRange.start, end: dateRange.end },
      selectedEmployee
    });

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      console.warn('❌ detailedProfits: لا توجد طلبات');
      return [];
    }

    if (!employees || !Array.isArray(employees) || employees.length === 0) {
      console.warn('❌ detailedProfits: لا يوجد موظفين');
      return [];
    }

    // فلترة الطلبات
    const processed = orders
      .filter(order => {
        if (!order) return false;
        
        // فلترة الفترة الزمنية - أكثر دقة
        let withinPeriod = true;
        if (selectedPeriod !== 'all' && order.created_at) {
          const orderDate = new Date(order.created_at);
          if (!isNaN(orderDate.getTime())) {
            withinPeriod = orderDate >= dateRange.start && orderDate <= dateRange.end;
          }
        }
        
        // فلترة الحالة - طلبات مكتملة أو مسلمة فقط
        const isValidStatus = ['delivered', 'completed'].includes(order.status);
        
        // فلترة الموظف
        const matchesEmployee = selectedEmployee === 'all' || order.created_by === selectedEmployee;
        
        // فلترة البحث
        const matchesSearch = !searchTerm || 
          order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase());
        
        const finalResult = withinPeriod && isValidStatus && matchesEmployee && matchesSearch;
        
        return finalResult;
      })
      .map(order => {
        try {
          // حساب المبلغ بدون أجور التوصيل
          const totalWithDelivery = Number(order.final_amount || order.total_amount || 0);
          const deliveryFee = Number(order.delivery_fee || 0);
          const totalWithoutDelivery = Math.max(0, totalWithDelivery - deliveryFee);
          
          // حساب الربح بطريقة آمنة
          let managerProfit = 0;
          let employeeProfit = 0;
          let totalProfit = 0;
          let systemProfit = 0;

          if (calculateProfit && typeof calculateProfit === 'function') {
            try {
              let profitCalc;
              try {
                profitCalc = calculateProfit(order.id);
              } catch (e) {
                profitCalc = calculateProfit(order);
              }
              
              if (profitCalc && typeof profitCalc === 'object') {
                systemProfit = Number(profitCalc.systemProfit || profitCalc.managerProfit || 0);
                employeeProfit = Number(profitCalc.employeeProfit || 0);
                totalProfit = Number(profitCalc.totalProfit || profitCalc.netProfit || (systemProfit + employeeProfit));
                managerProfit = systemProfit;
              } else if (typeof profitCalc === 'number') {
                totalProfit = Number(profitCalc || 0);
                systemProfit = totalProfit * 0.7;
                employeeProfit = totalProfit * 0.3;
                managerProfit = systemProfit;
              }
            } catch (error) {
              console.error(`❌ خطأ في تنفيذ دالة حساب الربح للطلب ${order.order_number}:`, error);
              totalProfit = totalWithoutDelivery * 0.2;
              systemProfit = totalProfit * 0.6;
              employeeProfit = totalProfit * 0.4;
              managerProfit = systemProfit;
            }
          } else {
            // حساب افتراضي
            totalProfit = totalWithoutDelivery * 0.2;
            systemProfit = totalProfit * 0.6;
            employeeProfit = totalProfit * 0.4;
            managerProfit = systemProfit;
          }

          // معلومات الموظف
          const employee = employees.find(emp => emp.user_id === order.created_by) || { 
            user_id: order.created_by, 
            full_name: 'موظف غير معروف' 
          };

          // حالة الربح
          const profitStatus = profits?.find(p => p.order_id === order.id) || null;

          return {
            id: order.id,
            order_number: order.order_number,
            customer_name: order.customer_name,
            created_at: order.created_at,
            status: order.status,
            created_by: order.created_by,
            employee: employee.full_name || 'غير معروف',
            orderTotal: totalWithoutDelivery,
            managerProfit,
            employeeProfit,
            totalProfit,
            isPaid: profitStatus?.status === 'settled',
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
      processedCount: processed.length,
      totalManagerProfit: processed.reduce((sum, order) => sum + order.managerProfit, 0)
    });

    return processed;
  }, [orders, dateRange, selectedEmployee, searchTerm, calculateProfit, employees, profits, selectedPeriod]);

  // إحصائيات شاملة
  const stats = useMemo(() => {
    if (externalStats && typeof externalStats === 'object') {
      console.log('📊 استخدام الإحصائيات من الصفحة الرئيسية:', externalStats);
      return {
        totalManagerProfit: externalStats.totalManagerProfits || 0,
        totalEmployeeProfit: detailedProfits.reduce((sum, order) => sum + order.employeeProfit, 0),
        totalRevenue: externalStats.totalSales || 0,
        pendingProfit: externalStats.pendingDues || 0,
        settledProfit: externalStats.paidDues || 0,
        totalOrders: externalStats.totalOrders || 0,
        averageOrderValue: externalStats.totalOrders > 0 ? (externalStats.totalSales / externalStats.totalOrders) : 0,
        profitMargin: externalStats.totalSales > 0 ? ((externalStats.totalManagerProfits / externalStats.totalSales) * 100).toFixed(1) : '0.0',
        topEmployees: []
      };
    }

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
    const pendingProfit = detailedProfits.filter(order => !order.isPaid).reduce((sum, order) => sum + order.managerProfit, 0);
    const settledProfit = detailedProfits.filter(order => order.isPaid).reduce((sum, order) => sum + order.managerProfit, 0);
    
    const employeeStats = {};
    detailedProfits.forEach(order => {
      if (!employeeStats[order.created_by]) {
        employeeStats[order.created_by] = {
          employee: order.employee,
          orders: 0,
          managerProfit: 0,
          employeeProfit: 0,
          revenue: 0
        };
      }
      employeeStats[order.created_by].orders += 1;
      employeeStats[order.created_by].managerProfit += order.managerProfit;
      employeeStats[order.created_by].employeeProfit += order.employeeProfit;
      employeeStats[order.created_by].revenue += order.orderTotal;
    });

    return {
      totalManagerProfit,
      totalEmployeeProfit,
      totalRevenue,
      pendingProfit,
      settledProfit,
      totalOrders: detailedProfits.length,
      averageOrderValue: detailedProfits.length > 0 ? totalRevenue / detailedProfits.length : 0,
      profitMargin: totalRevenue > 0 ? ((totalManagerProfit / totalRevenue) * 100).toFixed(1) : '0.0',
      topEmployees: Object.values(employeeStats)
        .sort((a, b) => b.managerProfit - a.managerProfit)
        .slice(0, 5)
    };
  }, [detailedProfits, externalStats]);

  const formatCurrency = (amount) => `${(amount || 0).toLocaleString()} د.ع`;

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden">
        <DialogHeader className="pb-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-r from-yellow-500 to-orange-600 rounded-full text-white shadow-lg">
              <Crown className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-foreground">تفاصيل أرباحي من الموظفين</h2>
              <p className="text-sm text-muted-foreground font-medium mt-1">
                إجمالي الأرباح: {formatCurrency(stats.totalManagerProfit || 0)} • {stats.totalOrders || 0} طلب
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="h-full overflow-hidden">
          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
              <TabsTrigger value="employees">تفاصيل الموظفين</TabsTrigger>
              <TabsTrigger value="orders">تفاصيل الطلبات</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-hidden">
              <TabsContent value="overview" className="mt-4 h-full overflow-auto">
                <div className="space-y-6">
                  {/* الإحصائيات الرئيسية */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white">
                      <CardContent className="p-4 text-center">
                        <DollarSign className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-xs opacity-90">إجمالي أرباحي</p>
                        <p className="text-xl font-bold">{formatCurrency(stats.totalManagerProfit)}</p>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                      <CardContent className="p-4 text-center">
                        <TrendingUp className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-xs opacity-90">إجمالي الإيرادات</p>
                        <p className="text-xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-gradient-to-br from-orange-500 to-red-600 text-white">
                      <CardContent className="p-4 text-center">
                        <Clock className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-xs opacity-90">أرباح معلقة</p>
                        <p className="text-xl font-bold">{formatCurrency(stats.pendingProfit)}</p>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-gradient-to-br from-purple-500 to-pink-600 text-white">
                      <CardContent className="p-4 text-center">
                        <CheckCircle className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-xs opacity-90">أرباح مستلمة</p>
                        <p className="text-xl font-bold">{formatCurrency(stats.settledProfit)}</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* المؤشرات التحليلية */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Target className="w-5 h-5" />
                          هامش الربح
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-primary mb-2">{stats.profitMargin}%</div>
                        <Progress value={parseFloat(stats.profitMargin)} className="w-full" />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <BarChart3 className="w-5 h-5" />
                          متوسط قيمة الطلب
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-primary">
                          {formatCurrency(stats.averageOrderValue)}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Package className="w-5 h-5" />
                          عدد الطلبات
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-primary">{stats.totalOrders}</div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="employees" className="mt-4 h-full overflow-auto">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">أفضل الموظفين</h3>
                  {stats.topEmployees.length > 0 ? (
                    <div className="grid gap-4">
                      {stats.topEmployees.map((emp, index) => (
                        <Card key={emp.employee} className="hover:shadow-lg transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-full">
                                  <Award className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                  <h4 className="font-semibold">{emp.employee}</h4>
                                  <p className="text-sm text-muted-foreground">{emp.orders} طلبات</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold text-green-600">
                                  {formatCurrency(emp.managerProfit)}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  إيرادات: {formatCurrency(emp.revenue)}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      لا توجد بيانات موظفين
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="orders" className="mt-4 h-full overflow-hidden">
                <div className="space-y-4 h-full flex flex-col">
                  {/* الفلاتر */}
                  <div className="flex gap-4 flex-wrap">
                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="اختر الفترة" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="today">اليوم</SelectItem>
                        <SelectItem value="week">هذا الأسبوع</SelectItem>
                        <SelectItem value="month">هذا الشهر</SelectItem>
                        <SelectItem value="all">كل الفترات</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="اختر موظف" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">كل الموظفين</SelectItem>
                        {employees.map(emp => (
                          <SelectItem key={emp.user_id} value={emp.user_id}>
                            {emp.full_name || 'غير معروف'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Input
                      placeholder="البحث في الطلبات..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="max-w-sm"
                    />
                  </div>

                  {/* قائمة الطلبات */}
                  <div className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full">
                      <div className="space-y-3">
                        {detailedProfits.length > 0 ? (
                          detailedProfits.map(order => (
                            <Card key={order.id} className="hover:shadow-lg transition-shadow">
                              <CardContent className="p-4">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <div className="flex items-center gap-2 mb-2">
                                      <Badge variant="outline">{order.order_number}</Badge>
                                      <Badge variant={order.isPaid ? "default" : "secondary"}>
                                        {order.isPaid ? "مسوى" : "معلق"}
                                      </Badge>
                                    </div>
                                    <p className="font-medium">{order.customer_name}</p>
                                    <p className="text-sm text-muted-foreground">بواسطة: {order.employee}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {format(parseISO(order.created_at), 'dd MMM yyyy', { locale: ar })}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-lg font-bold text-green-600">
                                      {formatCurrency(order.managerProfit)}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      إجمالي: {formatCurrency(order.orderTotal)}
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            لا توجد طلبات تطابق الفلاتر المحددة
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FixedManagerProfitsDialog;