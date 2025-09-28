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

// إنشاء عميل Supabase بصلاحيات SERVICE ROLE مثل بوت التليغرام
const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

// Helper functions to fetch real data with advanced analytics
async function getStoreData(userInfo: any, authToken?: string) {
  try {
    console.log('🔍 بدء جلب بيانات المتجر للمستخدم:', userInfo?.full_name || userInfo?.id);
    
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

    // Get recent orders with detailed profit info
    const { data: recentOrders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id, order_number, customer_name, customer_phone, customer_city, customer_province,
        total_amount, final_amount, delivery_fee, status, created_at, created_by,
        order_items (
          id, quantity, unit_price, total_price,
          product_name, variant_sku
        ),
        profits (
          profit_amount, employee_profit, status
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

    // Get ALL-TIME sales data (not just this month)
    const { data: allTimeSales } = await supabase
      .from('orders')
      .select('total_amount, final_amount, delivery_fee, created_at')
      .in('status', ['completed', 'delivered'])
      .order('created_at', { ascending: false })
      .limit(1000);

    // Get this month's sales
    const thisMonth = new Date().toISOString().slice(0, 7) + '-01';
    const { data: monthSales } = await supabase
      .from('orders')
      .select('total_amount, final_amount, delivery_fee')
      .gte('created_at', thisMonth)
      .in('status', ['completed', 'delivered']);

    // Get expenses and profits for comprehensive financial data (ALL TIME)
    const { data: allExpenses } = await supabase
      .from('expenses')
      .select('amount, expense_type, created_at')
      .order('created_at', { ascending: false })
      .limit(500);

    const { data: monthExpenses } = await supabase
      .from('expenses')
      .select('amount, expense_type, created_at')
      .gte('created_at', thisMonth);

    // Get profit analytics (ALL TIME)
    const { data: allProfits } = await supabase
      .from('profits')
      .select('profit_amount, employee_profit, status, created_at')
      .order('created_at', { ascending: false })
      .limit(1000);

    const { data: monthProfits } = await supabase
      .from('profits')
      .select('profit_amount, employee_profit, status, created_at')
      .gte('created_at', thisMonth);

    const { data: todayProfits } = await supabase
      .from('profits')
      .select('profit_amount, employee_profit, status')
      .gte('created_at', today);

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
      cities: cities || [],
      regions: regions || [],
      analytics: {
        citiesCount: cities?.length || 0,
        regionsCount: regions?.length || 0,
        productsCount: processedProducts?.length || 0,
        totalVariantsCount: processedProducts?.reduce((sum, p) => sum + (p.variants?.length || 0), 0) || 0,
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
      analytics: {
        citiesCount: 0,
        regionsCount: 0,
        productsCount: 0,
        totalVariantsCount: 0,
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

    // Get real store data with user authentication
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

    // إعداد قوائم المدن والمناطق الحقيقية
    const cityList = storeData.cities.map(c => c.name).slice(0, 10).join(', ');
    const availableProducts = storeData.products.filter(p => (p.inventory_count || 0) > 0);
    const outOfStockProducts = storeData.products.filter(p => (p.inventory_count || 0) === 0);

const systemPrompt = `🧠 أنت مساعد RYUS الذكي الخارق - الآن لديك وصول كامل لقاعدة البيانات الحقيقية ونظام مثالي لإنشاء الطلبات

**شخصيتك:** مساعد متجر RYUS الذكي الخارق. تعرف كل شيء في النظام وتستطيع: إنشاء طلبات حقيقية، فحص المخزون، عرض الأرباح الشاملة، التعرف على جميع المدن والمناطق.

**البيانات المالية الحقيقية - الوصول الكامل:**
📊 مبيعات اليوم: ${storeData.analytics?.todayStats?.total?.toLocaleString() || 0} د.ع (${storeData.analytics?.todayStats?.count || 0} طلب)
📈 مبيعات الشهر: ${storeData.analytics?.monthStats?.total?.toLocaleString() || 0} د.ع | أرباح: ${storeData.analytics?.monthStats?.actualProfit?.toLocaleString() || 0} د.ع
💰 إجمالي كل الأوقات: ${storeData.analytics?.allTimeStats?.totalSales?.toLocaleString() || 0} د.ع | أرباح: ${storeData.analytics?.allTimeStats?.actualProfit?.toLocaleString() || 0} د.ع
📊 عدد الطلبات: اليوم ${storeData.analytics?.todayStats?.count || 0} | الشهر ${storeData.analytics?.monthStats?.ordersCount || 0} | الإجمالي ${storeData.analytics?.allTimeStats?.ordersCount || 0}

**مخزون حقيقي ومنتجات متاحة:**
${availableProducts.slice(0,6).map(product => {
  const variants = product.variants?.filter((v: any) => v.stock > 0) || [];
  const availableColors = [...new Set(variants.map((v: any) => v.color))].slice(0,4).join(', ');
  const availableSizes = [...new Set(variants.map((v: any) => v.size))].slice(0,4).join(', ');
  return `✅ ${product.name}: ${product.base_price?.toLocaleString()} د.ع (${product.inventory_count} قطعة متاحة)
   🎨 ألوان: ${availableColors || 'افتراضي'} | 📏 مقاسات: ${availableSizes || 'افتراضي'}`;
}).join('\n')}

${outOfStockProducts.length > 0 ? `⚠️ **نفد المخزون:** ${outOfStockProducts.slice(0,4).map(p => p.name).join(', ')} - اقترح بدائل ذكية` : ''}

**نظام المدن والمناطق الحقيقي (${storeData.cities.length} مدينة، ${storeData.regions.length} منطقة):**
🏙️ **المدن:** ${cityList}${storeData.cities.length > 10 ? ` و${storeData.cities.length - 10} مدن أخرى` : ''}
📍 **مناطق رئيسية:** ${storeData.regions.slice(0,10).map(r => r.name).join(', ')}

**قدرات إنشاء الطلبات الخارقة:**
- 🤖 استخدام نفس منطق بوت التليغرام المتطور
- 🔍 التعرف التلقائي على المدن والمناطق من قاعدة البيانات
- 💰 حساب أجور التوصيل: 5000 د.ع (موحد)
- 📦 فحص مخزون فوري واقتراح بدائل ذكية
- 💾 حفظ تلقائي في ai_orders مع source='ai_assistant'
- 👤 اسم افتراضي: "${userInfo?.default_customer_name || 'ريوس'}"

**تعليمات الذكاء الخارق:**
كن مختصراً وذكياً (1-2 سطر) + اعطِ معلومات دقيقة من النظام الحقيقي فقط. عند ذكر أي مدينة أو منطقة، استخدم فقط الأسماء الموجودة في قاعدة البيانات. اعرض المخزون الحقيقي والأسعار الصحيحة. انشئ طلبات حقيقية تظهر فوراً في نظام الإدارة.`;

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
            topK: 30,
            topP: 0.8,
            maxOutputTokens: 150,
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

    // تحليل الرد لاستخراج طلبات محتملة باستخدام نفس منطق بوت التليغرام المطور
    
    // تحقق من وجود طلب في النص - كلمات أكثر ذكاءً
    const orderKeywords = ['طلب', 'اطلب', 'اريد', 'احتاج', 'للزبون', 'عميل', 'زبون', 'أنشئ', 'إنشاء', 'سجل', 'أضف'];
    const hasOrderIntent = orderKeywords.some(keyword => message.toLowerCase().includes(keyword)) || 
                          message.includes('د.ع') || 
                          storeData.cities.some(city => message.toLowerCase().includes(city.name.toLowerCase()));
    
    let responseType = 'text';
    let orderData = null;

    // تطبيق معالجة الطلبات الذكية إذا كان النص يحتوي على نية طلب
    if (hasOrderIntent) {
      try {
        console.log('🔍 تحليل طلب ذكي للنص:', message);
        
          // استخدام نفس منطق بوت التليغرام تماماً مع معرف خاص للمساعد الذكي
        const aiChatId = -999999999; // معرف خاص للمساعد الذكي
        const { data: orderResult, error: orderError } = await supabase
          .rpc('process_telegram_order', {
            p_message_text: message,
            p_chat_id: aiChatId
          });
        
        if (orderError) {
          console.error('❌ خطأ في معالجة الطلب:', orderError);
        } else if (orderResult?.success) {
          console.log('✅ تم تحليل الطلب بنجاح:', orderResult);
          
          responseType = 'order';
          orderData = orderResult.order_data;
          
          // تحسين البيانات وحفظ الطلب في ai_orders
          const customerName = orderData.customer_name && 
            orderData.customer_name !== orderData.customer_city && 
            orderData.customer_name !== orderData.customer_province 
            ? orderData.customer_name 
            : (userInfo?.default_customer_name || 'ريوس');

          // فحص المخزون الحقيقي للمنتجات وإضافة تفاصيل إضافية
          const enhancedItems = await Promise.all((orderData.items || []).map(async (item: any) => {
            if (item.variant_id) {
              const { data: inventoryData } = await supabase
                .from('inventory')
                .select('quantity, reserved_quantity')
                .eq('variant_id', item.variant_id)
                .single();
              
              const availableStock = (inventoryData?.quantity || 0) - (inventoryData?.reserved_quantity || 0);
              return {
                ...item,
                available_stock: availableStock,
                stock_status: availableStock >= (item.quantity || 1) ? 'available' : 'insufficient'
              };
            }
            return item;
          }));
            
          const aiOrderData = {
            customer_name: customerName,
            customer_phone: orderData.customer_phone,
            customer_city: orderData.customer_city,
            customer_province: orderData.customer_province,
            customer_address: orderData.customer_address || message,
            city_id: orderData.city_id,
            region_id: orderData.region_id,
            items: enhancedItems,
            total_amount: orderData.total_amount || 0,
            order_data: { ...orderData, items: enhancedItems },
            source: 'ai_assistant',
            created_by: userInfo?.id || null,
            original_text: message,
            telegram_chat_id: aiChatId
          };

          const { data: savedOrder, error: saveError } = await supabase
            .from('ai_orders')
            .insert(aiOrderData)
            .select()
            .single();

          if (saveError) {
            console.error('❌ خطأ في حفظ الطلب الذكي:', saveError);
          } else {
            console.log('✅ تم حفظ الطلب الذكي:', savedOrder?.id);
            orderData.orderSaved = true;
            orderData.aiOrderId = savedOrder?.id;
          }
        }
      } catch (error) {
        console.error('Error processing smart order:', error);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      response: aiResponse,
      type: responseType,
      orderData: orderData,
      debugInfo: {
        citiesCount: storeData.cities?.length || 0,
        regionsCount: storeData.regions?.length || 0,
        allTimeProfit: storeData.analytics?.allTimeStats?.actualProfit || 0,
        hasOrderIntent: hasOrderIntent
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