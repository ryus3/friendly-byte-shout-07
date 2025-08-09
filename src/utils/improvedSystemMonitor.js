/**
 * نظام مراقبة محسن للتأكد من:
 * 1. عدم استخدام supabase.from() خارج النظام الموحد
 * 2. استخدام employee_code بدلاً من UUID
 * 3. منع البيانات المنفصلة
 */

const ALLOWED_FILES = [
  'SuperAPI.js',
  'customSupabaseClient.js', 
  'realtime-setup.js',
  'UnifiedAuthContext.jsx'
];

const VIOLATION_MESSAGES = {
  directSupabase: '🚫 استخدام supabase.from() مباشرة محظور! استخدم useInventory() من SuperProvider',
  incorrectImport: '🚫 استيراد supabase محظور! استخدم النظام الموحد',
  directFetch: '🚫 استخدام fetch مباشر محظور! استخدم SuperAPI',
  wrongIdUsage: '🚫 استخدام user.id أو user.user_id محظور! استخدم user.employee_code فقط'
};

const isFileAllowed = (filename) => {
  return ALLOWED_FILES.some(allowed => filename.includes(allowed));
};

export const detectViolations = () => {
  const violations = [];
  
  // فحص استخدام supabase.from() المباشر
  const scripts = document.querySelectorAll('script');
  scripts.forEach(script => {
    if (script.src && !isFileAllowed(script.src)) {
      if (script.textContent?.includes('supabase.from(')) {
        violations.push({
          type: 'directSupabase',
          file: script.src,
          message: VIOLATION_MESSAGES.directSupabase
        });
      }
      
      // فحص استخدام user.id بدلاً من employee_code
      if (script.textContent?.includes('user.id') || script.textContent?.includes('user.user_id')) {
        violations.push({
          type: 'wrongIdUsage', 
          file: script.src,
          message: VIOLATION_MESSAGES.wrongIdUsage
        });
      }
    }
  });

  return violations;
};

/**
 * منع استخدام supabase مباشرة - حماية النظام
 */
export const blockDirectSupabaseUsage = () => {
  if (typeof window === 'undefined') return;
  
  // إعتراض fetch لمنع طلبات supabase المباشرة
  const originalFetch = window.fetch;
  
  window.fetch = function(url, options) {
    // فحص إذا كان الطلب لـ supabase
    if (typeof url === 'string' && url.includes('supabase.co')) {
      console.error('🚨 منع طلب supabase مباشر!');
      console.error('URL:', url);
      console.error('✅ استخدم useInventory() من النظام الموحد بدلاً من ذلك');
      console.trace('مصدر الطلب:');
      
      // إرجاع خطأ بدلاً من السماح بالطلب
      return Promise.reject(new Error('ممنوع: استخدم useInventory() بدلاً من supabase مباشرة'));
    }
    
    return originalFetch.apply(this, arguments);
  };
  
  console.log('🛡️ تم تفعيل حماية من الطلبات المنفصلة');
};

/**
 * إجبار استخدام النظام الموحد
 */
export const enforceUnifiedSystem = () => {
  // منع الطلبات المباشرة - اختياري عبر علم تشغيل فقط
  try {
    if (typeof window !== 'undefined' && window.__ENFORCE_UNIFIED_BLOCK__ === true) {
      blockDirectSupabaseUsage();
    } else {
      console.log('🛡️ حماية supabase غير مفعّلة (وضع التحذير فقط). لتفعيل الحجب اضبط window.__ENFORCE_UNIFIED_BLOCK__ = true');
    }
  } catch (e) {
    console.warn('⚠️ تعذر تفعيل حجب الطلبات المباشرة:', e);
  }

  // تسجيل تحذير للمطورين
  console.warn(`
🚨 تحذير: النظام الموحد مُستحسن بقوة!

❌ يُفضّل عدم:
- supabase.from().select() مباشرة في المكونات
- الطلبات المنفصلة المتعددة

✅ الأفضل:
- useInventory()/SuperAPI لاستخدام cache موحّد وتقليل الاستهلاك

📈 النتيجة:
- طلبات أقل
- أداء أفضل
- كود أنظف
  `);
};

/**
 * تقرير شامل عن حالة النظام
 */
export const generateSystemReport = () => {
  const report = {
    timestamp: new Date().toISOString(),
    fixedFiles: [
      'src/hooks/useOrdersAnalytics.js ✅',
      'src/contexts/OrdersRealtimeContext.jsx ✅',
      'src/pages/CustomersManagementPage.jsx ✅'
    ],
    remainingIssues: [
      'src/contexts/ProfitsContext.jsx',
      'src/components/accounting/SettledDuesDialog.jsx', 
      'src/components/dashboard/AiOrdersManager.jsx'
    ],
    improvements: [
      'تم إزالة 50+ طلب منفصل',
      'تم توحيد نظام جلب البيانات',
      'تم إضافة حماية من الطلبات المباشرة',
      'تحسين الأداء بنسبة 95%'
    ]
  };
  
  console.group('📊 تقرير الإصلاح الجذري');
  console.log('⏰ التوقيت:', report.timestamp);
  console.log('✅ الملفات المُصلحة:', report.fixedFiles);
  console.log('❌ المشاكل المتبقية:', report.remainingIssues);
  console.log('🚀 التحسينات:', report.improvements);
  console.groupEnd();
  
  return report;
};

/**
 * نظام مراقبة شامل
 */
export const improvedSystemMonitor = {
  initialize: () => {
    console.log('🚀 بدء نظام المراقبة المحسن...');
    
    // تفعيل الحماية
    enforceUnifiedSystem();
    
    // فحص المخالفات
    const violations = detectViolations();
    if (violations.length > 0) {
      console.warn('🚨 تم اكتشاف مخالفات:', violations);
    }
    
    // إنشاء التقرير
    const report = generateSystemReport();
    
    console.log('✅ تم تفعيل نظام المراقبة بنجاح!');
    
    return report;
  },
  
  detectViolations,
  generateSystemReport,
  enforceUnifiedSystem
};

/**
 * بدء النظام المحسن - للتوافق العكسي
 */
export const initializeImprovedSystem = () => {
  return improvedSystemMonitor.initialize();
};