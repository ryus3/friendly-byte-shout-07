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

// جلب المسمى الوظيفي الحقيقي من جداول الأدوار (display_name)
async function getRoleDisplayName(userId: string, fallbackRole: 'admin' | 'manager' | 'employee' = 'employee'): Promise<string> {
  try {
    const { data: userRoles, error } = await supabase
      .from('user_roles')
      .select('roles(name, display_name, hierarchy_level)')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (!error && Array.isArray(userRoles) && userRoles.length > 0) {
      const roles = userRoles
        .map((r: any) => r.roles)
        .filter((r: any) => !!r);
      if (roles.length > 0) {
        // اختر الدور الأعلى حسب hierarchy_level إن وجد
        roles.sort((a: any, b: any) => (b?.hierarchy_level || 0) - (a?.hierarchy_level || 0));
        const top = roles[0];
        return top?.display_name || top?.name || (fallbackRole === 'admin' ? 'مدير عام' : fallbackRole === 'manager' ? 'مشرف' : 'موظف مبيعات');
      }
    }
  } catch (_) {}

  // محاكاة بسيطة في حال تعذر الجلب
  return fallbackRole === 'admin' ? 'مدير عام' : fallbackRole === 'manager' ? 'مشرف' : 'موظف مبيعات';
}

// توحيد سجل الموظف القادم من أي استعلام
function normalizeEmployeeRecord(raw: any) {
  if (!raw) return null;
  const user_id = raw.user_id || raw.id || null;
  const full_name = raw.full_name || raw.employee_name || raw.name || null;
  const employee_code = raw.employee_code || raw.code || null;
  const role = raw.role || 'unknown';
  return { user_id, full_name, employee_code, role };
}

