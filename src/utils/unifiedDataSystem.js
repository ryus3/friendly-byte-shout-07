/**
 * نظام توحيد جلب البيانات - يمنع الطلبات المنفصلة
 * جميع الملفات يجب أن تستخدم هذا النظام فقط
 */

import { useInventory } from '@/contexts/InventoryContext';
import { createSimpleFilter, getSimpleEmployeeId } from './simpleIdSystem';
import devLog from '@/lib/devLogger';

/**
 * Hook موحد للحصول على البيانات (يمنع الطلبات المنفصلة)
 * @returns {Object} - جميع البيانات من النظام الموحد
 */
export const useUnifiedData = () => {
  const inventoryData = useInventory();
  
  // تحذير إذا تم استدعاء supabase مباشرة في ملف آخر
  if (typeof window !== 'undefined') {
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      const url = args[0];
      if (typeof url === 'string' && url.includes('supabase.co')) {
        devLog.warn('⚠️ استخدام supabase مباشر! يجب استخدام useUnifiedData() بدلاً من ذلك');
        console.trace(); // طباعة stack trace لمعرفة المصدر
      }
      return originalFetch.apply(this, args);
    };
  }
  
  return inventoryData;
};

/**
 * دالة للحصول على بيانات مفلترة حسب المستخدم الحالي
 * @param {Array} data - البيانات الخام
 * @param {Object} user - المستخدم الحالي
 * @param {boolean} isAdmin - هل المستخدم مدير
 * @param {string} filterColumn - اسم العمود للفلترة
 * @returns {Array} - البيانات المفلترة
 */
export const getFilteredData = (data, user, isAdmin, filterColumn = 'created_by') => {
  if (!Array.isArray(data)) return [];
  
  // المدير يرى كل شيء
  if (isAdmin) return data;
  
  const employeeId = getSimpleEmployeeId(user);
  if (!employeeId) return [];
  
  // فلترة البيانات حسب معرف الموظف
  return data.filter(item => item[filterColumn] === employeeId);
};

/**
 * منع استخدام supabase مباشرة - يجب استخدام النظام الموحد
 */
export const preventDirectSupabaseUsage = () => {
  if (typeof window === 'undefined') return;
  
  // إعتراض أي محاولة لاستخدام supabase مباشرة
  const originalSupabase = window.supabase;
  
  if (originalSupabase) {
    window.supabase = new Proxy(originalSupabase, {
      get(target, prop) {
        if (prop === 'from') {
          console.error('❌ منع استخدام supabase.from() مباشرة!');
          console.error('✅ استخدم useUnifiedData() بدلاً من ذلك');
          console.trace();
          
          // إرجاع دالة وهمية تعرض رسالة خطأ
          return () => ({
            select: () => {
              throw new Error('استخدم useUnifiedData() بدلاً من supabase.from()');
            }
          });
        }
        
        return target[prop];
      }
    });
  }
};

/**
 * فحص الملفات التي تستخدم supabase مباشرة
 * @returns {Array} - قائمة بالملفات المخالفة
 */
export const detectDirectSupabaseUsage = () => {
  const violations = [];
  
  // فحص كود JavaScript للبحث عن استخدام مباشر لـ supabase
  const scripts = document.querySelectorAll('script');
  
  scripts.forEach(script => {
    if (script.src && script.src.includes('supabase')) return;
    
    const content = script.textContent || script.innerHTML;
    if (content.includes('supabase.from(') && !content.includes('useUnifiedData')) {
      violations.push({
        type: 'script',
        content: content.substring(0, 100) + '...'
      });
    }
  });
  
  return violations;
};

/**
 * تقرير عن استخدام البيانات في النظام
 */
export const generateDataUsageReport = () => {
  const report = {
    timestamp: new Date().toISOString(),
    violations: detectDirectSupabaseUsage(),
    recommendations: []
  };
  
  if (report.violations.length > 0) {
    report.recommendations.push('يجب تحديث الملفات لاستخدام useUnifiedData()');
    report.recommendations.push('إزالة جميع استدعاءات supabase.from() المباشرة');
    report.recommendations.push('استخدام النظام الموحد للبيانات');
  } else {
    report.recommendations.push('النظام يستخدم البيانات بشكل موحد ✅');
  }
  
  console.group('📊 تقرير استخدام البيانات');
  devLog.log('التاريخ:', report.timestamp);
  devLog.log('المخالفات:', report.violations.length);
  devLog.log('التوصيات:', report.recommendations);
  console.groupEnd();
  
  return report;
};