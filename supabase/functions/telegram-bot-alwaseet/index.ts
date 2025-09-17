import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Telegram Bot Token
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!

interface TelegramMessage {
  message_id: number
  from: {
    id: number
    first_name: string
    username?: string
  }
  chat: {
    id: number
    type: string
  }
  text: string
  date: number
}

interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
}

// Send message to Telegram
async function sendTelegramMessage(chatId: number, text: string) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    })
  })
  return response.json()
}

// Get cities from cache database (fast and updated)
async function getCitiesFromCache(): Promise<any[]> {
  try {
    const { data: cities, error } = await supabase
      .from('cities_cache')
      .select('id, name, original_id')
      .eq('is_active', true)
      .order('name')
    
    if (error) {
      console.error('Error fetching cities from cache:', error)
      return []
    }
    
    return cities || []
  } catch (error) {
    console.error('Error in getCitiesFromCache:', error)
    return []
  }
}

// Get regions by city from cache database (fast and updated)
async function getRegionsByCity(cityId: number): Promise<any[]> {
  try {
    const { data: regions, error } = await supabase
      .from('regions_cache')
      .select('id, name, original_id')
      .eq('city_id', cityId)
      .eq('is_active', true)
      .order('name')
    
    if (error) {
      console.error('Error fetching regions from cache:', error)
      return []
    }
    
    return regions || []
  } catch (error) {
    console.error('Error in getRegionsByCity:', error)
    return []
  }
}

// Enhanced Arabic text normalization for better city matching
function normalizeArabic(text: string): string {
  if (!text) return ''
  
  return text.toString().trim()
    // Remove common prefixes
    .replace(/^(ال|محافظة|مدينة)\s+/g, '')
    // Normalize common Arabic letters
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ة]/g, 'ه')
    .replace(/[ي]/g, 'ى')
    // Remove extra spaces
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

// City name variations dictionary for better matching
const cityNameVariations: { [key: string]: string[] } = {
  'ديوانية': ['الديوانية', 'ديوانيه', 'الديوانيه', 'القادسية', 'القادسيه'],
  'بغداد': ['بغداد', 'Baghdad', 'baghdad'],
  'البصرة': ['البصره', 'بصرة', 'بصره', 'البصرة'],
  'اربيل': ['أربيل', 'اربيل', 'Erbil', 'erbil'],
  'دهوك': ['دهوك', 'Dohuk', 'dohuk'],
  'كربلاء': ['كربلاء', 'كربلا', 'Karbala', 'karbala'],
  'النجف': ['النجف', 'نجف', 'Najaf', 'najaf'],
  'نينوى': ['نينوى', 'نينوا', 'الموصل', 'موصل', 'Nineveh', 'nineveh'],
  'صلاح الدين': ['صلاح الدين', 'صلاحدين', 'تكريت'],
  'الانبار': ['الأنبار', 'الانبار', 'انبار', 'أنبار', 'الرمادي'],
  'بابل': ['بابل', 'الحلة', 'حلة', 'Babylon', 'babylon'],
  'واسط': ['واسط', 'الكوت', 'كوت', 'Wasit', 'wasit'],
  'ذي قار': ['ذي قار', 'ذيقار', 'الناصرية', 'ناصرية'],
  'المثنى': ['المثنى', 'مثنى', 'السماوة', 'سماوة'],
  'ميسان': ['ميسان', 'العمارة', 'عمارة', 'Maysan', 'maysan'],
  'كركوك': ['كركوك', 'Kirkuk', 'kirkuk'],
  'السليمانية': ['السليمانية', 'سليمانية', 'Sulaymaniyah', 'sulaymaniyah']
}

// Enhanced flexible product search that handles both ة and ه with detailed logging
function createFlexibleSearchTerms(productName: string): string[] {
  const normalized = normalizeArabic(productName)
  const terms = [
    productName,
    normalized,
    productName.replace(/ة/g, 'ه'),
    productName.replace(/ه/g, 'ة'),
    normalized.replace(/ة/g, 'ه'),
    normalized.replace(/ه/g, 'ة')
  ]
  
  // Add partial matching for single words
  const words = productName.split(/\s+/);
  if (words.length === 1 && words[0].length >= 3) {
    terms.push(words[0]);
    terms.push(normalizeArabic(words[0]));
  }
  
  const uniqueTerms = [...new Set(terms)]
  console.log(`🔍 Search terms for "${productName}":`, uniqueTerms)
  return uniqueTerms
}

