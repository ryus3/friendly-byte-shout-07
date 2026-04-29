import devLog from './devLogger';
import { normalizePhone } from '../utils/phoneUtils';
import { supabase } from './customSupabaseClient';

// ======== القسم 1: دوال المساعدة ========

/**
 * Handle phone number formatting for MODON API
 * Uses same logic as Al Waseet for consistency
 */
export function formatPhoneForModon(phone) {
  if (!phone) return '';
  
  // ✅ استخدام normalizePhone من phoneUtils (نفس منطق الوسيط)
  const normalized = normalizePhone(phone);
  
  if (!normalized || normalized.length !== 11) {
    devLog.warn('⚠️ رقم غير صحيح بعد التنسيق:', { original: phone, normalized });
    return '';
  }
  
  // Remove leading 0 and add +964
  const withoutZero = normalized.startsWith('0') ? normalized.slice(1) : normalized;
  const formatted = `+964${withoutZero}`;
  
  devLog.log('📞 تنسيق رقم الهاتف:', {
    original: phone,
    normalized,
    formatted,
    isValid: isValidModonPhone(formatted)
  });
  
  return formatted;
}

/**
 * Validate MODON phone number format
 * Format: +964 + 10 digits = 14 characters total
 */
export function isValidModonPhone(phone) {
  if (!phone) return false;
  // ✅ التنسيق الصحيح: +964 متبوعة بـ 10 أرقام (7XXXXXXXXX)
  const phoneRegex = /^\+9647\d{9}$/;
  return phoneRegex.test(phone);
}

// ======== القسم 2: المصادقة ========

/**
 * Login to MODON and get authentication token
 * @param {string} username - MODON username
 * @param {string} password - MODON password
 * @returns {Promise<Object>} Login response with token
 */
export async function loginToModon(username, password) {
  try {
    devLog.log('🔐 تسجيل دخول إلى مدن...');
    
    const data = await handleModonApiCall(
      'login',
      'POST',
      null,
      { username, password },
      null,
      true
    );
    
    if (data.status === true && data.errNum === 'S000' && data.data?.token) {
      devLog.log('✅ تم تسجيل الدخول بنجاح إلى مدن');
      return {
        success: true,
        token: data.data.token,
        merchantId: data.data.merchant_id || null,
        username: username
      };
    }
    
    throw new Error(data.msg || 'فشل تسجيل الدخول إلى مدن');
  } catch (error) {
    console.error('❌ خطأ في تسجيل الدخول إلى مدن:', error);
    throw error;
  }
}

// ======== القسم 3: التواصل مع API ========

/**
 * Generic function to handle MODON API calls through proxy
 * ✅ محدّث: يستخدم supabase.functions.invoke بدلاً من fetch مباشر (نفس نمط الوسيط)
 */
async function handleModonApiCall(endpoint, method, token, payload = null, queryParams = null, isFormData = false) {
  devLog.log('🟢 handleModonApiCall:', { endpoint, method, hasToken: !!token });
  
  try {
    // ✅ التحقق من صحة المعاملات
    if (!endpoint) {
      throw new Error('❌ Endpoint is required');
    }
    
    // ✅ استثناء: endpoint "login" لا يحتاج token
    if (endpoint !== 'login') {
      if (!token || typeof token !== 'string' || token.length === 0) {
        throw new Error('❌ MODON: توكن غير صالح أو مفقود');
      }
    }
    
    const requestBody = {
      endpoint,
      method,
      token: token || null,
      payload: payload || null,
      queryParams: queryParams || null,
      isFormData: isFormData || false
    };
    
    // ✅ استخدام supabase.functions.invoke بدلاً من fetch (مثل الوسيط)
    const { data, error } = await supabase.functions.invoke('modon-proxy', {
      body: requestBody
    });
    
    if (error) {
      let errorMessage = `فشل الاتصال بـ modon-proxy: ${error.message}`;
      
      // محاولة قراءة تفاصيل الخطأ
      try {
        if (error.context) {
          const errorBody = await error.context.json();
          errorMessage = errorBody.msg || errorMessage;
        }
      } catch {
        // تجاهل أخطاء parsing
      }
      
      console.error('❌ MODON Proxy Error:', errorMessage);
      throw new Error(errorMessage);
    }
    
    if (!data) {
      throw new Error('لم يتم استلام رد من modon-proxy');
    }
    
    devLog.log('📥 MODON Response:', { 
      status: data.status, 
      errNum: data.errNum,
      hasData: !!data.data,
      dataLength: Array.isArray(data.data) ? data.data.length : 'N/A'
    });
    
    return data;
    
  } catch (error) {
    console.error('🔴 handleModonApiCall Error:', error.message);
    throw error;
  }
}

