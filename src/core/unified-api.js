/**
 * نظام API موحد ذكي - يلغي كل الفوضى الحالية
 * جلب واحد، تخزين ذكي، أداء خرافي
 */

import { supabase } from '@/integrations/supabase/client';

class UnifiedAPI {
  constructor() {
    this.cache = new Map();
    this.loading = new Set();
    this.subscriptions = new Map();
    this.lastUpdate = new Map();
    
    // فترة انتهاء الصلاحية للذاكرة المؤقتة (5 دقائق)
    this.cacheExpiry = 5 * 60 * 1000;
    
    console.log('🚀 نظام API الموحد مُهيّأ ومستعد');
  }

  /**
   * جلب البيانات مع تخزين ذكي
   */
  async fetch(key, queryFn, options = {}) {
    const { force = false, ttl = this.cacheExpiry } = options;
    
    // التحقق من الذاكرة المؤقتة
    if (!force && this.isCacheValid(key, ttl)) {
      console.log(`📋 استخدام البيانات المحفوظة لـ: ${key}`);
      return this.cache.get(key);
    }

    // منع الطلبات المتكررة
    if (this.loading.has(key)) {
      console.log(`⏳ انتظار طلب جاري لـ: ${key}`);
      return new Promise((resolve) => {
        const checkCache = () => {
          if (!this.loading.has(key)) {
            resolve(this.cache.get(key));
          } else {
            setTimeout(checkCache, 100);
          }
        };
        checkCache();
      });
    }

    try {
      this.loading.add(key);
      console.log(`🔄 جلب بيانات جديدة لـ: ${key}`);
      
      const result = await queryFn();
      
      // حفظ في الذاكرة المؤقتة
      this.cache.set(key, result);
      this.lastUpdate.set(key, Date.now());
      
      console.log(`✅ تم حفظ البيانات لـ: ${key}`);
      return result;
      
    } catch (error) {
      console.error(`❌ خطأ في جلب ${key}:`, error);
      throw error;
    } finally {
      this.loading.delete(key);
    }
  }

  /**
   * التحقق من صحة الذاكرة المؤقتة
   */
  isCacheValid(key, ttl) {
    if (!this.cache.has(key)) return false;
    
    const lastUpdate = this.lastUpdate.get(key);
    if (!lastUpdate) return false;
    
    return (Date.now() - lastUpdate) < ttl;
  }

  /**
   * إلغاء الذاكرة المؤقتة
   */
  invalidateCache(key) {
    if (key) {
      this.cache.delete(key);
      this.lastUpdate.delete(key);
      console.log(`🗑️ تم إلغاء ذاكرة: ${key}`);
    } else {
      this.cache.clear();
      this.lastUpdate.clear();
      console.log('🗑️ تم إلغاء كامل الذاكرة المؤقتة');
    }
  }

