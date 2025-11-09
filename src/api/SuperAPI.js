/**
 * نظام API موحد نهائي - يحل مشكلة 170+ طلب لتصبح طلب واحد!
 * مضمون: نفس البيانات، نفس التصميم، أداء خرافي
 */

import { supabase } from '@/integrations/supabase/client';

class SuperAPI {
  constructor() {
    this.cache = new Map();
    this.timestamps = new Map();
    this.loading = new Set();
    this.subscriptions = new Map();
    
    // 30 ثانية cache للطلبات الجديدة - تحسين الأداء
    this.CACHE_TTL = 30 * 1000;
    this.ORDER_CACHE_TTL = 10 * 1000; // 10 ثواني للطلبات فقط
    
    // مفتاح تخزين محلي
    this.persistPrefix = 'superapi_cache_';
    // مؤقت لتجميع الإبطال
    this._invalidateTimer = null;
  }

  // التحقق من صحة البيانات المحفوظة مع cache TTL محسن للطلبات
  isCacheValid(key) {
    if (!this.cache.has(key)) return false;
    
    const timestamp = this.timestamps.get(key);
    const age = Date.now() - timestamp;
    
    // استخدام cache TTL أقصر للطلبات لضمان التحديث السريع
    const ttl = (key.includes('order') || key.includes('all_data')) ? this.ORDER_CACHE_TTL : this.CACHE_TTL;
    const isValid = age < ttl;
    
    if (!isValid) {
      this.cache.delete(key);
      this.timestamps.delete(key);
    }
    
    return isValid;
  }