// Enhanced city finder with variations support and error feedback
async function findCityByName(cityName: string): Promise<{ city: any | null, suggestions: any[] }> {
  const cities = await getCitiesFromCache()
  const normalizedName = normalizeArabic(cityName)
  
  if (!cities.length) {
    return { city: null, suggestions: [] }
  }
  
  // First try direct match
  let foundCity = cities.find(city => {
    const cityNormalized = normalizeArabic(city.name)
    return cityNormalized === normalizedName ||
           cityNormalized.includes(normalizedName) ||
           normalizedName.includes(cityNormalized)
  })
  
  if (foundCity) {
    return { city: foundCity, suggestions: [] }
  }
  
  // Try variations dictionary
  for (const [standardName, variations] of Object.entries(cityNameVariations)) {
    if (variations.some(variant => normalizeArabic(variant) === normalizedName)) {
      foundCity = cities.find(city => normalizeArabic(city.name).includes(normalizeArabic(standardName)))
      if (foundCity) {
        return { city: foundCity, suggestions: [] }
      }
    }
  }
  
  // Find similar cities for suggestions
  const suggestions = cities.filter(city => {
    const cityNormalized = normalizeArabic(city.name)
    // Check if city name contains part of the search term or vice versa
    return cityNormalized.includes(normalizedName.substring(0, 3)) ||
           normalizedName.includes(cityNormalized.substring(0, 3))
  }).slice(0, 5)
  
  return { city: null, suggestions }
}

// Known neighborhoods and their default cities for smart detection
const neighborhoodToCityMap: { [key: string]: string } = {
  'الاعظمية': 'بغداد',
  'الكرادة': 'بغداد', 
  'الدورة': 'بغداد',
  'المنصور': 'بغداد',
  'الكاظمية': 'بغداد',
  'الشعلة': 'بغداد',
  'حي الجهاد': 'بغداد',
  'البياع': 'بغداد',
  'الغدير': 'بغداد',
  'الزعفرانية': 'بغداد',
  'النهروان': 'بغداد',
  'ابو غريب': 'بغداد',
  'التاجي': 'بغداد'
}

// Find regions by partial name with disambiguation
async function findRegionsByName(cityId: number, regionText: string): Promise<any[]> {
  if (!regionText || !cityId) return []
  
  const regions = await getRegionsByCity(cityId)
  const normalizedText = normalizeArabic(regionText)
  
  // Find all matching regions
  const matchingRegions = regions.filter(region => {
    const normalizedRegion = normalizeArabic(region.name)
    return normalizedRegion.includes(normalizedText) || 
           normalizedText.includes(normalizedRegion)
  })
  
  return matchingRegions
}

