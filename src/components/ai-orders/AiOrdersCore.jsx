/**
 * النواة الأساسية لنظام طلبات الذكاء الاصطناعي
 * حل جذري ومضمون للعمل
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { 
  Bot, 
  MessageSquare, 
  Clock, 
  AlertTriangle, 
  CheckCircle2,
  XCircle,
  Send,
  Eye,
  X,
  Brain,
  Zap,
  Smartphone,
  Users,
  TrendingUp,
  Activity,
  Trash2,
  ShoppingCart,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// هوك محلي مستقل للذكاء الاصطناعي
export const useAiOrdersCore = () => {
  const [aiOrders, setAiOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // جلب الطلبات مباشرة من قاعدة البيانات
  const fetchAiOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('ai_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('❌ خطأ في جلب طلبات الذكاء الاصطناعي:', fetchError);
        setError(fetchError.message);
        return;
      }

      console.log('✅ تم جلب طلبات الذكاء الاصطناعي بنجاح:', data?.length || 0);
      setAiOrders(data || []);
      
    } catch (err) {
      console.error('❌ خطأ غير متوقع:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // دالة اعتماد الطلب
  const approveOrder = useCallback(async (orderId, destination = 'web', account = null) => {
    try {
      console.log('🔄 اعتماد طلب الذكاء الاصطناعي:', orderId);
      
      const { data, error } = await supabase
        .from('ai_orders')
        .update({ 
          status: 'approved',
          destination: destination,
          destination_account: account,
          approved_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .select()
        .single();

      if (error) {
        console.error('❌ خطأ في اعتماد الطلب:', error);
        toast({
          title: "خطأ في الاعتماد",
          description: error.message,
          variant: "destructive"
        });
        return { success: false, error };
      }

      console.log('✅ تم اعتماد الطلب بنجاح');
      toast({
        title: "تم الاعتماد",
        description: "تم اعتماد الطلب بنجاح",
        variant: "default"
      });

      // تحديث القائمة محلياً
      setAiOrders(prev => prev.map(order => 
        order.id === orderId ? { ...order, ...data } : order
      ));

      return { success: true, data };
      
    } catch (err) {
      console.error('❌ خطأ غير متوقع في الاعتماد:', err);
      toast({
        title: "خطأ",
        description: "حدث خطأ غير متوقع",
        variant: "destructive"
      });
      return { success: false, error: err };
    }
  }, []);

  // دالة حذف الطلب
  const deleteOrder = useCallback(async (orderId) => {
    try {
      console.log('🗑️ حذف طلب الذكاء الاصطناعي:', orderId);
      
      const { error } = await supabase
        .from('ai_orders')
        .delete()
        .eq('id', orderId);

      if (error) {
        console.error('❌ خطأ في حذف الطلب:', error);
        toast({
          title: "خطأ في الحذف",
          description: error.message,
          variant: "destructive"
        });
        return { success: false, error };
      }

      console.log('✅ تم حذف الطلب بنجاح');
      toast({
        title: "تم الحذف",
        description: "تم حذف الطلب بنجاح",
        variant: "default"
      });

      // إزالة من القائمة محلياً
      setAiOrders(prev => prev.filter(order => order.id !== orderId));

      return { success: true };
      
    } catch (err) {
      console.error('❌ خطأ غير متوقع في الحذف:', err);
      toast({
        title: "خطأ",
        description: "حدث خطأ غير متوقع",
        variant: "destructive"
      });
      return { success: false, error: err };
    }
  }, []);

  // استماع للتحديثات المباشرة
  useEffect(() => {
    fetchAiOrders();

    // الاستماع للتحديثات المباشرة
    const channel = supabase
      .channel('ai_orders_realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ai_orders'
      }, (payload) => {
        console.log('📡 تحديث مباشر للطلبات:', payload.eventType);
        
        if (payload.eventType === 'INSERT') {
          setAiOrders(prev => [payload.new, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setAiOrders(prev => prev.map(order => 
            order.id === payload.new.id ? payload.new : order
          ));
        } else if (payload.eventType === 'DELETE') {
          setAiOrders(prev => prev.filter(order => order.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAiOrders]);

  return {
    aiOrders,
    loading,
    error,
    fetchAiOrders,
    approveOrder,
    deleteOrder
  };
};

// مكون بطاقة الطلب المبسط
export const SimpleAiOrderCard = ({ order, onApprove, onDelete }) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApprove = async () => {
    setIsProcessing(true);
    await onApprove(order.id);
    setIsProcessing(false);
  };

  const handleDelete = async () => {
    setIsProcessing(true);
    await onDelete(order.id);
    setIsProcessing(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'approved': return 'bg-green-500';
      case 'needs_review': return 'bg-orange-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const formatDateTime = (date) => {
    try {
      return new Date(date).toLocaleString('ar-SA', {
        year: 'numeric',
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return String(date);
    }
  };

  return (
    <Card className="mb-4 border-l-4 border-l-primary">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <span className="font-medium">طلب #{order.id}</span>
          </div>
          <Badge className={cn("text-white", getStatusColor(order.status))}>
            {order.status === 'pending' ? 'في الانتظار' :
             order.status === 'approved' ? 'معتمد' :
             order.status === 'needs_review' ? 'يحتاج مراجعة' :
             order.status === 'error' ? 'خطأ' : order.status}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">المصدر:</span> {order.source || 'غير محدد'}
          </div>
          <div>
            <span className="font-medium">التاريخ:</span> {formatDateTime(order.created_at)}
          </div>
          {order.customer_name && (
            <div>
              <span className="font-medium">العميل:</span> {order.customer_name}
            </div>
          )}
          {order.customer_phone && (
            <div>
              <span className="font-medium">الهاتف:</span> {order.customer_phone}
            </div>
          )}
          
          {order.items && Array.isArray(order.items) && (
            <div>
              <span className="font-medium">المنتجات:</span>
              <ul className="mt-1 space-y-1">
                {order.items.slice(0, 3).map((item, index) => (
                  <li key={index} className="text-xs bg-muted p-2 rounded">
                    {item.product_name || item.name} - الكمية: {item.quantity}
                    {item.color && ` - اللون: ${item.color}`}
                    {item.size && ` - المقاس: ${item.size}`}
                  </li>
                ))}
                {order.items.length > 3 && (
                  <li className="text-xs text-muted-foreground">
                    و {order.items.length - 3} منتجات أخرى...
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        {order.status === 'pending' && (
          <div className="flex gap-2 mt-4">
            <Button 
              onClick={handleApprove}
              disabled={isProcessing}
              size="sm"
              className="flex-1"
            >
              {isProcessing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              اعتماد
            </Button>
            <Button 
              onClick={handleDelete}
              disabled={isProcessing}
              variant="destructive"
              size="sm"
              className="flex-1"
            >
              {isProcessing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              حذف
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default useAiOrdersCore;