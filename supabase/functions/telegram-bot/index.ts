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

// Get bot token from database settings with env fallback
async function getBotToken(): Promise<string | null> {
  try {
    // 1) Try from settings table
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'telegram_bot_config')
      .single();

    if (!error && data) {
      const val = data.value;
      const tokenFromDb = typeof val === 'string' ? val : (val?.bot_token ?? null);
      if (tokenFromDb && String(tokenFromDb).trim().length > 0) {
        return String(tokenFromDb).trim();
      }
      console.log('Bot token not found in settings payload, will try env fallback');
    } else {
      console.log('No bot config found in settings, will try env fallback');
    }
  } catch (err) {
    console.error('Error getting bot token from DB, will try env fallback:', err);
  }

  // 2) Fallback to environment variable
  const envToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (envToken && envToken.trim().length > 0) return envToken.trim();

  console.error('Bot token not available (DB nor ENV)');
  return null;
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

// تحديد صلاحية المستخدم بدقة من جدول الأدوار
async function determineUserRole(userId: string): Promise<'admin' | 'manager' | 'employee'> {
  try {
    const { data: isAdmin } = await supabase.rpc('check_user_role', {
      p_user_id: userId,
      p_role_name: 'admin'
    });
    if (isAdmin) return 'admin';
  } catch (_) {}

  try {
    const { data: isManager } = await supabase.rpc('check_user_role', {
      p_user_id: userId,
      p_role_name: 'manager'
    });
    if (isManager) return 'manager';
  } catch (_) {}

  return 'employee';
}

