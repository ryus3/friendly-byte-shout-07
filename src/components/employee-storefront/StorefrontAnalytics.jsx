import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, Users, ShoppingCart, Eye } from 'lucide-react';

const StorefrontAnalytics = ({ employeeId }) => {
  const [analytics, setAnalytics] = useState([]);
  const [period, setPeriod] = useState('week');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (employeeId) {
      fetchAnalytics();
    }
  }, [employeeId, period]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      const endDate = new Date();
      const startDate = new Date();

      if (period === 'week') {
        startDate.setDate(endDate.getDate() - 7);
      } else if (period === 'month') {
        startDate.setMonth(endDate.getMonth() - 1);
      } else if (period === 'year') {
        startDate.setFullYear(endDate.getFullYear() - 1);
      }

      const { data } = await supabase
        .from('storefront_analytics')
        .select('*')
        .eq('employee_id', employeeId)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0])
        .order('date', { ascending: true });

      setAnalytics(data || []);
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const totals = analytics.reduce(
    (acc, day) => ({
      visitors: acc.visitors + (day.visitors || 0),
      pageViews: acc.pageViews + (day.page_views || 0),
      productViews: acc.productViews + (day.product_views || 0),
      cartAdditions: acc.cartAdditions + (day.cart_additions || 0),
      orders: acc.orders + (day.orders || 0),
      revenue: acc.revenue + (day.revenue || 0)
    }),
    { visitors: 0, pageViews: 0, productViews: 0, cartAdditions: 0, orders: 0, revenue: 0 }
  );

  const avgConversionRate = analytics.length > 0
    ? analytics.reduce((sum, day) => sum + (day.conversion_rate || 0), 0) / analytics.length
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">إحصائيات المتجر</h2>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">آخر 7 أيام</SelectItem>
            <SelectItem value="month">آخر 30 يوم</SelectItem>
            <SelectItem value="year">آخر سنة</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div>جاري التحميل...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">إجمالي الزوار</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals.visitors}</div>
              <p className="text-xs text-muted-foreground">
                {totals.pageViews} مشاهدة صفحة
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">مشاهدات المنتجات</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals.productViews}</div>
              <p className="text-xs text-muted-foreground">
                {totals.cartAdditions} إضافة للسلة
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">الطلبات</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals.orders}</div>
              <p className="text-xs text-muted-foreground">
                {avgConversionRate.toFixed(1)}% معدل التحويل
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">الإيرادات</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totals.revenue.toLocaleString('ar-IQ')} IQD
              </div>
              <p className="text-xs text-muted-foreground">
                {totals.orders > 0
                  ? `${(totals.revenue / totals.orders).toLocaleString('ar-IQ')} IQD متوسط الطلب`
                  : 'لا توجد طلبات'
                }
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default StorefrontAnalytics;