// Enhanced address parsing with smart city detection
async function parseAddressLine(addressText: string): Promise<{
  city: any | null,
  regions: any[],
  remainingText: string,
  isDefaultCity: boolean,
  errors: string[]
}> {
  if (!addressText) {
    return { city: null, regions: [], remainingText: '', isDefaultCity: false, errors: ['لا يوجد نص عنوان'] }
  }
  
  const parts = addressText.split(/[،,\s]+/).filter(Boolean)
  const errors: string[] = []
  let isDefaultCity = false
  
  // Check if first part contains a known neighborhood
  const firstPart = parts[0]
  const normalizedFirst = normalizeArabic(firstPart)
  
  // Look for known neighborhoods first
  let defaultCityName = null
  for (const [neighborhood, cityName] of Object.entries(neighborhoodToCityMap)) {
    if (normalizedFirst.includes(normalizeArabic(neighborhood))) {
      defaultCityName = cityName
      isDefaultCity = true
      console.log(`🏘️ تم اكتشاف حي "${neighborhood}" - سيتم استخدام مدينة ${cityName} كافتراضي`)
      break
    }
  }
  
  // Try to find city from first part
  let cityResult = await findCityByName(parts[0])
  let city = cityResult.city
  
  // If no city found and we have a default from neighborhood, use it
  if (!city && defaultCityName) {
    const defaultResult = await findCityByName(defaultCityName)
    city = defaultResult.city
    if (city) {
      console.log(`✅ تم استخدام مدينة ${city.name} كافتراضي بناءً على الحي المكتشف`)
    }
  }
  
  // If still no city and parts available, default to Baghdad
  if (!city && parts.length > 0) {
    const baghdadResult = await findCityByName('بغداد')
    city = baghdadResult.city
    isDefaultCity = true
    if (city) {
      console.log(`🏙️ لم يتم تحديد مدينة، استخدام بغداد كافتراضي`)
    }
  }
  
  if (!city) {
    // Try to suggest similar cities
    if (cityResult.suggestions.length > 0) {
      const suggestedNames = cityResult.suggestions.map(s => s.name).join('، ')
      errors.push(`المدينة "${parts[0]}" غير موجودة. هل تقصد: ${suggestedNames}؟`)
    } else {
      errors.push(`لم يتم العثور على مدينة "${parts[0]}"`)
    }
    return { city: null, regions: [], remainingText: addressText, isDefaultCity: false, errors }
  }
  
  // Determine region search parts
  const regionParts = isDefaultCity && !await findCityByName(parts[0]) 
    ? parts  // All parts if Baghdad default and first part isn't a city
    : parts.slice(1)  // Skip city part
    
  let regions: any[] = []
  let nearestPointText = ''
  
  if (regionParts.length > 0) {
    // Try different combinations for multi-word regions (prioritize longer matches)
    for (let wordCount = Math.min(3, regionParts.length); wordCount >= 1; wordCount--) {
      const regionCandidate = regionParts.slice(0, wordCount).join(' ')
      const foundRegions = await findRegionsByName(city.id, regionCandidate)
      
      if (foundRegions.length > 0) {
        regions = foundRegions
        // Rest becomes address details
        if (regionParts.length > wordCount) {
          nearestPointText = regionParts.slice(wordCount).join(' ')
        }
        console.log(`✅ تم العثور على مطابقة للمنطقة: "${regionCandidate}" (${foundRegions.length} نتيجة)`)
        break
      }
    }
    
    // If no region found, add to errors
    if (regions.length === 0) {
      const regionText = regionParts.join(' ')
      errors.push(`لم يتم العثور على منطقة "${regionText}" في مدينة ${city.name}`)
      console.log(`⚠️ لم يتم العثور على منطقة مطابقة في: ${regionText}`)
    }
  }
  
  return { 
    city, 
    regions, 
    remainingText: nearestPointText,
    isDefaultCity,
    errors
  }
}

// Send enhanced error message with suggestions
async function sendErrorMessageWithSuggestions(chatId: number, originalText: string, errors: string[], suggestions?: any[]): Promise<void> {
  let message = `❌ خطأ في معالجة الطلب:\n\n`
  
  errors.forEach((error, index) => {
    message += `${index + 1}. ${error}\n`
  })
  
  if (suggestions && suggestions.length > 0) {
    message += `\n💡 اقتراحات لتصحيح المدينة:\n`
    suggestions.forEach((suggestion, index) => {
      message += `${index + 1}. ${suggestion.name}\n`
    })
  }
  
  message += `\n📝 النص الأصلي:\n${originalText}\n\n`
  message += `🔧 لتصحيح الطلب، يرجى إعادة كتابته بالشكل التالي:\n`
  message += `اسم العميل\n`
  message += `رقم الهاتف (07xxxxxxxxx)\n`
  message += `المدينة المنطقة (مثال: بغداد الكرادة)\n`
  message += `اسم المنتج\n\n`
  message += `مثال صحيح:\n`
  message += `أحمد علي\n`
  message += `07701234567\n`
  message += `بغداد الكرادة\n`
  message += `برشلونة ازرق ميديم`
  
  await sendTelegramMessage(chatId, message)
}

// Send region selection menu
async function sendRegionSelectionMenu(chatId: number, cityName: string, regions: any[], originalText: string): Promise<boolean> {
  let message = `🏙️ المدينة: ${cityName}\n\n`
  message += `🔍 وجدت عدة مناطق مشابهة:\n\n`
  
  regions.forEach((region, index) => {
    message += `${index + 1}) ${region.name}\n`
  })
  
  message += `\n📝 اكتب: المنطقة: [اسم المنطقة الصحيح]\n`
  message += `مثال: المنطقة: ${regions[0].name}\n\n`
  message += `📋 النص الأصلي: ${originalText}`
  
  await sendTelegramMessage(chatId, message)
  return true
}

