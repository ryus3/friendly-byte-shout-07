import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

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
    const { data: cities, error } = await supabaseClient
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
    const { data: regions, error } = await supabaseClient
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

// Arabic text normalization for better matching
function normalizeArabic(text: string): string {
  if (!text) return ''
  return text.toString().trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ة]/g, 'ه')
    .replace(/[ي]/g, 'ى')
    .toLowerCase()
}

// Find city by name with intelligent matching
async function findCityByName(cityName: string): Promise<any | null> {
  const cities = await getCitiesFromDatabase()
  const normalizedName = normalizeArabic(cityName)
  
  if (!cities.length) return null
  
  // Direct match first
  let foundCity = cities.find(city => 
    normalizeArabic(city.name) === normalizedName ||
    normalizeArabic(city.name).includes(normalizedName) ||
    normalizedName.includes(normalizeArabic(city.name))
  )
  
  return foundCity
}

// دالة للبحث عن المناطق بالاسم داخل مدينة معينة مع ترجيح النتائج
async function findRegionsByName(cityId: number, regionText: string): Promise<any[]> {
  const normalizedText = normalizeArabic(regionText)
  
  try {
    const { data: regions, error } = await supabaseClient
      .from('regions')
      .select('*')
      .eq('city_id', cityId)
      .eq('is_active', true)

    if (error) {
      console.error('Error fetching regions:', error)
      return []
    }

    // ترجيح المناطق حسب جودة التطابق
    const scoredRegions = regions.map(region => {
      const normalizedRegionName = normalizeArabic(region.name)
      let score = 0
      
      if (normalizedRegionName === normalizedText) {
        score = 100 // تطابق كامل
      } else if (normalizedRegionName.startsWith(normalizedText)) {
        score = 90 // يبدأ بالنص
      } else if (normalizedText.startsWith(normalizedRegionName)) {
        score = 85 // النص يبدأ باسم المنطقة
      } else if (normalizedRegionName.includes(normalizedText)) {
        score = 80 // يحتوي على النص
      } else if (normalizedText.includes(normalizedRegionName)) {
        score = 75 // النص يحتوي على اسم المنطقة
      } else {
        // تحقق من التطابق الجزئي
        const regionWords = normalizedRegionName.split(/\s+/)
        const textWords = normalizedText.split(/\s+/)
        const commonWords = regionWords.filter(word => textWords.some(textWord => textWord.includes(word) || word.includes(textWord)))
        if (commonWords.length > 0) {
          score = 60 + (commonWords.length * 10)
        }
      }
      
      return { ...region, score }
    }).filter(region => region.score > 0)

    // ترتيب حسب النقاط
    return scoredRegions.sort((a, b) => b.score - a.score)
  } catch (error) {
    console.error('Error in findRegionsByName:', error)
    return []
  }
}