// ======== القسم 4: جلب البيانات ========

/**
 * Get all cities from MODON
 */
export async function getCities(token) {
  try {
    const data = await handleModonApiCall('citys', 'GET', token);
    
    if (data.status === true && data.errNum === 'S000') {
      devLog.log(`✅ تم جلب ${data.data?.length || 0} مدينة من مدن`);
      return data.data || [];
    }
    
    throw new Error(data.msg || 'فشل جلب المدن من مدن');
  } catch (error) {
    console.error('❌ خطأ في جلب المدن من مدن:', error);
    throw error;
  }
}

/**
 * Get regions for a specific city from MODON
 */
export async function getRegionsByCity(token, cityId) {
  try {
    const data = await handleModonApiCall(
      'regions',
      'GET',
      token,
      null,
      { city_id: cityId }
    );
    
    if (data.status === true && data.errNum === 'S000') {
      devLog.log(`✅ تم جلب ${data.data?.length || 0} منطقة من مدن للمدينة ${cityId}`);
      return data.data || [];
    }
    
    throw new Error(data.msg || 'فشل جلب المناطق من مدن');
  } catch (error) {
    console.error('❌ خطأ في جلب المناطق من مدن:', error);
    throw error;
  }
}

/**
 * Get package sizes from MODON
 */
export async function getPackageSizes(token) {
  try {
    const data = await handleModonApiCall('package-sizes', 'GET', token);
    
    if (data.status === true && data.errNum === 'S000') {
      devLog.log(`✅ تم جلب ${data.data?.length || 0} حجم طرد من مدن`);
      return data.data || [];
    }
    
    throw new Error(data.msg || 'فشل جلب أحجام الطرود من مدن');
  } catch (error) {
    console.error('❌ خطأ في جلب أحجام الطرود من مدن:', error);
    throw error;
  }
}

/**
 * Get all merchant orders directly from MODON
 * 📦 جلب جميع طلبات التاجر مباشرة (بدون فواتير)
 */
export async function getAllMerchantOrders(token) {
  devLog.log('📦 getAllMerchantOrders: جلب الطلبات المباشرة من MODON');
  
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    devLog.warn('⚠️ getAllMerchantOrders: توكن غير صالح');
    return [];
  }
  
  try {
    const data = await handleModonApiCall(
      'merchant-orders',
      'GET',
      token,
      null,
      { token },
      false
    );
    
    if (data.status === true && data.errNum === 'S000') {
      devLog.log(`✅ تم جلب ${data.data?.length || 0} طلب مباشر من MODON`);
      return data.data || [];
    }
    
    devLog.warn('⚠️ MODON API returned non-success:', data.errNum, data.msg);
    return [];
    
  } catch (error) {
    console.error('❌ getAllMerchantOrders Error:', error.message);
    return [];
  }
}

/**
 * Get all merchant orders from MODON (طريقة مزدوجة: مباشرة + فواتير)
 * ✅ تجمع بين الطريقتين لضمان الحصول على جميع الطلبات
 */
