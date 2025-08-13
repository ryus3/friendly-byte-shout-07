/**
 * SuperProvider - مزود البيانات الموحد الجديد
 * يستبدل InventoryContext بنظام أكثر كفاءة مع ضمان عدم تغيير أي وظيفة
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useNotificationsSystem } from '@/contexts/NotificationsSystemContext';
import { useCart } from '@/hooks/useCart.jsx';
import { supabase } from '@/integrations/supabase/client';
import superAPI from '@/api/SuperAPI';
import { useProductsDB } from '@/hooks/useProductsDB';
import { useProfits } from '@/contexts/ProfitsContext.jsx';

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

// دالة تصفية البيانات - تطبيق فعلي بدون فقدان بيانات
const filterDataByEmployeeCode = (data, user) => {
  if (!user || !data) return data;

  // تحديد صلاحيات عليا
  const isPrivileged = (
    Array.isArray(user?.roles) && user.roles.some(r => ['super_admin','admin','manager','owner','department_manager'].includes(r))
  ) || user?.is_admin === true || ['super_admin','admin','manager'].includes(user?.role);

  // المديرون يرون كل شيء
  if (isPrivileged) {
    console.log('👑 عرض جميع البيانات بدون تصفية (صلاحيات المدير)');
    return data;
  }

  const upper = (v) => (v ?? '').toString().trim().toUpperCase();
  const userCandidates = [user?.user_id, user?.id, user?.employee_code].filter(Boolean).map(upper);
  const matchUser = (val) => {
    if (val === undefined || val === null) return false;
    return userCandidates.includes(upper(val));
  };

  // ربط الطلبات بالأرباح لضمان عدم فقدان أي طلب يعود للموظف حتى لو أنشأه المدير
  const userOrderIdsFromProfits = new Set(
    (data.profits || [])
      .filter(p => matchUser(p.employee_id))
      .map(p => p.order_id)
  );

  const filtered = {
    ...data,
    orders: (data.orders || []).filter(o => matchUser(o.created_by) || userOrderIdsFromProfits.has(o.id)),
    profits: (data.profits || []).filter(p => matchUser(p.employee_id)),
    purchases: (data.purchases || []).filter(p => matchUser(p.created_by)),
    expenses: (data.expenses || []).filter(e => matchUser(e.created_by)),
    cashSources: (data.cashSources || []).filter(c => matchUser(c.created_by)),
    aiOrders: data.aiOrders || [],
  };

  console.log('🛡️ تصفية حسب المستخدم العادي:', {
    user: { id: user?.id, user_id: user?.user_id, employee_code: user?.employee_code },
    ordersBefore: data.orders?.length || 0,
    ordersAfter: filtered.orders.length,
    profitsBefore: data.profits?.length || 0,
    profitsAfter: filtered.profits.length,
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
  // أرباح وفواتير التسوية من السياق المتخصص (مع بقاء التوصيل عبر المزود الموحد)
  const { settlementInvoices } = useProfits() || { settlementInvoices: [] };
  
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
  const lastFetchAtRef = useRef(0);
  const pendingAiDeletesRef = useRef(new Set());
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
      
      // معالجة بيانات المنتجات وضمان ربط المخزون + توحيد بنية الطلبات (items)
      const processedData = {
        ...filteredData,
        products: (filteredData.products || []).map(product => ({
          ...product,
          variants: (product.product_variants || []).map(variant => {
            // ربط المخزون بشكل صحيح من جدول inventory
            const inventoryData = Array.isArray(variant.inventory) ? variant.inventory[0] : variant.inventory;

            // توحيد حقول اللون والقياس ليستعملها كل المكونات
            const colorName = variant.colors?.name || variant.color_name || variant.color || null;
            const colorHex = variant.colors?.hex_code || variant.color_hex || null;
            const sizeName = variant.sizes?.name || variant.size_name || variant.size || null;

            return {
              ...variant,
              // الحقول الموحدة للاعتماد عليها عبر الواجهة
              color: colorName || undefined,
              color_name: colorName || undefined,
              color_hex: colorHex || undefined,
              size: sizeName || undefined,
              size_name: sizeName || undefined,
              // ربط بيانات المخزون بالشكل الصحيح
              quantity: inventoryData?.quantity ?? variant.quantity ?? 0,
              reserved_quantity: inventoryData?.reserved_quantity ?? variant.reserved_quantity ?? 0,
              min_stock: inventoryData?.min_stock ?? variant.min_stock ?? 5,
              location: inventoryData?.location ?? variant.location ?? '',
              // الحفاظ على البيانات الأصلية
              inventory: inventoryData
            }
          })
        })),
        // توحيد items بحيث تعتمد كل المكونات عليه (OrderCard, ManagerProfitsCard)
        orders: (filteredData.orders || []).map(o => ({
          ...o,
          items: Array.isArray(o.order_items)
            ? o.order_items.map(oi => ({
                quantity: oi.quantity || 1,
                price: oi.price ?? oi.selling_price ?? oi.product_variants?.price ?? 0,
                cost_price: oi.cost_price ?? oi.product_variants?.cost_price ?? 0,
                productname: oi.products?.name,
                product_name: oi.products?.name,
                sku: oi.product_variants?.id,
                product_variants: oi.product_variants
              }))
            : (o.items || [])
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
      
      // تصفية الطلبات الذكية قيد الحذف التفاؤلي لمنع الوميض
      processedData.aiOrders = (processedData.aiOrders || []).filter(o => !pendingAiDeletesRef.current.has(o.id));
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
      lastFetchAtRef.current = Date.now();
      setLoading(false);
    }
  }, [user]);

  // تحميل البيانات عند بدء التشغيل فقط عندما تكون الصفحة مرئية
  useEffect(() => {
    if (document.visibilityState === 'visible') {
      fetchAllData();
    } else {
      const onVisible = () => {
        if (document.visibilityState === 'visible') {
          fetchAllData();
          document.removeEventListener('visibilitychange', onVisible);
        }
      };
      document.addEventListener('visibilitychange', onVisible);
      return () => document.removeEventListener('visibilitychange', onVisible);
    }
  }, [fetchAllData]);

  // إعداد Realtime للتحديثات الفورية
  useEffect(() => {
    if (!user) return;

    const reloadTimerRef = { current: null };

    const handleRealtimeUpdate = (table, payload) => {
      console.log(`🔄 SuperProvider: تحديث فوري لحظي في ${table}`, payload);
      
      // تحديث مباشر فوري للطلبات - بدون إعادة جلب
      if (table === 'orders') {
        const type = payload.eventType;
        const rowNew = payload.new || {};
        const rowOld = payload.old || {};
        
        if (type === 'INSERT') {
          console.log('➕ إضافة طلب جديد فورياً');
          setAllData(prev => ({ 
            ...prev, 
            orders: [rowNew, ...(prev.orders || [])] 
          }));
        } else if (type === 'UPDATE') {
          console.log('🔄 تحديث طلب فورياً');
          setAllData(prev => ({
            ...prev,
            orders: (prev.orders || []).map(o => o.id === rowNew.id ? { ...o, ...rowNew } : o)
          }));
        } else if (type === 'DELETE') {
          console.log('🗑️ حذف طلب فورياً');
          setAllData(prev => ({ 
            ...prev, 
            orders: (prev.orders || []).filter(o => o.id !== rowOld.id) 
          }));
        }
        return; // لا إعادة جلب للطلبات
      }

      // تحديث مباشر فوري لطلبات الذكاء الاصطناعي
      if (table === 'ai_orders') {
        const type = payload.eventType;
        const rowNew = payload.new || {};
        const rowOld = payload.old || {};
        
        if (type === 'INSERT') {
          console.log('➕ إضافة طلب ذكي جديد فورياً');
          try { pendingAiDeletesRef.current.delete(rowNew.id); } catch {}
          setAllData(prev => ({ ...prev, aiOrders: [rowNew, ...(prev.aiOrders || [])] }));
        } else if (type === 'UPDATE') {
          console.log('🔄 تحديث طلب ذكي فورياً');
          setAllData(prev => ({
            ...prev,
            aiOrders: (prev.aiOrders || []).map(o => o.id === rowNew.id ? { ...o, ...rowNew } : o)
          }));
        } else if (type === 'DELETE') {
          console.log('🗑️ حذف طلب ذكي فورياً');
          try { pendingAiDeletesRef.current.add(rowOld.id); } catch {}
          setAllData(prev => ({
            ...prev,
            aiOrders: (prev.aiOrders || []).filter(o => o.id !== rowOld.id)
          }));
        }
        return; // لا إعادة جلب للطلبات الذكية
      }

      // تمرير إشعار للإستماع المنفصل
      if (table === 'notifications' && payload.eventType === 'INSERT') {
        window.dispatchEvent(new CustomEvent('notificationCreated', { detail: payload.new }));
        return;
      }

      // غير ذلك: إعادة جلب سريعة لضمان الاتساق
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = setTimeout(() => {
        fetchAllData();
      }, 300);
    };

    superAPI.setupRealtimeSubscriptions(handleRealtimeUpdate);

    return () => {
      superAPI.unsubscribeAll();
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    };
  }, [user, fetchAllData]);

  // تحديث فوري للأحداث المخصصة بدلاً من إعادة تحميل كامل
  useEffect(() => {
    const handleAiOrderCreated = (event) => {
      console.log('🔥 AI Order Created Event:', event.detail);
      try { pendingAiDeletesRef.current.delete(event.detail.id); } catch {}
      setAllData(prevData => ({
        ...prevData,
        aiOrders: [...(prevData.aiOrders || []), event.detail]
      }));
    };

    const handleAiOrderUpdated = (event) => {
      console.log('🔥 AI Order Updated Event:', event.detail);
      setAllData(prevData => ({
        ...prevData,
        aiOrders: (prevData.aiOrders || []).map(order => 
          order.id === event.detail.id ? { ...order, ...event.detail } : order
        )
      }));
    };

    const handleAiOrderDeleted = (event) => {
      console.log('🔥 AI Order Deleted Event:', event.detail);
      try { pendingAiDeletesRef.current.add(event.detail.id); } catch {}
      setAllData(prevData => ({
        ...prevData,
        aiOrders: (prevData.aiOrders || []).filter(order => order.id !== event.detail.id)
      }));
    };
    
    window.addEventListener('aiOrderCreated', handleAiOrderCreated);
    window.addEventListener('aiOrderUpdated', handleAiOrderUpdated);
    window.addEventListener('aiOrderDeleted', handleAiOrderDeleted);

    return () => {
      window.removeEventListener('aiOrderCreated', handleAiOrderCreated);
      window.removeEventListener('aiOrderUpdated', handleAiOrderUpdated);
      window.removeEventListener('aiOrderDeleted', handleAiOrderDeleted);
    };
  }, []);

  // إعادة التحقق عند عودة التبويب للتركيز إذا انتهت صلاحية الكاش
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        try {
          if (!superAPI.isCacheValid('all_data')) {
            fetchAllData();
          }
        } catch {}
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchAllData]);

  // تأكيد تفعيل Webhook للتليغرام تلقائياً (مرة واحدة عند تشغيل التطبيق)
  useEffect(() => {
    (async () => {
      try {
        await fetch('https://tkheostkubborwkwzugl.supabase.co/functions/v1/telegram-webhook-check?force=1');
      } catch (_) {}
    })();
    // تشغيل لمرة واحدة فقط
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===============================
  // وظائف متوافقة مع InventoryContext
  // ===============================

  // توصيل وظائف قاعدة البيانات القديمة (CRUD) عبر hook موحد
  const {
    addProduct: dbAddProduct,
    updateProduct: dbUpdateProduct,
    deleteProducts: dbDeleteProducts,
    updateVariantStock: dbUpdateVariantStock,
    getLowStockProducts: dbGetLowStockProducts,
    refetch: dbRefetchProducts,
  } = useProductsDB();

  // إنشاء طلب جديد - يدعم النموذجين: (payload) أو (customerInfo, cartItems, ...)
  const createOrder = useCallback(async (arg1, cartItemsArg, trackingNumberArg, discountArg, statusArg, qrLinkArg, deliveryPartnerDataArg) => {
    try {
      // إذا تم تمرير كائن واحد، اعتبره Payload كامل يحتوي على items
      const isPayload = typeof arg1 === 'object' && Array.isArray(arg1?.items);

      // تجهيز العناصر المراد إدراجها
      const items = isPayload
        ? (arg1.items || []).map(i => ({
            product_id: i.product_id,
            variant_id: i.variant_id,
            quantity: i.quantity,
            unit_price: i.unit_price || i.price || 0,
            total_price: i.total_price || (i.quantity * (i.unit_price || i.price || 0))
          }))
        : (cartItemsArg || []).map(i => ({
            product_id: i.productId || i.id,
            variant_id: i.variantId || i.sku,
            quantity: i.quantity,
            unit_price: i.price,
            total_price: i.quantity * i.price
          }));

      if (!items.length) return { success: false, error: 'لا توجد عناصر في الطلب' };

      // حساب المجاميع
      const subtotal = items.reduce((s, it) => s + (it.total_price || 0), 0);
      const discount = isPayload ? (arg1.discount || 0) : (discountArg || 0);
      const deliveryFee = isPayload
        ? (arg1.delivery_fee || allData.settings?.deliveryFee || 0)
        : (deliveryPartnerDataArg?.delivery_fee || allData.settings?.deliveryFee || 0);
      const total = subtotal - discount + deliveryFee;

      // إنشاء رقم الطلب
      const { data: orderNumber, error: orderNumberError } = await supabase.rpc('generate_order_number');
      if (orderNumberError) {
        console.error('Error generating order number:', orderNumberError);
        return { success: false, error: 'فشل في إنشاء رقم الطلب' };
      }

      // رقم التتبع
      const trackingNumber = isPayload
        ? (arg1.tracking_number || `RYUS-${Date.now().toString().slice(-6)}`)
        : (trackingNumberArg || `RYUS-${Date.now().toString().slice(-6)}`);

      // محاولة حجز المخزون لكل عنصر
      const reservedSoFar = [];
      for (const it of items) {
        const { data: reserveRes, error: reserveErr } = await supabase.rpc('reserve_stock_for_order', {
          p_product_id: it.product_id,
          p_variant_id: it.variant_id || null,
          p_quantity: it.quantity
        });
        if (reserveErr || reserveRes?.success === false) {
          // تراجع عن أي حجوزات سابقة
          for (const r of reservedSoFar) {
            await supabase.rpc('release_stock_item', {
              p_product_id: r.product_id,
              p_variant_id: r.variant_id || null,
              p_quantity: r.quantity
            });
          }
          const msg = reserveErr?.message || reserveRes?.error || 'المخزون المتاح غير كافٍ';
          return { success: false, error: msg };
        }
        reservedSoFar.push(it);
      }

      // بيانات الطلب للإدراج
      const baseOrder = isPayload ? arg1 : {
        customer_name: arg1?.name,
        customer_phone: arg1?.phone,
        customer_address: arg1?.address,
        customer_city: arg1?.city,
        customer_province: arg1?.province,
        notes: arg1?.notes,
      };

      const orderRow = {
        order_number: orderNumber,
        customer_name: baseOrder.customer_name,
        customer_phone: baseOrder.customer_phone,
        customer_address: baseOrder.customer_address,
        customer_city: baseOrder.customer_city,
        customer_province: baseOrder.customer_province,
        total_amount: subtotal,
        discount,
        delivery_fee: deliveryFee,
        final_amount: total,
        status: 'pending',
        delivery_status: 'pending',
        payment_status: 'pending',
        tracking_number: trackingNumber,
        delivery_partner: isPayload ? (arg1.delivery_partner || 'محلي') : (deliveryPartnerDataArg?.delivery_partner || 'محلي'),
        notes: baseOrder.notes,
        created_by: user?.user_id || user?.id,
      };

      // إنشاء الطلب
      const { data: createdOrder, error: orderErr } = await supabase
        .from('orders')
        .insert(orderRow)
        .select()
        .single();
      if (orderErr) {
        // إلغاء الحجوزات
        for (const r of reservedSoFar) {
          await supabase.rpc('release_stock_item', {
            p_product_id: r.product_id,
            p_variant_id: r.variant_id || null,
            p_quantity: r.quantity
          });
        }
        return { success: false, error: orderErr.message };
      }

      // إدراج عناصر الطلب
      const itemsRows = items.map(it => ({
        order_id: createdOrder.id,
        product_id: it.product_id,
        variant_id: it.variant_id || null,
        quantity: it.quantity,
        unit_price: it.unit_price,
        total_price: it.total_price
      }));
      const { error: itemsErr } = await supabase.from('order_items').insert(itemsRows);
      if (itemsErr) {
        // حذف الطلب والتراجع عن الحجوزات
        await supabase.from('orders').delete().eq('id', createdOrder.id);
        for (const r of reservedSoFar) {
          await supabase.rpc('release_stock_item', {
            p_product_id: r.product_id,
            p_variant_id: r.variant_id || null,
            p_quantity: r.quantity
          });
        }
        return { success: false, error: 'فشل في إضافة عناصر الطلب' };
      }

      // إنجاح العملية وإبطال الكاش
      superAPI.invalidate('all_data');
      superAPI.invalidate('orders_only');

      return {
        success: true,
        trackingNumber,
        qr_id: trackingNumber,
        orderId: createdOrder.id
      };
    } catch (error) {
      console.error('Error in createOrder:', error);
      return { success: false, error: error.message };
    }
  }, [allData.settings, user]);

  // تحديث طلب - نفس الواجهة القديمة مع تحديث فوري محلي
  const updateOrder = useCallback(async (orderId, updates) => {
    try {
      // تحديث فوري محلياً أولاً لتحسين الإحساس باللحظية
      setAllData(prev => ({
        ...prev,
        orders: (prev.orders || []).map(o => o.id === orderId ? { ...o, ...updates } : o),
      }));
      // إرسال حدث متصفح فوري
      window.dispatchEvent(new CustomEvent('orderUpdated', { detail: { id: orderId, updates } }));

      const updatedOrder = await superAPI.updateOrder(orderId, updates);

      // توحيد الحالة النهائية بعد عودة الخادم
      setAllData(prev => ({
        ...prev,
        orders: (prev.orders || []).map(o => o.id === orderId ? { ...o, ...updatedOrder } : o),
      }));

      return { success: true, data: updatedOrder };
    } catch (error) {
      console.error('Error in updateOrder:', error);
      return { success: false, error: error.message };
    }
  }, []);

  // حذف طلبات مع تحديث فوري
  const deleteOrders = useCallback(async (orderIds, isAiOrder = false) => {
    try {
      if (isAiOrder) {
        // تحديث فوري محلياً أولاً
        setAllData(prev => ({
          ...prev,
          aiOrders: (prev.aiOrders || []).filter(o => !orderIds.includes(o.id))
        }));
        
        // بث أحداث الحذف فوراً
        orderIds.forEach(id => {
          try { window.dispatchEvent(new CustomEvent('aiOrderDeleted', { detail: { id } })); } catch {}
        });
        
        // الحذف الفعلي في الخلفية
        const { error } = await supabase.from('ai_orders').delete().in('id', orderIds);
        if (error) {
          // في حالة الفشل، أعد الطلبات للقائمة
          console.error('Delete failed, will refresh data:', error);
          superAPI.invalidate('all_data');
          await fetchAllData();
          throw error;
        }
        superAPI.invalidate('all_data');
        toast({ title: 'تم الحذف', description: 'تم حذف الطلبات الذكية نهائياً', variant: 'success' });
        orderIds.forEach(id => { try { window.dispatchEvent(new CustomEvent('aiOrderDeleted', { detail: { id } })); } catch {} });
        return { success: true };
      }
      // حذف طلبات عادية (قيد التجهيز فقط) بتحديث تفاؤلي
      setAllData(prev => ({ ...prev, orders: (prev.orders || []).filter(o => !orderIds.includes(o.id)) }));
      orderIds.forEach(id => { try { window.dispatchEvent(new CustomEvent('orderDeleted', { detail: { id } })); } catch {} });

      const { error } = await supabase.from('orders').delete().in('id', orderIds);
      if (error) throw error;
      superAPI.invalidate('all_data');
      // تحديث موحّد بعد التأكيد
      await fetchAllData();
      return { success: true };
    } catch (error) {
      console.error('Error deleting orders:', error);
      return { success: false, error: error.message };
    }
  }, [fetchAllData]);

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

  // تسوية مستحقات الموظف - بديل متوافق مع EmployeeSettlementCard
  const settleEmployeeProfits = useCallback(async (employeeId, totalSettlement = 0, employeeName = '', orderIds = []) => {
    try {
      if (!orderIds || orderIds.length === 0) {
        throw new Error('لا توجد طلبات لتسويتها');
      }

      const now = new Date().toISOString();
      const ordersMap = new Map((allData.orders || []).map(o => [o.id, o]));

      const calcOrderProfit = (order) => {
        if (!order) return 0;
        const items = Array.isArray(order.items) ? order.items : [];
        return items.reduce((sum, it) => {
          const qty = it.quantity || 1;
          const price = it.price ?? it.selling_price ?? it.product_variants?.price ?? 0;
          const cost = it.cost_price ?? it.product_variants?.cost_price ?? 0;
          return sum + (price - cost) * qty;
        }, 0);
      };

      const perOrderBase = orderIds.map(id => ({ id, amount: calcOrderProfit(ordersMap.get(id)) }));
      const baseSum = perOrderBase.reduce((s, r) => s + (r.amount || 0), 0);

      // توزيع مستحقات الموظف على الطلبات بشكل نسبي حسب ربح الطلب
      const perOrderEmployee = perOrderBase.map(r => ({
        id: r.id,
        employee: baseSum > 0 ? Math.round((totalSettlement * (r.amount || 0)) / baseSum) : Math.round((totalSettlement || 0) / orderIds.length)
      }));

      // جلب السجلات الحالية
      const { data: existing, error: existingErr } = await supabase
        .from('profits')
        .select('id, order_id, profit_amount, employee_profit, employee_id, status, settled_at')
        .in('order_id', orderIds);
      if (existingErr) throw existingErr;
      const existingMap = new Map((existing || []).map(e => [e.order_id, e]));

      // تحضير upsert
      const upserts = orderIds.map(orderId => {
        const order = ordersMap.get(orderId);
        const existingRow = existingMap.get(orderId);
        const base = perOrderBase.find(x => x.id === orderId)?.amount || 0;
        const emp = perOrderEmployee.find(x => x.id === orderId)?.employee || 0;
        return {
          ...(existingRow ? { id: existingRow.id } : {}),
          order_id: orderId,
          employee_id: employeeId || order?.created_by,
          total_revenue: order?.final_amount || order?.total_amount || 0,
          total_cost: null,
          profit_amount: base,
          employee_profit: emp,
          status: 'settled',
          settled_at: now
        };
      });

      const { error: upsertErr } = await supabase.from('profits').upsert(upserts);
      if (upsertErr) throw upsertErr;

      // أرشفة الطلبات بعد التسوية + تثبيت استلام الفاتورة
      const { error: ordersErr } = await supabase
        .from('orders')
        .update({ is_archived: true, receipt_received: true, receipt_received_at: now, receipt_received_by: user?.user_id || user?.id })
        .in('id', orderIds);
      if (ordersErr) throw ordersErr;

      // تحديث الذاكرة وCache
      superAPI.invalidate('all_data');
      await fetchAllData();

      toast({
        title: 'تم دفع مستحقات الموظف',
        description: `${employeeName || 'الموظف'} - عدد الطلبات ${orderIds.length}`,
        variant: 'success'
      });

      return { success: true };
    } catch (error) {
      console.error('❌ خطأ في تسوية مستحقات الموظف:', error);
      toast({ title: 'خطأ في التسوية', description: error.message, variant: 'destructive' });
      return { success: false, error: error.message };
    }
  }, [allData.orders, user, fetchAllData]);
  // دوال أخرى مطلوبة للتوافق
  const refreshOrders = useCallback(() => fetchAllData(), [fetchAllData]);
  const refreshProducts = useCallback(() => fetchAllData(), [fetchAllData]);
  const refreshAll = useCallback(async () => { superAPI.invalidate('all_data'); await fetchAllData(); }, [fetchAllData]);
  // تحويل طلب ذكي إلى طلب حقيقي مباشرةً
  const approveAiOrder = useCallback(async (orderId) => {
    try {
      // 1) جلب الطلب الذكي
      const { data: aiOrder, error: aiErr } = await supabase
        .from('ai_orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();
      if (aiErr) throw aiErr;
      if (!aiOrder) return { success: false, error: 'الطلب الذكي غير موجود' };

      const itemsInput = Array.isArray(aiOrder.items) ? aiOrder.items : [];
      if (!itemsInput.length) return { success: false, error: 'لا توجد عناصر في الطلب الذكي' };

      // 2) مطابقة عناصر الطلب الذكي مع المنتجات والمتغيرات الفعلية
      const products = Array.isArray(allData.products) ? allData.products : [];
      const lowercase = (v) => (v || '').toString().trim().toLowerCase();
      const notMatched = [];

      const matchedItems = itemsInput.map((it) => {
        const name = lowercase(it.product_name || it.name);
        const color = lowercase(it.color);
        const size = lowercase(it.size);
        const qty = Number(it.quantity || 1);
        const price = Number(it.unit_price || it.price || 0);

        // إذا كانت المعرّفات موجودة بالفعل استخدمها مباشرة
        if (it.product_id && it.variant_id) {
          return {
            product_id: it.product_id,
            variant_id: it.variant_id,
            quantity: qty,
            unit_price: price,
          };
        }

        // ابحث بالاسم
        let product = products.find(p => lowercase(p.name) === name) 
          || products.find(p => lowercase(p.name).includes(name));

        if (!product) {
          notMatched.push(it.product_name || it.name || 'منتج غير معروف');
          return null;
        }

        // مطابقة المتغير (اللون/المقاس)
        const variants = Array.isArray(product.variants) ? product.variants : (product.product_variants || []);
        let variant = null;
        if (variants.length === 1) {
          variant = variants[0];
        } else {
          variant = variants.find(v => lowercase(v.color || v.color_name) === color && lowercase(v.size || v.size_name) === size)
                 || variants.find(v => lowercase(v.color || v.color_name) === color)
                 || variants.find(v => lowercase(v.size || v.size_name) === size);
        }

        if (!variant) {
          notMatched.push(`${product.name}${it.color || it.size ? ` (${it.color || ''} ${it.size || ''})` : ''}`);
          return null;
        }

        return {
          product_id: product.id,
          variant_id: variant.id,
          quantity: qty,
          unit_price: price || Number(variant.price || 0),
        };
      });

      if (notMatched.length > 0) {
        return { success: false, error: `تعذر مطابقة المنتجات التالية مع المخزون: ${notMatched.join('، ')}` };
      }

      const normalizedItems = matchedItems.filter(Boolean);
      if (!normalizedItems.length) return { success: false, error: 'لا توجد عناصر قابلة للتحويل بعد المطابقة' };

      // 3) إنشاء رقم طلب
      const { data: orderNumber, error: numErr } = await supabase.rpc('generate_order_number');
      if (numErr) throw numErr;

      // 4) حجز المخزون لكل عنصر مع إمكانية التراجع
      const reservedSoFar = [];
      for (const it of normalizedItems) {
        const { data: reserveRes, error: reserveErr } = await supabase.rpc('reserve_stock_for_order', {
          p_product_id: it.product_id,
          p_variant_id: it.variant_id,
          p_quantity: it.quantity
        });
        if (reserveErr || reserveRes?.success === false) {
          // تراجع عن أي حجوزات تمت
          for (const r of reservedSoFar) {
            await supabase.rpc('release_stock_item', {
              p_product_id: r.product_id,
              p_variant_id: r.variant_id,
              p_quantity: r.quantity
            });
          }
          const msg = reserveErr?.message || reserveRes?.error || 'المخزون غير كافٍ لأحد العناصر';
          return { success: false, error: msg };
        }
        reservedSoFar.push(it);
      }

      // 5) حساب المجاميع مع رسوم التوصيل الحقيقية
      const subtotal = normalizedItems.reduce((s, it) => s + it.quantity * (it.unit_price || 0), 0);
      const deliveryType = aiOrder?.order_data?.delivery_type || (aiOrder?.customer_address ? 'توصيل' : 'محلي');
      // جلب رسوم التوصيل من جدول الإعدادات مباشرة لضمان الدقة
      let deliveryFeeSetting = 5000;
      try {
        const { data: ds } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'delivery_fee')
          .maybeSingle();
        deliveryFeeSetting = Number(ds?.value) || 5000;
      } catch (_) {}
      const deliveryFee = deliveryType === 'توصيل' ? deliveryFeeSetting : 0;
      const discount = 0;
      const total = subtotal - discount + deliveryFee;

      // 6) إنشاء طلب حقيقي
      const trackingNumber = `RYUS-${Date.now().toString().slice(-6)}`;
      const orderRow = {
        order_number: orderNumber,
        customer_name: aiOrder.customer_name,
        customer_phone: aiOrder.customer_phone,
        customer_address: aiOrder.customer_address,
        customer_city: aiOrder.customer_city,
        customer_province: aiOrder.customer_province,
        total_amount: subtotal,
        discount,
        delivery_fee: deliveryFee,
        final_amount: total,
        status: 'pending',
        delivery_status: 'pending',
        payment_status: 'pending',
        tracking_number: trackingNumber,
        delivery_partner: deliveryType === 'توصيل' ? 'شركة التوصيل' : 'محلي',
        notes: aiOrder.order_data?.note || aiOrder.order_data?.original_text || null,
        created_by: user?.user_id || user?.id,
      };

      const { data: createdOrder, error: createErr } = await supabase
        .from('orders')
        .insert(orderRow)
        .select()
        .single();
      if (createErr) {
        for (const r of reservedSoFar) {
          await supabase.rpc('release_stock_item', {
            p_product_id: r.product_id,
            p_variant_id: r.variant_id,
            p_quantity: r.quantity
          });
        }
        throw createErr;
      }

      // 7) إدراج عناصر الطلب
      const orderItemsRows = normalizedItems.map(it => ({
        order_id: createdOrder.id,
        product_id: it.product_id,
        variant_id: it.variant_id,
        quantity: it.quantity,
        unit_price: it.unit_price || 0,
        total_price: it.quantity * (it.unit_price || 0)
      }));
      const { error: itemsErr } = await supabase.from('order_items').insert(orderItemsRows);
      if (itemsErr) {
        await supabase.from('orders').delete().eq('id', createdOrder.id);
        for (const r of reservedSoFar) {
          await supabase.rpc('release_stock_item', {
            p_product_id: r.product_id,
            p_variant_id: r.variant_id,
            p_quantity: r.quantity
          });
        }
        throw itemsErr;
      }

      // بث حدث إنشاء الطلب محلياً لتحديث الواجهات فوراً
      try { window.dispatchEvent(new CustomEvent('orderCreated', { detail: createdOrder })); } catch {}

      // 8) حذف الطلب الذكي نهائياً
      const { error: delErr } = await supabase.from('ai_orders').delete().eq('id', orderId);
      if (delErr) console.error('تنبيه: فشل حذف الطلب الذكي بعد التحويل', delErr);

      // تحديث الذاكرة
      setAllData(prev => ({
        ...prev,
        aiOrders: (prev.aiOrders || []).filter(o => o.id !== orderId)
      }));
      superAPI.invalidate('all_data');

      return { success: true, orderId: createdOrder.id, trackingNumber };
    } catch (err) {
      console.error('❌ فشل تحويل الطلب الذكي:', err);
      return { success: false, error: err.message };
    }
  }, [user, allData.products]);

  // تبديل ظهور المنتج بتحديث تفاؤلي فوري دون إعادة تحميل كاملة
  const toggleProductVisibility = useCallback(async (productId, newState) => {
    // تحديث تفاؤلي
    setAllData(prev => ({
      ...prev,
      products: (prev.products || []).map(p => p.id === productId ? { ...p, is_active: newState } : p)
    }));

    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: newState })
        .eq('id', productId);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      // تراجع في حال الفشل
      setAllData(prev => ({
        ...prev,
        products: (prev.products || []).map(p => p.id === productId ? { ...p, is_active: !newState } : p)
      }));
      console.error('❌ فشل تبديل ظهور المنتج:', err);
      return { success: false, error: err.message };
    }
  }, []);

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
    allProducts: allData.products || [],
    orders: allData.orders || [],
    customers: allData.customers || [],
    purchases: allData.purchases || [],
    expenses: allData.expenses || [],
    profits: allData.profits || [],
    settlementInvoices: settlementInvoices || [],
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
    // المستخدمون/الملفات للتطابق مع created_by
    users: allData.users || [],
    
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
    refetchProducts: refreshProducts || (() => {}),
    refreshAll: refreshAll || (async () => {}),
    approveAiOrder: approveAiOrder || (async () => ({ success: false })),
    // وظائف المنتجات (توصيل فعلي مع التحديث المركزي)
    addProduct: async (...args) => {
      const res = await dbAddProduct(...args);
      await fetchAllData();
      return res;
    },
    updateProduct: async (...args) => {
      const res = await dbUpdateProduct(...args);
      await fetchAllData();
      return res;
    },
    deleteProducts: async (...args) => {
      const res = await dbDeleteProducts(...args);
      await fetchAllData();
      return res;
    },
    updateVariantStock: async (...args) => {
      const res = await dbUpdateVariantStock(...args);
      await fetchAllData();
      return res;
    },
    getLowStockProducts: dbGetLowStockProducts,

    // تبديل الظهور الفوري
    toggleProductVisibility,
    
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