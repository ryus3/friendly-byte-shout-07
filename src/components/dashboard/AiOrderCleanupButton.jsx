import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const AiOrderCleanupButton = ({ onCleanupComplete }) => {
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  const handleCleanup = async () => {
    setIsCleaningUp(true);
    
    try {
      console.log('🧹 بدء تنظيف الطلبات الذكية المتبقية...');
      
      // استدعاء دالة التنظيف التلقائي
      const { data: cleanupResult, error: cleanupError } = await supabase.rpc('cleanup_orphaned_ai_orders');
      
      if (cleanupError) {
        throw cleanupError;
      }
      
      const deletedCount = cleanupResult || 0;
      
      if (deletedCount > 0) {
        toast({
          title: "تم التنظيف بنجاح",
          description: `تم حذف ${deletedCount} طلب ذكي متبقي`,
        });
        console.log(`✅ تم حذف ${deletedCount} طلب ذكي متبقي`);
      } else {
        toast({
          title: "لا توجد طلبات للتنظيف",
          description: "جميع الطلبات الذكية في حالة جيدة",
        });
        console.log('✅ لا توجد طلبات ذكية متبقية للحذف');
      }
      
      // إشعار المكون الأصلي لإعادة تحميل البيانات
      if (onCleanupComplete) {
        onCleanupComplete();
      }
      
    } catch (error) {
      console.error('❌ فشل في تنظيف الطلبات الذكية:', error);
      toast({
        title: "خطأ في التنظيف",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsCleaningUp(false);
    }
  };

  return (
    <Button
      onClick={handleCleanup}
      disabled={isCleaningUp}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      {isCleaningUp ? (
        <RefreshCw className="w-4 h-4 animate-spin" />
      ) : (
        <Trash2 className="w-4 h-4" />
      )}
      {isCleaningUp ? 'جاري التنظيف...' : 'تنظيف الطلبات المتبقية'}
    </Button>
  );
};

export default AiOrderCleanupButton;