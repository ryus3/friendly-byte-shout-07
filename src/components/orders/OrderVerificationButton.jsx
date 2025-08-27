import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { toast } from '@/components/ui/use-toast';

const OrderVerificationButton = ({ order, onVerificationComplete }) => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const { verifyOrderExistence, isLoggedIn } = useAlWaseet();

  const handleVerification = async () => {
    if (!order?.tracking_number) {
      toast({
        title: "خطأ",
        description: "لا يوجد رقم تتبع للطلب",
        variant: "destructive"
      });
      return;
    }

    if (!isLoggedIn) {
      toast({
        title: "خطأ",
        description: "يجب تسجيل الدخول للوسيط أولاً",
        variant: "destructive"
      });
      return;
    }

    setIsVerifying(true);
    
    try {
      console.log(`🔍 بدء فحص الطلب ${order.tracking_number}...`);
      
      const result = await verifyOrderExistence(order.tracking_number);
      setVerificationResult(result);
      
      if (result.exists) {
        toast({
          title: "✅ الطلب موجود",
          description: `الطلب ${order.tracking_number} موجود في الوسيط`,
          variant: "default"
        });
      } else if (!result.error) {
        // الطلب غير موجود - عرض معلومات فقط (بدون حذف تلقائي)
        toast({
          title: "⚠️ الطلب غير موجود",
          description: `الطلب ${order.tracking_number} غير موجود في الوسيط. سيتم حذفه تلقائياً عند المزامنة التالية.`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "خطأ في الفحص",
          description: result.error,
          variant: "destructive"
        });
      }
      
    } catch (error) {
      console.error('💥 خطأ في فحص الطلب:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء فحص الطلب",
        variant: "destructive"
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const getVerificationBadge = () => {
    if (!verificationResult) return null;
    
    if (verificationResult.exists) {
      return (
        <Badge variant="secondary" className="ml-2">
          <CheckCircle className="w-3 h-3 mr-1 text-green-600" />
          موجود
        </Badge>
      );
    } else if (!verificationResult.error) {
      return (
        <Badge variant="destructive" className="ml-2">
          <XCircle className="w-3 h-3 mr-1" />
          غير موجود
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="ml-2">
          <AlertTriangle className="w-3 h-3 mr-1 text-yellow-600" />
          خطأ
        </Badge>
      );
    }
  };

  // عرض الزر فقط للطلبات المناسبة
  if (!order?.tracking_number || order.delivery_partner !== 'alwaseet') {
    return null;
  }

  return (
    <div className="flex items-center">
      <Button
        onClick={handleVerification}
        disabled={isVerifying || !isLoggedIn}
        size="sm"
        variant="outline"
        className="text-xs"
      >
        <Search className="w-3 h-3 mr-1" />
        {isVerifying ? 'جاري الفحص...' : 'فحص الوجود'}
      </Button>
      {getVerificationBadge()}
    </div>
  );
};

export default OrderVerificationButton;