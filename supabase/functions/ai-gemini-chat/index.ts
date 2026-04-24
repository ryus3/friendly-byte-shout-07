import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.30.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// تكوين نماذج Gemini المتاحة مع الكوتات المجانية والذكاء المحسن
const GEMINI_MODELS = [
  {
    name: 'gemini-2.5-flash',
    dailyLimit: 1500,
    minuteLimit: 15,
    priority: 1,
    useCase: 'general',
    description: 'الأسرع والأكثر كفاءة للمحادثات العامة',
    intelligence_level: 'standard',
    ryus_optimized: true
  },
  {
    name: 'gemini-2.5-flash-lite',
    dailyLimit: 1500,
    minuteLimit: 15,
    priority: 2,
    useCase: 'simple',
    description: 'نسخة مخففة للطلبات البسيطة',
    intelligence_level: 'basic',
    ryus_optimized: true
  },
  {
    name: 'gemini-1.5-flash',
    dailyLimit: 1500,
    minuteLimit: 15,
    priority: 3,
    useCase: 'general',
    description: 'نسخة ثابتة ومجربة',
    intelligence_level: 'standard',
    ryus_optimized: true
  },
  {
    name: 'gemini-2.5-pro',
    dailyLimit: 50,
    minuteLimit: 2,
    priority: 4,
    useCase: 'complex',
    description: 'للطلبات المعقدة وتحليل البيانات',
    intelligence_level: 'advanced',
    ryus_optimized: true
  },
  {
    name: 'gemini-1.5-pro',
    dailyLimit: 50,
    minuteLimit: 2,
    priority: 5,
    useCase: 'complex',
    description: 'نسخة احتياطية للطلبات المعقدة',
    intelligence_level: 'advanced',
    ryus_optimized: true
  },
  {
    name: 'gemini-2.0-flash',
    dailyLimit: 50,
    minuteLimit: 10,
    priority: 6,
    useCase: 'experimental',
    description: 'نسخة تجريبية للميزات الجديدة',
    intelligence_level: 'experimental',
    ryus_optimized: true
  }
];

// نظام الذاكرة الذكية لـ RYUS
let conversationMemory = new Map();
let customerPatterns = new Map();
let productSuggestionCache = new Map();

// متغيرات لتتبع الاستخدام (في الذاكرة)
let modelUsageStats = new Map();

// تحديد النموذج الأنسب حسب نوع الطلب
function selectBestModel(messageText: string, orderIntent: boolean = false): string {
  const lowerText = messageText.toLowerCase();
  
  // للطلبات المعقدة - استخدم Pro models
  if (orderIntent || lowerText.includes('طلب') || lowerText.includes('إحصائي') || lowerText.includes('تحليل')) {
    return getAvailableModel('complex') || getAvailableModel('general') || 'gemini-2.5-flash';
  }
  
  // للردود البسيطة - استخدم Flash-Lite
  if (lowerText.length < 50 || lowerText.includes('شكرا') || lowerText.includes('مرحبا')) {
    return getAvailableModel('simple') || getAvailableModel('general') || 'gemini-2.5-flash';
  }
  
  // للمحادثات العامة - استخدم Flash العادي
  return getAvailableModel('general') || 'gemini-2.5-flash';
}

// الحصول على نموذج متاح حسب نوع الاستخدام
function getAvailableModel(useCase: string): string | null {
  const suitableModels = GEMINI_MODELS
    .filter(model => model.useCase === useCase || useCase === 'general')
    .sort((a, b) => a.priority - b.priority);
    
  for (const model of suitableModels) {
    const usage = modelUsageStats.get(model.name) || { daily: 0, lastReset: new Date().toDateString() };
    
    // إعادة تعيين الكونتر اليومي
    if (usage.lastReset !== new Date().toDateString()) {
      usage.daily = 0;
      usage.lastReset = new Date().toDateString();
      modelUsageStats.set(model.name, usage);
    }
    
    // التحقق من توفر الكوتة
    if (usage.daily < model.dailyLimit * 0.9) { // استخدم 90% من الحد للأمان
      return model.name;
    }
  }
  
  return null; // لا يوجد نموذج متاح
}

// تسجيل استخدام النموذج
function recordModelUsage(modelName: string) {
  const usage = modelUsageStats.get(modelName) || { daily: 0, lastReset: new Date().toDateString() };
  usage.daily += 1;
  modelUsageStats.set(modelName, usage);
  
  console.log(`📊 استخدام ${modelName}: ${usage.daily} من ${GEMINI_MODELS.find(m => m.name === modelName)?.dailyLimit || 'غير محدد'}`);
}

// استدعاء Gemini API مع نظام التحويل التلقائي
async function callGeminiWithFallback(systemPrompt: string, userMessage: string, maxRetries: number = 3): Promise<any> {
  const orderIntent = userMessage.toLowerCase().includes('طلب') || userMessage.toLowerCase().includes('اطلب');
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const selectedModel = selectBestModel(userMessage, orderIntent);
      
      if (!selectedModel) {
        throw new Error('لم يعد هناك نماذج متاحة - تم استنفاف جميع الكوتات اليومية');
      }
      
      console.log(`🤖 محاولة ${attempt}: استخدام نموذج ${selectedModel}`);
      
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: systemPrompt },
                  { text: `رسالة المستخدم: ${userMessage}` }
                ]
              }
            ],
            generationConfig: {
              topK: 30,
              topP: 0.8,
              maxOutputTokens: 500,
            },
            safetySettings: [
              {
                category: "HARM_CATEGORY_HARASSMENT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
              },
              {
                category: "HARM_CATEGORY_HATE_SPEECH",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
              }
            ]
          }),
        }
      );

      if (response.ok) {
        // تسجيل الاستخدام الناجح
        recordModelUsage(selectedModel);
        console.log(`✅ نجح ${selectedModel} في المحاولة ${attempt}`);
        return await response.json();
      }
      
      const errorText = await response.text();
      console.error(`❌ خطأ في ${selectedModel} (محاولة ${attempt}):`, response.status, errorText);
      
      // إذا كان خطأ كوتة، اعلم عن استنفافها وجرب النموذج التالي
      if (response.status === 429 || errorText.includes('quota') || errorText.includes('limit')) {
        console.warn(`⚠️ تم استنفاف كوتة ${selectedModel} - التحويل للنموذج التالي`);
        
        // تعيين الكوتة كمستنفدة
        const usage = modelUsageStats.get(selectedModel) || { daily: 0, lastReset: new Date().toDateString() };
        const modelConfig = GEMINI_MODELS.find(m => m.name === selectedModel);
        if (modelConfig) {
          usage.daily = modelConfig.dailyLimit; // ضع الكوتة في الحد الأقصى
          modelUsageStats.set(selectedModel, usage);
        }
        
        // إذا كانت هذه المحاولة الأخيرة، ارجع خطأ شامل
        if (attempt === maxRetries) {
          return {
            error: true,
            status: 429,
            message: '🚨 تم استنفاف جميع نماذج Gemini المتاحة لليوم. سيتم التجديد تلقائياً في منتصف الليل بتوقيت كاليفورنيا.'
          };
        }
        
        continue; // جرب النموذج التالي
      }
      
      // لأخطاء أخرى، جرب مرة أخرى
      if (attempt === maxRetries) {
        throw new Error(`فشل جميع النماذج: ${errorText}`);
      }
      
    } catch (error) {
      console.error(`❌ خطأ في المحاولة ${attempt}:`, error);
      if (attempt === maxRetries) {
        throw error;
      }
    }
  }
  
  throw new Error('فشل في جميع المحاولات');
}

