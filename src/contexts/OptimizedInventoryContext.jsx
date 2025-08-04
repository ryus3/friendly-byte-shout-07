/**
 * ⚡ نسخة محسنة من InventoryContext لتوفير استهلاك البيانات
 * 
 * التحسينات:
 * - إيقاف Real-time subscriptions المفرطة
 * - تقليل الاستعلامات المكررة
 * - تحسين Cache
 * - استعلامات ذكية فقط عند الحاجة
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from './UnifiedAuthContext';
import { toast } from '@/hooks/use-toast';

const OptimizedInventoryContext = createContext();

export const useOptimizedInventory = () => {
  const context = useContext(OptimizedInventoryContext);
  if (!context) {
    throw new Error('useOptimizedInventory must be used within OptimizedInventoryProvider');
  }
  return context;
};

export const OptimizedInventoryProvider = ({ children }) => {
  const { user } = useAuth();
  
  // الحالات الأساسية فقط
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);

  // دالة ذكية لجلب البيانات فقط عند الحاجة
  const smartRefresh = useCallback(async (forceRefresh = false) => {
    if (!user) return;
    
    // تجنب التحديث المتكرر
    const now = Date.now();
    if (!forceRefresh && lastRefresh && (now - lastRefresh) < 30000) {
      console.log('⚡ تجنب التحديث المتكرر - آخر تحديث قبل', Math.round((now - lastRefresh) / 1000), 'ثانية');
      return;
    }

    setLoading(true);
    try {
      // استعلام واحد محسن للمنتجات مع المتغيرات
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select(`
          id, name, barcode, description, image_url, category, department, is_active,
          product_variants!inner(
            id, color, size, cost_price, selling_price, quantity, reserved_quantity, barcode
          )
        `)
        .eq('is_active', true)
        .limit(100); // تحديد حد للبيانات

      if (productsError) throw productsError;
      
      setProducts(productsData || []);
      setLastRefresh(now);
      
      console.log(`⚡ تم تحديث ${productsData?.length || 0} منتج بنجاح`);
      
    } catch (error) {
      console.error('❌ خطأ في تحديث البيانات:', error);
      toast({
        title: "خطأ في التحديث",
        description: "فشل في تحديث البيانات، يرجى المحاولة مرة أخرى",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [user, lastRefresh]);

  // جلب الطلبات بشكل محسن
  const refreshOrders = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, order_number, customer_name, total_amount, status, created_at,
          order_items(quantity, unit_price, total_price)
        `)
        .order('created_at', { ascending: false })
        .limit(50); // آخر 50 طلب فقط

      if (error) throw error;
      setOrders(data || []);
      
    } catch (error) {
      console.error('❌ خطأ في تحديث الطلبات:', error);
    }
  }, [user]);

  // تحديث ذكي عند تحميل الصفحة فقط
  useEffect(() => {
    if (user) {
      smartRefresh(true);
      refreshOrders();
    }
  }, [user, smartRefresh, refreshOrders]);

  // Real-time محدود فقط للطلبات المهمة
  useEffect(() => {
    if (!user) return;

    // Real-time فقط للطلبات الجديدة (ليس كل التحديثات)
    const ordersChannel = supabase
      .channel('critical-orders-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('🆕 طلب جديد:', payload.new);
          setOrders(prev => [payload.new, ...prev.slice(0, 49)]);
          
          // إشعار للمستخدم
          toast({
            title: "طلب جديد",
            description: `طلب من ${payload.new.customer_name}`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
    };
  }, [user]);

  const value = {
    // البيانات
    products,
    inventory,
    orders,
    loading,
    
    // الدوال
    refreshProducts: () => smartRefresh(true),
    refreshOrders,
    smartRefresh,
    
    // إحصائيات سريعة
    totalProducts: products.length,
    totalOrders: orders.length,
    pendingOrders: orders.filter(o => o.status === 'pending').length,
  };

  return (
    <OptimizedInventoryContext.Provider value={value}>
      {children}
    </OptimizedInventoryContext.Provider>
  );
};

export default OptimizedInventoryProvider;