// دالة لتحليل سطر العنوان واستخراج المدينة والمناطق
async function parseAddressLine(addressText: string): Promise<{ city: any | null, regions: any[], remainingText: string }> {
  const normalizedAddress = normalizeArabic(addressText)
  console.log('Parsing address:', normalizedAddress)

  // أولاً ننظف النص من أرقام الهواتف
  const cleanedAddress = normalizedAddress.replace(/[\d\s\-\+\(\)]{8,}/g, '').trim()
  
  let foundCity = null
  let foundRegions = []
  let remainingText = cleanedAddress

  // البحث عن المدينة
  const cities = await getCitiesFromDatabase()
  for (const city of cities) {
    const normalizedCityName = normalizeArabic(city.name)
    if (normalizedAddress.includes(normalizedCityName)) {
      foundCity = city
      // إزالة اسم المدينة من النص المتبقي
      remainingText = remainingText.replace(normalizedCityName, '').trim()
      break
    }
  }

  // إذا لم نجد مدينة، استخدم بغداد كافتراضي
  if (!foundCity) {
    foundCity = await getBaghdadCity()
    console.log('No city found, using Baghdad as default')
  }

  // البحث عن المناطق إذا وُجدت مدينة
  if (foundCity && remainingText) {
    // تجريب n-grams من الأطول إلى الأقصر للعثور على أفضل تطابق
    const words = remainingText.split(/\s+/)
    let bestRegions = []
    let bestMatchText = ''
    
    // جرب من 4 كلمات إلى كلمة واحدة
    for (let n = Math.min(4, words.length); n >= 1; n--) {
      for (let i = 0; i <= words.length - n; i++) {
        const candidate = words.slice(i, i + n).join(' ')
        const regions = await findRegionsByName(foundCity.id, candidate)
        
        if (regions.length > 0) {
          // حسب النقاط للمرشح الحالي
          const score = candidate.length * regions.length
          const currentScore = bestMatchText.length * bestRegions.length
          
          if (score > currentScore) {
            bestRegions = regions
            bestMatchText = candidate
          }
        }
      }
    }
    
    foundRegions = bestRegions
    
    // إزالة النص المطابق من النص المتبقي
    if (bestMatchText) {
      remainingText = remainingText.replace(bestMatchText, '').trim()
    }
  }

  return {
    city: foundCity,
    regions: foundRegions,
    remainingText: remainingText
  }
}

// Get default Baghdad city
async function getBaghdadCity(): Promise<any | null> {
  const cities = await getCitiesFromDatabase()
  return cities.find(city => 
    normalizeArabic(city.name).includes('بغداد')
  ) || null
}

// دالة لإرسال قائمة اختيار المناطق
async function sendRegionSelectionMenu(chatId: number, cityName: string, regions: any[], originalText: string) {
  let message = `تم العثور على عدة مناطق متشابهة في ${cityName}:\n\n`
  
  regions.forEach((region, index) => {
    message += `${index + 1}. ${region.name}\n`
  })
  
  message += `\nيرجى اختيار المنطقة الصحيحة:\n`
  message += `• اكتب الرقم فقط (مثال: 1)\n`
  message += `• أو اكتب "المنطقة: اسم المنطقة"\n\n`
  message += `لن يتم إرسال الطلب حتى تحدد المنطقة الصحيحة.`
  
  await sendTelegramMessage(chatId, message)
  
  // حفظ حالة انتظار الاختيار في قاعدة البيانات
  try {
    await supabaseClient
      .from('telegram_pending_selections')
      .upsert({
        chat_id: chatId,
        selection_type: 'region',
        options: regions,
        original_text: originalText,
        city_name: cityName,
        expires_at: new Date(Date.now() + 10 * 60 * 1000) // 10 دقائق
      }, { onConflict: 'chat_id' })
  } catch (error) {
    console.error('Error saving pending selection:', error)
  }
}

// دالة لمعالجة اختيار المنطقة
async function processRegionSelection(text: string, chatId: number): Promise<boolean> {
  try {
    // البحث عن حالة الاختيار المعلقة
    const { data: pendingSelection, error } = await supabaseClient
      .from('telegram_pending_selections')
      .select('*')
      .eq('chat_id', chatId)
      .eq('selection_type', 'region')
      .gt('expires_at', new Date().toISOString())
      .single()

    if (error || !pendingSelection) {
      await sendTelegramMessage(chatId, 'لم يتم العثور على اختيار معلق. يرجى إعادة إرسال طلبك.')
      return false
    }

    let selectedRegion = null

    if (text.startsWith('المنطقة:')) {
      const regionName = normalizeArabic(text.replace('المنطقة:', '').trim())
      selectedRegion = pendingSelection.options.find(region => 
        normalizeArabic(region.name).includes(regionName) || regionName.includes(normalizeArabic(region.name))
      )
    } else if (/^\d+$/.test(text.trim())) {
      const regionIndex = parseInt(text.trim()) - 1
      if (regionIndex >= 0 && regionIndex < pendingSelection.options.length) {
        selectedRegion = pendingSelection.options[regionIndex]
      }
    }

    if (!selectedRegion) {
      await sendTelegramMessage(chatId, 'اختيار غير صحيح. يرجى اختيار رقم صحيح أو كتابة "المنطقة: اسم المنطقة"')
      return false
    }

    // إكمال معالجة الطلب مع المنطقة المختارة
    await completeOrderWithSelectedRegion(chatId, selectedRegion, pendingSelection)

    // حذف الاختيار المعلق
    await supabaseClient
      .from('telegram_pending_selections')
      .delete()
      .eq('chat_id', chatId)

    return true
  } catch (error) {
    console.error('Error processing region selection:', error)
    await sendTelegramMessage(chatId, 'حدث خطأ في معالجة اختيارك. يرجى إعادة إرسال طلبك.')
    return false
  }
}

