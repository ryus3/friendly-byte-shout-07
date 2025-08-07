/**
 * السياق الفائق - يحل محل جميع Contexts المبعثرة
 * نظام واحد، بيانات واحدة، أداء خرافي
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { unifiedAPI } from '@/core/unified-api';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { toast } from '@/hooks/use-toast';

const SuperContext = createContext();

export const useSuper = () => {
  const context = useContext(SuperContext);
  if (!context) {
    throw new Error('useSuper must be used within SuperProvider');
  }
  return context;
};

export const SuperProvider = ({ children }) => {
  const { user } = useAuth();
  
  // حالة موحدة لكل البيانات
  const [state, setState] = useState({
    // البيانات الأساسية
    products: [],
    orders: [],
    customers: [],
    purchases: [],
    expenses: [],
    profits: [],
    cashSources: [],
    
    // بيانات المتغيرات
    colors: [],
    sizes: [],
    categories: [],
    departments: [],
    productTypes: [],
    seasons: [],
    
    // إعدادات النظام
    settings: {},
    employeeRules: [],
    
    // حالة التحميل والأخطاء
    loading: {
      products: false,
      orders: false,
      global: true
    },
    errors: {},
    
    // فلاتر وبحث
    filters: {
      products: {},
      orders: {},
      customers: {}
    },
    
    // السلة والطلب السريع
    cart: [],
    quickOrder: {
      customer: null,
      items: []
    }
  });

  // دالة تحديث الحالة الذكية
  const updateState = useCallback((updates) => {
    setState(prev => {
      if (typeof updates === 'function') {
        return updates(prev);
      }
      return { ...prev, ...updates };
    });
  }, []);

  // تحميل جميع البيانات مرة واحدة
  const loadAllData = useCallback(async () => {
    if (!user) return;
    
    try {
      updateState({ loading: { ...state.loading, global: true } });
      
      console.log('🚀 بدء تحميل البيانات الموحدة...');
      
      // تحميل كل شيء مع Promise.all للسرعة
      const [
        products,
        orders, 
        customers,
        purchases,
        expenses,
        profits,
        cashSources,
        variantsData,
        systemData
      ] = await Promise.all([
        unifiedAPI.getProducts(),
        unifiedAPI.getOrders(),
        unifiedAPI.getCustomers(),
        unifiedAPI.getPurchases(),
        unifiedAPI.getExpenses(),
        unifiedAPI.getProfits(),
        unifiedAPI.getCashSources(),
        unifiedAPI.getVariantsData(),
        unifiedAPI.getSystemData()
      ]);
      
      console.log('✅ تم تحميل جميع البيانات بنجاح');
      
      // تحديث الحالة مرة واحدة
      updateState({
        products: products || [],
        orders: orders || [],
        customers: customers || [],
        purchases: purchases || [],
        expenses: expenses || [],
        profits: profits || [],
        cashSources: cashSources || [],
        
        // بيانات المتغيرات
        colors: variantsData?.colors || [],
        sizes: variantsData?.sizes || [],
        categories: variantsData?.categories || [],
        departments: variantsData?.departments || [],
        productTypes: variantsData?.productTypes || [],
        seasons: variantsData?.seasons || [],
        
        // بيانات النظام
        settings: systemData?.settings?.[0] || {},
        employeeRules: systemData?.employeeRules || [],
        
        loading: { global: false },
        errors: {}
      });
      
      console.log('🎉 تم تحديث الحالة الموحدة بنجاح');
      
    } catch (error) {
      console.error('❌ خطأ في تحميل البيانات:', error);
      updateState({
        loading: { global: false },
        errors: { global: error.message }
      });
      
      toast({
        title: 'خطأ في تحميل البيانات',
        description: error.message,
        variant: 'destructive'
      });
    }
  }, [user, updateState, state.loading]);

  // تحميل البيانات عند تسجيل الدخول
  useEffect(() => {
    loadAllData();
  }, [user?.id]);

  // اشتراكات Realtime ذكية
  useEffect(() => {
    if (!user) return;
    
    const subscriptions = [];
    
    // اشتراك المنتجات والمخزون
    subscriptions.push(
      unifiedAPI.subscribeRealtime('products', () => {
        console.log('🔄 تحديث المنتجات...');
        unifiedAPI.getProducts().then(products => {
          updateState({ products: products || [] });
        });
      })
    );
    
    // اشتراك الطلبات
    subscriptions.push(
      unifiedAPI.subscribeRealtime('orders', () => {
        console.log('🔄 تحديث الطلبات...');
        unifiedAPI.getOrders().then(orders => {
          updateState({ orders: orders || [] });
        });
      })
    );
    
    // اشتراك المخزون
    subscriptions.push(
      unifiedAPI.subscribeRealtime('inventory', () => {
        console.log('🔄 تحديث المخزون...');
        unifiedAPI.getProducts().then(products => {
          updateState({ products: products || [] });
        });
      })
    );
    
    return () => {
      console.log('🧹 تنظيف اشتراكات Realtime');
      subscriptions.forEach(sub => {
        if (sub) unifiedAPI.unsubscribeRealtime(sub);
      });
    };
  }, [user, updateState]);

  // =============
  // دوال العمليات الموحدة
  // =============

  // إنشاء طلب
  const createOrder = useCallback(async (customerInfo, cartItems, options = {}) => {
    try {
      updateState(prev => ({
        ...prev,
        loading: { ...prev.loading, orders: true }
      }));
      
      // حساب المجاميع
      const subtotal = cartItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
      const deliveryFee = options.deliveryFee || state.settings?.deliveryFee || 0;
      const discount = options.discount || 0;
      const total = subtotal + deliveryFee - discount;
      
      const orderData = {
        customer_name: customerInfo.name,
        customer_phone: customerInfo.phone,
        customer_address: customerInfo.address,
        customer_city: customerInfo.city,
        customer_province: customerInfo.province,
        total_amount: subtotal,
        delivery_fee: deliveryFee,
        discount: discount,
        final_amount: total,
        status: options.status || 'pending',
        payment_status: options.paymentStatus || 'pending',
        delivery_status: options.deliveryStatus || 'pending',
        notes: customerInfo.notes,
        created_by: user?.id
      };
      
      const newOrder = await unifiedAPI.createOrder(orderData);
      
      // إضافة عناصر الطلب
      // ... (منطق إضافة عناصر الطلب)
      
      // تحديث الحالة المحلية
      updateState(prev => ({
        ...prev,
        orders: [newOrder, ...prev.orders],
        loading: { ...prev.loading, orders: false }
      }));
      
      toast({
        title: 'تم إنشاء الطلب بنجاح',
        description: `رقم الطلب: ${newOrder.order_number}`,
        variant: 'success'
      });
      
      return { success: true, data: newOrder };
      
    } catch (error) {
      console.error('❌ خطأ في إنشاء الطلب:', error);
      updateState(prev => ({
        ...prev,
        loading: { ...prev.loading, orders: false },
        errors: { ...prev.errors, orders: error.message }
      }));
      
      toast({
        title: 'خطأ في إنشاء الطلب',
        description: error.message,
        variant: 'destructive'
      });
      
      return { success: false, error: error.message };
    }
  }, [user, state.settings, updateState]);

  // إضافة مصروف
  const addExpense = useCallback(async (expenseData) => {
    try {
      const newExpense = await unifiedAPI.addExpense({
        ...expenseData,
        created_by: user?.id
      });
      
      updateState(prev => ({
        ...prev,
        expenses: [newExpense, ...prev.expenses]
      }));
      
      toast({
        title: 'تم إضافة المصروف',
        description: `${expenseData.description}: ${expenseData.amount.toLocaleString()} د.ع`,
        variant: 'success'
      });
      
      return { success: true, data: newExpense };
      
    } catch (error) {
      console.error('❌ خطأ في إضافة المصروف:', error);
      toast({
        title: 'خطأ في إضافة المصروف',
        description: error.message,
        variant: 'destructive'
      });
      
      return { success: false, error: error.message };
    }
  }, [user, updateState]);

  // تحديث المخزون
  const updateInventory = useCallback(async (variantId, quantity) => {
    try {
      await unifiedAPI.updateInventory(variantId, quantity);
      
      // إعادة تحميل المنتجات لتحديث المخزون
      const updatedProducts = await unifiedAPI.getProducts();
      updateState(prev => ({
        ...prev,
        products: updatedProducts || []
      }));
      
      toast({
        title: 'تم تحديث المخزون',
        description: `تم تحديث الكمية إلى ${quantity}`,
        variant: 'success'
      });
      
      return { success: true };
      
    } catch (error) {
      console.error('❌ خطأ في تحديث المخزون:', error);
      toast({
        title: 'خطأ في تحديث المخزون',
        description: error.message,
        variant: 'destructive'
      });
      
      return { success: false, error: error.message };
    }
  }, [updateState]);

  // إدارة السلة
  const cartActions = useMemo(() => ({
    add: (product, variant, quantity = 1) => {
      updateState(prev => {
        const existingIndex = prev.cart.findIndex(
          item => item.productId === product.id && item.variantId === variant.id
        );
        
        if (existingIndex >= 0) {
          const newCart = [...prev.cart];
          newCart[existingIndex].quantity += quantity;
          return { ...prev, cart: newCart };
        } else {
          const newItem = {
            productId: product.id,
            variantId: variant.id,
            productName: product.name,
            variantInfo: `${variant.color?.name || ''} - ${variant.size?.name || ''}`,
            price: variant.price,
            quantity,
            image: variant.images?.[0] || product.images?.[0]
          };
          return { ...prev, cart: [...prev.cart, newItem] };
        }
      });
    },
    
    remove: (productId, variantId) => {
      updateState(prev => ({
        ...prev,
        cart: prev.cart.filter(
          item => !(item.productId === productId && item.variantId === variantId)
        )
      }));
    },
    
    updateQuantity: (productId, variantId, quantity) => {
      if (quantity <= 0) {
        cartActions.remove(productId, variantId);
        return;
      }
      
      updateState(prev => ({
        ...prev,
        cart: prev.cart.map(item =>
          item.productId === productId && item.variantId === variantId
            ? { ...item, quantity }
            : item
        )
      }));
    },
    
    clear: () => {
      updateState(prev => ({ ...prev, cart: [] }));
    }
  }), [updateState]);

  // البيانات المحسوبة (Computed)
  const computed = useMemo(() => ({
    // إحصائيات المنتجات
    productsStats: {
      total: state.products.length,
      lowStock: state.products.filter(p => 
        p.variants?.some(v => (v.inventory?.[0]?.quantity || 0) <= (v.inventory?.[0]?.min_stock || 5))
      ).length,
      outOfStock: state.products.filter(p =>
        p.variants?.every(v => (v.inventory?.[0]?.quantity || 0) === 0)
      ).length
    },
    
    // إحصائيات الطلبات
    ordersStats: {
      total: state.orders.length,
      pending: state.orders.filter(o => o.status === 'pending').length,
      completed: state.orders.filter(o => o.status === 'completed').length,
      revenue: state.orders
        .filter(o => ['completed', 'delivered'].includes(o.status))
        .reduce((sum, o) => sum + (o.final_amount || 0), 0)
    },
    
    // مجموع السلة
    cartTotal: state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
    cartItemsCount: state.cart.reduce((sum, item) => sum + item.quantity, 0)
  }), [state.products, state.orders, state.cart]);

  // إعادة تحميل البيانات
  const refresh = useCallback(async (dataType) => {
    if (dataType) {
      // تحميل نوع محدد
      try {
        const data = await unifiedAPI[`get${dataType.charAt(0).toUpperCase() + dataType.slice(1)}`]();
        updateState(prev => ({ ...prev, [dataType]: data || [] }));
      } catch (error) {
        console.error(`❌ خطأ في تحديث ${dataType}:`, error);
      }
    } else {
      // تحميل كل شيء
      await loadAllData();
    }
  }, [loadAllData, updateState]);

  // القيمة النهائية للسياق
  const value = {
    // البيانات
    ...state,
    computed,
    
    // العمليات
    createOrder,
    addExpense,
    updateInventory,
    
    // إدارة السلة
    cart: cartActions,
    
    // أدوات مساعدة
    refresh,
    updateState,
    
    // حالة النظام
    isLoading: state.loading.global,
    hasErrors: Object.keys(state.errors).length > 0
  };

  return (
    <SuperContext.Provider value={value}>
      {children}
    </SuperContext.Provider>
  );
};

export default SuperProvider;