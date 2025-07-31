import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  CheckCircle, 
  FileText,
  Crown,
  UserCheck
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const ManagerProfitsDialog = ({ 
  isOpen, 
  onClose, 
  orders = [], 
  employees = [], 
  profits = []
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  console.log('🔍 ManagerProfitsDialog - البيانات الواردة:', {
    ordersCount: orders?.length || 0,
    employeesCount: employees?.length || 0,
    profitsCount: profits?.length || 0
  });

  // فلترة البيانات حسب الفترة
  const dateRange = useMemo(() => {
    const now = new Date();
    
    switch (selectedPeriod) {
      case 'today':
        return {
          start: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0),
          end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
        };
      case 'week':
        const currentDay = now.getDay();
        const daysToStartOfWeek = currentDay === 0 ? 6 : currentDay - 1;
        const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToStartOfWeek, 0, 0, 0, 0);
        return {
          start: weekStart,
          end: new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6, 23, 59, 59, 999)
        };
      case 'month':
        return {
          start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
          end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
        };
      case 'year':
        return {
          start: new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0),
          end: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
        };
      default:
        return {
          start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
          end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
        };
    }
  }, [selectedPeriod]);

  // الحصول على الطلبات المفلترة والأرباح الحقيقية
  const filteredData = useMemo(() => {
    console.log('🔄 معالجة البيانات المفلترة...');
    
    // فلترة الطلبات حسب الفترة والحالة
    const filteredOrders = orders.filter(order => {
      if (!order.created_at) return false;
      
      const orderDate = new Date(order.created_at);
      const withinPeriod = orderDate >= dateRange.start && orderDate <= dateRange.end;
      const isCompleted = ['delivered', 'completed'].includes(order.status) && order.receipt_received === true;
      
      return withinPeriod && isCompleted;
    });

    console.log('✅ الطلبات المفلترة:', {
      totalFilteredOrders: filteredOrders.length,
      dateRange: {
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString()
      }
    });

    // ربط الطلبات بالأرباح الحقيقية من قاعدة البيانات
    const ordersWithRealProfits = filteredOrders.map(order => {
      const profitRecord = profits.find(p => p.order_id === order.id);
      const employee = employees.find(emp => emp.user_id === order.created_by);
      
      // استخدام البيانات الحقيقية من جدول profits
      let managerProfit = 0;
      let employeeProfit = 0;
      let totalProfit = 0;
      let totalRevenue = 0;
      let totalCost = 0;
      
      if (profitRecord) {
        totalRevenue = Number(profitRecord.total_revenue || 0);
        totalCost = Number(profitRecord.total_cost || 0);
        totalProfit = Number(profitRecord.profit_amount || 0);
        employeeProfit = Number(profitRecord.employee_profit || 0);
        managerProfit = totalProfit - employeeProfit;
        
        console.log(`💰 ربح حقيقي للطلب ${order.order_number}:`, {
          totalRevenue,
          totalCost,
          totalProfit,
          employeeProfit,
          managerProfit,
          status: profitRecord.status
        });
      } else {
        console.log(`⚠️ لا يوجد سجل ربح للطلب ${order.order_number}`);
      }

      return {
        ...order,
        employee,
        profitRecord,
        totalRevenue,
        totalCost,
        totalProfit,
        employeeProfit,
        managerProfit,
        isPaid: profitRecord?.status === 'settled',
        settledAt: profitRecord?.settled_at
      };
    });

    console.log('📊 الطلبات مع الأرباح الحقيقية:', {
      ordersWithProfits: ordersWithRealProfits.length,
      totalManagerProfit: ordersWithRealProfits.reduce((sum, order) => sum + order.managerProfit, 0),
      totalEmployeeProfit: ordersWithRealProfits.reduce((sum, order) => sum + order.employeeProfit, 0)
    });

    return ordersWithRealProfits;
  }, [orders, profits, employees, dateRange]);

  // حساب الإحصائيات
  const stats = useMemo(() => {
    const totalManagerProfit = filteredData.reduce((sum, order) => sum + order.managerProfit, 0);
    const totalEmployeeProfit = filteredData.reduce((sum, order) => sum + order.employeeProfit, 0);
    const totalRevenue = filteredData.reduce((sum, order) => sum + order.totalRevenue, 0);
    const totalOrders = filteredData.length;
    const pendingProfit = filteredData.filter(order => !order.isPaid).reduce((sum, order) => sum + order.managerProfit, 0);
    const settledProfit = filteredData.filter(order => order.isPaid).reduce((sum, order) => sum + order.managerProfit, 0);

    // إحصائيات الموظفين
    const employeeStats = {};
    filteredData.forEach(order => {
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
      employeeStats[order.created_by].revenue += order.totalRevenue;
    });

    const topEmployees = Object.values(employeeStats)
      .sort((a, b) => b.managerProfit - a.managerProfit)
      .slice(0, 5);

    const calculatedStats = {
      totalManagerProfit,
      totalEmployeeProfit,
      totalRevenue,
      pendingProfit,
      settledProfit,
      totalOrders,
      averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      profitMargin: totalRevenue > 0 ? ((totalManagerProfit / totalRevenue) * 100).toFixed(1) : '0.0',
      topEmployees
    };

    console.log('📈 الإحصائيات المحسوبة:', calculatedStats);

    return calculatedStats;
  }, [filteredData]);

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '0 د.ع';
    
    const number = Number(amount);
    if (isNaN(number)) return '0 د.ع';
    
    return new Intl.NumberFormat('ar-IQ', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(number) + ' د.ع';
  };

  const StatCard = ({ title, value, icon: Icon, gradient }) => (
    <Card className="relative overflow-hidden border-border/30">
      <CardContent className="p-0">
        <div className={`p-4 bg-gradient-to-br ${gradient} text-white`}>
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-white/20 rounded-full">
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-white/90">{title}</p>
          </div>
          <p className="text-xl font-bold text-white">
            {typeof value === 'number' ? formatCurrency(value) : value}
          </p>
        </div>
      </CardContent>
    </Card>
  );

  const EmployeeCard = ({ employeeData }) => (
    <Card className="border-border/50 hover:shadow-lg transition-all duration-300">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
              <Users className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-bold text-base">{employeeData.employee?.full_name || 'غير محدد'}</h3>
              <p className="text-sm text-muted-foreground">{employeeData.orders} طلب</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-green-600">{formatCurrency(employeeData.managerProfit)}</p>
            <Badge variant="secondary" className="text-xs">ربحي منه</Badge>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-center">
            <p className="text-sm font-bold text-blue-600">{formatCurrency(employeeData.revenue)}</p>
            <p className="text-xs text-muted-foreground">المبيعات</p>
          </div>
          <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/20 text-center">
            <p className="text-sm font-bold text-purple-600">{formatCurrency(employeeData.employeeProfit)}</p>
            <p className="text-xs text-muted-foreground">ربح الموظف</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl w-full max-h-[90vh] overflow-hidden p-0">
        <div className="bg-gradient-to-br from-background to-muted/10 rounded-lg overflow-hidden">
          <DialogHeader className="bg-gradient-to-l from-primary/5 to-transparent p-4 border-b">
            <DialogTitle className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20">
                <Crown className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold">تفاصيل أرباحي من الموظفين</h2>
                <p className="text-sm text-muted-foreground">
                  إجمالي الأرباح: {formatCurrency(stats.totalManagerProfit)} • {stats.totalOrders} طلب
                </p>
              </div>
              <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary font-bold">
                {formatCurrency(stats.totalManagerProfit)}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
            {/* فلتر الفترة */}
            <div className="flex items-center gap-4">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="اختر الفترة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">اليوم</SelectItem>
                  <SelectItem value="week">هذا الأسبوع</SelectItem>
                  <SelectItem value="month">هذا الشهر</SelectItem>
                  <SelectItem value="year">هذه السنة</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* إحصائيات سريعة */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard
                title="إجمالي أرباحي"
                value={stats.totalManagerProfit}
                icon={DollarSign}
                gradient="from-green-500 to-green-600"
              />
              <StatCard
                title="أرباح الموظفين"
                value={stats.totalEmployeeProfit}
                icon={Users}
                gradient="from-purple-500 to-purple-600"
              />
              <StatCard
                title="مستحقات معلقة"
                value={stats.pendingProfit}
                icon={TrendingUp}
                gradient="from-orange-500 to-orange-600"
              />
              <StatCard
                title="مستحقات مدفوعة"
                value={stats.settledProfit}
                icon={CheckCircle}
                gradient="from-blue-500 to-blue-600"
              />
            </div>

            {/* أفضل الموظفين */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <UserCheck className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-bold">أفضل الموظفين (حسب أرباحي منهم)</h3>
              </div>
              
              {stats.topEmployees.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {stats.topEmployees.map((employeeData, index) => (
                    <EmployeeCard key={index} employeeData={employeeData} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/30 flex items-center justify-center">
                    <Users className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <p className="text-muted-foreground">لا توجد بيانات موظفين</p>
                </div>
              )}
            </div>

            {/* تحليل مفصل */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-bold">تحليل مفصل</h3>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/20 rounded-lg">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{stats.totalOrders}</p>
                  <p className="text-sm text-muted-foreground">إجمالي الطلبات</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(stats.averageOrderValue)}</p>
                  <p className="text-sm text-muted-foreground">متوسط قيمة الطلب</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalRevenue)}</p>
                  <p className="text-sm text-muted-foreground">إجمالي الإيرادات</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-600">{stats.profitMargin}%</p>
                  <p className="text-sm text-muted-foreground">هامش الربح</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManagerProfitsDialog;