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

// Get cities from database (real data)
async function getCitiesFromDatabase(): Promise<any[]> {
  try {
    const { data: cities, error } = await supabase
      .from('cities')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
    
    if (error) {
      console.error('Error fetching cities:', error)
      return []
    }
    
    return cities || []
  } catch (error) {
    console.error('Error in getCitiesFromDatabase:', error)
    return []
  }
}

// Get regions by city from database (real data)
async function getRegionsByCity(cityId: number): Promise<any[]> {
  try {
    const { data: regions, error } = await supabase
      .from('regions')
      .select('id, name')
      .eq('city_id', cityId)
      .eq('is_active', true)
      .order('name')
    
    if (error) {
      console.error('Error fetching regions:', error)
      return []
    }
    
    return regions || []
  } catch (error) {
    console.error('Error in getRegionsByCity:', error)
    return []
  }
}

// قاموس متغيرات أسماء المدن العراقية
const cityVariations: { [key: string]: string } = {
  'الديوانية': 'ديوانية',
  'ديوانيه': 'ديوانية',
  'الديوانيه': 'ديوانية',
  'النجف': 'نجف',
  'الكوفة': 'كوفة',
  'الكوفه': 'كوفة',
  'كوفه': 'كوفة',
  'البصرة': 'بصرة',
  'البصره': 'بصرة',
  'بصره': 'بصرة',
  'الأنبار': 'انبار',
  'الانبار': 'انبار',
  'انبار': 'انبار',
  'ذي قار': 'ذي قار',
  'ذيقار': 'ذي قار',
  'كركوك': 'كركوك',
  'اربيل': 'اربيل',
  'أربيل': 'اربيل',
  'الموصل': 'موصل',
  'نينوى': 'نينوى',
  'نينوا': 'نينوى',
  'دهوك': 'دهوك',
  'دهوج': 'دهوك',
  'السليمانية': 'سليمانية',
  'سليمانيه': 'سليمانية',
  'سلیمانیه': 'سليمانية',
  'كربلاء': 'كربلاء',
  'كربلا': 'كربلاء',
  'ديالى': 'ديالى',
  'ديالا': 'ديالى',
  'صلاح الدين': 'صلاح الدين',
  'تكريت': 'صلاح الدين',
  'واسط': 'واسط',
  'الكوت': 'واسط',
  'بابل': 'بابل',
  'الحلة': 'بابل',
  'القادسية': 'قادسية',
  'المثنى': 'مثنى',
  'السماوة': 'مثنى',
  'ميسان': 'ميسان',
  'العمارة': 'ميسان'
}

// قاموس المناطق والمدن الافتراضية
const neighborhoodToCityMap: { [key: string]: string } = {
  'الأعظمية': 'بغداد',
  'الاعظمية': 'بغداد',
  'اعظمية': 'بغداد',
  'الكرادة': 'بغداد',
  'كرادة': 'بغداد',
  'المنصور': 'بغداد',
  'منصور': 'بغداد',
  'الكاظمية': 'بغداد',
  'كاظمية': 'بغداد',
  'الصدر': 'بغداد',
  'صدر': 'بغداد',
  'الدورة': 'بغداد',
  'دورة': 'بغداد',
  'الشعلة': 'بغداد',
  'شعلة': 'بغداد',
  'الجادرية': 'بغداد',
  'جادرية': 'بغداد',
  'السيدية': 'بغداد',
  'سيدية': 'بغداد',
  'البياع': 'بغداد',
  'بياع': 'بغداد',
  'الحرية': 'بغداد',
  'حرية': 'بغداد',
  'اليرموك': 'بغداد',
  'يرموك': 'بغداد',
  'الغزالية': 'بغداد',
  'غزالية': 'بغداد'
}

// Arabic text normalization for better matching with ة/ه conversion
function normalizeArabic(text: string): string {
  if (!text) return ''
  
  let normalized = text.toString().trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ة]/g, 'ه')
    .replace(/[ي]/g, 'ى')
    .toLowerCase()
  
  // تطبيق متغيرات أسماء المدن
  for (const [variant, standard] of Object.entries(cityVariations)) {
    if (normalized === normalizeArabic(variant)) {
      normalized = normalizeArabic(standard)
      break
    }
  }
  
  return normalized
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