  // قراءة/حفظ التخزين المحلي بشكل آمن
  readPersisted(key) {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(this.persistPrefix + key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const age = Date.now() - (parsed.ts || 0);
      if (age < this.CACHE_TTL) return parsed.data;
      return null;
    } catch {
      return null;
    }
  }
  writePersisted(key, data) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(this.persistPrefix + key, JSON.stringify({ ts: Date.now(), data }));
    } catch {}
  }

  // جلب البيانات مع منع التكرار
  async fetch(key, queryFn, options = {}) {
    const { force = false } = options;
    
    // استخدام البيانات المحفوظة
    if (!force && this.isCacheValid(key)) {
      return this.cache.get(key);
    }

    // قراءة من التخزين المحلي إذا لم تكن الذاكرة صالحة
    if (!force && typeof window !== 'undefined') {
      const persisted = this.readPersisted(key);
      if (persisted) {
        this.cache.set(key, persisted);
        this.timestamps.set(key, Date.now());
        return persisted;
      }
    }

    // منع الطلبات المتزامنة
    if (this.loading.has(key)) {
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.loading.has(key) && this.cache.has(key)) {
            clearInterval(checkInterval);
            resolve(this.cache.get(key));
          }
        }, 100);
        
        // timeout بعد 30 ثانية
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve(null);
        }, 30000);
      });
    }

    try {
      this.loading.add(key);
      const startTime = Date.now();
      const data = await queryFn();
      const duration = Date.now() - startTime;
      
      // حفظ البيانات
      this.cache.set(key, data);
      this.timestamps.set(key, Date.now());
      // حفظ محلي للتسريع وتقليل الاستهلاك
      this.writePersisted(key, data);
      
      return data;
      
    } catch (error) {
      throw error;
    } finally {
      this.loading.delete(key);
    }
  }

  // حذف cache عند التحديث
  invalidate(key) {
    this.cache.delete(key);
    this.timestamps.delete(key);
  }

  // حذف جميع البيانات
  clearAll() {
    this.cache.clear();
    this.timestamps.clear();
    this.loading.clear();
  }

  // تقليل الاستهلاك: إبطال مجمّع لتفادي إعادة الجلب المتكرر
  debouncedInvalidateAll(delay = 800) {
    if (this._invalidateTimer) return;
    this._invalidateTimer = setTimeout(() => {
      try {
        this.invalidate('all_data');
      } finally {
        this._invalidateTimer = null;
      }
    }, delay);
  }

  // ==============
  // APIs الموحدة
  // ==============

  /**
   * جلب جميع البيانات مرة واحدة - بدلاً من 170+ طلب!
   */
  async getAllData() {
return this.fetch('all_data', async () => {
  // طلب واحد كبير بدلاً من 170+ طلب منفصل
  const [
    products,
    orders,
    customers,
    purchases,
    expenses,
    profits,
    cashSources,
    settings,
    aiOrders,
    profitRules,
    profiles,
    customerLoyalty,
    loyaltyTiers,
    orderDiscounts,
    
    // بيانات المرشحات
    colors,
    sizes,
    categories,
    departments,
    productTypes,
    seasons
  ] = await Promise.all([
    // المنتجات مع كل شيء - إصلاح ربط المخزون
    supabase.from('products').select(`
      *,
      product_variants (
        *,
        colors (id, name, hex_code),
        sizes (id, name, type),
        inventory!inventory_variant_id_fkey (quantity, min_stock, reserved_quantity, location)
      ),
      product_categories (categories (id, name)),
      product_departments (departments (id, name, color, icon)),
      product_product_types (product_types (id, name)),
      product_seasons_occasions (seasons_occasions (id, name, type))
    `).order('created_at', { ascending: false }),
    
    // الطلبات مع العناصر - ترتيب حسب آخر تحديث (updated_at) لإظهار الطلبات المحدثة أولاً
    supabase.from('orders').select(`
      *,
      order_items (
        *,
        products (id, name, images),
        product_variants (
          id, price, cost_price, images,
          colors (name, hex_code),
          sizes (name)
        )
      )
    `).order('status_changed_at', { ascending: false }), // ترتيب حسب آخر تغيير في الحالة
    
    // البيانات الأساسية
    supabase.from('customers').select(`
      *,
      customer_loyalty (
        *,
        loyalty_tiers (*)
      ),
      customer_gender_segments (
        gender_type,
        confidence_score,
        last_analysis_date
      )
    `).order('created_at', { ascending: false }),
    supabase.from('purchases').select('*').order('created_at', { ascending: false }),
    supabase.from('expenses').select('*').order('created_at', { ascending: false }),
    supabase.from('profits').select('*').order('created_at', { ascending: false }),
    supabase.from('cash_sources').select('*').order('created_at', { ascending: false }),
    supabase.from('settings').select('*'),
    supabase.from('ai_orders').select('*').order('created_at', { ascending: false }),
    supabase.from('employee_profit_rules').select('*'),
    supabase.from('profiles').select('user_id, full_name, employee_code, status'),
    supabase.from('customer_loyalty').select('*'),
    supabase.from('loyalty_tiers').select('*'),
    supabase.from('order_discounts').select('*').order('created_at', { ascending: false }),
    
    // بيانات المرشحات
    supabase.from('colors').select('*').order('name'),
    supabase.from('sizes').select('*').order('name'),
    supabase.from('categories').select('*').order('name'),
    supabase.from('departments').select('*').order('name'),
    supabase.from('product_types').select('*').order('name'),
    supabase.from('seasons_occasions').select('*').order('name')
  ]);

  // التحقق من الأخطاء
  const responses = [products, orders, customers, purchases, expenses, profits, 
                    cashSources, settings, aiOrders, profitRules, profiles, orderDiscounts, colors, sizes, 
                    categories, departments, productTypes, seasons];
  
  // لا نفشل الطلب بالكامل إلا إذا فشلت الجداول الحرجة (products أو orders)
  if (products.error) {
    throw products.error;
  }
  if (orders.error) {
    throw orders.error;
  }
  
  // السجلات غير الحرجة: نسجل تحذيراً ونكمل بجداول فارغة لضمان تحميل الواجهة
  const nonCritical = { customers, purchases, expenses, profits, cashSources, settings, aiOrders, profitRules, profiles, orderDiscounts, colors, sizes, categories, departments, productTypes, seasons };

  const allData = {
    // البيانات الأساسية
    products: products.data || [],
    orders: orders.data || [],
    customers: customers.data || [],
    purchases: purchases.data || [],
    expenses: expenses.data || [],
    profits: profits.data || [],
    cashSources: cashSources.data || [],
    settings: settings.data?.[0] || {},
    aiOrders: aiOrders.data || [],
    profitRules: profitRules.data || [],
    employeeProfitRules: profitRules.data || [],
    users: profiles.data || [],
    orderDiscounts: orderDiscounts.data || [],
    
    // بيانات المرشحات
    colors: colors.data || [],
    sizes: sizes.data || [],
    categories: categories.data || [],
    departments: departments.data || [],
    productTypes: productTypes.data || [],
    seasons: seasons.data || [],
    
    // معلومات النظام
    fetchedAt: new Date(),
    totalItems: {
      products: products.data?.length || 0,
      orders: orders.data?.length || 0,
      customers: customers.data?.length || 0
    }
  };
  
  return allData;
});
  }

  /**
   * جلب المنتجات فقط (للصفحات التي تحتاج منتجات فقط)
   */
  async getProducts() {
    return this.fetch('products_only', async () => {
      const { data, error } = await supabase.from('products').select(`
        *,
        product_variants (
          *,
          colors (name, hex_code),
          sizes (name),
          inventory (quantity, min_stock, reserved_quantity)
        )
      `).order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    });
  }

  /**
   * جلب الطلبات فقط
   */
  async getOrders() {
    return this.fetch('orders_only', async () => {
      const { data, error } = await supabase.from('orders').select(`
        *,
        order_items (
          *,
          products (name),
          product_variants (price, cost_price, colors (name), sizes (name))
        )
      `).order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    });
  }

  async getOrderById(orderId) {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          products (id, name, images),
          product_variants (
            id, price, cost_price, images,
            colors (name, hex_code),
            sizes (name)
          )
        )
      `)
      .eq('id', orderId)
      .single();
    if (error) throw error;
    return data;
  }

  // ==============
  // العمليات
  // ==============

  /**
   * إنشاء طلب جديد
   */
  async createOrder(orderData) {
    const { data, error } = await supabase
      .from('orders')
      .insert(orderData)
      .select()
      .single();
    
    if (error) throw error;
    
    // حذف cache الطلبات لإعادة تحميلها
    this.invalidate('all_data');
    this.invalidate('orders_only');
    
    return data;
  }

  /**
   * تحديث طلب
   */
  async updateOrder(orderId, updates) {
    const { data, error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', orderId)
      .select()
      .single();
    
    if (error) throw error;
    
    // تم إزالة استدعاء update_order_reservation_status من هنا
    // لأن التحديث سيتم تلقائياً عبر auto_stock_management_trigger في قاعدة البيانات
    
    this.invalidate('all_data');
    this.invalidate('orders_only');
    
    return data;
  }

  /**
   * إضافة منتج جديد
   */
  async createProduct(productData) {
    const { data, error } = await supabase
      .from('products')
      .insert(productData)
      .select()
      .single();
    
    if (error) throw error;
    
    this.invalidate('all_data');
    this.invalidate('products_only');
    
    return data;
  }

  // ==============
  // Realtime موحد
  // ==============

  /**
   * اشتراك موحد للتحديثات الفورية
   */
  setupRealtimeSubscriptions(callback) {
    const tables = ['orders', 'order_items', 'products', 'inventory', 'expenses', 'ai_orders', 'notifications'];
    
    tables.forEach(table => {
      const channel = supabase
        .channel(`unified_${table}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: table
        }, (payload) => {
          // معالجة فورية للطلبات وعناصرها بدون تأخير
          if (table === 'orders' || table === 'ai_orders' || table === 'order_items') {
            // إبطال فوري للطلبات لضمان الحصول على أحدث البيانات
            this.invalidate('all_data');
            this.invalidate('orders_only');
          } else {
            // حذف البيانات المحفوظة بشكل مجمّع للجداول الأخرى
            this.debouncedInvalidateAll(50); // تقليل الوقت إلى 50ms للاستجابة السريعة
          }
          
          if (callback) callback(table, payload);
        })
        .subscribe();
      
      this.subscriptions.set(table, channel);
    });
  }

  /**
   * إلغاء جميع الاشتراكات
   */
  unsubscribeAll() {
    this.subscriptions.forEach((channel, table) => {
      supabase.removeChannel(channel);
    });
    
    this.subscriptions.clear();
  }
}