export async function getMerchantOrders(token) {
  try {
    devLog.log('📦 [MODON] بدء جلب الطلبات...');
    
    let allOrders = [];
    let ordersFromDirect = [];
    let ordersFromInvoices = [];
    
    // ============ الطريقة 1: جلب الطلبات مباشرة ============
    ordersFromDirect = await getAllMerchantOrders(token);
    devLog.log(`[1/2] جلب ${ordersFromDirect.length} طلب مباشر`);
    
    // ============ الطريقة 2: جلب الطلبات من الفواتير ============
    try {
      const invoices = await getMerchantInvoices(token);
      
      if (invoices && invoices.length > 0) {
        for (const invoice of invoices) {
          try {
            const invoiceData = await getInvoiceOrders(token, invoice.id);
            const orders = invoiceData?.orders || [];
            
            if (orders && orders.length > 0) {
              ordersFromInvoices = ordersFromInvoices.concat(orders);
            }
          } catch (error) {
            // تجاهل أخطاء الفاتورة الفردية
          }
        }
      }
      
      devLog.log(`[2/2] جلب ${ordersFromInvoices.length} طلب من الفواتير`);
    } catch (error) {
      devLog.warn('⚠️ تعذر جلب الطلبات من الفواتير:', error.message);
    }
    
    // ============ دمج وإزالة التكرار ============
    const ordersMap = new Map();
    
    // أولوية للطلبات المباشرة (أحدث)
    ordersFromDirect.forEach(order => {
      if (order.qr_id) {
        ordersMap.set(order.qr_id, order);
      }
    });
    
    // إضافة طلبات الفواتير (إذا لم تكن موجودة)
    ordersFromInvoices.forEach(order => {
      if (order.qr_id && !ordersMap.has(order.qr_id)) {
        ordersMap.set(order.qr_id, order);
      }
    });
    
    allOrders = Array.from(ordersMap.values());
    
    devLog.log(`📊 [MODON] النتيجة: ${allOrders.length} طلب (مباشر: ${ordersFromDirect.length}, فواتير: ${ordersFromInvoices.length})`);
    
    return allOrders;
    
  } catch (error) {
    console.error('❌ [MODON] خطأ غير متوقع:', error.message);
    return [];
  }
}

// ======== القسم 5: إدارة الطلبات ========

/**
 * Map order data to MODON fields
 */
function mapToModonFields(orderData) {
  // ✅ استخدام customer_address أو location مباشرة
  const cleanedLocation = orderData.customer_address || orderData.address || orderData.client_address || orderData.location || '';
  
  // ✅ نفس معالجة السعر كالوسيط - دعم الإرجاع والاستبدال
  const finalPrice = orderData.final_amount || orderData.price || orderData.final_total || orderData.total_amount || 0;
  const merchantPrice = Math.round(Number(finalPrice));
  
  return {
    client_name: orderData.customer_name || orderData.name || orderData.client_name || '',
    client_mobile: orderData.customer_phone || orderData.phone || orderData.client_mobile || '',
    client_mobile2: orderData.customer_phone2 || orderData.phone2 || orderData.client_mobile2 || '',
    // ✅ إصلاح city_id و region_id - نفس الترتيب كالوسيط
    city_id: parseInt(orderData.city_id || orderData.customer_city_id || orderData.modon_city_id || 0),
    region_id: parseInt(orderData.region_id || orderData.customer_region_id || orderData.modon_region_id || 0),
    location: cleanedLocation,
    type_name: orderData.details || orderData.type_name || 'طلب عادي',
    items_number: parseInt(orderData.items_number || orderData.quantity || 1),
    price: merchantPrice,  // ✅ استخدام merchantPrice (دعم الإرجاع/الاستبدال)
    package_size: parseInt(orderData.package_size_id || orderData.size || orderData.package_size || 1),
    merchant_notes: orderData.merchant_notes || orderData.notes || '',
    // ✅ دعم الإرجاع والاستبدال بشكل صحيح
    replacement: (orderData.order_type === 'return' || orderData.order_type === 'replacement' || orderData.type === 'replacement' || parseInt(orderData.replacement || 0) === 1) ? 1 : 0
  };
}

/**
 * Create order in MODON
 */
