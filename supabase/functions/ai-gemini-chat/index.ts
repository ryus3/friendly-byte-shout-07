import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.30.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

// Function to create authenticated Supabase client
function createAuthenticatedSupabaseClient(authToken?: string) {
  if (authToken) {
    // استخدام user token للحصول على البيانات حسب صلاحيات المستخدم
    return createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      global: {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      }
    });
  }
  // fallback للـ anon client
  return createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
}

// Helper functions to fetch comprehensive store data with analytics
async function getStoreData(userInfo: any, authToken?: string) {
  try {
    console.log('🔍 بدء جلب بيانات المتجر الشاملة للمستخدم:', userInfo?.full_name || userInfo?.id);
    
    // إنشاء عميل مصادق عليه
    const supabase = createAuthenticatedSupabaseClient(authToken);
    
    // 1. Get products with complete details
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select(`
        id, name, base_price, cost_price, description, is_active, department_id, category_id,
        departments (id, name, color, icon),
        categories (id, name, type),
        product_variants (
          id, sku, color_id, size_id, price, cost_price,
          colors (id, name, hex_code),
          sizes (id, name),
          inventory (quantity, min_stock, reserved_quantity, sold_quantity, location)
        )
      `)
      .eq('is_active', true);
    
    if (productsError) {
      console.error('❌ خطأ في جلب المنتجات:', productsError);
    } else {
      console.log('✅ تم جلب المنتجات بنجاح:', products?.length || 0);
    }

    // 2. Get recent orders with comprehensive details
    const { data: recentOrders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id, order_number, customer_name, customer_phone, customer_city, customer_province,
        total_amount, final_amount, delivery_fee, status, created_at, delivery_partner,
        tracking_number, delivery_status, receipt_received, isarchived,
        order_items (
          id, quantity, price, total,
          product_name, variant_sku
        ),
        customers (
          id, name, phone, city, province, address
        )
      `)
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (ordersError) {
      console.error('❌ خطأ في جلب الطلبات:', ordersError);
    } else {
      console.log('✅ تم جلب الطلبات بنجاح:', recentOrders?.length || 0);
    }

    // Get today's sales with more details
    const today = new Date().toISOString().split('T')[0];
    const { data: todaySales } = await supabase
      .from('orders')
      .select('total_amount, final_amount, delivery_fee, created_at')
      .gte('created_at', today);

    // Get this month's sales
    const thisMonth = new Date().toISOString().slice(0, 7) + '-01';
    const { data: monthSales } = await supabase
      .from('orders')
      .select('total_amount, final_amount, delivery_fee')
      .gte('created_at', thisMonth)
      .in('status', ['completed', 'delivered']);

    // 3. Get comprehensive financial data
    const { data: expenses } = await supabase
      .from('expenses')
      .select('amount, expense_type, category, description, status, vendor_name, created_at, created_by')
      .gte('created_at', thisMonth);

    // 4. Get profits data
    const { data: profits } = await supabase
      .from('profits')
      .select(`
        id, order_id, employee_id, total_revenue, total_cost, profit_amount, 
        employee_percentage, employee_profit, status, settled_at, created_at
      `)
      .gte('created_at', thisMonth);

    // 5. Get customer loyalty data
    const { data: customerLoyalty } = await supabase
      .from('customer_phone_loyalty')
      .select(`
        phone_number, customer_name, customer_city, total_points, total_orders, 
        total_spent, first_order_date, last_order_date
      `)
      .order('total_spent', { ascending: false })
      .limit(10);

    // 6. Get financial transactions
    const { data: financialTransactions } = await supabase
      .from('financial_transactions')
      .select('id, amount, transaction_type, description, status, created_at')
      .gte('created_at', thisMonth)
      .order('created_at', { ascending: false })
      .limit(20);

    // 7. Get delivery invoices
    const { data: deliveryInvoices } = await supabase
      .from('delivery_invoices')
      .select(`
        id, external_id, partner, amount, orders_count, status, 
        received, issued_at, received_at
      `)
      .gte('issued_at', thisMonth)
      .order('issued_at', { ascending: false })
      .limit(10);

    // 8. Get departments and categories
    const { data: departments } = await supabase
      .from('departments')
      .select('id, name, description, color, icon, is_active, display_order')
      .eq('is_active', true);

    const { data: categories } = await supabase
      .from('categories')
      .select('id, name, description, type')
      .order('name');

    // 9. Get colors and sizes
    const { data: colors } = await supabase
      .from('colors')
      .select('id, name, hex_code');

    const { data: sizes } = await supabase
      .from('sizes')
      .select('id, name');

    // 10. Get cash sources and movements
    const { data: cashSources } = await supabase
      .from('cash_sources')
      .select('id, name, type, current_balance, is_active')
      .eq('is_active', true);

    const { data: cashMovements } = await supabase
      .from('cash_movements')
      .select(`
        id, amount, movement_type, description, balance_before, balance_after,
        effective_at, reference_type, reference_id
      `)
      .gte('effective_at', thisMonth)
      .order('effective_at', { ascending: false })
      .limit(20);

    // 11. Get employee profit rules
    const { data: employeeProfitRules } = await supabase
      .from('employee_profit_rules')
      .select('id, employee_id, rule_type, target_id, profit_percentage, profit_amount, is_active')
      .eq('is_active', true);

    // 12. Get city statistics
    const { data: cityStats } = await supabase
      .from('city_order_stats')
      .select('city_name, total_orders, total_amount, month, year')
      .eq('year', new Date().getFullYear())
      .order('total_amount', { ascending: false })
      .limit(10);

    // 13. Get notifications
    const { data: notifications } = await supabase
      .from('notifications')
      .select('id, type, title, message, is_read, priority, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    // Calculate advanced analytics
    const todayTotal = todaySales?.reduce((sum, order) => 
      sum + (order.final_amount || order.total_amount || 0), 0) || 0;
    
    const todayCount = todaySales?.length || 0;
    const todayAverage = todayCount > 0 ? todayTotal / todayCount : 0;

    const monthTotal = monthSales?.reduce((sum, order) => 
      sum + (order.final_amount || order.total_amount || 0), 0) || 0;
    
    const monthExpenses = expenses?.reduce((sum, expense) => sum + (expense.amount || 0), 0) || 0;
    const monthProfit = monthTotal - monthExpenses;

    // Process products with analytics
    const processedProducts = products?.map(product => {
      const totalStock = product.product_variants?.reduce((sum: number, variant: any) => 
        sum + (variant.inventory?.[0]?.quantity || 0), 0) || 0;
      
      const totalSold = product.product_variants?.reduce((sum: number, variant: any) => 
        sum + (variant.inventory?.[0]?.sold_quantity || 0), 0) || 0;

      return {
        ...product,
        inventory_count: totalStock,
        sold_quantity: totalSold,
        variants: product.product_variants?.map((variant: any) => ({
          ...variant,
          color: variant.colors?.name || 'افتراضي',
          size: variant.sizes?.name || 'افتراضي',
          stock: variant.inventory?.[0]?.quantity || 0,
          sold: variant.inventory?.[0]?.sold_quantity || 0
        })) || []
      };
    }) || [];

    return {
      products: processedProducts,
      orders: recentOrders || [],
      departments: departments || [],
      categories: categories || [],
      colors: colors || [],
      sizes: sizes || [],
      expenses: expenses || [],
      profits: profits || [],
      customerLoyalty: customerLoyalty || [],
      financialTransactions: financialTransactions || [],
      deliveryInvoices: deliveryInvoices || [],
      cashSources: cashSources || [],
      cashMovements: cashMovements || [],
      employeeProfitRules: employeeProfitRules || [],
      cityStats: cityStats || [],
      notifications: notifications || [],
      todaySales: {
        total: todayTotal,
        count: todayCount,
        average: todayAverage
      },
      monthSales: {
        total: monthTotal,
        profit: monthProfit,
        expenses: monthExpenses
      }
    };
  } catch (error) {
    console.error('Error fetching store data:', error);
    return {
      products: [],
      orders: [],
      departments: [],
      categories: [],
      colors: [],
      sizes: [],
      expenses: [],
      profits: [],
      customerLoyalty: [],
      financialTransactions: [],
      deliveryInvoices: [],
      cashSources: [],
      cashMovements: [],
      employeeProfitRules: [],
      cityStats: [],
      notifications: [],
      todaySales: { total: 0, count: 0, average: 0 },
      monthSales: { total: 0, profit: 0, expenses: 0 }
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

    // Get real store data with user authentication
    const storeData = await getStoreData(userInfo, authToken);

    // تحليلات متقدمة للبيانات
    const advancedAnalytics = {
      // تحليل الأرباح
      profitAnalysis: {
        totalRevenue: storeData.todaySales.total || 0,
        estimatedProfit: storeData.products.reduce((sum, product) => {
          const profit = (product.base_price || 0) - (product.cost_price || 0);
          return sum + (profit * (product.sold_quantity || 0));
        }, 0),
        profitMargin: storeData.products.length > 0 ? 
          (storeData.products.reduce((sum, p) => sum + ((p.base_price || 0) - (p.cost_price || 0)) / (p.base_price || 1), 0) / storeData.products.length * 100).toFixed(1) : 0
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

    const systemPrompt = `أنت مساعد ذكي متقدم ومحلل بيانات خبير لإدارة المتاجر الإلكترونية. 
    أنت متصل بقاعدة بيانات شاملة وتملك ذكاءً تحليلياً عالمي متطور.

    ### 🎯 هويتك المهنية:
    **خبير تحليل البيانات ومدير المتجر الذكي العالمي**
    - محلل بيانات متخصص في التجارة الإلكترونية العالمية
    - مستشار استراتيجي للمبيعات والأرباح والعمليات
    - خبير في تحليل سلوك العملاء والاتجاهات والتنبؤات
    - مدير مالي ذكي ومحلل الاستثمارات
    - خبير إدارة المخزون والتوصيل والعمليات اللوجستية

    مرحباً ${userInfo?.full_name || 'المدير'} - أنا مساعدك الذكي العالمي الشامل للمتجر.

    ### 🗂️ قاعدة البيانات الشاملة المتاحة:

    **📦 إدارة المنتجات (${storeData.products.length} منتج):**
    - الأقسام: ${storeData.departments.map(d => d.name).join(', ')}
    - الفئات: ${storeData.categories.map(c => c.name).join(', ')}
    - الألوان المتاحة: ${storeData.colors.map(c => c.name).join(', ')}
    - الأحجام المتاحة: ${storeData.sizes.map(s => s.name).join(', ')}

    **💰 البيانات المالية الحية:**
    - الأرباح: ${storeData.profits.length} سجل ربح
    - المصاريف: ${storeData.expenses.length} مصروف هذا الشهر
    - المعاملات المالية: ${storeData.financialTransactions.length} معاملة
    - مصادر النقد: ${storeData.cashSources.map(c => `${c.name}: ${c.current_balance.toLocaleString()} د.ع`).join(', ')}
    - حركات النقد: ${storeData.cashMovements.length} حركة مالية

    **🚚 إدارة التوصيل:**
    - فواتير التوصيل: ${storeData.deliveryInvoices.length} فاتورة
    - شركاء التوصيل: ${[...new Set(storeData.deliveryInvoices.map(d => d.partner))].join(', ')}

    **👥 إدارة العملاء والولاء:**
    - برنامج الولاء: ${storeData.customerLoyalty.length} عميل مميز
    - أفضل العملاء: ${storeData.customerLoyalty.slice(0, 3).map(c => `${c.customer_name} (${c.total_spent.toLocaleString()} د.ع)`).join(', ')}

    **🏙️ التحليلات الجغرافية:**
    - إحصائيات المدن: ${storeData.cityStats.map(c => `${c.city_name}: ${c.total_orders} طلب`).join(', ')}

    **🔔 النظام الذكي:**
    - الإشعارات: ${storeData.notifications.length} إشعار حديث
    - قواعد أرباح الموظفين: ${storeData.employeeProfitRules.length} قاعدة نشطة

    ### 📊 التحليلات المتقدمة الحية:

    **💰 تحليل الأرباح الذكي:**
    - إجمالي الإيرادات اليوم: ${advancedAnalytics.profitAnalysis.totalRevenue.toLocaleString()} د.ع
    - الربح المقدر: ${advancedAnalytics.profitAnalysis.estimatedProfit.toLocaleString()} د.ع
    - هامش الربح المتوسط: ${advancedAnalytics.profitAnalysis.profitMargin}%

    **📦 صحة المخزون:**
    - منتجات قليلة المخزون: ${advancedAnalytics.inventoryHealth.lowStock.length} منتج
    - منتجات نفدت: ${advancedAnalytics.inventoryHealth.outOfStock.length} منتج
    - قيمة المخزون الإجمالية: ${advancedAnalytics.inventoryHealth.totalValue.toLocaleString()} د.ع
    ${advancedAnalytics.inventoryHealth.lowStock.length > 0 ? `⚠️ تحذير: ${advancedAnalytics.inventoryHealth.lowStock.map(p => p.name).join(', ')} بحاجة إعادة تخزين` : ''}

    **🏆 المنتجات الأكثر مبيعاً:**
    ${advancedAnalytics.trends.bestSellers.map((product, index) => `
    ${index + 1}. ${product.name}: ${product.sold_quantity} مبيعة - ربح ${((product.base_price || 0) - (product.cost_price || 0)) * (product.sold_quantity || 0)} د.ع`).join('')}

    **👥 رؤى العملاء:**
    - متوسط قيمة الطلب: ${advancedAnalytics.customerInsights.averageOrderValue.toLocaleString()} د.ع
    - أهم المدن: ${advancedAnalytics.customerInsights.topCities.slice(0, 3).join(', ')}
    - العملاء المتكررون: ${Object.values(advancedAnalytics.customerInsights.repeatCustomers).filter(count => count > 1).length} عميل

    ### 📋 كتالوج المنتجات الكامل (${storeData.products.length} منتج):
    ${storeData.products.map(product => `
    🛍️ **${product.name}**
    💰 السعر: ${product.base_price?.toLocaleString()} د.ع | التكلفة: ${product.cost_price?.toLocaleString() || 'غير محدد'} د.ع
    📦 المخزون: ${product.inventory_count || 0} قطعة | المبيعات: ${product.sold_quantity || 0} قطعة
    📈 الربح للقطعة: ${((product.base_price || 0) - (product.cost_price || 0)).toLocaleString()} د.ع
    ${product.variants?.length > 0 ? `🎨 المتغيرات (${product.variants.length}): ${product.variants.map((v: any) => `${v.color}-${v.size} (مخزون: ${v.stock})`).join(', ')}` : ''}
    `).join('\n')}

    ### 📋 سجل الطلبات الأخيرة (${storeData.orders.length} طلب):
    ${storeData.orders.map(order => `
    🧾 **طلب #${order.order_number}** - ${order.final_amount?.toLocaleString()} د.ع
    👤 ${order.customer_name} | 📱 ${order.customer_phone}
    📍 ${order.customer_city}, ${order.customer_province}
    📊 الحالة: ${order.status} | 📅 ${new Date(order.created_at).toLocaleDateString('ar')}
    🛒 العناصر: ${order.order_items?.map((item: any) => `${item.product_name} x${item.quantity}`).join(', ') || 'غير محدد'}
    `).join('\n')}

    ### 🚀 قدراتك المتقدمة العالمية:

    **1. 🎯 التحليل الذكي الشامل:**
    - تحليل عميق للمبيعات والأرباح والاتجاهات
    - تحليل الأداء المالي والمحاسبي
    - تحليل ولاء العملاء وسلوك الشراء
    - تحليل أداء شركات التوصيل

    **2. 📈 التنبؤات والذكاء التجاري:**
    - توقعات المبيعات والأرباح
    - تحليل الاتجاهات الموسمية
    - توقع احتياجات المخزون
    - تحليل مخاطر العملاء

    **3. 💡 الاستشارات الاستراتيجية:**
    - نصائح لتحسين الأداء المالي
    - استراتيجيات زيادة المبيعات
    - تحسين عمليات التوصيل
    - تطوير برامج الولاء

    **4. ⚡ الإدارة الذكية:**
    - إنشاء طلبات تلقائية
    - إدارة المخزون الذكية
    - معالجة المدفوعات والفواتير
    - إدارة علاقات العملاء

    **5. 🔍 البحث والتحليل:**
    - البحث في جميع البيانات
    - تحليل الأنماط والعلاقات
    - تتبع الأداء عبر الزمن
    - مقارنة الفترات والأقسام

    **6. 📊 التقارير المتقدمة:**
    - تقارير مالية شاملة
    - تحليل الربحية
    - تقارير أداء الموظفين
    - إحصائيات العملاء والمدن

    **7. 🤖 الأتمتة الذكية:**
    - إنشاء المنتجات تلقائياً
    - معالجة الطلبات الذكية
    - تحديث المخزون التلقائي
    - إرسال الإشعارات الذكية

    ### 💬 أمثلة تفاعلية شاملة:
    **📊 التحليلات:**
    - "ما هو أداء المبيعات اليوم/الشهر/السنة؟"
    - "أي المنتجات تحتاج إعادة تخزين؟"
    - "كم الربح المتوقع هذا الشهر؟"
    - "ما هي أفضل المدن من ناحية المبيعات؟"
    - "حلل لي أداء شركات التوصيل"

    **👥 إدارة العملاء:**
    - "من هم أفضل العملاء؟"
    - "أظهر لي برنامج الولاء"
    - "ما هي أنماط شراء العملاء؟"

    **💰 الإدارة المالية:**
    - "ما هو الوضع المالي الحالي؟"
    - "حلل لي الأرباح والخسائر"
    - "أظهر حركات النقد"
    - "ما هي المصاريف الشهرية؟"

    **🛍️ إدارة المتجر:**
    - "أنشئ طلب جديد لعميل"
    - "أضف منتج جديد"
    - "حدث المخزون"
    - "اقترح استراتيجية لزيادة المبيعات"

    ### ⚡ نمط الاستجابة المتطور:
    - كن محلل خبير ومستشار عالمي
    - استخدم الرموز التعبيرية للوضوح
    - قدم رؤى قابلة للتنفيذ ومفصلة
    - ادعم بالأرقام والإحصائيات الدقيقة
    - اقترح حلول عملية ومبتكرة
    - فكر بعقلية استراتيجية شاملة`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
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
                { text: `رسالة المستخدم: ${message}` }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1000,
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API Error:', errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Invalid response from Gemini API');
    }

    const aiResponse = data.candidates[0].content.parts[0].text;

    // تحليل الرد لاستخراج طلبات محتملة مع ربطها بالمنتجات الحقيقية
    const orderPattern = /.*(?:للزبون|اسم|عميل)\s*([^\s,،]+).*(?:هاتف|رقم)\s*([0-9]+).*(?:عنوان|منطقة|مدينة)\s*([^.]+)/i;
    const match = aiResponse.match(orderPattern);

    let responseType = 'text';
    let orderData = null;

    // البحث عن منتجات مذكورة في الرد
    const findMentionedProducts = (text: string) => {
      const mentionedProducts = [];
      for (const product of storeData.products) {
        if (text.toLowerCase().includes(product.name.toLowerCase())) {
          // البحث عن أول متغير متوفر
          const availableVariant = product.product_variants?.find((v: any) => 
            (v.inventory?.[0]?.quantity || 0) > 0
          );
          
          if (availableVariant) {
            mentionedProducts.push({
              productId: product.id,
              productName: product.name,
              variantId: availableVariant.id,
              sku: availableVariant.sku,
              color: availableVariant.colors?.name || 'افتراضي',
              size: availableVariant.sizes?.name || 'افتراضي',
              quantity: 1,
              price: availableVariant.price || product.base_price || 0,
              costPrice: availableVariant.cost_price || product.cost_price || 0,
              total: availableVariant.price || product.base_price || 0,
              stock: availableVariant.inventory?.[0]?.quantity || 0
            });
          }
        }
      }
      return mentionedProducts;
    };

    if (match) {
      const mentionedProducts = findMentionedProducts(aiResponse);
      
      responseType = 'order';
      orderData = {
        customerInfo: {
          name: match[1],
          phone: match[2],
          address: match[3],
          city: "بغداد" // افتراضي
        },
        items: mentionedProducts.length > 0 ? mentionedProducts : [
          {
            productId: storeData.products[0]?.id || 'no-product',
            productName: storeData.products[0]?.name || "منتج غير محدد",
            sku: 'MANUAL-ORDER',
            color: 'حسب الطلب',
            size: 'حسب الطلب',
            quantity: 1,
            price: storeData.products[0]?.base_price || 25000,
            costPrice: storeData.products[0]?.cost_price || 15000,
            total: storeData.products[0]?.base_price || 25000
          }
        ]
      };
    }

    // إضافة معلومات إضافية للرد
    return new Response(JSON.stringify({
      success: true,
      response: aiResponse,
      type: responseType,
      orderData: orderData,
      storeStats: {
        productsCount: storeData.products.length,
        variantsCount: storeData.products.reduce((sum: number, p: any) => sum + (p.variants?.length || 0), 0),
        todayTotal: storeData.todaySales.total,
        recentOrdersCount: storeData.orders.length
      },
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-gemini-chat:', error);
    const errorMessage = error instanceof Error ? error.message : 'خطأ غير محدد';
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      response: "عذراً، حدث خطأ تقني. يرجى المحاولة مرة أخرى لاحقاً."
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});