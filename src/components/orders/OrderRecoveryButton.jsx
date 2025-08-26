import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { recoverSpecificOrder } from '@/utils/orderRecovery';

const OrderRecoveryButton = () => {
  const [isRecovering, setIsRecovering] = useState(false);
  const { toast } = useToast();

  const handleRecover = async () => {
    setIsRecovering(true);
    try {
      const result = await recoverSpecificOrder();
      
      if (result.success) {
        toast({
          title: "تم استرداد الطلب بنجاح",
          description: `تم استرداد الطلب رقم ${result.trackingNumber}`,
          variant: "default",
        });
      } else {
        toast({
          title: "فشل في استرداد الطلب",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('خطأ في استرداد الطلب:', error);
      toast({
        title: "خطأ في استرداد الطلب",
        description: "حدث خطأ أثناء محاولة استرداد الطلب",
        variant: "destructive",
      });
    } finally {
      setIsRecovering(false);
    }
  };

  return (
    <Button 
      onClick={handleRecover}
      disabled={isRecovering}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      <RotateCcw className={`h-4 w-4 ${isRecovering ? 'animate-spin' : ''}`} />
      {isRecovering ? 'جاري الاسترداد...' : 'استرداد الطلب 99319996'}
    </Button>
  );
};

export default OrderRecoveryButton;