export async function createModonOrder(orderData, token) {
  try {
    devLog.log('📝 إنشاء طلب جديد في مدن...');
    
    // تحويل البيانات إلى صيغة MODON
    const mappedData = mapToModonFields(orderData);
    
    // تنسيق أرقام الهواتف
    if (mappedData.client_mobile) {
      const formattedPhone = formatPhoneForModon(mappedData.client_mobile);
      if (!formattedPhone || !isValidModonPhone(formattedPhone)) {
        throw new Error('رقم الهاتف الأساسي غير صالح لمدن. يجب أن يكون بصيغة +9647XXXXXXXXX');
      }
      mappedData.client_mobile = formattedPhone;
    }
    
    if (mappedData.client_mobile2) {
      const formattedPhone2 = formatPhoneForModon(mappedData.client_mobile2);
      if (formattedPhone2 && isValidModonPhone(formattedPhone2)) {
        mappedData.client_mobile2 = formattedPhone2;
      } else {
        delete mappedData.client_mobile2;
      }
    }
    
    devLog.log('📋 بيانات الطلب المُحوَّلة:', mappedData);
    
    const data = await handleModonApiCall(
      'create-order',
      'POST',
      token,
      mappedData,
      null,
      true // isFormData
    );
    
    if (data.status === true && (data.errNum === 'S000' || data.errNum === '0')) {
      devLog.log('✅ تم إنشاء الطلب بنجاح في مدن');
      return {
        success: true,
        data: data.data,
        qr_id: data.data?.qr_id || data.data?.id,
        id: data.data?.id
      };
    }

    // ✅ خطأ city/region من مدن (errNum:21 على create-order)
    if (data.errNum === 21 || data.errNum === '21') {
      throw new Error(
        'مدن رفضت إنشاء الطلب: المحافظة/المنطقة غير صالحة في حساب مدن، أو الحساب لا يملك صلاحية الإنشاء. ' +
        'حدّث كاش مدن من إدارة شركات التوصيل ثم أعد المحاولة.'
      );
    }

    throw new Error(data.msg || 'فشل إنشاء الطلب في مدن');
  } catch (error) {
    console.error('❌ خطأ في إنشاء الطلب في مدن:', error);
    throw error;
  }
}

/**
 * Edit order in MODON
 */
export async function editModonOrder(orderData, token) {
  try {
    devLog.log('✏️ تعديل الطلب في مدن...');
    
    // تحويل البيانات إلى صيغة MODON
    const mappedData = mapToModonFields(orderData);
    mappedData.qr_id = orderData.qr_id || orderData.tracking_number || orderData.delivery_partner_order_id;
    
    if (!mappedData.qr_id) {
      throw new Error('رقم الطلب (qr_id) مطلوب للتعديل');
    }
    
    // تنسيق أرقام الهواتف
    if (mappedData.client_mobile) {
      const formattedPhone = formatPhoneForModon(mappedData.client_mobile);
      if (!formattedPhone || !isValidModonPhone(formattedPhone)) {
        throw new Error('رقم الهاتف الأساسي غير صالح لمدن');
      }
      mappedData.client_mobile = formattedPhone;
    }
    
    if (mappedData.client_mobile2) {
      const formattedPhone2 = formatPhoneForModon(mappedData.client_mobile2);
      if (formattedPhone2 && isValidModonPhone(formattedPhone2)) {
        mappedData.client_mobile2 = formattedPhone2;
      } else {
        delete mappedData.client_mobile2;
      }
    }
    
    devLog.log('📋 بيانات التعديل:', mappedData);
    
    const data = await handleModonApiCall(
      'edit-order',
      'POST',
      token,
      mappedData,
      null,
      true // isFormData
    );
    
    if (data.status === true && (data.errNum === 'S000' || data.errNum === '0')) {
      devLog.log('✅ تم تعديل الطلب بنجاح في مدن');
      return {
        success: true,
        data: data.data,
        message: 'تم تحديث الطلب في مدن بنجاح'
      };
    }
    
    throw new Error(data.msg || 'فشل تعديل الطلب في مدن');
  } catch (error) {
    console.error('❌ خطأ في تعديل الطلب في مدن:', error);
    throw error;
  }
}

/**
 * Delete orders in MODON
 */
export async function deleteModonOrders(qrIds, token) {
  try {
    devLog.log('🗑️ حذف طلبات من مدن:', qrIds);
    
    const data = await handleModonApiCall(
      'delete_orders',
      'POST',
      token,
      { qr_ids: Array.isArray(qrIds) ? qrIds.join(',') : qrIds },
      null,
      true // isFormData
    );
    
    if (data.status === true && (data.errNum === 'S000' || data.errNum === '0')) {
      devLog.log('✅ تم حذف الطلبات بنجاح من مدن');
      return {
        success: true,
        deletedCount: Array.isArray(qrIds) ? qrIds.length : 1
      };
    }
    
    throw new Error(data.msg || 'فشل حذف الطلبات من مدن');
  } catch (error) {
    console.error('❌ خطأ في حذف الطلبات من مدن:', error);
    throw error;
  }
}

// ======== القسم 6: الفواتير ========

/**
 * Get merchant invoices from MODON
 */
