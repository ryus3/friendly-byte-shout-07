/**
 * ========================================
 * نظام API موحد ثوري - استبدال كل الـ contexts المبعثرة
 * جلب واحد، تخزين ذكي، أداء خارق
 * ========================================
 */

import { supabase } from '@/integrations/supabase/client';

// ===== نظام التخزين المؤقت الذكي =====
class SmartCache {
  constructor() {
    this.cache = new Map();
    this.lastFetch = new Map();
    this.subscribers = new Map();
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 دقائق
  }

  // تخزين ذكي مع تاريخ انتهاء الصلاحية
  set(key, data) {
    this.cache.set(key, data);
    this.lastFetch.set(key, Date.now());
    this.notifySubscribers(key, data);
  }

  // جلب من التخزين المؤقت مع فحص الصلاحية
  get(key) {
    const lastFetch = this.lastFetch.get(key);
    if (!lastFetch || Date.now() - lastFetch > this.CACHE_DURATION) {
      return null; // انتهت الصلاحية
    }
    return this.cache.get(key);
  }

  // اشتراك في تحديثات البيانات
  subscribe(key, callback) {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key).add(callback);
    
    // إرجاع دالة إلغاء الاشتراك
    return () => {
      const keySubscribers = this.subscribers.get(key);
      if (keySubscribers) {
        keySubscribers.delete(callback);
      }
    };
  }

  // إشعار المشتركين بالتحديثات
  notifySubscribers(key, data) {
    const keySubscribers = this.subscribers.get(key);
    if (keySubscribers) {
      keySubscribers.forEach(callback => callback(data));
    }
  }

  // حذف من التخزين المؤقت
  invalidate(key) {
    this.cache.delete(key);
    this.lastFetch.delete(key);
  }

  // تنظيف شامل
  clear() {
    this.cache.clear();
    this.lastFetch.clear();
  }
}

// إنشاء instance واحد من التخزين المؤقت
const cache = new SmartCache();

// ===== طبقة البيانات الموحدة =====
class UnifiedAPI {
  constructor() {
    this.loading = new Set();
    this.errors = new Map();
  }

  // ===== المنتجات =====
  async getProducts(filters = {}) {
    const cacheKey = `products_${JSON.stringify(filters)}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    if (this.loading.has(cacheKey)) {
      // انتظار الطلب الجاري
      return new Promise(resolve => {
        const unsubscribe = cache.subscribe(cacheKey, (data) => {
          unsubscribe();
          resolve(data);
        });
      });
    }

    try {
      this.loading.add(cacheKey);
      this.errors.delete('products');

      let query = supabase
        .from('products')
        .select(`
          *,
          product_variants (
            *,
            colors (id, name, hex_code),
            sizes (id, name)
          ),
          product_categories (
            categories (id, name)
          ),
          product_departments (
            departments (id, name, icon, color)
          ),
          inventory (
            id, quantity, reserved_quantity, min_stock_level
          )
        `)
        .eq('is_active', true);

      // تطبيق الفلاتر
      if (filters.department) {
        query = query.contains('product_departments.department_id', [filters.department]);
      }
      if (filters.category) {
        query = query.contains('product_categories.category_id', [filters.category]);
      }
      if (filters.search) {
        query = query.ilike('name', `%${filters.search}%`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      // معالجة البيانات وتحسينها
      const processedData = data.map(product => ({
        ...product,
        variants: product.product_variants || [],
        categories: product.product_categories?.map(pc => pc.categories) || [],
        departments: product.product_departments?.map(pd => pd.departments) || [],
        stock: product.inventory?.[0] || { quantity: 0, reserved_quantity: 0 },
        available_stock: (product.inventory?.[0]?.quantity || 0) - (product.inventory?.[0]?.reserved_quantity || 0)
      }));

      cache.set(cacheKey, processedData);
      return processedData;

    } catch (error) {
      this.errors.set('products', error.message);
      throw error;
    } finally {
      this.loading.delete(cacheKey);
    }
  }

  // ===== الطلبات =====
  async getOrders(filters = {}) {
    const cacheKey = `orders_${JSON.stringify(filters)}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
      this.loading.add(cacheKey);
      this.errors.delete('orders');

      let query = supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            product_variants (
              *,
              products (name, images),
              colors (name),
              sizes (name)
            )
          ),
          customers (id, name, phone, city, province)
        `);

      // تطبيق الفلاتر
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.date_from) {
        query = query.gte('created_at', filters.date_from);
      }
      if (filters.date_to) {
        query = query.lte('created_at', filters.date_to);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      // معالجة البيانات
      const processedData = data.map(order => ({
        ...order,
        items: order.order_items || [],
        customer: order.customers || null,
        total_items: order.order_items?.reduce((sum, item) => sum + item.quantity, 0) || 0
      }));

      cache.set(cacheKey, processedData);
      return processedData;

    } catch (error) {
      this.errors.set('orders', error.message);
      throw error;
    } finally {
      this.loading.delete(cacheKey);
    }
  }

  // ===== العملاء =====
  async getCustomers(filters = {}) {
    const cacheKey = `customers_${JSON.stringify(filters)}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
      this.loading.add(cacheKey);
      this.errors.delete('customers');