  /**
   * اشتراك Realtime ذكي (لا تكرار)
   */
  subscribeRealtime(table, callback, filter = {}) {
    const subKey = `${table}_${JSON.stringify(filter)}`;
    
    if (this.subscriptions.has(subKey)) {
      console.log(`📡 اشتراك موجود لـ: ${subKey}`);
      return this.subscriptions.get(subKey);
    }

    console.log(`📡 إنشاء اشتراك جديد لـ: ${subKey}`);
    
    const channel = supabase
      .channel(`unified_${subKey}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: table,
        ...filter
      }, (payload) => {
        console.log(`🔄 تحديث Realtime لـ ${table}:`, payload);
        this.invalidateCache(table);
        callback(payload);
      })
      .subscribe();

    this.subscriptions.set(subKey, channel);
    return channel;
  }

  /**
   * إلغاء اشتراك Realtime
   */
  unsubscribeRealtime(table, filter = {}) {
    const subKey = `${table}_${JSON.stringify(filter)}`;
    const channel = this.subscriptions.get(subKey);
    
    if (channel) {
      supabase.removeChannel(channel);
      this.subscriptions.delete(subKey);
      console.log(`📡❌ تم إلغاء اشتراك: ${subKey}`);
    }
  }

  // =============
  // API للبيانات الأساسية
  // =============

  /**
   * المنتجات (كاملة مع كل شيء)
   */
  async getProducts(filters = {}) {
    return this.fetch('products', async () => {
      const query = supabase
        .from('products')
        .select(`
          *,
          variants:product_variants (
            *,
            colors (id, name, hex_color),
            sizes (id, name),
            inventory (quantity, min_stock, reserved_quantity, location)
          ),
          categories:product_categories (categories (id, name)),
          product_types:product_product_types (product_types (id, name)),
          departments:product_departments (departments (id, name))
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      
      return data || [];
    });
  }

  /**
   * الطلبات (كاملة مع العناصر)
   */
  async getOrders(filters = {}) {
    return this.fetch('orders', async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products (id, name, images),
            product_variants (
              id, price, cost_price, images,
              colors (name, hex_color),
              sizes (name)
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    });
  }

  /**
   * المشتريات
   */
  async getPurchases() {
    return this.fetch('purchases', async () => {
      const { data, error } = await supabase
        .from('purchases')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    });
  }

  /**
   * العملاء
   */
  async getCustomers() {
    return this.fetch('customers', async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    });
  }

  /**
   * المصاريف
   */
  async getExpenses() {
    return this.fetch('expenses', async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    });
  }

  /**
   * مصادر النقد
   */
  async getCashSources() {
    return this.fetch('cash_sources', async () => {
      const { data, error } = await supabase
        .from('cash_sources')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    });
  }

  /**
   * الأرباح
   */
  async getProfits() {
    return this.fetch('profits', async () => {
      const { data, error } = await supabase
        .from('profits')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    });
  }

  /**
   * بيانات المتغيرات (ألوان، أحجام، أقسام...)
   */
  async getVariantsData() {
    return this.fetch('variants_data', async () => {
      const [colors, sizes, categories, departments, productTypes, seasons] = await Promise.all([
        supabase.from('colors').select('*').order('name'),
        supabase.from('sizes').select('*').order('name'),
        supabase.from('categories').select('*').order('name'),
        supabase.from('departments').select('*').order('name'),
        supabase.from('product_types').select('*').order('name'),
        supabase.from('seasons_occasions').select('*').order('name')
      ]);

      return {
        colors: colors.data || [],
        sizes: sizes.data || [],
        categories: categories.data || [],
        departments: departments.data || [],
        productTypes: productTypes.data || [],
        seasons: seasons.data || []
      };
    });
  }

  /**
   * بيانات النظام والإعدادات
   */
  async getSystemData() {
    return this.fetch('system_data', async () => {
      const [settings, employeeRules] = await Promise.all([
        supabase.from('settings').select('*'),
        supabase.from('employee_profit_rules').select('*')
      ]);

      return {
        settings: settings.data || [],
        employeeRules: employeeRules.data || []
      };
    });
  }

  // =============
  // العمليات (CRUD)
  // =============

  /**
   * إنشاء طلب
   */
  async createOrder(orderData) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (error) throw error;
      
      // إلغاء ذاكرة الطلبات لتحديثها
      this.invalidateCache('orders');
      
      return data;
    } catch (error) {
      console.error('❌ خطأ في إنشاء الطلب:', error);
      throw error;
    }
  }

  /**
   * تحديث طلب
   */
  async updateOrder(orderId, updates) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw error;
      
      this.invalidateCache('orders');
      return data;
    } catch (error) {
      console.error('❌ خطأ في تحديث الطلب:', error);
      throw error;
    }
  }

  /**
   * إضافة مصروف
   */
  async addExpense(expenseData) {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .insert(expenseData)
        .select()
        .single();

      if (error) throw error;
      
      this.invalidateCache('expenses');
      this.invalidateCache('cash_sources');
      
      return data;
    } catch (error) {
      console.error('❌ خطأ في إضافة المصروف:', error);
      throw error;
    }
  }

  /**
   * تحديث المخزون
   */
  async updateInventory(variantId, quantity) {
    try {
      const { data, error } = await supabase
        .from('inventory')
        .update({ quantity })
        .eq('variant_id', variantId)
        .select()
        .single();

      if (error) throw error;
      
      this.invalidateCache('products');
      return data;
    } catch (error) {
      console.error('❌ خطأ في تحديث المخزون:', error);
      throw error;
    }
  }
}

// إنشاء نسخة واحدة مشتركة
export const unifiedAPI = new UnifiedAPI();

// الصادرات السهلة
export const {
  fetch: fetchData,
  invalidateCache,
  subscribeRealtime,
  unsubscribeRealtime,
  getProducts,
  getOrders,
  getPurchases,
  getCustomers,
  getExpenses,
  getCashSources,
  getProfits,
  getVariantsData,
  getSystemData,
  createOrder,
  updateOrder,
  addExpense,
  updateInventory
} = unifiedAPI;

export default unifiedAPI;