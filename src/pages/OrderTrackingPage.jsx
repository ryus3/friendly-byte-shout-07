import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import TrackingSearch from '@/components/tracking/TrackingSearch';
import TrackingHeader from '@/components/tracking/TrackingHeader';
import TrackingTimeline from '@/components/tracking/TrackingTimeline';
import TrackingInfo from '@/components/tracking/TrackingInfo';
import TrackingMap from '@/components/tracking/TrackingMap';
import TrackingFooter from '@/components/tracking/TrackingFooter';
import { Loader2 } from 'lucide-react';

const OrderTrackingPage = () => {
  const { trackingNumber } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // جلب بيانات الطلب والموظف
  const fetchOrderData = async (trackingNum) => {
    try {
      setLoading(true);
      setError(null);

      // جلب الطلب مع items - دعم البحث برقم التتبع أو رقم الهاتف
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          items:order_items(
            *,
            product:products(name)
          )
        `)
        .or(`tracking_number.eq.${trackingNum},customer_phone.eq.${trackingNum}`)
        .maybeSingle();

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

  // التحديث التلقائي الذكي (كل ساعة من 8 صباحاً - 12 ليلاً)
  useEffect(() => {
    if (!trackingNumber) return;

    fetchOrderData(trackingNumber);

    const interval = setInterval(() => {
      const now = new Date();
      const hour = now.getHours();
      
      // التحديث فقط بين 8 صباحاً - 12 ليلاً
      if (hour >= 8 && hour < 24) {
        fetchOrderData(trackingNumber);
      }
    }, 60 * 60 * 1000); // كل ساعة

    return () => clearInterval(interval);
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
      
      <div className="min-h-screen bg-gradient-to-br from-violet-100 via-purple-100 to-indigo-100 dark:from-gray-950 dark:via-purple-950 dark:to-indigo-950">
        <TrackingHeader employee={employee} />
        
        <div className="max-w-3xl mx-auto px-4 py-4 space-y-3">
          <TrackingInfo order={order} />
          <TrackingTimeline order={order} />
        </div>

        <TrackingFooter employee={employee} />
      </div>
    </>
  );
};

export default OrderTrackingPage;
