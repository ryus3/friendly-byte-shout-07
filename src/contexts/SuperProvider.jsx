/**
 * SuperProvider - الإصدار الآمن العاجل
 * إصلاح فوري لاستعادة البيانات
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useNotificationsSystem } from '@/contexts/NotificationsSystemContext';
import { useCart } from '@/hooks/useCart.jsx';
import { supabase } from '@/integrations/supabase/client';

const SuperContext = createContext();

export const useSuper = () => {
  const context = useContext(SuperContext);
  if (!context) {
    throw new Error('useSuper must be used within a SuperProvider');
  }
  return context;
};

// إضافة alias للتوافق العكسي
export const useInventory = () => {
  return useSuper();
};

export const SuperProvider = ({ children }) => {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const { addNotification } = useNotifications();
  const { notifyLowStock } = useNotificationsSystem();
  
  // إضافة وظائف السلة
  const { cart, addToCart, removeFromCart, updateCartItemQuantity, clearCart } = useCart();
  
  // حالة البيانات - بسيطة وآمنة
  const [allData, setAllData] = useState({
    products: [],
    orders: [],
    customers: [],
    purchases: [],
    expenses: [],
    profits: [],
    cashSources: [],
    settings: { 
      deliveryFee: 5000, 
      lowStockThreshold: 5, 
      mediumStockThreshold: 10, 
      sku_prefix: "PROD", 
      lastPurchaseId: 0,
      printer: { paperSize: 'a4', orientation: 'portrait' }
    },
    aiOrders: [],
    profitRules: [],
    colors: [],
    sizes: [],
    categories: [],
    departments: [],
    productTypes: [],
    seasons: []
  });
  
  const [loading, setLoading] = useState(true);
  const [accounting, setAccounting] = useState({ 
    capital: 10000000, 
    expenses: [] 
  });

  // جلب البيانات - الإصدار الآمن
  const fetchAllData = useCallback(async () => {
    if (!user) {
      console.log('⚠️ SuperProvider SAFE: لا يوجد مستخدم');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      console.log('🚀 SuperProvider SAFE: بدء جلب البيانات للمستخدم:', user.full_name || user.email);
      
      // جلب المنتجات فقط أولاً
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select(`
          *,
          product_variants (
            *,
            colors (id, name, hex_code),
            sizes (id, name, type),
            inventory (quantity, min_stock, reserved_quantity, location)
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      console.log('📊 SuperProvider SAFE: نتائج المنتجات:', {
        error: productsError,
        count: products?.length || 0
      });

      if (productsError) {
        console.error('❌ خطأ في المنتجات:', productsError);
        setAllData(prev => ({ ...prev, products: [] }));
        setLoading(false);
        return;
      }

      // جلب الطلبات
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      console.log('📊 SuperProvider SAFE: نتائج الطلبات:', {
        error: ordersError,
        count: orders?.length || 0
      });

      // معالجة المنتجات - بسيطة وآمنة
      const processedProducts = (products || []).map(product => {
        const processedVariants = (product.product_variants || []).map(variant => {
          const quantity = variant.inventory?.quantity || variant.quantity || 0;
          
          console.log(`📦 SAFE: متغير ${variant.id} - الكمية: ${quantity}`);
          
          return {
            ...variant,
            quantity: quantity,
            reserved_quantity: variant.inventory?.reserved_quantity || 0,
            size: variant.sizes?.name || 'غير محدد',
            color: variant.colors?.name || 'غير محدد'
          };
        });
        
        console.log(`🔧 SAFE: منتج ${product.name} - ${processedVariants.length} متغيرات`);
        
        return {
          ...product,
          variants: processedVariants
        };
      });

      const finalData = {
        products: processedProducts,
        orders: orders || [],
        customers: [],
        purchases: [],
        expenses: [],
        profits: [],
        cashSources: [],
        settings: { 
          deliveryFee: 5000, 
          lowStockThreshold: 5, 
          mediumStockThreshold: 10, 
          sku_prefix: "PROD", 
          lastPurchaseId: 0,
          printer: { paperSize: 'a4', orientation: 'portrait' }
        },
        aiOrders: [],
        profitRules: [],
        colors: [],
        sizes: [],
        categories: [],
        departments: [],
        productTypes: [],
        seasons: []
      };

      console.log('✅ SuperProvider SAFE: البيانات النهائية:', {
        products: finalData.products?.length || 0,
        orders: finalData.orders?.length || 0,
        firstProduct: finalData.products?.[0] ? {
          name: finalData.products[0].name,
          variants: finalData.products[0].variants?.length || 0
        } : null
      });

      setAllData(finalData);
      
    } catch (error) {
      console.error('❌ SuperProvider SAFE: خطأ عام:', error);
      
      // استعادة البيانات الافتراضية
      setAllData({
        products: [],
        orders: [],
        customers: [],
        purchases: [],
        expenses: [],
        profits: [],
        cashSources: [],
        settings: { 
          deliveryFee: 5000, 
          lowStockThreshold: 5, 
          mediumStockThreshold: 10, 
          sku_prefix: "PROD", 
          lastPurchaseId: 0,
          printer: { paperSize: 'a4', orientation: 'portrait' }
        },
        aiOrders: [],
        profitRules: [],
        colors: [],
        sizes: [],
        categories: [],
        departments: [],
        productTypes: [],
        seasons: []
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  // تحميل البيانات عند بدء التشغيل
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // وظائف أساسية للتوافق
  const createOrder = useCallback(async () => ({ success: false, error: 'سيتم تطبيقها لاحقاً' }), []);
  const updateOrder = useCallback(async () => ({ success: false, error: 'سيتم تطبيقها لاحقاً' }), []);
  const deleteOrders = useCallback(async () => ({ success: false, error: 'سيتم تطبيقها لاحقاً' }), []);
  const addExpense = useCallback(async () => ({ success: false, error: 'سيتم تطبيقها لاحقاً' }), []);
  const refreshOrders = useCallback(() => fetchAllData(), [fetchAllData]);
  const refreshProducts = useCallback(() => fetchAllData(), [fetchAllData]);
  const approveAiOrder = useCallback(async () => ({ success: false }), []);

  // القيم المرجعة - آمنة ومبسطة
  const contextValue = {
    // البيانات الأساسية
    products: allData.products || [],
    orders: allData.orders || [],
    customers: allData.customers || [],
    purchases: allData.purchases || [],
    expenses: allData.expenses || [],
    profits: allData.profits || [],
    aiOrders: allData.aiOrders || [],
    settings: allData.settings,
    accounting: accounting,
    
    // بيانات المرشحات
    categories: allData.categories || [],
    departments: allData.departments || [],
    allColors: allData.colors || [],
    allSizes: allData.sizes || [],
    
    // حالة التحميل
    loading: loading,
    
    // وظائف السلة
    cart: cart || [],
    addToCart: addToCart || (() => {}),
    removeFromCart: removeFromCart || (() => {}),
    updateCartItemQuantity: updateCartItemQuantity || (() => {}),
    clearCart: clearCart || (() => {}),
    
    // الوظائف الأساسية
    createOrder,
    updateOrder,
    deleteOrders,
    addExpense,
    refreshOrders,
    refreshProducts,
    approveAiOrder,
    
    // وظائف للتوافق
    addProduct: () => console.log('addProduct - سيتم تطبيقها لاحقاً'),
    updateProduct: () => console.log('updateProduct - سيتم تطبيقها لاحقاً'),
    deleteProducts: () => console.log('deleteProducts - سيتم تطبيقها لاحقاً'),
    updateVariantStock: () => console.log('updateVariantStock - سيتم تطبيقها لاحقاً'),
    getLowStockProducts: () => [],
    calculateProfit: () => 0,
    calculateManagerProfit: () => 0,
  };

  console.log('🔍 SuperProvider SAFE contextValue:', {
    productsCount: contextValue.products?.length || 0,
    ordersCount: contextValue.orders?.length || 0,
    loading: contextValue.loading
  });

  return (
    <SuperContext.Provider value={contextValue}>
      {children}
    </SuperContext.Provider>
  );
};