// دالة لإكمال الطلب مع المنطقة المختارة
async function completeOrderWithSelectedRegion(chatId: number, selectedRegion: any, pendingSelection: any) {
  try {
    // إعادة معالجة الطلب الأصلي مع المنطقة المختارة
    const originalText = pendingSelection.original_text
    
    // استخراج بيانات العميل من النص الأصلي
    const lines = originalText.split('\n').map(line => line.trim()).filter(line => line.length > 0)
    
    let customerName = ''
    let customerPhone = ''
    
    // استخراج اسم العميل (السطر الأول عادة)
    if (lines.length > 0) {
      customerName = lines[0].replace(/[^\u0600-\u06FF\s]/g, '').trim()
    }
    
    // استخراج رقم الهاتف
    for (const line of lines) {
      const phoneMatch = line.match(/[\d\s\-\+\(\)]{8,}/)
      if (phoneMatch) {
        customerPhone = phoneMatch[0].replace(/\s/g, '')
        break
      }
    }
    
    // استخراج المنتجات
    const foundProducts = []
    let totalAmount = 0
    
    function isProductLine(line) {
      const lowerLine = line.toLowerCase()
      return !line.match(/^[\d\s\-\+\(\)]+$/) && // ليس رقم هاتف فقط
             !lowerLine.includes('اسم') &&
             !lowerLine.includes('زبون') &&
             !lowerLine.includes('عميل') &&
             !lowerLine.includes('عنوان') &&
             !lowerLine.includes('منطقة') &&
             !lowerLine.includes('مدينة') &&
             !lowerLine.includes('محافظة') &&
             line.length > 3
    }
    
    async function findProductInLine(line) {
      // نفس منطق البحث عن المنتج كما في الدالة الأصلية
      let productName = line.trim()
      let quantity = 1
      let price = 0
      
      // استخراج الكمية والسعر
      const patterns = [
        /(.+?)\s*[\-\×x]\s*(\d+)\s*[\-\×x]\s*(\d+\.?\d*)/i,
        /(.+?)\s*(\d+)\s*قطعة?\s*[\-\×x]\s*(\d+\.?\d*)/i,
        /(.+?)\s*[\-\×x]\s*(\d+\.?\d*)/i,
        /(.+?)\s*(\d+)\s*قطعة?\s*$/i,
        /(.+?)\s*(\d+\.?\d*)\s*د\.?ع?$/i
      ]
      
      for (const pattern of patterns) {
        const match = productName.match(pattern)
        if (match) {
          if (pattern.source.includes('قطعة')) {
            productName = match[1].trim()
            if (match[3]) {
              quantity = parseInt(match[2]) || 1
              price = parseFloat(match[3]) || 0
            } else {
              quantity = parseInt(match[2]) || 1
            }
          } else if (match[3]) {
            productName = match[1].trim()
            quantity = parseInt(match[2]) || 1
            price = parseFloat(match[3]) || 0
          } else {
            productName = match[1].trim()
            price = parseFloat(match[2]) || 0
          }
          break
        }
      }
      
      // البحث عن المنتج في قاعدة البيانات
      let finalPrice = price
      const { data: products } = await supabaseClient
        .from('products')
        .select(`
          id, name, base_price,
          product_variants (
            id, price, color_id, size_id, is_active,
            colors (name),
            sizes (name)
          )
        `)
        .or(`name.ilike.%${productName}%`)
        .eq('is_active', true)
        .limit(1)
      
      if (products && products.length > 0) {
        const product = products[0]
        if (product.product_variants && product.product_variants.length > 0) {
          const activeVariants = product.product_variants.filter(v => v.is_active)
          if (activeVariants.length > 0) {
            finalPrice = price || activeVariants[0].price || product.base_price || 0
          }
        } else {
          finalPrice = price || product.base_price || 0
        }
        
        console.log(`Product found: ${productName}, Price: ${finalPrice}, Variant ID: ${product.product_variants?.[0]?.id}`)
        
        return {
          found: true,
          product_name: productName,
          quantity: quantity,
          unit_price: finalPrice,
          total_price: finalPrice * quantity,
          variant_id: product.product_variants?.[0]?.id || null,
          product_id: product.id
        }
      } else {
        console.log(`Product not found for: ${productName}`)
        return {
          found: false,
          product_name: productName,
          quantity: quantity,
          unit_price: 0,
          total_price: 0
        }
      }
    }
    
    for (const line of lines) {
      if (isProductLine(line)) {
        const product = await findProductInLine(line)
        if (product.found) {
          foundProducts.push(product)
          totalAmount += product.total_price
        }
      }
    }
    
    if (foundProducts.length === 0) {
      await sendTelegramMessage(chatId, 'لم يتم العثور على منتجات صحيحة في طلبك.')
      return
    }
    
    // تشكيل بيانات الطلب مع المنطقة المختارة
    const orderData = {
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_city: pendingSelection.city_name,
      customer_address: selectedRegion.name,
      customer_province: pendingSelection.city_name === 'بغداد' ? 'بغداد' : pendingSelection.city_name,
      items: foundProducts,
      total_amount: totalAmount,
      source: 'telegram',
      telegram_chat_id: chatId,
      created_by: 'EMP001', // سيتم تحديثه لاحقاً
      original_text: originalText
    }
    
    // التحقق من عدم وجود طلب مشابه حديث لتجنب التكرار
    const recentCutoff = new Date(Date.now() - 10 * 60 * 1000) // 10 دقائق
    const { data: recentOrder } = await supabaseClient
      .from('ai_orders')
      .select('id')
      .eq('telegram_chat_id', chatId)
      .eq('original_text', originalText)
      .gte('created_at', recentCutoff.toISOString())
      .single()

    if (recentOrder) {
      console.log('Duplicate order detected, skipping')
      await sendTelegramMessage(chatId, 'تم استلام طلبك سابقاً. في حالة عدم وصول الطلب، يرجى المحاولة مرة أخرى بعد قليل.')
      return
    }
    
    // حفظ الطلب في ai_orders
    const { data: savedOrder, error: saveError } = await supabaseClient
      .from('ai_orders')
      .insert(orderData)
      .select()
      .single()
    
    if (saveError) {
      console.error('Error saving order with selected region:', saveError)
      await sendTelegramMessage(chatId, 'حدث خطأ في حفظ الطلب. يرجى المحاولة مرة أخرى.')
      return
    }
    
    // إرسال رسالة تأكيد
    let confirmationMessage = `✅ تم استلام طلبك بنجاح!\n\n`
    confirmationMessage += `👤 العميل: ${customerName}\n`
    confirmationMessage += `📱 الهاتف: ${customerPhone}\n`
    confirmationMessage += `🏙️ العنوان: ${pendingSelection.city_name} - ${selectedRegion.name}\n\n`
    confirmationMessage += `📦 المنتجات:\n`
    
    foundProducts.forEach(product => {
      confirmationMessage += `• ${product.product_name}`
      if (product.color) confirmationMessage += ` - ${product.color}`
      if (product.size) confirmationMessage += ` - ${product.size}`
      confirmationMessage += ` (${product.quantity}x) = ${product.total_price.toLocaleString()} د.ع\n`
    })
    
    confirmationMessage += `\n💰 المجموع: ${totalAmount.toLocaleString()} د.ع`
    confirmationMessage += `\n\n⏳ سيتم مراجعة طلبك قريباً...`
    
    await sendTelegramMessage(chatId, confirmationMessage)
    
  } catch (error) {
    console.error('Error completing order with selected region:', error)
    await sendTelegramMessage(chatId, 'حدث خطأ في معالجة طلبك. يرجى إعادة إرسال الطلب.')
  }
}