// يربط رمز المستخدم بحسابه في التليغرام مع دعم كلا الجدولين
async function linkEmployeeCode(code: string, chatId: number) {
  try {
    // 1) الإجراء المخزن الأساسي
    const { data, error } = await supabase.rpc('link_telegram_user', {
      p_employee_code: code,
      p_telegram_chat_id: chatId
    });
    if (!error && data) return true;

    const normalized = code.trim().toUpperCase();

    // 2) إذا كان normalized هو telegram_code في employee_telegram_codes
    const { data: codeRow, error: codeErr } = await supabase
      .from('employee_telegram_codes')
      .select('id,user_id,telegram_chat_id,is_active')
      .ilike('telegram_code', normalized)
      .maybeSingle();

    if (!codeErr && codeRow && codeRow.is_active !== false) {
      // اربط بالجدول الحالي
      const { error: updErr } = await supabase
        .from('employee_telegram_codes')
        .update({
          telegram_chat_id: chatId,
          linked_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', codeRow.id);
      if (!updErr) {
        // مزامنة مع جدول telegram_employee_codes باستخدام employee_code من الملف الشخصي
        const { data: profile } = await supabase
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
      } catch (_) {}
    }

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
      
      // التحقق من المنتجات (يدعم + للفصل مع فهم المقاسات المختصرة)
      if (line.includes('+')) {
        const parts = line.split('+').map(p => p.trim()).filter(Boolean);
        let baseName = '';
        let baseColor = '';
        for (let idx = 0; idx < parts.length; idx++) {
          const part = parts[idx];
          const parsed = await parseProduct(part);
          if (idx === 0) {
            baseName = parsed.name || parsed.product_name || '';
            baseColor = parsed.color || '';
            items.push(parsed);
            continue;
          }
          const sizeOnly = isSizeOnly(part);
          if (sizeOnly) {
            const std = detectStandardSize(part) || parsed.size;
            items.push({
              ...parsed,
              name: baseName || parsed.name,
              product_name: baseName || parsed.product_name || parsed.name,
              color: parsed.color || baseColor || '',
              size: std || parsed.size || ''
            });
          } else {
            if (!parsed.name || parsed.name.toLowerCase() === part.toLowerCase()) {
              parsed.name = baseName || parsed.name;
            }
            if (!parsed.color) parsed.color = baseColor || parsed.color;
            items.push(parsed);
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
            ),
            product_departments (
              department_id,
              departments (id, name)
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
                ),
                product_departments (
                  department_id,
                  departments (id, name)
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
          // التحقق من صلاحيات الأقسام قبل المتابعة
          if (!allowAllProducts) {
            const productDeptIds = ((bestMatch as any).product_departments || []).map((pd: any) => String(pd?.department_id || pd?.departments?.id || '')).filter(Boolean);
            const intersect = productDeptIds.filter((id: string) => allowedDeptIds.includes(id));
            // لا تقيّد بالأقسام إذا لم يُحدد للمستخدم أقسام مسموحة أصلاً
            if ((allowedDeptIds && allowedDeptIds.length > 0) && productDeptIds.length > 0 && intersect.length === 0) {
              item.available = false;
              item.availability = 'not_permitted';
              (item as any).permission_scope = { scope: 'department', allowed: allowedDeptIds, product_departments: productDeptIds };
              item.price = 0;
              continue;
            }
          }

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
                const colorMatch = !item.color || (variant.colors?.name && variant.colors.name.toLowerCase().includes(item.color.toLowerCase()));
                const sizeMatch = !item.size || normalizeSizeLabel(variant.sizes?.name) === normalizeSizeLabel(item.size);
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

              // فحص توفر المخزون الحقيقي (المتاح = الكمية - المحجوز)
              const { data: invRow } = await supabase
                .from('inventory')
                .select('quantity, reserved_quantity')
                .eq('product_id', bestMatch.id)
                .eq('variant_id', selectedVariant.id)
                .maybeSingle();
              const qty = Number(invRow?.quantity || 0);
              const reserved = Number(invRow?.reserved_quantity || 0);
              const availableQty = Math.max(0, qty - reserved);
              const requested = Number(item.quantity || 1);

              // حفظ تفاصيل المخزون لأغراض الرسائل
              item.stock_quantity = qty;
              item.reserved_quantity = reserved;
              item.available_quantity = availableQty;
              item.available = availableQty >= requested;
              item.availability = item.available ? 'ok' : (availableQty > 0 ? 'insufficient' : 'out');

              // الزام اللون والمقاس لأقسام الملابس/الأحذية
              const deptNames = (bestMatch.product_departments || []).map((pd: any) => (pd?.departments?.name || '').toLowerCase()).filter(Boolean);
              const isClothingOrShoes = deptNames.some((n: string) => /(ملابس|لبس|أحذية|احذية|shoes|clothing)/i.test(n));
              if (isClothingOrShoes && (!item.color || !item.size)) {
                item.available = false;
                item.availability = 'missing_attributes';
                item.missing_attributes = { need_color: !item.color, need_size: !item.size } as any;
              }
            }
          }
          
          // تحديث سعر المنتج في القائمة
          item.price = productPrice;
          item.product_name = bestMatch.name; // حفظ الاسم الصحيح
          if (item.available !== false) {
            calculatedPrice += productPrice * item.quantity;
          }
          
          console.log(`Product found: ${bestMatch?.name}, Price: ${productPrice}, Variant ID: ${item.variant_id}`);
        } else {
          console.log(`Product not found for: ${item.name}`);
          // إذا لم نجد المنتج، اتركه بسعر 0 أو سعر افتراضي
          item.price = 0;
          item.available = false;
          item.availability = 'not_found';
          item.available_quantity = 0;
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

// إرسال ردود مختصرة وفق القالب المطلوب
const unavailableItems = items.filter(item => item.available === false);
const availableItems = items.filter(item => item.available !== false);
const totalItemsCount = items.length;
const availableItemsCount = availableItems.length;
const unavailableItemsCount = unavailableItems.length;

// قوائم المنتجات لكل حالة
const warnList = (unavailableItems.length ? unavailableItems : items).map(item => {
  const base = `${item.product_name || item.name}${item.color ? ` (${item.color})` : ''}${item.size ? ` ${item.size}` : ''} × ${item.quantity}`;
  const variantDesc = `${item.size ? `المقاس ${item.size}` : ''}${item.color ? `${item.size ? ' و' : ''}اللون ${item.color}` : ''}`.trim();
  const reason = (() => {
    if (item.availability === 'missing_attributes') {
      const miss = item.missing_attributes || {};
      if (miss.need_color && miss.need_size) return ' — بدون لون وبدون قياس';
      if (miss.need_color) return ' — بدون لون';
      if (miss.need_size) return ' — بدون قياس';
      return ' — يحتاج تحديد اللون والمقاس';
    }
    if (item.availability === 'insufficient') {
      const av = item.available_quantity ?? 0;
      return ` — الكمية غير كافية${variantDesc ? ` للمحددات (${variantDesc})` : ''} (المتاح ${av})`;
    }
    if (item.availability === 'out') {
      const sq = item.stock_quantity ?? 0;
      const rq = item.reserved_quantity ?? 0;
      if (sq === 0) return ` — ${variantDesc ? `${variantDesc} نافذ من المخزون` : 'نافذ من المخزون'}`;
      if (rq >= sq && sq > 0) return ` — ${variantDesc ? `${variantDesc} محجوز بالكامل` : 'محجوز بالكامل'}`;
      return ` — غير متاح حالياً${variantDesc ? ` (${variantDesc})` : ''}`;
    }
    if (item.availability === 'not_permitted') return ' — هذا المنتج غير ضمن صلاحياتك';
    if (item.availability === 'not_found') return ' — لا يوجد هكذا منتج لدينا رجاءا';
    return '';
  })();
  return `❌ غير متاح ${base}${reason}`;
}).join('\n');

const okList = availableItems.map(item => {
  return `✅ ${item.product_name || item.name}${item.color ? ` (${item.color})` : ''}${item.size ? ` ${item.size}` : ''} × ${item.quantity}`;
}).join('\n');

// المجموع يُحسب من المنتجات المتاحة فقط
const totalAvailable = availableItems.reduce((sum, item) => sum + ((item.price || item.unit_price || 0) * (item.quantity || 1)), 0);

// احتساب التوصيل إن وُجد
const deliveryFeeApplied = (deliveryType === 'توصيل') ? Number(currentDeliveryFee || 0) : 0;
const totalWithDelivery = totalAvailable + deliveryFeeApplied;

let message = '';
if (unavailableItemsCount > 0 && availableItemsCount > 0) {
message = [
  '⚠️ تنبيه توفر',
  `📱 الهاتف : ${customerPhone || '—'}`,
  okList,
  warnList,
  '',
  '⚠️ بعض المنتجات غير متوفرة حالياً أو محجوزة. الرجاء اختيار بديل داخل الموقع قبل الموافقة'
].join('\n');
} else if (unavailableItemsCount > 0) {
  message = [
    '⚠️ تنبيه توفر',
    `📱 الهاتف : ${customerPhone || '—'}`,
    warnList,
    '',
    '⚠️ بعض المنتجات غير متوفرة حالياً أو محجوزة. الرجاء اختيار بديل داخل الموقع قبل الموافقة'
  ].join('\n');
} else {
  message = [
    '✅ تم استلام الطلب!',
    '',
    `📱 الهاتف : ${customerPhone || '—'}`,
    okList,
    `• المبلغ الاجمالي : ${totalWithDelivery.toLocaleString()} د.ع`
  ].join('\n');
}

await sendTelegramMessage(chatId, message, 'HTML');

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

// تحويل الأرقام العربية إلى إنجليزية
function normalizeDigits(input: string): string {
  const map: Record<string, string> = { '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9' };
  return input.replace(/[٠-٩]/g, (d) => map[d] || d);
}

// تطبيع المقاسات إلى صيغة قياسية (S, M, L, XL, XXL, XXXL)
function normalizeSizeLabel(input?: string | null): string {
  if (!input) return '';
  const t = normalizeDigits(String(input)).toLowerCase().replace(/\s+/g, ' ').trim();
  // كشف سريع عبر الدالة القياسية
  const std = detectStandardSize(t);
  if (std) return std.toUpperCase();
  // مطابقة مع قاموس المرادفات
  const entries: [string, string[]][] = Object.entries(SIZE_SYNONYMS);
  for (const [stdKey, synonyms] of entries) {
    for (const s of synonyms) {
      const re = new RegExp(`(^|\\s)${s.replace(/\s+/g, '\\s*')}(\\s|$)`, 'i');
      if (re.test(t)) return stdKey.toUpperCase();
    }
  }
  // حالات مثل 2xl/3xl مباشرة
  if (/^2\s*x\s*l$/i.test(t) || /^2xl$/i.test(t)) return 'XXL';
  if (/^3\s*x\s*l$/i.test(t) || /^3xl$/i.test(t)) return 'XXXL';
  return t.toUpperCase();
}

// جميع صيغ المقاسات الشائعة بالعربي والإنجليزي
const SIZE_SYNONYMS: Record<string, string[]> = {
  'S': ['s','small','سمول','صغير'],
  'M': ['m','medium','ميديم','مديم','متوسط','وسط'],
  'L': ['l','large','لارج','كبير'],
  'XL': ['xl','x l','x','اكس','اكس لارج','اكس ال','إكس إل','اكسل'],
  'XXL': ['xxl','2xl','٢xl','٢ اكس','2 اكس','اكسين','اكسين لارج','دبل اكس','xx-l','x x l'],
  'XXXL': ['xxxl','3xl','٣xl','3 اكس','٣ اكس','ثلاثة اكس','ثلاث اكس','ثري اكس','xxx l','x x x l']
};

function sizeSynonymsRegex(): RegExp {
  const all = Object.values(SIZE_SYNONYMS).flat().map(s => s.replace(/\s+/g, '\\s*'));
  const base = ['s','m','l','xl','xxl','xxxl'];
  const pattern = `\\b(?:${[...base, ...all].join('|')})\\b`;
  return new RegExp(pattern, 'gi');
}

function detectStandardSize(text: string): string | null {
  const t = normalizeDigits(text).toLowerCase().replace(/\s+/g, ' ').trim();
  
  // تحقق محدد من "اكسين" أولاً
  if (/اكسين/i.test(t)) return 'XXL';
  
  // نماذج رقمية مثل 2xl / 3xl
  if (/(\b|\s)(3\s*x\s*l|3xl|٣\s*اكس|٣xl|ثلاثة\s*اكس|ثلاث\s*اكس)(\b|\s)/i.test(t)) return 'XXXL';
  if (/(\b|\s)(2\s*x\s*l|2xl|٢\s*اكس|٢xl|اكسين\s*لارج|دبل\s*اكس)(\b|\s)/i.test(t)) return 'XXL';
  if (/(^|\s)(xl|x\s*l|x|اكس\s*لارج|اكس\s*ال|إكس\s*إل|اكسل|اكس)(\s|$)/i.test(t)) return 'XL';
  // أساسية
  if (/(^|\s)(l|large|لارج|كبير)(\s|$)/i.test(t)) return 'L';
  if (/(^|\s)(m|medium|ميديم|مديم|متوسط|وسط)(\s|$)/i.test(t)) return 'M';
  if (/(^|\s)(s|small|سمول|صغير)(\s|$)/i.test(t)) return 'S';
  return null;
}

function isSizeOnly(text: string): boolean {
  const cleaned = normalizeDigits(text).toLowerCase().replace(/[^a-zA-Z\u0600-\u06FF\d\s]/g, ' ').trim();
  const withoutSizes = cleaned.replace(sizeSynonymsRegex(), '').replace(/\b(2xl|3xl)\b/gi, '').replace(/\s+/g, '');
  // إذا لم يتبق شيء تقريباً بعد إزالة المقاسات، فهو مقاس فقط
  return withoutSizes.length === 0 || /^\d{2,3}$/.test(withoutSizes);
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
  // مطابقة الصيغ العربية والإنجليزية إلى مقاس قياسي إن لم نجد أعلاه
  if (!size) {
    const std = detectStandardSize(text);
    if (std) size = std;
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
  productName = productName
    .replace(/\b(S|M|L|XL|XXL|XXXL|s|m|l|xl|xxl|xxxl|\d{2,3})\b/gi, '')
    .replace(sizeSynonymsRegex(), '')
    .trim();
  
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
        .replace(sizeSynonymsRegex(), '') // إزالة صيغ المقاس العربية
        .replace(/\s+/g, ' ')
        .trim();
    }
  }
  
  // تنظيف نهائي لاسم المنتج
  productName = productName.replace(/\s+/g, ' ').trim();
  
  return {
    name: productName || text,
    quantity: quantity,
    size: normalizeSizeLabel(size) || size,
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

💡 <b>الرمز يتكون من 6-7 أحرف/أرقام ويربطك بحسابك في النظام</b>

<i>أرسل رمزك الآن للبدء في استقبال الطلبات! 🚀</i>
        `);
        return new Response('OK', { status: 200 });
      }

      // محاولة ربط رمز الموظف
      if (/^[A-Z0-9]{6,8}$/i.test(text)) {
        const linked = await linkEmployeeCode(text.toUpperCase(), chatId);
        if (linked) {
          const newEmployee = await getEmployeeByTelegramId(chatId);
          const roleTitle = newEmployee?.role === 'admin' ? '👑 مدير' : 
                           newEmployee?.role === 'manager' ? '👨‍💼 مشرف' : '👤 موظف';
          const displayName = newEmployee?.full_name || [update.message.from.first_name, (update.message as any).from?.last_name].filter(Boolean).join(' ') || update.message.from.username || 'الموظف';
          
          await sendTelegramMessage(chatId, `
🎉 <b>تم ربط حسابك بنجاح!</b>

👋 أهلاً وسهلاً <b>${displayName}</b>!
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
• الرمز صحيح ومن 6-7 أحرف/أرقام
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