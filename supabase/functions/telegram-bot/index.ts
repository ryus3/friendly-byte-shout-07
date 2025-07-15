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
    let customerAddress = '';
    let items = [];
    let totalPrice = 0;
    let hasCustomPrice = false;
    let deliveryType = 'توصيل'; // افتراضي: توصيل
    let orderNotes = '';
    
    // الحصول على معلومات الموظف والإعدادات الافتراضية
    const employeeData = await supabase.rpc('get_employee_by_telegram_id', { p_telegram_chat_id: chatId });
    const employee = employeeData.data?.[0];
    
    const { data: profileData } = await supabase
      .from('profiles')
      .select('default_customer_name')
      .eq('user_id', employee?.user_id)
      .single();
    
    const defaultCustomerName = profileData?.default_customer_name || 'زبون من التليغرام';
    
    // الحصول على رسوم التوصيل الافتراضية
    const { data: settingsData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'delivery_fee')
      .single();
    
    const defaultDeliveryFee = settingsData?.value?.fee || 5000;

    let phoneFound = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lowerLine = line.toLowerCase();
      
      // التحقق من نوع التسليم
      if (lowerLine.includes('محلي') || lowerLine.includes('تسليم محلي') || lowerLine.includes('استلام محلي')) {
        deliveryType = 'محلي';
        continue;
      }
      
      if (lowerLine.includes('توصيل') || lowerLine.includes('شحن') || lowerLine.includes('ديليفري')) {
        deliveryType = 'توصيل';
        continue;
      }
      
      // التحقق من الأرقام (10-11 رقم)
      const phoneRegex = /^0?\d{10,11}$/;
      if (phoneRegex.test(line.replace(/[\s-]/g, ''))) {
        const cleanPhone = line.replace(/[\s-]/g, '');
        if (!customerPhone) {
          customerPhone = cleanPhone;
          phoneFound = true;
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
      
      // التحقق من العنوان (كلمات تدل على المكان)
      const cityVariants = {
        'بغداد': ['بغداد', 'baghdad', 'بكداد'],
        'البصرة': ['بصرة', 'بصره', 'البصرة', 'البصره', 'basra', 'basrah'],
        'أربيل': ['أربيل', 'اربيل', 'erbil', 'hawler'],
        'الموصل': ['موصل', 'الموصل', 'mosul'],
        'كربلاء': ['كربلاء', 'كربلا', 'karbala'],
        'النجف': ['نجف', 'النجف', 'najaf'],
        'بابل': ['بابل', 'الحلة', 'babel', 'hilla'],
        'ذي قار': ['ذي قار', 'ذيقار', 'الناصرية', 'nasiriyah'],
        'ديالى': ['ديالى', 'ديالا', 'بعقوبة', 'diyala'],
        'الأنبار': ['انبار', 'الانبار', 'الأنبار', 'الرمادي', 'anbar'],
        'صلاح الدين': ['صلاح الدين', 'تكريت', 'tikrit'],
        'واسط': ['واسط', 'الكوت', 'wasit'],
        'المثنى': ['مثنى', 'المثنى', 'السماوة', 'samawah'],
        'القادسية': ['قادسية', 'القادسية', 'الديوانية', 'diwaniyah'],
        'كركوك': ['كركوك', 'kirkuk'],
        'دهوك': ['دهوك', 'duhok'],
        'السليمانية': ['سليمانية', 'السليمانية', 'sulaymaniyah'],
        'ميسان': ['ميسان', 'العمارة', 'maysan']
      };
      
      let foundCity = false;
      for (const [city, variants] of Object.entries(cityVariants)) {
        for (const variant of variants) {
          if (lowerLine.includes(variant)) {
            customerAddress = line;
            deliveryType = 'توصيل'; // إذا ذكر عنوان فهو توصيل
            foundCity = true;
            break;
          }
        }
        if (foundCity) break;
      }
      
      // كلمات أخرى تدل على العنوان
      if (!foundCity && (lowerLine.includes('منطقة') || lowerLine.includes('شارع') || lowerLine.includes('حي') ||
          lowerLine.includes('محافظة') || lowerLine.includes('قضاء') || lowerLine.includes('ناحية') ||
          lowerLine.includes('مجمع') || lowerLine.includes('مدينة') || lowerLine.includes('قرية') ||
          lowerLine.includes('طريق') || lowerLine.includes('جسر') || lowerLine.includes('ساحة'))) {
        customerAddress = line;
        deliveryType = 'توصيل';
        foundCity = true;
      }
      
      if (foundCity) continue;
      
      // إذا لم يكن رقم أو سعر أو عنوان، فقد يكون اسم زبون أو منتج
      if (!phoneFound && i === 0 && !priceMatch && !line.includes('+')) {
        // السطر الأول اسم الزبون إذا لم نجد رقم بعد
        customerName = line;
        continue;
      }
      
      // وإلا فهو منتج أو ملاحظة
      if (line && !line.match(/^\d+/) && !priceMatch) {
        // قد يكون منتج أو ملاحظة
        const isProduct = line.match(/[a-zA-Z\u0600-\u06FF]{2,}/); // يحتوي على حروف
        if (isProduct) {
          items.push(parseProduct(line));
        } else {
          orderNotes += line + ' ';
        }
      }
    }
    
    // تعيين القيم الافتراضية
    if (!customerName) customerName = defaultCustomerName;
    
    // إذا لم يذكر عنوان وكان النوع توصيل، اجعله محلي
    if (!customerAddress && deliveryType === 'توصيل') {
      deliveryType = 'محلي';
    }
    
    // حساب السعر الافتراضي إذا لم يُحدد
    if (!hasCustomPrice && items.length > 0) {
      let calculatedPrice = 0;
      for (const item of items) {
        // البحث في قاعدة البيانات عن المنتج
        const { data: productData } = await supabase
          .from('products')
          .select(`
            base_price,
            product_variants (
              price,
              colors (name),
              sizes (name)
            )
          `)
          .ilike('name', `%${item.name}%`)
          .limit(1)
          .single();
        
        if (productData) {
          let productPrice = productData.base_price || 0;
          
          // البحث عن التنويع المطابق للون والمقاس
          if (productData.product_variants && productData.product_variants.length > 0) {
            const matchingVariant = productData.product_variants.find(variant => {
              const colorMatch = !item.color || variant.colors?.name?.toLowerCase().includes(item.color.toLowerCase());
              const sizeMatch = !item.size || variant.sizes?.name?.toLowerCase() === item.size.toLowerCase();
              return colorMatch && sizeMatch;
            });
            
            if (matchingVariant) {
              productPrice = matchingVariant.price || productPrice;
            } else if (productData.product_variants[0].price) {
              productPrice = productData.product_variants[0].price;
            }
          }
          
          calculatedPrice += productPrice * item.quantity;
        }
      }
      
      // إضافة رسوم التوصيل إذا كان توصيل
      if (deliveryType === 'توصيل') {
        calculatedPrice += defaultDeliveryFee;
      }
      
      totalPrice = calculatedPrice;
    }

    // إنشاء الطلب الذكي
    const { data: orderId, error } = await supabase.rpc('process_telegram_order', {
      p_order_data: {
        original_text: text,
        processed_at: new Date().toISOString(),
        telegram_user_id: chatId,
        employee_code: employeeCode,
        delivery_type: deliveryType,
        parsing_method: 'advanced_v2',
        items_count: items.length
      },
      p_customer_name: customerName,
      p_customer_phone: customerPhone || null,
      p_customer_address: customerAddress || (deliveryType === 'محلي' ? 'استلام محلي' : null),
      p_total_amount: totalPrice,
      p_items: items,
      p_telegram_chat_id: chatId,
      p_employee_code: employeeCode
    });

    if (error) {
      console.error('Error creating AI order:', error);
      return false;
    }

    // إرسال تأكيد مفصل
    const deliveryIcon = deliveryType === 'محلي' ? '🏪' : '🚚';
    const itemsList = items.slice(0, 3).map(item => 
      `• ${item.name}${item.color ? ` (${item.color})` : ''}${item.size ? ` ${item.size}` : ''} × ${item.quantity}`
    ).join('\n');
    
    await sendTelegramMessage(chatId, `
✅ <b>تم استلام الطلب بنجاح!</b>

🆔 <b>رقم الطلب:</b> <code>${orderId.toString().slice(-8)}</code>
👤 <b>الزبون:</b> ${customerName}
📱 <b>الهاتف:</b> ${customerPhone || 'غير محدد'}
${customerSecondaryPhone ? `📞 <b>هاتف ثانوي:</b> ${customerSecondaryPhone}` : ''}
${deliveryIcon} <b>نوع التسليم:</b> ${deliveryType}
${customerAddress ? `📍 <b>العنوان:</b> ${customerAddress}` : ''}
💰 <b>المبلغ الإجمالي:</b> ${totalPrice.toLocaleString()} د.ع

📦 <b>المنتجات (${items.length}):</b>
${itemsList}
${items.length > 3 ? `... و ${items.length - 3} منتجات أخرى` : ''}

⏳ <b>تم إرسال الطلب للمراجعة والموافقة</b>

<i>شكراً لك ${employee?.full_name}! 🙏</i>
    `);

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

🏷 <b>تنسيق الطلب المطلوب (بالترتيب):</b>
1️⃣ اسم الزبون (اختياري - إذا لم تكتبه سيكون افتراضي)
2️⃣ العنوان (مطلوب للتوصيل أو "محلي" للاستلام)
3️⃣ رقم الهاتف (10-11 رقم)
4️⃣ المنتجات (اسم + لون + مقاس)
5️⃣ السعر الإجمالي (اختياري - سيحسب تلقائياً)

<b>📦 مثال طلب توصيل:</b>
ريوس
بغداد الدورة شارع الصحة
07728020024
سوت شيك اصفر M + بنطلون أسود L
50 الف

<b>🏪 مثال طلب محلي:</b>
أحمد
محلي
07712345678
قميص أزرق XL
25 الف

<b>🌍 مدن مدعومة:</b>
بغداد، بصرة، أربيل، الموصل، كربلاء، النجف، بابل، ذي قار، ديالى، الأنبار، وجميع محافظات العراق

<b>💡 نصائح مهمة:</b>
• العنوان مطلوب ويأتي بعد اسم الزبون مباشرة
• للتوصيل: اذكر المدينة + المنطقة + تفاصيل العنوان
• للاستلام المحلي: اكتب فقط "محلي"
• للمنتجات المتعددة استخدم + بينها
• البوت يفهم صيغ مختلفة لأسماء المدن (بصرة، البصرة، بصره)

<b>🚀 أوامر أخرى:</b>
• "إحصائيات" لمعرفة طلباتك اليومية
• "حالة" لمعرفة آخر طلباتك
      `);
      return new Response('OK', { status: 200 });
    }

    // إحصائيات الموظف
    if (text.toLowerCase().includes('إحصائيات') || text.toLowerCase().includes('احصائيات')) {
      const today = new Date().toISOString().split('T')[0];
      const { data: todayOrders } = await supabase
        .from('ai_orders')
        .select('*')
        .eq('created_by', employee.employee_code)
        .gte('created_at', today + 'T00:00:00')
        .lte('created_at', today + 'T23:59:59');

      const { data: monthOrders } = await supabase
        .from('ai_orders')
        .select('*')
        .eq('created_by', employee.employee_code)
        .gte('created_at', new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-01');

      const approvedToday = todayOrders?.filter(o => o.status === 'approved').length || 0;
      const pendingToday = todayOrders?.filter(o => o.status === 'pending').length || 0;
      const totalValueToday = todayOrders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;

      await sendTelegramMessage(chatId, `
📊 <b>إحصائياتك - ${employee.full_name}</b>

📅 <b>اليوم:</b>
• الطلبات: ${todayOrders?.length || 0}
• معتمدة: ${approvedToday}
• في الانتظار: ${pendingToday}
• القيمة الإجمالية: ${totalValueToday.toLocaleString()} د.ع

📅 <b>هذا الشهر:</b>
• إجمالي الطلبات: ${monthOrders?.length || 0}

🎯 <b>أداءك ممتاز! استمر بالعمل الرائع</b> 💪
      `);
      return new Response('OK', { status: 200 });
    }

    // حالة آخر الطلبات
    if (text.toLowerCase().includes('حالة') || text.toLowerCase().includes('طلبات')) {
      const { data: recentOrders } = await supabase
        .from('ai_orders')
        .select('*')
        .eq('created_by', employee.employee_code)
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentOrders && recentOrders.length > 0) {
        const ordersList = recentOrders.map(order => 
          `• ${order.customer_name} - ${order.status === 'pending' ? '⏳ انتظار' : order.status === 'approved' ? '✅ معتمد' : '❌ مرفوض'} - ${order.total_amount?.toLocaleString() || 0} د.ع`
        ).join('\n');

        await sendTelegramMessage(chatId, `
📋 <b>آخر طلباتك - ${employee.full_name}</b>

${ordersList}

💡 <b>نصيحة:</b> يمكنك متابعة جميع طلباتك من التطبيق في قسم "الطلبات الذكية"
        `);
      } else {
        await sendTelegramMessage(chatId, `
📋 <b>لا توجد طلبات بعد</b>

ابدأ بإرسال أول طلب لك! 🚀
        `);
      }
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
نوع التسليم (محلي/توصيل + العنوان)
اسم المنتج + لون + مقاس
السعر (اختياري)

<b>📝 مثال سريع:</b>
أحمد
07728020024
محلي
قميص أزرق M
25 الف

<b>أو:</b>
سارة
07712345678
بغداد - الكرادة  
فستان أحمر L + حقيبة سوداء
60 الف
      `);
    }

    return new Response('OK', { status: 200 });

  } catch (error) {
    console.error('Error processing Telegram update:', error);
    return new Response('Error', { status: 500 });
  }
});