      let query = supabase
        .from('customers')
        .select(`
          *,
          orders!inner (
            id, total_amount, status, created_at
          ),
          customer_loyalty (
            total_points, total_spent, total_orders
          )
        `);

      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      // معالجة البيانات وحساب الإحصائيات
      const processedData = data.map(customer => {
        const completedOrders = customer.orders?.filter(o => o.status === 'completed') || [];
        return {
          ...customer,
          total_orders: customer.orders?.length || 0,
          completed_orders: completedOrders.length,
          total_spent: completedOrders.reduce((sum, order) => sum + order.total_amount, 0),
          loyalty: customer.customer_loyalty?.[0] || { total_points: 0, total_spent: 0 },
          last_order: customer.orders?.[0]?.created_at || null
        };
      });

      cache.set(cacheKey, processedData);
      return processedData;

    } catch (error) {
      this.errors.set('customers', error.message);
      throw error;
    } finally {
      this.loading.delete(cacheKey);
    }
  }

  // ===== البيانات المالية =====
  async getFinancialData(period = 'all') {
    const cacheKey = `financial_${period}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
      this.loading.add(cacheKey);
      this.errors.delete('financial');

      // جلب البيانات المالية من مصادر متعددة
      const [ordersResult, expensesResult, profitsResult, cashResult] = await Promise.all([
        supabase.from('orders').select('total_amount, status, created_at').eq('receipt_received', true),
        supabase.from('expenses').select('amount, category, created_at').eq('status', 'approved'),
        supabase.from('profits').select('profit_amount, employee_profit, status, created_at'),
        supabase.from('cash_sources').select('name, current_balance')
      ]);

      if (ordersResult.error) throw ordersResult.error;
      if (expensesResult.error) throw expensesResult.error;
      if (profitsResult.error) throw profitsResult.error;
      if (cashResult.error) throw cashResult.error;

      // حساب الإحصائيات المالية
      const completedOrders = ordersResult.data?.filter(o => o.status === 'completed') || [];
      const totalRevenue = completedOrders.reduce((sum, o) => sum + o.total_amount, 0);
      const totalExpenses = expensesResult.data?.reduce((sum, e) => sum + e.amount, 0) || 0;
      const totalProfits = profitsResult.data?.filter(p => p.status === 'settled').reduce((sum, p) => sum + p.profit_amount, 0) || 0;
      const mainCashBalance = cashResult.data?.find(c => c.name === 'القاصة الرئيسية')?.current_balance || 0;

      const financialData = {
        revenue: {
          total: totalRevenue,
          orders_count: completedOrders.length
        },
        expenses: {
          total: totalExpenses,
          by_category: expensesResult.data?.reduce((acc, exp) => {
            acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
            return acc;
          }, {}) || {}
        },
        profits: {
          total: totalProfits,
          pending: profitsResult.data?.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.profit_amount, 0) || 0
        },
        cash: {
          main_balance: mainCashBalance,
          sources: cashResult.data || []
        },
        net_profit: totalRevenue - totalExpenses
      };

      cache.set(cacheKey, financialData);
      return financialData;

    } catch (error) {
      this.errors.set('financial', error.message);
      throw error;
    } finally {
      this.loading.delete(cacheKey);
    }
  }

  // ===== العمليات (CRUD) =====
  async createOrder(orderData) {
    try {
      // إنشاء رقم الطلب
      const { data: orderNumber } = await supabase.rpc('generate_order_number');
      
      const newOrder = {
        ...orderData,
        order_number: orderNumber,
        status: 'pending'
      };

      const { data, error } = await supabase
        .from('orders')
        .insert(newOrder)
        .select()
        .single();

      if (error) throw error;

      // حجز المخزون
      for (const item of orderData.items || []) {
        await supabase.rpc('reserve_stock_for_order', {
          p_product_id: item.product_id,
          p_variant_id: item.variant_id,
          p_quantity: item.quantity
        });
      }

      // تنظيف التخزين المؤقت
      cache.invalidate('orders');
      cache.clear(); // تنظيف شامل للتأكد

      return data;

    } catch (error) {
      throw error;
    }
  }

  async updateProduct(productId, updates) {
    try {
      const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', productId)
        .select()
        .single();

      if (error) throw error;

      // تنظيف التخزين المؤقت
      cache.invalidate('products');
      
      return data;

    } catch (error) {
      throw error;
    }
  }

  // ===== وظائف المساعدة =====
  invalidateCache(keys) {
    if (Array.isArray(keys)) {
      keys.forEach(key => cache.invalidate(key));
    } else {
      cache.invalidate(keys);
    }
  }

  clearAllCache() {
    cache.clear();
  }

  getLoadingState(operation) {
    return this.loading.has(operation);
  }

  getError(operation) {
    return this.errors.get(operation);
  }

  // ===== اشتراك في التحديثات الفورية =====
  subscribeToUpdates(table, callback) {
    return cache.subscribe(table, callback);
  }
}

// إنشاء instance واحد من API
export const api = new UnifiedAPI();

// ===== Hook للاستخدام في المكونات =====
export const useUnifiedAPI = () => {
  return {
    // البيانات
    getProducts: api.getProducts.bind(api),
    getOrders: api.getOrders.bind(api),
    getCustomers: api.getCustomers.bind(api),
    getFinancialData: api.getFinancialData.bind(api),
    
    // العمليات
    createOrder: api.createOrder.bind(api),
    updateProduct: api.updateProduct.bind(api),
    
    // المساعدة
    invalidateCache: api.invalidateCache.bind(api),
    clearCache: api.clearAllCache.bind(api),
    getLoadingState: api.getLoadingState.bind(api),
    getError: api.getError.bind(api),
    subscribeToUpdates: api.subscribeToUpdates.bind(api)
  };
};

export default api;