// الحصول على الاسم المعروض للدور
async function getRoleDisplayName(userId: string, defaultRole: string = 'employee'): Promise<string> {
  try {
    const { data } = await supabase
      .from('user_roles')
      .select(`
        roles!inner (
          display_name
        )
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    
    return (data as any)?.roles?.display_name || defaultRole;
  } catch (_) {
    return defaultRole;
  }
}

// تطبيع سجل الموظف من الاستعلام
function normalizeEmployeeRecord(rawRecord: any): any {
  if (!rawRecord) return null;

  // محاولة الحصول على البيانات من التنسيق العادي أو jsonb
  const success = rawRecord.success !== false;
  const employee = rawRecord.employee || rawRecord;

  if (!success || !employee) return null;

  return {
    user_id: employee.user_id,
    full_name: employee.full_name || employee.name || 'موظف',
    role: employee.role || 'employee',
    role_title: employee.role_title || employee.display_name || employee.role || 'موظف',
    employee_code: employee.employee_code || null
  };
}

// دالة للربط تدعم ثلاث طرق للبحث
async function linkEmployeeCode(chatId: number, codeInput: string): Promise<boolean> {
  try {
    const normalized = codeInput?.trim().toLowerCase() || '';
    if (!normalized) return false;

    // 1) محاولة استخدام الدالة المخزونة للربط
    try {
      const { data: linkResult, error: linkErr } = await supabase.rpc('link_telegram_user', {
        p_employee_code: codeInput,
        p_chat_id: chatId
      });
      if (!linkErr && linkResult?.success) return true;
    } catch (_) {}

    // 2) إذا كان normalized موجود في usernames أو emails في جدول profiles
    const { data: profilesData, error: profErr } = await supabase
      .from('profiles')
      .select('user_id,username,email,employee_code')
      .or(`username.ilike.${normalized},email.ilike.${normalized}%`)
      .limit(3);

    if (!profErr && profilesData && profilesData.length > 0) {
      for (const profile of profilesData) {
        const exactMatch = profile.username?.toLowerCase() === normalized || 
                          profile.email?.toLowerCase() === normalized ||
                          profile.email?.toLowerCase().startsWith(normalized);
        if (exactMatch) {
          const codeRow = await supabase
            .from('employee_telegram_codes')
            .select('id')
            .eq('user_id', profile.user_id)
            .maybeSingle();
          if (codeRow.data) {
            await supabase
              .from('employee_telegram_codes')
              .update({ telegram_chat_id: chatId, linked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
              .eq('id', codeRow.data.id);
          } else {
            await supabase
              .from('employee_telegram_codes')
              .insert({ user_id: profile.user_id, telegram_chat_id: chatId, linked_at: new Date().toISOString() });
          }

          const { data: profile2 } = await supabase
            .from('profiles')
            .select('employee_code')
            .eq('user_id', codeRow.user_id)
            .maybeSingle();
          if (profile?.employee_code) {
            const { data: existingTel } = await supabase
              .from('telegram_employee_codes')
              .select('id')
              .eq('employee_code', profile.employee_code)
              .limit(1);
            if (existingTel && existingTel.length > 0) {
              await supabase
                .from('telegram_employee_codes')
                .update({ telegram_chat_id: chatId, linked_at: new Date().toISOString(), updated_at: new Date().toISOString(), is_active: true })
                .eq('id', existingTel[0].id);
            } else {
              await supabase
                .from('telegram_employee_codes')
                .insert({ employee_code: profile.employee_code, telegram_chat_id: chatId, is_active: true, linked_at: new Date().toISOString() });
            }
          }
          return true;
        }
      }
    }

    // 3) إذا كان normalized هو employee_code في telegram_employee_codes
    const { data: telRows, error: telErr } = await supabase
      .from('telegram_employee_codes')
      .select('id,employee_code,telegram_chat_id,is_active')
      .ilike('employee_code', normalized)
      .limit(1);

    if (!telErr && telRows && telRows.length > 0 && telRows[0].is_active !== false) {
      const row = telRows[0];
      const { error: upd2Err } = await supabase
        .from('telegram_employee_codes')
        .update({
          telegram_chat_id: chatId,
          linked_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', row.id);
      if (!upd2Err) return true;
    }

    return false;
  } catch (error) {
    console.error('Error linking employee code:', error);
    return false;
  }
}

async function getEmployeeByTelegramId(chatId: number) {
  // المحاولة الأولى: عبر الإجراء المخزن
  try {
    const { data, error } = await supabase.rpc('get_employee_by_telegram_id', {
      p_telegram_chat_id: chatId
    });
    if (!error && data && data.length > 0) {
      const raw = data[0];
      const norm = normalizeEmployeeRecord(raw);
      if (norm) {
        const finalRole = norm.role && norm.role !== 'unknown' ? norm.role : await determineUserRole(norm.user_id);
        const role_title = await getRoleDisplayName(norm.user_id, finalRole);
        return { ...norm, role: finalRole, role_title };
      }
    }
  } catch (err) {
    console.error('Error getting employee via RPC, will try fallback:', err);
  }

  // fallback 1: عبر جدول employee_telegram_codes باستخدام telegram_chat_id
  try {
    const { data: codeRow } = await supabase
      .from('employee_telegram_codes')
      .select('user_id')
      .eq('telegram_chat_id', chatId)
      .single();

    if (codeRow?.user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id, full_name, employee_code')
        .eq('user_id', codeRow.user_id)
        .single();
      if (profile) {
        const role = await determineUserRole(profile.user_id);
        const role_title = await getRoleDisplayName(profile.user_id, role);
        return {
          user_id: profile.user_id,
          full_name: profile.full_name,
          role,
          role_title,
          employee_code: profile.employee_code || null
        };
      }
    }
  } catch (_) {}

  // fallback 2: عبر جدول telegram_employee_codes (مربوط مباشرة برمز الموظف)
  try {
    const { data: telRows } = await supabase
      .from('telegram_employee_codes')
      .select('employee_code, user_id')
      .eq('telegram_chat_id', chatId)
      .limit(1);

    if (telRows && telRows.length > 0) {
      const empCode = telRows[0].employee_code;
      const userId = telRows[0].user_id;

      let profile: any = null;
      if (userId) {
        const res = await supabase
          .from('profiles')
          .select('user_id, full_name, employee_code')
          .eq('user_id', userId)
          .maybeSingle();
        profile = res.data;
      }

      if (!profile) {
        const res2 = await supabase
          .from('profiles')
          .select('user_id, full_name, employee_code')
          .eq('employee_code', empCode)
          .maybeSingle();
        profile = res2.data;
      }

      if (profile) {
        const role = await determineUserRole(profile.user_id);
        const role_title = await getRoleDisplayName(profile.user_id, role);
        return {
          user_id: profile.user_id,
          full_name: profile.full_name,
          role,
          role_title,
          employee_code: profile.employee_code || empCode
        };
      }
    }
  } catch (_) {}

  return null;
}

// دالة محسنة لفحص صحة اسم الزبون
function isValidCustomerName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  
  const trimmed = name.trim();
  if (trimmed.length === 0) return false;
  
  // رفض إذا كان رقماً فقط
  if (/^\d+$/.test(trimmed)) return false;
  
  // رفض إذا كان يحتوي على أرقام هاتف (7+ أرقام متتالية)
  if (/\d{7,}/.test(trimmed)) return false;
  
  // رفض إذا كان يحتوي على رموز هاتف مع أرقام
  if (/[\+\-\(\)\s]/.test(trimmed) && /\d/.test(trimmed)) return false;
  
  // رفض إذا كان يبدو مثل عنوان (يحتوي على كلمات جغرافية)
  const addressWords = ['بغداد', 'البصرة', 'أربيل', 'الموصل', 'كربلاء', 'النجف', 'شارع', 'حي', 'منطقة', 'محلة', 'قضاء', 'ناحية', 'مجمع', 'عمارة', 'بناية', 'مقابل', 'قرب', 'جانب', 'الدورة', 'الكرخ', 'الرصافة'];
  if (addressWords.some(word => trimmed.toLowerCase().includes(word.toLowerCase()))) return false;
  
  // رفض الرموز غير المناسبة
  if (/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s\w]/.test(trimmed)) return false;
  
  return true;
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
    let deliveryType = 'توصيل'; // طلبات التليغرام توصيل فقط
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
    const currentDeliveryFee = defaultDeliveryFee;

    // صلاحيات الأقسام للموظف
    let allowAllProducts = false;
    let allowedDeptIds: string[] = [];
    if (employee?.user_id) {
      try {
        const role = await determineUserRole(employee.user_id);
        allowAllProducts = (role === 'admin' || role === 'manager');
        if (!allowAllProducts) {
          const { data: deptPerm } = await supabase
            .from('user_product_permissions')
            .select('has_full_access, allowed_items')
            .eq('user_id', employee.user_id)
            .eq('permission_type', 'department')
            .maybeSingle();
          if (deptPerm) {
            if ((deptPerm as any).has_full_access) {
              allowAllProducts = true;
            } else if (Array.isArray((deptPerm as any).allowed_items)) {
              allowedDeptIds = ((deptPerm as any).allowed_items as any[]).map((id: any) => String(id));
            }
          }
        }
      } catch (err) {
        console.error('Error checking department permissions:', err);
      }
    }

    // إضافة تجمع بيانات المنتجات مع دعم وزان محسّن للبحث
    const { data: productsData } = await supabase
      .from('products')
      .select(`
        id,
        name,
        price,
        cost_price,
        product_variants (
          id,
          sku,
          price,
          cost_price,
          quantity,
          reserved,
          sizes (id, name),
          colors (id, name),
          barcode
        ),
        product_departments!inner (
          department_id
        )
      `)
      .eq('is_active', true);

    // فلترة المنتجات حسب صلاحيات الأقسام
    const accessibleProducts = allowAllProducts 
      ? productsData || []
      : (productsData || []).filter(product => 
          product.product_departments?.some((pd: any) => 
            allowedDeptIds.includes(String(pd.department_id))
          )
        );

    console.log(`Employee found: ${JSON.stringify(employee)}`);

    // تحليل النص لاستخراج معلومات الطلب مع تحسين منطق الاسم
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // الخط الأول: اسم العميل أو العنوان (حسب القواعد المحسنة)
      if (i === 0) {
        if (isValidCustomerName(line)) {
          customerName = line;
        } else {
          // إذا لم يكن اسماً صحيحاً، استخدم الاسم الافتراضي واعتبر السطر عنواناً
          customerName = defaultCustomerName;
          customerAddress = line;
        }
        continue;
      }

      // رقم الهاتف
      if (/^(\+964|0)?7[0-9]{8,9}$/.test(line.replace(/[\s\-\(\)]/g, ''))) {
        if (!customerPhone) {
          customerPhone = line;
        } else if (!customerSecondaryPhone) {
          customerSecondaryPhone = line;
        }
        continue;
      }

      // العنوان (إذا لم يكن محدداً بالفعل)
      if (!customerAddress && (line.includes('بغداد') || line.includes('البصرة') || 
          line.includes('شارع') || line.includes('حي') || line.includes('منطقة'))) {
        customerAddress = line;
        continue;
      }

      // المنتجات
      const productMatch = line.toLowerCase();
      let foundProduct = null;
      let bestScore = 0;

      for (const product of accessibleProducts) {
        const score = calculateProductScore(productMatch, product);
        if (score > bestScore && score > 0.4) {
          bestScore = score;
          foundProduct = product;
        }
      }

      if (foundProduct) {
        const productInfo = parseProductLine(line, foundProduct);
        if (productInfo) {
          console.log(`Product found: ${foundProduct.name}, Price: ${productInfo.price}, Variant ID: ${productInfo.variant_id}`);
          items.push(productInfo);
          totalPrice += productInfo.price * productInfo.quantity;
        }
      }
    }

    // ضمان وجود اسم عميل صحيح
    if (!customerName || !isValidCustomerName(customerName)) {
      customerName = defaultCustomerName;
    }

    // إنشاء الطلب في قاعدة البيانات
    const orderData = {
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_address: customerAddress || 'بغداد',
      customer_city: extractCityFromAddress(customerAddress) || 'بغداد',
      customer_province: extractProvinceFromAddress(customerAddress) || '',
      total_amount: totalPrice,
      delivery_fee: currentDeliveryFee,
      items: items,
      source: 'telegram',
      created_by: employeeCode,
      status: 'pending',
      telegram_chat_id: chatId,
      order_data: {
        delivery_type: deliveryType,
        source: 'telegram',
        notes: orderNotes
      }
    };

    // تحقق من وجود طلب مشابه للتجنب التكرار
    const orderHash = generateOrderHash(orderData, text);
    const { data: existingOrder } = await supabase
      .from('ai_orders')
      .select('id')
      .eq('telegram_chat_id', chatId)
      .eq('created_by', employeeCode)
      .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // آخر 5 دقائق
      .limit(1);

    if (existingOrder && existingOrder.length > 0) {
      console.log('Duplicate order detected, skipping creation');
      await sendTelegramMessage(chatId, `
⚠️ <b>طلب مكرر</b>

تم اكتشاف طلب مشابه في آخر 5 دقائق.
إذا كنت تريد إنشاء طلب جديد، يرجى الانتظار قليلاً أو تعديل تفاصيل الطلب.
      `);
      return;
    }

    const { data: newOrder, error } = await supabase
      .from('ai_orders')
      .insert(orderData)
      .select()
      .single();

    if (error) {
      console.error('Error creating order:', error);
      await sendTelegramMessage(chatId, `
❌ <b>خطأ في إنشاء الطلب</b>

${error.message}

الرجاء المحاولة مرة أخرى مع التأكد من صحة البيانات.
      `);
      return;
    }

    console.log('Order creation result:', { orderId: newOrder?.id, error: error?.message || null });

    // رسالة تأكيد النجاح
    const itemsList = items.map(item => 
      `• ${item.productName} (${item.color} ${item.size}) - ${item.quantity} قطعة - ${item.price.toLocaleString()} د.ع`
    ).join('\n');

    await sendTelegramMessage(chatId, `
✅ <b>تم إنشاء الطلب بنجاح!</b>

👤 <b>اسم الزبون:</b> ${customerName}
📱 <b>رقم الهاتف:</b> ${customerPhone || 'غير محدد'}
📍 <b>العنوان:</b> ${customerAddress || 'غير محدد'}

📦 <b>المنتجات:</b>
${itemsList}

💰 <b>المجموع:</b> ${totalPrice.toLocaleString()} د.ع
🚚 <b>رسوم التوصيل:</b> ${currentDeliveryFee.toLocaleString()} د.ع
💵 <b>الإجمالي:</b> ${(totalPrice + currentDeliveryFee).toLocaleString()} د.ع

📋 <b>رقم الطلب:</b> ${newOrder.id}
⏳ <b>الحالة:</b> قيد المراجعة

سيتم مراجعة طلبك من قبل الإدارة وإشعارك بالنتيجة.
    `);

  } catch (error) {
    console.error('Error processing order:', error);
    await sendTelegramMessage(chatId, `
❌ <b>خطأ في معالجة الطلب</b>

حدث خطأ أثناء معالجة طلبك. الرجاء المحاولة مرة أخرى.

📝 <b>للمساعدة:</b> استخدم الأمر /help
    `);
  }
}

// دالة لحساب تشابه المنتج مع النص
function calculateProductScore(searchText: string, product: any): number {
  const productName = product.name.toLowerCase();
  const searchLower = searchText.toLowerCase();
  
  // تشابه دقيق
  if (searchLower.includes(productName) || productName.includes(searchLower)) {
    return 1.0;
  }
  
  // تشابه جزئي بناءً على الكلمات
  const productWords = productName.split(/\s+/);
  const searchWords = searchLower.split(/\s+/);
  
  let matchCount = 0;
  for (const prodWord of productWords) {
    if (prodWord.length > 2) {
      for (const searchWord of searchWords) {
        if (searchWord.includes(prodWord) || prodWord.includes(searchWord)) {
          matchCount++;
          break;
        }
      }
    }
  }
  
  return matchCount / Math.max(productWords.length, searchWords.length);
}

// دالة لتحليل سطر المنتج
function parseProductLine(line: string, product: any): any {
  const productVariants = product.product_variants || [];
  let selectedVariant = null;
  let quantity = 1;
  
  // البحث عن الكمية
  const quantityMatch = line.match(/(\d+)\s*(قطعة|حبة|كيلو|شنطة|حذاء|قميص|بنطال|فستان)?/);
  if (quantityMatch) {
    quantity = parseInt(quantityMatch[1]);
  }
  
  // البحث عن اللون والحجم
  let bestVariant = null;
  let bestScore = 0;
  
  for (const variant of productVariants) {
    let score = 0.5; // نقطة أساسية
    
    const colorName = variant.colors?.name?.toLowerCase() || '';
    const sizeName = variant.sizes?.name?.toLowerCase() || '';
    const lineLower = line.toLowerCase();
    
    // تحقق من اللون
    if (colorName && lineLower.includes(colorName)) {
      score += 0.3;
    }
    
    // تحقق من الحجم
    if (sizeName && lineLower.includes(sizeName)) {
      score += 0.3;
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestVariant = variant;
    }
  }
  
  selectedVariant = bestVariant || productVariants[0] || null;
  
  if (!selectedVariant) {
    return null;
  }
  
  const price = selectedVariant.price || product.price || 0;
  
  return {
    product_id: product.id,
    variant_id: selectedVariant.id,
    productName: product.name,
    color: selectedVariant.colors?.name || '',
    size: selectedVariant.sizes?.name || '',
    quantity: quantity,
    price: price,
    unit_price: price,
    costPrice: selectedVariant.cost_price || product.cost_price || 0,
    sku: selectedVariant.sku || '',
    barcode: selectedVariant.barcode || ''
  };
}

// دالة استخراج المدينة من العنوان
function extractCityFromAddress(address: string): string | null {
  if (!address) return null;
  
  const iraqiCities = ['بغداد', 'البصرة', 'أربيل', 'الموصل', 'كربلاء', 'النجف', 'بابل', 'ذي قار', 'ديالى', 'الأنبار'];
  
  for (const city of iraqiCities) {
    if (address.toLowerCase().includes(city.toLowerCase())) {
      return city;
    }
  }
  
  return null;
}

// دالة استخراج المحافظة من العنوان
function extractProvinceFromAddress(address: string): string | null {
  if (!address) return null;
  
  const addressLower = address.toLowerCase();
  
  // أنماط شائعة للمناطق
  const patterns = [
    /منطقة\s+([^،\s]+)/,
    /حي\s+([^،\s]+)/,
    /شارع\s+([^،\s]+)/,
    /محلة\s+([^،\s]+)/,
    /قضاء\s+([^،\s]+)/
  ];
  
  for (const pattern of patterns) {
    const match = address.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

// دالة لتوليد توقيع فريد للطلب لتجنب التكرار
function generateOrderHash(orderData: any, originalText: string): string {
  const hashData = {
    customer_phone: orderData.customer_phone,
    items: orderData.items.map((item: any) => ({
      product_id: item.product_id,
      quantity: item.quantity
    })),
    text_length: originalText.length,
    total_amount: orderData.total_amount
  };
  
  return JSON.stringify(hashData);
}

serve(async (req) => {
  console.log('🔴 Telegram webhook called!');
  console.log('Request method:', req.method);
  console.log('Request URL:', req.url);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const update: TelegramUpdate = await req.json();
    console.log('Received update:', JSON.stringify(update, null, 2));

    if (!update.message?.text || !update.message?.chat?.id) {
      return new Response('OK', { status: 200 });
    }

    const chatId = update.message.chat.id;
    const text = update.message.text.trim();
    const messageId = update.message.message_id;
    const updateId = update.update_id;

    // فحص التكرار على مستوى التحديث لمنع معالجة نفس الرسالة مرتين
    const { data: existingUpdate } = await supabase
      .from('telegram_processed_updates')
      .select('update_id')
      .eq('update_id', updateId)
      .eq('chat_id', chatId)
      .eq('message_id', messageId)
      .maybeSingle();

    if (existingUpdate) {
      console.log('Update already processed, skipping:', updateId);
      return new Response('OK', { status: 200 });
    }

    // تسجيل التحديث كمعالج
    await supabase
      .from('telegram_processed_updates')
      .insert({
        update_id: updateId,
        chat_id: chatId,
        message_id: messageId,
        processed_at: new Date().toISOString()
      });

    console.log(`Processing message from chatId: ${chatId}, text: "${text}"`);

    // Check if user is linked
    const employee = await getEmployeeByTelegramId(chatId);

    if (!employee) {
      // Attempt to link using provided code
      if (text.length >= 3 && text.length <= 15) {
        const linkSuccess = await linkEmployeeCode(chatId, text);
        if (linkSuccess) {
          const newEmployee = await getEmployeeByTelegramId(chatId);
          if (newEmployee) {
            await sendTelegramMessage(chatId, `
🎉 <b>تم ربط حسابك بنجاح!</b>

👤 <b>مرحباً ${newEmployee.full_name}</b>
🎯 <b>صلاحيتك:</b> ${newEmployee.role_title}

🚀 <b>يمكنك الآن:</b>
• إنشاء طلبات جديدة
• متابعة حالة طلباتك
• عرض إحصائياتك

📝 <b>لبدء استخدام النظام:</b>
• أرسل /help للمساعدة
• أرسل تفاصيل طلب جديد مباشرة

<b>مثال على طلب:</b>
<i>أحمد محمد - بغداد - الكرادة شارع 14
قميص أبيض - كبير - 2
بنطال أسود - متوسط - 1</i>

🎊 <b>مرحباً بك في فريق العمل!</b>
            `);
          }
        } else {
          await sendTelegramMessage(chatId, `
❌ <b>رمز الموظف غير صحيح</b>

الرمز الذي أدخلته غير موجود أو غير نشط.

🔍 <b>تأكد من:</b>
• صحة الرمز (6-7 أحرف/أرقام)
• أن الرمز نشط في النظام
• عدم وجود مسافات إضافية

💡 <b>احصل على رمزك من إعدادات النظام في موقع RYUS</b>
          `);
        }
      } else {
        await sendTelegramMessage(chatId, `
🔐 <b>يجب ربط حسابك أولاً</b>

أرسل رمز الموظف الخاص بك (6-7 أحرف/أرقام).

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
      // تم إلغاء رسالة الانتظار بناءً على طلبكم
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