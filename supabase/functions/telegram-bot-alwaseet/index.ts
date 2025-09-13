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

// Parse single line address for city and region with improved logic
async function parseAddressLine(addressText: string): Promise<{
  city: any | null,
  regions: any[],
  remainingText: string
}> {
  if (!addressText) return { city: null, regions: [], remainingText: '' }
  
  const parts = addressText.split(/[،,\s]+/).filter(Boolean)
  
  // First try to extract city from first part
  let cityText = parts[0]
  let city = await findCityByName(cityText)
  
  // If no city found in first part and only region specified, default to Baghdad
  if (!city && parts.length > 0) {
    city = await getBaghdadCity()
    // All parts become region candidates when no city specified
    if (city) {
      console.log(`🏙️ لم يتم تحديد مدينة، استخدام بغداد كافتراضي`)
    }
  }
  
  if (!city) {
    return { city: null, regions: [], remainingText: addressText }
  }
  
  // Determine region search parts
  const regionParts = city === await getBaghdadCity() && !await findCityByName(parts[0]) 
    ? parts  // All parts if Baghdad default
    : parts.slice(1)  // Skip city part
    
  let regions: any[] = []
  let nearestPointText = ''
  
  if (regionParts.length > 0) {
    // Try different combinations for multi-word regions (prioritize longer matches)
    // Start with 3-word combinations, then 2-word, then single word
    for (let wordCount = Math.min(3, regionParts.length); wordCount >= 1; wordCount--) {
      const regionCandidate = regionParts.slice(0, wordCount).join(' ')
      const foundRegions = await findRegionsByName(city.id, regionCandidate)
      
      if (foundRegions.length > 0) {
        regions = foundRegions
        // Rest becomes address details (no automatic "nearest point" filling)
        if (regionParts.length > wordCount) {
          nearestPointText = regionParts.slice(wordCount).join(' ')
        }
        console.log(`✅ تم العثور على مطابقة للمنطقة: "${regionCandidate}" (${foundRegions.length} نتيجة)`)
        break
      }
    }
    
    // If no region found and parts available, don't auto-fill anything
    if (regions.length === 0) {
      console.log(`⚠️ لم يتم العثور على منطقة مطابقة في: ${regionParts.join(' ')}`)
    }
  }
  
  return { 
    city, 
    regions, 
    remainingText: nearestPointText
  }
}

// Get default Baghdad city
async function getBaghdadCity(): Promise<any | null> {
  const cities = await getCitiesFromDatabase()
  return cities.find(city => 
    normalizeArabic(city.name).includes('بغداد')
  ) || null
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
        employee_code: employee.employee_code,
        employee_info: employeeInfo,
        telegram_chat_id: chatId,
        processed_at: new Date().toISOString()
      },
      p_customer_name: orderData.customerName,
      p_customer_phone: orderData.customerPhone,
      p_customer_address: orderData.customerAddress || '',
      p_customer_city: orderData.customerCity?.name,
      p_customer_province: orderData.customerCity?.name,
      p_total_amount: totalPrice + defaultDeliveryFee,
      p_items: orderData.items,
      p_telegram_chat_id: chatId,
      p_employee_code: employee?.user_id || employee.employee_code
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