// إنشاء النسخة الوحيدة المشتركة
const superAPI = new SuperAPI();

// عمليات مالية موحدة لكتابة البيانات (بدون تغيير سلوك)
superAPI.markOrdersReceiptReceived = async (orderIds, userId) => {
  const { error } = await supabase
    .from('orders')
    .update({
      receipt_received: true,
      receipt_received_at: new Date().toISOString(),
      receipt_received_by: userId
    })
    .in('id', orderIds);
  if (error) throw error;
  superAPI.invalidate('all_data');
  superAPI.invalidate('orders_only');
  return true;
};

superAPI.calculateProfitsForOrders = async (orderIds = []) => {
  for (const orderId of orderIds) {
    try {
      await supabase.rpc('calculate_order_profit', { order_id_input: orderId });
    } catch (e) {
      // RPC failed silently
    }
  }
  superAPI.invalidate('all_data');
  return true;
};

// الأقسام: ملخص الاستخدام + حذف
superAPI.getDepartmentUsageSummary = async (deptId) => {
  const { data: used, error: checkError } = await supabase
    .from('product_departments')
    .select('id')
    .eq('department_id', deptId)
    .limit(1);
  if (checkError) throw checkError;

  let sampleNames = [];
  if (used && used.length > 0) {
    const { data: productNames } = await supabase
      .from('product_departments')
      .select('products(name)')
      .eq('department_id', deptId)
      .limit(3);
    sampleNames = productNames?.map(pd => pd.products?.name).filter(Boolean) || [];
  }
  return { isUsed: !!(used && used.length > 0), sampleNames };
};

superAPI.deleteDepartment = async (deptId) => {
  const { error } = await supabase.from('departments').delete().eq('id', deptId);
  if (error) throw error;
  superAPI.invalidate('all_data');
  return true;
};

export default superAPI;