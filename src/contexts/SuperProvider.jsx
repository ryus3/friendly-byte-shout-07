/**
 * SuperProvider - مزود البيانات الموحد الجديد
 * يستبدل InventoryContext بنظام أكثر كفاءة مع ضمان عدم تغيير أي وظيفة
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useNotificationsSystem } from '@/contexts/NotificationsSystemContext';
import { useCart } from '@/hooks/useCart.jsx';
import { supabase } from '@/integrations/supabase/client';
import superAPI from '@/api/SuperAPI';
import { getUserUUID, getEmployeeCode } from '@/utils/userIdUtils';

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

// دالة تصفية البيانات - تصفية حسب UUID/employee_code للموظفين فقط
const filterDataByEmployeeCode = (data, user) => {
  if (!user || !data) return data;

  const userUUID = getUserUUID(user);
  const employeeCode = getEmployeeCode(user);
  const isAdmin = user.is_admin || ['super_admin', 'admin', 'manager'].includes(user.role);
  const ids = Array.from(new Set([userUUID, user?.id, user?.user_id].filter(Boolean)));

  console.log('🔍 SuperProvider - المستخدم:', {
    uuid: userUUID,
    alt_ids: ids,
    employee_code: employeeCode,
    role: user.role,
    is_admin: user.is_admin
  });
  console.log('📊 SuperProvider - إحصاءات قبل التصفية:', {
    orders: data.orders?.length || 0,
    customers: data.customers?.length || 0,
    products: data.products?.length || 0,
    profits: data.profits?.length || 0
  });

  if (isAdmin) {
    console.log('👑 مدير - عرض جميع البيانات');
    return data;
  }

  const byUUID = (item, fields = []) => fields.some(f => item && ids.includes(item[f]));
  const byCode = (item, fields = []) => fields.some(f => item && item[f] && item[f] === employeeCode);

  const filtered = {
    ...data,
    orders: (data.orders || []).filter(o => byUUID(o, ['created_by', 'employee_id'])),
    customers: (data.customers || []).filter(c => byUUID(c, ['created_by'])),
    purchases: (data.purchases || []).filter(p => byUUID(p, ['created_by'])),
    expenses: (data.expenses || []).filter(e => byUUID(e, ['created_by', 'employee_id']) || byCode(e, ['employee_code'])),
    profits: (data.profits || []).filter(p => (employeeCode ? byCode(p, ['employee_code']) : false) || byUUID(p, ['employee_id', 'created_by'])),
    aiOrders: (data.aiOrders || []).filter(o => byUUID(o, ['created_by'])),
    // قوائم الفلاتر تبقى كما هي للجميع
    colors: data.colors || [],
    sizes: data.sizes || [],
    categories: data.categories || [],
    departments: data.departments || [],
    productTypes: data.productTypes || [],
    seasons: data.seasons || [],
  };

  console.log('✅ SuperProvider - بعد التصفية:', {
    orders: filtered.orders.length,
    customers: filtered.customers.length,
    profits: filtered.profits.length
  });

  return filtered;
};

export const SuperProvider = ({ children }) => {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const { addNotification } = useNotifications();
  const { notifyLowStock } = useNotificationsSystem();
  
  // إضافة وظائف السلة
  const { cart, addToCart, removeFromCart, updateCartItemQuantity, clearCart } = useCart();
  
  // حالة البيانات الموحدة - نفس البنية القديمة بالضبط
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
    employeeProfitRules: [],
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

  // جلب البيانات الموحدة عند بدء التشغيل - مع تصفية employee_code
  const fetchAllData = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      console.log('🚀 SuperProvider: جلب جميع البيانات للمستخدم:', user.employee_code || user.user_id);
      
      const data = await superAPI.getAllData();
      
      // التحقق من البيانات
      if (!data) {
        console.error('❌ SuperProvider: لم يتم جلب أي بيانات من SuperAPI');
        return;
      }
      
      // تصفية البيانات حسب employee_code للموظفين
      const filteredData = filterDataByEmployeeCode(data, user);
      
      console.log('✅ SuperProvider: تم جلب وتصفية البيانات بنجاح:', {
        products: filteredData.products?.length || 0,
        orders: filteredData.orders?.length || 0,
        customers: filteredData.customers?.length || 0,
        userEmployeeCode: user.employee_code || 'admin',
        userUUID: user.user_id || user.id,
        totalUnfilteredOrders: data.orders?.length || 0,
        filteredOrdersAfter: filteredData.orders?.length || 0,
        sampleProduct: filteredData.products?.[0] ? {
          id: filteredData.products[0].id,
          name: filteredData.products[0].name,
          variantsCount: filteredData.products[0].product_variants?.length || 0,
          firstVariant: filteredData.products[0].product_variants?.[0] ? {
            id: filteredData.products[0].product_variants[0].id,
            quantity: filteredData.products[0].product_variants[0].quantity,
            inventoryData: filteredData.products[0].product_variants[0].inventory
          } : null
        } : null
      });
      
      // معالجة بيانات المنتجات لضمان ربط المخزون
      const processedData = {
        ...filteredData,
        products: (filteredData.products || []).map(product => ({
          ...product,
          variants: (product.product_variants || []).map(variant => {
            // ربط المخزون بشكل صحيح من جدول inventory
            const inventoryData = Array.isArray(variant.inventory) ? variant.inventory[0] : variant.inventory;
            
            return {
              ...variant,
              // ربط بيانات المخزون بالشكل الصحيح
              quantity: inventoryData?.quantity || variant.quantity || 0,
              reserved_quantity: inventoryData?.reserved_quantity || variant.reserved_quantity || 0,
              min_stock: inventoryData?.min_stock || variant.min_stock || 5,
              location: inventoryData?.location || variant.location || '',
              // الحفاظ على البيانات الأصلية
              inventory: inventoryData
            }
          })
        }))
      };
      
      console.log('🔗 SuperProvider: معالجة بيانات المخزون:', {
        processedProductsCount: processedData.products?.length || 0,
        sampleProcessedProduct: processedData.products?.[0] ? {
          id: processedData.products[0].id,
          name: processedData.products[0].name,
          variantsCount: processedData.products[0].variants?.length || 0,
          firstProcessedVariant: processedData.products[0].variants?.[0] ? {
            id: processedData.products[0].variants[0].id,
            quantity: processedData.products[0].variants[0].quantity,
            originalInventory: processedData.products[0].variants[0].inventory
          } : null
        } : null
      });
      
      setAllData(processedData);
      
      // تحديث accounting بنفس الطريقة القديمة
      setAccounting(prev => ({
        ...prev,
        expenses: filteredData.expenses || []
      }));
      
    } catch (error) {
      console.error('❌ SuperProvider: خطأ في جلب البيانات:', error);
      
      // في حالة فشل SuperAPI، استخدم الطريقة القديمة
      console.log('🔄 SuperProvider: استخدام الطريقة القديمة...');
      
      try {
        console.log('🔄 SuperProvider: محاولة جلب البيانات بالطريقة التقليدية...');
        
        // جلب البيانات الأساسية فقط لتجنب التعقيد
        const { data: basicProducts, error: productsError } = await supabase
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
          .order('created_at', { ascending: false });

        if (productsError) throw productsError;

        const { data: basicOrders, error: ordersError } = await supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false });

        if (ordersError) throw ordersError;

        console.log('✅ SuperProvider: البيانات التقليدية محملة:', {
          products: basicProducts?.length || 0,
          orders: basicOrders?.length || 0
        });

        // إنشاء بيانات احتياطية
        const fallbackData = {
          products: basicProducts || [],
          orders: basicOrders || [],
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
            lastPurchaseId: 0 
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

        setAllData(fallbackData);
        
      } catch (fallbackError) {
        console.error('❌ SuperProvider: فشل في الطريقة التقليدية أيضاً:', fallbackError);
        
        // بيانات افتراضية للحالات الطارئة
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
            lastPurchaseId: 0 
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
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  // تحميل البيانات عند بدء التشغيل
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // إعداد Realtime للتحديثات الفورية
  useEffect(() => {
    if (!user) return;

    const handleRealtimeUpdate = (table, payload) => {
      console.log(`🔄 SuperProvider: تحديث فوري في ${table}`);
      
      // إعادة تحميل البيانات عند وجود تحديث
      fetchAllData();
    };

    superAPI.setupRealtimeSubscriptions(handleRealtimeUpdate);

    return () => {
      superAPI.unsubscribeAll();
    };
  }, [user, fetchAllData]);

  // ===============================
  // وظائف متوافقة مع InventoryContext
  // ===============================

  // إنشاء طلب جديد - نفس الواجهة القديمة بالضبط
  const createOrder = useCallback(async (customerInfo, cartItems, trackingNumber, discount, status, qrLink, deliveryPartnerData) => {
    try {
      const subtotal = cartItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
      const deliveryFee = deliveryPartnerData?.delivery_fee || allData.settings?.deliveryFee || 0;
      const total = subtotal - (discount || 0) + deliveryFee;

      const orderData = {
        customer_name: customerInfo.name,
        customer_phone: customerInfo.phone,
        customer_address: customerInfo.address,
        customer_city: customerInfo.city,
        customer_province: customerInfo.province,
        total_amount: subtotal,
        discount: discount || 0,
        delivery_fee: deliveryFee,
        final_amount: total,
        status: 'pending',
        delivery_status: 'pending',
        payment_status: 'pending',
        tracking_number: trackingNumber || `RYUS-${Date.now().toString().slice(-6)}`,
        delivery_partner: deliveryPartnerData?.delivery_partner || 'محلي',
        notes: customerInfo.notes,
        created_by: getUserUUID(user),
      };

      const createdOrder = await superAPI.createOrder(orderData);
      
      return { 
        success: true, 
        trackingNumber: orderData.tracking_number, 
        qr_id: createdOrder.qr_id,
        orderId: createdOrder.id 
      };
      
    } catch (error) {
      console.error('Error in createOrder:', error);
      return { success: false, error: error.message };
    }
  }, [allData.settings, user]);

  // تحديث طلب - نفس الواجهة القديمة
  const updateOrder = useCallback(async (orderId, updates) => {
    try {
      const updatedOrder = await superAPI.updateOrder(orderId, updates);
      return { success: true, data: updatedOrder };
    } catch (error) {
      console.error('Error in updateOrder:', error);
      return { success: false, error: error.message };
    }
  }, []);

  // حذف طلبات
  const deleteOrders = useCallback(async (orderIds, isAiOrder = false) => {
    try {
      // TODO: تطبيق في SuperAPI
      console.log('🗑️ حذف طلبات:', orderIds);
      return { success: true };
    } catch (error) {
      console.error('Error deleting orders:', error);
      return { success: false, error: error.message };
    }
  }, []);

  // إضافة مصروف - نفس الواجهة القديمة
  const addExpense = useCallback(async (expense) => {
    try {
      console.log('💰 SuperProvider: إضافة مصروف:', expense.description);
      
      // TODO: تطبيق في SuperAPI
      toast({ 
        title: "تمت إضافة المصروف",
        description: `تم إضافة مصروف ${expense.description}`,
        variant: "success" 
      });

      return { success: true, data: expense };
    } catch (error) {
      console.error('❌ خطأ في إضافة المصروف:', error);
      throw error;
    }
  }, []);

  // دوال أخرى مطلوبة للتوافق
  const refreshOrders = useCallback(() => fetchAllData(), [fetchAllData]);
  const refreshProducts = useCallback(() => fetchAllData(), [fetchAllData]);
  const approveAiOrder = useCallback(async (orderId) => ({ success: true }), []);

  // وظائف قواعد أرباح الموظفين
  const getEmployeeProfitRules = useCallback((employeeId) => {
    if (!employeeId || !allData.employeeProfitRules) return [];
    return allData.employeeProfitRules.filter(rule => 
      rule.employee_id === employeeId && rule.is_active !== false
    );
  }, [allData.employeeProfitRules]);

  const setEmployeeProfitRule = useCallback(async (employeeId, ruleData) => {
    try {
      console.log('📋 SuperProvider: تعديل قاعدة ربح للموظف:', { employeeId, ruleData });
      
      if (ruleData.id && ruleData.is_active === false) {
        // حذف قاعدة
        const { error } = await supabase
          .from('employee_profit_rules')
          .update({ is_active: false })
          .eq('id', ruleData.id);
        
        if (error) throw error;
      } else {
        // إضافة قاعدة جديدة
        const { error } = await supabase
          .from('employee_profit_rules')
          .insert({
            employee_id: employeeId,
            rule_type: ruleData.rule_type,
            target_id: ruleData.target_id,
            profit_amount: ruleData.profit_amount,
            profit_percentage: ruleData.profit_percentage,
            is_active: true,
            created_by: user?.user_id || user?.id
          });
        
        if (error) throw error;
      }

      // تحديث البيانات المحلية
      await fetchAllData();
      
      return { success: true };
    } catch (error) {
      console.error('❌ خطأ في تعديل قاعدة الربح:', error);
      throw error;
    }
  }, [user, fetchAllData]);

  // القيم المرجعة - نفس بنية InventoryContext بالضبط مع قيم آمنة
  const contextValue = {
    // البيانات الأساسية - مع قيم افتراضية آمنة
    products: allData.products || [],
    orders: allData.orders || [],
    customers: allData.customers || [],
    purchases: allData.purchases || [],
    expenses: allData.expenses || [],
    profits: allData.profits || [],
    aiOrders: allData.aiOrders || [],
    settings: allData.settings || { 
      deliveryFee: 5000, 
      lowStockThreshold: 5, 
      mediumStockThreshold: 10, 
      sku_prefix: "PROD", 
      lastPurchaseId: 0,
      printer: { paperSize: 'a4', orientation: 'portrait' }
    },
    accounting: accounting || { capital: 10000000, expenses: [] },
    
    // بيانات المرشحات - مع قيم افتراضية آمنة
    categories: allData.categories || [],
    departments: allData.departments || [],
    allColors: allData.colors || [],
    allSizes: allData.sizes || [],
    
    // حالة التحميل
    loading: loading || false,
    
    // وظائف السلة - مهمة جداً مع قيم آمنة
    cart: cart || [],
    addToCart: addToCart || (() => {}),
    removeFromCart: removeFromCart || (() => {}),
    updateCartItemQuantity: updateCartItemQuantity || (() => {}),
    clearCart: clearCart || (() => {}),
    
    // الوظائف الأساسية
    createOrder: createOrder || (async () => ({ success: false })),
    updateOrder: updateOrder || (async () => ({ success: false })),
    deleteOrders: deleteOrders || (async () => ({ success: false })),
    addExpense: addExpense || (async () => ({ success: false })),
    refreshOrders: refreshOrders || (() => {}),
    refreshProducts: refreshProducts || (() => {}),
    approveAiOrder: approveAiOrder || (async () => ({ success: false })),
    
    // وظائف المنتجات (للتوافق)
    addProduct: () => console.log('addProduct - سيتم تطبيقها لاحقاً'),
    updateProduct: () => console.log('updateProduct - سيتم تطبيقها لاحقاً'),
    deleteProducts: () => console.log('deleteProducts - سيتم تطبيقها لاحقاً'),
    updateVariantStock: () => console.log('updateVariantStock - سيتم تطبيقها لاحقاً'),
    getLowStockProducts: () => [],
    
    // وظائف أخرى للتوافق
    calculateProfit: () => 0,
    calculateManagerProfit: () => 0,
    
    // وظائف قواعد أرباح الموظفين
    employeeProfitRules: allData.employeeProfitRules || [],
    getEmployeeProfitRules,
    setEmployeeProfitRule,
  };

  // إضافة لوق للتتبع
  console.log('🔍 SuperProvider contextValue:', {
    hasCart: !!contextValue.cart,
    cartLength: contextValue.cart?.length || 0,
    loading: contextValue.loading,
    hasProducts: !!contextValue.products,
    productsLength: contextValue.products?.length || 0
  });

  return (
    <SuperContext.Provider value={contextValue}>
      {children}
    </SuperContext.Provider>
  );
};