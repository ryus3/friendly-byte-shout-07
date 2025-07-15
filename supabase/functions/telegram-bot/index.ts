import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.30.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    text?: string;
    date: number;
  };
}

async function sendTelegramMessage(chatId: number, text: string, parseMode = 'HTML') {
  if (!telegramBotToken) {
    console.error('TELEGRAM_BOT_TOKEN not set');
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Telegram API error:', errorData);
    }
  } catch (error) {
    console.error('Error sending message to Telegram:', error);
  }
}

async function linkEmployeeCode(employeeCode: string, chatId: number) {
  try {
    const { data, error } = await supabase.rpc('link_telegram_user', {
      p_employee_code: employeeCode,
      p_telegram_chat_id: chatId
    });

    return !error && data;
  } catch (error) {
    console.error('Error linking employee code:', error);
    return false;
  }
}

async function getEmployeeByTelegramId(chatId: number) {
  try {
    const { data, error } = await supabase.rpc('get_employee_by_telegram_id', {
      p_telegram_chat_id: chatId
    });

    if (error) {
      console.error('Error getting employee:', error);
      return null;
    }

    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error('Error getting employee:', error);
    return null;
  }
}

async function processOrderText(text: string, chatId: number, employeeCode: string) {
  try {
    const lines = text.split('\n').filter(line => line.trim());
    
    let customerName = '';
    let customerPhone = '';
    let customerSecondaryPhone = '';
    let items = [];
    let totalPrice = 0;
    let hasCustomPrice = false;
    
    // الحصول على الاسم الافتراضي للموظف
    const { data: employeeData } = await supabase
      .from('profiles')
      .select('default_customer_name')
      .eq('user_id', (await supabase.rpc('get_employee_by_telegram_id', { p_telegram_chat_id: chatId })).data?.[0]?.user_id)
      .single();
    
    const defaultCustomerName = employeeData?.default_customer_name || 'زبون من التليغرام';
    
    // الحصول على رسوم التوصيل الافتراضية
    const { data: settingsData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'delivery_fee')
      .single();
    
    const defaultDeliveryFee = settingsData?.value?.fee || 5000;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // التحقق من الأرقام (10-11 رقم)
      const phoneRegex = /^0?\d{10,11}$/;
      if (phoneRegex.test(line.replace(/[\s-]/g, ''))) {
        const cleanPhone = line.replace(/[\s-]/g, '');
        if (!customerPhone) {
          customerPhone = cleanPhone;
        } else if (!customerSecondaryPhone) {
          customerSecondaryPhone = cleanPhone;
        }
        continue;
      }
      
      // التحقق من السعر
      const priceRegex = /([\d٠-٩]+)\s*([اﻻ]?لف|الف|ألف|k|K|000)?/;
      const priceMatch = line.match(priceRegex);
      if (priceMatch && (line.includes('الف') || line.includes('ألف') || line.includes('k') || line.includes('K') || /^\d+$/.test(line))) {
        let price = parseInt(priceMatch[1].replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()));
        if (priceMatch[2]) {
          if (priceMatch[2].includes('ف') || priceMatch[2].includes('k') || priceMatch[2].includes('K')) {
            price *= 1000;
          }
        }
        totalPrice = price;
        hasCustomPrice = true;
        continue;
      }
      
      // التحقق من المنتجات (يدعم + للفصل)
      if (line.includes('+')) {
        const products = line.split('+').map(p => p.trim());
        for (const product of products) {
          if (product) {
            items.push(parseProduct(product));
          }
        }
        continue;
      }
      
      // إذا لم يكن رقم أو سعر، فقد يكون اسم زبون أو منتج
      if (i === 0 && !phoneRegex.test(line) && !priceMatch) {
        // السطر الأول عادة اسم الزبون إذا لم يكن رقم
        if (!line.match(/[a-zA-Z]{2,}/)) { // ليس اسم منتج إنجليزي
          customerName = line;
          continue;
        }
      }
      
      // وإلا فهو منتج
      if (line && !customerName && i === 0) {
        customerName = defaultCustomerName;
      }
      items.push(parseProduct(line));
    }
    
    // تعيين القيم الافتراضية
    if (!customerName) customerName = defaultCustomerName;
    
    // حساب السعر الافتراضي إذا لم يُحدد
    if (!hasCustomPrice && items.length > 0) {
      let calculatedPrice = 0;
      for (const item of items) {
        const { data: productData } = await supabase
          .from('products')
          .select('base_price, product_variants(price)')
          .ilike('name', `%${item.name}%`)
          .limit(1)
          .single();
        
        if (productData) {
          const price = productData.product_variants?.[0]?.price || productData.base_price || 0;
          calculatedPrice += price * item.quantity;
        }
      }
      totalPrice = calculatedPrice + defaultDeliveryFee;
    }

    // إنشاء الطلب الذكي
    const { data: orderId, error } = await supabase.rpc('process_telegram_order', {
      p_order_data: {
        original_text: text,
        processed_at: new Date().toISOString(),
        telegram_user_id: chatId,
        employee_code: employeeCode,
        parsing_method: 'advanced'
      },
      p_customer_name: customerName,
      p_customer_phone: customerPhone || null,
      p_customer_address: customerSecondaryPhone ? `رقم ثانوي: ${customerSecondaryPhone}` : null,
      p_total_amount: totalPrice,
      p_items: items,
      p_telegram_chat_id: chatId,
      p_employee_code: employeeCode
    });

    if (error) {
      console.error('Error creating AI order:', error);
      return false;
    }

    return orderId;
  } catch (error) {
    console.error('Error processing order:', error);
    return false;
  }
}

