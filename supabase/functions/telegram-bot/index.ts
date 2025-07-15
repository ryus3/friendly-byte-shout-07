import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.30.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

// Get bot token from database settings
async function getBotToken(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'telegram_bot_config')
      .single();
    
    if (error || !data) {
      console.log('No bot config found in settings');
      return null;
    }
    
    return data.value?.bot_token || null;
  } catch (error) {
    console.error('Error getting bot token:', error);
    return null;
  }
}

async function sendTelegramMessage(chatId: number, text: string, parseMode = 'HTML') {
  const botToken = await getBotToken();
  if (!botToken) {
    console.error('Bot token not found in database');
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
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
    
    const defaultDeliveryFee = Number(settingsData?.value) || 5000;

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
            items.push(await parseProduct(product));
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
          items.push(await parseProduct(line));
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
      
      // جلب رسوم التوصيل الافتراضية من الإعدادات
      const { data: deliverySettings } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'delivery_fee')
        .single();
      
      const currentDeliveryFee = Number(deliverySettings?.value) || 5000;
      
      for (const item of items) {
        // البحث في قاعدة البيانات عن المنتج باستخدام الاسم أو الباركود
        const { data: productData } = await supabase
          .from('products')
          .select(`
            id,
            name,
            base_price,
            barcode,
            product_variants!inner (
              id,
              price,
              barcode,
              colors (name),
              sizes (name)
            )
          `)
          .or(`name.ilike.%${item.name.split(' ').join('%')}%,barcode.eq.${item.name}`)
          .eq('is_active', true)
          .limit(10);

        // إذا لم نجد بالبحث الأساسي، جرب بحث أوسع
        if (!productData.data || productData.data.length === 0) {
          const keywords = item.name.split(' ').filter(word => word.length > 2);
          if (keywords.length > 0) {
            const searchQuery = keywords.map(keyword => `name.ilike.%${keyword}%`).join(',');
            const { data: fallbackData } = await supabase
              .from('products')
              .select(`
                id,
                name,
                base_price,
                barcode,
                product_variants!inner (
                  id,
                  price,
                  barcode,
                  colors (name),
                  sizes (name)
                )
              `)
              .or(searchQuery)
              .eq('is_active', true)
              .limit(5);
            
            if (fallbackData && fallbackData.length > 0) {
              productData.data = fallbackData;
            }
          }
        }

        // اختيار أفضل مطابقة
        let bestMatch = null;
        if (productData.data && productData.data.length > 0) {
          bestMatch = productData.data[0]; // البحث الأول عادة أدق
          
          // أو ابحث عن أقرب مطابقة بالاسم
          for (const product of productData.data) {
            const similarity = calculateSimilarity(item.name.toLowerCase(), product.name.toLowerCase());
            if (similarity > 0.6) { // تشابه أكثر من 60%
              bestMatch = product;
              break;
            }
          }
        }
        
        if (bestMatch) {
          let productPrice = bestMatch.base_price || 0;
          let selectedVariant = null;
          
          // البحث عن التنويع المطابق للون والمقاس
          if (bestMatch.product_variants && bestMatch.product_variants.length > 0) {
            
            // البحث بالباركود أولاً (أدق طريقة)
            if (item.barcode) {
              selectedVariant = bestMatch.product_variants.find(variant => 
                variant.barcode === item.barcode
              );
            }
            
            // إذا لم نجد بالباركود، ابحث باللون والمقاس
            if (!selectedVariant && (item.color || item.size)) {
              selectedVariant = bestMatch.product_variants.find(variant => {
                const colorMatch = !item.color || variant.colors?.name?.toLowerCase().includes(item.color.toLowerCase());
                const sizeMatch = !item.size || variant.sizes?.name?.toLowerCase() === item.size.toLowerCase();
                return colorMatch && sizeMatch;
              });
            }
            
            // إذا لم نجد مطابقة دقيقة، خذ أول تنويع متاح
            if (!selectedVariant) {
              selectedVariant = bestMatch.product_variants[0];
            }
            
            if (selectedVariant) {
              productPrice = selectedVariant.price || productPrice;
              // حفظ معرف التنويع للاستخدام لاحقاً
              item.variant_id = selectedVariant.id;
              item.product_id = bestMatch.id;
            }
          }
          
          // تحديث سعر المنتج في القائمة
          item.price = productPrice;
          item.product_name = bestMatch.name; // حفظ الاسم الصحيح
          calculatedPrice += productPrice * item.quantity;
          
          console.log(`Product found: ${productData.name}, Price: ${productPrice}, Variant ID: ${item.variant_id}`);
        } else {
          console.log(`Product not found for: ${item.name}`);
          // إذا لم نجد المنتج، اتركه بسعر 0 أو سعر افتراضي
          item.price = 0;
        }
      }
      
      // إضافة رسوم التوصيل إذا كان توصيل
      if (deliveryType === 'توصيل') {
        calculatedPrice += currentDeliveryFee;
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

    console.log('Order creation result:', { orderId, error });

    if (error) {
      console.error('Error creating AI order:', error);
      return false;
    }

    // إرسال تأكيد مفصل ومحسن
    const deliveryIcon = deliveryType === 'محلي' ? '🏪' : '🚚';
    
    // رسالة مختصرة ومفيدة
    const itemsList = items.slice(0, 3).map(item => {
      const itemTotal = (item.price || 0) * (item.quantity || 1);
      const priceDisplay = item.price > 0 ? `${itemTotal.toLocaleString()} د.ع` : '❌';
      const productStatus = item.product_name ? '✅' : '⚠️';
      return `${productStatus} ${item.product_name || item.name}${item.color ? ` (${item.color})` : ''}${item.size ? ` ${item.size}` : ''} × ${item.quantity} = ${priceDisplay}`;
    }).join('\n');
    
    // حساب إحصائيات سريعة
    const itemsTotal = items.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0);
    const deliveryFeeForDisplay = deliveryType === 'توصيل' ? defaultDeliveryFee : 0;
    const foundItemsCount = items.filter(item => item.product_name).length;
    const totalItemsCount = items.length;
    
    await sendTelegramMessage(chatId, `
✅ <b>تم استلام الطلب!</b>

🆔 <b>رقم:</b> <code>${orderId.toString().slice(-8)}</code>
👤 <b>الزبون:</b> ${customerName}
📱 <b>الهاتف:</b> ${customerPhone || 'غير محدد'}
${deliveryIcon} <b>التسليم:</b> ${deliveryType}

📦 <b>المنتجات (${totalItemsCount}):</b>
${itemsList}
${items.length > 3 ? `... و ${items.length - 3} منتجات أخرى` : ''}

📊 <b>حالة المنتجات:</b>
• تم العثور على: ${foundItemsCount}/${totalItemsCount} منتجات ${foundItemsCount === totalItemsCount ? '✅' : '⚠️'}
${foundItemsCount < totalItemsCount ? `• غير موجود: ${totalItemsCount - foundItemsCount} منتجات ⚠️` : ''}

💰 <b>تفاصيل السعر:</b>
• المنتجات الموجودة: ${itemsTotal.toLocaleString()} د.ع
${deliveryType === 'توصيل' ? `• التوصيل: ${deliveryFeeForDisplay.toLocaleString()} د.ع` : ''}
• <b>المجموع المؤقت: ${totalPrice.toLocaleString()} د.ع</b>

⏳ <b>تم إرسال الطلب للمراجعة والموافقة</b>

${employee?.full_name ? `<i>شكراً لك ${employee.full_name}! 🙏</i>` : ''}
    `);

    console.log('Order creation result:', { orderId, error: null });
    return orderId;
  } catch (error) {
    console.error('Error processing order:', error);
    return false;
  }
}

