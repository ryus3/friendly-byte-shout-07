import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/UnifiedAuthContext';

const OrdersRealtimeContext = createContext();

export const useOrdersRealtime = () => useContext(OrdersRealtimeContext);

export const OrdersRealtimeProvider = ({ children }) => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [aiOrders, setAiOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // تحديث الطلبات من قاعدة البيانات
  const refreshOrders = useCallback(async () => {
    try {
      const { data: ordersData, error } = await supabase.from('orders').select(`
        *,
        order_items (
          id,
          product_id,
          variant_id,
          quantity,
          unit_price,
          total_price,
          products (
            id,
            name,
            images,
            base_price
          ),
          product_variants (
            id,
            price,
            cost_price,
            images,
            colors (name, hex_code),
            sizes (name)
          )
        )
      `).order('created_at', { ascending: false });

      if (error) throw error;

      // معالجة وتحويل بيانات الطلبات
      const processedOrders = (ordersData || []).map(order => {
        const items = (order.order_items || []).map(item => ({
          id: item.id,
          productId: item.product_id,
          variantId: item.variant_id,
          productName: item.products?.name || 'منتج غير محدد',
          product_name: item.products?.name || 'منتج غير محدد',
          name: item.products?.name || 'منتج غير محدد',
          quantity: item.quantity,
          price: item.unit_price,
          unit_price: item.unit_price,
          total_price: item.total_price,
          costPrice: item.product_variants?.cost_price || 0,
          cost_price: item.product_variants?.cost_price || 0,
          color: item.product_variants?.colors?.name || null,
          size: item.product_variants?.sizes?.name || null,
          image: item.product_variants?.images?.[0] || item.products?.images?.[0] || null
        }));

        return {
          ...order,
          items,
          total: order.final_amount || order.total_amount,
          order_items: order.order_items
        };
      });

      setOrders(processedOrders || []);
    } catch (error) {
      console.error('❌ خطأ في تحديث الطلبات:', error);
    }
  }, []);

  // تحديث الطلبات الذكية
  const refreshAiOrders = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('ai_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAiOrders(data || []);
    } catch (error) {
      console.error('❌ خطأ في تحديث الطلبات الذكية:', error);
    }
  }, []);

  // تحميل البيانات الأولية
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const loadInitialData = async () => {
      try {
        setLoading(true);
        await Promise.all([refreshOrders(), refreshAiOrders()]);
      } catch (error) {
        console.error('خطأ في تحميل البيانات الأولية:', error);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [user, refreshOrders, refreshAiOrders]);

  // Realtime subscriptions
  useEffect(() => {
    if (!user) return;

    console.log('🔄 بدء subscriptions للطلبات...');

    // Realtime للطلبات العادية
    const ordersChannel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('🆕 طلب جديد:', payload.new);
          refreshOrders(); // إعادة تحميل مع العلاقات
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('🔄 تحديث طلب:', payload.new);
          setOrders(prev => prev.map(order => 
            order.id === payload.new.id ? { ...order, ...payload.new } : order
          ));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('🗑️ حذف طلب:', payload.old);
          setOrders(prev => prev.filter(order => order.id !== payload.old.id));
        }
      )
      .subscribe();

    // Realtime لعناصر الطلبات
    const orderItemsChannel = supabase
      .channel('order-items-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_items'
        },
        (payload) => {
          console.log('🔄 تحديث عناصر الطلب:', payload);
          refreshOrders(); // إعادة تحميل لتحديث العناصر
        }
      )
      .subscribe();

    // Realtime للطلبات الذكية
    const aiOrdersChannel = supabase
      .channel('ai-orders-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ai_orders'
        },
        (payload) => {
          console.log('🤖 طلب ذكي جديد:', payload.new);
          setAiOrders(prev => [payload.new, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ai_orders'
        },
        (payload) => {
          console.log('🔄 تحديث طلب ذكي:', payload.new);
          setAiOrders(prev => prev.map(order => 
            order.id === payload.new.id ? { ...order, ...payload.new } : order
          ));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'ai_orders'
        },
        (payload) => {
          console.log('🗑️ حذف طلب ذكي:', payload.old);
          setAiOrders(prev => prev.filter(order => order.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      console.log('🛑 إيقاف subscriptions للطلبات...');
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(orderItemsChannel);
      supabase.removeChannel(aiOrdersChannel);
    };
  }, [user, refreshOrders]);

  const value = {
    orders,
    aiOrders,
    loading,
    refreshOrders,
    refreshAiOrders,
    setOrders,
    setAiOrders
  };

  return (
    <OrdersRealtimeContext.Provider value={value}>
      {children}
    </OrdersRealtimeContext.Provider>
  );
};