// إنشاء عميل Supabase بصلاحيات SERVICE ROLE (نفلتر يدوياً حسب الدور)
const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

/**
 * 🔐 تحديد نطاق المستخدم (Scope) من قاعدة البيانات
 * - admin/super_admin: كل البيانات
 * - department_manager: بياناته + موظفيه (employee_supervisors)
 * - باقي الموظفين: بياناته فقط
 */
async function resolveUserScope(authToken?: string): Promise<{ userId: string | null; isAdmin: boolean; isManager: boolean; allowedUserIds: string[] | null }> {
  if (!authToken) return { userId: null, isAdmin: false, isManager: false, allowedUserIds: [] };
  try {
    const { data: { user: authUser } } = await supabase.auth.getUser(authToken);
    const userId = authUser?.id || null;
    if (!userId) return { userId: null, isAdmin: false, isManager: false, allowedUserIds: [] };

    // قراءة الأدوار من user_roles + roles
    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('roles!inner(name)')
      .eq('user_id', userId)
      .eq('is_active', true);
    const roleNames: string[] = (rolesData || []).map((r: any) => r.roles?.name).filter(Boolean);

    const isAdmin = roleNames.some(r => ['super_admin', 'admin'].includes(r));
    const isManager = roleNames.some(r => ['department_manager', 'deputy_manager'].includes(r));

    if (isAdmin) return { userId, isAdmin, isManager, allowedUserIds: null }; // null = كل البيانات

    if (isManager) {
      const { data: subs } = await supabase
        .from('employee_supervisors')
        .select('employee_id')
        .eq('supervisor_id', userId);
      const ids = new Set<string>([userId, ...((subs || []).map((s: any) => s.employee_id))]);
      return { userId, isAdmin, isManager, allowedUserIds: Array.from(ids) };
    }

    return { userId, isAdmin, isManager, allowedUserIds: [userId] };
  } catch (e) {
    console.error('resolveUserScope error:', e);
    return { userId: null, isAdmin: false, isManager: false, allowedUserIds: [] };
  }
}

