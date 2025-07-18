
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from '@/components/ui/use-toast.js';
import { useAuth, usePermissions } from '@/contexts/UnifiedAuthContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useNotificationsSystem } from '@/contexts/NotificationsSystemContext';
import { supabase } from '@/lib/customSupabaseClient';
import { useProducts } from '@/hooks/useProducts.jsx';
import { useCart } from '@/hooks/useCart.jsx';
import { useFilteredProducts } from '@/hooks/useFilteredProducts';
import { v4 as uuidv4 } from 'uuid';

const InventoryContext = createContext();

export const useInventory = () => useContext(InventoryContext);

export const InventoryProvider = ({ children }) => {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const { addNotification } = useNotifications();
  const { notifyLowStock } = useNotificationsSystem();
  const [loading, setLoading] = useState(true);
  const [employeeProfitRules, setEmployeeProfitRules] = useState({});
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [settings, setSettings] = useState({ 
    deliveryFee: 5000, 
    lowStockThreshold: 5, 
    mediumStockThreshold: 10, 
    sku_prefix: "PROD", 
    lastPurchaseId: 0,
    printer: { paperSize: 'a4', orientation: 'portrait' }
  });
  const [accounting, setAccounting] = useState({ capital: 10000000, expenses: [] });

  // Stock update logic when order status changes
  function handleStockUpdate(oldOrder, newOrder) {
    const stockChanges = [];
    if (['pending', 'processing'].includes(oldOrder.status) && ['shipped', 'delivered'].includes(newOrder.status)) {
      // From reserved to sold
      oldOrder.items.forEach(item => {
        stockChanges.push(supabase.rpc('update_stock_on_sale', {
          p_sku: item.sku,
          p_quantity: item.quantity
        }));
      });
    } else if ((newOrder.status === 'returned' || newOrder.status === 'cancelled') && oldOrder.status !== newOrder.status) {
      // From sold/reserved back to available
      oldOrder.items.forEach(item => {
        stockChanges.push(supabase.rpc('update_stock_on_return', {
          p_sku: item.sku,
          p_quantity: item.quantity,
          p_old_status: oldOrder.status
        }));
      });
    }
    Promise.all(stockChanges).catch(err => console.error("Stock update failed:", err));
  }

  // Using custom hooks - مع تطبيق فلترة الصلاحيات
  const { products: allProducts, setProducts, addProduct, updateProduct, deleteProducts, updateVariantStock, getLowStockProducts } = useProducts([], settings, addNotification, user);
  const filteredProducts = useFilteredProducts(allProducts);
  const { cart, addToCart, removeFromCart, updateCartItemQuantity, clearCart } = useCart();
  
  // الطلبات - بدون hooks مشكوك بها
  const [orders, setOrders] = useState([]);
  const [aiOrders, setAiOrders] = useState([]);
  
  // وظائف الطلبات المبسطة
  const createOrder = useCallback(async (customerInfo, cartItems, trackingNumber, discount, status, qrLink, deliveryPartnerData) => {
    try {
      const { data: orderNumber, error: orderNumberError } = await supabase.rpc('generate_order_number');
      if (orderNumberError) {
        console.error('Error generating order number:', orderNumberError);
        return { success: false, error: 'فشل في إنشاء رقم الطلب' };
      }

      const subtotal = cartItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
      const deliveryFee = deliveryPartnerData?.delivery_fee || settings?.deliveryFee || 0;
      const total = subtotal - (discount || 0) + deliveryFee;

      const newOrder = {
        order_number: orderNumber,
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

      const { data: createdOrder, error: orderError } = await supabase
        .from('orders')
        .insert(newOrder)
        .select()
        .single();

      if (orderError) {
        console.error('Error creating order:', orderError);
        return { success: false, error: orderError.message };
      }

      const orderItems = cartItems.map(item => ({
        order_id: createdOrder.id,
        product_id: item.productId,
        variant_id: item.variantId,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.quantity * item.price
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        console.error('Error creating order items:', itemsError);
        await supabase.from('orders').delete().eq('id', createdOrder.id);
        return { success: false, error: 'فشل في إنشاء عناصر الطلب' };
      }

      setOrders(prev => [createdOrder, ...prev]);
      return { success: true, trackingNumber: newOrder.tracking_number, orderId: createdOrder.id };
    } catch (error) {
      console.error('Error in createOrder:', error);
      return { success: false, error: error.message };
    }
  }, [settings, user]);

  const updateOrder = useCallback(async (orderId, updates) => {
    try {
      const { data: updatedOrder, error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId)
        .select()
        .single();

      if (error) {
        console.error('Error updating order:', error);
        return { success: false, error: error.message };
      }

      setOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));
      return { success: true, data: updatedOrder };
    } catch (error) {
      console.error('Error in updateOrder:', error);
      return { success: false, error: error.message };
    }
  }, []);

  const deleteOrders = useCallback(async (orderIds, isAiOrder = false) => {
    try {
      if (isAiOrder) {
        const { error } = await supabase.from('ai_orders').delete().in('id', orderIds);
        if (error) throw error;
        setAiOrders(prev => prev.filter(o => !orderIds.includes(o.id)));
      } else {
        const { error } = await supabase.from('orders').delete().in('id', orderIds);
        if (error) throw error;
        setOrders(prev => prev.filter(o => !orderIds.includes(o.id)));
      }
      return { success: true };
    } catch (error) {
      console.error('Error deleting orders:', error);
      return { success: false, error: error.message };
    }
  }, []);

  const approveAiOrder = useCallback(async (orderId) => {
    console.log('Approve AI order:', orderId);
    return { success: true };
  }, []);
  
  async function addExpense(expense) {
    // هذه الميزة غير متاحة حالياً - سيتم تطويرها لاحقاً  
    // يمكن استخدام نظام الإشعارات لتسجيل المصاريف مؤقتاً
    const newExpense = {
      id: Date.now(),
      ...expense,
      date: expense.date || new Date().toISOString()
    };
    
    setAccounting(prev => ({ 
      ...prev, 
      expenses: [...prev.expenses, newExpense] 
    }));

    if (expense.category !== 'شراء بضاعة' && expense.category !== 'شحن' && expense.category !== 'مستحقات الموظفين') {
      toast({ title: "تمت إضافة المصروف", variant: "success" });
    }
  }

  // استخدام البيانات من useOrders و usePurchases

  const fetchInitialData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [productsRes, ordersRes, purchasesRes, settingsRes, aiOrdersRes, profitRulesRes, categoriesRes, departmentsRes] = await Promise.all([
        supabase.from('products').select(`
          *,
          product_variants (
            id,
            color_id,
            size_id,
            price,
            cost_price,
            barcode,
            images,
            is_active,
            colors (id, name, hex_code),
            sizes (id, name, type)
          ),
          inventory (
            id,
            variant_id,
            quantity,
            reserved_quantity,
            min_stock,
            location
          ),
          product_categories (
            category_id,
            categories (id, name, type)
          ),
          product_departments (
            department_id,
            departments (id, name, color, icon)
          ),
          product_product_types (
            product_type_id,
            product_types (id, name)
          ),
          product_seasons_occasions (
            season_occasion_id,
            seasons_occasions (id, name, type)
          )
        `).order('created_at', { ascending: false }),
        supabase.from('orders').select(`
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
        `).order('created_at', { ascending: false }),
        supabase.from('purchases').select('*').order('created_at', { ascending: false }),
        supabase.from('settings').select('*'),
        supabase.from('ai_orders').select('*').order('created_at', { ascending: false }),
        supabase.from('employee_profit_rules').select('*'),
        supabase.from('categories').select('*').order('name'),
        supabase.from('departments').select('*').order('name')
      ]);

      if (productsRes.error) throw productsRes.error;
      if (ordersRes.error) throw ordersRes.error;
      if (purchasesRes.error) throw purchasesRes.error;

      // معالجة وتحويل بيانات المنتجات
      const processedProducts = (productsRes.data || []).map(product => {
        const productInventory = product.inventory || [];
        
        const variants = (product.product_variants || []).map(variant => {
          const variantInventory = productInventory.find(inv => inv.variant_id === variant.id);
          return {
            ...variant,
            id: variant.id, // التأكد من وجود ID
            sku: variant.barcode || `${product.id}-${variant.id}`, // إنشاء SKU إذا لم يكن موجود
            color: variant.colors?.name || 'Unknown',
            color_hex: variant.colors?.hex_code || '#000000',
            size: variant.sizes?.name || 'Unknown',
            quantity: variantInventory?.quantity || 0,
            reserved: variantInventory?.reserved_quantity || 0,
            min_stock: variantInventory?.min_stock || 0,
            location: variantInventory?.location || null,
            inventoryId: variantInventory?.id || null,
            image: variant.images?.[0] || product.images?.[0] || null
          };
        });

        const totalStock = variants.reduce((sum, variant) => sum + (variant.quantity || 0), 0);
        const totalReserved = variants.reduce((sum, variant) => sum + (variant.reserved || 0), 0);

        return {
          ...product,
          variants,
          totalStock,
          totalReserved,
          is_visible: true, // إظهار جميع المنتجات
          price: product.base_price || 0,
          
          categories: {
            main_category: product.product_categories?.[0]?.categories?.name || null,
            product_type: product.product_product_types?.[0]?.product_types?.name || null,
            season_occasion: product.product_seasons_occasions?.[0]?.seasons_occasions?.name || null
          },
          
          departments: (product.product_departments || []).map(pd => pd.departments),
          
          product_variants: variants,
          product_categories: product.product_categories,
          product_departments: product.product_departments,
          product_product_types: product.product_product_types,
          product_seasons_occasions: product.product_seasons_occasions
        };
      });

      // تحميل الإعدادات من قاعدة البيانات
      if (settingsRes.data && settingsRes.data.length > 0) {
        const dbSettings = {};
        settingsRes.data.forEach(setting => {
          dbSettings[setting.key] = setting.value;
        });
        setSettings(prev => ({ ...prev, ...dbSettings }));
      }

      // معالجة وتحويل بيانات الطلبات
      const processedOrders = (ordersRes.data || []).map(order => {
        // تحويل order_items إلى items بالتنسيق المطلوب
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
          total: order.final_amount || order.total_amount, // لضمان التوافق مع الكود القديم
          order_items: order.order_items // الاحتفاظ بالبيانات الأصلية
        };
      });

      setProducts(processedProducts);
      // لا نحتاج لتطبيق فلترة هنا لأن useFilteredProducts يتولى ذلك
      setOrders(processedOrders.filter(o => o.delivery_status !== 'ai_pending') || []);
      setAiOrders(aiOrdersRes.data || []);

      // تحميل قواعد الأرباح
      if (profitRulesRes.data && profitRulesRes.data.length > 0) {
        const rulesByEmployee = {};
        profitRulesRes.data.forEach(rule => {
          if (!rulesByEmployee[rule.employee_id]) {
            rulesByEmployee[rule.employee_id] = [];
          }
          rulesByEmployee[rule.employee_id].push(rule);
        });
        setEmployeeProfitRules(rulesByEmployee);
      }

      // تحميل التصنيفات والأقسام
      if (categoriesRes.data) {
        setCategories(categoriesRes.data);
      }
      if (departmentsRes.data) {
        setDepartments(departmentsRes.data);
      }
    } catch (error) {
      console.error("Error fetching initial data:", error);
      toast({ title: "خطأ في تحميل البيانات", description: "لم نتمكن من تحميل البيانات الأولية. قد تكون هناك مشكلة في صلاحيات الوصول.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, setProducts]);

  useEffect(() => {
    if (user) {
      fetchInitialData();
    } else {
      setLoading(false);
    }
  }, [fetchInitialData, user]);

  // Real-time subscriptions for AI orders and regular orders
  useEffect(() => {
    if (!user) return;

    const ordersChannel = supabase
      .channel('orders-changes')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          setOrders(prev => [payload.new, ...prev]);
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => {
          setOrders(prev => prev.map(order => 
            order.id === payload.new.id ? payload.new : order
          ));
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'orders' },
        (payload) => {
          setOrders(prev => prev.filter(order => order.id !== payload.old.id));
        }
      )
      .subscribe();

    const aiOrdersChannel = supabase
      .channel('ai-orders-changes')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ai_orders' },
        (payload) => {
          setAiOrders(prev => [payload.new, ...prev]);
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ai_orders' },
        (payload) => {
          setAiOrders(prev => prev.map(order => 
            order.id === payload.new.id ? payload.new : order
          ));
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'ai_orders' },
        (payload) => {
          setAiOrders(prev => prev.filter(order => order.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(aiOrdersChannel);
    };
  }, [user]);

  // فحص المخزون المنخفض والإشعار - استخدام المنتجات المفلترة
  const checkLowStockNotifications = useCallback(async () => {
    if (!allProducts || !notifyLowStock) return;
    
    const lowStockProducts = getLowStockProducts(settings.lowStockThreshold || 5, filteredProducts);
    
    lowStockProducts.forEach(async (variant) => {
      const product = allProducts.find(p => p.variants?.some(v => v.id === variant.id));
      if (product) {
        await notifyLowStock(product, variant);
      }
    });
  }, [allProducts, filteredProducts, getLowStockProducts, settings.lowStockThreshold, notifyLowStock]);

  // فحص المخزون كل مرة تتغير فيها المنتجات المفلترة
  useEffect(() => {
    if (allProducts && allProducts.length > 0) {
      checkLowStockNotifications();
    }
  }, [allProducts, checkLowStockNotifications]);

  const getEmployeeProfitRules = useCallback((employeeId) => {
    return employeeProfitRules[employeeId] || [];
  }, [employeeProfitRules]);

  const setEmployeeProfitRule = async (employeeId, rules) => {
    try {
      // إذا كانت قاعدة واحدة (إضافة جديدة)
      if (!Array.isArray(rules)) {
        const rule = rules;
        
        // إذا كان حذف قاعدة
        if (rule.id && rule.is_active === false) {
          const { error: deleteError } = await supabase
            .from('employee_profit_rules')
            .delete()
            .eq('id', rule.id);
          
          if (deleteError) throw deleteError;
        } else {
          // إضافة قاعدة جديدة
          const { error: insertError } = await supabase
            .from('employee_profit_rules')
            .insert({
              employee_id: employeeId,
              rule_type: rule.rule_type,
              target_id: rule.target_id,
              profit_amount: rule.profit_amount || 0,
              profit_percentage: null, // لا نستخدم النسب بعد الآن
              is_active: rule.is_active !== false
            });
          
          if (insertError) throw insertError;
        }
      } else {
        // حذف القواعد القديمة للموظف
        const { error: deleteError } = await supabase
          .from('employee_profit_rules')
          .delete()
          .eq('employee_id', employeeId);

        if (deleteError) throw deleteError;

        // إضافة القواعد الجديدة
        if (rules && rules.length > 0) {
          const { error: insertError } = await supabase
            .from('employee_profit_rules')
            .insert(rules.map(rule => ({
              employee_id: employeeId,
              rule_type: rule.rule_type,
              target_id: rule.target_id,
              profit_amount: rule.profit_amount || 0,
              profit_percentage: null,
              is_active: rule.is_active !== false
            })));

          if (insertError) throw insertError;
        }
      }

      // تحديث البيانات المحلية
      // إعادة جلب القواعد المحدثة
      const { data: updatedRules } = await supabase
        .from('employee_profit_rules')
        .select('*')
        .eq('employee_id', employeeId);

      setEmployeeProfitRules(prev => ({
        ...prev,
        [employeeId]: updatedRules || []
      }));

      toast({ 
        title: "تم حفظ قواعد الأرباح", 
        description: "تم تحديث قواعد الأرباح بنجاح.", 
        variant: "default" 
      });
    } catch (error) {
      console.error('خطأ في حفظ قواعد الأرباح:', error);
      toast({ 
        title: "خطأ", 
        description: "فشل في حفظ قواعد الأرباح. حاول مرة أخرى.", 
        variant: "destructive" 
      });
    }
  };

  const calculateProfit = useCallback((item, employeeId) => {
    const profitRules = employeeProfitRules[employeeId] || [];
    if (!item.price || !item.cost_price || !employeeId) return 0;
  
    const productInfo = allProducts.find(p => p.id === item.productId);
    if (!productInfo) return 0;

    const specificRule = profitRules.find(r => r.rule_type === 'product' && r.target_id === String(item.productId));
    if(specificRule?.profit_amount > 0) {
      return specificRule.profit_amount * item.quantity;
    }

    if (productInfo.categories?.main_category) {
        const categoryRule = profitRules.find(r => r.rule_type === 'category' && r.target_id === productInfo.categories.main_category);
        if(categoryRule?.profit_amount > 0) {
            return categoryRule.profit_amount * item.quantity;
        }
    }

    const defaultProfit = (item.price - item.cost_price) * item.quantity;
    return defaultProfit > 0 ? defaultProfit : 0;
  }, [employeeProfitRules, allProducts]);

  const calculateManagerProfit = useCallback((order) => {
    if (!order || !order.items || !order.created_by) return 0;
    const employeeProfitShare = order.items.reduce((sum, item) => sum + calculateProfit(item, order.created_by), 0);
    const totalProfit = order.items.reduce((sum, item) => sum + ((item.price || 0) - (item.cost_price || 0)) * item.quantity, 0);
    return totalProfit - employeeProfitShare;
  }, [calculateProfit]);

  const updateSettings = async (newSettings) => {
    try {
      setSettings(prev => ({...prev, ...newSettings}));
      
      // حفظ الإعدادات في قاعدة البيانات
      for (const [key, value] of Object.entries(newSettings)) {
        const { error } = await supabase
          .from('settings')
          .upsert({
            key: key,
            value: value,
            description: `إعداد ${key} محفوظ تلقائياً`
          });
        
        if (error) {
          console.error(`Error saving setting ${key}:`, error);
          throw error;
        }
      }
      
      toast({ title: "نجاح", description: "تم حفظ الإعدادات بنجاح.", variant: 'success' });
    } catch (error) {
      console.error('Error updating settings:', error);
      toast({ title: "خطأ", description: "فشل في حفظ الإعدادات.", variant: 'destructive' });
    }
  };

  const requestProfitSettlement = async (employeeId, amount, orderIds) => {
    const employee = user; // Assuming the user requesting is the employee
    addNotification({
      type: 'profit_settlement_request',
      title: 'طلب محاسبة جديد',
      message: `الموظف ${employee.full_name} يطلب محاسبته على مبلغ ${amount.toLocaleString()} د.ع.`,
      link: `/profit-settlement/${employeeId}?orders=${orderIds.join(',')}`,
      user_id: null, // send to all admins
      data: { employeeId, employeeName: employee.full_name, amount, orderIds },
      color: 'purple',
      icon: 'UserPlus'
    });
    toast({ title: "تم إرسال الطلب", description: "تم إرسال طلب المحاسبة إلى المدير.", variant: "success" });
  }

  const settleEmployeeProfits = async (employeeId, amount, employeeName, orderIds) => {
    // تسجيل عملية التسوية في الإشعارات بدلاً من جدول منفصل
    const notificationData = {
      type: 'settlement',
      title: 'تسوية أرباح',
      message: `تمت تسوية مستحقات ${employeeName} بقيمة ${amount} دينار`,
      data: {
        employee_id: employeeId,
        settlement_amount: amount,
        order_ids: orderIds,
        invoice_number: `INV-${Date.now()}`
      }
    };

    const { error: notificationError } = await supabase
      .from('notifications')
      .insert(notificationData);

    if (notificationError) {
      console.error('Error creating settlement notification:', notificationError);
    }

    // إضافة المصروف
    await addExpense({
      date: new Date().toISOString(),
      category: 'مستحقات الموظفين',
      description: `دفع مستحقات الموظف ${employeeName}`,
      amount: amount,
    });
    
    // تحديث حالة الطلبات
    if (orderIds && orderIds.length > 0) {
        const { error } = await supabase
            .from('profits')
            .update({ status: 'settled', settled_at: new Date().toISOString() })
            .eq('employee_id', employeeId)
            .in('order_id', orderIds);
            
        if(error) {
            console.error("Error updating profit status:", error);
        }
    }

    // إرسال إشعار للموظف
    addNotification({
        type: 'profit_settlement_paid',
        title: 'تمت تسوية مستحقاتك',
        message: `قام المدير بتسوية مستحقاتك بمبلغ ${amount.toLocaleString()} د.ع.`,
        user_id: employeeId,
        color: 'green',
        icon: 'CheckCircle'
    });
    toast({title: "نجاح", description: `تمت تسوية مستحقات ${employeeName} بنجاح.`});
  };

  const updateCapital = async (newCapital) => {
    // البحث عن أول إعداد متاح أو إنشاء واحد جديد
    const { data: existingSettings } = await supabase
        .from('settings')
        .select('*')
        .limit(1)
        .maybeSingle();

    let error;
    if (existingSettings) {
        // تحديث الإعدادات الموجودة
        const result = await supabase
            .from('settings')
            .update({ value: { ...existingSettings.value, capital: newCapital } })
            .eq('id', existingSettings.id);
        error = result.error;
    } else {
        // إنشاء إعدادات جديدة
        const result = await supabase
            .from('settings')
            .insert({ 
                key: 'app_settings', 
                value: { capital: newCapital },
                description: 'إعدادات التطبيق الأساسية'
            });
        error = result.error;
    }

    if (error) {
        toast({ title: "خطأ", description: "فشل تحديث رأس المال.", variant: "destructive" });
    } else {
        setAccounting(prev => ({ ...prev, capital: newCapital }));
        setSettings(prev => ({ ...prev, capital: newCapital }));
        toast({ title: "نجاح", description: "تم تحديث رأس المال بنجاح.", variant: "success" });
    }
  };

  const deleteExpense = async (expenseId) => {
    // هذه الميزة غير متاحة حالياً
    toast({ title: "تنبيه", description: "ميزة حذف المصاريف ستكون متاحة قريباً.", variant: "default" });
  };

  return (
    <InventoryContext.Provider value={{
    // البيانات الأساسية - استخدام المنتجات المفلترة
    products: filteredProducts, // المنتجات المفلترة حسب الصلاحيات
    allProducts, // جميع المنتجات (للمديرين فقط)
    orders, 
    aiOrders,
    cart, 
    settings, 
    categories, 
    departments,
    accounting, 
    loading, 
    employeeProfitRules,
    
    // العمليات
    addProduct, updateProduct, deleteProducts, 
    addPurchase: () => {}, deletePurchase: () => {}, deletePurchases: () => {},
    createOrder: (customerInfo, cartItems, trackingNumber, discount, status, qrLink, deliveryPartnerData) => createOrder(customerInfo, cartItems, trackingNumber, discount, status, qrLink, deliveryPartnerData),
    updateOrder, deleteOrders, updateSettings, addToCart, removeFromCart, updateCartItemQuantity,
    clearCart, 
    getLowStockProducts: (limit) => getLowStockProducts(limit, filteredProducts), // تطبيق الفلترة على المخزون المنخفض
    approveAiOrder,
    updateVariantStock, calculateProfit, requestProfitSettlement,
    getEmployeeProfitRules, setEmployeeProfitRule, settleEmployeeProfits,
    updateCapital, addExpense, deleteExpense,
    
    // وظائف السحب والتخزين
    refreshData: fetchInitialData,
    setProducts,
    
    // قاعدة بيانات الطباعة
    print: { printer: settings.printer }
    }}>
      {children}
    </InventoryContext.Provider>
  );
};
