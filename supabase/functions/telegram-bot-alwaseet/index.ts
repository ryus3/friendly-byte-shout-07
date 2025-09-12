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
  callback_query?: {
    id: string
    from: {
      id: number
      first_name: string
    }
    message: {
      message_id: number
      chat: {
        id: number
      }
    }
    data: string
  }
}

// Send message to Telegram
async function sendTelegramMessage(chatId: number, text: string, replyMarkup?: any) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      reply_markup: replyMarkup
    })
  })
  return response.json()
}

// Send inline keyboard for region selection
async function sendRegionSelectionKeyboard(chatId: number, aiOrderId: string, candidates: any[]) {
  const text = `🤔 تم العثور على عدة مناطق مشابهة لعنوانك.\nاختر المنطقة الصحيحة:`
  
  const keyboard = {
    inline_keyboard: candidates.map(candidate => [{
      text: `📍 ${candidate.name}`,
      callback_data: `region_${aiOrderId}_${candidate.id}`
    }])
  }
  
  return await sendTelegramMessage(chatId, text, keyboard)
}

// Answer callback query
async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text || 'تم التحديث ✅'
    })
  })
  return response.json()
}

// Get cities from AlWaseet API (mock data for now)
async function getCitiesFromAlWaseet(): Promise<any[]> {
  // Mock Iraqi cities - replace with actual AlWaseet API call when available
  return [
    { id: 1, name: 'بغداد' },
    { id: 2, name: 'البصرة' },
    { id: 3, name: 'أربيل' },
    { id: 4, name: 'الموصل' },
    { id: 5, name: 'كربلاء' },
    { id: 6, name: 'النجف' },
    { id: 7, name: 'بابل' },
    { id: 8, name: 'ذي قار' },
    { id: 9, name: 'ديالى' },
    { id: 10, name: 'الأنبار' },
    { id: 11, name: 'صلاح الدين' },
    { id: 12, name: 'واسط' },
    { id: 13, name: 'المثنى' },
    { id: 14, name: 'القادسية' },
    { id: 15, name: 'كركوك' },
    { id: 16, name: 'دهوك' },
    { id: 17, name: 'السليمانية' },
    { id: 18, name: 'ميسان' }
  ]
}

// Get regions by city (mock data for now)
async function getRegionsByCity(cityId: number): Promise<any[]> {
  // Mock regions - replace with actual AlWaseet API call when available
  const regions: { [key: number]: any[] } = {
    1: [ // Baghdad
      { id: 101, name: 'الكرخ' },
      { id: 102, name: 'الرصافة' },
      { id: 103, name: 'الكاظمية' },
      { id: 104, name: 'الأعظمية' },
      { id: 105, name: 'الصدر' },
      { id: 106, name: 'الشعلة' },
      { id: 107, name: 'دورة الصحة' }
    ],
    2: [ // Basra
      { id: 201, name: 'البصرة القديمة' },
      { id: 202, name: 'الهارثة' },
      { id: 203, name: 'أبو الخصيب' }
    ]
  }
  return regions[cityId] || []
}

// Find city by name with intelligent matching
async function findCityByName(cityName: string): Promise<any | null> {
  const cities = await getCitiesFromAlWaseet()
  const normalizedName = cityName.toLowerCase().trim()
  
  // Direct match first
  let foundCity = cities.find(city => 
    city.name.toLowerCase() === normalizedName ||
    city.name.toLowerCase().includes(normalizedName) ||
    normalizedName.includes(city.name.toLowerCase())
  )
  
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
    }
    
    for (const [realCity, variants] of Object.entries(cityVariants)) {
      if (variants.some(variant => 
        variant.toLowerCase().includes(normalizedName) || 
        normalizedName.includes(variant.toLowerCase())
      )) {
        foundCity = cities.find(city => 
          city.name.toLowerCase().includes(realCity.toLowerCase())
        )
        if (foundCity) break
      }
    }
  }
  
  return foundCity
}

