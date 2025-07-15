import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.30.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Get AlWaseet token from database
async function getAlWaseetToken(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('delivery_partner_tokens')
      .select('token')
      .eq('partner_name', 'alwaseet')
      .eq('is_active', true)
      .single();
    
    if (error || !data) {
      console.log('No active AlWaseet token found');
      return null;
    }
    
    return data.token;
  } catch (error) {
    console.error('Error getting AlWaseet token:', error);
    return null;
  }
}

// Get cities from AlWaseet API
async function getCitiesFromAlWaseet(): Promise<any[]> {
  try {
    const token = await getAlWaseetToken();
    if (!token) return [];

    const { data, error } = await supabase.functions.invoke('alwaseet-proxy', {
      body: {
        endpoint: 'citys',
        method: 'GET',
        token: token
      }
    });

    if (error || !data || data.errNum !== "S000") {
      console.error('Error fetching cities from AlWaseet:', error || data);
      return [];
    }

    return data.data || [];
  } catch (error) {
    console.error('Error in getCitiesFromAlWaseet:', error);
    return [];
  }
}

// Get regions by city from AlWaseet API
async function getRegionsByCity(cityId: string): Promise<any[]> {
  try {
    const token = await getAlWaseetToken();
    if (!token) return [];

    const { data, error } = await supabase.functions.invoke('alwaseet-proxy', {
      body: {
        endpoint: 'regions',
        method: 'GET',
        token: token,
        queryParams: { city_id: cityId }
      }
    });

    if (error || !data || data.errNum !== "S000") {
      console.error('Error fetching regions from AlWaseet:', error || data);
      return [];
    }

    return data.data || [];
  } catch (error) {
    console.error('Error in getRegionsByCity:', error);
    return [];
  }
}

// Find city by name (case-insensitive and fuzzy matching)
async function findCityByName(cityName: string): Promise<any | null> {
  const cities = await getCitiesFromAlWaseet();
  const normalizedName = cityName.toLowerCase().trim();
  
  // Direct match
  let foundCity = cities.find(city => 
    city.name.toLowerCase().includes(normalizedName) || 
    normalizedName.includes(city.name.toLowerCase())
  );
  
  // If not found, try common variations
  if (!foundCity) {
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
    
    for (const [realCity, variants] of Object.entries(cityVariants)) {
      if (variants.some(variant => 
        variant.toLowerCase().includes(normalizedName) || 
        normalizedName.includes(variant.toLowerCase())
      )) {
        foundCity = cities.find(city => 
          city.name.toLowerCase().includes(realCity.toLowerCase())
        );
        if (foundCity) break;
      }
    }
  }
  
  return foundCity;
}

// Get default Baghdad city
async function getBaghdadCity(): Promise<any | null> {
  const cities = await getCitiesFromAlWaseet();
  return cities.find(city => 
    city.name.toLowerCase().includes('بغداد') || 
    city.name.toLowerCase().includes('baghdad')
  ) || null;
}

