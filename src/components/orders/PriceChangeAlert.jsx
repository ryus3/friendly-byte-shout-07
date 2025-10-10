import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const PriceChangeAlert = ({ order }) => {
  const [priceChanges, setPriceChanges] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchPriceChanges = async () => {
      if (!order?.id) return;
      
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('accounting')
          .select('*')
          .eq('reference_type', 'order')
          .eq('reference_id', order.id)
          .eq('category', 'تغيير سعر من الوسيط')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setPriceChanges(data || []);
      } catch (error) {
        console.error('Error fetching price changes:', error);
      } finally {
        setLoading(false);
      }
    };

    // عرض التحديثات للطلبات من الوسيط فقط
    if (order?.delivery_partner?.toLowerCase() === 'alwaseet') {
      fetchPriceChanges();
    }
  }, [order?.id, order?.delivery_partner]);

  if (loading || !priceChanges.length) return null;

  return (
    <Alert className="border-purple-300 bg-purple-50 dark:bg-purple-900/20">
      <AlertTriangle className="h-4 w-4 text-purple-600" />
      <AlertTitle className="text-purple-900 dark:text-purple-100 font-semibold">
        تحديثات السعر من الوسيط
      </AlertTitle>
      <AlertDescription>
        <div className="space-y-2 mt-2">
          {priceChanges.map((change) => {
            const isExpense = change.type === 'expense';
            const Icon = isExpense ? TrendingDown : TrendingUp;
            const colorClass = isExpense 
              ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' 
              : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
            
            return (
              <div key={change.id} className="flex items-center justify-between gap-2 p-2 bg-white dark:bg-purple-950/50 rounded-lg">
                <div className="flex items-center gap-2 flex-1">
                  <Icon className={`w-4 h-4 ${isExpense ? 'text-red-600' : 'text-green-600'}`} />
                  <span className="text-sm">{change.description}</span>
                </div>
                <Badge variant="outline" className={colorClass}>
                  {isExpense ? '-' : '+'}{Math.abs(change.amount).toLocaleString('ar')} د.ع
                </Badge>
              </div>
            );
          })}
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default PriceChangeAlert;
