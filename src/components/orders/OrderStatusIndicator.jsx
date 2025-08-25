import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';

const OrderStatusIndicator = () => {
  const [needsFixCount, setNeedsFixCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkInconsistentOrders = async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('delivery_partner', 'alwaseet')
          .in('status', ['delivered', 'completed'])
          .eq('receipt_received', false);

        if (!error) {
          setNeedsFixCount(data?.length || 0);
        }
      } catch (error) {
        console.error('Error checking orders status:', error);
      } finally {
        setLoading(false);
      }
    };

    checkInconsistentOrders();
    
    // Check every minute
    const interval = setInterval(checkInconsistentOrders, 60000);
    
    return () => clearInterval(interval);
  }, []);

  if (loading) return null;

  if (needsFixCount === 0) {
    return (
      <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
        <CheckCircle className="w-3 h-3 mr-1" />
        جميع الطلبات سليمة
      </Badge>
    );
  }

  return (
    <Badge variant="destructive" className="bg-orange-50 text-orange-700 border-orange-200">
      <AlertTriangle className="w-3 h-3 mr-1" />
      {needsFixCount} طلب يحتاج إصلاح
    </Badge>
  );
};

export default OrderStatusIndicator;