// Enhanced order processing with AlWaseet integration
async function processOrderWithAlWaseet(text: string, chatId: number, employeeCode: string) {
  try {
    const lines = text.split('\n').filter(line => line.trim());
    
    let customerName = '';
    let customerPhone = '';
    let customerSecondaryPhone = '';
    let customerAddress = '';
    let customerCity = null;
    let customerRegion = null;
    let items = [];
    let totalPrice = 0;
    let hasCustomPrice = false;
    let deliveryType = 'توصيل';
    let orderNotes = '';
    
    // Get default settings
    const { data: settingsData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'delivery_fee')
      .single();
    
    const defaultDeliveryFee = Number(settingsData?.value) || 5000;
    
    // Get employee info
    const employeeData = await supabase.rpc('get_employee_by_telegram_id', { 
      p_telegram_chat_id: chatId 
    });
    const employee = employeeData.data?.[0];
    
    const { data: profileData } = await supabase
      .from('profiles')
      .select('default_customer_name')
      .eq('user_id', employee?.user_id)
      .single();
    
    const defaultCustomerName = profileData?.default_customer_name || 'زبون من التليغرام';
    
    let phoneFound = false;
    let cityFound = false;
    
    // Parse order text
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lowerLine = line.toLowerCase();
      
      // Check delivery type
      if (lowerLine.includes('محلي') || lowerLine.includes('تسليم محلي') || lowerLine.includes('استلام محلي')) {
        deliveryType = 'محلي';
        continue;
      }
      
      if (lowerLine.includes('توصيل') || lowerLine.includes('شحن') || lowerLine.includes('ديليفري')) {
        deliveryType = 'توصيل';
        continue;
      }
      
      // Check phone numbers
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
      
      // Check price
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
      
      // Check for products with + separator
      if (line.includes('+')) {
        const products = line.split('+').map(p => p.trim());
        for (const product of products) {
          if (product) {
            items.push(parseProduct(product));
          }
        }
        continue;
      }
      
      // Check for city/address
      if (!cityFound) {
        const foundCity = await findCityByName(line);
        if (foundCity) {
          customerCity = foundCity;
          customerAddress = line;
          deliveryType = 'توصيل';
          cityFound = true;
          continue;
        }
      }
      
      // Check for address keywords
      if (!cityFound && (lowerLine.includes('منطقة') || lowerLine.includes('شارع') || lowerLine.includes('حي') ||
          lowerLine.includes('محافظة') || lowerLine.includes('قضاء') || lowerLine.includes('ناحية') ||
          lowerLine.includes('مجمع') || lowerLine.includes('مدينة') || lowerLine.includes('قرية') ||
          lowerLine.includes('طريق') || lowerLine.includes('جسر') || lowerLine.includes('ساحة'))) {
        customerAddress = line;
        deliveryType = 'توصيل';
        // Try to find Baghdad as default
        if (!customerCity) {
          customerCity = await getBaghdadCity();
        }
        cityFound = true;
        continue;
      }
      
      // First line might be customer name
      if (!phoneFound && i === 0 && !priceMatch && !line.includes('+')) {
        customerName = line;
        continue;
      }
      
      // Otherwise, it's a product or note
      if (line && !line.match(/^\d+/) && !priceMatch) {
        const isProduct = line.match(/[a-zA-Z\u0600-\u06FF]{2,}/);
        if (isProduct) {
          items.push(parseProduct(line));
        } else {
          orderNotes += line + ' ';
        }
      }
    }
    
    // Set defaults
    if (!customerName) customerName = defaultCustomerName;
    
    // If no address and delivery type is توصيل, make it محلي
    if (!customerAddress && deliveryType === 'توصيل') {
      deliveryType = 'محلي';
    }
    
    // If delivery type is توصيل but no city found, default to Baghdad
    if (deliveryType === 'توصيل' && !customerCity) {
      customerCity = await getBaghdadCity();
    }
    
    // Calculate price if not custom
    if (!hasCustomPrice && items.length > 0) {
      let calculatedPrice = 0;
      
      for (const item of items) {
        const { data: productData } = await supabase
          .from('products')
          .select(`
            base_price,
            product_variants!inner (
              price,
              colors (name),
              sizes (name)
            )
          `)
          .ilike('name', `%${item.name}%`)
          .eq('is_active', true)
          .limit(1)
          .single();
        
        if (productData) {
          let productPrice = productData.base_price || 0;
          
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
          
          item.price = productPrice;
          calculatedPrice += productPrice * item.quantity;
        }
      }
      
      if (deliveryType === 'توصيل') {
        calculatedPrice += defaultDeliveryFee;
      }
      
      totalPrice = calculatedPrice;
    }

    // Create AI order
    const { data: orderId, error } = await supabase.rpc('process_telegram_order', {
      p_order_data: {
        original_text: text,
        processed_at: new Date().toISOString(),
        telegram_user_id: chatId,
        employee_code: employeeCode,
        delivery_type: deliveryType,
        city_data: customerCity,
        parsing_method: 'alwaseet_integrated',
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

    // Send detailed confirmation
    const deliveryIcon = deliveryType === 'محلي' ? '🏪' : '🚚';
    const cityText = customerCity ? `📍 المدينة: ${customerCity.name}` : '';
    const itemsList = items.slice(0, 3).map(item => {
      const itemTotal = (item.price || 0) * (item.quantity || 1);
      const priceDisplay = item.price > 0 ? `${itemTotal.toLocaleString()} د.ع` : 'السعر غير محدد';
      return `• ${item.name}${item.color ? ` (${item.color})` : ''}${item.size ? ` ${item.size}` : ''} × ${item.quantity} = ${priceDisplay}`;
    }).join('\n');
    
    const itemsTotal = items.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0);
    const deliveryFeeForDisplay = deliveryType === 'توصيل' ? defaultDeliveryFee : 0;
    
    await sendTelegramMessage(chatId, `
✅ <b>تم استلام الطلب بنجاح!</b>

🆔 <b>رقم الطلب:</b> <code>${orderId.toString().slice(-8)}</code>
👤 <b>الزبون:</b> ${customerName}
📱 <b>الهاتف:</b> ${customerPhone || 'غير محدد'}
${customerSecondaryPhone ? `📞 <b>هاتف ثانوي:</b> ${customerSecondaryPhone}` : ''}
${deliveryIcon} <b>نوع التسليم:</b> ${deliveryType}
${cityText}
${customerAddress ? `🏠 <b>العنوان:</b> ${customerAddress}` : ''}

📦 <b>المنتجات (${items.length}):</b>
${itemsList}
${items.length > 3 ? `... و ${items.length - 3} منتجات أخرى` : ''}

💰 <b>تفاصيل السعر:</b>
• المنتجات: ${itemsTotal.toLocaleString()} د.ع
${deliveryType === 'توصيل' ? `• التوصيل: ${deliveryFeeForDisplay.toLocaleString()} د.ع` : ''}
• <b>المجموع الإجمالي: ${totalPrice.toLocaleString()} د.ع</b>

⏳ <b>تم إرسال الطلب للمراجعة والموافقة</b>

<i>شكراً لك ${employee?.full_name}! 🙏</i>
    `);

    return orderId;
  } catch (error) {
    console.error('Error processing order with AlWaseet:', error);
    return false;
  }
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

function parseProduct(productText: string) {
  const text = productText.trim();
  
  // Extract quantity
  let quantity = 1;
  const quantityMatch = text.match(/[×x*]\s*(\d+)|(\d+)\s*[×x*]/);
  if (quantityMatch) {
    quantity = parseInt(quantityMatch[1] || quantityMatch[2]);
  }
  
  // Extract size
  let size = '';
  const sizeRegex = /\b(S|M|L|XL|XXL|s|m|l|xl|xxl|\d{2,3})\b/g;
  const sizeMatch = text.match(sizeRegex);
  if (sizeMatch) {
    size = sizeMatch[sizeMatch.length - 1].toUpperCase();
  }
  
  // Extract color
  const colors = ['أزرق', 'ازرق', 'blue', 'أصفر', 'اصفر', 'yellow', 'أحمر', 'احمر', 'red', 'أخضر', 'اخضر', 'green', 'أبيض', 'ابيض', 'white', 'أسود', 'اسود', 'black', 'بني', 'brown', 'رمادي', 'gray', 'grey', 'بنفسجي', 'purple', 'وردي', 'pink'];
  let color = '';
  
  for (const c of colors) {
    if (text.toLowerCase().includes(c.toLowerCase())) {
      color = c;
      break;
    }
  }
  
  // Extract product name
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
    price: 0 // Will be calculated later
  };
}

// This is a placeholder - will be integrated with the main telegram bot
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  return new Response(JSON.stringify({ 
    message: 'AlWaseet Telegram Bot Integration Ready',
    features: [
      'Real-time city and region lookup',
      'Baghdad default city selection',
      'Price calculation with delivery fees',
      'Complete order processing'
    ]
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
