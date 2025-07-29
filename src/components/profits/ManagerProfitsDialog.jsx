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
  Coins
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
  managerId 
}) => {
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState('overview');

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

  // حساب الأرباح المفصلة
  const detailedProfits = useMemo(() => {
    if (!orders || !Array.isArray(orders) || !calculateProfit) {
      console.log('❌ detailedProfits: بيانات غير متاحة', { orders: !!orders, calculateProfit: !!calculateProfit });
      return [];
    }

    return orders
      .filter(order => {
        if (!order) return false;
        
        const orderDate = new Date(order.created_at);
        const withinPeriod = orderDate >= dateRange.start && orderDate <= dateRange.end;
        const isDelivered = order.status === 'delivered' || order.status === 'completed';
        const matchesEmployee = selectedEmployee === 'all' || order.created_by === selectedEmployee;
        const matchesSearch = searchTerm === '' || 
          order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase());
        
        return withinPeriod && isDelivered && matchesEmployee && matchesSearch;
      })
      .map(order => {
        try {
          const profitCalc = calculateProfit(order);
          const employee = employees.find(emp => emp.user_id === order.created_by);
          const profitStatus = profits.find(p => p.order_id === order.id);
          
          const managerProfit = Number(profitCalc?.managerProfit || 0);
          const employeeProfit = Number(profitCalc?.employeeProfit || 0);
          const totalProfit = Number(profitCalc?.totalProfit || 0);
          const orderTotal = Number(order.final_amount || order.total_amount || 0);
          
          return {
            ...order,
            employee,
            managerProfit,
            employeeProfit,
            totalProfit,
            profitPercentage: orderTotal > 0 ? ((managerProfit / orderTotal) * 100).toFixed(1) : '0',
            isPaid: profitStatus?.status === 'settled',
            settledAt: profitStatus?.settled_at,
            items: order.items || []
          };
        } catch (error) {
          console.error('خطأ في حساب الربح للطلب:', order.id, error);
          return null;
        }
      })
      .filter(order => order !== null && order.managerProfit > 0)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [orders, dateRange, selectedEmployee, searchTerm, calculateProfit, employees, profits]);

  // إحصائيات شاملة
  const stats = useMemo(() => {
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

    const totalManagerProfit = detailedProfits.reduce((sum, order) => sum + (Number(order.managerProfit) || 0), 0);
    const totalEmployeeProfit = detailedProfits.reduce((sum, order) => sum + (Number(order.employeeProfit) || 0), 0);
    const totalRevenue = detailedProfits.reduce((sum, order) => sum + (Number(order.final_amount || order.total_amount) || 0), 0);
    const pendingProfit = detailedProfits.filter(order => !order.isPaid).reduce((sum, order) => sum + (Number(order.managerProfit) || 0), 0);
    const settledProfit = detailedProfits.filter(order => order.isPaid).reduce((sum, order) => sum + (Number(order.managerProfit) || 0), 0);
    
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
      employeeStats[order.created_by].managerProfit += Number(order.managerProfit) || 0;
      employeeStats[order.created_by].employeeProfit += Number(order.employeeProfit) || 0;
      employeeStats[order.created_by].revenue += Number(order.final_amount || order.total_amount) || 0;
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
        .sort((a, b) => (b.managerProfit || 0) - (a.managerProfit || 0))
        .slice(0, 5)
    };
  }, [detailedProfits]);

  const formatCurrency = (amount) => {
    return `${(amount || 0).toLocaleString()} د.ع`;
  };

  const StatCard = ({ title, value, icon: Icon, color, percentage, gradient }) => (
    <Card className="cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl relative overflow-hidden border-border/30">
      <CardContent className="p-0">
        <div className={`text-center space-y-3 bg-gradient-to-br ${gradient} text-white rounded-lg p-5 relative overflow-hidden`}>
          {/* الأيقونة */}
          <div className="flex justify-center">
            <div className="p-2 bg-white/20 rounded-full backdrop-blur-sm">
              <Icon className="w-6 h-6" />
            </div>
          </div>
          
          {/* العنوان والقيمة */}
          <div>
            <p className="text-xs font-medium text-white/90 mb-1">{title}</p>
            <p className="text-lg font-bold text-white">
              {typeof value === 'number' ? formatCurrency(value) : value}
            </p>
          </div>
          
          {/* نسبة مئوية إن وجدت */}
          {percentage && !isNaN(parseFloat(percentage)) && (
            <div className="pt-2 border-t border-white/20">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/80">النسبة</span>
                <span className="text-xs font-bold text-white">{percentage}%</span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-1 mt-1">
                <div 
                  className="bg-white rounded-full h-1 transition-all duration-1000"
                  style={{ width: `${Math.min(parseFloat(percentage) || 0, 100)}%` }}
                />
              </div>
            </div>
          )}
          
          {/* تأثيرات الخلفية */}
          <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-white/10 rounded-full"></div>
          <div className="absolute -top-1 -left-1 w-6 h-6 bg-white/10 rounded-full"></div>
        </div>
      </CardContent>
    </Card>
  );

  const EmployeeCard = ({ employeeData }) => (
    <Card className="relative overflow-hidden bg-gradient-to-br from-background to-muted/10 border-border/50 hover:shadow-xl hover:shadow-primary/5 transition-all duration-500 hover:-translate-y-2 group">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-green-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <CardContent className="p-6 relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow duration-300">
                <Users className="h-7 w-7 text-primary-foreground" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                {employeeData.orders}
              </div>
            </div>
            <div>
              <h3 className="font-bold text-lg text-foreground">{employeeData.employee?.full_name || 'غير محدد'}</h3>
              <p className="text-sm text-muted-foreground font-medium">{employeeData.orders} طلب مكتمل</p>
            </div>
          </div>
          <div className="text-left">
            <p className="text-xl font-bold text-green-600 mb-1">{formatCurrency(employeeData.managerProfit)}</p>
            <Badge variant="secondary" className="text-xs">ربحي منه</Badge>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 text-center">
              <p className="text-lg font-bold text-blue-600">{formatCurrency(employeeData.revenue)}</p>
              <p className="text-xs text-muted-foreground font-medium">إجمالي المبيعات</p>
            </div>
            <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/20 text-center">
              <p className="text-lg font-bold text-purple-600">{formatCurrency(employeeData.employeeProfit)}</p>
              <p className="text-xs text-muted-foreground font-medium">ربح الموظف</p>
            </div>
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-muted-foreground">نسبة المساهمة</span>
              <span className="text-sm font-bold text-primary">
                {((employeeData.managerProfit / stats.totalManagerProfit) * 100).toFixed(1)}%
              </span>
            </div>
            <Progress 
              value={(employeeData.managerProfit / stats.totalManagerProfit) * 100} 
              className="h-3" 
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const OrderCard = ({ order }) => (
    <Card className="relative overflow-hidden bg-gradient-to-br from-background to-muted/5 border-border/50 hover:shadow-xl hover:shadow-primary/5 transition-all duration-500 hover:-translate-y-1 group">
      <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <CardContent className="p-6 relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-300 ${
                order.isPaid 
                  ? 'bg-gradient-to-br from-green-500 to-green-600' 
                  : 'bg-gradient-to-br from-yellow-500 to-orange-500'
              }`}>
                {order.isPaid ? (
                  <CheckCircle className="h-6 w-6 text-white" />
                ) : (
                  <Clock className="h-6 w-6 text-white" />
                )}
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground">
                #{order.order_number?.slice(-2) || '00'}
              </div>
            </div>
            <div>
              <h4 className="font-bold text-lg text-foreground">{order.order_number}</h4>
              <p className="text-sm text-muted-foreground font-medium">{order.customer_name}</p>
              <p className="text-xs text-muted-foreground">{order.employee?.full_name || 'غير محدد'}</p>
            </div>
          </div>
          <div className="text-left">
            <p className="text-xl font-bold text-green-600 mb-1">{formatCurrency(order.managerProfit)}</p>
            <Badge variant={order.isPaid ? "default" : "secondary"} className="text-xs">
              {order.isPaid ? 'مدفوع' : 'معلق'}
            </Badge>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 text-center">
            <p className="text-sm font-bold text-blue-600">{formatCurrency(order.final_amount || order.total_amount)}</p>
            <p className="text-xs text-muted-foreground">إجمالي الطلب</p>
          </div>
          <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/20 text-center">
            <p className="text-sm font-bold text-purple-600">{formatCurrency(order.employeeProfit)}</p>
            <p className="text-xs text-muted-foreground">ربح الموظف</p>
          </div>
          <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-950/20 text-center">
            <p className="text-sm font-bold text-gray-600">{format(new Date(order.created_at), 'dd/MM/yyyy', { locale: ar })}</p>
            <p className="text-xs text-muted-foreground">التاريخ</p>
          </div>
          <div className="p-3 rounded-xl bg-green-50 dark:bg-green-950/20 text-center">
            <p className="text-sm font-bold text-green-600">{order.profitPercentage}%</p>
            <p className="text-xs text-muted-foreground">هامش الربح</p>
          </div>
        </div>
        
        {order.items && order.items.length > 0 && (
          <div className="pt-4 border-t border-border/50">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">المنتجات ({order.items.length})</p>
              <Button variant="ghost" size="sm" className="h-6 px-2">
                <Eye className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {order.items.slice(0, 4).map((item, idx) => (
                <Badge key={idx} variant="outline" className="text-xs bg-muted/30 hover:bg-muted/50 transition-colors">
                  {item.product_name} × {item.quantity}
                </Badge>
              ))}
              {order.items.length > 4 && (
                <Badge variant="outline" className="text-xs bg-primary/10 text-primary">
                  +{order.items.length - 4} منتج آخر
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl w-full max-h-[90vh] overflow-hidden p-0">
        <div className="bg-gradient-to-br from-background via-background to-muted/10 border-0 shadow-xl rounded-xl overflow-hidden">
          <DialogHeader className="bg-gradient-to-l from-primary/5 via-primary/3 to-transparent p-4 border-b border-border/30">
            <DialogTitle className="flex items-center gap-3 text-xl font-bold">
              <div className="p-2 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 shadow-md">
                <Crown className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-foreground">تفاصيل أرباحي من الموظفين</h2>
                <p className="text-sm text-muted-foreground font-medium mt-1">
                  إجمالي الأرباح: {formatCurrency(stats.totalManagerProfit || 0)} • {stats.totalOrders || 0} طلب
                </p>
              </div>
              <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary font-bold px-3 py-1">
                {formatCurrency(stats.totalManagerProfit || 0)}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
            {/* التحقق من وجود البيانات */}
            {!orders || !Array.isArray(orders) || orders.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/30 flex items-center justify-center">
                  <FileText className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">لا توجد طلبات</h3>
                <p className="text-muted-foreground">لا توجد طلبات متاحة لعرض الأرباح</p>
              </div>
            ) : !employees || employees.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/30 flex items-center justify-center">
                  <Users className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">لا يوجد موظفين</h3>
                <p className="text-muted-foreground">لا يوجد موظفين متاحين لعرض أرباحهم</p>
              </div>
            ) : (
              <>
            {/* الفلاتر */}
            <Card className="border border-border/30 bg-gradient-to-br from-muted/20 to-muted/5 shadow-md">
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-sm font-semibold mb-2 block text-foreground/80 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      الفترة الزمنية
                    </label>
                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                      <SelectTrigger className="bg-background/80 border-border/50 hover:border-primary/50 transition-colors">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="today">اليوم</SelectItem>
                        <SelectItem value="week">هذا الأسبوع</SelectItem>
                        <SelectItem value="month">هذا الشهر</SelectItem>
                        <SelectItem value="year">هذا العام</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-semibold mb-2 block text-foreground/80 flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      الموظف
                    </label>
                    <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                      <SelectTrigger className="bg-background/80 border-border/50 hover:border-primary/50 transition-colors">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">كل الموظفين</SelectItem>
                        {employees.map(emp => (
                          <SelectItem key={emp.user_id} value={emp.user_id}>
                            {emp.full_name || emp.name || 'غير محدد'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-semibold mb-2 block text-foreground/80 flex items-center gap-2">
                      <Filter className="h-4 w-4" />
                      البحث
                    </label>
                    <Input
                      placeholder="رقم الطلب أو اسم العميل..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="bg-background/80 border-border/50 hover:border-primary/50 transition-colors"
                    />
                  </div>

                  <div className="flex items-end">
                    <Button variant="outline" className="w-full bg-background/80 hover:bg-primary/10 border-border/50 hover:border-primary/50 transition-all">
                      <Download className="h-4 w-4 mr-2" />
                      تصدير التقرير
                    </Button>
                  </div>
                </div>
              </CardContent>
          </Card>

          {/* الإحصائيات الرئيسية */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              title="إجمالي أرباحي"
              value={stats.totalManagerProfit || 0}
              icon={Crown}
              gradient="from-yellow-500 to-orange-600"
            />
            <StatCard
              title="الأرباح المعلقة"
              value={stats.pendingProfit || 0}
              icon={Clock}
              gradient="from-orange-500 to-red-600"
              percentage={stats.totalManagerProfit > 0 ? (((stats.pendingProfit || 0) / stats.totalManagerProfit) * 100).toFixed(1) : '0'}
            />
            <StatCard
              title="الأرباح المدفوعة"
              value={stats.settledProfit || 0}
              icon={CheckCircle}
              gradient="from-emerald-500 to-teal-600"
              percentage={stats.totalManagerProfit > 0 ? (((stats.settledProfit || 0) / stats.totalManagerProfit) * 100).toFixed(1) : '0'}
            />
            <StatCard
              title="هامش الربح"
              value={`${stats.profitMargin || '0.0'}%`}
              icon={TrendingUp}
              gradient="from-blue-500 to-purple-600"
            />
          </div>

          {/* التبويبات */}
          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
              <TabsTrigger value="employees">تفاصيل الموظفين</TabsTrigger>
              <TabsTrigger value="orders">تفاصيل الطلبات</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* أفضل الموظفين */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="h-5 w-5" />
                      أفضل الموظفين (حسب أرباحي منهم)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-80">
                      <div className="space-y-3">
                        {stats.topEmployees.map((emp, idx) => (
                          <div key={emp.employee?.user_id || idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                                idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-orange-500' : 'bg-blue-500'
                              }`}>
                                {idx + 1}
                              </div>
                              <div>
                                <p className="font-medium">{emp.employee?.full_name || 'غير محدد'}</p>
                                <p className="text-sm text-muted-foreground">{emp.orders} طلب</p>
                              </div>
                            </div>
                            <div className="text-left">
                              <p className="font-bold text-green-600">{formatCurrency(emp.managerProfit)}</p>
                              <p className="text-sm text-muted-foreground">{formatCurrency(emp.revenue)} مبيعات</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* الإحصائيات التفصيلية */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      تحليل مفصل
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                        <p className="text-2xl font-bold text-blue-600">{stats.totalOrders}</p>
                        <p className="text-sm text-muted-foreground">إجمالي الطلبات</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-950/20">
                        <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.averageOrderValue)}</p>
                        <p className="text-sm text-muted-foreground">متوسط قيمة الطلب</p>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span>إجمالي الإيرادات</span>
                        <span className="font-medium">{formatCurrency(stats.totalRevenue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>أرباح الموظفين</span>
                        <span className="font-medium text-blue-600">{formatCurrency(stats.totalEmployeeProfit)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>أرباحي الإجمالية</span>
                        <span className="font-medium text-green-600">{formatCurrency(stats.totalManagerProfit)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="employees" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stats.topEmployees.map((empData, idx) => (
                  <EmployeeCard key={empData.employee?.user_id || idx} employeeData={empData} />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="orders" className="space-y-4">
              {detailedProfits.length > 0 ? (
                <ScrollArea className="h-96">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {detailedProfits.map((order) => (
                      <OrderCard key={order.id} order={order} />
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-12">
                  <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-muted/30 flex items-center justify-center">
                    <FileText className="h-12 w-12 text-muted-foreground/50" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">لا توجد طلبات</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    لا توجد طلبات مطابقة للفلاتر المحددة في الفترة الزمنية المختارة
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManagerProfitsDialog;