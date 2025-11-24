import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';

const StorefrontOrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('storefront_orders')
        .select('*')
        .eq('employee_id', user.id)
        .order('created_at', { ascending: false });

      setOrders(data || []);
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      'pending_approval': 'secondary',
      'approved': 'default',
      'rejected': 'destructive'
    };

    const labels = {
      'pending_approval': 'بانتظار الموافقة',
      'approved': 'تمت الموافقة',
      'rejected': 'مرفوض'
    };

    return <Badge variant={variants[status] || 'secondary'}>{labels[status] || status}</Badge>;
  };

  if (loading) {
    return <div className="p-8">جاري التحميل...</div>;
  }

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6">
      <h1 className="text-3xl font-bold">طلبات المتجر</h1>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center h-96">
            <p className="text-muted-foreground">لا توجد طلبات حتى الآن</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map(order => (
            <Card key={order.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>طلب #{order.id.substring(0, 8)}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {new Date(order.created_at).toLocaleString('ar-IQ')}
                    </p>
                  </div>
                  {getStatusBadge(order.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium">معلومات العميل</p>
                    <p className="text-sm text-muted-foreground">{order.customer_name}</p>
                    <p className="text-sm text-muted-foreground" dir="ltr">{order.customer_phone}</p>
                    <p className="text-sm text-muted-foreground">{order.customer_address}</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium">تفاصيل الطلب</p>
                    <p className="text-sm text-muted-foreground">
                      {order.items?.length || 0} منتج
                    </p>
                    <p className="text-lg font-bold text-primary">
                      {order.total_amount?.toLocaleString('ar-IQ')} IQD
                    </p>
                  </div>
                </div>

                {order.notes && (
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium mb-1">ملاحظات:</p>
                    <p className="text-sm text-muted-foreground">{order.notes}</p>
                  </div>
                )}

                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm">
                    <Eye className="h-4 w-4 ml-2" />
                    عرض التفاصيل
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default StorefrontOrdersPage;