// Get default Baghdad city
async function getBaghdadCity(): Promise<any | null> {
  const cities = await getCitiesFromAlWaseet()
  return cities.find(city => 
    city.name.toLowerCase().includes('بغداد') || 
    city.name.toLowerCase().includes('baghdad')
  ) || null
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
    
    console.log('Processing order for employee:', employeeCode)
    console.log('Employee found:', JSON.stringify({
      user_id: employee.user_id,
      full_name: employee.full_name,
      role: employee.role,
      role_title: employee.role_title,
      employee_code: employee.employee_code
    }, null, 2))
    
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
      
      // Parse customer name - improved detection
      if ((lowerLine.includes('اسم') || lowerLine.includes('زبون') || lowerLine.includes('عميل') || lowerLine.includes('الزبون')) && !customerName) {
        customerName = line.replace(/^(اسم|زبون|عميل|الزبون)[:\s]*/i, '').trim()
      } else if (i === 0 && !customerName && !line.match(/07[5789]\d{8}/) && !lowerLine.includes('منتج')) {
        // First line as customer name if no phone number or product keyword
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
          let variantId = null
          
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
            
            console.log(`Product found: ${product.name}, Price: ${product.base_price}, Variant ID: ${product.product_variants?.[0]?.id}`)
            
            // Try to find price from variants first
            if (product.product_variants && product.product_variants.length > 0) {
              const activeVariants = product.product_variants.filter(v => v.is_active)
              if (activeVariants.length > 0) {
                // Use first active variant price
                variantId = activeVariants[0].id
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
            product_id: productId,
            variant_id: variantId
          })
        }
      }
    }
    
    // Set defaults if not found
    if (!customerName) customerName = defaultCustomerName
    if (!customerCity) customerCity = await getBaghdadCity()
    if (!customerRegion && customerCity) {
      const regions = await getRegionsByCity(customerCity.id)
      if (regions.length > 0) customerRegion = regions[0]
    }
    
    // Validate essential fields
    if (!customerPhone || items.length === 0) {
      const helpMessage = `❌ خطأ في الطلب!\n\n` +
        `يجب أن يحتوي الطلب على:\n• رقم هاتف صحيح (07xxxxxxxxx)\n• منتج واحد على الأقل\n\n` +
        `📋 مثال صحيح:\n` +
        `احمد علي\n` +
        `07701234567\n` +
        `بغداد الدورة\n` +
        `شارع الخليج\n` +
        `قميص أحمر 2 قطعة x 25000 د.ع\n` +
        `بنطال أزرق 1 قطعة x 35000 د.ع`
      
      await sendTelegramMessage(chatId, helpMessage)
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
        customer_address: customerAddress,
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
      p_customer_address: customerAddress,
      p_customer_city: customerCity?.name,
      p_customer_province: customerCity?.name, // Using city as province for now
      p_total_amount: totalPrice + defaultDeliveryFee,
      p_items: items,
      p_telegram_chat_id: chatId,
      p_employee_code: employee?.user_id || employeeCode
    })
    
    console.log('Order creation result:', orderId)
    
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
  try {
    const parts = text.split(' ')
    if (parts.length < 2) {
      await sendTelegramMessage(chatId, '❌ خطأ في التنسيق!\n\nاستخدم: /start [رمز_الموظف]\n\nمثال: /start EMP001')
      return
    }
    
    const employeeCode = parts[1].trim()
    
    // Call RPC to link telegram user
    const result = await supabase.rpc('link_telegram_user', {
      p_employee_code: employeeCode,
      p_telegram_chat_id: chatId
    })
    
    if (result.error) {
      console.error('Database error:', result.error)
      await sendTelegramMessage(chatId, `❌ خطأ في التسجيل: ${result.error.message}`)
      return
    }
    
    if (result.data && result.data.success) {
      const welcomeMessage = `🎉 مرحباً بك!

✅ تم ربط حسابك بنجاح
👤 الاسم: ${result.data.employee_name}
🏢 المنصب: ${result.data.role_title}
🔢 رمز الموظف: ${employeeCode}

🚀 يمكنك الآن البدء بإرسال الطلبات!

📚 اكتب /help للحصول على دليل الاستخدام`

      await sendTelegramMessage(chatId, welcomeMessage)
    } else {
      await sendTelegramMessage(chatId, `❌ فشل في التسجيل: ${result.data?.error || 'رمز الموظف غير صحيح أو مستخدم من قبل'}`)
    }
    
  } catch (error) {
    console.error('Error in employee registration:', error)
    await sendTelegramMessage(chatId, '❌ حدث خطأ في عملية التسجيل. يرجى المحاولة مرة أخرى.')
  }
}

