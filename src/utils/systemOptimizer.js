/**
 * نظام تحسين وفحص الموقع الشامل
 * System Optimizer & Health Checker
 */

import { supabase } from '@/lib/customSupabaseClient';

class SystemOptimizer {
  constructor() {
    this.healthReport = {
      performance: {},
      dataIntegrity: {},
      security: {},
      userExperience: {}
    };
  }

  /**
   * فحص شامل للنظام
   */
  async runComprehensiveCheck() {
    console.log('🔍 بدء الفحص الشامل للنظام...');
    
    const results = await Promise.allSettled([
      this.checkDatabaseIntegrity(),
      this.checkPerformanceMetrics(),
      this.checkSecuritySettings(),
      this.optimizeQueries(),
      this.cleanupUnusedData(),
      this.validateDataRelations()
    ]);

    console.log('✅ انتهى الفحص الشامل:', results);
    return this.generateHealthReport(results);
  }

  /**
   * فحص تكامل قاعدة البيانات
   */
  async checkDatabaseIntegrity() {
    const issues = [];
    
    try {
      // فحص المنتجات بدون متغيرات
      const { data: productsWithoutVariants } = await supabase
        .from('products')
        .select('id, name')
        .eq('is_active', true)
        .not('id', 'in', `(SELECT DISTINCT product_id FROM product_variants WHERE is_active = true)`);

      if (productsWithoutVariants?.length > 0) {
        issues.push({
          type: 'missing_variants',
          count: productsWithoutVariants.length,
          items: productsWithoutVariants.slice(0, 5)
        });
      }

      // فحص المتغيرات بدون مخزون
      const { data: variantsWithoutInventory } = await supabase
        .from('product_variants')
        .select('id, barcode')
        .eq('is_active', true)
        .not('id', 'in', `(SELECT DISTINCT variant_id FROM inventory WHERE variant_id IS NOT NULL)`);

      if (variantsWithoutInventory?.length > 0) {
        issues.push({
          type: 'missing_inventory',
          count: variantsWithoutInventory.length,
          items: variantsWithoutInventory.slice(0, 5)
        });
      }

      // فحص الألوان والأحجام غير المستخدمة
      const unusedColors = await this.findUnusedVariants('colors', 'color_id');
      const unusedSizes = await this.findUnusedVariants('sizes', 'size_id');

      this.healthReport.dataIntegrity = {
        issues,
        unusedColors,
        unusedSizes,
        status: issues.length === 0 ? 'healthy' : 'needs_attention'
      };

    } catch (error) {
      console.error('خطأ في فحص تكامل البيانات:', error);
      this.healthReport.dataIntegrity = { error: error.message };
    }
  }

  /**
   * البحث عن متغيرات غير مستخدمة
   */
  async findUnusedVariants(table, columnName) {
    try {
      const { data: unused } = await supabase
        .from(table)
        .select('id, name')
        .not('id', 'in', `(SELECT DISTINCT ${columnName} FROM product_variants WHERE ${columnName} IS NOT NULL AND is_active = true)`);
      
      return unused || [];
    } catch (error) {
      console.error(`خطأ في البحث عن ${table} غير المستخدمة:`, error);
      return [];
    }
  }

  /**
   * فحص مقاييس الأداء
   */
  async checkPerformanceMetrics() {
    try {
      const startTime = performance.now();
      
      // قياس سرعة الاستعلامات الأساسية
      const queries = await Promise.allSettled([
        supabase.from('products').select('count', { count: 'exact', head: true }),
        supabase.from('orders').select('count', { count: 'exact', head: true }),
        supabase.from('inventory').select('count', { count: 'exact', head: true })
      ]);

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      this.healthReport.performance = {
        queryTime: totalTime,
        status: totalTime < 1000 ? 'excellent' : totalTime < 3000 ? 'good' : 'slow',
        queries: queries.map((q, i) => ({
          table: ['products', 'orders', 'inventory'][i],
          success: q.status === 'fulfilled',
          time: q.value?.statusText || 'failed'
        }))
      };

    } catch (error) {
      console.error('خطأ في فحص الأداء:', error);
      this.healthReport.performance = { error: error.message };
    }
  }