// Enhanced order processing with AlWaseet integration
async function processOrderWithAlWaseet(text: string, chatId: number, employeeCode: string) {
  console.log('Processing order for employee:', employeeCode)
  
  try {
    // تنظيف النص وتقسيمه لأسطر
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)
    
    let customerName = ''
    let customerPhone = ''
    
    // استخراج اسم العميل من السطر الأول (تنظيف من الأرقام والرموز)
    if (lines.length > 0) {
      customerName = lines[0].replace(/[^\u0600-\u06FF\s]/g, '').trim()
    }
    
    // استخراج رقم الهاتف
    for (const line of lines) {
      const phoneMatch = line.match(/07[5789]\d{8}/)
      if (phoneMatch) {
        customerPhone = phoneMatch[0]
        break
      }
    }
    
    // دالة للتحقق من كون السطر منتج
    function isProductLine(line) {
      const lowerLine = line.toLowerCase()
      return !line.match(/^[\d\s\-\+\(\)]+$/) && // ليس رقم هاتف فقط
             !lowerLine.includes('اسم') &&
             !lowerLine.includes('زبون') &&
             !lowerLine.includes('عميل') &&
             !lowerLine.includes('عنوان') &&
             !lowerLine.includes('منطقة') &&
             !lowerLine.includes('مدينة') &&
             !lowerLine.includes('محافظة') &&
             line.length > 3
    }
    
    // دالة للبحث عن المنتج في السطر
    async function findProductInLine(line) {
      let productName = line.trim()
      let quantity = 1
      let price = 0
      
      // استخراج الكمية والسعر من النص
      const patterns = [
        /(.+?)\s*[\-\×x]\s*(\d+)\s*[\-\×x]\s*(\d+\.?\d*)/i,
        /(.+?)\s*(\d+)\s*قطعة?\s*[\-\×x]\s*(\d+\.?\d*)/i,
        /(.+?)\s*[\-\×x]\s*(\d+\.?\d*)/i,
        /(.+?)\s*(\d+)\s*قطعة?\s*$/i,
        /(.+?)\s*(\d+\.?\d*)\s*د\.?ع?$/i
      ]
      
      for (const pattern of patterns) {
        const match = productName.match(pattern)
        if (match) {
          if (pattern.source.includes('قطعة')) {
            productName = match[1].trim()
            if (match[3]) {
              quantity = parseInt(match[2]) || 1
              price = parseFloat(match[3]) || 0
            } else {
              quantity = parseInt(match[2]) || 1
            }
          } else if (match[3]) {
            productName = match[1].trim()
            quantity = parseInt(match[2]) || 1
            price = parseFloat(match[3]) || 0
          } else {
            productName = match[1].trim()
            price = parseFloat(match[2]) || 0
          }
          break
        }
      }
      
      // البحث عن المنتج في قاعدة البيانات
      let finalPrice = price
      const { data: products } = await supabaseClient
        .from('products')
        .select(`
          id, name, base_price,
          product_variants (
            id, price, color_id, size_id, is_active,
            colors (name),
            sizes (name)
          )
        `)
        .or(`name.ilike.%${productName}%`)
        .eq('is_active', true)
        .limit(1)
      
      if (products && products.length > 0) {
        const product = products[0]
        if (product.product_variants && product.product_variants.length > 0) {
          const activeVariants = product.product_variants.filter(v => v.is_active)
          if (activeVariants.length > 0) {
            finalPrice = price || activeVariants[0].price || product.base_price || 0
          }
        } else {
          finalPrice = price || product.base_price || 0
        }
        
        console.log(`Product found: ${productName}, Price: ${finalPrice}, Variant ID: ${product.product_variants?.[0]?.id}`)
        
        return {
          found: true,
          product_name: productName,
          quantity: quantity,
          unit_price: finalPrice,
          total_price: finalPrice * quantity,
          variant_id: product.product_variants?.[0]?.id || null,
          product_id: product.id
        }
      } else {
        console.log(`Product not found for: ${productName}`)
        return {
          found: false,
          product_name: productName,
          quantity: quantity,
          unit_price: 0,
          total_price: 0
        }
      }
    }
    
    // معالجة عناوين متعددة أو عنوان واحد
    const addressLines = lines.filter(line => 
      !isProductLine(line) && 
      !line.match(/^[\d\s\-\+\(\)]+$/) && // ليس رقم هاتف فقط
      line.length > 5 // تجاهل الأسطر القصيرة جداً
    )

    console.log('Address lines found:', addressLines)

    let customerCity = null
    let customerAddress = ''
    let remainingAddress = ''

    for (const addressLine of addressLines) {
      const { city, regions, remainingText } = await parseAddressLine(addressLine)
      
      if (city) {
        customerCity = city.name
        
        if (regions && regions.length > 0) {
          if (regions.length === 1) {
            customerAddress = regions[0].name
            // فقط إذا كان هناك نص واضح متبقٍ بعد المنطقة
            if (remainingText && remainingText.length > 3 && !remainingText.match(/^\s*$/)) {
              remainingAddress = remainingText
            }
          } else {
            // إرسال خيارات للمستخدم ولا نكمل الطلب
            await sendRegionSelectionMenu(chatId, city.name, regions, text)
            return
          }
        } else {
          // لا توجد منطقة - خطأ
          await sendTelegramMessage(chatId, `لم يتم العثور على منطقة صحيحة في ${city.name}. يرجى تحديد المنطقة بوضوح.`)
          return
        }
        
        break // وجدنا مدينة ومنطقة، لا نحتاج للمتابعة
      }
    }

    // التحقق من وجود منطقة (المدينة إما محددة أو بغداد افتراضياً)
    if (!customerAddress) {
      await sendTelegramMessage(chatId, 'لم يتم العثور على منطقة صحيحة. يرجى تحديد المنطقة بوضوح.')
      return
    }

    // التأكد من وجود مدينة (افتراضياً بغداد)
    if (!customerCity) {
      const baghdadCity = await getBaghdadCity()
      customerCity = baghdadCity?.name || 'بغداد'
    }

    // استخراج المنتجات
    const foundProducts = []
    let totalAmount = 0
    
    for (const line of lines) {
      if (isProductLine(line)) {
        const product = await findProductInLine(line)
        if (product.found) {
          foundProducts.push(product)
          totalAmount += product.total_price
        }
      }
    }
    
    // التحقق من وجود منتجات
    if (foundProducts.length === 0) {
      await sendTelegramMessage(chatId, 'لم يتم العثور على منتجات صحيحة في طلبك. يرجى كتابة أسماء المنتجات بوضوح.')
      return
    }

    // تشكيل العنوان الكامل
    let fullAddress = customerAddress
    
    // إضافة أقرب نقطة دالة فقط إذا كان هناك نص واضح متبقٍ
    if (remainingAddress && remainingAddress.trim() && remainingAddress.length > 3) {
      fullAddress += `, ${remainingAddress}`
    }
    
    // تشكيل بيانات الطلب
    const orderData = {
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_city: customerCity,
      customer_address: customerAddress,
      customer_province: customerCity === 'بغداد' ? 'بغداد' : customerCity,
      items: foundProducts,
      total_amount: totalAmount,
      source: 'telegram',
      telegram_chat_id: chatId,
      created_by: employeeCode,
      original_text: text // للتحقق من التكرار
    }

    // التحقق من عدم وجود طلب مشابه حديث لتجنب التكرار
    const recentCutoff = new Date(Date.now() - 10 * 60 * 1000) // 10 دقائق
    const { data: recentOrder } = await supabaseClient
      .from('ai_orders')
      .select('id')
      .eq('telegram_chat_id', chatId)
      .eq('original_text', text)
      .gte('created_at', recentCutoff.toISOString())
      .single()

    if (recentOrder) {
      console.log('Duplicate order detected, skipping')
      await sendTelegramMessage(chatId, 'تم استلام طلبك سابقاً. في حالة عدم وصول الطلب، يرجى المحاولة مرة أخرى بعد قليل.')
      return
    }

    // حفظ الطلب في ai_orders
    const { data: savedOrder, error: saveError } = await supabaseClient
      .from('ai_orders')
      .insert(orderData)
      .select()
      .single()

    if (saveError) {
      console.error('Error saving order:', saveError)
      await sendTelegramMessage(chatId, 'حدث خطأ في حفظ الطلب. يرجى المحاولة مرة أخرى.')
      return
    }

    console.log('Order creation result:', { orderId: savedOrder.id, error: null })

    // إرسال رسالة تأكيد
    let confirmationMessage = `✅ تم استلام طلبك بنجاح!\n\n`
    confirmationMessage += `👤 العميل: ${customerName}\n`
    confirmationMessage += `📱 الهاتف: ${customerPhone}\n`
    confirmationMessage += `🏙️ العنوان: ${customerCity} - ${fullAddress}\n\n`
    confirmationMessage += `📦 المنتجات:\n`
    
    foundProducts.forEach(product => {
      confirmationMessage += `• ${product.product_name} (${product.quantity}x) = ${product.total_price.toLocaleString()} د.ع\n`
    })
    
    confirmationMessage += `\n💰 المجموع: ${totalAmount.toLocaleString()} د.ع`
    confirmationMessage += `\n\n⏳ سيتم مراجعة طلبك قريباً...`
    
    await sendTelegramMessage(chatId, confirmationMessage)
    
  } catch (error) {
    console.error('Error processing order:', error)
    await sendTelegramMessage(chatId, 'حدث خطأ في معالجة طلبك. يرجى إعادة إرسال الطلب.')
  }
}