// Store pending order for region selection
const pendingOrders = new Map()

// Process region selection response
async function processRegionSelection(text: string, chatId: number): Promise<boolean> {
  const regionMatch = text.match(/المنطقة:\s*(.+)/i)
  if (!regionMatch) return false
  
  const selectedRegionName = regionMatch[1].trim()
  const pendingOrder = pendingOrders.get(chatId)
  
  if (!pendingOrder) {
    await sendTelegramMessage(chatId, '❌ لا يوجد طلب في انتظار اختيار المنطقة')
    return false
  }
  
  // Find the selected region
  const selectedRegion = pendingOrder.regions.find((r: any) => 
    normalizeArabic(r.name) === normalizeArabic(selectedRegionName) ||
    normalizeArabic(r.name).includes(normalizeArabic(selectedRegionName))
  )
  
  if (!selectedRegion) {
    await sendTelegramMessage(chatId, `❌ المنطقة "${selectedRegionName}" غير موجودة في القائمة. يرجى اختيار من القائمة المعروضة.`)
    return false
  }
  
  // Update pending order with selected region
  pendingOrder.customerRegion = selectedRegion
  pendingOrder.customerAddress = pendingOrder.remainingText || pendingOrder.customerAddress
  
  // Clear pending order and process
  pendingOrders.delete(chatId)
  
  // Continue with order processing
  return await completeOrderProcessing(pendingOrder, chatId)
}

// Complete order processing after region selection
async function completeOrderProcessing(orderData: any, chatId: number): Promise<boolean> {
  try {
    const employeeData = await supabase.rpc('get_employee_by_telegram_id', { 
      p_telegram_chat_id: chatId 
    })
    const employee = employeeData.data?.[0]
    
    if (!employee) return false
    
    // Get delivery fee
    const { data: settingsData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'delivery_fee')
      .single()
    
    const defaultDeliveryFee = Number(settingsData?.value) || 5000
    
    // Calculate total
    const totalPrice = orderData.items.reduce((sum: number, item: any) => 
      sum + (item.price * item.quantity), 0)
    
    // Create order confirmation message
    const employeeInfo = employee ? 
      `${employee.full_name} (${employee.role}) - ${employee.employee_code}` : 
      `@${employee.employee_code}`
      
    const orderSummary = `
🔹 تأكيد الطلب الجديد 🔹

👤 العميل: ${orderData.customerName}
📱 الهاتف: ${orderData.customerPhone}${orderData.customerSecondaryPhone ? `\n📱 الهاتف الثاني: ${orderData.customerSecondaryPhone}` : ''}
🏙️ المدينة: ${orderData.customerCity?.name || 'غير محدد'}
📍 المنطقة: ${orderData.customerRegion?.name || 'غير محدد'}
🏠 العنوان: ${orderData.customerAddress || ''}

📦 المنتجات:
${orderData.items.map((item: any) => `• ${item.name} - كمية: ${item.quantity} - سعر: ${item.price.toLocaleString()} د.ع`).join('\n')}

💰 المجموع: ${totalPrice.toLocaleString()} د.ع
🚚 رسوم التوصيل: ${defaultDeliveryFee.toLocaleString()} د.ع
💳 المبلغ الإجمالي: ${(totalPrice + defaultDeliveryFee).toLocaleString()} د.ع

📋 المعرف: #TG_${Date.now().toString().slice(-6)}
👨‍💼 بواسطة: ${employeeInfo}

✅ تم حفظ الطلب بنجاح في النظام
⏳ في انتظار مراجعة الإدارة للموافقة والإرسال
    `.trim()
    
    // Save order to database
    const orderId = await supabase.rpc('process_telegram_order', {
      p_order_data: {
        customer_name: orderData.customerName,
        customer_phone: orderData.customerPhone,
        customer_secondary_phone: orderData.customerSecondaryPhone,
        customer_address: orderData.customerAddress,
        customer_city: orderData.customerCity?.name,
        customer_region: orderData.customerRegion?.name,
        items: orderData.items,
        total_price: totalPrice,
        delivery_fee: defaultDeliveryFee,
        final_total: totalPrice + defaultDeliveryFee,
        delivery_type: orderData.deliveryType,
        order_notes: orderData.orderNotes,
        telegram_chat_id: chatId,
        processed_at: new Date().toISOString(),
        original_text: `${orderData.customerName}\n${orderData.customerPhone}\n${orderData.items.map(i => i.name).join(', ')}`
      },
      p_employee_code: employee.employee_code,
      p_chat_id: chatId
    })
    
    if (orderId.error) {
      console.error('Database error:', orderId.error)
      await sendTelegramMessage(chatId, '❌ حدث خطأ في حفظ الطلب في النظام. يرجى المحاولة مرة أخرى.')
      return false
    }
    
    // Send confirmation
    await sendTelegramMessage(chatId, orderSummary)
    return true
    
  } catch (error) {
    console.error('Error completing order:', error)
    await sendTelegramMessage(chatId, '❌ حدث خطأ في معالجة الطلب. يرجى المحاولة مرة أخرى.')
    return false
  }
}