  /**
   * تحسين الاستعلامات وإزالة التكرار
   */
  async optimizeQueries() {
    try {
      // إزالة الطلبات المكررة
      const { data: duplicateOrders } = await supabase
        .from('orders')
        .select('order_number, count(*)')
        .group('order_number')
        .having('count(*) > 1');

      // إزالة المتغيرات المكررة
      const { data: duplicateVariants } = await supabase
        .from('product_variants')
        .select('product_id, color_id, size_id, count(*)')
        .group('product_id, color_id, size_id')
        .having('count(*) > 1');

      return {
        duplicateOrders: duplicateOrders?.length || 0,
        duplicateVariants: duplicateVariants?.length || 0
      };

    } catch (error) {
      console.error('خطأ في تحسين الاستعلامات:', error);
      return { error: error.message };
    }
  }

  /**
   * تنظيف البيانات غير المستخدمة
   */
  async cleanupUnusedData() {
    const cleanupResults = [];

    try {
      // حذف الإشعارات القديمة (أكثر من 30 يوم)
      const { data: oldNotifications, error } = await supabase
        .from('notifications')
        .delete()
        .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .select('id');

      if (!error && oldNotifications) {
        cleanupResults.push({
          type: 'old_notifications',
          cleaned: oldNotifications.length
        });
      }

      // حذف سجلات النسخ الاحتياطية القديمة
      const { data: oldBackups, error: backupError } = await supabase
        .from('system_backups')
        .delete()
        .lt('created_at', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString())
        .eq('is_auto_backup', true)
        .select('id');

      if (!backupError && oldBackups) {
        cleanupResults.push({
          type: 'old_backups',
          cleaned: oldBackups.length
        });
      }

      return cleanupResults;

    } catch (error) {
      console.error('خطأ في تنظيف البيانات:', error);
      return { error: error.message };
    }
  }

  /**
   * التحقق من العلاقات بين البيانات
   */
  async validateDataRelations() {
    const relationIssues = [];

    try {
      // فحص المتغيرات بألوان أو أحجام محذوفة
      const { data: orphanedVariants } = await supabase
        .from('product_variants')
        .select(`
          id, 
          barcode,
          color_id,
          size_id,
          colors(id, name),
          sizes(id, name)
        `)
        .eq('is_active', true);

      const orphaned = orphanedVariants?.filter(v => 
        !v.colors || !v.sizes
      ) || [];

      if (orphaned.length > 0) {
        relationIssues.push({
          type: 'orphaned_variants',
          count: orphaned.length,
          items: orphaned.slice(0, 5)
        });
      }

      return {
        issues: relationIssues,
        status: relationIssues.length === 0 ? 'healthy' : 'needs_repair'
      };

    } catch (error) {
      console.error('خطأ في فحص العلاقات:', error);
      return { error: error.message };
    }
  }

  /**
   * فحص إعدادات الأمان
   */
  async checkSecuritySettings() {
    try {
      // فحص وجود RLS على الجداول الحساسة
      const criticalTables = ['products', 'orders', 'financial_transactions', 'profits'];
      const securityStatus = [];

      for (const table of criticalTables) {
        try {
          // محاولة الوصول للجدول بدون مصادقة
          const { error } = await supabase
            .from(table)
            .select('count', { count: 'exact', head: true });

          securityStatus.push({
            table,
            protected: error?.code === 'PGRST116', // RLS enabled
            status: error ? 'protected' : 'exposed'
          });
        } catch (error) {
          securityStatus.push({
            table,
            error: error.message
          });
        }
      }

      this.healthReport.security = {
        tables: securityStatus,
        status: securityStatus.every(t => t.protected) ? 'secure' : 'vulnerable'
      };

    } catch (error) {
      console.error('خطأ في فحص الأمان:', error);
      this.healthReport.security = { error: error.message };
    }
  }

  /**
   * إنشاء تقرير صحة النظام
   */
  generateHealthReport(results) {
    const report = {
      timestamp: new Date().toISOString(),
      overall_status: 'healthy',
      issues: [],
      recommendations: [],
      performance: this.healthReport.performance,
      data_integrity: this.healthReport.dataIntegrity,
      security: this.healthReport.security
    };

    // تحديد الحالة العامة
    const hasIssues = results.some(r => r.status === 'rejected' || 
      (r.value && r.value.error));

    if (hasIssues) {
      report.overall_status = 'needs_attention';
    }

    // إضافة التوصيات
    if (this.healthReport.dataIntegrity?.unusedColors?.length > 0) {
      report.recommendations.push('يمكن حذف الألوان غير المستخدمة لتحسين الأداء');
    }

    if (this.healthReport.dataIntegrity?.unusedSizes?.length > 0) {
      report.recommendations.push('يمكن حذف الأحجام غير المستخدمة لتحسين الأداء');
    }

    if (this.healthReport.performance?.queryTime > 3000) {
      report.recommendations.push('سرعة الاستعلامات بطيئة، يُنصح بتحسين قاعدة البيانات');
    }

    return report;
  }

