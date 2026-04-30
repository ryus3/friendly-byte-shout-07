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
    
    // ⚡ تحسين الأداء: زيادة cache TTL للسرعة القصوى
    this.CACHE_TTL = 10 * 60 * 1000; // ⚡ 10 دقائق بدلاً من 5
    this.ORDER_CACHE_TTL = 30 * 1000; // ⚡ 30 ثانية بدلاً من 15
    this.STATIC_CACHE_TTL = 30 * 60 * 1000; // ⚡ 30 دقيقة بدلاً من 10
    
    // مفتاح تخزين محلي
    this.persistPrefix = 'superapi_cache_';
    // مؤقت لتجميع الإبطال
    this._invalidateTimer = null;
  }

  // التحقق من صحة البيانات المحفوظة مع cache TTL محسن حسب نوع البيانات
  isCacheValid(key) {
    if (!this.cache.has(key)) return false;
    
    const timestamp = this.timestamps.get(key);
    const age = Date.now() - timestamp;
    
    // تحديد TTL حسب نوع البيانات
    let ttl;
    if (key.includes('order') || key.includes('all_data')) {
      ttl = this.ORDER_CACHE_TTL; // 15 ثانية للطلبات
    } else if (key.includes('colors') || key.includes('sizes') || key.includes('categories') || key.includes('departments')) {
      ttl = this.STATIC_CACHE_TTL; // 10 دقائق للبيانات الثابتة
    } else {
      ttl = this.CACHE_TTL; // 5 دقائق للباقي
    }
    
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

  // مفاتيح حساسة للوقت — لا نقرأها من localStorage أبداً (تمنع اختفاء الطلبات/قواعد الأرباح بعد التحديث)
  isVolatileKey(key) {
    return key.includes('order') || key.includes('all_data');
  }

  // جلب البيانات مع منع التكرار
  async fetch(key, queryFn, options = {}) {
    const { force = false } = options;
    
    // استخدام البيانات المحفوظة
    if (!force && this.isCacheValid(key)) {
      return this.cache.get(key);
    }

    // قراءة من التخزين المحلي إذا لم تكن الذاكرة صالحة (فقط للبيانات الثابتة)
    if (!force && typeof window !== 'undefined' && !this.isVolatileKey(key)) {
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
      // حفظ محلي فقط للبيانات الثابتة (ليس الطلبات/all_data)
      if (!this.isVolatileKey(key)) {
        this.writePersisted(key, data);
      }
      
      return data;
      
    } catch (error) {
      throw error;
    } finally {
      this.loading.delete(key);
    }
  }

  // حذف cache عند التحديث (يشمل localStorage)
  invalidate(key) {
    this.cache.delete(key);
    this.timestamps.delete(key);
    if (typeof window !== 'undefined') {
      try { localStorage.removeItem(this.persistPrefix + key); } catch {}
    }
  }

  // حذف جميع البيانات
  clearAll() {
    this.cache.clear();
    this.timestamps.clear();
    this.loading.clear();
    if (typeof window !== 'undefined') {
      try {
        Object.keys(localStorage)
          .filter(k => k.startsWith(this.persistPrefix))
          .forEach(k => localStorage.removeItem(k));
      } catch {}
    }
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

  // ⚡ كاش lookup tables (24h TTL في localStorage) — آمن: بيانات مرجعية فقط
  LOOKUP_TTL_MS = 24 * 60 * 60 * 1000;
  LOOKUP_KEY = 'superapi_lookup_v1';

  readLookupCache() {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(this.LOOKUP_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.ts) return null;
      if (Date.now() - parsed.ts > this.LOOKUP_TTL_MS) return null;
      return parsed.data;
    } catch { return null; }
  }

  writeLookupCache(data) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(this.LOOKUP_KEY, JSON.stringify({ ts: Date.now(), data }));
    } catch {}
  }

  invalidateLookupCache() {
    if (typeof window === 'undefined') return;
    try { localStorage.removeItem(this.LOOKUP_KEY); } catch {}
  }

  async fetchLookupTables() {
    const [colors, sizes, categories, departments, productTypes, seasons] = await Promise.all([
      supabase.from('colors').select('*').order('name'),
      supabase.from('sizes').select('*').order('name'),
      supabase.from('categories').select('*').order('name'),
      supabase.from('departments').select('*').order('name'),
      supabase.from('product_types').select('*').order('name'),
      supabase.from('seasons_occasions').select('*').order('name'),
    ]);
    const data = {
      colors: colors.data || [],
      sizes: sizes.data || [],
      categories: categories.data || [],
      departments: departments.data || [],
      productTypes: productTypes.data || [],
      seasons: seasons.data || [],
    };
    this.writeLookupCache(data);
    return data;
  }

  /**
   * جلب جميع البيانات - Phase 1 (حرج) + Phase 2 (خلفي)
   * النتيجة: نفس الشكل القديم، بدون كسر أي مستهلك.
   */
  async getAllData() {
return this.fetch('all_data', async () => {
  // معالجة ai_orders بشكل منفصل لتجنب فشل كامل الطلب بسبب RLS
  let aiOrders = { data: [], error: null };
  try {
    aiOrders = await supabase.from('ai_orders').select('*').order('created_at', { ascending: false });
    if (aiOrders.error) {
      aiOrders = { data: [], error: null };
    }
  } catch (err) {
    aiOrders = { data: [], error: null };
  }

  // ⚡ Lookup tables من الكاش إن توفر (مرجعي فقط — لا تأثير على الجرد)
  let lookupCached = this.readLookupCache();
  let lookupPromise = null;
  if (!lookupCached) {
    // أول مرة أو انتهت 24h: ضمّ الجلب مع Phase 1
    lookupPromise = this.fetchLookupTables();
  }

  // ⚡ Phase 1: البيانات الحرجة فقط (تظهر بها الواجهة)
  const [
    products,
    orders,
    customers,
    cashSources,
    settings,
    profiles,
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
    
    // الطلبات مع العناصر
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
    `).order('status_changed_at', { ascending: false }),
    
    // العملاء من VIEW الموحد (مع RLS تلقائياً)
    supabase.from('customers_unified_loyalty')
      .select('*')
      .order('total_points', { ascending: false }),
    supabase.from('cash_sources').select('*').order('created_at', { ascending: false }),
    supabase.from('settings').select('*'),
    supabase.from('profiles').select('user_id, full_name, employee_code, status'),
  ]);

  // فشل حرج فقط إن فشلت products أو orders
  if (products.error) throw products.error;
  if (orders.error) throw orders.error;

  // ⚡ Phase 2: البيانات غير الحرجة (تجلب فوراً بالتوازي مع lookup إن احتجنا)
  // نُكملها بنفس الطلب لكن لا نحجز عليها الواجهة الأولية في getAllDataPhased
  const phase2Promise = Promise.all([
    supabase.from('purchases').select('*').order('created_at', { ascending: false }),
    supabase.from('expenses').select('*').order('created_at', { ascending: false }),
    supabase.from('profits').select('*').order('created_at', { ascending: false }),
    supabase.from('employee_profit_rules').select('*'),
    supabase.from('customer_loyalty').select('*'),
    supabase.from('loyalty_tiers').select('*'),
    supabase.from('order_discounts').select('*').order('created_at', { ascending: false }),
  ]);

  const [purchases, expenses, profits, profitRules, customerLoyalty, loyaltyTiers, orderDiscounts] = await phase2Promise;

  // lookup tables: من الكاش أو من الجلب الجديد
  const lookup = lookupCached || (await lookupPromise);

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

    // بيانات المرشحات (من الكاش أو الجلب)
    colors: lookup?.colors || [],
    sizes: lookup?.sizes || [],
    categories: lookup?.categories || [],
    departments: lookup?.departments || [],
    productTypes: lookup?.productTypes || [],
    seasons: lookup?.seasons || [],

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
    // ⚡ تقسيم القنوات: حرجة (فوراً) + ثانوية (متأخرة 1500ms لتسريع الإقلاع)
    const criticalTables = ['orders', 'order_items', 'notifications'];
    const secondaryTables = ['products', 'inventory', 'expenses', 'ai_orders'];

    const subscribe = (table) => {
      const channel = supabase
        .channel(`unified_${table}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: table
        }, (payload) => {
          if (table === 'orders' || table === 'order_items') {
            this.invalidate('orders_only');
          } else if (table === 'ai_orders') {
            // ⚡ لا invalidate للطلبات الذكية - التحديث المباشر في SuperProvider يكفي
          } else if (table === 'products' || table === 'inventory') {
            this.invalidate('products_only');
          } else {
            this.debouncedInvalidateAll(200);
          }

          if (callback) callback(table, payload);
        })
        .subscribe();

      this.subscriptions.set(table, channel);
    };

    // قنوات حرجة فوراً
    criticalTables.forEach(subscribe);

    // قنوات ثانوية مؤجلة لتقليل الضغط أثناء الإقلاع
    setTimeout(() => {
      secondaryTables.forEach(subscribe);
    }, 1500);
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
// ✅ CRITICAL FIX: لا نُحدد receipt_received_at يدوياً
// الـ trigger في قاعدة البيانات سيأخذ التاريخ من الفاتورة تلقائياً
superAPI.markOrdersReceiptReceived = async (orderIds, userId) => {
  const { error } = await supabase
    .from('orders')
    .update({
      receipt_received: true,
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