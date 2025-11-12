import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import TrackingSearch from '@/components/tracking/TrackingSearch';
import TrackingTimeline from '@/components/tracking/TrackingTimeline';
import TrackingInfo from '@/components/tracking/TrackingInfo';
import EmployeeContactCard from '@/components/tracking/EmployeeContactCard';
import TrackingMap from '@/components/tracking/TrackingMap';
import { Loader2 } from 'lucide-react';

const OrderTrackingPage = () => {
  const { trackingNumber } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // جلب بيانات الطلب والموظف (بدون API إضافي - من DB فقط)
  const fetchOrderData = async (trackingNum) => {
    try {
      setLoading(true);
      setError(null);

      // جلب الطلب مع items
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          items:order_items(*)
        `)
        .eq('tracking_number', trackingNum)
        .single();

      if (orderError) throw orderError;
      if (!orderData) throw new Error('الطلب غير موجود');

      setOrder(orderData);

      // جلب معلومات الموظف (business page فقط)
      const { data: profileData } = await supabase
        .from('profiles')
        .select('business_page_name, business_links, social_media')
        .eq('user_id', orderData.created_by)
        .single();

      setEmployee(profileData);
    } catch (err) {
      console.error('خطأ في جلب بيانات التتبع:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (trackingNumber) {
      fetchOrderData(trackingNumber);
    }
  }, [trackingNumber]);

  if (!trackingNumber) {
    return <TrackingSearch onSearch={(num) => navigate(`/track/${num}`)} />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !order) {
    return <TrackingSearch onSearch={(num) => navigate(`/track/${num}`)} error={error} />;
  }

  return (
    <>
      <Helmet>
        <title>تتبع الطلب - {order.tracking_number}</title>
        <meta name="description" content={`تتبع طلبك رقم ${order.tracking_number}`} />
      </Helmet>
      
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50 dark:from-gray-900 dark:via-purple-950 dark:to-indigo-950 py-8 px-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <TrackingInfo order={order} />
          <TrackingTimeline order={order} />
          <TrackingMap order={order} />
          <EmployeeContactCard employee={employee} />
        </div>
      </div>
    </>
  );
};

export default OrderTrackingPage;
