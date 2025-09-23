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

// Enhanced Arabic text normalization for superior matching capabilities
function normalizeArabic(text: string): string {
  if (!text) return ''
  
  return text.toString().trim()
    // Remove common prefixes and suffixes
    .replace(/^(ال|محافظة|مدينة|قضاء|ناحية)\s+/g, '')
    .replace(/\s+(محافظة|قضاء|ناحية)$/g, '')
    // Enhanced Arabic letter normalization
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ةه]/g, 'ه')
    .replace(/[يى]/g, 'ي')
    .replace(/[ؤ]/g, 'و')
    .replace(/[ئ]/g, 'ي')
    .replace(/[ء]/g, '')
    // Handle diacritics completely
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    // Remove extra spaces and punctuation
    .replace(/[.,،؛:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

// Calculate string similarity for fuzzy matching
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1
  
  if (longer.length === 0) return 1.0
  
  // Exact match
  if (longer === shorter) return 1.0
  
  // Contains check
  if (longer.includes(shorter) || shorter.includes(longer)) {
    return 0.8 + (shorter.length / longer.length) * 0.2
  }
  
  // Levenshtein distance
  const matrix = Array(longer.length + 1).fill(null).map(() => Array(shorter.length + 1).fill(null))
  
  for (let i = 0; i <= longer.length; i++) matrix[i][0] = i
  for (let j = 0; j <= shorter.length; j++) matrix[0][j] = j
  
  for (let i = 1; i <= longer.length; i++) {
    for (let j = 1; j <= shorter.length; j++) {
      const cost = longer[i - 1] === shorter[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }
  
  const distance = matrix[longer.length][shorter.length]
  return 1.0 - (distance / longer.length)
}

// Fixed comprehensive city name variations with correct structure  
const cityNameVariations: { [standardName: string]: string[] } = {
  'الديوانية': ['ديوانية', 'الديوانية', 'ديوانيه', 'الديوانيه', 'القادسية', 'القادسيه', 'قادسية', 'qadisiyah', 'diwaniyah'],
  'بغداد': ['بغداد', 'Baghdad', 'baghdad', 'بغدد', 'بقداد'],
  'البصرة': ['البصره', 'بصرة', 'بصره', 'البصرة', 'basrah', 'basra'],
  'اربيل': ['أربيل', 'اربيل', 'أربيل', 'اربل', 'Erbil', 'erbil', 'هولير'],
  'دهوك': ['دهوك', 'دهك', 'Dohuk', 'dohuk', 'dahuk'],
  'كربلاء': ['كربلاء', 'كربلا', 'كربله', 'Karbala', 'karbala'],
  'النجف': ['النجف', 'نجف', 'نجاف', 'Najaf', 'najaf'],
  'نينوى': ['نينوى', 'نينوا', 'الموصل', 'موصل', 'نينوه', 'Nineveh', 'nineveh', 'mosul'],
  'صلاح الدين': ['صلاح الدين', 'صلاحدين', 'تكريت', 'تكرت', 'salahuddin', 'tikrit'],
  'الأنبار': ['الأنبار', 'الانبار', 'انبار', 'أنبار', 'الرمادي', 'رمادي', 'anbar', 'ramadi'],
  'بابل': ['بابل', 'الحلة', 'حلة', 'حله', 'babylon', 'hillah', 'hilla'],
  'واسط': ['واسط', 'الكوت', 'كوت', 'كت', 'Wasit', 'wasit', 'kut'],
  'ذي قار': ['ذي قار', 'ذيقار', 'الناصرية', 'ناصرية', 'ناصريه', 'thi qar', 'nasiriyah'],
  'المثنى': ['المثنى', 'مثنى', 'السماوة', 'سماوة', 'سماوه', 'muthanna', 'samawah'],
  'ميسان': ['ميسان', 'العمارة', 'عمارة', 'عماره', 'Maysan', 'maysan', 'amarah'],
  'كركوك': ['كركوك', 'كركك', 'Kirkuk', 'kirkuk'],
  'السليمانية': ['السليمانية', 'سليمانية', 'سليمانيه', 'Sulaymaniyah', 'sulaymaniyah'],
  'حلبجة': ['حلبجة', 'حلبجه', 'halabja', 'halabcha']
}

// Enhanced city finder with improved variation matching
function findCityByVariation(searchTerm: string): string | null {
  const normalizedSearch = normalizeArabic(searchTerm)
  
  for (const [standardName, variations] of Object.entries(cityNameVariations)) {
    // Check if search matches standard name
    if (normalizeArabic(standardName).includes(normalizedSearch) || 
        normalizedSearch.includes(normalizeArabic(standardName))) {
      return standardName
    }
    
    // Check variations
    for (const variation of variations) {
      const normalizedVariation = normalizeArabic(variation)
      if (normalizedVariation === normalizedSearch || 
          normalizedVariation.includes(normalizedSearch) ||
          normalizedSearch.includes(normalizedVariation)) {
        return standardName
      }
    }
  }
  
  return null
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

// Map to store pending orders temporarily
const pendingOrders = new Map()

// Enhanced product search with variant and inventory checking
async function searchProductWithVariantsAndInventory(line: string, chatId: number, customerPhone?: string): Promise<{
  found: boolean,
  available: boolean,
  product?: any,
  variant?: any,
  stockAlert?: string
}> {
  try {
    console.log(`🔍 البحث المحسن عن المنتج: "${line}"`)
    
    // Parse product details (name, color, size) from the line
    const productDetails = parseProductDetails(line)
    console.log(`📋 تفاصيل المنتج المستخرجة:`, productDetails)
    
    // Search for products using flexible terms
    const searchTerms = createFlexibleSearchTerms(productDetails.name)
    let foundProduct = null
    
    for (const term of searchTerms) {
      const { data: products, error } = await supabase
        .from('products')
        .select(`
          *,
          variants:product_variants(
            *,
            color:colors(id, name),
            size:sizes(id, name),
            inventory(quantity, reserved_quantity, min_stock)
          )
        `)
        .ilike('name', `%${term}%`)
        .eq('is_active', true)
        .limit(1)
      
      if (products && products.length > 0) {
        foundProduct = products[0]
        console.log(`✅ عثر على منتج: "${foundProduct.name}" بالمصطلح "${term}"`)
        break
      }
    }
    
    if (!foundProduct) {
      return { found: false, available: false }
    }
    
    // Find matching variant if color/size specified
    let selectedVariant = null
    if (foundProduct.variants && foundProduct.variants.length > 0) {
      
      // Look for exact color/size match
      for (const variant of foundProduct.variants) {
        const colorMatch = !productDetails.color || 
          normalizeArabic(variant.color?.name || '').includes(normalizeArabic(productDetails.color)) ||
          normalizeArabic(productDetails.color).includes(normalizeArabic(variant.color?.name || ''))
        
        const sizeMatch = !productDetails.size || 
          normalizeArabic(variant.size?.name || '').includes(normalizeArabic(productDetails.size)) ||
          normalizeArabic(productDetails.size).includes(normalizeArabic(variant.size?.name || ''))
        
        if (colorMatch && sizeMatch) {
          selectedVariant = variant
          console.log(`✅ متغير مطابق: ${variant.color?.name} ${variant.size?.name}`)
          break
        }
      }
      
      // If no exact match but we have a color/size requirement, check availability and send alert
      if (!selectedVariant && (productDetails.color || productDetails.size)) {
        console.log(`❌ لم يتم العثور على متغير مطابق للـ ${productDetails.color} ${productDetails.size}`)
        
        // Generate stock alert for unavailable variant
        const phone = customerPhone || await extractPhoneFromContext(chatId)
        const stockAlert = generateStockAlert(foundProduct, productDetails, phone)
        
        return {
          found: true,
          available: false,
          product: foundProduct,
          stockAlert: stockAlert
        }
      }
      
      // If no color/size specified, pick first available variant
      if (!selectedVariant) {
        selectedVariant = foundProduct.variants.find(v => 
          v.inventory && v.inventory.length > 0 && v.inventory[0].quantity > 0
        ) || foundProduct.variants[0]
      }
    }
    
    // Check inventory availability
    let isAvailable = true
    let stockQuantity = 0
    
    if (selectedVariant && selectedVariant.inventory && selectedVariant.inventory.length > 0) {
      const inventory = selectedVariant.inventory[0]
      stockQuantity = inventory.quantity - (inventory.reserved_quantity || 0)
      isAvailable = stockQuantity > 0
      
      console.log(`📦 المخزون: الكمية ${inventory.quantity}, المحجوز ${inventory.reserved_quantity}, المتاح ${stockQuantity}`)
    }
    
    // If not available, generate stock alert
    if (!isAvailable) {
      const phone = customerPhone || await extractPhoneFromContext(chatId)
      const stockAlert = generateStockAlert(foundProduct, productDetails, phone, selectedVariant)
      
      return {
        found: true,
        available: false,
        product: foundProduct,
        variant: selectedVariant,
        stockAlert: stockAlert
      }
    }
    
    return {
      found: true,
      available: true,
      product: foundProduct,
      variant: selectedVariant ? {
        ...selectedVariant,
        stock: stockQuantity
      } : null
    }
    
  } catch (error) {
    console.error('❌ خطأ في البحث المحسن عن المنتج:', error)
    return { found: false, available: false }
  }
}

// Parse product details (name, color, size) from text
function parseProductDetails(text: string): { name: string, color?: string, size?: string } {
  const normalizedText = text.trim()
  
  // Common colors in Arabic and English
  const colors = [
    'احمر', 'أحمر', 'red', 'ازرق', 'أزرق', 'blue', 'اصفر', 'أصفر', 'yellow',
    'اخضر', 'أخضر', 'green', 'اسود', 'أسود', 'black', 'ابيض', 'أبيض', 'white',
    'وردي', 'pink', 'بنفسجي', 'purple', 'برتقالي', 'orange', 'بني', 'brown',
    'رمادي', 'gray', 'grey', 'سمائي', 'فيروزي', 'turquoise', 'ذهبي', 'gold',
    'فضي', 'silver', 'كحلي', 'navy', 'زهري', 'بيج', 'beige'
  ]
  
  // Common sizes with Arabic mappings
  const sizeMap = {
    'اكس سمول': 'xs', 'اكس اس': 'xs', 'xs': 'xs', 'x-small': 'xs',
    'سمول': 's', 'صغير': 's', 's': 's', 'small': 's',
    'ميديم': 'm', 'متوسط': 'm', 'وسط': 'm', 'm': 'm', 'medium': 'm',
    'لارج': 'l', 'كبير': 'l', 'l': 'l', 'large': 'l',
    'اكس لارج': 'xl', 'اكس ال': 'xl', 'xl': 'xl', 'x-large': 'xl',
    'اكس اكس لارج': 'xxl', 'اكس اكس ال': 'xxl', 'xxl': 'xxl', '2xl': 'xxl',
    'اكس اكس اكس لارج': 'xxxl', 'xxxl': 'xxxl', '3xl': 'xxxl'
  }
  const sizes = Object.keys(sizeMap)
  
  let foundColor = null
  let foundSize = null
  let productName = normalizedText
  
  // Extract color
  for (const color of colors) {
    const regex = new RegExp(`\\b${color}\\b`, 'gi')
    if (regex.test(normalizedText)) {
      foundColor = color
      productName = productName.replace(regex, '').trim()
      break
    }
  }
  
  // Extract size with Arabic support
  for (const size of sizes) {
    const regex = new RegExp(`\\b${size}\\b`, 'gi')
    if (regex.test(productName)) {
      foundSize = sizeMap[size.toLowerCase()] || size
      productName = productName.replace(regex, '').trim()
      break
    }
  }
  
  // Clean up product name
  productName = productName.replace(/\s+/g, ' ').trim()
  
  return {
    name: productName,
    color: foundColor,
    size: foundSize
  }
}

// Extract phone number from recent messages context
async function extractPhoneFromContext(chatId: number): Promise<string> {
  // Try to get phone from pending orders map first
  const pendingOrder = pendingOrders.get(chatId)
  if (pendingOrder && pendingOrder.customerPhone) {
    return pendingOrder.customerPhone
  }
  
  // Fallback to a placeholder
  return '07xxxxxxxx'
}

// Generate stock alert message like the example provided
function generateStockAlert(product: any, details: any, phone: string, variant?: any): string {
  const productName = product.name
  const colorText = details.color ? details.color : 'بدون لون'
  const sizeText = details.size ? details.size : ''
  
  return `⚠️ تنبيه توفر
📱 الهاتف : ${phone}
❌ غير متاح ${productName} ${colorText} ${sizeText} × 1 — بدون لون

⚠️ بعض المنتجات غير متوفرة حالياً أو محجوزة. الرجاء اختيار بديل داخل الموقع قبل الموافقة`
}

// Smart city finder using cache system with fuzzy matching
async function findCityByNameSmart(cityName: string): Promise<{ city: any | null, suggestions: any[], confidence: number }> {
  try {
    // Use the smart cache system for primary search
    const { data: cityMatches, error } = await supabase.rpc('find_city_in_cache', {
      p_city_text: cityName
    })
    
    if (!error && cityMatches && cityMatches.length > 0) {
      const bestMatch = cityMatches[0]
      if (bestMatch.similarity_score >= 0.7) {
        console.log(`🏙️ وجدت مدينة ذكية: ${bestMatch.name} (${bestMatch.similarity_score})`)
        return { 
          city: { id: bestMatch.alwaseet_id, name: bestMatch.name, original_id: bestMatch.alwaseet_id }, 
          suggestions: [], 
          confidence: bestMatch.similarity_score 
        }
      }
    }
    
    // Fallback to local cache
    const cities = await getCitiesFromCache()
    const normalizedName = normalizeArabic(cityName)
    
    if (!cities.length) {
      return { city: null, suggestions: [], confidence: 0 }
    }
    
    let bestCity = null
    let bestScore = 0
    const allMatches = []
    
    // Direct and variation matching with scoring
    for (const city of cities) {
      const cityNormalized = normalizeArabic(city.name)
      let score = calculateSimilarity(normalizedName, cityNormalized)
      
      // Check variations with improved logic
      const foundCity = findCityByVariation(cityName)
      if (foundCity) {
        const standardNormalized = normalizeArabic(foundCity)
        if (cityNormalized.includes(standardNormalized) || standardNormalized.includes(cityNormalized)) {
          score = Math.max(score, 0.95)
        }
      }
      
      if (score >= 0.7) {
        allMatches.push({ city, score })
        if (score > bestScore) {
          bestScore = score
          bestCity = city
        }
      } else if (score >= 0.5) {
        // Lower confidence suggestions
        allMatches.push({ city, score })
      }
    }
    
    // Sort matches by score
    allMatches.sort((a, b) => b.score - a.score)
    const suggestions = allMatches.slice(1, 4) // Top 3 alternatives
    
    return { 
      city: bestCity, 
      suggestions: suggestions.map(m => m.city), 
      confidence: bestScore 
    }
  } catch (error) {
    console.error('Error in smart city search:', error)
    return { city: null, suggestions: [], confidence: 0 }
  }
}

// Parse address to extract city, region, and address details with smart matching
async function parseAddressWithSmartMatching(addressText: string): Promise<{
  city: any | null,
  region: any | null,
  fullAddress: string,
  confidence: number
}> {
  try {
    console.log(`🏠 محاولة تحليل العنوان: "${addressText}"`)
    
    // Split the address into parts
    const addressParts = addressText.split(/[,،\n]/).map(part => part.trim()).filter(Boolean)
    
    let foundCity = null
    let foundRegion = null
    let confidence = 0
    let remainingAddress = addressText
    
    // Try to identify city from address parts
    for (const part of addressParts) {
      const cityResult = await findCityByNameSmart(part)
      if (cityResult.city && cityResult.confidence > confidence) {
        foundCity = cityResult.city
        confidence = cityResult.confidence
        remainingAddress = remainingAddress.replace(part, '').trim()
        console.log(`🏙️ تم تحديد المدينة: ${foundCity.name} (${confidence})`)
        break
      }
    }
    
    // If city found, try to find region
    if (foundCity) {
      const regions = await getRegionsByCity(foundCity.id)
      
      for (const part of addressParts) {
        const normalizedPart = normalizeArabic(part)
        
        for (const region of regions) {
          const regionNormalized = normalizeArabic(region.name)
          const similarity = calculateSimilarity(normalizedPart, regionNormalized)
          
          if (similarity >= 0.7) {
            foundRegion = region
            remainingAddress = remainingAddress.replace(part, '').trim()
            console.log(`🗺️ تم تحديد المنطقة: ${region.name} (${similarity})`)
            break
          }
        }
        
        if (foundRegion) break
      }
    }
    
    // Clean up remaining address
    remainingAddress = remainingAddress
      .replace(/[,،]+/g, ', ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^[,،\s]+|[,،\s]+$/g, '')
    
    return {
      city: foundCity,
      region: foundRegion,
      fullAddress: remainingAddress || addressText,
      confidence
    }
  } catch (error) {
    console.error('Error parsing address:', error)
    return {
      city: null,
      region: null,
      fullAddress: addressText,
      confidence: 0
    }
  }
}

// Get employee information by telegram chat ID with fallback methods
async function getEmployeeByTelegramId(chatId: number) {
  try {
    console.log(`🔍 البحث عن موظف بـ chat ID: ${chatId}`)
    
    // Use the new RPC function
    const { data, error } = await supabase.rpc('find_employee_by_telegram_chat_id', {
      p_chat_id: chatId
    })
    
    if (!error && data?.success) {
      console.log(`👤 تم العثور على موظف: ${data.employee_code} - ${data.full_name}`)
      return {
        employee_code: data.employee_code,
        full_name: data.full_name,
        user_id: data.user_id,
        telegram_chat_id: data.chat_id,
        role_title: 'موظف', // Default role
        is_active: true
      }
    }
    
    console.log('❌ لم يتم العثور على موظف للـ chat ID:', chatId)
    return null
  } catch (error) {
    console.error('❌ خطأ في البحث عن الموظف:', error)
    return null
  }
}

// Link employee code to telegram chat ID
async function linkEmployeeCode(employeeCode: string, chatId: number): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('link_employee_telegram_code', {
      p_employee_code: employeeCode,
      p_chat_id: chatId
    })
    
    if (!error && data?.success) {
      console.log('Successfully linked employee code:', employeeCode)
      return true
    }
    
    console.error('Failed to link employee code:', error || data?.message)
    return false
  } catch (error) {
    console.error('Error linking employee code:', error)
    return false
  }
}

// Process order text and save to ai_orders (updated to work with new function)
async function processOrderText(text: string, chatId: number, employeeData: any): Promise<boolean> {
  try {
    console.log(`📝 معالجة نص الطلب: "${text}"`)
    console.log(`👤 بيانات الموظف:`, employeeData)
    
    const lines = text.split('\n').filter(line => line.trim())
    
    if (lines.length < 2) {
      console.log('❌ الطلب قصير جداً - يحتاج على الأقل سطرين')
      await sendTelegramMessage(chatId, `❌ الطلب يحتاج على الأقل سطرين: معلومات الزبون والمنتجات

📝 مثال صحيح:
أحمد علي
07712345678
ديوانية غماس
برشلونة ازرق لارج`)
      return false
    }
    
    // Extract customer information
    let customerName = ''
    let customerPhone = ''
    let customerAddress = ''
    let customerCity = ''
    let products: any[] = []
    
    // Parse each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      // Phone number pattern
      if (/^0?7[5-9]\d{8}$/.test(line.replace(/[\s-]/g, ''))) {
        customerPhone = line.replace(/[\s-]/g, '')
        continue
      }
      
      // If it's the first line and no phone found yet, assume it's customer name
      if (i === 0 && !customerName && !/^0?7[5-9]\d{8}$/.test(line)) {
        customerName = line
        continue
      }
      
      // Check if it's a product line (has arabic letters and possibly size/color info)
      if (/[ا-ي]/.test(line) && (line.includes('L') || line.includes('M') || line.includes('S') || line.includes('XL') || /\b(احمر|ازرق|اسود|ابيض|اخضر|اصفر|وردي|بني|رمادي)\b/.test(line))) {
        // This looks like a product
        const productSearch = await searchProductWithVariantsAndInventory(line, chatId, customerPhone)
        
        if (productSearch.found) {
          if (productSearch.available && productSearch.product) {
            products.push({
              name: productSearch.product.name,
              color: productSearch.variant?.color?.name || 'افتراضي',
              size: productSearch.variant?.size?.name || 'افتراضي',
              quantity: 1,
              price: productSearch.product.price || 0
            })
          } else if (productSearch.stockAlert) {
            // Send stock alert
            await sendTelegramMessage(chatId, productSearch.stockAlert)
            return false
          }
        }
        continue
      }
      
      // Everything else is address information
      if (!customerAddress) {
        customerAddress = line
        
        // Try to parse city from address
        const addressInfo = await parseAddressWithSmartMatching(line)
        if (addressInfo.city) {
          customerCity = addressInfo.city.name
        }
      } else {
        customerAddress += ' ' + line
      }
    }
    
    // Validate required fields
    if (!customerName) {
      customerName = employeeData.full_name || 'زبون من التليغرام'
    }
    
    if (!customerPhone || products.length === 0) {
      console.log('❌ بيانات ناقصة - لا يوجد هاتف أو منتجات')
      await sendTelegramMessage(chatId, `❌ الطلب يحتاج على الأقل سطرين: معلومات الزبون والمنتجات

📝 مثال صحيح:
أحمد علي
07712345678
ديوانية غماس
برشلونة ازرق لارج`)
      return false
    }
    
    // Calculate total amount
    const totalAmount = products.reduce((sum, product) => sum + (product.price * product.quantity), 0)
    
    // Create order data structure
    const orderData = {
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_address: customerAddress,
      customer_city: customerCity,
      delivery_type: 'توصيل',
      items: products,
      total_amount: totalAmount,
      source: 'telegram',
      employee_code: employeeData.employee_code
    }
    
    console.log(`📋 بيانات الطلب النهائية:`, orderData)
    
    // Call the process_telegram_order function with the correct parameters
    const { data: result, error } = await supabase.rpc('process_telegram_order', {
      p_order_text: text,
      p_chat_id: chatId,
      p_employee_code: employeeData.employee_code
    })
    
    if (error) {
      console.error('❌ خطأ في استدعاء process_telegram_order:', error)
      await sendTelegramMessage(chatId, '❌ حدث خطأ في حفظ الطلب في النظام. يرجى المحاولة مرة أخرى.')
      return false
    }
    
    if (result?.success) {
      console.log('✅ تم إنشاء الطلب الذكي بنجاح')
      await sendTelegramMessage(chatId, `✅ تم استلام طلبك بنجاح!
      
👤 العميل: ${customerName}
📱 الهاتف: ${customerPhone}
📍 العنوان: ${customerAddress}
📦 المنتجات: ${products.length} قطعة
💰 المبلغ الإجمالي: ${totalAmount.toLocaleString()} دينار

سيتم مراجعة الطلب والتواصل معك قريباً.`)
      return true
    } else {
      console.log('❌ فشل في إنشاء الطلب الذكي:', result?.message)
      await sendTelegramMessage(chatId, '❌ حدث خطأ في حفظ الطلب في النظام. يرجى المحاولة مرة أخرى.')
      return false
    }
    
  } catch (error) {
    console.error('❌ خطأ في معالجة نص الطلب:', error)
    await sendTelegramMessage(chatId, '❌ حدث خطأ في حفظ الطلب في النظام. يرجى المحاولة مرة أخرى.')
    return false
  }
}

// Main serve function
serve(async (req) => {
  console.log('🔴 Telegram webhook called!')
  console.log('Request URL:', req.url)
  console.log('Request method:', req.method)

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const update: TelegramUpdate = await req.json()
    console.log('Received update:', JSON.stringify(update, null, 2))

    if (!update.message?.text) {
      return new Response('OK', { status: 200, headers: corsHeaders })
    }

    const chatId = update.message.chat.id
    const messageText = update.message.text.trim()

    console.log(`Processing message from chatId: ${chatId}, text: "${messageText}"`)

    // Check if user is linked
    const employee = await getEmployeeByTelegramId(chatId)

    if (!employee) {
      // User not linked - try to link with employee code
      const codePattern = /^[A-Z]{3}\d{3,4}$/i
      if (codePattern.test(messageText)) {
        const success = await linkEmployeeCode(messageText.toUpperCase(), chatId)
        if (success) {
          const newEmployee = await getEmployeeByTelegramId(chatId)
          if (newEmployee) {
            await sendTelegramMessage(chatId, `✅ تم ربط حسابك بنجاح!
            
👤 اسم الموظف: ${newEmployee.full_name}
🏢 المنصب: ${newEmployee.role_title}
🆔 كود الموظف: ${newEmployee.employee_code}

يمكنك الآن إرسال الطلبات. استخدم الصيغة التالية:
اسم العميل
رقم الهاتف
العنوان
اسم المنتج + اللون + المقاس`)
          }
        } else {
          await sendTelegramMessage(chatId, `❌ كود الموظف غير صحيح: ${messageText}
          
الرجاء التأكد من الكود والمحاولة مرة أخرى.`)
        }
      } else {
        await sendTelegramMessage(chatId, `مرحباً! 👋

للبدء، يرجى إرسال كود الموظف الخاص بك.
مثال: ABC123

إذا لم تملك كود موظف، يرجى التواصل مع الإدارة.`)
      }
      
      return new Response('OK', { status: 200, headers: corsHeaders })
    }

    console.log('Employee found:', employee)
    console.log(`Processing order for employee: ${employee.employee_code}`)
    console.log(`📝 الاسم الافتراضي للزبون: ${employee.full_name}`)

    // Handle commands
    if (messageText === '/start' || messageText === '/help') {
      await sendTelegramMessage(chatId, `مرحباً ${employee.full_name}! 👋

يمكنك إرسال الطلبات بالصيغة التالية:
اسم العميل
رقم الهاتف
العنوان
اسم المنتج + اللون + المقاس

مثال:
أحمد علي
07712345678
ديوانية غماس
برشلونة ازرق لارج`)
      
      return new Response('OK', { status: 200, headers: corsHeaders })
    }

    if (messageText === '/stats') {
      // Get employee stats
      const { data: stats } = await supabase
        .from('ai_orders')
        .select('id, status, created_at')
        .eq('created_by', employee.employee_code)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

      const totalOrders = stats?.length || 0
      const processedOrders = stats?.filter(o => o.status === 'processed').length || 0
      const pendingOrders = stats?.filter(o => o.status === 'pending').length || 0

      await sendTelegramMessage(chatId, `📊 إحصائياتك خلال آخر 30 يوم:

📦 إجمالي الطلبات: ${totalOrders}
✅ طلبات معالجة: ${processedOrders}
⏳ طلبات في الانتظار: ${pendingOrders}`)
      
      return new Response('OK', { status: 200, headers: corsHeaders })
    }

    // Process as order
    const success = await processOrderText(messageText, chatId, employee)
    
    if (!success) {
      console.log('🚨 إرسال رسالة خطأ: incomplete_order')
    }

    return new Response('OK', { status: 200, headers: corsHeaders })

  } catch (error) {
    console.error('❌ خطأ في معالجة webhook:', error)
    return new Response('Internal Server Error', { 
      status: 500, 
      headers: corsHeaders 
    })
  }
})