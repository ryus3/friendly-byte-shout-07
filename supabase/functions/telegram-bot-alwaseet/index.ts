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
  
  // Common sizes
  const sizes = ['xs', 'x-small', 's', 'small', 'm', 'medium', 'l', 'large', 'xl', 'x-large', 'xxl', '2xl', 'xxxl', '3xl']
  
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
  
  // Extract size
  for (const size of sizes) {
    const regex = new RegExp(`\\b${size}\\b`, 'gi')
    if (regex.test(productName)) {
      foundSize = size
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
  const colorText = details.color ? `(${details.color})` : ''
  const sizeText = details.size ? details.size : ''
  
  const stockStatus = variant && variant.inventory?.[0]?.quantity === 0 ? 
    'نافذ من المخزون' : 'غير متوفر'
  
  return `⚠️ تنبيه توفر
📱 الهاتف : ${phone}
❌ غير متاح ${productName} ${colorText} ${sizeText} × 1 — المقاس ${sizeText} واللون ${details.color || 'المحدد'} ${stockStatus}

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
    
    if (bestCity && bestScore >= 0.7) {
      console.log(`✅ عثر على مدينة: ${cityName} → ${bestCity.name} (${bestScore.toFixed(2)})`)
      return { city: bestCity, suggestions: [], confidence: bestScore }
    }
    
    // Return suggestions if no good match
    const suggestions = allMatches
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(m => m.city)
    
    return { city: null, suggestions, confidence: bestScore }
    
  } catch (error) {
    console.error('خطأ في البحث الذكي عن المدينة:', error)
    return { city: null, suggestions: [], confidence: 0 }
  }
}

// Comprehensive neighborhood to city mapping for smart default city detection
const neighborhoodToCityMap: { [key: string]: string } = {
  // بغداد - شامل جميع الأحياء الرئيسية
  'الاعظمية': 'بغداد', 'اعظمية': 'بغداد',
  'الكرادة': 'بغداد', 'كرادة': 'بغداد', 'كراده': 'بغداد',
  'الدورة': 'بغداد', 'دورة': 'بغداد', 'دوره': 'بغداد',
  'المنصور': 'بغداد', 'منصور': 'بغداد',
  'الكاظمية': 'بغداد', 'كاظمية': 'بغداد', 'كاظميه': 'بغداد',
  'الشعلة': 'بغداد', 'شعلة': 'بغداد', 'شعله': 'بغداد',
  'الجهاد': 'بغداد', 'جهاد': 'بغداد', 'حي الجهاد': 'بغداد',
  'البياع': 'بغداد', 'بياع': 'بغداد',
  'الغدير': 'بغداد', 'غدير': 'بغداد',
  'الزعفرانية': 'بغداد', 'زعفرانية': 'بغداد', 'زعفرانيه': 'بغداد',
  'النهروان': 'بغداد', 'نهروان': 'بغداد',
  'ابو غريب': 'بغداد', 'أبو غريب': 'بغداد',
  'التاجي': 'بغداد', 'تاجي': 'بغداد',
  'الحرية': 'بغداد', 'حرية': 'بغداد', 'حريه': 'بغداد',
  'الرسالة': 'بغداد', 'رسالة': 'بغداد', 'رساله': 'بغداد',
  'الشعب': 'بغداد', 'شعب': 'بغداد',
  'الصدر': 'بغداد', 'صدر': 'بغداد', 'مدينة الصدر': 'بغداد',
  'الثورة': 'بغداد', 'ثورة': 'بغداد', 'ثوره': 'بغداد',
  'المسبح': 'بغداد', 'مسبح': 'بغداد',
  'الكفاح': 'بغداد', 'كفاح': 'بغداد',
  'الجامعة': 'بغداد', 'جامعة': 'بغداد', 'جامعه': 'بغداد', 'حي الجامعة': 'بغداد',
  'العامرية': 'بغداد', 'عامرية': 'بغداد', 'عامريه': 'بغداد',
  'الدولعي': 'بغداد', 'دولعي': 'بغداد',
  'الجزائر': 'بغداد', 'جزائر': 'بغداد',
  'البيجية': 'بغداد', 'بيجية': 'بغداد', 'بيجيه': 'بغداد',
  'المشتل': 'بغداد', 'مشتل': 'بغداد',
  'الشلجية': 'بغداد', 'شلجية': 'بغداد', 'شلجيه': 'بغداد',
  'الكاتب': 'بغداد', 'كاتب': 'بغداد',
  'البلديات': 'بغداد', 'بلديات': 'بغداد',
  'الجادرية': 'بغداد', 'جادرية': 'بغداد', 'جادريه': 'بغداد',
  'الزوراء': 'بغداد', 'زوراء': 'بغداد',
  'الاندلس': 'بغداد', 'اندلس': 'بغداد', 'أندلس': 'بغداد',
  'العدل': 'بغداد', 'عدل': 'بغداد', 'حي العدل': 'بغداد',
  'الصالحية': 'بغداد', 'صالحية': 'بغداد', 'صالحيه': 'بغداد',
  'الكريمات': 'بغداد', 'كريمات': 'بغداد',
  'الرصافة': 'بغداد', 'رصافة': 'بغداد', 'رصافه': 'بغداد',
  'الكرخ': 'بغداد', 'كرخ': 'بغداد',
  'الأطباء': 'بغداد', 'اطباء': 'بغداد', 'أطباء': 'بغداد', 'حي الأطباء': 'بغداد',
  
  // البصرة
  'العشار': 'البصرة', 'عشار': 'البصرة',
  'المعقل': 'البصرة', 'معقل': 'البصرة',
  'التنومة': 'البصرة', 'تنومة': 'البصرة', 'تنومه': 'البصرة',
  'الأسماك': 'البصرة', 'اسماك': 'البصرة', 'أسماك': 'البصرة',
  'الفيحاء': 'البصرة', 'فيحاء': 'البصرة',
  'كرمة علي': 'البصرة', 'كرمه علي': 'البصرة',
  'الجمهورية': 'البصرة', 'جمهورية': 'البصرة', 'جمهوريه': 'البصرة',
  
  // أربيل
  'عنكاوا': 'اربيل', 'عنكاوه': 'اربيل',
  'شورش': 'اربيل',
  'باختياري': 'اربيل',
  'قلاوري': 'اربيل',
  
  // كربلاء
  'الحر': 'كربلاء', 'حر': 'كربلاء',
  'الجديدة': 'كربلاء', 'جديدة': 'كربلاء', 'جديده': 'كربلاء',
  
  // النجف
  'الكوفة': 'النجف', 'كوفة': 'النجف', 'كوفه': 'النجف',
  'الحيدرية': 'النجف', 'حيدرية': 'النجف', 'حيدريه': 'النجف',
  
  // الديوانية
  'غماس': 'الديوانية',
  'الدغارة': 'الديوانية', 'دغارة': 'الديوانية',
  'الشافعية': 'الديوانية', 'شافعية': 'الديوانية', 'شافعيه': 'الديوانية',
  'عفك': 'الديوانية',
  'الحمزة': 'الديوانية', 'حمزة': 'الديوانية', 'حمزه': 'الديوانية'
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

// Integrated smart cache address parsing (self-contained)
async function parseAddressWithCacheSmart(addressText: string): Promise<{
  customer_name?: string;
  city_id?: number;
  city_name?: string;
  region_id?: number;
  region_name?: string;
  remaining_text: string;
}> {
  console.log(`🔍 تحليل العنوان بالذكاء الاصطناعي: "${addressText}"`);
  
  // Clean and normalize text
  const cleanedText = addressText
    .replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0621-\u064A\u0660-\u0669a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  console.log(`🧹 النص المنظف: "${cleanedText}"`);

  // Extract customer name (simple pattern)
  const words = cleanedText.split(/\s+/);
  let customerName: string | undefined;
  let textWithoutName = cleanedText;
  
  // Simple name extraction - first Arabic word
  const namePattern = /^([\u0621-\u064A]{2,})/;
  const nameMatch = cleanedText.match(namePattern);
  if (nameMatch && nameMatch[1].length >= 3) {
    customerName = nameMatch[1];
    textWithoutName = words.slice(1).join(' ');
    console.log(`👤 اسم الزبون: ${customerName}`);
  }

  const remainingWords = textWithoutName.split(/\s+/).filter(word => word.length > 1);
  
  let cityMatch: any = null;
  let regionMatch: any = null;
  let usedWordIndices: Set<number> = new Set();

  // Search for city using cache system
  for (let i = 0; i < remainingWords.length; i++) {
    if (usedWordIndices.has(i)) continue;

    // Try single word
    try {
      const { data, error } = await supabase.rpc('find_city_in_cache', {
        p_city_text: remainingWords[i]
      });
      
      if (!error && data && data.length > 0) {
        const bestMatch = data[0];
        if (bestMatch.similarity_score >= 0.7) {
          cityMatch = bestMatch;
          usedWordIndices.add(i);
          console.log(`✅ وجدت مدينة بكلمة واحدة: ${cityMatch.name}`);
          break;
        }
      }
    } catch (e) {
      console.error('خطأ في البحث عن المدينة:', e);
    }

    // Try two words
    if (i < remainingWords.length - 1) {
      const twoWords = `${remainingWords[i]} ${remainingWords[i + 1]}`;
      try {
        const { data, error } = await supabase.rpc('find_city_in_cache', {
          p_city_text: twoWords
        });
        
        if (!error && data && data.length > 0) {
          const bestMatch = data[0];
          if (bestMatch.similarity_score >= 0.7) {
            cityMatch = bestMatch;
            usedWordIndices.add(i);
            usedWordIndices.add(i + 1);
            console.log(`✅ وجدت مدينة بكلمتين: ${cityMatch.name}`);
            break;
          }
        }
      } catch (e) {
        console.error('خطأ في البحث عن المدينة:', e);
      }
    }
  }

  // Search for region if city found
  if (cityMatch) {
    const remainingWordsFiltered = remainingWords.filter((_, index) => !usedWordIndices.has(index));
    
    for (let i = 0; i < remainingWordsFiltered.length; i++) {
      // Try different combinations
      for (let wordCount = Math.min(3, remainingWordsFiltered.length - i); wordCount >= 1; wordCount--) {
        const regionCandidate = remainingWordsFiltered.slice(i, i + wordCount).join(' ');
        
        try {
          const { data, error } = await supabase.rpc('find_region_in_cache', {
            p_city_id: cityMatch.alwaseet_id,
            p_region_text: regionCandidate
          });
          
          if (!error && data && data.length > 0) {
            const bestMatch = data[0];
            if (bestMatch.similarity_score >= 0.7) {
              regionMatch = bestMatch;
              // Mark used indices
              for (let j = 0; j < wordCount; j++) {
                const originalIndex = remainingWords.indexOf(remainingWordsFiltered[i + j]);
                if (originalIndex !== -1) usedWordIndices.add(originalIndex);
              }
              console.log(`✅ وجدت منطقة: ${regionMatch.name}`);
              break;
            }
          }
        } catch (e) {
          console.error('خطأ في البحث عن المنطقة:', e);
        }
      }
      if (regionMatch) break;
    }
  }

  // Calculate remaining text
  const finalRemainingWords = remainingWords.filter((_, index) => !usedWordIndices.has(index));
  const remainingText = finalRemainingWords.join(' ').trim();

  const result = {
    customer_name: customerName,
    city_id: cityMatch?.alwaseet_id,
    city_name: cityMatch?.name,
    region_id: regionMatch?.alwaseet_id,
    region_name: regionMatch?.name,
    remaining_text: remainingText || textWithoutName
  };

  console.log('🎯 نتيجة التحليل:', {
    customer_name: result.customer_name,
    city: result.city_name,
    region: result.region_name,
    remaining: result.remaining_text
  });

  return result;
}
// Enhanced smart address parsing using integrated cache system
async function parseAddressLineSmart(addressText: string): Promise<{
  customerName?: string,
  city: any | null,
  region: any | null,
  remainingText: string,
  isDefaultCity: boolean,
  errors: string[],
  suggestions: { cities?: any[], regions?: any[] }
}> {
  console.log(`🧠 تحليل ذكي للعنوان: "${addressText}"`)
  
  if (!addressText || addressText.trim().length === 0) {
    return { 
      city: null, region: null, remainingText: '', isDefaultCity: false, 
      errors: ['لا يوجد نص عنوان صالح'], suggestions: {} 
    }
  }
  
  const errors: string[] = []
  let isDefaultCity = false
  let city = null
  let region = null
  let customerName = ''
  let suggestions: { cities?: any[], regions?: any[] } = {}
  
  try {
    // Use the integrated smart cache system
    const cacheResult = await parseAddressWithCacheSmart(addressText)
    console.log('🎯 نتيجة Cache الذكية:', cacheResult)
    
    customerName = cacheResult.customer_name || ''
    
    if (cacheResult.city_id && cacheResult.city_name) {
      city = { 
        id: cacheResult.city_id, 
        name: cacheResult.city_name, 
        original_id: cacheResult.city_id 
      }
      console.log(`✅ مدينة من Cache: ${city.name}`)
    }
    
    if (cacheResult.region_id && cacheResult.region_name) {
      region = {
        id: cacheResult.region_id,
        name: cacheResult.region_name,
        original_id: cacheResult.region_id
      }
      console.log(`✅ منطقة من Cache: ${region.name}`)
    }
    
    // If no city found via cache, try smart fallback
    if (!city) {
      const addressParts = addressText.split(/[\s،,]+/).filter(Boolean)
      console.log('🔍 أجزاء العنوان:', addressParts)
      
      // Check for neighborhoods to determine default city
      for (const part of addressParts) {
        const normalizedPart = normalizeArabic(part)
        
        for (const [neighborhood, cityName] of Object.entries(neighborhoodToCityMap)) {
          const normalizedNeighborhood = normalizeArabic(neighborhood)
          
          if (normalizedPart.includes(normalizedNeighborhood) || 
              normalizedNeighborhood.includes(normalizedPart) ||
              calculateSimilarity(normalizedPart, normalizedNeighborhood) >= 0.8) {
            
            console.log(`🏘️ اكتشف حي: "${neighborhood}" → مدينة: ${cityName}`)
            
            const defaultCityResult = await findCityByNameSmart(cityName)
            if (defaultCityResult.city) {
              city = defaultCityResult.city
              isDefaultCity = true
              console.log(`✅ استخدام مدينة افتراضية: ${city.name}`)
              break
            }
          }
        }
        if (city) break
      }
      
      // If still no city, try to find from first part
      if (!city && addressParts.length > 0) {
        const firstPartResult = await findCityByNameSmart(addressParts[0])
        
        if (firstPartResult.city && firstPartResult.confidence >= 0.7) {
          city = firstPartResult.city
          console.log(`✅ مدينة من الجزء الأول: ${city.name}`)
        } else if (firstPartResult.suggestions.length > 0) {
          suggestions.cities = firstPartResult.suggestions
          errors.push(`المدينة "${addressParts[0]}" غير واضحة. هل تقصد إحدى هذه المدن؟`)
        }
      }
      
      // Ultimate fallback to Baghdad if region detected but no city
      if (!city && addressParts.length > 0) {
        const baghdadResult = await findCityByNameSmart('بغداد')
        if (baghdadResult.city) {
          city = baghdadResult.city
          isDefaultCity = true
          console.log(`🏙️ استخدام بغداد كافتراضي نهائي`)
        }
      }
    }
    
    // If no region found via cache, try manual search
    if (city && !region) {
      const addressParts = addressText.split(/[\s،,]+/).filter(Boolean)
      const startIndex = isDefaultCity ? 0 : 1 // Skip city name if not default
      
      for (let i = startIndex; i < addressParts.length; i++) {
        for (let j = i; j < Math.min(i + 3, addressParts.length); j++) {
          const regionCandidate = addressParts.slice(i, j + 1).join(' ')
          
          try {
            const { data: regionMatches, error } = await supabase.rpc('find_region_in_cache', {
              p_city_id: city.id,
              p_region_text: regionCandidate
            })
            
            if (!error && regionMatches && regionMatches.length > 0) {
              const bestMatch = regionMatches[0]
              if (bestMatch.similarity_score >= 0.7) {
                region = {
                  id: bestMatch.alwaseet_id,
                  name: bestMatch.name,
                  original_id: bestMatch.alwaseet_id
                }
                console.log(`✅ منطقة من البحث اليدوي: ${region.name}`)
                break
              }
            }
          } catch (e) {
            console.error('خطأ في البحث عن المنطقة:', e)
          }
        }
        if (region) break
      }
      
      if (!region && addressParts.length > (isDefaultCity ? 1 : 2)) {
        const regionText = addressParts.slice(isDefaultCity ? 1 : 1).join(' ')
        errors.push(`لم يتم العثور على منطقة "${regionText}" في مدينة ${city.name}`)
      }
    }
    
    return {
      customerName: customerName || undefined,
      city,
      region,
      remainingText: cacheResult.remaining_text || '',
      isDefaultCity,
      errors,
      suggestions
    }
    
  } catch (error) {
    console.error('❌ خطأ في التحليل الذكي:', error)
    errors.push('حدث خطأ في تحليل العنوان')
    
    return {
      city: null, region: null, remainingText: addressText, 
      isDefaultCity: false, errors, suggestions: {}
    }
  }
}

// Send comprehensive error message with smart suggestions
async function sendEnhancedErrorMessage(
  chatId: number, 
  originalText: string, 
  errors: string[], 
  suggestions: { cities?: any[], regions?: any[] },
  detectedData?: { city?: any, region?: any, isDefaultCity?: boolean }
): Promise<void> {
  let message = `❌ تحليل الطلب:\n\n`
  
  // Show what was detected successfully
  if (detectedData?.city) {
    message += `✅ المدينة: ${detectedData.city.name}`
    if (detectedData.isDefaultCity) {
      message += ` (تم اختيارها تلقائياً)`
    }
    message += `\n`
  }
  
  if (detectedData?.region) {
    message += `✅ المنطقة: ${detectedData.region.name}\n`
  }
  
  // Show errors
  if (errors.length > 0) {
    message += `\n⚠️ مشاكل في الطلب:\n`
    errors.forEach((error, index) => {
      message += `${index + 1}. ${error}\n`
    })
  }
  
  // Show city suggestions
  if (suggestions.cities && suggestions.cities.length > 0) {
    message += `\n🏙️ هل تقصد إحدى هذه المدن؟\n`
    suggestions.cities.slice(0, 5).forEach((city, index) => {
      message += `${index + 1}. ${city.name}\n`
    })
  }
  
  // Show region suggestions  
  if (suggestions.regions && suggestions.regions.length > 0) {
    message += `\n🏘️ مناطق مقترحة:\n`
    suggestions.regions.slice(0, 5).forEach((region, index) => {
      message += `${index + 1}. ${region.name}\n`
    })
  }
  
  message += `\n📝 النص الأصلي:\n${originalText}\n\n`
  
  message += `❗ يرجى إصلاح الأخطاء وإعادة الإرسال!\n\n`
  
  message += `🔧 تنسيق الطلب الصحيح:\n`
  message += `اسم الزبون\n`
  message += `رقم الهاتف (07xxxxxxxxx)\n`
  message += `المدينة المنطقة (أو المنطقة فقط لبغداد)\n`
  message += `اسم المنتج اللون المقاس\n\n`
  
  message += `✨ أمثلة صحيحة:\n\n`
  message += `📝 مثال 1:\n`
  message += `أحمد علي\n`
  message += `07701234567\n`
  if (detectedData?.city && detectedData.city.name !== 'بغداد') {
    message += `${detectedData.city.name} `
    message += detectedData.region ? detectedData.region.name : 'اسم المنطقة'
  } else {
    message += `ديوانية غماس`
  }
  message += `\nبرشلونة أزرق XL\n\n`
  
  message += `📝 مثال 2 (بغداد):\n`
  message += `سارة محمد\n`
  message += `07801234567\n`
  message += `اعظمية\n`
  message += `ريال مدريد أبيض لارج`
  
  console.log('🚨 إرسال رسالة خطأ محسنة:', message)
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
    
    // Save order to database - using RYU559 format
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
      p_telegram_employee_code: employee.employee_code, // This is the RYU559 format code
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
    
    // Enhanced smart parsing of entire order text first
    console.log(`🧠 بدء التحليل الذكي الشامل للطلب`)
    const globalSmartResult = await parseAddressLineSmart(text)
    
    // Use global smart result if we found comprehensive data
    if (globalSmartResult.city && globalSmartResult.customerName) {
      customerName = globalSmartResult.customerName
      customerCity = globalSmartResult.city
      isDefaultCity = globalSmartResult.isDefaultCity
      if (globalSmartResult.region) {
        customerRegion = globalSmartResult.region
      }
      customerAddress = globalSmartResult.remainingText
      
      console.log(`✅ نتيجة التحليل الذكي الشامل:`, {
        name: customerName,
        city: customerCity.name,
        region: customerRegion?.name,
        isDefault: isDefaultCity
      })
      
      if (globalSmartResult.errors.length > 0 && globalSmartResult.suggestions.cities) {
        await sendEnhancedErrorMessage(
          chatId, 
          text, 
          globalSmartResult.errors, 
          globalSmartResult.suggestions,
          { city: customerCity, region: customerRegion, isDefaultCity }
        )
        return true
      }
    }
    
    // Parse order text line by line for additional details
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
      
      // Parse address with enhanced city detection (if not already found globally)
      if ((lowerLine.includes('عنوان') || lowerLine.includes('منطقة') || lowerLine.includes('محلة')) && !customerAddress) {
        customerAddress = line.replace(/^(عنوان|منطقة|محلة)[:\s]*/i, '').trim()
      }
      
      // Parse city explicitly (if not already found globally)
      if ((lowerLine.includes('مدينة') || lowerLine.includes('محافظة')) && !cityFound && !customerCity) {
        const cityText = line.replace(/^(مدينة|محافظة)[:\s]*/i, '').trim()
        const cityResult = await findCityByNameSmart(cityText)
        customerCity = cityResult.city
        
        if (!customerCity && cityResult.suggestions.length > 0) {
          await sendEnhancedErrorMessage(
            chatId, 
            text, 
            [`المدينة "${cityText}" غير واضحة`], 
            { cities: cityResult.suggestions }
          )
          return true
        }
        cityFound = true
      }
      
      // Smart address parsing with enhanced intelligence
      if (!cityFound && !customerAddress && !phoneMatches && !lowerLine.includes('منتج') && 
          !isValidCustomerName(line) && line.length > 3) {
        
        console.log(`🧠 تحليل ذكي للسطر: "${line}"`)
        const smartResult = await parseAddressLineSmart(line)
        
        if (smartResult.city) {
          customerCity = smartResult.city
          isDefaultCity = smartResult.isDefaultCity
          
          if (smartResult.region) {
            customerRegion = smartResult.region
            customerAddress = smartResult.remainingText || line
            console.log(`✅ تحليل ذكي كامل: ${customerCity.name} - ${customerRegion.name}`)
          } else {
            customerAddress = smartResult.remainingText || line
            console.log(`✅ تحليل ذكي للمدينة فقط: ${customerCity.name}`)
          }
          
          if (smartResult.customerName && !customerName) {
            customerName = smartResult.customerName
            console.log(`👤 اسم الزبون من التحليل الذكي: ${customerName}`)
          }
          
          if (isDefaultCity) {
            console.log(`🏙️ تم استخدام مدينة افتراضية بذكاء: ${customerCity.name}`)
          }
        }
        
        // Handle errors with smart suggestions
        if (smartResult.errors.length > 0) {
          console.log(`⚠️ أخطاء في التحليل الذكي:`, smartResult.errors)
          orderErrors.push(...smartResult.errors)
          
          // If we have suggestions, this means there were issues that need user clarification
          if (smartResult.suggestions.cities && smartResult.suggestions.cities.length > 0) {
            await sendEnhancedErrorMessage(
              chatId, 
              text, 
              smartResult.errors, 
              smartResult.suggestions,
              { city: smartResult.city, region: smartResult.region, isDefaultCity: smartResult.isDefaultCity }
            )
            return true // Stop processing this order due to errors
          }
        }
        
        cityFound = true
      }
      
      // Product parsing
      if (!phoneMatches && !lowerLine.includes('منطقة') && !lowerLine.includes('مدينة') && 
          !lowerLine.includes('عنوان') && !isValidCustomerName(line) && line.length > 2) {
        
        // Enhanced product search with variant and inventory checking
        const productSearchResult = await searchProductWithVariantsAndInventory(line, chatId, customerPhone)
        
        if (productSearchResult.found) {
          if (productSearchResult.available) {
            items.push({
              id: productSearchResult.product.id,
              name: productSearchResult.product.name,
              color: productSearchResult.variant?.color,
              size: productSearchResult.variant?.size,
              variant_id: productSearchResult.variant?.id,
              price: productSearchResult.variant?.price || productSearchResult.product.price,
              quantity: 1,
              stock_quantity: productSearchResult.variant?.stock || 0
            })
            totalPrice += (productSearchResult.variant?.price || productSearchResult.product.price)
            console.log(`✅ Added product: ${productSearchResult.product.name} - Available: ${productSearchResult.variant?.stock || 0}`)
          } else {
            // Product found but not available - send stock alert
            const stockAlert = productSearchResult.stockAlert
            if (stockAlert) {
              await sendTelegramMessage(chatId, stockAlert)
              orderErrors.push(`المنتج ${productSearchResult.product.name} غير متوفر`)
            }
          }
        } else {
          console.log(`❌ Product not found for: "${line}"`)
          // Continue processing other items
        }
      }
    }
    
    // Enhanced validation and error handling
    if (!customerName) customerName = defaultCustomerName
    
    if (!customerPhone) {
      orderErrors.push('لم يتم العثور على رقم هاتف صالح (يجب أن يبدأ بـ 07)')
    }
    
    if (!customerCity) {
      orderErrors.push('لم يتم تحديد المدينة بوضوح')
    }
    
    if (items.length === 0) {
      orderErrors.push('لم يتم العثور على أي منتجات في الطلب')
    }
    
    // If there are critical errors, send enhanced error message
    if (orderErrors.length > 0) {
      console.log('❌ أخطاء في الطلب:', orderErrors)
      await sendEnhancedErrorMessage(
        chatId, 
        text, 
        orderErrors, 
        {},
        { city: customerCity, region: customerRegion, isDefaultCity }
      )
      return true
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