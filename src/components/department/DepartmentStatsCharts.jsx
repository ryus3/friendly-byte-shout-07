import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Users, TrendingUp, Target, Award, Truck, XCircle } from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';
import { ar } from 'date-fns/locale';

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
const STATUS_COLORS = {
  delivered: '#22c55e',
  inTransit: '#3b82f6', 
  pending: '#f59e0b',
  returned: '#ef4444',
  cancelled: '#6b7280'
};

const DepartmentStatsCharts = ({ supervisedEmployeeIds = [], supervisedEmployees = [] }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // جلب الطلبات التفصيلية
  useEffect(() => {
    const fetchOrders = async () => {
      if (supervisedEmployeeIds.length === 0) {
        setLoading(false);
        return;
      }

      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      
      const { data, error } = await supabase
        .from('orders')
        .select('id, final_amount, delivery_fee, created_by, delivery_status, created_at')
        .in('created_by', supervisedEmployeeIds)
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setOrders(data);
      }
      setLoading(false);
    };

    fetchOrders();
  }, [supervisedEmployeeIds]);

  // 1. بيانات أداء الموظفين (Bar Chart)
  const employeePerformance = useMemo(() => {
    const empStats = {};
    
    supervisedEmployees.forEach(emp => {
      if (emp?.user_id) {
        empStats[emp.user_id] = {
          name: emp.full_name?.split(' ')[0] || 'موظف',
          orders: 0,
          sales: 0,
          delivered: 0
        };
      }
    });

    orders.forEach(order => {
      if (empStats[order.created_by]) {
        empStats[order.created_by].orders++;
        empStats[order.created_by].sales += (order.final_amount || 0) - (order.delivery_fee || 0);
        if (order.delivery_status === '4') {
          empStats[order.created_by].delivered++;
        }
      }
    });

    return Object.values(empStats)
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 6);
  }, [orders, supervisedEmployees]);

  // 2. اتجاه المبيعات اليومي (Line Chart)
  const salesTrend = useMemo(() => {
    const dailyData = {};
    const last7Days = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const key = format(date, 'yyyy-MM-dd');
      dailyData[key] = { 
        date: format(date, 'EEE', { locale: ar }), 
        orders: 0, 
        sales: 0 
      };
      last7Days.push(key);
    }

    orders.forEach(order => {
      const orderDate = format(new Date(order.created_at), 'yyyy-MM-dd');
      if (dailyData[orderDate]) {
        dailyData[orderDate].orders++;
        dailyData[orderDate].sales += (order.final_amount || 0) - (order.delivery_fee || 0);
      }
    });

    return last7Days.map(key => dailyData[key]);
  }, [orders]);

  // 3. توزيع حالات الطلبات (Pie Chart)
  const statusDistribution = useMemo(() => {
    const stats = {
      delivered: 0,
      inTransit: 0,
      pending: 0,
      returned: 0,
      cancelled: 0
    };

    orders.forEach(order => {
      switch (order.delivery_status) {
        case '4': stats.delivered++; break;
        case '2': case '3': stats.inTransit++; break;
        case '1': case '0': stats.pending++; break;
        case '5': stats.returned++; break;
        case '6': case '7': stats.cancelled++; break;
        default: stats.pending++;
      }
    });

    return [
      { name: 'مسلمة', value: stats.delivered, color: STATUS_COLORS.delivered },
      { name: 'قيد التوصيل', value: stats.inTransit, color: STATUS_COLORS.inTransit },
      { name: 'معلقة', value: stats.pending, color: STATUS_COLORS.pending },
      { name: 'راجعة', value: stats.returned, color: STATUS_COLORS.returned },
      { name: 'ملغاة', value: stats.cancelled, color: STATUS_COLORS.cancelled }
    ].filter(item => item.value > 0);
  }, [orders]);

  // 4. إحصائيات رقمية إضافية
  const summaryStats = useMemo(() => {
    const deliveredOrders = orders.filter(o => o.delivery_status === '4');
    const totalSales = deliveredOrders.reduce((sum, o) => sum + ((o.final_amount || 0) - (o.delivery_fee || 0)), 0);
    const avgOrderValue = deliveredOrders.length > 0 ? totalSales / deliveredOrders.length : 0;
    const deliveryRate = orders.length > 0 ? (deliveredOrders.length / orders.length) * 100 : 0;

    // أفضل موظف
    let topEmployee = null;
    let maxSales = 0;
    employeePerformance.forEach(emp => {
      if (emp.sales > maxSales) {
        maxSales = emp.sales;
        topEmployee = emp.name;
      }
    });

    return {
      avgOrderValue: Math.round(avgOrderValue),
      deliveryRate: Math.round(deliveryRate),
      topEmployee,
      totalOrders: orders.length,
      deliveredCount: deliveredOrders.length
    };
  }, [orders, employeePerformance]);

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        جاري تحميل الإحصائيات...
      </div>
    );
  }

  if (supervisedEmployeeIds.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        لا يوجد موظفين تحت إشرافك حالياً
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* إحصائيات رقمية سريعة */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Target className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{summaryStats.avgOrderValue.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">متوسط الطلب</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Truck className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{summaryStats.deliveryRate}%</p>
                <p className="text-sm text-muted-foreground">نسبة التسليم</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Award className="w-8 h-8 text-purple-500" />
              <div>
                <p className="text-lg font-bold truncate">{summaryStats.topEmployee || '-'}</p>
                <p className="text-sm text-muted-foreground">الأفضل أداءً</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">{summaryStats.deliveredCount}/{summaryStats.totalOrders}</p>
                <p className="text-sm text-muted-foreground">مسلمة/إجمالي</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* الرسوم البيانية */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* مخطط أداء الموظفين */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" />
              أداء الموظفين (المبيعات)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {employeePerformance.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={employeePerformance} layout="vertical">
                  <XAxis type="number" tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} />
                  <YAxis type="category" dataKey="name" width={60} />
                  <Tooltip 
                    formatter={(value) => [`${value.toLocaleString()} د.ع`, 'المبيعات']}
                    contentStyle={{ direction: 'rtl' }}
                  />
                  <Bar dataKey="sales" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                لا توجد بيانات كافية
              </div>
            )}
          </CardContent>
        </Card>

        {/* مخطط اتجاه المبيعات */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              اتجاه المبيعات (آخر 7 أيام)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={salesTrend}>
                <XAxis dataKey="date" />
                <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'sales' ? `${value.toLocaleString()} د.ع` : value,
                    name === 'sales' ? 'المبيعات' : 'الطلبات'
                  ]}
                  contentStyle={{ direction: 'rtl' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="sales" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* توزيع حالات الطلبات */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              توزيع حالات الطلبات (آخر 30 يوم)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row items-center justify-center gap-8">
              <ResponsiveContainer width={250} height={250}>
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => [`${value} طلب`, '']}
                    contentStyle={{ direction: 'rtl' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              
              {/* Legend */}
              <div className="flex flex-wrap justify-center gap-4">
                {statusDistribution.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm">
                      {item.name}: <strong>{item.value}</strong>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DepartmentStatsCharts;
