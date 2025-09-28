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

// Helper functions to fetch real data
async function getStoreData() {
  try {
    // Get products with variants and inventory
    const { data: products } = await supabase
      .from('products')
      .select(`
        id, name, price, cost_price, description,
        product_variants (
          id, sku, color_id, size_id, price, cost_price,
          colors (id, name),
          sizes (id, name),
          inventory (quantity, min_stock, reserved_quantity)
        )
      `)
      .eq('is_active', true);

    // Get recent orders and sales stats
    const { data: recentOrders } = await supabase
      .from('orders')
      .select('id, order_number, customer_name, customer_phone, total_amount, created_at, status')
      .order('created_at', { ascending: false })
      .limit(10);

    // Get today's sales
    const today = new Date().toISOString().split('T')[0];
    const { data: todaySales } = await supabase
      .from('orders')
      .select('total_amount, final_amount')
      .gte('created_at', today)
      .eq('status', 'completed');

    // Calculate daily sales
    const todayTotal = todaySales?.reduce((sum, order) => 
      sum + (order.final_amount || order.total_amount || 0), 0) || 0;

    return {
      products: products || [],
      recentOrders: recentOrders || [],
      todayTotal,
      productsCount: products?.length || 0,
      variantsCount: products?.reduce((sum, p) => sum + (p.product_variants?.length || 0), 0) || 0
    };
  } catch (error) {
    console.error('Error fetching store data:', error);
    return {
      products: [],
      recentOrders: [],
      todayTotal: 0,
      productsCount: 0,
      variantsCount: 0
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

    // بناء السياق العربي المتخصص للمتجر مع البيانات الحقيقية
    const systemPrompt = `أنت مساعد ذكي متخصص في إدارة متاجر الملابس والأحذية في العراق. اسمك "المساعد الذكي RYUS".

معلومات المستخدم:
- الاسم: ${userInfo?.full_name || userInfo?.fullName || 'المستخدم'}
- الوضع: ${userInfo?.isAdmin ? 'مدير' : 'موظف'}

🏪 معلومات المتجر الحقيقية (محدثة لحظياً):
📦 المنتجات المتوفرة: ${storeData.productsCount} منتجات أساسية
🎨 المتغيرات: ${storeData.variantsCount} متغير (ألوان وأحجام)
💰 مبيعات اليوم: ${storeData.todayTotal.toLocaleString()} دينار
📋 الطلبات الحديثة: ${storeData.recentOrders.length} طلب

📦 قائمة المنتجات الحقيقية:
${storeData.products.map(product => `
- ${product.name}: ${product.price?.toLocaleString() || 'غير محدد'} دينار
  المتغيرات: ${product.product_variants?.map((v: any) => 
    `${v.colors?.name || 'بدون لون'} - ${v.sizes?.name || 'بدون مقاس'} (المخزون: ${v.inventory?.[0]?.quantity || 0})`
  ).join(', ') || 'لا توجد متغيرات'}
`).join('')}

📊 آخر الطلبات:
${storeData.recentOrders.slice(0, 5).map(order => `
- طلب #${order.order_number}: ${order.customer_name} - ${order.total_amount?.toLocaleString()} دينار (${order.status})
`).join('')}

🎯 تخصصك الرئيسي:
1. إنشاء وإدارة الطلبات بالمنتجات الحقيقية والأسعار الفعلية
2. تحليل البيانات والإحصائيات الحقيقية للمتجر
3. فهم طلبات العملاء بالعربية العامية والفصحى
4. استخراج معلومات العملاء (الاسم، الهاتف، العنوان، المدينة)
5. التعرف على المنتجات والألوان والأحجام من القائمة الحقيقية
6. حساب الأسعار الحقيقية وأجور التوصيل
7. تقديم تحليلات المبيعات والأرباح
8. إدارة المخزون ومتابعة الكميات

💡 قدرات إضافية:
- تحليل أداء المبيعات والأرباح
- اقتراح المنتجات بناءً على المخزون
- تتبع حالة الطلبات
- إحصائيات يومية وشهرية
- تنبيهات المخزون المنخفض

إرشادات المحادثة:
- تحدث بالعربية العراقية الودودة
- استخدم البيانات الحقيقية دائماً
- كن مفيداً ومحترفاً في التحليل
- اطلب توضيحات إذا لم تفهم الطلب
- اعرض الخيارات المتاحة بوضوح مع الأسعار الحقيقية
- أكد تفاصيل الطلب قبل الإنشاء
- قدم نصائح ذكية لتحسين المبيعات

عند استلام طلب عميل، استخرج:
- اسم العميل
- رقم الهاتف
- العنوان الكامل والمدينة
- تفاصيل المنتجات المطلوبة من القائمة الحقيقية

إذا كانت المعلومات ناقصة، اطلب التوضيح بلطف.`;

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
              price: availableVariant.price || product.price || 0,
              costPrice: availableVariant.cost_price || product.cost_price || 0,
              total: availableVariant.price || product.price || 0,
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
            price: storeData.products[0]?.price || 25000,
            costPrice: storeData.products[0]?.cost_price || 15000,
            total: storeData.products[0]?.price || 25000
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
        productsCount: storeData.productsCount,
        variantsCount: storeData.variantsCount,
        todayTotal: storeData.todayTotal,
        recentOrdersCount: storeData.recentOrders.length
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