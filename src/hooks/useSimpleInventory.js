import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const useSimpleInventory = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .rpc('get_all_inventory_simple');

      if (fetchError) throw fetchError;

      setItems(data || []);
    } catch (err) {
      console.error('خطأ في جلب بيانات الجرد:', err);
      setError(err.message);
      toast({
        title: 'خطأ',
        description: 'فشل تحميل بيانات الجرد',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  return {
    items,
    loading,
    error,
    refetch: fetchInventory
  };
};
