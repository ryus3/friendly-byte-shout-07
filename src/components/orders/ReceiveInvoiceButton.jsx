import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/UnifiedAuthContext';

const ReceiveInvoiceButton = ({ order, onSuccess }) => {
  const [isReceiving, setIsReceiving] = useState(false);
  const { user } = useAuth();

  const handleReceiveInvoice = async () => {
    if (!order || !user) return;

    setIsReceiving(true);
    try {
      // تحديث الطلب لتفعيل استلام الفاتورة
      const { error } = await supabase
        .from('orders')
        .update({
          receipt_received: true,
          receipt_received_at: new Date().toISOString(),
          receipt_received_by: user.id
        })
        .eq('id', order.id);

      if (error) throw error;

      toast({
        title: "✅ تم استلام الفاتورة بنجاح",
        description: `تم تأكيد استلام فاتورة الطلب ${order.order_number}`,
        variant: "success",
      });

      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('خطأ في استلام الفاتورة:', error);
      toast({
        title: "❌ خطأ في استلام الفاتورة",
        description: "حدث خطأ أثناء تأكيد استلام الفاتورة",
        variant: "destructive",
      });
    } finally {
      setIsReceiving(false);
    }
  };

  // لا تظهر الزر إذا كانت الفاتورة مستلمة بالفعل
  if (order?.receipt_received) {
    return null;
  }

  // إظهار الزر فقط للطلبات المكتملة/المسلمة
  if (order?.status !== 'completed' && order?.status !== 'delivered') {
    return null;
  }

  return (
    <Button
      onClick={handleReceiveInvoice}
      disabled={isReceiving}
      size="sm"
      className="bg-emerald-600 hover:bg-emerald-700 text-white"
    >
      {isReceiving ? (
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
      ) : (
        <CheckCircle className="w-4 h-4 mr-2" />
      )}
      {isReceiving ? 'جاري الاستلام...' : 'استلام الفاتورة'}
    </Button>
  );
};

export default ReceiveInvoiceButton;