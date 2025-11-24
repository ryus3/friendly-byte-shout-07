import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import GradientText from '@/components/storefront/ui/GradientText';
import FilterButton from '@/components/storefront/dashboard/FilterButton';
import StorefrontOrderCard from '@/components/storefront/dashboard/StorefrontOrderCard';
import { ShoppingBag } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const StorefrontOrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('pending');
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

  const handleApproveOrder = async (orderId) => {
    try {
      const { error } = await supabase
        .from('storefront_orders')
        .update({ status: 'approved' })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: '✅ تمت الموافقة',
        description: 'تمت الموافقة على الطلب بنجاح'
      });
      
      await fetchOrders();
    } catch (err) {
      console.error('Error approving order:', err);
      toast({
        title: 'خطأ',
        description: 'فشلت الموافقة على الطلب',
        variant: 'destructive'
      });
    }
  };

  const handleRejectOrder = async (orderId) => {
    try {
      const { error } = await supabase
        .from('storefront_orders')
        .update({ status: 'rejected' })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: '❌ تم الرفض',
        description: 'تم رفض الطلب'
      });
      
      await fetchOrders();
    } catch (err) {
      console.error('Error rejecting order:', err);
      toast({
        title: 'خطأ',
        description: 'فشل رفض الطلب',
        variant: 'destructive'
      });
    }
  };

  const filteredOrders = orders.filter(order => {
    if (filter === 'pending') return order.status === 'pending_approval';
    if (filter === 'approved') return order.status === 'approved';
    if (filter === 'completed') return order.status === 'completed';
    return true;
  });

  const pendingCount = orders.filter(o => o.status === 'pending_approval').length;
  const approvedCount = orders.filter(o => o.status === 'approved').length;
  const completedCount = orders.filter(o => o.status === 'completed').length;

  return (
    <div className="p-8 bg-gradient-to-br from-background via-background to-orange-50 dark:to-orange-950/20 min-h-screen space-y-8">
      <GradientText gradient="from-purple-600 via-pink-600 to-blue-600" className="text-4xl">
        طلبات المتجر
      </GradientText>
      
      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <FilterButton
          active={filter === 'pending'}
          onClick={() => setFilter('pending')}
          gradient="from-orange-500 to-red-500"
          count={pendingCount}
        >
          بانتظار الموافقة
        </FilterButton>
        <FilterButton
          active={filter === 'approved'}
          onClick={() => setFilter('approved')}
          gradient="from-blue-500 to-cyan-500"
          count={approvedCount}
        >
          موافق عليها
        </FilterButton>
        <FilterButton
          active={filter === 'completed'}
          onClick={() => setFilter('completed')}
          gradient="from-emerald-500 to-teal-500"
          count={completedCount}
        >
          مكتملة
        </FilterButton>
      </div>
      
      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <Card className="border-2 shadow-xl">
          <CardContent className="flex flex-col items-center justify-center h-96 space-y-6">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 blur-3xl opacity-20 animate-pulse" />
              <ShoppingBag className="h-32 w-32 text-muted-foreground relative z-10" />
            </div>
            <div className="text-center space-y-2">
              <GradientText gradient="from-purple-600 to-pink-600" className="text-2xl">
                لا توجد طلبات
              </GradientText>
              <p className="text-muted-foreground">
                {filter === 'pending' ? 'لا توجد طلبات بانتظار الموافقة' : 
                 filter === 'approved' ? 'لا توجد طلبات موافق عليها' : 
                 'لا توجد طلبات مكتملة'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {filteredOrders.map(order => (
            <StorefrontOrderCard
              key={order.id}
              order={order}
              onApprove={() => handleApproveOrder(order.id)}
              onReject={() => handleRejectOrder(order.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default StorefrontOrdersPage;