  /**
   * إصلاح المشاكل المكتشفة تلقائياً
   */
  async autoRepair() {
    console.log('🔧 بدء الإصلاح التلقائي...');
    
    const repairs = [];

    try {
      // 1. إصلاح المتغيرات بدون مخزون (يعمل بالفعل)
      const { data: variantsWithoutInventory } = await supabase
        .from('product_variants')
        .select('id, product_id')
        .eq('is_active', true)
        .not('id', 'in', `(SELECT DISTINCT variant_id FROM inventory WHERE variant_id IS NOT NULL)`);

      if (variantsWithoutInventory?.length > 0) {
        const currentUserId = '91484496-b887-44f7-9e5d-be9db5567604'; // معرف المدير الافتراضي
        
        for (const variant of variantsWithoutInventory) {
          const { error } = await supabase
            .from('inventory')
            .insert({
              product_id: variant.product_id,
              variant_id: variant.id,
              quantity: 0,
              min_stock: 0,
              reserved_quantity: 0,
              last_updated_by: currentUserId
            });
          
          if (!error) {
            console.log(`✅ تم إنشاء مخزون للمتغير: ${variant.id}`);
          }
        }
        
        repairs.push({
          type: 'created_missing_inventory',
          count: variantsWithoutInventory.length,
          message: `تم إنشاء سجلات مخزون لـ ${variantsWithoutInventory.length} متغير`
        });
      }

      // 2. تنظيف الإشعارات القديمة (يعمل بالفعل)
      const { data: deletedNotifications } = await supabase
        .from('notifications')
        .delete()
        .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .select('id');

      if (deletedNotifications?.length > 0) {
        repairs.push({
          type: 'cleaned_old_notifications',
          count: deletedNotifications.length,
          message: `تم حذف ${deletedNotifications.length} إشعار قديم`
        });
      }

      // 3. حذف المنتجات بدون متغيرات نشطة
      const { data: productsWithoutVariants } = await supabase
        .from('products')
        .select('id, name')
        .eq('is_active', true)
        .not('id', 'in', `(SELECT DISTINCT product_id FROM product_variants WHERE is_active = true)`);

      if (productsWithoutVariants?.length > 0) {
        for (const product of productsWithoutVariants) {
          await supabase
            .from('products')
            .update({ is_active: false })
            .eq('id', product.id);
        }
        
        repairs.push({
          type: 'deactivated_orphaned_products',
          count: productsWithoutVariants.length,
          message: `تم إلغاء تفعيل ${productsWithoutVariants.length} منتج بدون متغيرات نشطة`
        });
      }

      // 4. حذف النسخ الاحتياطية القديمة
      const { data: oldBackups } = await supabase
        .from('system_backups')
        .delete()
        .lt('created_at', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString())
        .eq('is_auto_backup', true)
        .select('id');

      if (oldBackups?.length > 0) {
        repairs.push({
          type: 'cleaned_old_backups',
          count: oldBackups.length,
          message: `تم حذف ${oldBackups.length} نسخة احتياطية قديمة`
        });
      }

      console.log('✅ انتهى الإصلاح التلقائي:', repairs);
      return {
        success: true,
        repairs,
        message: `تم الإصلاح بنجاح. ${repairs.length} عملية إصلاح تمت.`
      };

    } catch (error) {
      console.error('❌ خطأ في الإصلاح التلقائي:', error);
      return { 
        success: false, 
        error: error.message,
        message: 'فشل في الإصلاح التلقائي'
      };
    }
  }
}

// إنشاء instance مشترك
export const systemOptimizer = new SystemOptimizer();

// دوال مساعدة للاستخدام السريع
export const runSystemCheck = () => systemOptimizer.runComprehensiveCheck();
export const repairSystem = () => systemOptimizer.autoRepair();
export const getHealthStatus = () => systemOptimizer.healthReport;