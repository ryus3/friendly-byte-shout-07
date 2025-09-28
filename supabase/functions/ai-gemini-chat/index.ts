import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userInfo, orderContext } = await req.json();

    // بناء السياق العربي المتخصص للمتجر
    const systemPrompt = `أنت مساعد ذكي متخصص في إدارة متاجر الملابس والأحذية في العراق. اسمك "المساعد الذكي RYUS".

معلومات المستخدم:
- الاسم: ${userInfo?.full_name || userInfo?.fullName || 'المستخدم'}
- الوضع: ${userInfo?.isAdmin ? 'مدير' : 'موظف'}

تخصصك الرئيسي:
1. إنشاء وإدارة الطلبات للعملاء
2. فهم طلبات العملاء بالعربية العامية والفصحى
3. استخراج معلومات العملاء (الاسم، الهاتف، العنوان، المدينة)
4. التعرف على المنتجات والألوان والأحجام
5. حساب الأسعار وأجور التوصيل

إرشادات المحادثة:
- تحدث بالعربية العراقية الودودة
- كن مفيداً ومحترفاً
- اطلب توضيحات إذا لم تفهم الطلب
- اعرض الخيارات المتاحة بوضوح
- أكد تفاصيل الطلب قبل الإنشاء

عند استلام طلب عميل، استخرج:
- اسم العميل
- رقم الهاتف
- العنوان الكامل والمدينة
- تفاصيل المنتجات المطلوبة

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

    // تحليل الرد لاستخراج طلبات محتملة
    const orderPattern = /.*(?:للزبون|اسم|عميل)\s*([^\s,،]+).*(?:هاتف|رقم)\s*([0-9]+).*(?:عنوان|منطقة|مدينة)\s*([^.]+)/i;
    const match = aiResponse.match(orderPattern);

    let responseType = 'text';
    let orderData = null;

    if (match) {
      responseType = 'order';
      orderData = {
        customerInfo: {
          name: match[1],
          phone: match[2],
          address: match[3],
          city: "بغداد" // افتراضي
        },
        items: [
          {
            productId: 'prod_1',
            productName: "منتج عام",
            sku: 'SKU-GEN-001',
            color: 'متنوع',
            size: 'متنوع',
            quantity: 1,
            price: 25000,
            costPrice: 15000,
            total: 25000
          }
        ]
      };
    }

    return new Response(JSON.stringify({
      success: true,
      response: aiResponse,
      type: responseType,
      orderData: orderData,
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