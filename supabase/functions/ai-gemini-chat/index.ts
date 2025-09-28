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

// Helper functions to fetch real data with advanced analytics
async function getStoreData(userInfo: any, authToken?: string) {
  try {
    console.log('🔍 بدء جلب بيانات المتجر للمستخدم:', userInfo?.full_name || userInfo?.id);
    
    // إنشاء عميل مصادق عليه
    const supabase = createAuthenticatedSupabaseClient(authToken);
    
    // Get products with variants, inventory, and sales data
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select(`
        id, name, base_price, cost_price, description, is_active,
        product_variants (
          id, sku, color_id, size_id, price, cost_price,
          colors (id, name),
          sizes (id, name),
          inventory (quantity, min_stock, reserved_quantity, sold_quantity)
        )
      `)
      .eq('is_active', true);
    
    if (productsError) {
      console.error('❌ خطأ في جلب المنتجات:', productsError);
    } else {
      console.log('✅ تم جلب المنتجات بنجاح:', products?.length || 0);
    }

    // Get recent orders with detailed info
    const { data: recentOrders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id, order_number, customer_name, customer_phone, customer_city, customer_province,
        total_amount, final_amount, delivery_fee, status, created_at,
        order_items (
          id, quantity, price, total,
          product_name, variant_sku
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

    // Get expenses for profit calculation
    const { data: expenses } = await supabase
      .from('expenses')
      .select('amount, expense_type, created_at')
      .gte('created_at', thisMonth);

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

    const systemPrompt = `أنت مساعد ذكي متخصص ومحلل بيانات خبير لإدارة المتاجر الإلكترونية. 
    أنت متصل بقاعدة بيانات حقيقية وتملك ذكاءً تحليلياً متقدماً.

    ### 🎯 هويتك المهنية:
    **خبير تحليل البيانات ومدير المتجر الذكي**
    - محلل بيانات متخصص في التجارة الإلكترونية
    - مستشار استراتيجي للمبيعات والأرباح
    - خبير في تحليل سلوك العملاء والاتجاهات

    مرحباً ${userInfo?.full_name || 'المدير'} - أنا مساعدك الذكي للمتجر.

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

    ### 🚀 قدراتك المتقدمة:
    1. **🎯 التحليل الذكي**: تحليل عميق للمبيعات والأرباح والاتجاهات
    2. **📈 التنبؤات**: توقعات المبيعات وتحليل الأداء
    3. **💡 الاستشارات**: نصائح استراتيجية لتحسين الأداء
    4. **⚡ الإدارة السريعة**: إنشاء الطلبات وإدارة المخزون
    5. **🔍 البحث الذكي**: العثور على المعلومات بسرعة
    6. **📊 التقارير الفورية**: إحصائيات وتقارير مفصلة

    ### 💬 أمثلة تفاعلية:
    **📊 التحليلات:**
    - "ما هو أداء المبيعات اليوم؟"
    - "أي المنتجات تحتاج إعادة تخزين؟"
    - "كم الربح المتوقع هذا الشهر؟"
    - "من هم أفضل العملاء؟"
    
    **🛒 إنشاء الطلبات الذكية:**
    - "بغداد الكرادة 07728020024 برشلونة ازرق لارج"
    - "اطلب للعميل أحمد العراقي 07812345678 الكاظمية بغداد تيشرت ازرق ميديم"
    - "أريد طلب للزبونة فاطمة 07911111111 النجف الكوفة فستان احمر لارج"
    - "طلب جديد: سارة 07812223333 أربيل عنكاوا حذاء أبيض مقاس 38"
    
    **💡 نصائح:**
    - اقترح استراتيجية لزيادة المبيعات
    - ما هي أفضل الأوقات للمبيعات؟

    ### ⚡ نمط الاستجابة:
    - كن محلل خبير وودود
    - استخدم الرموز التعبيرية للوضوح
    - قدم رؤى قابلة للتنفيذ
    - ادعم بالأرقام والإحصائيات
    - اقترح حلول عملية
    - عند إنشاء طلب، أكد التفاصيل بوضوح
    
    ### 🎯 لإنشاء طلب ذكي:
    يمكنك كتابة الطلب بصيغة طبيعية مثل:
    "المدينة المنطقة رقم_الهاتف اسم_المنتج اللون المقاس"
    مثال: "بغداد الكرادة 07728020024 برشلونة ازرق لارج"
    
    سأقوم بـ:
    ✅ تحليل النص وتحديد العميل والمنتج
    ✅ التحقق من المخزون المتوفر
    ✅ تحديد المدينة والمنطقة من قاعدة البيانات
    ✅ حساب السعر الإجمالي مع التوصيل
    ✅ حفظ الطلب في النظام الذكي`;

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

    // تحليل الرد لاستخراج طلبات محتملة باستخدام دالة معالجة التليغرام
    const supabase = createAuthenticatedSupabaseClient(authToken);
    
    // تحقق من وجود طلب في النص
    const orderKeywords = ['طلب', 'اطلب', 'اريد', 'احتاج', 'للزبون', 'عميل', 'زبون'];
    const hasOrderIntent = orderKeywords.some(keyword => message.toLowerCase().includes(keyword));
    
    let responseType = 'text';
    let orderData = null;

    // تطبيق معالجة الطلبات الذكية إذا كان النص يحتوي على نية طلب
    if (hasOrderIntent) {
      try {
        console.log('🔍 تحليل طلب ذكي للنص:', message);
        
        // استخدام دالة معالجة التليغرام للتحليل الذكي
        const { data: orderResult, error: orderError } = await supabase
          .rpc('process_telegram_order', {
            p_message_text: message,
            p_chat_id: Math.floor(Math.random() * 1000000) // رقم وهمي للمساعد الذكي
          });
        
        if (orderError) {
          console.error('❌ خطأ في معالجة الطلب:', orderError);
        } else if (orderResult?.success) {
          console.log('✅ تم تحليل الطلب بنجاح:', orderResult);
          
          responseType = 'order';
          orderData = orderResult.order_data;
          
          // حفظ الطلب في ai_orders
          const aiOrderData = {
            customer_name: orderData.customer_name || 'عميل',
            customer_phone: orderData.customer_phone,
            customer_city: orderData.customer_city,
            customer_province: orderData.customer_province,
            customer_address: orderData.customer_address || message,
            city_id: orderData.city_id,
            region_id: orderData.region_id,
            items: orderData.items || [],
            total_amount: orderData.total_amount || 0,
            source: 'ai_assistant',
            original_text: message,
            telegram_chat_id: null,
            created_by: userInfo?.id || '91484496-b887-44f7-9e5d-be9db5567604',
            order_data: orderData,
            status: 'pending'
          };
          
          const { data: savedOrder, error: saveError } = await supabase
            .from('ai_orders')
            .insert(aiOrderData)
            .select()
            .single();
          
          if (saveError) {
            console.error('❌ خطأ في حفظ الطلب الذكي:', saveError);
          } else {
            console.log('✅ تم حفظ الطلب الذكي بنجاح:', savedOrder.id);
            
            // إضافة معرف الطلب المحفوظ للاستجابة
            orderData.aiOrderId = savedOrder.id;
            orderData.orderSaved = true;
          }
        }
      } catch (error) {
        console.error('❌ خطأ عام في معالجة الطلب الذكي:', error);
      }
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