// Handle employee registration
async function handleEmployeeRegistration(text: string, chatId: number) {
  const codeMatch = text.match(/\/start\s+([A-Z0-9]+)/)
  if (!codeMatch) {
    await sendTelegramMessage(chatId, '❌ رمز الموظف غير صحيح!\n\nيرجى الحصول على رمز التفعيل من إدارة النظام.')
    return false
  }
  
  const employeeCode = codeMatch[1]
  
  try {
    const result = await supabaseClient.rpc('link_telegram_user', {
      p_employee_code: employeeCode,
      p_telegram_chat_id: chatId
    })
    
    if (result.data) {
      // Get employee info
      const employeeData = await supabaseClient.rpc('get_employee_by_telegram_id', { 
        p_telegram_chat_id: chatId 
      })
      const employee = employeeData.data?.[0]
      
      const welcomeMessage = `
🎉 مرحباً ${employee?.full_name || 'بك'}!

✅ تم ربط حسابك بنجاح
👤 الاسم: ${employee?.full_name || 'غير محدد'}
🏷️ الدور: ${employee?.role || 'موظف'}
🔑 رمز الموظف: ${employeeCode}

📝 يمكنك الآن إرسال طلبات العملاء مباشرة إلى النظام

📋 مثال على طلب:
احمد علي
07701234567
بغداد الدورة حي الصحة
قميص أحمر 2 قطعة x 25000 د.ع

🔄 سيتم تحويل كل طلب تكتبه تلقائياً إلى النظام
      `
      
      await sendTelegramMessage(chatId, welcomeMessage)
      return true
    } else {
      await sendTelegramMessage(chatId, '❌ رمز الموظف غير صحيح أو منتهي الصلاحية!\n\nيرجى التواصل مع الإدارة للحصول على رمز جديد.')
      return false
    }
  } catch (error) {
    console.error('Error linking employee:', error)
    await sendTelegramMessage(chatId, '❌ حدث خطأ في ربط الحساب. يرجى المحاولة مرة أخرى.')
    return false
  }
}