// Find city by name with intelligent matching and fuzzy search
async function findCityByName(cityName: string): Promise<any | null> {
  const cities = await getCitiesFromDatabase()
  const normalizedName = normalizeArabic(cityName)
  
  if (!cities.length) return null
  
  // Direct exact match first
  let foundCity = cities.find(city => 
    normalizeArabic(city.name) === normalizedName
  )
  
  if (foundCity) return foundCity
  
  // Partial match (contains)
  foundCity = cities.find(city => 
    normalizeArabic(city.name).includes(normalizedName) ||
    normalizedName.includes(normalizeArabic(city.name))
  )
  
  if (foundCity) return foundCity
  
  // Fuzzy matching for similar words
  for (const city of cities) {
    const cityNormalized = normalizeArabic(city.name)
    // تحقق من التشابه في أول 3 أحرف
    if (cityNormalized.length >= 3 && normalizedName.length >= 3) {
      if (cityNormalized.substring(0, 3) === normalizedName.substring(0, 3)) {
        return city
      }
    }
  }
  
  return null
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

// Parse single line address for city and region with improved logic and default city handling
async function parseAddressLine(addressText: string): Promise<{
  city: any | null,
  regions: any[],
  remainingText: string,
  defaultCityUsed?: boolean
}> {
  if (!addressText) return { city: null, regions: [], remainingText: '' }
  
  const parts = addressText.split(/[،,\s]+/).filter(Boolean)
  let defaultCityUsed = false
  let city = null
  
  // أولاً: البحث عن مدينة في النص
  for (const part of parts) {
    city = await findCityByName(part)
    if (city) {
      console.log(`🏙️ تم العثور على مدينة: ${city.name}`)
      break
    }
  }
  
  // ثانياً: إذا لم توجد مدينة، تحقق من المناطق المشهورة
  if (!city) {
    for (const part of parts) {
      const normalizedPart = normalizeArabic(part)
      for (const [neighborhood, defaultCity] of Object.entries(neighborhoodToCityMap)) {
        if (normalizedPart === normalizeArabic(neighborhood)) {
          city = await findCityByName(defaultCity)
          if (city) {
            defaultCityUsed = true
            console.log(`🏙️ تم اختيار ${city.name} كمدينة افتراضية للمنطقة: ${part}`)
            break
          }
        }
      }
      if (city) break
    }
  }
  
  // ثالثاً: إذا لم توجد مدينة، استخدم بغداد كافتراضي
  if (!city) {
    city = await getBaghdadCity()
    if (city) {
      defaultCityUsed = true
      console.log(`🏙️ لم يتم تحديد مدينة، استخدام بغداد كافتراضي`)
    }
  }
  
  if (!city) {
    return { city: null, regions: [], remainingText: addressText }
  }
  
  // تحديد أجزاء النص للبحث عن المناطق
  const explicitCityFound = !defaultCityUsed || Object.values(neighborhoodToCityMap).includes(city.name)
  const regionParts = explicitCityFound && !defaultCityUsed
    ? parts.filter(part => normalizeArabic(part) !== normalizeArabic(city.name))
    : parts  // جميع الأجزاء إذا كانت المدينة افتراضية
    
  let regions: any[] = []
  let nearestPointText = ''
  
  if (regionParts.length > 0) {
    // محاولة البحث عن مناطق بتراكيب مختلفة (أولوية للتطابقات الأطول)
    for (let wordCount = Math.min(3, regionParts.length); wordCount >= 1; wordCount--) {
      const regionCandidate = regionParts.slice(0, wordCount).join(' ')
      const foundRegions = await findRegionsByName(city.id, regionCandidate)
      
      if (foundRegions.length > 0) {
        regions = foundRegions
        if (regionParts.length > wordCount) {
          nearestPointText = regionParts.slice(wordCount).join(' ')
        }
        console.log(`✅ تم العثور على مطابقة للمنطقة: "${regionCandidate}" (${foundRegions.length} نتيجة)`)
        break
      }
    }
    
    if (regions.length === 0) {
      console.log(`⚠️ لم يتم العثور على منطقة مطابقة في: ${regionParts.join(' ')}`)
    }
  }
  
  return { 
    city, 
    regions, 
    remainingText: nearestPointText,
    defaultCityUsed
  }
}

// Get default Baghdad city
async function getBaghdadCity(): Promise<any | null> {
  const cities = await getCitiesFromDatabase()
  return cities.find(city => 
    normalizeArabic(city.name).includes('بغداد')
  ) || null
}

// إرسال رسالة خطأ للمدينة غير الصحيحة أو المفقودة
async function sendCityErrorMessage(chatId: number, cityText: string, originalText: string): Promise<boolean> {
  const cities = await getCitiesFromDatabase()
  
  // البحث عن مدن مشابهة
  const similarCities = cities
    .filter(city => {
      const cityNormalized = normalizeArabic(city.name)
      const inputNormalized = normalizeArabic(cityText)
      return cityNormalized.includes(inputNormalized.substring(0, 2)) || 
             inputNormalized.includes(cityNormalized.substring(0, 2))
    })
    .slice(0, 5)
  
  let message = `❌ المدينة "${cityText}" غير متوفرة في قاعدة البيانات\n\n`
  
  if (similarCities.length > 0) {
    message += `🔍 مدن مشابهة متوفرة:\n`
    similarCities.forEach((city, index) => {
      message += `${index + 1}) ${city.name}\n`
    })
    message += `\n📝 يرجى إعادة كتابة الطلب مع اسم المدينة الصحيح\n\n`
  } else {
    message += `📋 المدن المتوفرة تشمل: بغداد، البصرة، أربيل، دهوك، السليمانية، نينوى، كربلاء، النجف، الديوانية، الأنبار، وغيرها\n\n`
  }
  
  message += `💡 أو يمكنك كتابة المنطقة فقط وسيتم اختيار بغداد تلقائياً\n`
  message += `مثال: الأعظمية\n07710666830\nبرشلونة ازرق ميديم\n\n`
  message += `📋 النص الأصلي: ${originalText}`
  
  await sendTelegramMessage(chatId, message)
  return true
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

// Enhanced order processing with AlWaseet integration and improved city handling
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
      
      // Parse address
      if ((lowerLine.includes('عنوان') || lowerLine.includes('منطقة') || lowerLine.includes('محلة')) && !customerAddress) {
        customerAddress = line.replace(/^(عنوان|منطقة|محلة)[:\s]*/i, '').trim()
      }
      
      // Parse city
      if ((lowerLine.includes('مدينة') || lowerLine.includes('محافظة')) && !cityFound) {
        const cityText = line.replace(/^(مدينة|محافظة)[:\s]*/i, '').trim()
        customerCity = await findCityByName(cityText)
        if (customerCity) {
          const regions = await getRegionsByCity(customerCity.id)
          if (regions.length > 0) customerRegion = regions[0] // Default to first region
          cityFound = true
        }
      }
      
      // Parse delivery type
      if (lowerLine.includes('تبديل') || lowerLine.includes('استبدال')) {
        deliveryType = 'تبديل'
      }
      
      // Parse notes
      if (lowerLine.includes('ملاحظة') || lowerLine.includes('تعليق')) {
        orderNotes = line.replace(/^(ملاحظة|تعليق)[:\s]*/i, '').trim()
      }
      
      // Parse products with enhanced price detection
      if (lowerLine.includes('منتج') || lowerLine.includes('product') || 
          (!phoneFound && !cityFound && !lowerLine.includes('عنوان') && !lowerLine.includes('منطقة') && !lowerLine.includes('محافظة'))) {
        
        // Enhanced product parsing
        let productName = line
        let quantity = 1
        let price = 0
        
        // Remove product prefix if exists
        productName = productName.replace(/^(منتج:?\s*)?/, '').trim()
        
        // Parse different formats:
        // 1. "product x1 5000" or "product 1 5000" or "product, 1, 5000"
        // 2. "product x1" or "product 1"
        // 3. "product 5000"
        // 4. "product"
        
        let matched = false
        
        // Try various parsing patterns
        const patterns = [
          // Name x1 5000 or Name 1 5000 (with separators)
          /^(.+?)[,\s]+[x×]?(\d+)[,\s]+(\d+)$/i,
          // Name, x1, 5000 or similar
          /^(.+?)[,\s][x×]?(\d+)[,\s](\d+)$/i,
          // Name x1 or Name 1 (quantity only)
          /^(.+?)[,\s]+[x×]?(\d+)$/i,
          // Name 5000 (price only, assuming quantity is 1)
          /^(.+?)[,\s]+(\d+)$/i
        ]
        
        for (const pattern of patterns) {
          const match = productName.match(pattern)
          if (match) {
            if (match[3]) { // has price as third group
              productName = match[1].trim()
              quantity = parseInt(match[2]) || 1
              price = parseFloat(match[3]) || 0
            } else if (match[2]) {
              // Check if second group is quantity or price
              const secondValue = parseInt(match[2])
              if (secondValue <= 10) { // likely quantity
                productName = match[1].trim()
                quantity = secondValue || 1
              } else { // likely price
                productName = match[1].trim()
                price = parseFloat(match[2]) || 0
              }
            } else if (match[3]) { // has all three parts
              productName = match[1].trim()
              quantity = parseInt(match[2]) || 1
              price = parseFloat(match[3]) || 0
            } else { // name and price only
              productName = match[1].trim()
              price = parseFloat(match[2]) || 0
            }
            matched = true
            break
          }
        }
          
        
        if (!matched && productName && productName.length > 1) {
          // Default case - just product name
          matched = true
        }
        
        if (matched && productName && productName.length > 1) {
          // Enhanced product search with variants and proper pricing
          let finalPrice = price
          let productId = null
          
          // Enhanced flexible product search with both ة and ه variations
          const searchTerms = createFlexibleSearchTerms(productName)
          console.log(`🔍 Searching for product: "${productName}" with terms:`, searchTerms)
          
          // Build comprehensive search query using normalize_arabic_text function
          const normalizedSearch = normalizeArabic(productName)
          console.log(`🔍 Normalized search term: "${normalizedSearch}" from original: "${productName}"`)
          
          // Use the database function for normalized matching
          const { data: products } = await supabase
            .from('products')
            .select(`
              id, name, base_price, cost_price,
              product_variants (
                id, price, cost_price, color_id, size_id, is_active,
                colors (name),
                sizes (name)
              )
            `)
            .or(`normalize_arabic_text(name).ilike.%${normalizedSearch}%,name.ilike.%${productName}%,name.ilike.%${normalizedSearch.replace(/\s+/g, '%')}%,name.ilike.%${productName.replace(/\s+/g, '%')}%`)
            .eq('is_active', true)
            .limit(15)
          
          console.log(`🔍 Found ${products?.length || 0} products for search: "${productName}"`)
          
          if (products && products.length > 0) {
            // Enhanced smart matching with flexible ة/ه scoring
            let bestMatch = products[0]
            let bestScore = 0
            
            for (const product of products) {
              const normalizedDbName = normalizeArabic(product.name)
              let score = 0
              
              // Test exact matches with all search variations
              for (const searchTerm of searchTerms) {
                const normalizedSearchTerm = normalizeArabic(searchTerm)
                
                if (normalizedDbName === normalizedSearchTerm) {
                  score = Math.max(score, 100)
                } else if (normalizedDbName.includes(normalizedSearchTerm)) {
                  score = Math.max(score, 90)
                } else if (normalizedSearchTerm.includes(normalizedDbName)) {
                  score = Math.max(score, 85)
                }
              }
              
              // Additional scoring for partial word matches
              if (score < 90) {
                const words1 = searchTerms[0].toLowerCase().split(' ')
                const words2 = normalizedDbName.split(' ')
                const commonWords = words1.filter(word => 
                  words2.some(dbWord => dbWord.includes(word) || word.includes(dbWord))
                )
                const partialScore = (commonWords.length / Math.max(words1.length, words2.length)) * 75
                score = Math.max(score, partialScore)
              }
              
              if (score > bestScore) {
                bestScore = score
                bestMatch = product
              }
            }
            
            console.log(`✅ Best match found: "${bestMatch.name}" (score: ${bestScore})`)
            productId = bestMatch.id
            
            // Try to find price from variants first
            if (bestMatch.product_variants && bestMatch.product_variants.length > 0) {
              const activeVariants = bestMatch.product_variants.filter(v => v.is_active)
              if (activeVariants.length > 0) {
                // Use first active variant price
                finalPrice = price || activeVariants[0].price || bestMatch.base_price || 0
              } else {
                finalPrice = price || bestMatch.base_price || 0
              }
            } else {
              finalPrice = price || bestMatch.base_price || 0
            }
            
            console.log(`💰 Final price for "${bestMatch.name}": ${finalPrice} (custom: ${!!price}, from variants: ${!!bestMatch.product_variants?.length})`)
            
            if (price > 0) hasCustomPrice = true
            
            // Add to items
            const existingItem = items.find(item => item.product_id === productId)
            if (existingItem) {
              existingItem.quantity += quantity
            } else {
              items.push({
                product_id: productId,
                name: bestMatch.name,
                quantity,
                price: finalPrice,
                cost_price: bestMatch.cost_price || 0
              })
            }
          } else {
            // Product not found - add as custom item
            console.log(`⚠️ Product not found in database: "${productName}", adding as custom item`)
            const customItem = {
              product_id: null,
              name: productName,
              quantity,
              price: finalPrice,
              cost_price: 0
            }
            
            const existingCustom = items.find(item => item.name === productName && item.product_id === null)
            if (existingCustom) {
              existingCustom.quantity += quantity
            } else {
              items.push(customItem)
            }
          }
        }
      }
    }
    
    // After parsing all lines, try to parse address if not found explicitly
    if (!customerCity || !customerRegion) {
      // Parse address - try full text first, then with extracted details  
      let addressParseResult = null
      
      // Parse with full address or extracted parts
      if (customerAddress) {
        addressParseResult = await parseAddressLine(customerAddress)
      } else {
        // Try to parse address from remaining text analysis
        const potentialAddressParts = []
        for (const line of lines) {
          const lowerLine = line.toLowerCase()
          // Skip lines that are clearly names, phones, or products
          if (!line.match(/07[5789]\d{8}/) && 
              !lowerLine.includes('منتج') && 
              !lowerLine.includes('سعر') &&
              !isValidCustomerName(line.trim()) &&
              line.trim().length > 3) {
            potentialAddressParts.push(line.trim())
          }
        }
        
        if (potentialAddressParts.length > 0) {
          addressParseResult = await parseAddressLine(potentialAddressParts.join(' '))
        }
      }
      
      if (addressParseResult) {
        customerCity = addressParseResult.city
        
        // تنبيه المستخدم إذا تم اختيار مدينة افتراضية
        if (addressParseResult.defaultCityUsed && customerCity) {
          await sendTelegramMessage(chatId, 
            `🏙️ تم اختيار ${customerCity.name} كمدينة افتراضية. إذا كانت مدينة أخرى، يرجى إعادة كتابة الطلب مع تحديد المدينة الصحيحة.`
          )
        }
        
        if (addressParseResult.regions.length === 1) {
          customerRegion = addressParseResult.regions[0]
          if (addressParseResult.remainingText) {
            customerAddress = addressParseResult.remainingText
          }
        } else if (addressParseResult.regions.length > 1) {
          // Multiple regions found - ask user to clarify
          pendingOrders.set(chatId, {
            customerName: customerName || defaultCustomerName,
            customerPhone,
            customerSecondaryPhone,
            customerAddress: customerAddress || addressParseResult.remainingText,
            items,
            totalPrice,
            deliveryType,
            orderNotes,
            regions: addressParseResult.regions,
            remainingText: addressParseResult.remainingText
          })
          
          await sendRegionSelectionMenu(chatId, customerCity.name, addressParseResult.regions, text)
          return true
        }
      } else {
        // إذا لم يتم العثور على مدينة صالحة في النص، إرسال رسالة خطأ
        const firstLine = lines.find(line => line.trim() && !line.match(/07[5789]\d{8}/))
        if (firstLine) {
          await sendCityErrorMessage(chatId, firstLine.trim(), text)
          return false
        }
      }
    }
    
    // Calculate total
    totalPrice = items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    
    // Validation
    if (!customerPhone) {
      await sendTelegramMessage(chatId, '❌ رقم الهاتف مطلوب. يرجى تضمين رقم هاتف صحيح (07xxxxxxxx)')
      return false
    }
    
    if (items.length === 0) {
      await sendTelegramMessage(chatId, '❌ لم يتم العثور على منتجات في الطلب. يرجى إضافة منتج واحد على الأقل')
      return false
    }
    
    // تعيين اسم افتراضي إذا لم يكن موجود
    if (!customerName) {
      customerName = defaultCustomerName
    }
    
    console.log('📦 Order summary before saving:', {
      customerName,
      customerPhone,
      customerSecondaryPhone,
      customerCity: customerCity?.name,
      customerRegion: customerRegion?.name,
      customerAddress,
      items: items.length,
      totalPrice,
      hasCustomPrice,
      deliveryType,
      orderNotes
    })
    
    // Create order confirmation message
    const employeeInfo = employee ? 
      `${employee.full_name} (${employee.role}) - ${employee.employee_code}` : 
      `@${employee.employee_code}`
      
    const orderSummary = `
🔹 تأكيد الطلب الجديد 🔹

👤 العميل: ${customerName}
📱 الهاتف: ${customerPhone}${customerSecondaryPhone ? `\n📱 الهاتف الثاني: ${customerSecondaryPhone}` : ''}
🏙️ المدينة: ${customerCity?.name || 'غير محدد'}
📍 المنطقة: ${customerRegion?.name || 'غير محدد'}
🏠 العنوان: ${customerAddress}

📦 المنتجات:
${items.map(item => `• ${item.name} - كمية: ${item.quantity} - سعر: ${item.price.toLocaleString()} د.ع`).join('\n')}

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
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_secondary_phone: customerSecondaryPhone,
        customer_address: customerAddress,
        customer_city: customerCity?.name,
        customer_region: customerRegion?.name,
        items: items,
        total_price: totalPrice,
        delivery_fee: defaultDeliveryFee,
        final_total: totalPrice + defaultDeliveryFee,
        delivery_type: deliveryType,
        order_notes: orderNotes,
        telegram_chat_id: chatId,
        processed_at: new Date().toISOString(),
        original_text: text
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
    console.error('Error processing AlWaseet order:', error)
    await sendTelegramMessage(chatId, '❌ حدث خطأ في معالجة الطلب. يرجى المحاولة مرة أخرى أو التواصل مع الإدارة.')
    return false
  }
}

// Main handler
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message } = await req.json() as TelegramUpdate;

    if (!message) {
      return new Response('No message found', { status: 400, headers: corsHeaders });
    }

    const chatId = message.chat.id;
    const text = message.text;

    console.log(`📨 Received message from ${chatId}: ${text}`);

    // Check if user is registered
    const { data: employee } = await supabase.rpc('get_employee_by_telegram_id', { 
      p_telegram_chat_id: chatId 
    });

    if (!employee || employee.length === 0) {
      await sendTelegramMessage(chatId, 
        '❌ غير مسموح لك باستخدام هذا البوت. يرجى التواصل مع الإدارة لتسجيل حسابك.'
      );
      return new Response('Unauthorized', { status: 403, headers: corsHeaders });
    }

    const emp = employee[0];
    console.log(`👤 Employee: ${emp.full_name} (${emp.employee_code})`);

    // Check for region selection
    if (text.match(/المنطقة:\s*(.+)/i)) {
      const processed = await processRegionSelection(text, chatId);
      if (processed) {
        return new Response('Region selected and order processed', { headers: corsHeaders });
      }
    }

    // Process order
    const success = await processOrderWithAlWaseet(text, chatId, emp.employee_code);
    
    if (success) {
      return new Response('Order processed successfully', { headers: corsHeaders });
    } else {
      return new Response('Order processing failed', { status: 400, headers: corsHeaders });
    }

  } catch (error) {
    console.error('Error:', error);
    return new Response('Internal Server Error', { status: 500, headers: corsHeaders });
  }
});