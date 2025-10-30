import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const InvoiceCheckButton = ({ orderId, trackingNumber, onSuccess }) => {
  const [checking, setChecking] = useState(false);
  const { toast } = useToast();

  const handleCheck = async () => {
    if (!trackingNumber) {
      toast({
        title: "خطأ",
        description: "لا يوجد رقم تتبع للطلب",
        variant: "destructive",
      });
      return;
    }

    setChecking(true);
    try {
      console.log(`🔍 Checking invoice for order ${orderId} with tracking ${trackingNumber}`);
      
      // First try to link orders retroactively
      const { data: linkResult, error: linkError } = await supabase.rpc('retroactive_link_orders_by_qr');
      
      if (linkError) {
        console.error("Error linking orders:", linkError);
      } else {
        console.log("✅ Retroactive link result:", linkResult);
      }
      
      // ✅ Then sync recent received invoices
      const { data: syncResult, error: syncError } = await supabase.rpc('sync_recent_received_invoices');
      
      if (syncError) {
        console.error("❌ Error syncing invoices:", syncError.message);
        toast({
          title: "خطأ في المزامنة",
          description: `فشلت المزامنة: ${syncError.message}`,
          variant: "destructive",
        });
      } else {
        console.log("✅ Sync result:", syncResult);
        const updatedCount = syncResult?.updated_orders_count || 0;
        
        toast({
          title: "تم فحص الفواتير",
          description: `تم تحديث ${updatedCount} طلب`,
        });
        
        if (updatedCount > 0 && onSuccess) {
          onSuccess();
        }
      }
      
    } catch (error) {
      console.error("Error checking invoice:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء فحص الفاتورة",
        variant: "destructive",
      });
    } finally {
      setChecking(false);
    }
  };

  return (
    <Button 
      onClick={handleCheck}
      disabled={checking}
      size="sm"
      variant="outline"
    >
      {checking ? (
        <>
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-2"></div>
          فحص...
        </>
      ) : (
        "🔍 فحص الفاتورة"
      )}
    </Button>
  );
};