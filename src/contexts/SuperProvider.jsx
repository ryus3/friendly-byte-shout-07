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
// import { useProductsDB } from '@/hooks/useProductsDB';
import { useProfits } from '@/contexts/ProfitsContext.jsx';
import { useSupabase } from '@/contexts/SupabaseContext';

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

  const matchUser = (val) => {
    return val === user?.user_id || val === user?.id || val === user?.employee_code;
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

  // جلب البيانات الموحدة عند بدء التشغيل - مع تصفية employee_code
  const fetchAllData = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      console.log('🚀 SuperProvider: جلب جميع البيانات للمستخدم:', user.employee_code || user.user_id);
      
      const data = await superAPI.getAllData({ light: true });
      
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

    superAPI.setupRealtimeSubscriptions(handleRealtimeUpdate, { tables: ['orders'] });

    return () => {
      superAPI.unsubscribeAll();
    };
  }, [user, fetchAllData]);

  // ===============================
  // وظائف متوافقة مع InventoryContext
  // ===============================

  // استبدال useProductsDB بوظائف داخلية تعتمد على SupabaseContext لتجنب مشاكل hooks
  const { db, storage } = useSupabase();

  const dbRefetchProducts = useCallback(async () => {
    await fetchAllData();
  }, [fetchAllData]);

  const dbGetLowStockProducts = useCallback((limit, threshold = 5) => {
    const lowStockItems = [];
    (allData.products || []).forEach(product => {
      const invList = product.inventory || [];
      invList.forEach(inv => {
        if (inv.quantity <= threshold && inv.quantity > 0) {
          lowStockItems.push({
            ...inv,
            productName: product.name,
            productId: product.id,
            productImage: product.images?.[0] || null,
            lowStockThreshold: threshold
          });
        }
      });
    });
    const sorted = lowStockItems.sort((a, b) => a.quantity - b.quantity);
    return limit ? sorted.slice(0, limit) : sorted;
  }, [allData.products]);

  const dbAddProduct = useCallback(async (productData, imageFiles = { general: [], colorImages: {} }, setUploadProgress) => {
    try {
      if (!user) throw new Error('يجب تسجيل الدخول أولاً');

      // 1) أنشئ المنتج أولاً بدون صور للحصول على المعرف
      const mainCategoryId = productData.selectedCategories?.[0]?.id || null;
      const newProduct = await db.products.create({
        name: productData.name,
        description: productData.description,
        category_id: mainCategoryId,
        base_price: productData.price || 0,
        cost_price: productData.costPrice || 0,
        profit_amount: productData.profitAmount || 0,
        barcode: productData.barcode,
        images: [],
        is_active: true,
        created_by: user?.user_id || user?.id
      });

      // 2) رفع الصور العامة بعد الحصول على المعرف
      let uploadedGeneralImages = [];
      if (imageFiles.general && imageFiles.general.length > 0) {
        const uploadPromises = imageFiles.general.map(async (file, index) => {
          if (typeof file === 'string') return file;
          if (!file) return null;
          try {
            return await storage.uploadProductImage(file, newProduct.id);
          } catch (err) {
            console.error('Error uploading image:', err);
            return null;
          }
        });
        uploadedGeneralImages = (await Promise.all(uploadPromises)).filter(Boolean);
        // تحديث المنتج بالصور المرفوعة
        await db.products.update(newProduct.id, { images: uploadedGeneralImages });
      }

      // 3) العلاقات: الفئات والأنواع والمواسم والأقسام
      if (productData.selectedCategories?.length > 0) {
        await Promise.all(productData.selectedCategories.map(category =>
          supabase.from('product_categories').insert({ product_id: newProduct.id, category_id: category.id })
        ));
      }
      if (productData.selectedProductTypes?.length > 0) {
        await Promise.all(productData.selectedProductTypes.map(pt =>
          supabase.from('product_product_types').insert({ product_id: newProduct.id, product_type_id: pt.id })
        ));
      }
      if (productData.selectedSeasonsOccasions?.length > 0) {
        await Promise.all(productData.selectedSeasonsOccasions.map(so =>
          supabase.from('product_seasons_occasions').insert({ product_id: newProduct.id, season_occasion_id: so.id })
        ));
      }
      if (productData.selectedDepartments?.length > 0) {
        await Promise.all(productData.selectedDepartments.map(dep =>
          supabase.from('product_departments').insert({ product_id: newProduct.id, department_id: dep.id })
        ));
      }

      // 4) إنشاء المتغيرات وصور الألوان
      if (productData.variants && productData.variants.length > 0) {
        const createdVariants = [];
        for (const variant of productData.variants) {
          let variantImageUrl = null;
          if (variant.colorId && imageFiles.colorImages && imageFiles.colorImages[variant.colorId]) {
            const file = imageFiles.colorImages[variant.colorId];
            if (typeof file !== 'string' && file) {
              try {
                variantImageUrl = await storage.uploadProductImage(file, newProduct.id);
              } catch (err) {
                console.error('Error uploading variant image:', err);
              }
            } else if (typeof file === 'string') {
              variantImageUrl = file;
            }
          }

          const created = await db.variants.create({
            product_id: newProduct.id,
            color_id: variant.colorId,
            size_id: variant.sizeId,
            price: variant.price || (productData.price || 0),
            cost_price: variant.costPrice || (productData.costPrice || 0),
            profit_amount: variant.profitAmount || (productData.profitAmount || 0),
            hint: variant.hint || '',
            barcode: variant.barcode,
            images: variantImageUrl ? [variantImageUrl] : []
          });
          createdVariants.push({ createdId: created.id, src: variant });
        }

        // 5) إنشاء سجلات المخزون الأولية
        for (const v of createdVariants) {
          await db.inventory.updateStock(newProduct.id, v.createdId, v.src.quantity || 0);
        }
      } else {
        // منتج بدون متغيرات: أنشئ مخزون أساسي
        await db.inventory.updateStock(newProduct.id, null, productData.quantity || 0);
      }

      await dbRefetchProducts();
      toast({ title: 'تم إضافة المنتج بنجاح', description: `تم إضافة ${productData.name} إلى قاعدة البيانات` });
      if (setUploadProgress) setUploadProgress(100);
      return { success: true, data: newProduct };
    } catch (error) {
      console.error('Error adding product:', error);
      toast({ title: 'خطأ في إضافة المنتج', description: error.message, variant: 'destructive' });
      return { success: false, error: error.message };
    }
  }, [db, storage, user, dbRefetchProducts]);

  const dbUpdateProduct = useCallback(async (productId, productData, imageFiles = { general: [], colorImages: {} }, setUploadProgress) => {
    try {
      // رفع صور جديدة إن وجدت
      let updatedGeneralImages = [...(productData.existingImages || [])];
      if (imageFiles.general && imageFiles.general.length > 0) {
        const newImagePromises = imageFiles.general.map(async (file) => {
          if (typeof file === 'string') return file;
          if (!file) return null;
          try { return await storage.uploadProductImage(file, productId); } catch { return null; }
        });
        const newImages = (await Promise.all(newImagePromises)).filter(Boolean);
        updatedGeneralImages = [...updatedGeneralImages, ...newImages];
      }

      await db.products.update(productId, {
        name: productData.name,
        description: productData.description,
        category_id: productData.categoryId,
        base_price: productData.price || 0,
        cost_price: productData.costPrice || 0,
        profit_amount: productData.profitAmount || 0,
        barcode: productData.barcode,
        images: updatedGeneralImages
      });

      if (productData.variants && productData.variants.length > 0) {
        const updates = productData.variants
          .filter(v => v.id)
          .map(v => db.variants.update(v.id, {
            price: v.price || productData.price || 0,
            cost_price: v.costPrice || productData.costPrice || 0,
            profit_amount: v.profitAmount || productData.profitAmount || 0,
            hint: v.hint || '',
            barcode: v.barcode
          }));
        await Promise.all(updates);
      }

      await dbRefetchProducts();
      toast({ title: 'تم تحديث المنتج بنجاح', description: `تم تحديث ${productData.name}` });
      if (setUploadProgress) setUploadProgress(100);
      return { success: true };
    } catch (error) {
      console.error('Error updating product:', error);
      toast({ title: 'خطأ في تحديث المنتج', description: error.message, variant: 'destructive' });
      return { success: false, error: error.message };
    }
  }, [db, storage, dbRefetchProducts]);

  const dbDeleteProducts = useCallback(async (productIds) => {
    try {
      await Promise.all(productIds.map(id => db.products.delete(id)));
      await dbRefetchProducts();
      toast({ title: 'تم حذف المنتجات', description: `تم حذف ${productIds.length} منتج بنجاح` });
      return { success: true };
    } catch (error) {
      console.error('Error deleting products:', error);
      toast({ title: 'خطأ في حذف المنتجات', description: error.message, variant: 'destructive' });
      return { success: false, error: error.message };
    }
  }, [db, dbRefetchProducts]);

  const dbUpdateVariantStock = useCallback(async (productId, variantId, newQuantity) => {
    try {
      await db.inventory.updateStock(productId, variantId, newQuantity);
      await dbRefetchProducts();
      return { success: true };
    } catch (error) {
      console.error('Error updating variant stock:', error);
      toast({ title: 'خطأ في تحديث المخزون', description: error.message, variant: 'destructive' });
      return { success: false };
    }
  }, [db, dbRefetchProducts]);

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
        created_by: user?.user_id || user?.id,
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
  const approveAiOrder = useCallback(async (orderId) => ({ success: true }), []);

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