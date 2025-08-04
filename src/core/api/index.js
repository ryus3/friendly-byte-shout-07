/**
 * 🚀 النظام الموحد للاتصال بقاعدة البيانات
 * 
 * يستبدل جميع الـ Contexts المعقدة بطبقة API بسيطة وموحدة
 * - دالة واحدة لكل عملية (get, create, update, delete)
 * - إدارة مركزية للأخطاء والتحميل
 * - Real-time مدمج وبسيط
 * - كاش ذكي للبيانات
 */

import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

class UnifiedAPI {
  constructor() {
    this.cache = new Map();
    this.subscribers = new Map();
    this.loading = new Set();
  }

  /**
   * جلب البيانات مع كاش ذكي
   */
  async get(table, options = {}) {
    const { 
      filters = {}, 
      select = '*', 
      useCache = true,
      relations = []
    } = options;

    const cacheKey = `${table}_${JSON.stringify({ filters, select, relations })}`;
    
    // استخدام الكاش إذا كان متاحاً
    if (useCache && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // تسجيل حالة التحميل
    this.loading.add(cacheKey);

    try {
      let query = supabase.from(table).select(select);

      // تطبيق الفلاتر
      Object.entries(filters).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          query = query.in(key, value);
        } else if (typeof value === 'object' && value !== null) {
          // فلاتر متقدمة مثل gte, lte, like
          Object.entries(value).forEach(([operator, val]) => {
            query = query[operator](key, val);
          });
        } else {
          query = query.eq(key, value);
        }
      });

      const { data, error } = await query;

      if (error) throw error;

      // حفظ في الكاش
      if (useCache) {
        this.cache.set(cacheKey, data);
      }

      return data;

    } catch (error) {
      console.error(`خطأ في جلب البيانات من ${table}:`, error);
      toast({
        title: "خطأ في جلب البيانات",
        description: error.message,
        variant: "destructive"
      });
      throw error;
    } finally {
      this.loading.delete(cacheKey);
    }
  }

  /**
   * إنشاء سجل جديد
   */
  async create(table, data, options = {}) {
    const { showToast = true, invalidateCache = true } = options;

    try {
      const { data: newRecord, error } = await supabase
        .from(table)
        .insert(data)
        .select()
        .single();

      if (error) throw error;

      // إبطال الكاش المرتبط
      if (invalidateCache) {
        this.invalidateTableCache(table);
      }

      // إشعار النجاح
      if (showToast) {
        toast({
          title: "تم بنجاح",
          description: "تم إضافة السجل الجديد",
          variant: "success"
        });
      }

      // إشعار المشتركين
      this.notifySubscribers(table, 'INSERT', newRecord);

      return newRecord;

    } catch (error) {
      console.error(`خطأ في إنشاء سجل في ${table}:`, error);
      if (showToast) {
        toast({
          title: "خطأ في الإنشاء",
          description: error.message,
          variant: "destructive"
        });
      }
      throw error;
    }
  }

  /**
   * تحديث سجل موجود
   */
  async update(table, id, data, options = {}) {
    const { showToast = true, invalidateCache = true } = options;

    try {
      const { data: updatedRecord, error } = await supabase
        .from(table)
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // إبطال الكاش المرتبط
      if (invalidateCache) {
        this.invalidateTableCache(table);
      }

      // إشعار النجاح
      if (showToast) {
        toast({
          title: "تم التحديث",
          description: "تم تحديث السجل بنجاح",
          variant: "success"
        });
      }

      // إشعار المشتركين
      this.notifySubscribers(table, 'UPDATE', updatedRecord);

      return updatedRecord;

    } catch (error) {
      console.error(`خطأ في تحديث سجل في ${table}:`, error);
      if (showToast) {
        toast({
          title: "خطأ في التحديث",
          description: error.message,
          variant: "destructive"
        });
      }
      throw error;
    }
  }

  /**
   * حذف سجل
   */
  async remove(table, id, options = {}) {
    const { showToast = true, invalidateCache = true } = options;

    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);

      if (error) throw error;

      // إبطال الكاش المرتبط
      if (invalidateCache) {
        this.invalidateTableCache(table);
      }

      // إشعار النجاح
      if (showToast) {
        toast({
          title: "تم الحذف",
          description: "تم حذف السجل بنجاح",
          variant: "success"
        });
      }

      // إشعار المشتركين
      this.notifySubscribers(table, 'DELETE', { id });

      return true;

    } catch (error) {
      console.error(`خطأ في حذف سجل من ${table}:`, error);
      if (showToast) {
        toast({
          title: "خطأ في الحذف",
          description: error.message,
          variant: "destructive"
        });
      }
      throw error;
    }
  }

  /**
   * اشتراك في تحديثات real-time لجدول
   */
  subscribe(table, callback) {
    if (!this.subscribers.has(table)) {
      this.subscribers.set(table, new Set());
      
      // إعداد real-time subscription
      supabase
        .channel(`${table}_changes`)
        .on('postgres_changes', 
          { event: '*', schema: 'public', table },
          (payload) => {
            this.notifySubscribers(table, payload.eventType, payload.new || payload.old);
          }
        )
        .subscribe();
    }

    this.subscribers.get(table).add(callback);

    // إرجاع دالة إلغاء الاشتراك
    return () => {
      const tableSubscribers = this.subscribers.get(table);
      if (tableSubscribers) {
        tableSubscribers.delete(callback);
        if (tableSubscribers.size === 0) {
          this.subscribers.delete(table);
          // إلغاء real-time subscription
          supabase.removeChannel(`${table}_changes`);
        }
      }
    };
  }

  /**
   * إشعار المشتركين بالتغييرات
   */
  notifySubscribers(table, event, data) {
    const tableSubscribers = this.subscribers.get(table);
    if (tableSubscribers) {
      tableSubscribers.forEach(callback => {
        try {
          callback({ event, data, table });
        } catch (error) {
          console.error('خطأ في إشعار المشترك:', error);
        }
      });
    }
  }

  /**
   * إبطال كاش جدول معين
   */
  invalidateTableCache(table) {
    const keysToDelete = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${table}_`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * مسح الكاش بالكامل
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * التحقق من حالة التحميل
   */
  isLoading(table, filters = {}) {
    const cacheKey = `${table}_${JSON.stringify(filters)}`;
    return this.loading.has(cacheKey);
  }
}

// إنشاء instance وحيد
export const api = new UnifiedAPI();

// Hook مخصص لاستخدام الـ API
export const useAPI = () => {
  return api;
};

export default api;