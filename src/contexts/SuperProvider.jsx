/**
 * SuperProvider - مزود البيانات الموحد الجديد v2.9.4
 * يستبدل InventoryContext بنظام أكثر كفاءة مع ضمان عدم تغيير أي وظيفة
 * النسخة 2.9.4: توحيد نظام الحجز - returned تحجز + استثناء item_status='delivered'
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useUnifiedPermissionsSystem as usePermissions } from '@/hooks/useUnifiedPermissionsSystem.jsx';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useNotificationsSystem } from '@/contexts/NotificationsSystemContext';
import { useCart } from '@/hooks/useCart.jsx';
import { supabase } from '@/integrations/supabase/client';
import superAPI from '@/api/SuperAPI';
import { useProducts } from '@/hooks/useProducts.jsx';
import { useProfits } from '@/contexts/ProfitsContext.jsx';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { getCities, getRegionsByCity } from '@/lib/alwaseet-api';
import { useAiOrdersCleanup } from '@/hooks/useAiOrdersCleanup';
import devLog from '@/lib/devLogger';

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
    devLog.log('👑 عرض جميع البيانات بدون تصفية (صلاحيات المدير)');
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
    // العملاء مفلترون تلقائياً من RLS - لكن نطبق فلترة محلية إضافية للأمان
    customers: (data.customers || []).filter(c => matchUser(c.created_by)),
    aiOrders: data.aiOrders || [],
  };

  devLog.log('🛡️ تصفية حسب المستخدم العادي:', {
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
  // أرباح وفواتير التسوية من السياق المتخصص
  const { settlementInvoices, createSettlementRequest: profitsCreateSettlement } = useProfits() || { 
    settlementInvoices: [], 
    createSettlementRequest: () => Promise.resolve(null) 
  };
  
  // hook تنظيف الطلبات الذكية
  const { deleteAiOrderWithLink } = useAiOrdersCleanup();
  
  // AlWaseet context للتعامل مع شركات التوصيل مباشرة
  const { 
    activateAccount, 
    createAlWaseetOrder, 
    token: alwaseetToken, 
    activePartner, 
    setActivePartner,
    hasValidToken,
    getTokenForUser
  } = useAlWaseet();
  
  // استدعاء useProducts في المكان الصحيح
  const {
    addProduct: dbAddProduct,
    updateProduct: dbUpdateProduct,
    deleteProducts: dbDeleteProducts,
    updateVariantStock: dbUpdateVariantStock,
    getLowStockProducts: dbGetLowStockProducts,
    refreshProducts: dbRefetchProducts,
  } = useProducts();
  
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

  const normalizeOrder = useCallback((o, usersArray = null) => {
    // ✅ حماية قوية من البيانات الفارغة أو غير الصالحة
    if (!o || typeof o !== 'object' || !o.id) {
      return null;
    }
    
    // دعم الطلبات الجديدة بدون order_items
    const items = Array.isArray(o.order_items)
      ? o.order_items.filter(oi => oi != null && typeof oi === 'object').map(oi => ({
          quantity: Number(oi?.quantity) || 1,
          price: oi?.price ?? oi?.unit_price ?? oi?.selling_price ?? oi?.product_variants?.price ?? 0,
          cost_price: oi?.cost_price ?? oi?.product_variants?.cost_price ?? 0,
          productname: oi?.products?.name,
          product_name: oi?.products?.name,
          sku: oi.product_variants?.id || oi.variant_id,
          product_variants: oi.product_variants
        }))
      : (o.items || []);
    
    // البحث عن اسم الموظف من users array إذا كان created_by موجود
    let employeeName = o.created_by_name || o.employee_name || 'غير محدد';
    if (o.created_by && usersArray && Array.isArray(usersArray)) {
      const foundUser = usersArray.find(u => u.user_id === o.created_by);
      if (foundUser?.full_name) {
        employeeName = foundUser.full_name;
      }
    }
    
    // ضمان البيانات الأساسية للطلبات الجديدة
    return { 
      ...o, 
      items,
      status: o.status || 'pending',
      customer_name: o.customer_name || 'عميل جديد',
      total_amount: o.total_amount || 0,
      created_at: o.created_at || new Date().toISOString(),
      employee_name: employeeName,
      isArchived: o.isArchived || false,
      isAiOrder: false,
    };
  }, []);

  // نظام الحجز الموحد - قراءة مباشرة من inventory.reserved_quantity المُحدّث
  const calculateUnifiedReservations = useCallback((data) => {
    if (!data?.products) return data;

    // تحديث البيانات بقراءة reserved_quantity مباشرة من inventory
    const updatedProducts = data.products.map(product => ({
      ...product,
      variants: (product.variants || []).map(variant => {
        // قراءة من inventory.reserved_quantity (الآن دقيق 100% بعد Migration)
        const dbReservedQuantity = variant.inventory?.reserved_quantity ?? variant.reserved_quantity ?? 0;
        const quantity = variant.inventory?.quantity ?? variant.quantity ?? 0;
        
        return {
          ...variant,
          reserved_quantity: dbReservedQuantity,
          available_quantity: Math.max(0, quantity - dbReservedQuantity)
        };
      }),
      product_variants: (product.product_variants || []).map(variant => {
        const dbReservedQuantity = variant.inventory?.reserved_quantity ?? variant.reserved_quantity ?? 0;
        const quantity = variant.inventory?.quantity ?? variant.quantity ?? 0;
        
        return {
          ...variant,
          reserved_quantity: dbReservedQuantity,
          available_quantity: Math.max(0, quantity - dbReservedQuantity)
        };
      })
    }));

    devLog.log('🔒 نظام الحجز الموحد (من DB مباشرة):', {
      totalProducts: updatedProducts.length,
      sampleVariant: updatedProducts[0]?.variants?.[0] ? {
        id: updatedProducts[0].variants[0].id,
        quantity: updatedProducts[0].variants[0].quantity,
        reserved: updatedProducts[0].variants[0].reserved_quantity,
        available: updatedProducts[0].variants[0].available_quantity
      } : null
    });

    return {
      ...data,
      products: updatedProducts
    };
  }, []);

  // ⚡ المرحلة 2: تحسين getVariantDetails بـ useMemo للبحث السريع
  const variantLookupMap = useMemo(() => {
    const map = new Map();
    if (!allData.products) return map;
    
    for (const product of allData.products) {
      const variants = product.variants || product.product_variants || [];
      for (const variant of variants) {
        if (variant?.id) {
          map.set(variant.id, {
            ...variant,
            product_id: product.id,
            product_name: product.name,
            color_name: variant.colors?.name || variant.color_name || 'غير محدد',
            size_name: variant.sizes?.name || variant.size_name || 'غير محدد',
            color_hex: variant.colors?.hex_code || variant.color_hex || null
          });
        }
      }
    }
    return map;
  }, [allData.products]);

  // دالة الحصول على بيانات المتغير من النظام الموحد - محسنة بـ O(1) lookup
  const getVariantDetails = useCallback((variantId) => {
    if (!variantId) return null;
    return variantLookupMap.get(variantId) || null;
  }, [variantLookupMap]);
  
  // Set للطلبات المحذوفة نهائياً - 🛡️ TTL: 1 ساعة فقط (وليس للأبد)
  // هذا يمنع كارثة "الطلب المحذوف خطأ يبقى مخفياً للأبد بعد استعادته"
  const [permanentlyDeletedOrders] = useState(() => {
    try {
      const saved = localStorage.getItem('permanentlyDeletedOrders');
      const parsed = saved ? JSON.parse(saved) : null;
      // ✅ دعم التنسيق القديم (array) والجديد ({ts, ids})
      if (Array.isArray(parsed)) {
        // تنسيق قديم → نتجاهله بعد ساعة (نمسح القديم)
        localStorage.removeItem('permanentlyDeletedOrders');
        return new Set();
      }
      if (parsed?.ts && parsed?.ids) {
        const ageMs = Date.now() - parsed.ts;
        if (ageMs < 60 * 60 * 1000) { // ساعة واحدة
          return new Set(parsed.ids);
        }
        // انتهت مدة الحماية → مسح
        localStorage.removeItem('permanentlyDeletedOrders');
      }
      return new Set();
    } catch {
      return new Set();
    }
  });
  const [permanentlyDeletedAiOrders] = useState(() => {
    try {
      const saved = localStorage.getItem('permanentlyDeletedAiOrders');
      const parsed = saved ? JSON.parse(saved) : null;
      if (Array.isArray(parsed)) {
        localStorage.removeItem('permanentlyDeletedAiOrders');
        return new Set();
      }
      if (parsed?.ts && parsed?.ids) {
        const ageMs = Date.now() - parsed.ts;
        if (ageMs < 60 * 60 * 1000) {
          return new Set(parsed.ids);
        }
        localStorage.removeItem('permanentlyDeletedAiOrders');
      }
      return new Set();
    } catch {
      return new Set();
    }
  });
  
  // 🛡️ helper لحفظ Set في localStorage بالتنسيق الجديد مع timestamp
  const persistDeletedSet = (key, set) => {
    try {
      localStorage.setItem(key, JSON.stringify({ ts: Date.now(), ids: [...set] }));
    } catch {}
  };
  
  // جلب البيانات الموحدة عند بدء التشغيل - مع تصفية employee_code
  const fetchAllData = useCallback(async () => {
    if (!user) return;
    
  // ⚡ إعداد timeout protection لمنع التجمد (5 ثواني)
    const timeoutId = setTimeout(() => {
      devLog.warn('⚠️ SuperProvider: انتهت مهلة تحميل البيانات');
      setLoading(false);
    }, 5000);
    
    try {
      setLoading(true);
      devLog.log('🚀 SuperProvider: جلب جميع البيانات للمستخدم:', user.employee_code || user.user_id);
      
      const data = await superAPI.getAllData();
      
      // التحقق من البيانات
      if (!data) {
        return;
      }

      // جلب الإعدادات من قاعدة البيانات وتحويلها إلى object
      let settingsObject = {
        deliveryFee: 5000,
        lowStockThreshold: 5,
        mediumStockThreshold: 10,
        sku_prefix: "PROD",
        lastPurchaseId: 0,
        printer: { paperSize: 'a4', orientation: 'portrait' }
      };

      try {
        const { data: settingsData, error: settingsError } = await supabase
          .from('settings')
          .select('key, value');
        
        if (!settingsError && settingsData?.length) {
          devLog.log('🔧 SuperProvider: تم جلب الإعدادات من قاعدة البيانات:', settingsData);
          (settingsData || []).filter(setting => setting != null && typeof setting === 'object').forEach(setting => {
            try {
              // محاولة تحويل القيمة إلى رقم إذا كانت رقمية
              const numValue = Number(setting?.value);
              if (!isNaN(numValue) && setting?.value !== '') {
                settingsObject[setting.key] = numValue;
              } else {
                // محاولة تحويل JSON إذا كان كذلك
                try {
                  settingsObject[setting.key] = JSON.parse(setting.value);
                } catch {
                  settingsObject[setting.key] = setting.value;
                }
              }
            } catch (err) {
              devLog.warn('تحذير: فشل في معالجة إعداد', setting.key, setting.value);
              settingsObject[setting.key] = setting.value;
            }
          });
          devLog.log('✅ SuperProvider: تم تحويل الإعدادات بنجاح:', settingsObject);
        }
      } catch (settingsErr) {
        console.error('❌ SuperProvider: خطأ في جلب الإعدادات:', settingsErr);
      }
      
      // تصفية البيانات حسب employee_code والحذف النهائي مع تحديث localStorage
      const filteredData = filterDataByEmployeeCode(data, user);
      
      // تصفية أي طلبات تم حذفها نهائياً - حماية مضاعفة
      if (filteredData.orders) {
        filteredData.orders = filteredData.orders.filter(order => {
          if (permanentlyDeletedOrders.has(order.id)) {
            // إعادة تأكيد الحذف النهائي
            try {
              persistDeletedSet('permanentlyDeletedOrders', permanentlyDeletedOrders);
            } catch {}
            return false;
          }
          return true;
        });
      }
      if (filteredData.aiOrders) {
        filteredData.aiOrders = filteredData.aiOrders.filter(order => {
          if (permanentlyDeletedAiOrders.has(order.id)) {
            // إعادة تأكيد الحذف النهائي
            try {
              persistDeletedSet('permanentlyDeletedAiOrders', permanentlyDeletedAiOrders);
            } catch {}
            return false;
          }
          return true;
        });
      }
      
      devLog.log('✅ SuperProvider: تم جلب وتصفية البيانات بنجاح:', {
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
        // دمج الإعدادات المحملة من قاعدة البيانات
        settings: settingsObject,
        products: (filteredData.products || []).map(product => {
          // إضافة اسم مالك المنتج إذا وجد owner_user_id
          const ownerProfile = product.owner_user_id 
            ? (filteredData.users || []).find(u => (u.user_id || u.id) === product.owner_user_id)
            : null;
          return {
          ...product,
          owner_profile_name: ownerProfile?.full_name || ownerProfile?.username || null,
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
        }}),
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
                product_variants: oi.product_variants,
                // ✅ إضافة الحقول المطلوبة لنظام الحجز الدقيق
                item_status: oi.item_status,
                item_direction: oi.item_direction,
                variant_id: oi.variant_id,
                product_id: oi.product_id,
                unit_price: oi.price ?? oi.selling_price ?? oi.product_variants?.price ?? 0
              }))
            : (o.items || [])
        }))
      };
      
      // تصفية الطلبات الذكية قيد الحذف التفاؤلي لمنع الوميض
      processedData.aiOrders = (processedData.aiOrders || []).filter(o => !pendingAiDeletesRef.current.has(o.id));
      
    // تطبيق الحماية الدائمة ضد الطلبات المحذوفة
      processedData.orders = (processedData.orders || []).filter(o => !permanentlyDeletedOrders.has(o.id));
      processedData.aiOrders = (processedData.aiOrders || []).filter(o => !permanentlyDeletedAiOrders.has(o.id));
      
      // حساب الكميات المحجوزة الحقيقية وتحديثها في البيانات
      const updatedDataWithReservations = calculateUnifiedReservations(processedData);
      
      setAllData(updatedDataWithReservations);
      
      // تحديث accounting بنفس الطريقة القديمة
      setAccounting(prev => ({
        ...prev,
        expenses: filteredData.expenses || []
      }));
      
    } catch (error) {
      console.error('❌ SuperProvider: خطأ في جلب البيانات:', error);
      
      try {
        
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
      // ضمان إلغاء timeout وإنهاء حالة التحميل
      clearTimeout(timeoutId);
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

  // ⚡ دالة فورية لعرض الطلب الجديد - محسّنة للأداء
  const addOrderInstantly = useCallback((newOrderPayload) => {
    try {
      // تنظيف كاش الطلبات فوراً
      superAPI.invalidate('orders');
      
      const newOrder = {
        ...newOrderPayload,
        items: [],
        order_items: [],
        isInstantOrder: true
      };
      
      const filtered = filterDataByEmployeeCode({ orders: [newOrder] }, user);
      
      if (filtered.orders && filtered.orders.length > 0 && !permanentlyDeletedOrders.has(newOrder.id)) {
        setAllData(prev => ({
          ...prev,
          orders: [filtered.orders[0], ...(prev.orders || [])]
        }));
        
        // جلب التفاصيل في الخلفية
        fetchOrderItemsBackground(newOrder.id);
      }
    } catch (err) {
      devLog.error('❌ addOrderInstantly: خطأ في الإضافة الفورية:', err);
    }
  }, [user]);

  // ⚡ دالة جلب التفاصيل في الخلفية - محسّنة
  const fetchOrderItemsBackground = useCallback(async (orderId) => {
    try {
      const fullOrder = await superAPI.getOrderById(orderId);
        
      if (fullOrder && fullOrder.order_items?.length > 0) {
        const normalized = normalizeOrder(fullOrder, allData.users);
        
        setAllData(prev => ({
          ...prev,
          orders: (prev.orders || []).map(order =>
            order.id === orderId
              ? { ...normalized, _fullySynced: true }
              : order
          )
        }));
      }
    } catch (err) {
      devLog.error('❌ fetchOrderItemsBackground: خطأ في جلب التفاصيل:', err);
    }
  }, [user]);

  // إعداد Realtime للتحديثات الفورية
  useEffect(() => {
    if (!user) return;

    const reloadTimerRef = { current: null };

    const handleRealtimeUpdate = (table, payload) => {
      devLog.log(`🔄 SuperProvider: تحديث فوري في ${table}`);
      if (table === 'orders') {
        const type = payload.eventType;
        const rowNew = payload.new || {};
        const rowOld = payload.old || {};
        
        if (type === 'INSERT') {
          addOrderInstantly(payload.new);
        } else if (type === 'UPDATE') {
          
          // ✅ تحديث مع debounce لتجنب re-renders الزائدة
          setAllData(prev => ({
            ...prev,
            orders: (prev.orders || [])
              .map(o => o.id === rowNew.id ? { ...o, ...rowNew } : o)
              .filter(o => o && o.id) // ✅ إزالة أي قيم null/undefined
          }));
        } else if (type === 'DELETE') {
          permanentlyDeletedOrders.add(rowOld.id);
          setAllData(prev => ({ 
            ...prev, 
            orders: (prev.orders || []).filter(o => o.id !== rowOld.id) 
          }));
          // بث حدث التأكيد للمكونات
          try { 
            window.dispatchEvent(new CustomEvent('orderDeletedConfirmed', { detail: { id: rowOld.id } })); 
          } catch {}
        }
        // لا إعادة جلب إضافية - تم التحديث مسبقاً
      }

      // تحديث مباشر فوري لطلبات الذكاء الاصطناعي
      if (table === 'ai_orders') {
        const type = payload.eventType;
        const rowNew = payload.new || {};
        const rowOld = payload.old || {};
        
        if (type === 'INSERT') {
          console.log('🔔 [SuperProvider] ai_orders INSERT:', rowNew.id, rowNew.customer_name);
          try { pendingAiDeletesRef.current.delete(rowNew.id); } catch {}
          setAllData(prev => {
            // تجنب التكرار
            if (prev.aiOrders?.some(o => o.id === rowNew.id)) {
              console.log('⚠️ [SuperProvider] الطلب موجود مسبقاً:', rowNew.id);
              return prev;
            }
            console.log('✅ [SuperProvider] إضافة طلب جديد للسياق:', rowNew.id);
            return { ...prev, aiOrders: [rowNew, ...(prev.aiOrders || [])] };
          });
          // ⚡ إطلاق حدث فوري للمكونات المستمعة
          try { 
            window.dispatchEvent(new CustomEvent('aiOrderCreated', { detail: rowNew })); 
            console.log('📢 [SuperProvider] تم إطلاق حدث aiOrderCreated:', rowNew.id);
          } catch {}
        } else if (type === 'UPDATE') {
          setAllData(prev => ({
            ...prev,
            aiOrders: (prev.aiOrders || []).map(o => o.id === rowNew.id ? { ...o, ...rowNew } : o)
          }));
        } else if (type === 'DELETE') {
          permanentlyDeletedAiOrders.add(rowOld.id);
          try { pendingAiDeletesRef.current.add(rowOld.id); } catch {}
          setAllData(prev => ({
            ...prev,
            aiOrders: (prev.aiOrders || []).filter(o => o.id !== rowOld.id)
          }));
          // بث حدث التأكيد للمكونات
          try { 
            window.dispatchEvent(new CustomEvent('aiOrderDeletedConfirmed', { detail: { id: rowOld.id } })); 
          } catch {}
        }
        return; // لا إعادة جلب للطلبات الذكية
      }

      // تحديث فوري لعناصر الطلبات: إعادة جلب الطلب المحدد ودمجه + إعادة حساب الحجوزات فوراً
      if (table === 'order_items') {
        const orderId = payload.new?.order_id || payload.old?.order_id;
        if (orderId) {
          (async () => {
            try {
              const full = await superAPI.getOrderById(orderId);
              
              // ✅ نقل normalizeOrder داخل setAllData لتجنب ReferenceError
              setAllData(prev => {
                const normalized = normalizeOrder(full, prev.users);
                const existingOrderIndex = (prev.orders || []).findIndex(o => o.id === orderId);
                
                let updatedData;
                if (existingOrderIndex >= 0) {
                  // الطلب موجود، قم بتحديثه
                  const updatedOrders = [...(prev.orders || [])];
                  updatedOrders[existingOrderIndex] = normalized;
                  updatedData = { ...prev, orders: updatedOrders };
                } else {
                  updatedData = { ...prev, orders: [normalized, ...(prev.orders || [])] };
                }
                
                return calculateUnifiedReservations(updatedData);
              });
            } catch (e) {
              console.error('فشل تحديث الطلب:', e);
            }
          })();
        }
        return;
      }

      // تمرير إشعار للإستماع المنفصل
      if (table === 'notifications' && payload.eventType === 'INSERT') {
        window.dispatchEvent(new CustomEvent('notificationCreated', { detail: payload.new }));
        return;
      }

      // تحديث مباشر بدلاً من إعادة جلب كامل لمنع عودة الطلبات المحذوفة
      if (table === 'orders' && payload.eventType === 'DELETE') {
        // إضافة للقائمة المحذوفة نهائياً
        const orderId = payload.old?.id;
        if (orderId) {
          permanentlyDeletedOrders.add(orderId);
          try {
            persistDeletedSet('permanentlyDeletedOrders', permanentlyDeletedOrders);
          } catch {}
        }
        return; // لا إعادة جلب نهائياً للطلبات المحذوفة
      }
      
      // ⚡ تحديث فوري لبيانات المخزون عند تغيير جدول inventory
      if (table === 'inventory' && payload.eventType === 'UPDATE') {
        const rowNew = payload.new || {};
        const variantId = rowNew.variant_id;
        
        if (variantId) {
          devLog.log('📦 تحديث فوري للمخزون - variant:', variantId);
          
          setAllData(prev => {
            const updatedProducts = (prev.products || []).map(product => ({
              ...product,
              variants: (product.variants || []).map(variant => 
                variant.id === variantId 
                  ? {
                      ...variant,
                      quantity: rowNew.quantity ?? variant.quantity,
                      reserved_quantity: rowNew.reserved_quantity ?? variant.reserved_quantity,
                      sold_quantity: rowNew.sold_quantity ?? variant.sold_quantity,
                      inventory: {
                        ...variant.inventory,
                        quantity: rowNew.quantity,
                        reserved_quantity: rowNew.reserved_quantity,
                        sold_quantity: rowNew.sold_quantity,
                      }
                    }
                  : variant
              ),
              product_variants: (product.product_variants || []).map(variant => 
                variant.id === variantId 
                  ? {
                      ...variant,
                      quantity: rowNew.quantity ?? variant.quantity,
                      reserved_quantity: rowNew.reserved_quantity ?? variant.reserved_quantity,
                      sold_quantity: rowNew.sold_quantity ?? variant.sold_quantity,
                    }
                  : variant
              )
            }));
            
            return { ...prev, products: updatedProducts };
          });
        }
        return; // لا إعادة جلب كامل - التحديث المباشر يكفي
      }

      // تحديث فوري للمنتجات بدون إعادة جلب كامل
      if (table === 'products' || table === 'product_variants') {
        devLog.log('📦 تحديث فوري للمنتجات');
        if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = setTimeout(async () => {
          try {
            await dbRefetchProducts();
            // فقط invalidate المنتجات، ليس كل البيانات
            superAPI.invalidate('products_only');
          } catch (e) { console.error('فشل تحديث المنتجات:', e); }
        }, 100);
        return;
      }

      // تحديث محدود للجداول الأخرى فقط
      if (['customers', 'expenses', 'purchases'].includes(table)) {
        if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = setTimeout(() => {
          fetchAllData();
        }, 200);
      }
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
      try { pendingAiDeletesRef.current.delete(event.detail.id); } catch {}
      setAllData(prevData => ({
        ...prevData,
        aiOrders: [...(prevData.aiOrders || []), event.detail]
      }));
    };

    const handleAiOrderUpdated = (event) => {
      setAllData(prevData => ({
        ...prevData,
        aiOrders: (prevData.aiOrders || []).map(order => 
          order.id === event.detail.id ? { ...order, ...event.detail } : order
        )
      }));
    };

    const handleAiOrderDeleted = (event) => {
      try { pendingAiDeletesRef.current.add(event.detail.id); } catch {}
      setAllData(prevData => ({
        ...prevData,
        aiOrders: (prevData.aiOrders || []).filter(order => order.id !== event.detail.id)
      }));
    };

    // orderCreated event removed — relying solely on realtime INSERT

    
    const handleOrderDeleted = (event) => {
      const { id, tracking_number, order_number } = event.detail;
      
      setAllData(prev => ({
        ...prev,
        orders: prev.orders.filter(order => order.id !== id)
      }));
      
      // 🛡️ استخدام Set + persistDeletedSet للحفاظ على TTL ساعة
      permanentlyDeletedOrders.add(id);
      persistDeletedSet('permanentlyDeletedOrders', permanentlyDeletedOrders);
    };

    window.addEventListener('aiOrderCreated', handleAiOrderCreated);
    window.addEventListener('aiOrderUpdated', handleAiOrderUpdated);
    window.addEventListener('aiOrderDeleted', handleAiOrderDeleted);
    window.addEventListener('orderDeleted', handleOrderDeleted);

    return () => {
      window.removeEventListener('aiOrderCreated', handleAiOrderCreated);
      window.removeEventListener('aiOrderUpdated', handleAiOrderUpdated);
      window.removeEventListener('aiOrderDeleted', handleAiOrderDeleted);
      window.removeEventListener('orderDeleted', handleOrderDeleted);
    };
  }, [normalizeOrder]);

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
  // تم نقل استدعاء useProductsDB إلى أعلى الملف لضمان ترتيب الهوكس

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
            total_price: i.total_price || (i.quantity * (i.unit_price || i.price || 0)),
            item_direction: i.item_direction || null
          }))
        : (cartItemsArg || []).map(i => ({
            product_id: i.productId || i.id,
            variant_id: i.variantId || i.sku,
            quantity: i.quantity,
            unit_price: i.price,
            total_price: i.quantity * i.price,
            item_direction: i.item_direction || null
          }));

      // ✅ للإرجاع والاستبدال: يُسمح بسلة فارغة
      const orderType = deliveryPartnerDataArg?.order_type || arg1?.order_type || 'regular';
      const isReturn = orderType === 'return';
      const isExchange = orderType === 'replacement' || orderType === 'exchange';
      
      if (!items.length && !isReturn && !isExchange) {
        return { success: false, error: 'لا توجد عناصر في الطلب' };
      }

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

      // ✅ حجز المخزون
      const reservedSoFar = [];

      // ✅ 1. طلبات عادية: حجز كل المنتجات
      if (!isReturn && !isExchange && items.length > 0) {
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
      } 

      // بيانات الطلب للإدراج
      const baseOrder = isPayload ? arg1 : {
        customer_name: arg1?.customer_name || arg1?.name,
        customer_phone: arg1?.customer_phone || arg1?.phone,
        customer_phone2: arg1?.customer_phone2 || arg1?.second_phone || '',
        customer_address: arg1?.customer_address || arg1?.address,
        customer_city: arg1?.customer_city || arg1?.city,
        customer_province: arg1?.customer_province || arg1?.province,
        notes: arg1?.notes,
      };

      // ✅ الإصلاح النهائي: fallback ثنائي لضمان استخدام المعرفات الصحيحة
      const finalAlwaseetCityId = deliveryPartnerDataArg?.alwaseet_city_id 
        || arg1?.alwaseet_city_id 
        || null;
      const finalAlwaseetRegionId = deliveryPartnerDataArg?.alwaseet_region_id 
        || arg1?.alwaseet_region_id 
        || null;

      const orderRow = {
        order_number: orderNumber,
        customer_name: baseOrder.customer_name,
        customer_phone: baseOrder.customer_phone,
        customer_phone2: baseOrder.customer_phone2 || null,
        customer_address: baseOrder.customer_address,
        customer_city: baseOrder.customer_city,
        customer_province: baseOrder.customer_province,
        // ✅ total_amount: للاستبدال فرق السعر فقط، للإرجاع refund_amount، للعادي سعر المنتجات
        total_amount: (() => {
          if (orderType === 'replacement' || orderType === 'exchange') {
            const metadata = isPayload ? (arg1.exchange_metadata || {}) : {};
            return Math.abs(metadata.price_difference || 0);
          }
          if (orderType === 'return') {
            return Math.abs(deliveryPartnerDataArg?.refund_amount || 0);
          }
          return subtotal;
        })(),
        // ✅ sales_amount = سعر المنتجات فقط (بدون توصيل)
        sales_amount: subtotal - discount,
        discount,
        delivery_fee: deliveryFee,
        // ✅ منع price_increase الخاطئ للطلبات الجديدة
        price_increase: 0,
        price_change_type: null,
        // ✅ final_amount: للاستبدال فرق السعر + توصيل، للإرجاع القيمة المرسلة، للعادي الإجمالي
        final_amount: (() => {
          if (orderType === 'replacement' || orderType === 'exchange') {
            const metadata = isPayload ? (arg1.exchange_metadata || {}) : {};
            const priceDiff = metadata.price_difference || 0;
            return priceDiff + deliveryFee;
          }
          if (orderType === 'return' && deliveryPartnerDataArg?.final_amount !== undefined) {
            return deliveryPartnerDataArg.final_amount;
          }
          if (deliveryPartnerDataArg?.final_amount !== undefined) {
            return deliveryPartnerDataArg.final_amount;
          }
          return total;
        })(),
        status: 'pending',
        delivery_status: 'pending',
        payment_status: 'pending',
        tracking_number: trackingNumber,
        delivery_partner: isPayload ? (arg1.delivery_partner || 'محلي') : (deliveryPartnerDataArg?.delivery_partner || 'محلي'),
        notes: deliveryPartnerDataArg?.notes || baseOrder.notes,
        created_by: resolveCurrentUserUUID(),
        // ✅ الإصلاح الجذري: استخدام القيم المباشرة من deliveryPartnerDataArg
        alwaseet_city_id: finalAlwaseetCityId,
        alwaseet_region_id: finalAlwaseetRegionId,
        delivery_partner_order_id: 
          deliveryPartnerDataArg?.delivery_partner_order_id || 
          deliveryPartnerDataArg?.id || 
          arg1?.delivery_partner_order_id || 
          arg1?.external_id || 
          arg1?.id || 
          (isPayload && arg1?.items?.[0]?.external_id) ||
          null,
        qr_id: 
          deliveryPartnerDataArg?.qr_id || 
          arg1?.qr_id || 
          arg1?.qr_code ||
          trackingNumber || 
          null,
        // ✅ إضافة حقول الإرجاع والاستبدال
        order_type: orderType,
        refund_amount: deliveryPartnerDataArg?.refund_amount || 0,
        original_order_id: deliveryPartnerDataArg?.original_order_id || null,
        // ✅ إضافة exchange_metadata للاستبدال
        exchange_metadata: isPayload ? (arg1.exchange_metadata || null) : null,
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

      // ✅ إدراج عناصر الطلب - تجاهل للإرجاع (سلة فارغة)
      // نقل تعريف itemsRows خارج block الشرط لتجنب خطأ "Can't find variable"
      const itemsRows = items.length > 0 ? items.map(it => ({
        order_id: createdOrder.id,
        product_id: it.product_id,
        variant_id: it.variant_id || null,
        quantity: it.quantity,
        unit_price: it.unit_price,
        total_price: it.total_price,
        item_direction: it.item_direction || null // ✅ حفظ اتجاه العناصر (incoming للإرجاع)
      })) : [];

      if (items.length > 0) {
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
          return { success: false, error: itemsErr.message };
        }
      } else {
        console.log('⏭️ تخطي إنشاء order_items - طلب إرجاع');
      }

      // عرض الطلب فوراً مع البيانات المحلية (نهج جديد لسرعة فائقة)
      const startTime = performance.now();
      
      // إنشاء طلب محلي فوري من البيانات المتاحة
      const instantOrder = {
        ...createdOrder,
        // الآن itemsRows متاح دائماً (مصفوفة فارغة للإرجاع)
        order_items: itemsRows.map((item, index) => ({
          ...item,
          id: `instant_${Date.now()}_${index}`,
          products: allData.products?.find(p => p.id === item.product_id),
          product_variants: allData.products?.find(p => p.id === item.product_id)?.product_variants?.find(v => v.id === item.variant_id)
        })),
        _instantDisplay: true
      };
      
      // عرض الطلب فوراً في الواجهة (0ms تقريباً)
      setAllData(prev => ({
        ...prev,
        orders: [instantOrder, ...(prev.orders || [])]
      }));
      
      const instantTime = performance.now() - startTime;
      console.log(`⚡ طلب فوري في ${instantTime.toFixed(1)}ms:`, instantOrder.order_number);
      
      // جلب التفاصيل الكاملة في الخلفية مع تأخير أطول لمنع التجمد
      setTimeout(async () => {
        try {
          const fullOrder = await superAPI.getOrderById(createdOrder.id);
          if (fullOrder) {
            const normalized = normalizeOrder(fullOrder, prev.users);
            setAllData(prev => ({
              ...prev,
              orders: prev.orders.map(o => 
                o.id === createdOrder.id ? { ...normalized, _fullySynced: true } : o
              )
            }));
            console.log(`🔄 تزامن كامل للطلب:`, normalized.order_number);
          }
        } catch (error) {
          console.warn('⚠️ فشل التزامن الخلفي، الطلب المعروض فورياً يبقى صالحاً:', error);
        }
      }, 1500); // تأخير أطول لمنع التداخل مع العمليات الأخرى

      // إبطال الكاش للتزامن مع الخادم
      superAPI.invalidate('all_data');
      superAPI.invalidate('orders_only');

      // ✅ معاينة للتأكد من حفظ معرفات الوسيط بشكل صحيح
      if (orderRow.delivery_partner === 'alwaseet') {
        console.log('🔍 معاينة معرفات الوسيط المحفوظة:', {
          delivery_partner_order_id: orderRow.delivery_partner_order_id,
          qr_id: orderRow.qr_id,
          tracking_number: orderRow.tracking_number,
          alwaseet_city_id: orderRow.alwaseet_city_id,
          alwaseet_region_id: orderRow.alwaseet_region_id
        });
        
        // التحقق من وجود المعرفات الأساسية
        if (!orderRow.delivery_partner_order_id) {
          console.warn('⚠️ تحذير: لم يتم حفظ delivery_partner_order_id للطلب الجديد');
        }
        if (!orderRow.qr_id) {
          console.warn('⚠️ تحذير: لم يتم حفظ qr_id للطلب الجديد');
        }
      }

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

  // تحديث طلب - مع تحديث شامل وفوري للبيانات المحدثة
  const updateOrder = useCallback(async (orderId, updates, newItems = null, originalItems = null) => {
    try {
      console.log('🔄 SuperProvider updateOrder:', { orderId, updates, newItems });
      
      // ✅ معالجة المخزون التلقائية عند تغيير delivery_status
      if (updates.delivery_status) {
        // معالجة طلبات الاستبدال
        const currentOrder = allData.orders?.find(o => o.id === orderId);
        if (currentOrder?.order_type === 'replacement' || currentOrder?.order_type === 'exchange') {
          const { handleExchangeStatusChange } = await import('@/utils/exchange-status-handler');
          await handleExchangeStatusChange(orderId, updates.delivery_status);
        }
        // معالجة طلبات الإرجاع والتسليم الجزئي
        else if (currentOrder?.order_type === 'return' || currentOrder?.order_type === 'partial_delivery') {
          const { handleReturnStatusChange } = await import('@/utils/return-status-handler');
          await handleReturnStatusChange(orderId, updates.delivery_status);
        }
      }
      
      // تحديث فوري محلياً مع البيانات الكاملة
      setAllData(prev => ({
        ...prev,
        orders: (prev.orders || []).map(o => o.id === orderId ? { 
          ...o, 
          ...updates, 
          items: newItems || o.items,
          updated_at: new Date().toISOString(),
          // إضافة معرفات الوسيط
          alwaseet_city_id: updates.alwaseet_city_id || o.alwaseet_city_id,
          alwaseet_region_id: updates.alwaseet_region_id || o.alwaseet_region_id
        } : o),
      }));
      
      // إرسال حدث متصفح فوري مع البيانات الكاملة
      const updatedOrder = {
        id: orderId,
        ...updates,
        items: newItems,
        updated_at: new Date().toISOString()
      };
      
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('orderUpdated', { 
          detail: { 
            id: orderId, 
            updates, 
            order: updatedOrder,
            timestamp: new Date().toISOString()
          } 
        }));
        
        window.dispatchEvent(new CustomEvent('superProviderOrderUpdated', { 
          detail: { 
            orderId, 
            order: updatedOrder,
            timestamp: new Date().toISOString()
          } 
        }));
      }, 100);

      // تحديث في قاعدة البيانات
      const result = await superAPI.updateOrder(orderId, updates);

      // توحيد الحالة النهائية بعد عودة الخادم
      setAllData(prev => ({
        ...prev,
        orders: (prev.orders || []).map(o => o.id === orderId ? {
          ...normalizeOrder(result, prev.users),
          items: newItems || o.items,
          alwaseet_city_id: updates.alwaseet_city_id || result.alwaseet_city_id,
          alwaseet_region_id: updates.alwaseet_region_id || result.alwaseet_region_id
        } : o),
      }));

      console.log('✅ SuperProvider updateOrder نجح:', { orderId, success: true, result });
      return { success: true, order: result, data: result };
    } catch (error) {
      console.error('Error in SuperProvider updateOrder:', error);
      
      // إعادة الحالة السابقة في حالة الفشل
      setAllData(prev => ({
        ...prev,
        orders: (prev.orders || []).map(o => o.id === orderId ? {
          ...o,
          // إزالة التحديثات المؤقتة
        } : o),
      }));
      
      return { success: false, error: error.message };
    }
  }, [normalizeOrder]);

  // تعرض دالة التحديث للمكونات الخارجية
  useEffect(() => {
    window.superProviderUpdate = updateOrder;
    return () => {
      delete window.superProviderUpdate;
    };
  }, [updateOrder]);

  const deleteOrders = useCallback(async (orderIds, isAiOrder = false) => {
    try {
      if (isAiOrder) {
        (orderIds || []).filter(id => id != null).forEach(id => permanentlyDeletedAiOrders.add(id));
        // حفظ في localStorage للحماية الدائمة
        try {
          persistDeletedSet('permanentlyDeletedAiOrders', permanentlyDeletedAiOrders);
        } catch {}
        setAllData(prev => ({
          ...prev,
          aiOrders: (prev.aiOrders || []).filter(o => !orderIds.includes(o.id))
        }));
        
        const { error } = await supabase.from('ai_orders').delete().in('id', orderIds);
        if (error) {
          console.error('❌ فشل حذف AI orders:', error);
          setTimeout(async () => {
            try {
              await supabase.from('ai_orders').delete().in('id', orderIds);
            } catch (retryErr) {
              console.error('❌ فشل إعادة المحاولة:', retryErr);
            }
          }, 1000);
        }
        
        // إشعارات Real-time فورية
        (orderIds || []).filter(id => id != null).forEach(id => {
          try { 
            window.dispatchEvent(new CustomEvent('aiOrderDeleted', { detail: { id, confirmed: true } })); 
          } catch {}
        });
        
      } else {
        // ⚠️ لا تستدعي release_stock_for_order أو release_stock_item هنا!
        // تحرير المخزون يتم تلقائياً عبر trigger: auto_release_stock_on_order_delete
        // عند حذف الطلب من قاعدة البيانات، trigger يُنقص reserved_quantity فقط
        // 🔴 الاستدعاءات اليدوية كانت تسبب تكرار التحرير وتحويل المنتجات للمباع بشكل خاطئ
        
        (orderIds || []).filter(id => id != null).forEach(id => permanentlyDeletedOrders.add(id));
        // حفظ في localStorage للحماية الدائمة
        try {
          persistDeletedSet('permanentlyDeletedOrders', permanentlyDeletedOrders);
        } catch {}
        setAllData(prev => ({
          ...prev,
          orders: (prev.orders || []).filter(o => !orderIds.includes(o.id))
        }));
        
        for (const orderId of orderIds) {
          try {
            const { data: relatedAiOrders } = await supabase
              .from('ai_orders')
              .select('id')
              .or(`id.eq.${orderId},order_data->order_id.eq.${orderId}`);
            
            if (relatedAiOrders && relatedAiOrders.length > 0) {
              const aiOrderIds = relatedAiOrders.map(ai => ai.id);
              await supabase.from('ai_orders').delete().in('id', aiOrderIds);
              
              // تحديث الحالة المحلية أيضاً
              aiOrderIds.forEach(id => permanentlyDeletedAiOrders.add(id));
              setAllData(prev => ({
                ...prev,
                aiOrders: (prev.aiOrders || []).filter(o => !aiOrderIds.includes(o.id))
              }));
            }
          } catch (aiCleanupError) {
            console.error('فشل تنظيف ai_orders:', aiCleanupError);
          }
        }
        
        // ثانياً: حذف الطلبات العادية
        const { error } = await supabase.from('orders').delete().in('id', orderIds);
        if (error) {
          console.error('❌ فشل حذف orders:', error);
          console.error('❌ تفاصيل الخطأ:', { message: error.message, details: error.details, hint: error.hint });
          // إعادة محاولة مرة واحدة
          setTimeout(async () => {
            try {
              await supabase.from('orders').delete().in('id', orderIds);
              console.log('✅ إعادة محاولة حذف orders نجحت');
            } catch (retryErr) {
              console.error('❌ فشل إعادة المحاولة:', retryErr);
            }
          }, 1000);
        }
        
        // إشعارات Real-time فورية
        (orderIds || []).filter(id => id != null).forEach(id => {
          try { 
            window.dispatchEvent(new CustomEvent('orderDeleted', { detail: { id, confirmed: true } })); 
          } catch {}
        });
      }
      
      // إظهار toast موحد للنجاح
      toast({
        title: "تم الحذف بنجاح",
        description: `تم حذف ${orderIds.length} طلب وتحرير المخزون المحجوز فوراً`,
        variant: "success"
      });
      
      console.log('✅ حذف مكتمل فورياً مع تحرير المخزون وحماية دائمة');
      return { success: true };
      
    } catch (deleteError) {
      console.error('❌ خطأ في الحذف:', deleteError);
      return { success: false, error: deleteError.message };
    }
  }, []);

  // إضافة مصروف - حفظ فعلي في قاعدة البيانات
  const addExpense = useCallback(async (expense) => {
    try {
      console.log('💰 SuperProvider: إضافة مصروف:', expense.description);
      
      const userId = user?.id || user?.user_id;
      if (!userId) throw new Error('يجب تسجيل الدخول أولاً');

      const { data, error } = await supabase
        .from('expenses')
        .insert({
          amount: Number(expense.amount),
          category: expense.category || 'عام',
          description: expense.description || '',
          expense_type: expense.expense_type || 'operational',
          created_by: userId,
          status: 'approved',
          approved_by: userId,
          approved_at: new Date().toISOString(),
          vendor_name: expense.vendor_name || null,
          receipt_number: expense.receipt_number || null,
          metadata: expense.metadata || null
        })
        .select()
        .single();
      
      if (error) throw error;
      
      superAPI.invalidate('all_data');
      await fetchAllData();
      
      toast({ 
        title: "تمت إضافة المصروف",
        description: `تم إضافة مصروف ${expense.description}`,
        variant: "success" 
      });

      return { success: true, data };
    } catch (error) {
      console.error('❌ خطأ في إضافة المصروف:', error);
      toast({ 
        title: "خطأ في إضافة المصروف",
        description: error.message,
        variant: "destructive" 
      });
      throw error;
    }
  }, [user, fetchAllData]);

  // تسوية مستحقات الموظف - نسخة مصححة بالكامل تستخدم قواعد الربح الثابتة + الخصومات المعلقة
  const settleEmployeeProfits = useCallback(async (employeeId, totalSettlement = 0, employeeName = '', orderIds = []) => {
    try {
      if (!orderIds || orderIds.length === 0) {
        throw new Error('لا توجد طلبات لتسويتها');
      }

      console.debug('🔧 بدء تسوية مستحقات الموظف:', { employeeId, totalSettlement, employeeName, orderIds });

      const now = new Date().toISOString();
      const ordersMap = new Map((allData.orders || []).map(o => [o.id, o]));
      
      // جلب قواعد الربح للموظف
      const { data: profitRules, error: rulesErr } = await supabase
        .from('employee_profit_rules')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('is_active', true);
      
      if (rulesErr) throw rulesErr;
      console.debug('📋 قواعد الربح المتوفرة:', profitRules?.length || 0);

      // جلب الخصومات المعلقة للموظف
      const { data: pendingDeductionsData, error: deductionsErr } = await supabase
        .rpc('get_employee_pending_deductions', { p_employee_id: employeeId });
      
      if (deductionsErr) {
        console.error('⚠️ خطأ في جلب الخصومات المعلقة:', deductionsErr);
      }
      
      const pendingDeductions = pendingDeductionsData?.[0]?.total_pending_deductions || 0;
      const deductionsCount = pendingDeductionsData?.[0]?.deductions_count || 0;
      console.debug('💳 الخصومات المعلقة:', { pendingDeductions, deductionsCount });

      // جلب عناصر الطلبات
      const { data: orderItems, error: itemsErr } = await supabase
        .from('order_items')
        .select('order_id, product_id, quantity')
        .in('order_id', orderIds);
      
      if (itemsErr) throw itemsErr;
      
      // تجميع عناصر كل طلب
      const itemsByOrder = {};
      (orderItems || []).forEach(item => {
        if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
        itemsByOrder[item.order_id].push(item);
      });

      // دالة حساب ربح الموظف من قواعد الربح الثابتة
      const calcEmployeeProfitFromRules = (orderId, order) => {
        const items = itemsByOrder[orderId] || [];
        if (items.length === 0) return { profit: 0, hasRule: false };
        
        const orderDate = new Date(order?.created_at || now);
        let totalProfit = 0;
        let hasAnyRule = false;
        
        items.forEach(item => {
          const productId = item.product_id;
          if (!productId) return;
          
          // البحث عن قاعدة ربح سارية وقت إنشاء الطلب
          const rule = (profitRules || []).find(r => 
            r.target_id === productId &&
            r.rule_type === 'product' &&
            new Date(r.created_at) <= orderDate // القاعدة يجب أن تكون موجودة قبل أو وقت إنشاء الطلب
          );
          
          if (rule) {
            hasAnyRule = true;
            
            if (rule.profit_percentage === 100) {
              // ✅ كامل الربح: سعر البيع - سعر التكلفة
              const sellingPrice = item.price || item.unit_price || 0;
              const costPrice = item.cost_price || item.product_variants?.cost_price || 0;
              const fullProfit = (sellingPrice - costPrice) * (item.quantity || 1);
              totalProfit += Math.max(0, fullProfit);
              console.debug(`✅ كامل الربح للمنتج ${productId}: (${sellingPrice} - ${costPrice}) × ${item.quantity} = ${fullProfit}`);
            } else {
              totalProfit += (rule.profit_amount || 0) * (item.quantity || 1);
              console.debug(`✅ قاعدة ربح للمنتج ${productId}: ${rule.profit_amount} × ${item.quantity}`);
            }
          } else {
            console.debug(`⚠️ لا توجد قاعدة ربح سارية للمنتج ${productId} وقت الطلب ${orderDate.toISOString()}`);
          }
        });
        
        // خصم الخصم من ربح الموظف (فقط للموظفين الذين لديهم قاعدة ربح)
        const discount = Number(order?.discount) || 0;
        
        // ✅ المنطق الجديد: الخصم يكون من الموظف فقط إذا كان لديه قاعدة ربح
        // إذا لا يوجد قاعدة ربح → الخصم يكون من ربح النظام
        if (hasAnyRule && discount > 0) {
          totalProfit = totalProfit - discount;
          console.debug(`📊 ربح الموظف للطلب ${order?.tracking_number}: ${totalProfit} (قبل الخصم: ${totalProfit + discount}, خصم: ${discount})`);
        } else if (!hasAnyRule && discount > 0) {
          console.debug(`📊 الخصم ${discount} للطلب ${order?.tracking_number} سيكون من ربح النظام (الموظف بدون قاعدة ربح)`);
        }
        
        return { profit: Math.max(0, totalProfit), hasRule: hasAnyRule, discountFromSystem: !hasAnyRule && discount > 0 };
      };

      // جلب السجلات الحالية
      const { data: existing, error: existingErr } = await supabase
        .from('profits')
        .select('id, order_id, profit_amount, employee_profit, employee_id, status, settled_at')
        .in('order_id', orderIds);
      if (existingErr) throw existingErr;
      const existingMap = new Map((existing || []).map(e => [e.order_id, e]));

      // حساب المبلغ الفعلي من قواعد الربح
      let actualTotalSettlement = 0;
      const settledOrdersDetails = [];

      // تحضير upsert
      const upserts = orderIds.map(orderId => {
        const order = ordersMap.get(orderId);
        const existingRow = existingMap.get(orderId);
        
        // حساب ربح الموظف من القواعد الثابتة
        const profitInfo = calcEmployeeProfitFromRules(orderId, order);
        actualTotalSettlement += profitInfo.profit;
        
        // حسابات دقيقة لكل طلب للإيراد والتكلفة
        const items = itemsByOrder[orderId] || [];
        const finalAmount = Number(order?.final_amount ?? order?.total_amount ?? 0) || 0;
        const deliveryFee = Number(order?.delivery_fee ?? 0) || 0;
        const revenueWithoutDelivery = finalAmount - deliveryFee;
        
        // تفاصيل الطلب المسوى
        settledOrdersDetails.push({
          order_id: orderId,
          order_number: order?.order_number,
          tracking_number: order?.tracking_number,
          customer_name: order?.customer_name,
          order_date: order?.created_at,
          order_total: finalAmount,
          employee_profit: profitInfo.profit,
          has_rule: profitInfo.hasRule,
          discount: order?.discount || 0,
          price_increase: order?.price_increase || 0
        });

        console.debug('🔧 حساب ربح الطلب:', { 
          orderId: order?.order_number,
          trackingNumber: order?.tracking_number,
          employee_profit: profitInfo.profit,
          hasRule: profitInfo.hasRule
        });

        return {
          ...(existingRow ? { id: existingRow.id } : {}),
          order_id: orderId,
          employee_id: employeeId || order?.created_by,
          total_revenue: revenueWithoutDelivery,
          total_cost: Math.max(0, revenueWithoutDelivery - profitInfo.profit),
          profit_amount: profitInfo.profit,
          employee_profit: profitInfo.profit,
          status: profitInfo.hasRule ? 'settled' : 'no_rule_settled',
          settled_at: now
        };
      });

      // حساب المبلغ النهائي بعد خصم الخصومات المعلقة
      const deductionToApply = Math.min(pendingDeductions, actualTotalSettlement);
      const finalSettlementAmount = actualTotalSettlement - deductionToApply;
      
      console.debug(`💰 إجمالي المستحقات: ${actualTotalSettlement}, الخصومات المطبقة: ${deductionToApply}, المبلغ النهائي: ${finalSettlementAmount}`);

      const { error: upsertErr } = await supabase.from('profits').upsert(upserts);
      if (upsertErr) throw upsertErr;
      console.debug('✅ تم إدراج سجلات الأرباح بنجاح');

      // جلب القاصة الرئيسية
      const { data: cashSource, error: cashErr } = await supabase
        .from('cash_sources')
        .select('id, current_balance, name')
        .eq('is_active', true)
        .eq('name', 'القاصة الرئيسية')
        .maybeSingle();
      
      if (cashErr) {
        console.error('❌ خطأ في جلب القاصة:', cashErr);
      }

      // جلب كود الموظف
      const { data: employeeProfile } = await supabase
        .from('profiles')
        .select('employee_code')
        .eq('user_id', employeeId)
        .maybeSingle();
      
      const employeeCode = employeeProfile?.employee_code || 'EMP';

      // إنشاء فاتورة تسوية احترافية
      const invoiceNumber = `RY-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      const { data: invoice, error: invoiceErr } = await supabase
        .from('settlement_invoices')
        .insert({
          invoice_number: invoiceNumber,
          employee_id: employeeId,
          employee_name: employeeName || 'غير محدد',
          employee_code: employeeCode,
          order_ids: orderIds,
          total_amount: finalSettlementAmount, // المبلغ النهائي بعد الخصومات
          payment_method: 'cash',
          status: 'completed',
          settlement_date: now,
          settled_orders: settledOrdersDetails,
          description: `دفع مستحقات الموظف ${employeeName || 'غير محدد'} - ${orderIds.length} طلب` + 
            (deductionToApply > 0 ? ` (خصم معلق: ${deductionToApply.toLocaleString()} د.ع)` : ''),
          created_by: user?.user_id || user?.id
        })
        .select()
        .single();

      if (invoiceErr) {
        console.error('❌ خطأ في إنشاء فاتورة التسوية:', invoiceErr);
      } else {
        console.debug('✅ تم إنشاء فاتورة التسوية:', invoiceNumber);
        
        // تطبيق الخصومات المعلقة على هذه التسوية
        if (deductionToApply > 0 && invoice?.id) {
          const { data: appliedAmount, error: applyErr } = await supabase
            .rpc('apply_pending_deductions_on_settlement', {
              p_employee_id: employeeId,
              p_settlement_id: invoice.id,
              p_max_amount: actualTotalSettlement
            });
          
          if (applyErr) {
            console.error('⚠️ خطأ في تطبيق الخصومات المعلقة:', applyErr);
          } else {
            console.debug('✅ تم تطبيق الخصومات المعلقة:', appliedAmount);
          }
        }
      }

      // إضافة مصروف مستحقات الموظف (المبلغ النهائي بعد الخصومات)
      const expenseData = {
        amount: finalSettlementAmount,
        category: 'مستحقات الموظفين',
        expense_type: 'system',
        description: `دفع مستحقات الموظف ${employeeName || 'غير محدد'} - فاتورة ${invoiceNumber}` +
          (deductionToApply > 0 ? ` (بعد خصم ${deductionToApply.toLocaleString()} د.ع)` : ''),
        receipt_number: invoiceNumber,
        vendor_name: employeeName || 'موظف',
        status: 'approved',
        created_by: user?.user_id || user?.id,
        approved_by: user?.user_id || user?.id,
        approved_at: now,
        metadata: {
          employee_id: employeeId,
          employee_name: employeeName,
          employee_code: employeeCode,
          order_ids: orderIds,
          settlement_type: 'employee_dues',
          invoice_id: invoice?.id,
          invoice_number: invoiceNumber,
          original_amount: actualTotalSettlement,
          deductions_applied: deductionToApply
        }
      };

      const { data: expenseRecord, error: expenseErr } = await supabase
        .from('expenses')
        .insert(expenseData)
        .select()
        .single();
      
      if (expenseErr) {
        console.error('❌ خطأ في إضافة مصروف مستحقات الموظف:', expenseErr);
        throw expenseErr;
      }
      console.debug('✅ تم إضافة مصروف مستحقات الموظف:', expenseRecord.id);

      // إضافة حركة نقدية (خروج نقد) - المبلغ النهائي فقط
      if (cashSource && finalSettlementAmount > 0) {
        const movementData = {
          cash_source_id: cashSource.id,
          amount: finalSettlementAmount,
          movement_type: 'employee_dues',
          reference_type: 'settlement_invoice',
          reference_id: invoice?.id || expenseRecord.id,
          description: `دفع مستحقات الموظف ${employeeName || 'غير محدد'} - فاتورة ${invoiceNumber}`,
          balance_before: cashSource.current_balance,
          balance_after: cashSource.current_balance - finalSettlementAmount,
          created_by: user?.user_id || user?.id
        };

        const { error: movementErr } = await supabase
          .from('cash_movements')
          .insert(movementData);
        
        if (movementErr) {
          console.error('❌ خطأ في إضافة حركة نقدية:', movementErr);
        } else {
          console.debug('✅ تم إضافة حركة نقدية لمستحقات الموظف');
          
          // تحديث رصيد القاصة
          const { error: updateErr } = await supabase
            .from('cash_sources')
            .update({ current_balance: cashSource.current_balance - finalSettlementAmount })
            .eq('id', cashSource.id);
          
          if (updateErr) {
            console.error('❌ خطأ في تحديث رصيد القاصة:', updateErr);
          } else {
            console.debug('✅ تم تحديث رصيد القاصة بعد خصم مستحقات الموظف');
          }
        }
      }

      // أرشفة الطلبات بعد التسوية
      const { error: ordersErr } = await supabase
        .from('orders')
        .update({ isarchived: true })
        .in('id', orderIds);
      if (ordersErr) {
        console.error('❌ خطأ في أرشفة الطلبات:', ordersErr);
        throw ordersErr;
      }
      console.debug('✅ تم أرشفة الطلبات بنجاح');

      // تحديث الذاكرة وCache
      superAPI.invalidate('all_data');
      await fetchAllData();

      const toastDescription = deductionToApply > 0 
        ? `${employeeName || 'الموظف'} - عدد الطلبات ${orderIds.length} - المبلغ ${finalSettlementAmount.toLocaleString()} دينار (بعد خصم ${deductionToApply.toLocaleString()} د.ع)`
        : `${employeeName || 'الموظف'} - عدد الطلبات ${orderIds.length} - المبلغ ${finalSettlementAmount.toLocaleString()} دينار`;

      toast({
        title: 'تم دفع مستحقات الموظف',
        description: toastDescription,
        variant: 'success'
      });

      return { 
        success: true, 
        actualAmount: finalSettlementAmount, 
        originalAmount: actualTotalSettlement,
        deductionsApplied: deductionToApply,
        invoiceNumber 
      };
    } catch (error) {
      console.error('❌ خطأ في تسوية مستحقات الموظف:', error);
      toast({ title: 'خطأ في التسوية', description: error.message, variant: 'destructive' });
      return { success: false, error: error.message };
    }
  }, [allData.orders, user, fetchAllData]);
  // تم نقل تعريف Set للطلبات المحذوفة نهائياً إلى الأعلى لضمان التعريف قبل الاستخدام

  // دوال أخرى مطلوبة للتوافق
  const refreshOrders = useCallback(() => fetchAllData(), [fetchAllData]);
  const refreshProducts = useCallback(() => fetchAllData(), [fetchAllData]);
  const refreshAll = useCallback(async () => { superAPI.invalidate('all_data'); await fetchAllData(); }, [fetchAllData]);
  
  // تحديث فوري بدون جلب - تنظيف كاش فقط والاعتماد على Real-time
  const refreshDataInstantly = useCallback(async () => { 
    console.log('⚡ تنظيف كاش فوري - بدون جلب بيانات'); 
    superAPI.clearAll(); // تنظيف شامل للكاش فقط
    console.log('✅ تنظيف كاش مكتمل - Real-time سيحدث البيانات');
  }, []);
  // دالة مساعدة لضمان وجود created_by صالح
  const resolveCurrentUserUUID = useCallback(() => {
    // محاولة الحصول على معرف المستخدم الحالي
    const currentUserId = user?.user_id || user?.id;
    if (currentUserId) return currentUserId;
    
    // إذا لم نجد، استخدم المدير الافتراضي
    return '91484496-b887-44f7-9e5d-be9db5567604';
  }, [user]);

  // تحويل طلب ذكي إلى طلب حقيقي مباشرةً
  const approveAiOrder = useCallback(async (orderId, destination = 'local', selectedAccount = null) => {
    try {
      console.log('🚀 بدء موافقة طلب ذكي:', { orderId, destination, selectedAccount });
      
      // التأكد من وجود مستخدم صالح
      const createdBy = resolveCurrentUserUUID();
      console.log('👤 معرف المستخدم المستخدم:', createdBy);
      
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

      // إذا كان الوجهة شركة توصيل، استخدم AlWaseet مباشرة
      if (destination !== 'local') {
        console.log('🚀 إنشاء طلب شركة توصيل:', { destination, selectedAccount });
        
        // التحقق من وجود الحساب أو جلبه من التفضيلات
        let actualAccount = selectedAccount;
        let profile = null; // تعريف profile خارج try-catch
        
        if (!actualAccount) {
          console.log('⚠️ لا يوجد حساب محدد، محاولة جلبه من التفضيلات...');
          try {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('selected_delivery_account, default_customer_name')
              .eq('user_id', createdBy)
              .single();
            
            profile = profileData;
            actualAccount = profile?.selected_delivery_account;
            console.log('📋 تم جلب الحساب من التفضيلات:', actualAccount);
            console.log('👤 اسم الزبون الافتراضي:', profile?.default_customer_name);
          } catch (error) {
            console.error('❌ فشل في جلب الحساب من التفضيلات:', error);
          }
        }

        // التحقق من صحة destination
        const validDestinations = ['modon', 'alwaseet', 'local'];
        if (!validDestinations.includes(destination)) {
          console.error('❌ destination غير صالح:', destination);
          return { 
            success: false, 
            error: `وجهة توصيل غير صالحة: ${destination}. يجب أن تكون إحدى: ${validDestinations.join(', ')}` 
          };
        }

        if (!actualAccount) {
          return { 
            success: false, 
            error: `لا يوجد حساب محدد لشركة التوصيل ${destination}. يرجى تحديد حساب في إعدادات وجهة الطلب.` 
          };
        }
        
        // تطبيع اسم الحساب قبل البحث
        const rawAccount = actualAccount;
        actualAccount = actualAccount.trim().toLowerCase().replace(/\s+/g, '-');
        
        console.log('🔍 تطبيع اسم الحساب:', {
          original: rawAccount,
          normalized: actualAccount,
          destination: destination
        });
        
        // الحصول على توكن الحساب المحدد مباشرة من قاعدة البيانات
        try {
          console.log('🔄 الحصول على توكن الحساب المختار:', actualAccount);
          
          // الحصول على توكن الحساب مباشرة بدلاً من الاعتماد على تحديث السياق
          const accountData = await getTokenForUser(createdBy, actualAccount, destination);
          
          console.log('🔍 [DEBUG approveAiOrder] نتيجة getTokenForUser:', {
            requestedAccount: actualAccount,
            requestedPartner: destination,
            foundToken: !!accountData?.token,
            foundAccount: accountData?.account_username,
            foundPartner: accountData?.partner_name,
            tokenExpiry: accountData?.expires_at
          });
          
          if (!accountData?.token) {
            console.error('❌ فشل في الحصول على توكن:', {
              userId: createdBy,
              accountUsername: actualAccount,
              partnerName: destination,
              suggestion: `تحقق من وجود توكن صالح في delivery_partner_tokens لهذا المستخدم والحساب`
            });
            throw new Error(`فشل في الحصول على توكن صالح للحساب: ${actualAccount} (${destination})`);
          }
          
          console.log('✅ تم الحصول على توكن صالح للحساب:', actualAccount);
          console.log('📋 بيانات الحساب:', { 
            username: accountData.account_username,
            partner: accountData.partner_name,
            hasToken: !!accountData.token,
            expiresAt: accountData.expires_at
          });
          
          // تعيين الشريك النشط حسب الوجهة المختارة
          setActivePartner(destination === 'modon' ? 'modon' : 'alwaseet');
          
          console.log('🔍 [approveAiOrder] تفاصيل الطلب:', {
            destination,
            actualAccount,
            activePartner: destination === 'modon' ? 'modon' : 'alwaseet',
            hasToken: !!accountData?.token,
            tokenPartner: accountData?.partner_name
          });
          
          // مطابقة العناصر مع المنتجات الموجودة
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
        if (!normalizedItems.length) {
          return { success: false, error: 'لا توجد عناصر قابلة للتحويل بعد المطابقة' };
        }

        // ✅ استخدام البيانات المستخرجة من process_telegram_order مباشرة
        const extractedData = aiOrder.order_data?.extracted_data || {};
        
        // إثراء العناصر بأسماء المنتجات الفعلية
        const enrichedItems = normalizedItems.map(item => {
          const product = products.find(p => p.id === item.product_id);
          return {
            ...item,
            product_name: product?.name || 'منتج غير معروف'
          };
        });

        // إنشاء payload للوسيط - استخدام الاسم من aiOrder مباشرة
        const alwaseetPayload = {
          customer_name: aiOrder.customer_name || profile?.default_customer_name || 'زبون تليغرام',
          customer_phone: aiOrder.customer_phone,
          customer_phone2: aiOrder.customer_phone2 || null,
          customer_address: aiOrder.customer_address,
          customer_city: aiOrder.customer_city,
          customer_province: aiOrder.customer_province,
          notes: aiOrder.notes || '',
          items: enrichedItems.map(item => ({
            product_name: item.product_name,
            quantity: item.quantity,
            price: item.unit_price
          })),
          total_amount: enrichedItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
        };

        console.log('📦 إرسال طلب للوسيط:', alwaseetPayload);
        
        // جلب المدن والمناطق - تماماً كما في صفحة الطلب السريع
        console.log('🌆 جلب المدن من الوسيط...');
        const citiesData = await getCities(accountData.token);
        const cities = Array.isArray(citiesData?.data) ? citiesData.data : (Array.isArray(citiesData) ? citiesData : []);
        
        if (!cities.length) {
          throw new Error('لم يتم جلب قائمة المدن من شركة التوصيل');
        }
        
        // تطبيع النصوص العربية للبحث - نفس الطريقة الدقيقة من QuickOrderContent
        const normalizeArabic = (text) => {
          if (!text) return '';
          return text.toString().trim()
            .replace(/[أإآ]/g, 'ا')
            .replace(/[ة]/g, 'ه')
            .replace(/[ي]/g, 'ى')
            .toLowerCase()
            // إزالة كلمات التوقف
            .replace(/\b(حي|منطقة|محلة|شارع|زقاق|مقاطعة)\s*/g, '');
        };
        
        // دالة لتوليد مرشحات متعددة الكلمات للمناطق
        const generateRegionCandidates = (text) => {
          if (!text) return [];
          const words = text.split(/\s+/).filter(Boolean);
          const candidates = [];
          
          // مرشحات بأطوال مختلفة (2-3 كلمات)
          for (let len = 1; len <= Math.min(3, words.length); len++) {
            for (let start = 0; start <= words.length - len; start++) {
              const candidate = words.slice(start, start + len).join(' ');
              if (candidate.length >= 2) {
                candidates.push(candidate);
              }
            }
          }
          
        return candidates;
      };
      
      // تعريف المتغيرات مسبقاً
      let cityId = null;
      let foundCityName = null;
      let regionId = null;
      let foundRegionName = null;
      let nearestPoint = '';
      
      // ✅ إذا كان aiOrder يحتوي على region_id و resolved_region_name صحيحة، استخدمها مباشرة
      if (aiOrder.region_id && aiOrder.resolved_region_name && aiOrder.city_id && aiOrder.resolved_city_name) {
          console.log('✅ استخدام بيانات ai_orders مباشرة (صحيحة 100%):', {
            city_id: aiOrder.city_id,
            city_name: aiOrder.resolved_city_name,
            region_id: aiOrder.region_id,
            region_name: aiOrder.resolved_region_name
          });
          
          // تخطي كل المعالجة والبحث - استخدام القيم مباشرة
          cityId = aiOrder.city_id;
          foundCityName = aiOrder.resolved_city_name;
          regionId = aiOrder.region_id;
          foundRegionName = aiOrder.resolved_region_name;
          nearestPoint = extractedData.landmark || aiOrder.customer_address?.match(/قرب.*/)?.[0] || '';
          
          // الانتقال مباشرة لمرحلة تطبيع الهاتف
        } else {
          // المعالجة القديمة فقط إذا لم تكن البيانات موجودة في aiOrder
          let cityToSearch = extractedData.city || aiOrder.customer_city || '';
          let regionToSearch = extractedData.region || '';
          
          // استخراج المنطقة من customer_address إذا لم نجدها في extractedData
          if (!regionToSearch && aiOrder.customer_address) {
            // إزالة اسم المدينة من customer_address للحصول على المنطقة
            let addressWithoutCity = aiOrder.customer_address;
            if (cityToSearch) {
              addressWithoutCity = addressWithoutCity.replace(cityToSearch, '').trim();
            }
            // تنظيف المنطقة من الفواصل والشرطات
            regionToSearch = addressWithoutCity.replace(/^[-\s,]+|[-\s,]+$/g, '').trim();
          }
        
          nearestPoint = extractedData.landmark || '';
          
          console.log('📊 استخدام البيانات المستخرجة مباشرة:', {
            city: cityToSearch,
            region: regionToSearch,
            landmark: nearestPoint,
          full_address: extractedData.full_address
        });
        
        // البحث عن المدينة - تطبيق نفس المنطق من QuickOrderContent
        if (cityToSearch) {
            const searchCity = normalizeArabic(cityToSearch);
            console.log('🏙️ البحث عن المدينة:', { original: cityToSearch, normalized: searchCity });
            
            // مطابقة دقيقة أولاً
            let cityMatch = cities.find(city => normalizeArabic(city.name) === searchCity);
            
            // مطابقة جزئية إذا لم نجد مطابقة دقيقة
            if (!cityMatch) {
              cityMatch = cities.find(city => 
                normalizeArabic(city.name).includes(searchCity) ||
                searchCity.includes(normalizeArabic(city.name))
              );
            }
            
            if (cityMatch) {
              cityId = cityMatch.id;
              foundCityName = cityMatch.name;
              console.log('✅ تم العثور على المدينة:', { id: cityId, name: foundCityName });
            }
          }
          
          // إذا لم نجد المدينة، استخدم بغداد كافتراضي (نفس منطق QuickOrderContent)
          if (!cityId) {
            console.log('⚠️ لم يتم العثور على المدينة، البحث عن بغداد...');
            const baghdadCity = cities.find(city => normalizeArabic(city.name).includes('بغداد'));
            if (baghdadCity) {
              cityId = baghdadCity.id;
              foundCityName = baghdadCity.name;
              console.log('✅ استخدام بغداد كافتراضي:', foundCityName);
            } else {
              throw new Error(`لم يتم العثور على مدينة مطابقة أو بغداد. المدن المتاحة: ${cities.slice(0, 10).map(c => c.name).join(', ')}`);
            }
          }

          // جلب المناطق للمدينة المحددة
          console.log('🗺️ جلب المناطق للمدينة:', foundCityName);
          const regionsData = await getRegionsByCity(accountData.token, cityId);
          const regions = Array.isArray(regionsData?.data) ? regionsData.data : (Array.isArray(regionsData) ? regionsData : []);
          
          regionId = null;
          foundRegionName = '';
          
          if (regions.length > 0) {
            if (regionToSearch) {
              console.log('🔍 البحث عن المنطقة:', regionToSearch);
              
              // توليد جميع المرشحات المحتملة من النص
              const allCandidates = generateRegionCandidates(regionToSearch);
              let bestMatch = null;
              let bestScore = 0;
              let matchedText = '';
              
              // البحث عن أفضل مطابقة
              for (const candidate of allCandidates) {
                const normalizedCandidate = normalizeArabic(candidate);
                
                // البحث في جميع المناطق
                for (const region of regions) {
                  const normalizedRegion = normalizeArabic(region.name);
                  let score = 0;
                  
                  // مطابقة دقيقة (أعلى درجة)
                  if (normalizedRegion === normalizedCandidate) {
                    score = 100;
                  } 
                  // مطابقة تحتوي على النص كاملاً
                  else if (normalizedRegion.includes(normalizedCandidate) && normalizedCandidate.length >= 3) {
                    score = 80;
                  }
                  // مطابقة جزئية
                  else if (normalizedCandidate.includes(normalizedRegion) && normalizedRegion.length >= 3) {
                    score = 60;
                  }
                  
                  if (score > bestScore) {
                    bestScore = score;
                    bestMatch = region;
                    matchedText = candidate;
                  }
                }
              }
              
              if (bestMatch && bestScore >= 60) {
                regionId = bestMatch.id;
                foundRegionName = bestMatch.name;
                console.log('✅ تم العثور على المنطقة:', { 
                  id: regionId, 
                  name: foundRegionName, 
                  score: bestScore,
                  matchedText 
                });
                
                // حساب نقطة الدلالة المتبقية
                const remainingText = regionToSearch.replace(matchedText, '').trim();
                if (remainingText.length >= 3) {
                  nearestPoint = remainingText;
                  console.log('📍 نقطة الدلالة:', nearestPoint);
                }
              } else {
                console.log('⚠️ لم يتم العثور على مطابقة جيدة للمنطقة');
              }
            }
            
            // إذا لم نجد المنطقة، استخدم أول منطقة متاحة فقط إذا لم يكن هناك نص منطقة محدد
            if (!regionId && !regionToSearch) {
              regionId = regions[0].id;
              foundRegionName = regions[0].name;
              console.log('⚠️ استخدام أول منطقة متاحة (لعدم وجود نص منطقة):', foundRegionName);
            } else if (!regionId && regionToSearch) {
              console.log('⚠️ لم يتم العثور على مطابقة للمنطقة، ترك المنطقة غير محددة لتجنب الخطأ');
            }
          }
          
          // لا نفشل العملية إذا لم نجد منطقة، بدلاً من ذلك نستخدم المدينة فقط
          if (!regionId && regions.length > 0) {
            regionId = regions[0].id;
            foundRegionName = regions[0].name;
            console.log('⚠️ فشل تحديد المنطقة، استخدام المنطقة الافتراضية:', foundRegionName);
          }
        } // نهاية else للمعالجة القديمة

        // تطبيع رقم الهاتف - نفس الطريقة من QuickOrderContent
        const { normalizePhone } = await import('../utils/phoneUtils.js');
        const normalizedPhone = normalizePhone(aiOrder.customer_phone);
        if (!normalizedPhone) {
          throw new Error('رقم الهاتف غير صحيح');
        }

        // بناء type_name بنفس طريقة QuickOrderContent - اسم المنتج + اللون + المقاس
        const productNames = enrichedItems.map(item => {
          const product = products.find(p => p.id === item.product_id);
          const variants = product?.variants || product?.product_variants || [];
          const variant = variants.find(v => v.id === item.variant_id);
          
          let displayName = item.product_name;
          const color = variant?.color || variant?.color_name || variant?.colors?.name;
          const size = variant?.size || variant?.size_name || variant?.sizes?.name;
          
          // تركيب الاسم: المنتج + اللون + المقاس (تماماً كما في QuickOrderContent)
          if (color) displayName += ` ${color}`;
          if (size) displayName += ` ${size}`;
          
          return displayName;
        }).filter(Boolean).join(' + ');

        // حساب السعر مع رسوم التوصيل (مطابق لـ QuickOrderContent)
        const subtotalPrice = enrichedItems.reduce((sum, item) => sum + ((item.quantity || 1) * (item.unit_price || 0)), 0);
        
        // جلب رسوم التوصيل من الإعدادات
        let deliveryFee = 5000; // القيمة الافتراضية
        try {
          const { data: ds } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'delivery_fee')
            .maybeSingle();
          deliveryFee = Number(ds?.value) || 5000;
        } catch (_) {}

        const finalPrice = subtotalPrice + deliveryFee; // السعر النهائي مع رسوم التوصيل

        // إعداد payload الوسيط - نفس البنية من QuickOrderContent مع ملاحظات فارغة لطلبات التليغرام
        const updatedPayload = {
          city_id: parseInt(cityId),
          region_id: parseInt(regionId),
          // ✅ استخدام اسم الزبون من الطلب الذكي مباشرة، ثم الافتراضي من الإعدادات
          client_name: aiOrder.customer_name || profile?.default_customer_name || 'زبون تليغرام',
          client_mobile: normalizedPhone,
          client_mobile2: aiOrder.customer_phone2 || '',
          // ✅ استخدام customer_address مباشرة - يحتوي فقط على أقرب نقطة دالة
          location: aiOrder.customer_address || nearestPoint || '',
          type_name: productNames, // أسماء المنتجات كاملة مع الألوان والمقاسات
          items_number: enrichedItems.reduce((sum, item) => sum + (item.quantity || 1), 0),
          price: aiOrder.total_amount || finalPrice, // ✅ استخدام total_amount من الذكاء الاصطناعي (يشمل الخصم/الزيادة)
          package_size: 1,
          merchant_notes: aiOrder.notes || '', // ✅ إرسال ملاحظات الطلب الذكي إلى شركة التوصيل
          replacement: 0
        };

        const partnerName = destination === 'modon' ? 'مدن' : 'الوسيط';
        console.log(`📋 بيانات الطلب النهائية المرسلة لـ ${partnerName}:`, updatedPayload);
        console.log(`💰 السعر المرسل لـ ${partnerName}:`, aiOrder.total_amount || finalPrice, '(AI Order total_amount:', aiOrder.total_amount, ', Calculated finalPrice:', finalPrice, ')');

        // إنشاء الطلب في شركة التوصيل - اختيار API حسب الوجهة
        let alwaseetResult;
        if (destination === 'modon') {
          const ModonAPI = await import('../lib/modon-api.js');
          alwaseetResult = await ModonAPI.createModonOrder(updatedPayload, accountData.token);
        } else {
          const { createAlWaseetOrder: createAlWaseetOrderApi } = await import('../lib/alwaseet-api.js');
          alwaseetResult = await createAlWaseetOrderApi(updatedPayload, accountData.token);
        }
        
        console.log('📦 استجابة الوسيط الكاملة:', alwaseetResult);
        
        // معالجة qr_id - الآن من المفترض أن يحتوي على qr_id من التحسينات
        let qrId = alwaseetResult?.qr_id || alwaseetResult?.id;
        let orderId = alwaseetResult?.id || qrId;
        
        // Smart retry if qr_id is still missing - 3 attempts with proper delays
        if (!qrId || qrId === 'undefined' || qrId === 'null') {
          console.log('⚠️ لم نحصل على qr_id صحيح، محاولة smart retry...');
          const maxRetries = 3;
          const delayBetweenRetries = 1500; // 1.5 seconds
          
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              console.log(`🔄 محاولة ${attempt}/${maxRetries} للحصول على qr_id...`);
              await new Promise(resolve => setTimeout(resolve, delayBetweenRetries));
              
              // استخدام API الصحيح حسب شركة التوصيل
              let recentOrders;
              if (destination === 'modon') {
                const ModonAPI = await import('../lib/modon-api.js');
                recentOrders = await ModonAPI.getMerchantOrders(accountData.token);
              } else {
                const { getMerchantOrders } = await import('../lib/alwaseet-api.js');
                recentOrders = await getMerchantOrders(accountData.token);
              }
              
              // Advanced matching: by phone (last 10 digits), price, and recent creation
              const customerPhoneLast10 = (normalizedPhone || '').replace(/\D/g, '').slice(-10);
              const candidates = recentOrders.filter(order => {
                const orderPhone = (order?.client_mobile || '').replace(/\D/g, '').slice(-10);
                return orderPhone === customerPhoneLast10;
              });
              
              // Try exact price match first, then recent order
              let matchingOrder = candidates.find(order => parseInt(order?.price) === finalPrice);
              if (!matchingOrder && candidates.length > 0) {
                // Sort by creation time and take the most recent
                matchingOrder = candidates.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0];
              }
              
              if (matchingOrder) {
                qrId = matchingOrder.qr_id || matchingOrder.tracking_number || matchingOrder.id;
                orderId = matchingOrder.id || orderId;
                console.log(`✅ تم استخراج qr_id في المحاولة ${attempt}:`, { qrId, orderId });
                break;
              }
              
              console.log(`⚠️ لم يتم العثور على طلب مطابق في المحاولة ${attempt}`);
            } catch (retryError) {
              console.warn(`❌ فشل في المحاولة ${attempt}:`, retryError.message);
            }
            
            // If last attempt fails, log the issue
            if (attempt === maxRetries) {
              console.error('❌ فشل في جميع المحاولات للحصول على qr_id');
            }
          }
        }
        
        if (!qrId || qrId === 'undefined' || qrId === 'null') {
          throw new Error('فشل في الحصول على رقم التتبع من شركة التوصيل بعد عدة محاولات');
        }

        console.log('🔍 qr_id المستخرج:', qrId);
        console.log('✅ تم إنشاء طلب الوسيط بنجاح:', { qrId, orderId: alwaseetResult.id });

        // إنشاء الطلب المحلي مع ربطه بشركة التوصيل - استخدام orderId بدلاً من qrId
        return await createLocalOrderWithDeliveryPartner(aiOrder, enrichedItems, aiOrder.id, {
          delivery_partner: destination === 'modon' ? 'modon' : 'alwaseet',
          delivery_partner_order_id: String(orderId || qrId),
          qr_id: qrId,
          tracking_number: qrId,
          delivery_account_used: actualAccount,
          alwaseet_city_id: parseInt(cityId),
          alwaseet_region_id: parseInt(regionId)
        }, foundCityName, foundRegionName);
      } catch (err) {
        console.error('❌ فشل في إنشاء طلب شركة التوصيل:', err);
        return { success: false, error: `فشل في إنشاء طلب شركة التوصيل: ${err.message}` };
      }
      }

      // 2) إنشاء طلب محلي - مطابقة عناصر الطلب الذكي مع المنتجات والمتغيرات الفعلية
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

      return await createLocalOrder(aiOrder, normalizedItems, aiOrder.id);
    } catch (err) {
      console.error('❌ فشل تحويل الطلب الذكي:', err);
      return { success: false, error: err.message };
    }
  }, [user, allData.products, activateAccount, createAlWaseetOrder, alwaseetToken, setActivePartner]);

  // دالة إنشاء طلب محلي
  const createLocalOrder = useCallback(async (aiOrder, normalizedItems, orderId, cityName = null, regionName = null) => {
    return await createLocalOrderWithDeliveryPartner(aiOrder, normalizedItems, orderId, {
      delivery_partner: 'محلي',
      delivery_account_used: 'local'
    }, cityName, regionName);
  }, []);

  // دالة إنشاء طلب محلي مع دعم شركة التوصيل
  const createLocalOrderWithDeliveryPartner = useCallback(async (aiOrder, normalizedItems, orderId, deliveryPartnerData = {}, cityName = null, regionName = null) => {
    try {

      // إنشاء رقم طلب
      const { data: orderNumber, error: numErr } = await supabase.rpc('generate_order_number');
      if (numErr) throw numErr;

      // حجز المخزون لكل عنصر مع إمكانية التراجع
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

      // حساب المجاميع مع رسوم التوصيل الحقيقية
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
      
      // ✅ معالجة الخصم/الزيادة من ai_orders
      let discount = 0;
      let priceAdjustment = Number(aiOrder.price_adjustment || 0);
      let adjustmentType = aiOrder.adjustment_type;
      
      console.log('💰 معالجة التعديل السعري:', { 
        subtotal, 
        priceAdjustment, 
        adjustmentType,
        written_total_amount: aiOrder.written_total_amount,
        calculated_total_amount: aiOrder.calculated_total_amount
      });
      
      // في حالة الخصم: نحفظه كخصم منفصل
      if (adjustmentType === 'discount' && priceAdjustment < 0) {
        discount = Math.abs(priceAdjustment);
        console.log('🎁 تطبيق خصم:', discount);
      }
      // في حالة الزيادة: لا نعمل شيء هنا، سيتم معالجتها في حساب الأرباح
      else if (adjustmentType === 'markup' && priceAdjustment > 0) {
        console.log('📈 سيتم توزيع الزيادة على الأرباح:', priceAdjustment);
      }
      
      const total = subtotal - discount + deliveryFee;

      // إنشاء طلب حقيقي مع دعم شركة التوصيل
      const trackingNumber = deliveryPartnerData.tracking_number || `RYUS-${Date.now().toString().slice(-6)}`;
      
      // ✅ دالة لتنظيف العنوان واستخراج فقط جزء "قرب"
      const cleanAddress = (address) => {
        if (!address) return '';
        const qarabIndex = address.indexOf('قرب');
        if (qarabIndex !== -1) {
          return address.substring(qarabIndex).trim();
        }
        return address.trim();
      };

      // ✅ استخدام البيانات المستخرجة من extractedData
      const extractedData = aiOrder.order_data?.extracted_data || {};
      const orderRow = {
        order_number: orderNumber,
        // ✅ استخدام اسم الزبون المستخرج
        customer_name: extractedData.customer_name || aiOrder.customer_name,
        customer_phone: aiOrder.customer_phone,
        customer_phone2: aiOrder.customer_phone2 || null,
        // ✅ استخدام nearestPoint كعنوان أساسي
        customer_address: aiOrder.customer_address || 'غير محدد',
        customer_city: cityName || aiOrder.resolved_city_name || aiOrder.customer_city || extractedData.city,
        // ✅ الأولوية المطلقة لـ resolved_region_name من ai_orders (بدون nearestPoint)
        customer_province: aiOrder.resolved_region_name || regionName || extractedData.region,
        // 🎯 إعطاء الأولوية لبيانات الوسيط ثم aiOrder كاحتياطي
        alwaseet_city_id: deliveryPartnerData?.alwaseet_city_id || aiOrder.city_id,
        alwaseet_region_id: deliveryPartnerData?.alwaseet_region_id || aiOrder.region_id,
        total_amount: subtotal,
        discount,
      delivery_fee: deliveryFee,
      final_amount: total,
      status: 'pending',
      delivery_status: deliveryPartnerData.delivery_partner === 'alwaseet' ? '1' : 'pending',
      payment_status: 'pending',
      tracking_number: trackingNumber,
      delivery_partner: deliveryPartnerData.delivery_partner || 'محلي',
      delivery_partner_order_id: deliveryPartnerData.delivery_partner_order_id || null,
      qr_id: deliveryPartnerData.qr_id || null,
      delivery_account_used: deliveryPartnerData.delivery_account_used || 'local',
      notes: '', // ملاحظات فارغة دائماً لطلبات التليغرام
        created_by: resolveCurrentUserUUID(),
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

      // إدراج عناصر الطلب
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

      // ✅ تطبيق الخصم في applied_customer_discounts إذا كان موجوداً
      if (discount > 0) {
        console.log('💾 حفظ الخصم في applied_customer_discounts:', discount);
        try {
          await supabase.from('applied_customer_discounts').insert({
            order_id: createdOrder.id,
            discount_amount: discount,
            discount_type: 'custom_price',
            notes: `خصم من السعر المكتوب (${aiOrder.written_total_amount} بدلاً من ${aiOrder.calculated_total_amount})`,
            applied_by: resolveCurrentUserUUID()
          });
        } catch (discountErr) {
          console.warn('⚠️ فشل حفظ الخصم:', discountErr);
        }
      }
      
      // ✅ معالجة الزيادة حسب قواعد أرباح الموظف
      if (adjustmentType === 'markup' && priceAdjustment > 0) {
        console.log('📈 معالجة الزيادة:', priceAdjustment);
        
        // التحقق من وجود قاعدة ربح للموظف لأي من المنتجات في الطلب
        const employeeId = aiOrder.created_by || resolveCurrentUserUUID();
        let hasEmployeeProfitRule = false;
        
        try {
          // البحث عن قاعدة ربح للموظف لأي من منتجات الطلب
          const productIds = normalizedItems.map(it => it.product_id);
          const { data: profitRules } = await supabase
            .from('employee_profit_rules')
            .select('*')
            .eq('employee_id', employeeId)
            .eq('is_active', true)
            .in('target_id', productIds);
          
          hasEmployeeProfitRule = profitRules && profitRules.length > 0;
          
          console.log('🔍 نتيجة البحث عن قواعد الأرباح:', { 
            employeeId, 
            hasEmployeeProfitRule,
            productIds 
          });
          
          // حفظ معلومة الزيادة في order_discounts كرصيد إضافي
          // سيتم توزيعها على الأرباح عند حساب الأرباح
          await supabase.from('order_discounts').insert({
            order_id: createdOrder.id,
            amount: -priceAdjustment, // سالب لأنها زيادة وليست خصم
            type: hasEmployeeProfitRule ? 'employee_markup' : 'system_markup',
            notes: `زيادة سعر (${aiOrder.written_total_amount} بدلاً من ${aiOrder.calculated_total_amount}) - ${hasEmployeeProfitRule ? 'ستُضاف لربح الموظف' : 'ستُضاف لربح النظام'}`,
            applied_by: resolveCurrentUserUUID()
          });
          
          console.log(`✅ تم حفظ الزيادة كـ ${hasEmployeeProfitRule ? 'employee_markup' : 'system_markup'}`);
        } catch (markupErr) {
          console.warn('⚠️ فشل حفظ معلومة الزيادة:', markupErr);
        }
      }

      // حذف الطلب الذكي بأمان مع الربط
      await deleteAiOrderWithLink(orderId, createdOrder.id);

      // تحديث الذاكرة - إزالة الطلب الذكي وإضافة الطلب الجديد مباشرة
      setAllData(prev => {
        // تطبيع الطلب الجديد
        const normalizedNewOrder = normalizeOrder(createdOrder, prev.users);
        return {
          ...prev,
          aiOrders: (prev.aiOrders || []).filter(o => o.id !== orderId),
          orders: [normalizedNewOrder, ...(prev.orders || []).filter(o => o.id !== createdOrder.id)]
        };
      });

      // إطلاق حدث للمكونات المستمعة
      window.dispatchEvent(new CustomEvent('orderCreated', { detail: createdOrder }));

      // إبطال الكاش
      superAPI.invalidate('all_data');

      const method = deliveryPartnerData.delivery_partner === 'alwaseet' ? 'alwaseet' : 'local';
      console.log(`✅ تم تحويل الطلب الذكي بنجاح - ${method}:`, { 
        orderId: createdOrder.id, 
        trackingNumber,
        deliveryPartner: deliveryPartnerData.delivery_partner,
        deliveryPartnerId: deliveryPartnerData.delivery_partner_order_id 
      });
      return { 
        success: true, 
        orderId: createdOrder.id, 
        trackingNumber, 
        method,
        deliveryPartnerOrderId: deliveryPartnerData.delivery_partner_order_id 
      };

    } catch (err) {
      console.error('❌ فشل تحويل الطلب الذكي:', err);
      return { success: false, error: err.message };
    }
  }, [resolveCurrentUserUUID, allData.products]);

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
        // فحص وجود قاعدة مماثلة
        const { data: existingRules } = await supabase
          .from('employee_profit_rules')
          .select('id')
          .eq('employee_id', employeeId)
          .eq('rule_type', ruleData.rule_type)
          .eq('target_id', ruleData.target_id)
          .eq('is_active', true);

        if (existingRules && existingRules.length > 0) {
          // تحديث القاعدة الموجودة
          const { error } = await supabase
            .from('employee_profit_rules')
            .update({
              profit_amount: ruleData.profit_amount,
              profit_percentage: ruleData.profit_percentage,
            })
            .eq('id', existingRules[0].id);
          
          if (error) throw error;
        } else {
          // إضافة قاعدة جديدة - بدون created_by
          const { error } = await supabase
            .from('employee_profit_rules')
            .insert({
              employee_id: employeeId,
              rule_type: ruleData.rule_type,
              target_id: ruleData.target_id,
              profit_amount: ruleData.profit_amount,
              profit_percentage: ruleData.profit_percentage,
              is_active: true
            });
          
          if (error) throw error;
        }
      }

      // تحديث البيانات المحلية - مسح الكاش أولاً لضمان جلب البيانات الجديدة
      superAPI.invalidate('all_data');
      await fetchAllData();
      
      return { success: true };
    } catch (error) {
      console.error('❌ خطأ في تعديل قاعدة الربح:', error);
      
      // رسائل خطأ واضحة
      let errorMessage = 'فشل في حفظ قاعدة الربح';
      if (error.message?.includes('duplicate')) {
        errorMessage = 'توجد قاعدة ربح مماثلة بالفعل لهذا الموظف';
      } else if (error.message?.includes('foreign key')) {
        errorMessage = 'معرف الموظف أو المنتج غير صحيح';
      }
      
      throw new Error(errorMessage);
    }
  }, [fetchAllData]);

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
    settleEmployeeProfits: settleEmployeeProfits || (async () => ({ success: false })),
    refreshOrders: refreshOrders || (() => {}),
    refreshProducts: refreshProducts || (() => {}),
    refetchProducts: refreshProducts || (() => {}),
    refreshAll: refreshAll || (async () => {}),
    refreshDataInstantly: refreshDataInstantly || (async () => {}),
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
    deleteProducts: async (productIds) => {
      if (!productIds || (Array.isArray(productIds) && productIds.length === 0)) {
        console.error('❌ SuperProvider: لا توجد منتجات محددة للحذف');
        return { success: false, error: 'لا توجد منتجات محددة للحذف' };
      }

      const idsArray = Array.isArray(productIds) ? productIds : [productIds];
      console.log('🗑️ SuperProvider: بدء حذف المنتجات:', idsArray);
      
      // الحذف الفوري من الواجهة (optimistic update)
      setAllData(prev => ({
        ...prev,
        products: prev.products.filter(p => !idsArray.includes(p.id))
      }));
      
      try {
        const res = await dbDeleteProducts(idsArray);
        
        if (res?.success || res?.data || !res?.error) {
          console.log('✅ SuperProvider: تم الحذف بنجاح من قاعدة البيانات');
          
          // إضافة إشعار للحذف الناجح
          if (addNotification) {
            addNotification({
              title: 'تم الحذف بنجاح',
              message: `تم حذف ${idsArray.length} منتج بنجاح`,
              type: 'success'
            });
          }
          
          return { success: true };
        } else {
          console.error('❌ SuperProvider: فشل الحذف من قاعدة البيانات:', res);
          
          // استعادة المنتجات في حالة الفشل
          await fetchAllData();
          
          return { success: false, error: res?.error || 'فشل في الحذف' };
        }
      } catch (error) {
        console.error('❌ SuperProvider: خطأ في حذف المنتجات:', error);
        
        // استعادة المنتجات في حالة الخطأ
        await fetchAllData();
        
        return { success: false, error: error.message };
      }
    },
    updateVariantStock: async (...args) => {
      // ⚡ التحديث الفوري: useProducts يحدّث الحالة محلياً + Realtime يحدّث باقي الأجهزة
      // لا نحتاج fetchAllData (كان يسبب تأخير 2-3 ثوانٍ)
      const res = await dbUpdateVariantStock(...args);
      return res;
    },
    getLowStockProducts: dbGetLowStockProducts,

    // تبديل الظهور الفوري
    toggleProductVisibility,
    
    // وظائف حساب الأرباح الحقيقية - دعم إما عنصر واحد أو طلب كامل
    calculateProfit: (orderOrItem, employeeId = null) => {
      // إذا تم تمرير عنصر واحد مع معرف الموظف
      // دعم كلا الصيغتين: productId (camelCase) و product_id (snake_case)
      const itemProductId = orderOrItem.productId || orderOrItem.product_id;
      if (employeeId && itemProductId) {
        const item = orderOrItem;
        const employeeProfitRules = allData.employeeProfitRules || [];
        
        // البحث عن قاعدة ربح مطابقة مع التحقق من التاريخ
        const rule = employeeProfitRules.find(r => 
          r.employee_id === employeeId && 
          r.is_active === true &&
          (
            (r.rule_type === 'product' && r.target_id === itemProductId) ||
            (r.rule_type === 'variant' && r.target_id === (item.sku || item.variant_id))
          ) &&
          // القاعدة يجب أن تكون موجودة قبل إنشاء الطلب
          new Date(r.created_at) <= new Date(item.orderDate || item.created_at || Date.now())
        );
        
        if (rule) {
          if (rule.profit_amount) {
            return rule.profit_amount * (item.quantity || 1);
          } else if (rule.profit_percentage) {
            const itemRevenue = (item.price || item.unit_price || 0) * (item.quantity || 1);
            return (itemRevenue * rule.profit_percentage / 100);
          }
        }
        return 0;
      }
      
      // إذا تم تمرير طلب كامل
      const order = orderOrItem;
      if (!order || !order.items) return 0;
      
      // البحث عن قاعدة الربح للموظف
      const employeeProfitRules = allData.employeeProfitRules || [];
      const orderEmployeeId = order.created_by;
      
      let totalEmployeeProfit = 0;
      
      order.items.forEach(item => {
        // محاولة الحصول على product_id من variant_id إذا لم يكن موجود
        let productId = item.product_id;
        if (!productId && item.sku) {
          const variant = getVariantDetails(item.sku);
          productId = variant?.product_id;
        }
        
        if (!productId) return;
        
        // البحث عن قاعدة ربح مطابقة مع التحقق من التاريخ
        const rule = employeeProfitRules.find(r => 
          r.employee_id === orderEmployeeId && 
          r.is_active === true &&
          (
            (r.rule_type === 'product' && r.target_id === productId) ||
            (r.rule_type === 'variant' && r.target_id === item.sku)
          ) &&
          // القاعدة يجب أن تكون موجودة قبل إنشاء الطلب
          new Date(r.created_at) <= new Date(order.created_at)
        );
        
        if (rule) {
          if (rule.profit_amount) {
            totalEmployeeProfit += rule.profit_amount * item.quantity;
          } else if (rule.profit_percentage) {
            const itemRevenue = item.price * item.quantity;
            totalEmployeeProfit += (itemRevenue * rule.profit_percentage / 100);
          }
        }
      });
      
      // خصم الخصومات التي تؤثر على ربح الموظف
      const orderDiscounts = allData.orderDiscounts || [];
      const relevantDiscounts = orderDiscounts.filter(d => 
        d.order_id === order.id && d.affects_employee_profit === true
      );
      const totalEmployeeDiscounts = relevantDiscounts.reduce((sum, d) => sum + (d.discount_amount || 0), 0);
      
      return Math.max(0, totalEmployeeProfit - totalEmployeeDiscounts);
    },
    
    calculateManagerProfit: (order) => {
      if (!order || !order.items) return 0;
      
      // حساب ربح الموظف مباشرة
      const employeeProfitRules = allData.employeeProfitRules || [];
      const employeeId = order.created_by;
      
      let totalEmployeeProfit = 0;
      
      order.items.forEach(item => {
        let productId = item.product_id;
        if (!productId && item.sku) {
          const variant = getVariantDetails(item.sku);
          productId = variant?.product_id;
        }
        
        if (!productId) return;
        
        const rule = employeeProfitRules.find(r => 
          r.employee_id === employeeId && 
          r.is_active === true &&
          (
            (r.rule_type === 'product' && r.target_id === productId) ||
            (r.rule_type === 'variant' && r.target_id === item.sku)
          ) &&
          // القاعدة يجب أن تكون موجودة قبل إنشاء الطلب
          new Date(r.created_at) <= new Date(order.created_at)
        );
        
        if (rule) {
          if (rule.profit_amount) {
            totalEmployeeProfit += rule.profit_amount * item.quantity;
          } else if (rule.profit_percentage) {
            const itemRevenue = item.price * item.quantity;
            totalEmployeeProfit += (itemRevenue * rule.profit_percentage / 100);
          }
        }
      });
      
      // خصم الخصومات التي تؤثر على ربح الموظف
      const orderDiscounts = allData.orderDiscounts || [];
      const relevantDiscounts = orderDiscounts.filter(d => 
        d.order_id === order.id && d.affects_employee_profit === true
      );
      const totalEmployeeDiscounts = relevantDiscounts.reduce((sum, d) => sum + (d.discount_amount || 0), 0);
      const employeeProfit = Math.max(0, totalEmployeeProfit - totalEmployeeDiscounts);
      
      // حساب الإيراد الإجمالي - sales_amount هو المبيعات بدون رسوم التوصيل
      const revenueWithoutDelivery = Number(order.sales_amount || 0) > 0 
        ? Number(order.sales_amount) // sales_amount هو القيمة الصافية بدون رسوم التوصيل
        : Number(order.final_amount || order.total_amount || 0) - Number(order.delivery_fee || 0);
      
      // حساب التكلفة الإجمالية
      const totalCost = order.items.reduce((sum, item) => sum + ((item.cost_price || 0) * (item.quantity || 0)), 0);
      
      // الربح الإجمالي = الإيراد بعد الخصم - التكلفة
      const totalProfit = revenueWithoutDelivery - totalCost;
      
      // ربح الإدارة = الربح الإجمالي - ربح الموظف
      return Math.max(0, totalProfit - employeeProfit);
    },
    
    // وظائف قواعد أرباح الموظفين
    employeeProfitRules: allData.employeeProfitRules || [],
    getEmployeeProfitRules,
    setEmployeeProfitRule,

    // دالة تحديث الإعدادات
    updateSettings: async (newSettings) => {
      try {
        console.log('🔧 SuperProvider: تحديث الإعدادات:', newSettings);
        
        // تحديث كل إعداد في قاعدة البيانات
        for (const [key, value] of Object.entries(newSettings)) {
          const { error } = await supabase
            .from('settings')
            .upsert({ 
              key, 
              value: typeof value === 'object' ? JSON.stringify(value) : String(value) 
            });
          
          if (error) {
            console.error(`❌ خطأ في تحديث الإعداد ${key}:`, error);
            throw error;
          }
        }

        // تحديث الحالة المحلية
        setAllData(prev => ({
          ...prev,
          settings: {
            ...prev.settings,
            ...newSettings
          }
        }));

        console.log('✅ تم تحديث الإعدادات بنجاح');
        return { success: true };
      } catch (error) {
        console.error('❌ فشل في تحديث الإعدادات:', error);
        return { success: false, error: error.message };
      }
    },

    // دالة الحصول على تفاصيل المتغير للحجز
    getVariantDetails,

    // دالة حذف المصروف - الـ trigger في قاعدة البيانات يتكفل بالحركة العكسية تلقائياً
    deleteExpense: async (expenseId) => {
      try {
        console.log('🗑️ حذف المصروف:', expenseId);
        
        // حذف المصروف فقط - الـ trigger يُنشئ حركة إرجاع تلقائياً
        const { error: deleteError } = await supabase
          .from('expenses')
          .delete()
          .eq('id', expenseId);
        
        if (deleteError) throw deleteError;
        
        // تحديث البيانات المحلية
        setAllData(prev => ({
          ...prev,
          accounting: {
            ...prev.accounting,
            expenses: prev.accounting?.expenses?.filter(e => e.id !== expenseId) || []
          }
        }));
        
        // إعادة تحميل البيانات من قاعدة البيانات
        superAPI.invalidate('all_data');
        await fetchAllData();
        
        toast({
          title: "تم الحذف بنجاح",
          description: "تم حذف المصروف وإرجاع المبلغ للقاصة"
        });
        
        return { success: true };
      } catch (error) {
        console.error('❌ فشل في حذف المصروف:', error);
        toast({
          title: "خطأ في الحذف",
          description: error.message,
          variant: "destructive"
        });
        throw error;
      }
    },

    // دالة طلب التسوية - ربط مع ProfitsContext
    requestProfitSettlement: async (orderIds, notes = '') => {
      try {
        console.log('🏦 SuperProvider: طلب تسوية الأرباح:', { orderIds, notes });
        
        if (!orderIds || orderIds.length === 0) {
          throw new Error('يجب تحديد طلبات للتحاسب');
        }

        // استخدام دالة createSettlementRequest من ProfitsContext
        const result = await profitsCreateSettlement(orderIds, notes);
        
        if (result) {
          console.log('✅ تم إرسال طلب التسوية بنجاح');
          return result;
        } else {
          throw new Error('فشل في إرسال طلب التسوية');
        }
      } catch (error) {
        console.error('❌ خطأ في طلب التسوية:', error);
        toast({
          title: "خطأ في طلب التسوية",
          description: error.message,
          variant: "destructive"
        });
        throw error;
      }
    },

    // للتوافق مع الألوان والأحجام
    colors: allData.colors || [],
    sizes: allData.sizes || [],
  };

  // ⚡ تم إزالة console.log المتكرر لتحسين الأداء
  // في Development فقط: devLog.log('🔍 SuperProvider contextValue:', {...});

  return (
    <SuperContext.Provider value={contextValue}>
      {children}
    </SuperContext.Provider>
  );
};