// Enhanced order processing with AlWaseet integration
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
        // "قميص أحمر 2 قطعة x 25000"
        // "قميص أحمر 2x25000"  
        // "قميص أحمر - 2 - 25000"
        const patterns = [
          /(.+?)\s*[\-\×x]\s*(\d+)\s*[\-\×x]\s*(\d+\.?\d*)/i,           // name - qty - price
          /(.+?)\s*(\d+)\s*قطعة?\s*[\-\×x]\s*(\d+\.?\d*)/i,              // name qty pieces x price
          /(.+?)\s*[\-\×x]\s*(\d+\.?\d*)/i,                            // name x price (qty = 1)
          /(.+?)\s*(\d+)\s*قطعة?\s*$/i,                                 // name qty pieces (no price)
          /(.+?)\s*(\d+\.?\d*)\s*د\.?ع?$/i                             // name price dinars
        ]
        
        let matched = false
        for (const pattern of patterns) {
          const match = productName.match(pattern)
          if (match) {
            if (pattern.source.includes('قطعة')) {
              productName = match[1].trim()
              if (match[3]) { // has price
                quantity = parseInt(match[2]) || 1
                price = parseFloat(match[3]) || 0
              } else { // only quantity
                quantity = parseInt(match[2]) || 1
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
          
          // Search for exact product name first
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
            .or(`name.ilike.%${productName}%,name.ilike.%${productName.replace(/\s+/g, '%')}%`)
            .eq('is_active', true)
            .limit(5)
          
          if (products && products.length > 0) {
            const product = products[0]
            productId = product.id
            
            // Try to find price from variants first
            if (product.product_variants && product.product_variants.length > 0) {
              const activeVariants = product.product_variants.filter(v => v.is_active)
              if (activeVariants.length > 0) {
                // Use first active variant price
                finalPrice = price || activeVariants[0].price || product.base_price || 0
              } else {
                finalPrice = price || product.base_price || 0
              }
            } else {
              // Use base price if no variants
              finalPrice = price || product.base_price || 0
            }
          }
          
          if (finalPrice === 0 && !price) {
            // Try one more search with relaxed criteria
            const { data: fallbackProducts } = await supabase
              .from('products')
              .select('id, name, base_price')
              .textSearch('name', productName.split(' ').join(' | '))
              .eq('is_active', true)
              .limit(1)
            
            if (fallbackProducts && fallbackProducts.length > 0) {
              productId = fallbackProducts[0].id
              finalPrice = fallbackProducts[0].base_price || 0
            }
          }
          
          hasCustomPrice = price > 0
          totalPrice += finalPrice * quantity
          
          items.push({
            name: productName,
            quantity,
            price: finalPrice,
            product_id: productId
          })
        }
      }
    }
    
    // Enhanced address parsing for single line input with proper separation
    if (!customerCity && !customerAddress && lines.length > 0) {
      // Try to parse address from text like "نجف مناذرة ريان" -> نجف (city) + مناذرة (region) + ريان (nearest point)
      for (const line of lines) {
        if (!line.match(/07[5789]\d{8}/) && !lowerLine.includes('منتج') && line.length > 3) {
          const addressResult = await parseAddressLine(line)
          if (addressResult.city) {
            customerCity = addressResult.city
            // Split remaining text into region and nearest point
            const remainingParts = addressResult.remainingText.trim().split(/\s+/)
            if (remainingParts.length >= 1 && remainingParts[0]) {
              // First part is region, rest is nearest point
              const regionName = remainingParts[0]
              const nearestPoint = remainingParts.slice(1).join(' ').trim()
              
              // Find the region by name
              const regions = await getRegionsByCity(customerCity.id)
              const foundRegion = regions.find(r => 
                r.name.toLowerCase().includes(regionName.toLowerCase()) ||
                regionName.toLowerCase().includes(r.name.toLowerCase())
              )
              
              if (foundRegion) {
                customerRegion = foundRegion
                customerAddress = nearestPoint || '' // Only nearest point, not city+region
              } else {
                // If region not found, use first available region and put all as nearest point
                customerRegion = regions.length > 0 ? regions[0] : null
                customerAddress = addressResult.remainingText
              }
            } else {
              customerAddress = addressResult.remainingText
            }
            
            // Handle region disambiguation - ensure we have a region for delivery orders
            if (addressResult.regions.length > 1) {
              // Multiple regions found - need user selection
              pendingOrders.set(chatId, {
                customerName: customerName || defaultCustomerName,
                customerPhone,
                customerSecondaryPhone,
                customerAddress,
                customerCity,
                regions: addressResult.regions,
                remainingText: addressResult.remainingText,
                items,
                deliveryType,
                orderNotes
              })
              
              await sendRegionSelectionMenu(chatId, customerCity.name, addressResult.regions, line)
              return true // Wait for user selection
            } else if (addressResult.regions.length === 1) {
              customerRegion = addressResult.regions[0]
            } else if (addressResult.regions.length === 0) {
              // No region found - this is an error for delivery orders
              await sendTelegramMessage(chatId, `❌ لم يتم العثور على منطقة صحيحة في: "${line}"\n\nيرجى تحديد المنطقة بوضوح مثل:\n• بغداد الدورة\n• بغداد الكرادة\n• بغداد الحبيبية`)
              return false
            }
            break
          }
        }
      }
    }
    
    // Set defaults if not found - use default customer name if no valid name was found
    if (!customerName) customerName = defaultCustomerName
    if (!customerCity) customerCity = await getBaghdadCity()
    if (!customerRegion && customerCity) {
      const regions = await getRegionsByCity(customerCity.id)
      if (regions.length > 0) customerRegion = regions[0]
    }
    
    // Validate essential fields - ensure city and region for delivery orders
    if (!customerPhone || items.length === 0 || !customerCity || !customerRegion) {
      let errorMessage = `❌ خطأ في الطلب!\n\n`
      
      if (!customerPhone) {
        errorMessage += `• رقم هاتف صحيح مطلوب (07xxxxxxxxx)\n`
      }
      if (items.length === 0) {
        errorMessage += `• منتج واحد على الأقل مطلوب\n`
      }
      if (!customerCity) {
        errorMessage += `• تحديد المدينة مطلوب\n`
      }
      if (!customerRegion) {
        errorMessage += `• تحديد المنطقة مطلوب لشركات التوصيل\n`
      }
      
      errorMessage += `\n📋 مثال صحيح:\n` +
        `احمد علي\n` +
        `07701234567\n` +
        `بغداد الدورة\n` +
        `شارع الخليج\n` +
        `قميص أحمر 2 قطعة x 25000 د.ع\n` +
        `بنطال أزرق 1 قطعة x 35000 د.ع`
      
      await sendTelegramMessage(chatId, errorMessage)
      return false
    }
    
    // Create order confirmation message with full employee info
    const employeeInfo = employee ? 
      `${employee.full_name} (${employee.role}) - ${employee.employee_code}` : 
      `@${employeeCode}`
      
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
        customer_address: customerAddress, // Only nearest point
        customer_city: customerCity?.name,
        customer_region: customerRegion?.name,
        items: items,
        total_price: totalPrice,
        delivery_fee: defaultDeliveryFee,
        final_total: totalPrice + defaultDeliveryFee,
        delivery_type: deliveryType,
        order_notes: orderNotes,
        employee_code: employeeCode,
        employee_info: employeeInfo,
        telegram_chat_id: chatId,
        processed_at: new Date().toISOString()
      },
      p_customer_name: customerName,
      p_customer_phone: customerPhone,
      p_customer_address: customerAddress, // Only nearest point, not full address
      p_customer_city: customerCity?.name,
      p_customer_province: customerRegion?.name || customerCity?.name,
      p_total_amount: totalPrice + defaultDeliveryFee,
      p_items: items,
      p_telegram_chat_id: chatId,
      p_employee_code: employee?.user_id || employeeCode
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
    console.error('Error processing order:', error)
    await sendTelegramMessage(chatId, '❌ حدث خطأ في معالجة الطلب. يرجى المحاولة مرة أخرى.')
    return false
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
    const result = await supabase.rpc('link_telegram_user', {
      p_employee_code: employeeCode,
      p_telegram_chat_id: chatId
    })
    
    if (result.data) {
      // Get employee info
      const employeeData = await supabase.rpc('get_employee_by_telegram_id', { 
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
بغداد
شارع الخليج
قميص أحمر 2 قطعة x 25000 د.ع
بنطال أزرق 1 قطعة x 35000 د.ع

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
  
  if (!text) return
  
  try {
    // Handle /start command for employee registration
    if (text.startsWith('/start')) {
      return await handleEmployeeRegistration(text, chatId)
    }
    
    // Handle region selection
    if (text.includes('المنطقة:')) {
      return await processRegionSelection(text, chatId)
    }
    
    // Check if user is registered
    const employeeData = await supabase.rpc('get_employee_by_telegram_id', { 
      p_telegram_chat_id: chatId 
    })
    const employee = employeeData.data?.[0]
    
    if (!employee) {
      await sendTelegramMessage(chatId, '❌ غير مسجل!\n\nيرجى الحصول على رمز التفعيل من إدارة النظام واستخدام الأمر:\n/start [رمز_الموظف]')
      return
    }
    
    // Handle help command
    if (text === '/help' || text === 'مساعدة') {
      const helpMessage = `
📚 دليل استخدام البوت

👋 مرحباً ${employee.full_name}!

📝 لإنشاء طلب جديد، اكتب:
اسم العميل
رقم الهاتف (07XXXXXXXX)
المدينة المنطقة العنوان (سطر واحد)
المنتجات (اسم المنتج + الكمية + السعر)

مثال تقليدي:
احمد علي
07701234567
بغداد
الدورة
شارع الخليج
قميص أحمر 2 قطعة x 25000 د.ع

مثال سطر واحد:
احمد علي
07701234567
بغداد الدورة حي الصحة
قميص أحمر 2 قطعة x 25000 د.ع

💡 نصائح:
• يمكن كتابة العنوان كامل في سطر واحد
• إذا كانت هناك مناطق متشابهة، ستظهر قائمة للاختيار
• يمكن كتابة عدة أرقام هواتف
• السعر اختياري (سيتم البحث في قاعدة البيانات)
• يمكن إضافة ملاحظات خاصة
• استخدم كلمة "تبديل" للطلبات التبديلية
• لاختيار منطقة: المنطقة: [اسم المنطقة]

🔄 سيتم معالجة الطلب تلقائياً وإرساله للنظام
      `
      
      await sendTelegramMessage(chatId, helpMessage)
      return
    }
    
    // Process as order
    const orderProcessed = await processOrderWithAlWaseet(text, chatId, employee.employee_code)
    
    if (!orderProcessed) {
      await sendTelegramMessage(chatId, '❌ لم يتم التعرف على الطلب!\n\nاستخدم /help للحصول على المساعدة.')
    }
    
  } catch (error) {
    console.error('Error handling message:', error)
    await sendTelegramMessage(chatId, '❌ حدث خطأ في معالجة الرسالة. يرجى المحاولة مرة أخرى.')
  }
}

// Main handler
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  try {
    const body = await req.json()
    
    // Telegram deduplication: ignore duplicate updates/messages
    const update = body as any;
    const msg = update?.message;
    try {
      if (update?.update_id && msg?.message_id && msg?.chat?.id) {
        const { error: dupErr } = await supabase
          .from('telegram_processed_updates')
          .insert({
            update_id: Number(update.update_id),
            chat_id: Number(msg.chat.id),
            message_id: Number(msg.message_id),
            message_hash: typeof msg.text === 'string' ? msg.text.slice(0, 200) : null
          });
        if (dupErr) {
          // If duplicate, exit early (Telegram may retry webhooks)
          if (dupErr.code === '23505' || (dupErr.message || '').includes('duplicate key value')) {
            console.log('🔁 Duplicate Telegram update ignored:', update.update_id);
            return new Response(JSON.stringify({ ok: true, duplicate: true }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          console.warn('Dedup insert warning:', dupErr);
        }
      }
    } catch (e) {
      console.warn('Dedup check failed, continuing anyway:', e);
    }
    
    // Handle Telegram webhook
    if (body.message) {
      await handleMessage(body.message)
    }
    
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})