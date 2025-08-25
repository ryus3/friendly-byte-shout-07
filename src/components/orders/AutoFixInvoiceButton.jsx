import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';

const AutoFixInvoiceButton = () => {
  const [loading, setLoading] = useState(false);

  const handleAutoFix = async () => {
    setLoading(true);
    try {
      // Find delivered orders that don't have receipt_received = true
      const { data: unfixedOrders, error } = await supabase
        .from('orders')
        .select('id, order_number, status, delivery_partner, delivery_partner_order_id')
        .in('status', ['delivered', 'completed'])
        .eq('receipt_received', false)
        .not('delivery_partner_order_id', 'is', null);

      if (error) {
        throw error;
      }

      if (!unfixedOrders || unfixedOrders.length === 0) {
        toast({
          title: 'لا توجد طلبات تحتاج إصلاح',
          description: 'جميع الطلبات المُسلمة مُعلمة كمستلمة الفاتورة',
          variant: 'info'
        });
        return;
      }

      // Use Edge Function to fix them
      const orderIds = unfixedOrders.map(o => o.id);
      const { data: result, error: fixError } = await supabase.functions.invoke('mark-invoice-received', {
        body: {
          orderIds,
          invoiceId: 'auto-fix'
        }
      });

      if (fixError) {
        throw fixError;
      }

      if (result?.success) {
        const actualUpdates = result.results.filter(r => r.updated).length;
        
        toast({
          title: 'تم الإصلاح التلقائي',
          description: `تم إصلاح ${actualUpdates} طلب من أصل ${unfixedOrders.length} طلب`,
          variant: 'success'
        });
      }

    } catch (error) {
      console.error('Auto-fix error:', error);
      toast({
        title: 'خطأ في الإصلاح التلقائي',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleAutoFix}
      disabled={loading}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      إصلاح تلقائي للطلبات المُسلمة
    </Button>
  );
};

export default AutoFixInvoiceButton;