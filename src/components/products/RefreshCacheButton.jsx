import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

/**
 * زر تحديث كاش المنتجات يدوياً
 * يظهر للمستخدمين عند الحاجة لتحديث البيانات بعد إضافة/تعديل منتج
 */
export function RefreshCacheButton() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('refresh-product-cache');
      
      if (error) {
        throw error;
      }
      
      toast({
        title: '✅ تم تحديث الكاش',
        description: `تم تحديث بيانات ${data.productsCount || 0} منتج بنجاح`,
      });
    } catch (error) {
      console.error('خطأ في تحديث الكاش:', error);
      toast({
        title: '❌ فشل التحديث',
        description: 'حدث خطأ أثناء تحديث الكاش. حاول مرة أخرى.',
        variant: 'destructive'
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Button 
      onClick={handleRefresh} 
      variant="outline" 
      size="sm"
      disabled={isRefreshing}
      className="gap-2"
    >
      <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
      {isRefreshing ? 'جاري التحديث...' : 'تحديث الكاش'}
    </Button>
  );
}
