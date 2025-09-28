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

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);

// Helper functions to fetch real data with advanced analytics
async function getStoreData() {
  try {
    // Get products with variants, inventory, and sales data
    const { data: products } = await supabase
      .from('products')
      .select(`
        id, name, base_price, cost_price, description, is_active,
        categories (id, name),
        product_variants (
          id, sku, color_id, size_id, price, cost_price,
          colors (id, name),
          sizes (id, name),
          inventory (quantity, min_stock, reserved_quantity, sold_quantity)
        )
      `)
      .eq('is_active', true);

    // Get recent orders with detailed info
    const { data: recentOrders } = await supabase
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

    // Get real store data
    const storeData = await getStoreData();

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

    ### 👤 معلومات المستخدم:
    - الاسم: ${userInfo?.full_name || userInfo?.fullName || 'المدير'}
    - الدور: ${userInfo?.isAdmin ? 'مدير' : 'موظف'}
    - معرف المستخدم: ${userInfo?.id || 'admin'}

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
    🏷️ التصنيف: ${product.categories?.name || 'متنوع'}
    ${product.variants?.length > 0 ? `🎨 المتغيرات: ${product.variants.map((v: any) => `${v.colors?.name || ''}-${v.sizes?.name || ''} (${v.stock || 0})`).join(', ')}` : ''}
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
    - "ما هو أداء المبيعات اليوم؟"
    - "أي المنتجات تحتاج إعادة تخزين؟"
    - "كم الربح المتوقع هذا الشهر؟"
    - "من هم أفضل العملاء؟"
    - "أنشئ طلب جديد لعميل"
    - "اقترح استراتيجية لزيادة المبيعات"

    ### ⚡ نمط الاستجابة:
    - كن محلل خبير وودود
    - استخدم الرموز التعبيرية للوضوح
    - قدم رؤى قابلة للتنفيذ
    - ادعم بالأرقام والإحصائيات
    - اقترح حلول عملية`;

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