function parseProduct(productText: string) {
  const text = productText.trim();
  
  // استخراج الكمية
  let quantity = 1;
  const quantityMatch = text.match(/[×x*]\s*(\d+)|(\d+)\s*[×x*]/);
  if (quantityMatch) {
    quantity = parseInt(quantityMatch[1] || quantityMatch[2]);
  }
  
  // استخراج المقاس
  let size = '';
  const sizeRegex = /\b(S|M|L|XL|XXL|s|m|l|xl|xxl|\d{2,3})\b/g;
  const sizeMatch = text.match(sizeRegex);
  if (sizeMatch) {
    size = sizeMatch[sizeMatch.length - 1].toUpperCase(); // آخر مقاس مذكور
  }
  
  // استخراج اللون
  const colors = ['أزرق', 'ازرق', 'blue', 'أصفر', 'اصفر', 'yellow', 'أحمر', 'احمر', 'red', 'أخضر', 'اخضر', 'green', 'أبيض', 'ابيض', 'white', 'أسود', 'اسود', 'black', 'بني', 'brown', 'رمادي', 'gray', 'grey', 'بنفسجي', 'purple', 'وردي', 'pink'];
  let color = '';
  
  for (const c of colors) {
    if (text.toLowerCase().includes(c.toLowerCase())) {
      color = c;
      break;
    }
  }
  
  // استخراج اسم المنتج (إزالة الكمية والمقاس واللون)
  let productName = text
    .replace(/[×x*]\s*\d+|\d+\s*[×x*]/g, '')
    .replace(/\b(S|M|L|XL|XXL|s|m|l|xl|xxl|\d{2,3})\b/gi, '')
    .replace(/\b(أزرق|ازرق|blue|أصفر|اصفر|yellow|أحمر|احمر|red|أخضر|اخضر|green|أبيض|ابيض|white|أسود|اسود|black|بني|brown|رمادي|gray|grey|بنفسجي|purple|وردي|pink)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  return {
    name: productName || text,
    quantity: quantity,
    size: size,
    color: color,
    price: 0 // سيتم حسابه لاحقاً
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const update: TelegramUpdate = await req.json();
    console.log('Received update:', JSON.stringify(update, null, 2));

    if (!update.message || !update.message.text) {
      return new Response('OK', { status: 200 });
    }

    const chatId = update.message.chat.id;
    const text = update.message.text.trim();
    const userId = update.message.from.id;

    // التحقق من حالة المستخدم
    const employee = await getEmployeeByTelegramId(chatId);

    if (!employee) {
      // المستخدم غير مرتبط - نتحقق إذا كان يرسل رمز موظف
      if (text.startsWith('/start')) {
        await sendTelegramMessage(chatId, `
🤖 <b>أهلاً بك في بوت الطلبات!</b>

لربط حسابك، يرجى إرسال رمز الموظف الخاص بك.
يمكنك الحصول على الرمز من صفحة الإعدادات في التطبيق.

<i>مثال: AHM1234</i>
        `);
        return new Response('OK', { status: 200 });
      }

      // محاولة ربط رمز الموظف
      const linked = await linkEmployeeCode(text, chatId);
      if (linked) {
        const newEmployee = await getEmployeeByTelegramId(chatId);
        await sendTelegramMessage(chatId, `
✅ <b>تم ربط الحساب بنجاح!</b>

مرحباً <b>${newEmployee?.full_name}</b>
يمكنك الآن إرسال الطلبات وستتم معالجتها تلقائياً.

<b>طريقة إرسال الطلب:</b>
- اسم الزبون: أحمد محمد
- الهاتف: 07801234567
- العنوان: بغداد - الكرادة
- الطلب: تيشيرت أزرق × 2
- الطلب: بنطلون أسود × 1
        `);
      } else {
        await sendTelegramMessage(chatId, `
❌ <b>رمز الموظف غير صحيح</b>

يرجى التحقق من الرمز والمحاولة مرة أخرى.
يمكنك الحصول على الرمز الصحيح من صفحة الإعدادات في التطبيق.
        `);
      }
      return new Response('OK', { status: 200 });
    }

    // المستخدم مرتبط - معالجة الطلبات
    if (text.startsWith('/start') || text.toLowerCase().includes('مساعدة') || text.toLowerCase().includes('help')) {
      await sendTelegramMessage(chatId, `
👋 <b>مرحباً ${employee.full_name}!</b>

يمكنك إرسال الطلبات بالتنسيق التالي:

<b>📝 مثال على طلب:</b>
ريوس
07728020024
07710666830
سوت شيك اصفر M + بنطلون أسود L
50 الف

<b>💡 نصائح:</b>
• إذا لم تكتب اسم الزبون سيستخدم الافتراضي
• إذا لم تكتب السعر سيحسب تلقائياً
• للمنتجات المتعددة استخدم + بينها
• المقاسات: S, M, L, XL أو أرقام
• الألوان: أزرق، أصفر، أحمر، إلخ

<b>🚀 صيغ مدعومة:</b>
• أحمد - 0771234567 - قميص أزرق M - 25 الف
• 0771234567 + تيشيرت أحمر L + بنطلون أسود M
• سارة \n 07712345678 \n فستان وردي S \n 40000
      `);
      return new Response('OK', { status: 200 });
    }

    // معالجة الطلب
    const orderId = await processOrderText(text, chatId, employee.employee_code);
    
    if (orderId) {
      await sendTelegramMessage(chatId, `
✅ <b>تم استلام الطلب بنجاح!</b>

🆔 رقم الطلب: <code>${orderId.toString().slice(-8)}</code>
⏳ <b>تم إرسال الطلب للمراجعة</b>

سيتم إشعارك عند الموافقة على الطلب أو إذا كانت هناك أي ملاحظات.

<i>شكراً لك ${employee.full_name}! 🙏</i>
      `);
    } else {
      await sendTelegramMessage(chatId, `
❌ <b>خطأ في معالجة الطلب</b>

يرجى التحقق من التنسيق والمحاولة مرة أخرى.

<b>✅ التنسيق الصحيح:</b>
اسم الزبون (اختياري)
رقم الهاتف (10-11 رقم)
اسم المنتج + لون + مقاس
السعر (اختياري)

<b>📝 مثال:</b>
ريوس
07728020024
سوت شيك اصفر M + بنطلون أسود L
50 الف
      `);
    }

    return new Response('OK', { status: 200 });

  } catch (error) {
    console.error('Error processing Telegram update:', error);
    return new Response('Error', { status: 500 });
  }
});