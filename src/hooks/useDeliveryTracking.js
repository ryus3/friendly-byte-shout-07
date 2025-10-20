import { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Hook لاستخدام delivery_tracking VIEW
 * يوفر معلومات مفصلة عن الطلب والمنتجات المسلمة/الراجعة
 * @param {string} orderId - معرف الطلب
 * @returns {{trackingData: object|null, loading: boolean}}
 */
export const useDeliveryTracking = (orderId) => {
  const [trackingData, setTrackingData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTracking = async () => {
      if (!orderId) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('delivery_tracking')
          .select('*')
          .eq('id', orderId)
          .maybeSingle();

        if (error) {
          console.error('خطأ في جلب بيانات التتبع:', error);
        } else if (data) {
          setTrackingData(data);
        }
      } catch (err) {
        console.error('خطأ في useDeliveryTracking:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTracking();
  }, [orderId]);

  return { trackingData, loading };
};
