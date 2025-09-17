import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Trash2, Loader2 } from 'lucide-react';
import { useAiOrdersCleanup } from '@/hooks/useAiOrdersCleanup';
import { toast } from 'sonner';

/**
 * زر تنظيف الطلبات الذكية المتبقية مع تأكيد
 */
const SmartOrdersCleanupButton = ({ onCleanupComplete }) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { cleanupOrphanedAiOrders, checkOrphanedAiOrders } = useAiOrdersCleanup();

  const handleCleanup = async () => {
    setIsLoading(true);
    
    try {
      // أولاً: التحقق من عدد الطلبات المتبقية
      const checkResult = await checkOrphanedAiOrders();
      
      if (!checkResult.success || checkResult.orders.length === 0) {
        toast.success('لا توجد طلبات ذكية متبقية للحذف');
        setShowConfirm(false);
        setIsLoading(false);
        return;
      }

      // ثانياً: تنظيف الطلبات المتبقية
      const result = await cleanupOrphanedAiOrders();
      
      if (result.success) {
        toast.success(`تم حذف ${result.deletedCount} طلب ذكي متبقي بنجاح`);
        onCleanupComplete?.();
      } else {
        toast.error(`فشل في تنظيف الطلبات الذكية: ${result.error}`);
      }
    } catch (error) {
      console.error('خطأ في تنظيف الطلبات الذكية:', error);
      toast.error('حدث خطأ أثناء تنظيف الطلبات الذكية');
    } finally {
      setIsLoading(false);
      setShowConfirm(false);
    }
  };

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setShowConfirm(true)}
        disabled={isLoading}
        className="gap-2"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
        تنظيف الطلبات المتبقية
      </Button>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف الطلبات الذكية المتبقية</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من رغبتك في حذف جميع الطلبات الذكية التي لم يتم ربطها بطلبات حقيقية؟
              <br />
              <br />
              <strong>تحذير:</strong> هذا الإجراء غير قابل للتراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCleanup}
              disabled={isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  جاري الحذف...
                </>
              ) : (
                'نعم، احذف الكل'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default SmartOrdersCleanupButton;