// Handle callback queries for region selection
async function handleCallbackQuery(callbackQuery: any) {
  const { id: callbackId, data: callbackData, from, message } = callbackQuery
  const chatId = message.chat.id
  
  console.log('📞 معالجة callback query:', { callbackId, callbackData, chatId })
  
  // Parse callback data: "region_aiOrderId_regionId"
  if (callbackData.startsWith('region_')) {
    const parts = callbackData.split('_')
    if (parts.length === 3) {
      const aiOrderId = parts[1]
      const selectedRegionId = parseInt(parts[2])
      
      try {
        // Get current order data first
        const { data: currentOrder, error: fetchError } = await supabase
          .from('ai_orders')
          .select('order_data')
          .eq('id', aiOrderId)
          .single()
        
        if (fetchError || !currentOrder) {
          console.error('خطأ في جلب بيانات الطلب:', fetchError)
          await answerCallbackQuery(callbackId, '❌ خطأ في جلب البيانات')
          return
        }
        
        // Update ai_order with selected region
        const updatedOrderData = {
          ...currentOrder.order_data,
          region_confirmed: true,
          selected_region_id: selectedRegionId,
          requires_region_confirmation: false
        }
        
        const { error: updateError } = await supabase
          .from('ai_orders')
          .update({
            customer_region: selectedRegionId,
            order_data: updatedOrderData
          })
          .eq('id', aiOrderId)
        
        if (updateError) {
          console.error('خطأ في تحديث منطقة الطلب:', updateError)
          await answerCallbackQuery(callbackId, '❌ خطأ في التحديث')
          return
        }
        
        // Get region name for confirmation
        const regionCandidates = currentOrder.order_data?.region_candidates || []
        const selectedRegion = regionCandidates.find(r => r.id === selectedRegionId)
        
        // Send confirmation message
        const confirmationText = `✅ تم تحديد المنطقة بنجاح!\n📍 المنطقة المحددة: ${selectedRegion?.name || 'غير معروف'}\n\n🚀 سيتم معالجة الطلب الآن...`
        
        await sendTelegramMessage(chatId, confirmationText)
        await answerCallbackQuery(callbackId, 'تم التحديث بنجاح ✅')
        
        console.log('✅ تم تحديث منطقة الطلب الذكي:', { aiOrderId, selectedRegionId, regionName: selectedRegion?.name })
        
      } catch (error) {
        console.error('خطأ في معالجة اختيار المنطقة:', error)
        await answerCallbackQuery(callbackId, '❌ خطأ في المعالجة')
      }
    }
  }
}

// Main message handler
async function handleMessage(message: TelegramMessage) {
  const chatId = message.chat.id
  const text = message.text
  
  if (!text) return
  
  try {
    // Handle /start command for employee registration
    if (text.startsWith('/start')) {
      return await handleEmployeeRegistration(text, chatId)
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
المدينة/المحافظة
العنوان
المنتجات (اسم المنتج + الكمية + السعر)

مثال:
احمد علي
07701234567
بغداد الدورة حي الصحة
شارع الخليج
قميص أحمر 2 قطعة x 25000 د.ع
بنطال أزرق 1 قطعة x 35000 د.ع

💡 نصائح:
• يمكن كتابة عدة أرقام هواتف
• السعر اختياري (سيتم البحث في قاعدة البيانات)
• يمكن إضافة ملاحظات خاصة
• استخدم كلمة "تبديل" للطلبات التبديلية

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
  console.log('🔴 Telegram webhook called!')
  console.log('Request URL:', req.url)
  console.log('Request method:', req.method)

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    console.log('Request body:', JSON.stringify(body, null, 2))

    // Handle special actions from the app
    if (body.action === 'send_region_selection') {
      console.log('📤 إرسال خيارات المناطق للتليغرام...')
      const { chat_id, ai_order_id, candidates } = body
      
      if (candidates && candidates.length > 1) {
        await sendRegionSelectionKeyboard(chat_id, ai_order_id, candidates)
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // Handle regular Telegram updates
    const update: TelegramUpdate = body
    
    if (update.message) {
      const message = update.message
      console.log(`Processing message from chatId: ${message.chat.id}, text: "${message.text}"`)
      await handleMessage(message)
    }
    
    // Handle callback queries for region selection
    if (update.callback_query) {
      console.log('📞 معالجة callback query...')
      await handleCallbackQuery(update.callback_query)
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error processing webhook:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})