// Helper function to validate customer name
function isValidCustomerName(name: string): boolean {
  const trimmed = name.trim()
  // رفض الأسماء الفارغة أو القصيرة جداً
  if (!trimmed || trimmed.length < 2) return false
  // رفض الأسماء التي تحتوي على أرقام فقط
  if (/^\d+$/.test(trimmed)) return false
  // رفض الأسماء التي تحتوي على رموز غير مناسبة فقط
  if (/^[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+$/.test(trimmed)) return false
  // رفض الأسماء التي تحتوي على أرقام هواتف
  if (/07[5789]\d{8}/.test(trimmed)) return false
  // رفض الأسماء التي تبدو مثل عناوين (تحتوي على مدن عراقية شائعة)
  const addressWords = ['بغداد', 'البصرة', 'اربيل', 'دهوك', 'كربلاء', 'النجف', 'الانبار', 'نينوى', 'صلاح الدين', 'القادسية', 'بابل', 'واسط', 'ذي قار', 'المثنى', 'ميسان', 'الدورة', 'الكرادة', 'المنصور', 'الكاظمية', 'الاعظمية', 'الحلة', 'كركوك', 'تكريت', 'الرمادي', 'الفلوجة', 'الموصل', 'السماوة', 'الديوانية', 'العمارة', 'الناصرية']
  const lowerName = trimmed.toLowerCase()
  if (addressWords.some(word => lowerName.includes(word.toLowerCase()))) return false
  // رفض الأسماء التي تحتوي على كلمات عناوين شائعة
  if (/\b(شارع|حي|منطقة|قرب|مقابل|جانب|محلة|صحة|مستشفى|جامع|مدرسة|مول|سوق)\b/i.test(trimmed)) return false
  return true
}

// Enhanced order processing with improved error handling
async function processOrderWithAlWaseet(text: string, chatId: number, employeeCode: string) {
  try {
    const lines = text.split('\n').filter(line => line.trim())
    
    let customerName = ''
    let customerPhone = ''
    let customerSecondaryPhone = ''
    let customerAddress = ''
    let customerCity = null
    let customerRegion = null
    let items = []
    let totalPrice = 0
    let hasCustomPrice = false
    let deliveryType = 'توصيل'
    let orderNotes = ''
    let orderErrors: string[] = []
    let isDefaultCity = false
    
    // Get default settings
    const { data: settingsData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'delivery_fee')
      .single()
    
    const defaultDeliveryFee = Number(settingsData?.value) || 5000
    
    // Get employee info
    const employeeData = await supabase.rpc('get_employee_by_telegram_id', { 
      p_telegram_chat_id: chatId 
    })
    const employee = employeeData.data?.[0]
    
    if (!employee) {
      console.error('No employee found for chat ID:', chatId)
      return false
    }
    
    const { data: profileData } = await supabase
      .from('profiles')
      .select('default_customer_name')
      .eq('user_id', employee.user_id)
      .single()
    
    const defaultCustomerName = profileData?.default_customer_name || 'زبون من التليغرام'
    
    let phoneFound = false
    let cityFound = false
    
    // Parse order text
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      const lowerLine = line.toLowerCase()
      
      // Parse customer name - improved detection with validation
      if ((lowerLine.includes('اسم') || lowerLine.includes('زبون') || lowerLine.includes('عميل') || lowerLine.includes('الزبون')) && !customerName) {
        const extractedName = line.replace(/^(اسم|زبون|عميل|الزبون)[:\s]*/i, '').trim()
        if (isValidCustomerName(extractedName)) {
          customerName = extractedName
        }
      } else if (i === 0 && !customerName && !line.match(/07[5789]\d{8}/) && !lowerLine.includes('منتج') && isValidCustomerName(line)) {
        // First line as customer name only if it's a valid name
        customerName = line.trim()
      }
      
      // Parse phone numbers
      const phoneRegex = /(?:07[5789]\d{8,9})/g
      const phoneMatches = line.match(phoneRegex)
      if (phoneMatches && !phoneFound) {
        customerPhone = phoneMatches[0]
        if (phoneMatches[1]) customerSecondaryPhone = phoneMatches[1]
        phoneFound = true
      }
      
      // Parse address with enhanced city detection
      if ((lowerLine.includes('عنوان') || lowerLine.includes('منطقة') || lowerLine.includes('محلة')) && !customerAddress) {
        customerAddress = line.replace(/^(عنوان|منطقة|محلة)[:\s]*/i, '').trim()
      }
      
      // Parse city explicitly
      if ((lowerLine.includes('مدينة') || lowerLine.includes('محافظة')) && !cityFound) {
        const cityText = line.replace(/^(مدينة|محافظة)[:\s]*/i, '').trim()
        const cityResult = await findCityByName(cityText)
        customerCity = cityResult.city
        
        if (!customerCity && cityResult.suggestions.length > 0) {
          orderErrors.push(`المدينة "${cityText}" غير موجودة. هل تقصد: ${cityResult.suggestions.map(s => s.name).join('، ')}؟`)
        }
        cityFound = true
      }
      
      // Smart address parsing without explicit city/region labels
      if (!cityFound && !customerAddress && !phoneMatches && !lowerLine.includes('منتج') && 
          !isValidCustomerName(line) && line.length > 3) {
        
        const addressResult = await parseAddressLine(line)
        
        if (addressResult.city) {
          customerCity = addressResult.city
          isDefaultCity = addressResult.isDefaultCity
          
          if (addressResult.regions.length === 1) {
            customerRegion = addressResult.regions[0]
            customerAddress = addressResult.remainingText || line
            console.log(`✅ تم تحليل العنوان تلقائياً: مدينة ${customerCity.name}, منطقة ${customerRegion.name}`)
          } else if (addressResult.regions.length > 1) {
            // Multiple regions found - need user to clarify
            pendingOrders.set(chatId, {
              customerName: customerName || defaultCustomerName,
              customerPhone,
              customerSecondaryPhone,
              customerAddress: line,
              customerCity,
              regions: addressResult.regions,
              remainingText: addressResult.remainingText,
              items: [],
              deliveryType,
              orderNotes
            })
            
            await sendRegionSelectionMenu(chatId, customerCity.name, addressResult.regions, text)
            return true
          }
          
          if (isDefaultCity) {
            console.log(`🏙️ تم استخدام مدينة افتراضية: ${customerCity.name}`)
          }
        }
        
        // Add parsing errors to the list
        orderErrors.push(...addressResult.errors)
        cityFound = true
      }
      
      // Product parsing
      if (!phoneMatches && !lowerLine.includes('منطقة') && !lowerLine.includes('مدينة') && 
          !lowerLine.includes('عنوان') && !isValidCustomerName(line) && line.length > 2) {
        
        // Enhanced product search
        const searchTerms = createFlexibleSearchTerms(line)
        let foundProduct = null
        
        for (const term of searchTerms) {
          const { data: products, error } = await supabase
            .from('products')
            .select('*')
            .ilike('name', `%${term}%`)
            .eq('is_active', true)
            .limit(1)
          
          if (products && products.length > 0) {
            foundProduct = products[0]
            console.log(`✅ Found product with term "${term}":`, foundProduct.name)
            break
          }
        }
        
        if (foundProduct) {
          items.push({
            id: foundProduct.id,
            name: foundProduct.name,
            price: foundProduct.price,
            quantity: 1
          })
          totalPrice += foundProduct.price
        } else {
          console.log(`❌ Product not found for: "${line}"`)
        }
      }
    }
    
    // Validation and error handling
    if (!customerName) customerName = defaultCustomerName
    
    if (!customerPhone) {
      orderErrors.push('لم يتم العثور على رقم هاتف صالح (يجب أن يبدأ بـ 07)')
    }
    
    if (!customerCity) {
      orderErrors.push('لم يتم تحديد المدينة بوضوح')
    }
    
    if (items.length === 0) {
      orderErrors.push('لم يتم العثور على أي منتجات صالحة')
    }
    
    // If there are errors, send detailed error message
    if (orderErrors.length > 0) {
      let suggestions = []
      if (!customerCity) {
        // Try to get city suggestions from first non-phone line
        const addressLine = lines.find(line => 
          !line.match(/07[5789]\d{8}/) && 
          !isValidCustomerName(line) && 
          line.length > 3
        )
        if (addressLine) {
          const cityResult = await findCityByName(addressLine.split(/[\s,،]/)[0])
          suggestions = cityResult.suggestions
        }
      }
      
      await sendErrorMessageWithSuggestions(chatId, text, orderErrors, suggestions)
      return false
    }
    
    // Complete order processing
    const orderData = {
      customerName,
      customerPhone,
      customerSecondaryPhone,
      customerAddress: customerAddress || customerRegion?.name || '',
      customerCity,
      customerRegion,
      items,
      totalPrice,
      deliveryType,
      orderNotes
    }
    
    return await completeOrderProcessing(orderData, chatId)
    
  } catch (error) {
    console.error('Error processing order:', error)
    await sendTelegramMessage(chatId, '❌ حدث خطأ في معالجة الطلب. يرجى المحاولة مرة أخرى أو التواصل مع الدعم الفني.')
    return false
  }
}