// Main message handler
async function handleMessage(message: TelegramMessage) {
  const chatId = message.chat.id
  const text = message.text?.trim()
  
  console.log('Processing message from chatId:', chatId, 'text:', JSON.stringify(text))
  
  if (!text) return
  
  try {
    // Handle /start command for employee registration
    if (text.startsWith('/start')) {
      return await handleEmployeeRegistration(text, chatId)
    }
    
    // التحقق من وجود اختيار معلق للمناطق
    const { data: pendingSelection } = await supabaseClient
      .from('telegram_pending_selections')
      .select('*')
      .eq('chat_id', chatId)
      .eq('selection_type', 'region')
      .gt('expires_at', new Date().toISOString())
      .single()

    if (pendingSelection) {
      // معالجة اختيار المنطقة
      const processed = await processRegionSelection(text, chatId)
      if (processed) return
    }

    // Get employee data for current user
    const employeeData = await supabaseClient.rpc('get_employee_by_telegram_id', { 
      p_telegram_chat_id: chatId 
    })
    const employee = employeeData.data?.[0]
    
    console.log('Employee found:', {
      user_id: employee?.user_id,
      full_name: employee?.full_name,
      role: employee?.role,
      role_title: employee?.role_title,
      employee_code: employee?.employee_code
    })

    if (!employee) {
      await sendTelegramMessage(chatId, '❌ غير مسجل!\n\nيرجى الحصول على رمز التفعيل من إدارة النظام واستخدام الأمر:\n/start [رمز_الموظف]')
      return
    }

    // معالجة الطلب مع الوسيط
    await processOrderWithAlWaseet(text, chatId, employee.employee_code)
    
  } catch (error) {
    console.error('Error handling message:', error)
    await sendTelegramMessage(chatId, '❌ حدث خطأ في معالجة الرسالة. يرجى المحاولة مرة أخرى.')
  }
}

// Main handler
serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  console.log('🔴 Telegram webhook called!')
  console.log('Request method:', req.method)
  console.log('Request URL:', req.url)

  try {
    const body = await req.json()
    console.log('Received update:', JSON.stringify(body, null, 2))

    // Check for duplicate processing
    if (body.update_id) {
      const { data: existingUpdate } = await supabaseClient
        .from('telegram_processed_updates')
        .select('update_id')
        .eq('update_id', body.update_id)
        .single()

      if (existingUpdate) {
        console.log('Update already processed:', body.update_id)
        return new Response(JSON.stringify({ ok: true, message: 'Already processed' }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      // Record this update as processed
      await supabaseClient
        .from('telegram_processed_updates')
        .insert({
          update_id: body.update_id,
          chat_id: body.message?.chat?.id || 0,
          message_id: body.message?.message_id || 0
        })
    }

    if (body.message) {
      await handleMessage(body.message)
    }

    return new Response(JSON.stringify({ ok: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(JSON.stringify({ error: 'Internal error' }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})