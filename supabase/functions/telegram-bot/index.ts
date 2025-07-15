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
    // نحاول استخراج معلومات الطلب من النص
    const lines = text.split('\n').filter(line => line.trim());
    
    let customerName = '';
    let customerPhone = '';
    let customerAddress = '';
    let items = [];
    let total = 0;
    
    let currentSection = '';
    
    for (const line of lines) {
      const lowerLine = line.toLowerCase().trim();
      
      if (lowerLine.includes('اسم') || lowerLine.includes('زبون') || lowerLine.includes('عميل')) {
        customerName = line.replace(/اسم|الزبون|العميل|:|=/g, '').trim();
      } else if (lowerLine.includes('هاتف') || lowerLine.includes('رقم') || lowerLine.includes('موبايل')) {
        customerPhone = line.replace(/هاتف|رقم|الموبايل|:|=/g, '').trim();
      } else if (lowerLine.includes('عنوان') || lowerLine.includes('منطقة') || lowerLine.includes('محافظة')) {
        customerAddress = line.replace(/عنوان|منطقة|المحافظة|:|=/g, '').trim();
      } else if (lowerLine.includes('طلب') || lowerLine.includes('منتج') || lowerLine.includes('سلعة')) {
        currentSection = 'items';
      } else if (currentSection === 'items' && line.trim()) {
        // محاولة استخراج اسم المنتج والكمية
        const match = line.match(/(.+?)[\s]*[×x*]?[\s]*(\d+)/);
        if (match) {
          const productName = match[1].trim();
          const quantity = parseInt(match[2]);
          items.push({
            name: productName,
            quantity: quantity,
            price: 0 // سيتم تحديده لاحقاً
          });
        } else {
          items.push({
            name: line.trim(),
            quantity: 1,
            price: 0
          });
        }
      } else if (lowerLine.includes('مجموع') || lowerLine.includes('إجمالي') || lowerLine.includes('total')) {
        const priceMatch = line.match(/[\d,]+/);
        if (priceMatch) {
          total = parseInt(priceMatch[0].replace(/,/g, ''));
        }
      }
    }

    // إذا لم نجد اسم الزبون، نستخدم قيمة افتراضية
    if (!customerName) {
      customerName = 'زبون جديد من التليغرام';
    }

    // إنشاء الطلب الذكي
    const { data: orderId, error } = await supabase.rpc('process_telegram_order', {
      p_order_data: {
        original_text: text,
        processed_at: new Date().toISOString(),
        telegram_user_id: chatId
      },
      p_customer_name: customerName,
      p_customer_phone: customerPhone || null,
      p_customer_address: customerAddress || null,
      p_total_amount: total,
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
اسم الزبون: سارة أحمد
الهاتف: 07701234567
العنوان: بصرة - العشار
الطلب: فستان أحمر × 1
الطلب: حقيبة سوداء × 2
المجموع: 45000

<b>💡 نصائح:</b>
• يمكنك إرسال الطلب بأي تنسيق مفهوم
• البوت سيستخرج المعلومات تلقائياً
• ستظهر الطلبات في نافذة "الطلبات الذكية" للمراجعة
      `);
      return new Response('OK', { status: 200 });
    }

    // معالجة الطلب
    const orderId = await processOrderText(text, chatId, employee.employee_code);
    
    if (orderId) {
      await sendTelegramMessage(chatId, `
✅ <b>تم استلام الطلب بنجاح!</b>

🆔 رقم الطلب: <code>${orderId}</code>
👤 تم إرسال الطلب للمراجعة

سيتم إشعارك عند الموافقة على الطلب أو إذا كانت هناك أي ملاحظات.

<i>شكراً لك ${employee.full_name}! 🙏</i>
      `);
    } else {
      await sendTelegramMessage(chatId, `
❌ <b>خطأ في معالجة الطلب</b>

يرجى التحقق من تنسيق الطلب والمحاولة مرة أخرى.

<b>التنسيق المطلوب:</b>
اسم الزبون: [الاسم]
الهاتف: [الرقم]
العنوان: [العنوان]
الطلب: [اسم المنتج] × [الكمية]
      `);
    }

    return new Response('OK', { status: 200 });

  } catch (error) {
    console.error('Error processing Telegram update:', error);
    return new Response('Error', { status: 500 });
  }
});