// Simple welcome message
async function sendWelcomeMessage(chatId: number, employee: any) {
  const welcomeText = `
مرحباً ${employee.full_name}! 👋

🤖 أنا بوت معالجة الطلبات
📝 يمكنك إرسال طلبات العملاء بالشكل التالي:

اسم العميل
رقم الهاتف
المدينة المنطقة
اسم المنتج

مثال:
أحمد علي
07701234567
بغداد الكرادة
برشلونة ازرق ميديم

✨ البوت يفهم أسماء المدن بأشكال مختلفة
🏙️ يمكن كتابة المنطقة فقط وسيتم اختيار بغداد كافتراضي
  `.trim()
  
  await sendTelegramMessage(chatId, welcomeText)
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json()
    console.log('📨 Received Telegram update:', JSON.stringify(body, null, 2))
    
    const message = body.message
    if (!message || !message.text) {
      console.log('❌ No message or text found')
      return new Response('No message', { headers: corsHeaders })
    }

    const chatId = message.chat.id
    const text = message.text.trim()
    const userId = message.from.id

    console.log(`💬 Processing message from chat ${chatId}: "${text}"`)

    // Get employee information
    const { data: employeeData, error: employeeError } = await supabase.rpc('get_employee_by_telegram_id', { 
      p_telegram_chat_id: chatId 
    })

    if (employeeError) {
      console.error('❌ Error fetching employee:', employeeError)
      await sendTelegramMessage(chatId, '❌ خطأ في النظام. يرجى المحاولة مرة أخرى.')
      return new Response('Error', { headers: corsHeaders })
    }

    const employee = employeeData?.[0]
    if (!employee) {
      console.log(`❌ No employee found for chat ID: ${chatId}`)
      await sendTelegramMessage(chatId, '❌ غير مسموح لك باستخدام هذا البوت. يرجى التواصل مع الإدارة.')
      return new Response('Unauthorized', { headers: corsHeaders })
    }

    console.log(`👤 Employee found: ${employee.full_name} (${employee.employee_code})`)

    // Handle commands
    if (text === '/start' || text === '/help') {
      await sendWelcomeMessage(chatId, employee)
      return new Response('OK', { headers: corsHeaders })
    }

    // Check for region selection response
    if (text.includes('المنطقة:')) {
      const regionProcessed = await processRegionSelection(text, chatId)
      if (regionProcessed) {
        return new Response('OK', { headers: corsHeaders })
      }
    }

    // Process order
    const orderProcessed = await processOrderWithAlWaseet(text, chatId, employee.employee_code)
    
    if (!orderProcessed) {
      console.log('❌ Order processing failed')
      // Error message already sent in processOrderWithAlWaseet
    }

    return new Response('OK', { headers: corsHeaders })
    
  } catch (error) {
    console.error('❌ Telegram bot error:', error)
    return new Response('Internal Server Error', { 
      status: 500,
      headers: corsHeaders 
    })
  }
})