// دالة حساب التشابه بين نصين
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

async function parseProduct(productText: string) {
  const text = productText.trim();
  
  // استخراج الكمية
  let quantity = 1;
  const quantityMatch = text.match(/[×x*]\s*(\d+)|(\d+)\s*[×x*]/);
  if (quantityMatch) {
    quantity = parseInt(quantityMatch[1] || quantityMatch[2]);
  }
  
  // استخراج الباركود (أرقام طويلة)
  let barcode = '';
  const barcodeMatch = text.match(/\b\d{8,}\b/); // باركود عادة 8 أرقام أو أكثر
  if (barcodeMatch) {
    barcode = barcodeMatch[0];
  }
  
  // جلب المقاسات المتاحة من قاعدة البيانات
  const { data: sizesData } = await supabase.from('sizes').select('name') || {};
  const dbSizes = Array.isArray(sizesData) ? sizesData.map(s => s.name.toUpperCase()) : [];
  
  // استخراج المقاس مع دعم المقاسات من قاعدة البيانات
  let size = '';
  const basicSizeRegex = /\b(S|M|L|XL|XXL|XXXL|s|m|l|xl|xxl|xxxl|\d{2,3})\b/g;
  const sizeMatch = text.match(basicSizeRegex);
  
  if (sizeMatch) {
    size = sizeMatch[sizeMatch.length - 1].toUpperCase(); // آخر مقاس مذكور
  } else {
    // البحث في المقاسات من قاعدة البيانات
    for (const dbSize of dbSizes) {
      if (text.toLowerCase().includes(dbSize.toLowerCase())) {
        size = dbSize;
        break;
      }
    }
  }
  
  // جلب الألوان من قاعدة البيانات
  const { data: colorsData } = await supabase.from('colors').select('name') || {};
  const dbColors = Array.isArray(colorsData) ? colorsData.map(c => c.name) : [];
  
  // استخراج اللون - قائمة ديناميكية من قاعدة البيانات + ألوان أساسية
  const basicColors = [
    'أزرق', 'ازرق', 'blue', 'أصفر', 'اصفر', 'yellow', 'أحمر', 'احمر', 'red', 
    'أخضر', 'اخضر', 'green', 'أبيض', 'ابيض', 'white', 'أسود', 'اسود', 'black', 
    'بني', 'brown', 'رمادي', 'gray', 'grey', 'بنفسجي', 'purple', 'وردي', 'pink',
    'برتقالي', 'orange', 'فيروزي', 'turquoise', 'كحلي', 'navy', 'ذهبي', 'gold',
    'فضي', 'silver', 'بيج', 'beige', 'كريمي', 'cream', 'جوزي', 'موف', 'زيتي'
  ];
  
  const colors = [...new Set([...dbColors, ...basicColors])]; // دمج الألوان مع إزالة المكرر
  let color = '';
  let colorIndex = -1;
  
  // البحث عن اللون في النص وتحديد موقعه
  for (const c of colors) {
    const index = text.toLowerCase().indexOf(c.toLowerCase());
    if (index !== -1) {
      color = c;
      colorIndex = index;
      break;
    }
  }
  
  // استخراج اسم المنتج بذكاء
  let productName = text;
  
  // إزالة الكمية أولاً
  productName = productName.replace(/[×x*]\s*\d+|\d+\s*[×x*]/g, '').trim();
  
  // إزالة الباركود
  productName = productName.replace(/\b\d{8,}\b/g, '').trim();
  
  // إزالة المقاس
  productName = productName.replace(/\b(S|M|L|XL|XXL|XXXL|s|m|l|xl|xxl|xxxl|\d{2,3})\b/gi, '').trim();
  
  // إزالة اللون إذا وُجد
  if (color && colorIndex !== -1) {
    // استخدام موقع اللون لتحديد ما قبله (اسم المنتج)
    const beforeColor = text.substring(0, colorIndex).trim();
    const afterColor = text.substring(colorIndex + color.length).trim();
    
    // اسم المنتج عادة يكون قبل اللون
    if (beforeColor) {
      productName = beforeColor
        .replace(/[×x*]\s*\d+|\d+\s*[×x*]/g, '') // إزالة الكمية
        .replace(/\b\d{8,}\b/g, '') // إزالة الباركود
        .replace(/\b(S|M|L|XL|XXL|XXXL|s|m|l|xl|xxl|xxxl|\d{2,3})\b/gi, '') // إزالة المقاس
        .replace(/\s+/g, ' ')
        .trim();
    }
  }
  
  // تنظيف نهائي لاسم المنتج
  productName = productName.replace(/\s+/g, ' ').trim();
  
  return {
    name: productName || text,
    quantity: quantity,
    size: size,
    color: color,
    barcode: barcode,
    price: 0, // سيتم حسابه لاحقاً
    product_id: null,
    variant_id: null,
    product_name: '' // سيتم ملؤه من قاعدة البيانات
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔴 Telegram webhook called!');
    console.log('Request method:', req.method);
    console.log('Request URL:', req.url);
    
    const update: TelegramUpdate = await req.json();
    console.log('Received update:', JSON.stringify(update, null, 2));

    if (!update.message || !update.message.text) {
      console.log('No message or text found in update');
      return new Response('OK', { status: 200 });
    }

    const chatId = update.message.chat.id;
    const text = update.message.text.trim();
    const userId = update.message.from.id;
    
    console.log(`Processing message from chatId: ${chatId}, text: "${text}"`);

    // التحقق من حالة المستخدم
    const employee = await getEmployeeByTelegramId(chatId);
    console.log('Employee found:', employee);

    if (!employee) {
      // المستخدم غير مرتبط - التوجيه الذكي
      if (text.startsWith('/start')) {
        await sendTelegramMessage(chatId, `
🤖 <b>أهلاً وسهلاً بك في بوت RYUS للطلبات الذكية!</b>

🎯 <b>هذا البوت يساعدك في:</b>
• إرسال الطلبات مباشرة للنظام
• تلقي إشعارات فورية
• متابعة إحصائياتك اليومية
• التواصل السريع مع الإدارة

🔗 <b>لربط حسابك بالبوت:</b>
1️⃣ احصل على رمزك الخاص من موقع RYUS
2️⃣ أرسل الرمز هنا مباشرة
3️⃣ ستحصل على تأكيد فوري

📱 <b>كيفية الحصول على الرمز:</b>
• اذهب لموقع RYUS الخاص بك
• انقر على الإعدادات ⚙️
• اختر "بوت التليغرام" 
• انسخ رمزك (مثل: ABC1234)

💡 <b>الرمز يتكون من 7 أحرف/أرقام ويربطك بحسابك في النظام</b>

<i>أرسل رمزك الآن للبدء في استقبال الطلبات! 🚀</i>
        `);
        return new Response('OK', { status: 200 });
      }

      // محاولة ربط رمز الموظف
      if (text.length === 7 && /^[A-Z0-9]+$/i.test(text)) {
        const linked = await linkEmployeeCode(text.toUpperCase(), chatId);
        if (linked) {
          const newEmployee = await getEmployeeByTelegramId(chatId);
          const roleTitle = newEmployee?.role === 'admin' ? '👑 مدير' : 
                           newEmployee?.role === 'manager' ? '👨‍💼 مشرف' : '👤 موظف';
          
          await sendTelegramMessage(chatId, `
🎉 <b>تم ربط حسابك بنجاح!</b>

👋 أهلاً وسهلاً <b>${newEmployee?.full_name}</b>!
🎯 صلاحيتك: ${roleTitle}

🚀 <b>الآن يمكنك:</b>
• إرسال الطلبات وستتم معالجتها تلقائياً
• استلام إشعارات فورية للطلبات
• متابعة إحصائياتك اليومية
• الحصول على تقارير الأداء

📝 <b>كيفية إرسال طلب:</b>
<i>أحمد محمد - بغداد - الكرادة
قميص أبيض - كبير - 2  
بنطال أسود - متوسط - 1</i>

💡 <b>أوامر مفيدة:</b>
• /stats - عرض إحصائياتك
• /help - دليل الاستخدام الشامل
• أرسل أي رسالة أخرى كطلب

<b>🎊 مرحباً بك في فريق RYUS!</b>
          `);
        } else {
          await sendTelegramMessage(chatId, `
❌ <b>رمز الموظف غير صحيح</b>

🔍 <b>تأكد من:</b>
• الرمز صحيح ومن 7 أحرف/أرقام
• نسخ الرمز من إعدادات النظام
• عدم وجود مسافات إضافية

📱 <b>للحصول على رمزك:</b>
1. اذهب لموقع RYUS
2. إعدادات → بوت التليغرام  
3. انسخ رمزك بدقة

<i>جرب مرة أخرى أو تواصل مع الإدارة للمساعدة</i>
          `);
        }
      } else {
        await sendTelegramMessage(chatId, `
🔐 <b>يجب ربط حسابك أولاً</b>

أرسل رمز الموظف الخاص بك (7 أحرف/أرقام).

📱 <b>مثال صحيح:</b> ABC1234

💡 احصل على رمزك من إعدادات النظام في موقع RYUS
        `);
      }
      return new Response('OK', { status: 200 });
    }

    // User is linked - معالجة الأوامر حسب الصلاحية
    if (text === '/help') {
      const rolePermissions = {
        admin: {
          title: '👑 مدير النظام',
          permissions: [
            '📝 إنشاء طلبات جديدة',
            '📊 مراجعة جميع الطلبات', 
            '💰 إدارة الأرباح والمحاسبة',
            '👥 إدارة الموظفين',
            '📦 إدارة المخزون الكامل',
            '🏪 إعدادات النظام'
          ]
        },
        manager: {
          title: '👨‍💼 مشرف',
          permissions: [
            '📝 إنشاء طلبات جديدة',
            '📋 مراجعة طلبات الفريق',
            '📦 متابعة المخزون',
            '📊 تقارير الأداء',
            '💡 توجيه الموظفين'
          ]
        },
        employee: {
          title: '👤 موظف',
          permissions: [
            '📝 إنشاء طلبات جديدة',
            '📊 متابعة طلباتك الشخصية',
            '📈 عرض إحصائياتك',
            '💼 إدارة عملائك'
          ]
        }
      };
      
      const userRole = rolePermissions[employee.role] || rolePermissions.employee;
      
      await sendTelegramMessage(chatId, `
📋 <b>المساعدة - نظام إدارة المخزون RYUS</b>

<b>🎯 مرحباً ${employee.full_name}</b>
<b>صلاحيتك:</b> ${userRole.title}

<b>📝 إنشاء طلب جديد:</b>
أرسل تفاصيل الطلب بالتنسيق التالي:
<i>اسم الزبون - المحافظة - العنوان التفصيلي
المنتج الأول - الحجم - الكمية
المنتج الثاني - الحجم - الكمية</i>

<b>🔧 الأوامر المتاحة:</b>
📊 /stats - عرض الإحصائيات
❓ /help - عرض هذه المساعدة

<b>🎯 صلاحياتك في النظام:</b>
${userRole.permissions.map(p => `• ${p}`).join('\n')}

<b>💡 مثال على طلب صحيح:</b>
<i>أحمد علي - بغداد - الكرادة شارع 14 بناية 5
قميص أبيض قطني - كبير - 2
بنطال جينز أزرق - متوسط - 1
حذاء رياضي - 42 - 1</i>

<b>📌 نصائح مهمة:</b>
• السطر الأول: معلومات الزبون والتوصيل
• باقي الأسطر: تفاصيل المنتجات
• استخدم أحجام واضحة ومفهومة
• اذكر اللون والنوع للوضوح

<b>🎊 نحن هنا لمساعدتك في تحقيق أفضل النتائج!</b>
      `);
      
    } else if (text === '/stats') {
      // Get user statistics from database
      const { data: orders } = await supabase
        .from('ai_orders')
        .select('*')
        .eq('created_by', employee.employee_code);
        
      const totalOrders = orders?.length || 0;
      const pendingOrders = orders?.filter(o => o.status === 'pending').length || 0;
      const processedOrders = orders?.filter(o => o.status === 'processed').length || 0;
      
      // Calculate today's orders
      const today = new Date().toISOString().split('T')[0];
      const todayOrders = orders?.filter(o => 
        o.created_at.startsWith(today)
      ).length || 0;
      
      // Calculate total value
      const totalValue = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
      
      const roleTitle = employee.role === 'admin' ? '👑 مدير' : 
                       employee.role === 'manager' ? '👨‍💼 مشرف' : '👤 موظف';
      
      await sendTelegramMessage(chatId, `
📊 <b>إحصائياتك - ${employee.full_name}</b>
<b>الصلاحية:</b> ${roleTitle}

📈 <b>ملخص الطلبات:</b>
📦 إجمالي الطلبات: <b>${totalOrders}</b>
📅 طلبات اليوم: <b>${todayOrders}</b>
⏳ قيد المراجعة: <b>${pendingOrders}</b>
✅ تم المعالجة: <b>${processedOrders}</b>

💰 <b>القيمة الإجمالية:</b> ${totalValue.toLocaleString()} دينار

${employee.role === 'admin' ? 
  `🔧 <b>أدوات المدير:</b>
• مراجعة جميع الطلبات في النظام
• إدارة المخزون والمنتجات  
• متابعة الأرباح والمحاسبة
• إدارة الموظفين وصلاحياتهم
• تقارير شاملة للنشاط` :
  employee.role === 'manager' ?
  `📋 <b>أدوات المشرف:</b>
• مراجعة طلبات الفريق
• متابعة أداء المخزون
• تقارير الأداء اليومية
• توجيه ومساعدة الموظفين` :
  `💼 <b>أدواتك كموظف:</b>
• إنشاء طلبات للعملاء
• متابعة حالة طلباتك
• عرض إحصائياتك الشخصية
• إدارة قاعدة عملائك`
}

<b>🎯 لإنشاء طلب جديد:</b>
أرسل تفاصيل الطلب مباشرة أو استخدم /help للمساعدة

<b>🚀 استمر في العمل الرائع!</b>
      `);
      
    } else {
      // Process order
      console.log('Processing order for employee:', employee.employee_code);
      await processOrderText(text, chatId, employee.employee_code);
    }

    return new Response('OK', { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('Error in webhook:', error);
    console.error('Error details:', error.message, error.stack);
    
    // تأكد من إرجاع رد مناسب حتى لو حدث خطأ
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 200, // استخدم 200 لأن التليغرام يحتاج ذلك
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});