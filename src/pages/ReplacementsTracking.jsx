import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeftRight, 
  RotateCcw, 
  TrendingUp, 
  TrendingDown,
  Package,
  DollarSign,
  Calendar,
  Filter
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ReplacementsTracking = () => {
  const [replacements, setReplacements] = useState([]);
  const [stats, setStats] = useState({
    totalExchanges: 0,
    totalReturns: 0,
    totalRevenue: 0,
    totalExpense: 0
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, exchange, return
  const { toast } = useToast();

  useEffect(() => {
    fetchReplacements();
  }, [filter]);

  const fetchReplacements = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('orders')
        .select(`
          id,
          order_number,
          order_type,
          adjustment_type,
          total_amount,
          final_amount,
          delivery_fee,
          customer_name,
          customer_phone,
          customer_city,
          status,
          delivery_status,
          created_at,
          notes,
          original_order_id,
          related_order_id
        `)
        .in('order_type', ['replacement', 'return'])
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('order_type', filter);
      }

      const { data, error } = await query;

      if (error) throw error;

      setReplacements(data || []);

      // حساب الإحصائيات
      const exchanges = data?.filter(o => o.order_type === 'replacement').length || 0;
      const returns = data?.filter(o => o.order_type === 'return').length || 0;
      const revenue = data?.filter(o => o.final_amount > 0).reduce((sum, o) => sum + (o.final_amount || 0), 0) || 0;
      const expense = data?.filter(o => o.final_amount < 0).reduce((sum, o) => sum + Math.abs(o.final_amount || 0), 0) || 0;

      setStats({
        totalExchanges: exchanges,
        totalReturns: returns,
        totalRevenue: revenue,
        totalExpense: expense
      });

    } catch (error) {
      console.error('خطأ في جلب البيانات:', error);
      toast({
        title: "خطأ",
        description: "فشل تحميل بيانات الاستبدالات",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status, deliveryStatus) => {
    if (deliveryStatus === '17') {
      return <Badge variant="secondary">رجع للتاجر</Badge>;
    }
    if (deliveryStatus === '4') {
      return <Badge variant="success">تم التسليم</Badge>;
    }
    if (status === 'pending') {
      return <Badge variant="default">قيد الانتظار</Badge>;
    }
    if (status === 'completed') {
      return <Badge variant="success">مكتمل</Badge>;
    }
    return <Badge>{status}</Badge>;
  };

  const getAmountBadge = (amount) => {
    if (amount > 0) {
      return (
        <Badge variant="success" className="gap-1">
          <TrendingUp className="w-3 h-3" />
          +{amount.toLocaleString()} د.ع
        </Badge>
      );
    }
    if (amount < 0) {
      return (
        <Badge variant="destructive" className="gap-1">
          <TrendingDown className="w-3 h-3" />
          {amount.toLocaleString()} د.ع
        </Badge>
      );
    }
    return <Badge variant="outline">0 د.ع</Badge>;
  };

  return (
    <>
      <Helmet>
        <title>متابعة الاستبدالات والإرجاعات - نظام RYUS</title>
      </Helmet>

      <div className="container mx-auto p-4 space-y-6">
        {/* العنوان والفلترة */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">متابعة الاستبدالات والإرجاعات</h1>
          
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="نوع الطلب" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="replacement">استبدال فقط</SelectItem>
              <SelectItem value="return">إرجاع فقط</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* بطاقات الإحصائيات */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4" />
                إجمالي الاستبدالات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.totalExchanges}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <RotateCcw className="w-4 h-4" />
                إجمالي الإرجاعات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.totalReturns}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-green-600">
                <TrendingUp className="w-4 h-4" />
                إيرادات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">
                +{stats.totalRevenue.toLocaleString()} د.ع
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-red-600">
                <TrendingDown className="w-4 h-4" />
                مصروفات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">
                -{stats.totalExpense.toLocaleString()} د.ع
              </p>
            </CardContent>
          </Card>
        </div>

        {/* قائمة الاستبدالات */}
        <Card>
          <CardHeader>
            <CardTitle>تفاصيل العمليات</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">جاري التحميل...</div>
            ) : replacements.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                لا توجد عمليات استبدال أو إرجاع
              </div>
            ) : (
              <div className="space-y-4">
                {replacements.map((order) => (
                  <Card key={order.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        {/* المعلومات الأساسية */}
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant={order.order_type === 'replacement' ? 'default' : 'secondary'}>
                              {order.order_type === 'replacement' ? (
                                <>
                                  <ArrowLeftRight className="w-3 h-3 ml-1" />
                                  استبدال
                                </>
                              ) : (
                                <>
                                  <RotateCcw className="w-3 h-3 ml-1" />
                                  إرجاع
                                </>
                              )}
                            </Badge>
                            <span className="font-mono font-semibold">#{order.order_number}</span>
                            {getStatusBadge(order.status, order.delivery_status)}
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">الزبون: </span>
                              <span className="font-medium">{order.customer_name}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">الهاتف: </span>
                              <span className="font-mono">{order.customer_phone}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">المحافظة: </span>
                              <span>{order.customer_city}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span className="text-xs">
                                {new Date(order.created_at).toLocaleDateString('ar-IQ')}
                              </span>
                            </div>
                          </div>

                          {/* الملاحظات */}
                          {order.notes && (
                            <div className="mt-2 p-2 bg-muted rounded text-xs whitespace-pre-wrap">
                              {order.notes}
                            </div>
                          )}
                        </div>

                        {/* المبلغ */}
                        <div className="text-left">
                          {getAmountBadge(order.final_amount || order.total_amount || 0)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default ReplacementsTracking;