async function getStoreData(userInfo: any, authToken?: string) {
  try {
    const scope = await resolveUserScope(authToken);
    console.log('🔍 جلب البيانات — Scope:', { isAdmin: scope.isAdmin, isManager: scope.isManager, allowedCount: scope.allowedUserIds?.length ?? 'ALL' });
    
    // Get real cities and regions from cache with smart search functions
    const { data: cities } = await supabase
      .from('cities_cache')
      .select('id, name, alwaseet_id, name_ar, name_en')
      .eq('is_active', true)
      .order('name');
    
    const { data: regions } = await supabase
      .from('regions_cache')
      .select('id, name, city_id, alwaseet_id, name_ar, name_en')
      .eq('is_active', true)
      .order('name');

    console.log(`✅ تم جلب ${cities?.length || 0} مدينة و ${regions?.length || 0} منطقة من النظام الحقيقي`);
    
    // Get comprehensive product data with all related information
    // ⚠️ نستخدم LEFT JOIN (بدون !inner) لضمان عدم استبعاد أي منتج
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select(`
        id, name, base_price, cost_price, description, is_active,
        product_departments (
          departments (id, name, description, color, icon)
        ),
        product_categories (
          categories (id, name, description, type)
        ),
        product_product_types (
          product_types (id, name, description)
        ),
        product_seasons_occasions (
          seasons_occasions (id, name, type, description)
        ),
        product_variants (
          id, sku, color_id, size_id, price, cost_price,
          colors (id, name, hex_code),
          sizes (id, name),
          inventory (quantity, min_stock, reserved_quantity, sold_quantity)
        )
      `)
      .eq('is_active', true);

    // Get all departments, categories, product types, and seasons for comprehensive data
    const { data: departments } = await supabase
      .from('departments')
      .select('id, name, description, color, icon, is_active, display_order')
      .eq('is_active', true)
      .order('display_order');

    const { data: categories } = await supabase
      .from('categories')
      .select('id, name, description, type')
      .order('name');

    const { data: productTypes } = await supabase
      .from('product_types')
      .select('id, name, description')
      .order('name');

    const { data: seasonsOccasions } = await supabase
      .from('seasons_occasions')
      .select('id, name, type, description')
      .order('name');

    const { data: colors } = await supabase
      .from('colors')
      .select('id, name, hex_code')
      .order('name');

    const { data: sizes } = await supabase
      .from('sizes')
      .select('id, name')
      .order('name');
    
    if (productsError) {
      console.error('❌ خطأ في جلب المنتجات:', productsError);
    } else {
      console.log('✅ تم جلب المنتجات بنجاح:', products?.length || 0);
    }

    // 🔐 Helper: تطبيق فلتر الـ Scope على أي query
    const applyScope = (q: any, column: string = 'created_by') => {
      if (scope.allowedUserIds === null) return q; // admin
      if (!scope.allowedUserIds.length) return q.eq(column, '00000000-0000-0000-0000-000000000000'); // لا شيء
      return q.in(column, scope.allowedUserIds);
    };
    // للأرباح: نستخدم employee_id بدل created_by
    const applyProfitScope = (q: any) => {
      if (scope.allowedUserIds === null) return q;
      if (!scope.allowedUserIds.length) return q.eq('employee_id', '00000000-0000-0000-0000-000000000000');
      return q.in('employee_id', scope.allowedUserIds);
    };

    // Get recent orders with detailed profit info — مفلترة حسب الـ Scope
    let ordersQ = supabase
      .from('orders')
      .select(`
        id, order_number, customer_name, customer_phone, customer_city, customer_province,
        total_amount, final_amount, delivery_fee, status, created_at, created_by,
        tracking_number, delivery_status, delivery_partner,
        order_items ( id, quantity, unit_price, total_price, variant_sku ),
        profits ( profit_amount, employee_profit, status )
      `)
      .order('created_at', { ascending: false })
      .limit(20);
    ordersQ = applyScope(ordersQ);
    const { data: recentOrders, error: ordersError } = await ordersQ;

    if (ordersError) console.error('❌ خطأ في جلب الطلبات:', ordersError);
    else console.log('✅ تم جلب الطلبات (مفلترة):', recentOrders?.length || 0);

    // Today's sales — مفلترة
    const today = new Date().toISOString().split('T')[0];
    let todayQ = supabase.from('orders')
      .select('total_amount, final_amount, delivery_fee, created_at')
      .gte('created_at', today);
    const { data: todaySales } = await applyScope(todayQ);

    // ALL-TIME sales — مفلترة
    let allQ = supabase.from('orders')
      .select('total_amount, final_amount, delivery_fee, created_at')
      .in('status', ['completed', 'delivered'])
      .order('created_at', { ascending: false })
      .limit(1000);
    const { data: allTimeSales } = await applyScope(allQ);

    // This month's sales — مفلترة
    const thisMonth = new Date().toISOString().slice(0, 7) + '-01';
    let monthQ = supabase.from('orders')
      .select('total_amount, final_amount, delivery_fee')
      .gte('created_at', thisMonth)
      .in('status', ['completed', 'delivered']);
    const { data: monthSales } = await applyScope(monthQ);

    // Expenses — للأدمن فقط (تمثل مصاريف النظام)
    const { data: allExpenses } = scope.isAdmin
      ? await supabase.from('expenses').select('amount, expense_type, created_at')
          .order('created_at', { ascending: false }).limit(500)
      : { data: [] as any[] };
    const { data: monthExpenses } = scope.isAdmin
      ? await supabase.from('expenses').select('amount, expense_type, created_at').gte('created_at', thisMonth)
      : { data: [] as any[] };

    // Profits — مفلترة حسب employee_id للموظفين
    let allProfitsQ = supabase.from('profits')
      .select('profit_amount, employee_profit, status, created_at, employee_id')
      .order('created_at', { ascending: false })
      .limit(1000);
    const { data: allProfits } = await applyProfitScope(allProfitsQ);

    let monthProfitsQ = supabase.from('profits')
      .select('profit_amount, employee_profit, status, created_at, employee_id')
      .gte('created_at', thisMonth);
    const { data: monthProfits } = await applyProfitScope(monthProfitsQ);

    let todayProfitsQ = supabase.from('profits')
      .select('profit_amount, employee_profit, status, employee_id')
      .gte('created_at', today);
    const { data: todayProfits } = await applyProfitScope(todayProfitsQ);

    // Calculate advanced analytics
    const todayTotal = todaySales?.reduce((sum, order) => 
      sum + (order.final_amount || order.total_amount || 0), 0) || 0;
    
    const todayCount = todaySales?.length || 0;
    const todayAverage = todayCount > 0 ? todayTotal / todayCount : 0;

    // حساب جميع الإحصائيات المالية
    const allTimeTotal = allTimeSales?.reduce((sum, order) => 
      sum + (order.final_amount || order.total_amount || 0), 0) || 0;
    
    const monthTotal = monthSales?.reduce((sum, order) => 
      sum + (order.final_amount || order.total_amount || 0), 0) || 0;
    
    const allTimeExpensesTotal = allExpenses?.reduce((sum, expense) => sum + (expense.amount || 0), 0) || 0;
    const monthExpensesTotal = monthExpenses?.reduce((sum, expense) => sum + (expense.amount || 0), 0) || 0;
    
    const allTimeProfitTotal = allProfits?.reduce((sum, profit) => sum + (profit.profit_amount || 0), 0) || 0;
    const actualMonthProfit = monthProfits?.reduce((sum, profit) => sum + (profit.profit_amount || 0), 0) || 0;
    const todayProfit = todayProfits?.reduce((sum, profit) => sum + (profit.profit_amount || 0), 0) || 0;
    
    const estimatedMonthProfit = monthTotal - monthExpensesTotal;
    const estimatedAllTimeProfit = allTimeTotal - allTimeExpensesTotal;

    // Process products with analytics
    const processedProducts = products?.map(product => {
      const totalStock = product.product_variants?.reduce((sum: number, variant: any) =>
        sum + (variant.inventory?.[0]?.quantity || 0), 0) || 0;

      const totalSold = product.product_variants?.reduce((sum: number, variant: any) =>
        sum + (variant.inventory?.[0]?.sold_quantity || 0), 0) || 0;

      // 🏷️ استخراج اسم القسم من العلاقة (لربطه بالمنتج في الـ prompt)
      const departmentName = product.product_departments?.[0]?.departments?.name || 'غير مصنف';
      const categoryName = product.product_categories?.[0]?.categories?.name || '';

      return {
        ...product,
        department_name: departmentName,
        category_name: categoryName,
        inventory_count: totalStock,
        sold_quantity: totalSold,
        variants: product.product_variants?.map((variant: any) => ({
          ...variant,
          color: variant.colors?.name || 'افتراضي',
          size: variant.sizes?.name || 'افتراضي',
          stock: variant.inventory?.[0]?.quantity || 0,
          reserved: variant.inventory?.[0]?.reserved_quantity || 0,
          sold: variant.inventory?.[0]?.sold_quantity || 0
        })) || []
      };
    }) || [];

    return {
      products: processedProducts,
      orders: recentOrders || [],
      cities: cities || [],
      regions: regions || [],
      departments: departments || [],
      categories: categories || [],
      productTypes: productTypes || [],
      seasonsOccasions: seasonsOccasions || [],
      colors: colors || [],
      sizes: sizes || [],
      analytics: {
        citiesCount: cities?.length || 0,
        regionsCount: regions?.length || 0,
        productsCount: processedProducts?.length || 0,
        totalVariantsCount: processedProducts?.reduce((sum, p) => sum + (p.variants?.length || 0), 0) || 0,
        departmentsCount: departments?.length || 0,
        categoriesCount: categories?.length || 0,
        productTypesCount: productTypes?.length || 0,
        seasonsOccasionsCount: seasonsOccasions?.length || 0,
        colorsCount: colors?.length || 0,
        sizesCount: sizes?.length || 0,
        allTimeStats: {
          totalSales: allTimeTotal,
          totalProfit: allTimeProfitTotal || estimatedAllTimeProfit,
          actualProfit: allTimeProfitTotal,
          estimatedProfit: estimatedAllTimeProfit,
          totalExpenses: allTimeExpensesTotal,
          ordersCount: allTimeSales?.length || 0
        },
        todayStats: {
          total: todayTotal,
          count: todayCount,
          average: todayAverage,
          profit: todayProfit
        },
        monthStats: {
          total: monthTotal,
          profit: actualMonthProfit || estimatedMonthProfit,
          actualProfit: actualMonthProfit,
          estimatedProfit: estimatedMonthProfit,
          expenses: monthExpensesTotal,
          ordersCount: monthSales?.length || 0
        }
      }
    };
  } catch (error) {
    console.error('Error fetching store data:', error);
    return {
      products: [],
      orders: [],
      cities: [],
      regions: [],
      departments: [],
      categories: [],
      productTypes: [],
      seasonsOccasions: [],
      colors: [],
      sizes: [],
      analytics: {
        citiesCount: 0,
        regionsCount: 0,
        productsCount: 0,
        totalVariantsCount: 0,
        departmentsCount: 0,
        categoriesCount: 0,
        productTypesCount: 0,
        seasonsOccasionsCount: 0,
        colorsCount: 0,
        sizesCount: 0,
        allTimeStats: { totalSales: 0, totalProfit: 0, totalExpenses: 0, ordersCount: 0 },
        todayStats: { total: 0, count: 0, average: 0, profit: 0 },
        monthStats: { total: 0, profit: 0, expenses: 0, ordersCount: 0 }
      }
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userInfo, orderContext } = await req.json();
    
    // الحصول على authorization header
    const authHeader = req.headers.get('Authorization');
    const authToken = authHeader?.replace('Bearer ', '');
    
    console.log('🔐 طلب من المستخدم:', userInfo?.full_name || userInfo?.id);
    console.log('🎫 Token متوفر:', !!authToken);

    // 🔐 احتساب الـ Scope مرة واحدة لاستخدامه في النص التعريفي للنموذج
    const userScope = await resolveUserScope(authToken);
    const scopeLabel = userScope.isAdmin
      ? 'مدير عام (يرى كل البيانات)'
      : userScope.isManager
        ? `مدير قسم (يرى بياناته وبيانات ${(userScope.allowedUserIds?.length ?? 1) - 1} موظف تابع)`
        : 'موظف (يرى بياناته فقط)';

    // Get real store data with user authentication (مفلترة حسب الدور)
    const storeData = await getStoreData(userInfo, authToken);

    // تحليلات متقدمة للبيانات
    const advancedAnalytics = {
      // تحليل الأرباح الحقيقي
      profitAnalysis: {
        todayRevenue: storeData.analytics?.todayStats?.total || 0,
        todayActualProfit: storeData.analytics?.todayStats?.profit || 0,
        monthlyRevenue: storeData.analytics?.monthStats?.total || 0,
        monthlyActualProfit: storeData.analytics?.monthStats?.actualProfit || 0,
        monthlyEstimatedProfit: storeData.analytics?.monthStats?.estimatedProfit || 0,
        allTimeRevenue: storeData.analytics?.allTimeStats?.totalSales || 0,
        allTimeProfit: storeData.analytics?.allTimeStats?.actualProfit || 0,
        profitMargin: storeData.analytics?.monthStats?.total > 0 ? 
          ((storeData.analytics?.monthStats?.actualProfit || 0) / storeData.analytics?.monthStats?.total * 100).toFixed(1) : 0,
        profitPerOrder: storeData.analytics?.todayStats?.count > 0 ? 
          (storeData.analytics?.todayStats?.profit || 0) / storeData.analytics?.todayStats?.count : 0
      },
      
      // تحليل المخزون
      inventoryHealth: {
        lowStock: storeData.products.filter(p => (p.inventory_count || 0) < 10),
        outOfStock: storeData.products.filter(p => (p.inventory_count || 0) === 0),
        totalValue: storeData.products.reduce((sum, p) => sum + ((p.cost_price || 0) * (p.inventory_count || 0)), 0)
      },
      
      // تحليل العملاء
      customerInsights: {
        topCities: [...new Set(storeData.orders.map(o => o.customer_city))].filter(Boolean),
        repeatCustomers: storeData.orders.reduce((acc: Record<string, number>, order: any) => {
          acc[order.customer_phone] = (acc[order.customer_phone] || 0) + 1;
          return acc;
        }, {}),
        averageOrderValue: storeData.orders.length > 0 ? 
          storeData.orders.reduce((sum, o) => sum + (o.final_amount || 0), 0) / storeData.orders.length : 0
      },
      
      // تحليل الاتجاهات
      trends: {
        bestSellers: storeData.products
          .filter(p => (p.sold_quantity || 0) > 0)
          .sort((a, b) => (b.sold_quantity || 0) - (a.sold_quantity || 0))
          .slice(0, 3),
        recentOrders: storeData.orders.slice(0, 5)
      }
    };

    // 🌍 إعداد قوائم المدن والمناطق الكاملة من الكاش (cities_cache + regions_cache)
    const allCities = storeData.cities || [];
    const allRegions = storeData.regions || [];
    const availableProducts = storeData.products.filter(p => (p.inventory_count || 0) > 0);
    const outOfStockProducts = storeData.products.filter(p => (p.inventory_count || 0) === 0);

    // 🏙️ تنسيق مضغوط لكل المدن (اسم فقط، مفصول بفاصلة)
    const citiesCompact = allCities.map(c => c.name).join(' | ');

    // 📍 تنسيق ذكي للمناطق مرتبطة بمدنها (لتمكين التفكير الجغرافي)
    const cityIdToName = new Map(allCities.map((c: any) => [c.id, c.name]));
    const regionsByCity: Record<string, string[]> = {};
    for (const r of allRegions as any[]) {
      const cityName = cityIdToName.get(r.city_id) || 'غير محدد';
      if (!regionsByCity[cityName]) regionsByCity[cityName] = [];
      regionsByCity[cityName].push(r.name);
    }
    // أهم المدن (التي تحتوي مناطق) — نعرضها كاملة للمساعد ليفكر جغرافياً
    const regionsBlock = Object.entries(regionsByCity)
      .map(([city, regions]) => `${city}: ${regions.join('، ')}`)
      .join('\n');

    // 📦 تجميع المنتجات المتاحة حسب القسم — لمنع الخلط بين رجالي ونسائي
    const productsByDept: Record<string, string[]> = {};
    for (const product of availableProducts as any[]) {
      const variants = product.variants?.filter((v: any) => v.stock > 0) || [];
      const dept = product.department_name || 'غير مصنف';
      const colorGroups: Record<string, string[]> = {};
      for (const v of variants as any[]) {
        const color = v.color || 'افتراضي';
        const available = Math.max(0, (v.stock || 0) - (v.reserved || 0));
        if (!colorGroups[color]) colorGroups[color] = [];
        colorGroups[color].push(`${v.size || '-'}(${available})`);
      }
      const variantsStr = Object.entries(colorGroups)
        .map(([color, sizes]) => `${color}:${sizes.join(',')}`)
        .join(' | ');
      const cat = product.category_name ? ` (${product.category_name})` : '';
      const line = `• ${product.name}${cat} - ${product.base_price?.toLocaleString()} د.ع → ${variantsStr || 'لا متغيرات'}`;
      if (!productsByDept[dept]) productsByDept[dept] = [];
      productsByDept[dept].push(line);
    }
    const deptIcons: Record<string, string> = {
      'رجالي': '👔', 'نسائي': '👗', 'أطفال': '🧒', 'اطفال': '🧒',
      'احذية': '👟', 'أحذية': '👟', 'اكسسوارات': '👜', 'إكسسوارات': '👜',
    };
    const productsBlock = Object.entries(productsByDept)
      .map(([dept, lines]) => `${deptIcons[dept] || '📦'} **${dept}** (${lines.length}):\n${lines.join('\n')}`)
      .join('\n\n');

    // 📭 المنتجات نافدة المخزون (للاقتراح بدائل)
    const outOfStockBlock = outOfStockProducts.map(p => `• ${p.name} [${(p as any).department_name || 'غير مصنف'}]`).join('\n') || 'لا يوجد';

const systemPrompt = `🧠 أنت مساعد RYUS الذكي الخارق - لديك وصول كامل لقاعدة البيانات الحقيقية ونظام مثالي لإنشاء الطلبات

**شخصيتك:** مساعد متجر RYUS الذكي. تعرف كل المنتجات والمتغيرات والمدن والمناطق وتستطيع: إنشاء طلبات حقيقية، فحص المخزون، عرض الأرباح الشاملة، التعرف على جميع المدن والمناطق من الكاش.

**🔐 نطاق صلاحيات هذا المستخدم:** ${scopeLabel}
- إذا سأل المستخدم عن بيانات خارج نطاقه (طلبات/أرباح موظفين آخرين)، اعتذر بلطف ووضّح أنه يرى بياناته فقط حسب صلاحياته.

**البيانات المالية الحقيقية - الوصول الكامل:**
📊 مبيعات اليوم: ${storeData.analytics?.todayStats?.total?.toLocaleString() || 0} د.ع (${storeData.analytics?.todayStats?.count || 0} طلب)
📈 مبيعات الشهر: ${storeData.analytics?.monthStats?.total?.toLocaleString() || 0} د.ع | أرباح: ${storeData.analytics?.monthStats?.actualProfit?.toLocaleString() || 0} د.ع
💰 إجمالي كل الأوقات: ${storeData.analytics?.allTimeStats?.totalSales?.toLocaleString() || 0} د.ع | أرباح: ${storeData.analytics?.allTimeStats?.actualProfit?.toLocaleString() || 0} د.ع
📊 عدد الطلبات: اليوم ${storeData.analytics?.todayStats?.count || 0} | الشهر ${storeData.analytics?.monthStats?.ordersCount || 0} | الإجمالي ${storeData.analytics?.allTimeStats?.ordersCount || 0}

🏪 **أقسام المتجر (${storeData.analytics.departmentsCount}):** ${storeData.departments?.map(d => d.name).join('، ') || '-'}
📚 **التصنيفات (${storeData.analytics.categoriesCount}):** ${storeData.categories?.map(c => c.name).join('، ') || '-'}
🏭 **أنواع المنتجات (${storeData.analytics.productTypesCount}):** ${storeData.productTypes?.map(t => t.name).join('، ') || '-'}
🎭 **المواسم (${storeData.analytics.seasonsOccasionsCount}):** ${storeData.seasonsOccasions?.map(s => s.name).join('، ') || '-'}
🎨 **كل الألوان (${storeData.analytics.colorsCount}):** ${storeData.colors?.map(c => c.name).join('، ') || '-'}
📏 **كل الأحجام (${storeData.analytics.sizesCount}):** ${storeData.sizes?.map(s => s.name).join('، ') || '-'}

═══════════════════════════════════════
📦 **كل المنتجات المتاحة (${availableProducts.length} منتج) — مجمَّعة حسب القسم:**
${productsBlock || 'لا توجد منتجات متاحة'}

📭 **منتجات نافدة المخزون (${outOfStockProducts.length}) — اقترح بدائل من نفس القسم فقط:**
${outOfStockBlock}
═══════════════════════════════════════

⛔ **قاعدة التصنيف الصارمة (لا تخالفها أبداً):**
- إذا طلب المستخدم "رجالي" أو "رجالية" → اعرض/اقترح **فقط** منتجات قسم 👔 رجالي.
- إذا طلب "نسائي" أو "نسائية" → اعرض/اقترح **فقط** منتجات قسم 👗 نسائي.
- إذا طلب "أطفال" → اعرض/اقترح **فقط** منتجات قسم 🧒 أطفال.
- ممنوع منعاً باتاً اقتراح منتج من قسم آخر تحت أي ظرف.
- إذا لم يوجد منتج مطابق في القسم المطلوب، قل "لا يوجد منتجات في هذا القسم حالياً" بدل اقتراح بديل من قسم آخر.

🌍 **نظام المدن والمناطق الكامل من الكاش (${allCities.length} مدينة، ${allRegions.length} منطقة):**

🏙️ **كل المدن المتاحة:**
${citiesCompact}

📍 **المناطق مفصلة حسب المدينة (للتفكير الجغرافي الذكي):**
${regionsBlock}

═══════════════════════════════════════

**قدرات إنشاء الطلبات الخارقة:**
- 🤖 استخدام نفس منطق بوت التليغرام المتطور
- 🔍 التعرف التلقائي على المدن والمناطق من الكاش (cities_cache + regions_cache)
- 💰 حساب أجور التوصيل: 5000 د.ع (موحد)
- 📦 فحص مخزون فوري واقتراح بدائل ذكية للمنتجات النافدة
- 💾 حفظ تلقائي في ai_orders مع source='ai_assistant'
- 👤 اسم افتراضي: "${userInfo?.default_customer_name || 'ريوس'}"

**كيف يكتب المستخدم طلب؟**
مثال: "طلب جديد: زبون أحمد 07701234567 بغداد كرادة داخل، يريد برشلونة أزرق M عدد 1"
سأستخرج تلقائياً: الاسم، الهاتف، المدينة، المنطقة، المنتج، اللون، الحجم، الكمية وأحفظ الطلب في نافذة طلبات الذكاء الاصطناعي.

**تعليمات الردود المختصرة والذكية:**
- كن مختصراً (1-3 أسطر)
- لا تكرر الترحيب
- اعرض المعلومات مباشرة
- عند السؤال عن منتج: اعرض الألوان والأحجام والمخزون بالتفصيل من القائمة أعلاه
- تنسيق المخزون: المنتج → اللون: الحجم(المتاح)
- رتب الأحجام منطقياً: XS, S, M, L, XL, XXL

### قواعد الفهم الجغرافي الذكي (من الكاش):
- استخدم قائمة المدن والمناطق أعلاه كمرجع وحيد للجغرافيا
- **الكرادة**: إذا ذُكرت بدون تحديد → اختر "كرادة داخل" (الأكثر شيوعاً)
- **مرادفات شائعة**: كراد=كرادة، كراده=كرادة، جادريه=الجادرية، كاظمي=الكاظمية
- **فصل العنوان**: ميز بين اسم المنطقة (للمدينة) والعنوان التفصيلي
- إذا لم تجد المنطقة في الكاش، اقترح أقرب منطقة موجودة في نفس المدينة

اعرض المخزون الحقيقي والأسعار الصحيحة. انشئ طلبات حقيقية تظهر فوراً في نظام الإدارة مع دقة جغرافية عالية من الكاش.`;

    // استخدام نظام التحويل التلقائي الذكي
    const data = await callGeminiWithFallback(systemPrompt, message);
    
    // التحقق من وجود خطأ في النظام
    if (data.error) {
      return new Response(JSON.stringify({
        success: false,
        error: 'all_models_exhausted',
        response: data.message,
        quotaStatus: 'all_exhausted',
        availableModels: GEMINI_MODELS.map(m => ({
          name: m.name,
          description: m.description,
          dailyUsage: modelUsageStats.get(m.name)?.daily || 0,
          dailyLimit: m.dailyLimit,
          available: (modelUsageStats.get(m.name)?.daily || 0) < m.dailyLimit * 0.9
        }))
      }), {
        status: data.status || 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Invalid response from Gemini API');
    }

    const aiResponse = data.candidates[0].content.parts[0].text;

    // 🧠 كشف نية الطلب الذكي (Smart Intent Detection)
    // إشارتان قويتان من 3: 1) رقم هاتف عراقي  2) اسم مدينة من الكاش  3) سعر مكتوب
    const phoneRegex = /\b07[3-9]\d{8}\b/;
    const priceRegex = /\d{2,}\s*(الف|ألف|د\.ع|دينار|الاف|آلاف|ك\b)/i;
    const hasPhone = phoneRegex.test(message);
    const hasPrice = priceRegex.test(message);
    const lowerMsg = message.toLowerCase();
    const hasCity = (storeData.cities || []).some((city: any) =>
      city.name && lowerMsg.includes(String(city.name).toLowerCase())
    );

    const orderKeywords = ['طلب', 'اطلب', 'اريد', 'أريد', 'احتاج', 'للزبون', 'عميل', 'زبون', 'أنشئ', 'إنشاء', 'سجل', 'أضف'];
    const hasOrderKeyword = orderKeywords.some(k => lowerMsg.includes(k));

    const signalCount = (hasPhone ? 1 : 0) + (hasCity ? 1 : 0) + (hasPrice ? 1 : 0);
    const hasOrderIntent = signalCount >= 2 || (hasOrderKeyword && signalCount >= 1);

    console.log('🔎 كشف نية الطلب:', { hasPhone, hasCity, hasPrice, hasOrderKeyword, signalCount, hasOrderIntent });

    let responseType = 'text';
    let orderData: any = null;
    let finalAiResponse = aiResponse;

    // ===== Helpers: تطبيع السعر العربي + توسيع المنتجات المركبة =====
    // 1) تطبيع شامل: "24 الف" / "24الف" / "24 ألف" / "24k" → "24000"
    const normalizePriceTokens = (txt: string): string => {
      if (!txt) return txt;
      let out = txt;
      // أرقام عربية → إنجليزية
      const arDigits: Record<string, string> = { '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9' };
      out = out.replace(/[٠-٩]/g, (d) => arDigits[d] || d);
      // (الف|ألف|آلاف|الاف|k|K) ملاصقة أو بمسافات/سطر جديد بعد رقم → *1000
      // ملاحظة: لا نستخدم \b لأنه لا يعمل مع العربية
      out = out.replace(/(\d{1,4})[\s\u00A0\u200f]*(الف|ألف|آلاف|الاف|kK]|k|K)/g, (_m, n) => String(parseInt(n, 10) * 1000));
      out = out.replace(/(\d{1,4})[\s\u00A0\u200f]*(الف|ألف|آلاف|الاف)/g, (_m, n) => String(parseInt(n, 10) * 1000));
      out = out.replace(/(\d{1,4})\s*[kK](?![a-zA-Z])/g, (_m, n) => String(parseInt(n, 10) * 1000));
      // "د.ع" / "دينار" → احذفها (يبقى الرقم فقط) لتجنّب أن تُفسّر كوحدة
      out = out.replace(/\s*(د\.?\s*ع|دينار)\s*/g, ' ');
      return out;
    };

    // 2) توسيع "X سمول + ميديم" → "X سمول\nX ميديم"
    const SIZE_TOKENS = [
      'سمول','ميديم','لارج','اكس','اكسات','اكسين','xs','s','m','l','xl','xxl','xxxl','2xl','3xl','4xl','5xl',
      'صغير','وسط','متوسط','كبير'
    ];
    const isSizeToken = (w: string) => SIZE_TOKENS.includes((w || '').trim().toLowerCase());

    const expandCompoundProducts = (txt: string): string => {
      if (!txt || !txt.includes('+')) return txt;
      const lines = txt.split(/\r?\n/);
      const out: string[] = [];
      for (const rawLine of lines) {
        if (!rawLine.includes('+')) { out.push(rawLine); continue; }
        // أزل أرقام الهواتف والأسعار من الفحص قبل تقسيم +
        const sanitized = rawLine
          .replace(/(\+?964|00964)?0?7[0-9]{9}/g, ' ')
          .replace(/\b\d{4,}\b/g, ' ');
        if (!sanitized.includes('+')) { out.push(rawLine); continue; }
        const parts = sanitized.split('+').map(p => p.trim()).filter(Boolean);
        if (parts.length < 2) { out.push(rawLine); continue; }

        // الجذر = اسم المنتج بدون آخر كلمة قياس
        const firstTokens = parts[0].split(/\s+/);
        const lastIsSize = isSizeToken(firstTokens[firstTokens.length - 1] || '');
        const baseTokens = lastIsSize ? firstTokens.slice(0, -1) : firstTokens;
        const base = baseTokens.join(' ').trim();

        const expanded: string[] = [];
        for (const part of parts) {
          const toks = part.split(/\s+/).filter(Boolean);
          if (toks.length === 1 && isSizeToken(toks[0]) && base) {
            expanded.push(`${base} ${toks[0]}`.trim());
          } else if (base && toks.every(isSizeToken)) {
            expanded.push(`${base} ${toks.join(' ')}`.trim());
          } else {
            expanded.push(part);
          }
        }
        out.push(expanded.join('\n'));
      }
      return out.join('\n');
    };

    // 3) رسالة معالَجة لتمريرها للدوال (تطبيع سعر + توسيع المركّب)
    const processedMessage = expandCompoundProducts(normalizePriceTokens(message));
    if (processedMessage !== message) {
      console.log('🧪 تم تطبيع الرسالة قبل المعالجة:', { before: message, after: processedMessage });
    }

    if (hasOrderIntent) {
      try {
        console.log('🔍 تحليل طلب ذكي للنص (مُطبّع):', processedMessage);

        // 🔑 جلب employee_code للمستخدم الحالي (نفس آلية بوت التليغرام)
        const userIdForCode = userInfo?.user_id || userInfo?.id;
        let employeeCode: string | null = null;

        if (userIdForCode) {
          const { data: codeRow } = await supabase
            .from('employee_telegram_codes')
            .select('telegram_code')
            .eq('user_id', userIdForCode)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();
          employeeCode = codeRow?.telegram_code || null;
        }

        // احتياطي: أول كود نشط في النظام (لو المستخدم بدون كود)
        if (!employeeCode) {
          const { data: anyCode } = await supabase
            .from('employee_telegram_codes')
            .select('telegram_code')
            .eq('is_active', true)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();
          employeeCode = anyCode?.telegram_code || null;
          console.log('⚠️ استخدام كود افتراضي:', employeeCode);
        }

        if (!employeeCode) {
          console.error('❌ لا يوجد أي employee_code نشط في النظام');
        } else {
          const aiChatId = -999999999; // معرف خاص للمساعد الذكي

          // 🗺️ مطابقة محلية ذكية للمدينة والمنطقة (مماثلة لمنطق بوت التليغرام)
          let resolvedCityExternalId: number | null = null;   // alwaseet_id
          let resolvedRegionExternalId: number | null = null; // alwaseet_id
          let resolvedCityName: string | null = null;
          let resolvedRegionName: string | null = null;
          type RegionMatch = { externalId: number; name: string; conf: number };
          let regionSuggestions: RegionMatch[] = [];

          const normalizeAr = (t: string) => (t || '')
            .toString()
            .toLowerCase()
            .replace(/[إأآا]/g, 'ا')
            .replace(/[ى]/g, 'ي')
            .replace(/[ة]/g, 'ه')
            .replace(/[ؤ]/g, 'و')
            .replace(/[ئ]/g, 'ي')
            .replace(/[\u064B-\u0652]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

          // إزالة أرقام الهواتف وكلمات المنتجات الشائعة لتنقية نص المنطقة
          const stripNoise = (t: string) => (t || '')
            .replace(/(\+?964|00964)?0?7[0-9]{9}/g, ' ')
            .replace(/\b\d{3,}\b/g, ' ')
            .replace(/\b(سمول|ميديم|لارج|اكس|اكسات|اكسين|xs|s|m|l|xl|xxl|xxxl|2xl|3xl)\b/gi, ' ')
            .replace(/\b(احمر|ازرق|اخضر|اصفر|ابيض|اسود|سمائي|وردي|نيلي)\b/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

          try {
            const lines = processedMessage.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

            // جلب كل المدن والمناطق دفعة واحدة
            const { data: citiesList } = await supabase
              .from('cities_cache')
              .select('id, name, name_ar, alwaseet_id')
              .eq('is_active', true);

            const { data: aliasesList } = await supabase
              .from('city_aliases')
              .select('city_id, alias_name, confidence_score');

            type CityRow = { id: number; name: string; alwaseet_id: number; norms: string[] };
            const cityCandidates: CityRow[] = (citiesList || []).map((c: any) => ({
              id: c.id,
              name: c.name,
              alwaseet_id: c.alwaseet_id ?? c.id,
              norms: [c.name, c.name_ar].filter(Boolean).map((n: string) => normalizeAr(n)),
            }));
            const aliasIndex: Array<{ city_id: number; norm: string }> =
              (aliasesList || []).map((a: any) => ({ city_id: a.city_id, norm: normalizeAr(a.alias_name) })).filter(a => a.norm);

            // ابحث عن المدينة سطراً سطراً، مع استخدام الكلمة الأولى أولاً
            let cityLine = '';
            outerCity: for (const line of lines) {
              const lineNorm = normalizeAr(line);
              if (!lineNorm) continue;
              const firstWord = lineNorm.split(/\s+/)[0];

              // 1) مطابقة الكلمة الأولى مع اسم مدينة
              for (const c of cityCandidates) {
                if (c.norms.some(n => n === firstWord || firstWord.includes(n) || n.includes(firstWord))) {
                  resolvedCityExternalId = c.alwaseet_id;
                  resolvedCityName = c.name;
                  cityLine = line;
                  break outerCity;
                }
              }
              // 2) مطابقة المرادفات
              for (const al of aliasIndex) {
                if (al.norm === firstWord || firstWord.includes(al.norm)) {
                  const c = cityCandidates.find(x => x.id === al.city_id);
                  if (c) {
                    resolvedCityExternalId = c.alwaseet_id;
                    resolvedCityName = c.name;
                    cityLine = line;
                    break outerCity;
                  }
                }
              }
              // 3) احتواء داخل السطر
              for (const c of cityCandidates) {
                if (c.norms.some(n => lineNorm.includes(n))) {
                  resolvedCityExternalId = c.alwaseet_id;
                  resolvedCityName = c.name;
                  cityLine = line;
                  break outerCity;
                }
              }
            }

            if (resolvedCityExternalId && resolvedCityName) {
              // اجلب مناطق هذه المدينة
              const cityRow = cityCandidates.find(c => c.alwaseet_id === resolvedCityExternalId);
              const cityInternalId = cityRow?.id;
              const { data: regionsList } = await supabase
                .from('regions_cache')
                .select('id, name, name_ar, alwaseet_id, city_id')
                .eq('city_id', cityInternalId)
                .eq('is_active', true);

              if (regionsList && regionsList.length > 0) {
                // أزل اسم المدينة والضوضاء من نص البحث
                const cityNorm = normalizeAr(resolvedCityName);
                const searchSource = stripNoise(cityLine || processedMessage);
                let searchNorm = normalizeAr(searchSource).replace(new RegExp(cityNorm, 'g'), ' ').replace(/\s+/g, ' ').trim();
                // أزل المرادفات أيضاً
                for (const al of aliasIndex.filter(a => a.city_id === cityInternalId)) {
                  searchNorm = searchNorm.replace(new RegExp(al.norm, 'g'), ' ').replace(/\s+/g, ' ').trim();
                }

                const matches: RegionMatch[] = [];
                const words = searchNorm.split(/\s+/).filter(w => w.length >= 2);

                for (const r of regionsList as any[]) {
                  const candidates = [r.name, r.name_ar].filter(Boolean).map((n: string) => normalizeAr(n));
                  let best = 0;
                  for (const cand of candidates) {
                    if (!cand) continue;
                    if (searchNorm === cand) { best = Math.max(best, 1.0); continue; }
                    if (searchNorm.includes(cand)) {
                      // تطابق احتواء قوي - الأطول أفضل
                      const score = Math.min(0.98, 0.85 + cand.length / 100);
                      best = Math.max(best, score);
                      continue;
                    }
                    // تطابق على مستوى الكلمات
                    const candTokens = cand.split(/\s+/).filter((t: string) => t.length >= 2);
                    if (!candTokens.length) continue;
                    const overlap = candTokens.filter((t: string) => words.includes(t)).length;
                    if (overlap > 0) {
                      const ratio = overlap / candTokens.length;
                      // اطلب على الأقل تطابق نصف كلمات اسم المنطقة لتجنب نتائج عشوائية
                      if (ratio >= 0.5) best = Math.max(best, 0.6 + ratio * 0.3);
                    }
                  }
                  if (best >= 0.6) matches.push({ externalId: r.alwaseet_id ?? r.id, name: r.name, conf: best });
                }

                // إزالة التكرار وترتيب
                const seen = new Set<number>();
                const unique = matches
                  .filter(m => (seen.has(m.externalId) ? false : (seen.add(m.externalId), true)))
                  .sort((a, b) => b.conf - a.conf);

                regionSuggestions = unique.slice(0, 5);

                if (unique.length > 0) {
                  const top = unique[0];
                  const second = unique[1];
                  // اعتمد المنطقة فقط إذا كانت ثقتها عالية جداً وفرقها واضح
                  const accept = top.conf >= 0.95 && (!second || top.conf - second.conf >= 0.05);
                  if (accept) {
                    resolvedRegionExternalId = top.externalId;
                    resolvedRegionName = top.name;
                  }
                }
              }
            }

            console.log('🗺️ المطابقة المحلية:', {
              resolvedCityName,
              resolvedCityExternalId,
              resolvedRegionName,
              resolvedRegionExternalId,
              suggestionsCount: regionSuggestions.length,
            });
          } catch (geoErr) {
            console.warn('⚠️ فشل مطابقة المدينة/المنطقة:', geoErr);
          }

          // إذا وجدنا مدينة لكن لم نحسم المنطقة → اعرض "هل تقصد؟" بدل إنشاء طلب خاطئ
          if (resolvedCityExternalId && !resolvedRegionExternalId && regionSuggestions.length > 0) {
            const list = regionSuggestions
              .map((s, i) => `${i + 1}. ${s.name} (${Math.round(s.conf * 100)}%)`)
              .join('\n');
            finalAiResponse = `🤔 **هل تقصد إحدى هذه المناطق في ${resolvedCityName}؟**\n\n${list}\n\n✍️ أعد إرسال الطلب مع الاسم الكامل للمنطقة من القائمة.`;
            responseType = 'region_clarification';
            orderData = { needs_clarification: true, suggestions: regionSuggestions, city_name: resolvedCityName };
          } else if (resolvedCityExternalId && !resolvedRegionExternalId) {
            finalAiResponse = `⚠️ لم أتمكن من تحديد المنطقة في **${resolvedCityName}**.\n\n🔍 يرجى كتابة اسم المنطقة بشكل أوضح.`;
            responseType = 'region_clarification';
            orderData = { needs_clarification: true, suggestions: [], city_name: resolvedCityName };
          } else {
            console.log('📞 استدعاء process_telegram_order:', {
              employeeCode, aiChatId, resolvedCityExternalId, resolvedRegionExternalId
            });

            // ⚠️ نمرّر المعرفات الخارجية (alwaseet_id) لأن مسار التوصيل يقرأ
            // ai_orders.city_id / region_id كمعرفات خارجية مباشرة
            const { data: orderResult, error: orderError } = await supabase
              .rpc('process_telegram_order', {
                p_telegram_chat_id: aiChatId,
                p_employee_code: employeeCode,
                p_message_text: processedMessage,
                p_city_id: resolvedCityExternalId,
                p_region_id: resolvedRegionExternalId,
                p_city_name: resolvedCityName,
                p_region_name: resolvedRegionName,
              });

            if (orderError) {
              console.error('❌ خطأ في process_telegram_order:', orderError);
            } else if (orderResult?.success) {
              console.log('✅ تم إنشاء الطلب الذكي:', orderResult.order_id);

              // 🏷️ تحديث المصدر إلى ai_assistant
              const { error: updateSourceError } = await supabase
                .from('ai_orders')
                .update({ source: 'ai_assistant' })
                .eq('id', orderResult.order_id);
              if (updateSourceError) {
                console.warn('⚠️ تعذر تحديث source للطلب:', updateSourceError);
              }

            responseType = 'order';
            orderData = {
              ...orderResult,
              orderSaved: true,
              aiOrderId: orderResult.order_id,
            };

            // 📝 رسالة تأكيد واضحة
            const items = (orderResult.items || []).map((it: any) =>
              `• ${it.product_name || 'منتج'}${it.color ? ' - ' + it.color : ''}${it.size ? ' - ' + it.size : ''} × ${it.quantity || 1}`
            ).join('\n');

            const adjustmentLine = orderResult.adjustment_type === 'discount'
              ? `\n🎁 خصم: ${Math.abs(orderResult.price_adjustment || 0).toLocaleString()} د.ع`
              : orderResult.adjustment_type === 'markup'
                ? `\n📈 زيادة: ${(orderResult.price_adjustment || 0).toLocaleString()} د.ع`
                : '';

            const locationLabel = [resolvedCityName, resolvedRegionName].filter(Boolean).join(' - ');

            finalAiResponse = `✅ **تم تثبيت الطلب في نافذة طلبات الذكاء الاصطناعي**

👤 الزبون: ${orderResult.customer_name || '-'}
📞 الهاتف: ${orderResult.customer_phone || '-'}${orderResult.customer_phone2 ? ' / ' + orderResult.customer_phone2 : ''}
📍 الموقع: ${locationLabel || 'غير محدد'}
🏠 العنوان: ${orderResult.customer_address || '-'}

📦 المنتجات:
${items || '• لا توجد منتجات محددة'}

💰 المحسوب: ${(orderResult.calculated_amount || 0).toLocaleString()} د.ع
🚚 توصيل: ${(orderResult.delivery_fee || 5000).toLocaleString()} د.ع${adjustmentLine}
💵 **الإجمالي: ${(orderResult.total_amount || 0).toLocaleString()} د.ع**`;
          } else {
            // فشل (مثل: منتج غير متوفر) — أعرض رسالة الدالة
            console.warn('⚠️ فشل process_telegram_order:', orderResult?.message);
            if (orderResult?.message) {
              finalAiResponse = orderResult.message;
              responseType = 'order_failed';
              orderData = orderResult;
            }
          }
        }
      } catch (error) {
        console.error('Error processing smart order:', error);
      }
    }


    // إذا كان طلب إحصائيات الاستخدام
    if (message === 'get_usage_stats') {
      return new Response(JSON.stringify({
        success: true,
        usage_stats: Object.fromEntries(modelUsageStats),
        models_info: GEMINI_MODELS,
        current_time: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      response: finalAiResponse,
      model_used: 'gemini-2.5-flash',
      processing_time: Date.now() - Date.now(),
      confidence: 95,
      type: responseType,
      orderData: orderData,
      usage_stats: Object.fromEntries(modelUsageStats),
      debugInfo: {
        citiesCount: storeData.cities?.length || 0,
        regionsCount: storeData.regions?.length || 0,
        allTimeProfit: storeData.analytics?.allTimeStats?.actualProfit || 0,
        hasOrderIntent: hasOrderIntent,
        enhanceMode: true,
        ryusCustomMode: true
      },
      analytics: {
        todayRevenue: storeData.analytics?.todayStats?.total || 0,
        todayProfit: storeData.analytics?.todayStats?.profit || 0,
        monthlyRevenue: storeData.analytics?.monthStats?.total || 0,
        monthlyProfit: storeData.analytics?.monthStats?.actualProfit || 0,
        allTimeRevenue: storeData.analytics?.allTimeStats?.totalSales || 0,
        allTimeProfit: storeData.analytics?.allTimeStats?.actualProfit || 0,
        profitMargin: advancedAnalytics.profitAnalysis.profitMargin,
        productsCount: storeData.products.length,
        ordersCount: storeData.orders.length,
        outOfStockCount: advancedAnalytics.inventoryHealth.outOfStock.length,
        lowStockCount: advancedAnalytics.inventoryHealth.lowStock.length,
        variantsCount: storeData.products.reduce((sum: number, p: any) => sum + (p.variants?.length || 0), 0),
        recentOrdersCount: storeData.orders.length,
        citiesCount: storeData.cities.length,
        regionsCount: storeData.regions.length
      },
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in ai-gemini-chat:', error);
    const errorMessage = error instanceof Error ? error.message : 'خطأ غير محدد';
    
    // تحديد نوع الخطأ لإعطاء رد مناسب مع معلومات النظام الذكي
    let userResponse = "عذراً، حدث خطأ تقني. يرجى المحاولة مرة أخرى لاحقاً.";
    let errorType = 'unknown';
    
    if (errorMessage.includes('quota') || errorMessage.includes('429') || errorMessage.includes('لم يعد هناك نماذج متاحة')) {
      const availableModels = GEMINI_MODELS.filter(m => {
        const usage = modelUsageStats.get(m.name)?.daily || 0;
        return usage < m.dailyLimit * 0.9;
      });
      
      if (availableModels.length > 0) {
        userResponse = `⚠️ النموذج الحالي مُستنفد. يتم التحويل تلقائياً للنموذج التالي... (متوفر: ${availableModels.length} نموذج)`;
      } else {
        userResponse = "🚨 تم استنفاف جميع نماذج Gemini المتاحة (5,000+ طلب/يوم). سيتم التجديد تلقائياً في منتصف الليل (كاليفورنيا).";
      }
      errorType = 'quota_exceeded';
    } else if (errorMessage.includes('API key')) {
      userResponse = "⚠️ مشكلة في مفتاح Gemini API. يرجى التواصل مع المطور.";
      errorType = 'api_key_error';
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: errorType,
      errorDetails: errorMessage,
      response: userResponse,
      timestamp: new Date().toISOString(),
      modelStats: GEMINI_MODELS.map(m => ({
        name: m.name,
        description: m.description,
        used: modelUsageStats.get(m.name)?.daily || 0,
        limit: m.dailyLimit,
        available: (modelUsageStats.get(m.name)?.daily || 0) < m.dailyLimit * 0.9
      })),
      debugInfo: {
        errorType: errorType,
        originalError: errorMessage,
        totalModelsAvailable: GEMINI_MODELS.length,
        totalDailyQuota: GEMINI_MODELS.reduce((sum, m) => sum + m.dailyLimit, 0)
      }
    }), {
      status: errorType === 'quota_exceeded' ? 429 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});