export async function getMerchantInvoices(token) {
  try {
    const data = await handleModonApiCall(
      'get_merchant_invoices',
      'GET',
      token,
      null,
      { token }
    );
    
    // ✅ errNum: 21 = لا توجد فواتير (ليس خطأ)
    if (data.errNum === '21' || data.errNum === 21) {
      devLog.log('ℹ️ لا توجد فواتير في MODON');
      return [];
    }
    
    if (data.status === true && data.errNum === 'S000') {
      devLog.log(`✅ تم جلب ${data.data?.length || 0} فاتورة من مدن`);
      return data.data || [];
    }
    
    devLog.warn('⚠️ MODON invoices response:', data.errNum, data.msg);
    return [];
  } catch (error) {
    console.error('❌ خطأ في جلب الفواتير من مدن:', error);
    return [];
  }
}

/**
 * Get invoice orders from MODON
 */
export async function getInvoiceOrders(token, invoiceId) {
  try {
    const data = await handleModonApiCall(
      'get_merchant_invoice_orders',
      'GET',
      token,
      null,
      { token, invoice_id: invoiceId }
    );
    
    if (data.status === true && data.errNum === 'S000') {
      devLog.log(`✅ تم جلب طلبات الفاتورة ${invoiceId} من مدن`);
      return data.data || { orders: [] };
    }
    
    return { orders: [] };
  } catch (error) {
    console.error(`❌ خطأ في جلب طلبات الفاتورة ${invoiceId}:`, error);
    return { orders: [] };
  }
}

/**
 * Receive (confirm) an invoice in MODON
 */
export async function receiveInvoice(token, invoiceId) {
  try {
    devLog.log(`📥 تأكيد استلام الفاتورة ${invoiceId} في مدن...`);
    
    const data = await handleModonApiCall(
      'receive_merchant_invoice',
      'GET',
      token,
      null,
      { token, invoice_id: invoiceId }
    );
    
    if (data.status === true && data.errNum === 'S000') {
      devLog.log(`✅ تم تأكيد استلام الفاتورة ${invoiceId}`);
      return { success: true, data: data.data };
    }
    
    throw new Error(data.msg || 'فشل تأكيد استلام الفاتورة');
  } catch (error) {
    console.error(`❌ خطأ في تأكيد استلام الفاتورة ${invoiceId}:`, error);
    throw error;
  }
}

/**
 * Get order by QR/tracking number from MODON
 */
export async function getOrderByQR(token, qrId) {
  try {
    const orders = await getMerchantOrders(token);
    const found = orders.find(o => 
      String(o.qr_id) === String(qrId) || 
      String(o.id) === String(qrId) ||
      String(o.tracking_number) === String(qrId)
    );
    
    if (found) {
      found._fetched_at = new Date().toISOString();
      if (!found.qr_id && found.id) {
        found.qr_id = found.id;
      }
    }
    
    return found || null;
  } catch (error) {
    devLog.warn(`⚠️ getOrderByQR failed for ${qrId}:`, error.message);
    return null;
  }
}

/**
 * Get order statuses from MODON
 */
export async function getOrderStatuses(token) {
  try {
    const data = await handleModonApiCall('statuses', 'GET', token, null, { token });
    
    if (data.status === true && data.errNum === 'S000') {
      devLog.log(`✅ تم جلب ${data.data?.length || 0} حالة من مدن`);
      return data.data || [];
    }
    
    throw new Error(data.msg || 'فشل جلب الحالات من مدن');
  } catch (error) {
    console.error('❌ خطأ في جلب الحالات من مدن:', error);
    throw error;
  }
}

// ======== القسم 7: دوال مساعدة إضافية ========

/**
 * Check if MODON token is valid by making a test call
 */
export async function validateToken(token) {
  try {
    const data = await handleModonApiCall('citys', 'GET', token);
    return data.status === true && data.errNum === 'S000';
  } catch (error) {
    return false;
  }
}

/**
 * Get delivery price for a specific region
 */
export async function getDeliveryPrice(token, regionId) {
  try {
    const regions = await getRegionsByCity(token, null);
    const region = regions.find(r => String(r.id) === String(regionId));
    return region?.delivery_price || 0;
  } catch (error) {
    devLog.warn('⚠️ خطأ في جلب سعر التوصيل:', error.message);
    return 0;
  }
}
