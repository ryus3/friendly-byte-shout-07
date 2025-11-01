import devLog from './devLogger';
import { normalizePhone } from '../utils/phoneUtils';

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
 */
async function handleModonApiCall(endpoint, method, token, payload = null, queryParams = null, isFormData = false) {
  console.log('🟢 ===== handleModonApiCall STARTED =====');
  console.log('📍 Endpoint:', endpoint);
  console.log('🔑 Token exists:', !!token);
  console.log('🔑 Token type:', typeof token);
  console.log('🔑 Token length:', token?.length || 0);
  console.log('🔑 Token preview:', token ? token.substring(0, 30) + '...' : 'NULL');
  
  try {
    // ✅ التحقق من صحة المعاملات
    if (!endpoint) {
      throw new Error('❌ Endpoint is required');
    }
    
    // ✅ استثناء: endpoint "login" لا يحتاج token
    if (endpoint !== 'login') {
      if (!token || typeof token !== 'string' || token.length === 0) {
        throw new Error('❌ Invalid token: ' + (typeof token) + ' - ' + token);
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
    
    console.log('📤 Request Body:', JSON.stringify(requestBody, null, 2));
    
    const edgeFunctionUrl = 'https://tkheostkubborwkwzugl.supabase.co/functions/v1/modon-proxy';
    const authToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGVvc3RrdWJib3J3a3d6dWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTE4NTEsImV4cCI6MjA2NzkyNzg1MX0.ar867zsTy9JCTaLs9_Hjf5YhKJ9s0rQfUNq7dKpzYfA';
    
    console.log('🌐 Edge Function URL:', edgeFunctionUrl);
    console.log('🔑 Authorization Token (first 50 chars):', authToken.substring(0, 50) + '...');
    
    console.log('🔵 ===== Attempting fetch... =====');
    console.log('⏰ Timestamp:', new Date().toISOString());
    
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authToken
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log('🟢 ===== Fetch completed! =====');
    console.log('⏰ Response Timestamp:', new Date().toISOString());
    console.log('📡 HTTP Status:', response.status, response.statusText);
    console.log('📡 Response OK:', response.ok);
    console.log('📡 Response Type:', response.type);
    console.log('📡 Response URL:', response.url);
    
    // ✅ طباعة جميع headers
    const headers = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    console.log('📡 Response Headers:', headers);
    
    if (!response.ok) {
      console.error('❌ HTTP Error Response');
      
      let errorBody = '';
      try {
        errorBody = await response.text();
        console.error('❌ Error Body:', errorBody);
      } catch (e) {
        console.error('❌ Could not read error body:', e);
      }
      
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorBody}`);
    }
    
    const responseText = await response.text();
    console.log('📄 Raw Response (first 500 chars):', responseText.substring(0, 500));
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ JSON Parse Error:', parseError);
      console.error('❌ Response was:', responseText);
      throw new Error('Invalid JSON response from modon-proxy');
    }
    
    console.log('📥 ===== MODON API Response =====');
    console.log('✅ Status:', data.status);
    console.log('📊 Error Code:', data.errNum);
    console.log('💬 Message:', data.msg);
    console.log('📦 Has Data:', !!data.data);
    console.log('📦 Data type:', Array.isArray(data.data) ? 'Array' : typeof data.data);
    console.log('📦 Data length:', data.data?.length || 0);
    
    devLog.log('📥 MODON API Response:', { status: data.status, hasData: !!data.data });
    
    console.log('🟢 ===== handleModonApiCall COMPLETED SUCCESSFULLY =====');
    
    return data;
    
  } catch (error) {
    console.error('🔴 ===== handleModonApiCall FAILED =====');
    console.error('❌ Error occurred at:', new Date().toISOString());
    console.error('❌ Error Name:', error.name);
    console.error('❌ Error Message:', error.message);
    console.error('❌ Error Stack:', error.stack);
    console.error('❌ Endpoint was:', endpoint);
    console.error('❌ Method was:', method);
    console.error('❌ Token preview was:', token ? token.substring(0, 20) + '...' : 'NULL');
    
    // ⚠️ إعادة رمي الخطأ ليتم التعامل معه في المستوى الأعلى
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
  console.log('🟢 ===== getAllMerchantOrders STARTED =====');
  console.log('🔑 Token received:', !!token);
  console.log('🔑 Token type:', typeof token);
  console.log('🔑 Token length:', token?.length || 0);
  console.log('🔑 Token preview:', token ? token.substring(0, 30) + '...' : 'NULL');
  
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    console.error('❌ Invalid token provided to getAllMerchantOrders');
    return [];
  }
  
  try {
    console.log('🔵 Calling handleModonApiCall...');
    console.log('⏰ Call started at:', new Date().toISOString());
    
    const data = await handleModonApiCall(
      'merchant-orders',
      'GET',
      token,
      null,
      { token },
      false
    );
    
    console.log('🟢 handleModonApiCall returned successfully');
    console.log('⏰ Call completed at:', new Date().toISOString());
    console.log('📥 Data received:', {
      status: data.status,
      errNum: data.errNum,
      hasData: !!data.data,
      dataLength: data.data?.length || 0
    });
    
    if (data.status === true && data.errNum === 'S000') {
      console.log(`✅ Success! ${data.data?.length || 0} orders fetched`);
      
      if (data.data && data.data.length > 0) {
        console.log('📦 عينة من الطلبات (أول 3):', data.data.slice(0, 3).map(order => ({
          id: order.id,
          qr_id: order.qr_id,
          status_id: order.status_id,
          client_name: order.client_name,
          price: order.price
        })));
      } else {
        console.log('⚠️ البيانات فارغة رغم نجاح الطلب');
      }
      
      return data.data || [];
    }
    
    console.warn('⚠️ API returned non-success status:', data);
    return [];
    
  } catch (error) {
    console.error('🔴 ===== getAllMerchantOrders FAILED =====');
    console.error('❌ Error at:', new Date().toISOString());
    console.error('❌ Error type:', error.constructor.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    
    // ⚠️ رجوع array فارغ بدلاً من throw
    return [];
  } finally {
    console.log('🏁 getAllMerchantOrders FINISHED');
  }
}

/**
 * Get all merchant orders from MODON (طريقة مزدوجة: مباشرة + فواتير)
 * ✅ تجمع بين الطريقتين لضمان الحصول على جميع الطلبات
 */
export async function getMerchantOrders(token) {
  try {
    console.log('📦 ===== [MODON] بدء جلب الطلبات =====');
    
    let allOrders = [];
    let ordersFromDirect = [];
    let ordersFromInvoices = [];
    
    // ============ الطريقة 1: جلب الطلبات مباشرة ============
    console.log('🔄 [1/2] محاولة جلب الطلبات المباشرة...');
    ordersFromDirect = await getAllMerchantOrders(token);
    console.log(`${ordersFromDirect.length > 0 ? '✅' : 'ℹ️'} [1/2] جلب ${ordersFromDirect.length} طلب مباشر`);
    
    // ============ الطريقة 2: جلب الطلبات من الفواتير ============
    console.log('🔄 [2/2] محاولة جلب الطلبات من الفواتير...');
    
    try {
      const invoices = await getMerchantInvoices(token);
      console.log(`📋 تم جلب ${invoices?.length || 0} فاتورة`);
      
      if (invoices && invoices.length > 0) {
        for (const invoice of invoices) {
          try {
            const invoiceData = await getInvoiceOrders(token, invoice.id);
            const orders = invoiceData?.orders || [];
            
            if (orders && orders.length > 0) {
              ordersFromInvoices = ordersFromInvoices.concat(orders);
              console.log(`  ✅ فاتورة ${invoice.id}: ${orders.length} طلب`);
            }
          } catch (error) {
            console.error(`  ❌ خطأ في فاتورة ${invoice.id}:`, error.message);
          }
        }
      }
      
      console.log(`${ordersFromInvoices.length > 0 ? '✅' : 'ℹ️'} [2/2] جلب ${ordersFromInvoices.length} طلب من الفواتير`);
    } catch (error) {
      console.warn('⚠️ [2/2] تعذر جلب الطلبات من الفواتير:', error.message);
      // ⚠️ لا نرمي خطأ - نستمر
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
    
    // ============ النتيجة النهائية ============
    console.log('🎯 ===== [MODON] النتيجة النهائية =====');
    console.log(`📊 إجمالي: ${allOrders.length} طلب`);
    console.log(`  • مباشر: ${ordersFromDirect.length}`);
    console.log(`  • فواتير: ${ordersFromInvoices.length}`);
    console.log(`  • بعد إزالة التكرار: ${allOrders.length}`);
    
    // ✅ إذا لم يكن هناك طلبات، نرجع array فارغ (ليس خطأ!)
    if (allOrders.length === 0) {
      console.log('ℹ️ لا توجد طلبات في MODON حالياً');
      console.log('💡 تحقق من:');
      console.log('   1. هل توجد طلبات في حساب MODON؟');
      console.log('   2. هل تم تسليم الطلبات للمندوب؟');
      console.log('   3. تحقق من لوحة التحكم في MODON');
    }
    
    if (allOrders.length > 0) {
      console.log('📦 عينة من أول طلب:', {
        id: allOrders[0].id,
        qr_id: allOrders[0].qr_id,
        status_id: allOrders[0].status_id,
        client_name: allOrders[0].client_name
      });
    }
    
    return allOrders;
    
  } catch (error) {
    // ❌ خطأ غير متوقع
    console.error('❌ ===== [MODON] خطأ غير متوقع =====');
    console.error(error);
    
    // ⚠️ نرجع array فارغ بدلاً من throw
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
  const mappedData = mapToModonFields(orderData);
  const formattedData = { ...mappedData };
  
  // Format phone numbers for MODON
  if (formattedData.client_mobile) {
    formattedData.client_mobile = formatPhoneForModon(formattedData.client_mobile);
    if (!isValidModonPhone(formattedData.client_mobile)) {
      throw new Error('رقم الهاتف الأساسي غير صحيح. يجب أن يبدأ بـ +9647');
    }
  }
  
  if (formattedData.client_mobile2) {
    formattedData.client_mobile2 = formatPhoneForModon(formattedData.client_mobile2);
    if (!isValidModonPhone(formattedData.client_mobile2)) {
      delete formattedData.client_mobile2;
    }
  }

  formattedData.price = Number(formattedData.price) || 0;
  formattedData.items_number = parseInt(formattedData.items_number) || 0;
  formattedData.city_id = parseInt(formattedData.city_id) || 0;
  formattedData.region_id = parseInt(formattedData.region_id) || 0;
  formattedData.package_size = parseInt(formattedData.package_size) || 0;
  formattedData.replacement = parseInt(formattedData.replacement) || 0;
  
  devLog.log('📦 إنشاء طلب في مدن:', {
    ...formattedData,
    // ✅ لوج تشخيصي
    original_city_id: orderData.city_id,
    original_region_id: orderData.region_id,
    original_phone: orderData.phone,
    mapped_city_id: formattedData.city_id,
    mapped_region_id: formattedData.region_id,
    mapped_phone: formattedData.client_mobile
  });
  
  try {
    const data = await handleModonApiCall(
      'create-order', 
      'POST', 
      token, 
      formattedData, 
      { token },
      true
    );
    
    if (data.status === true && data.errNum === 'S000') {
      // ✅ MODON ترجع object مباشر، ليس array
      const orderData = Array.isArray(data.data) ? data.data[0] : data.data;
      devLog.log('✅ تم إنشاء الطلب في مدن:', orderData);
      return orderData;
    }
    
    throw new Error(data.msg || 'فشل إنشاء الطلب في مدن');
  } catch (error) {
    console.error('❌ MODON Create Order Failed:', {
      error: error.message,
      endpoint: 'create-order',
      hasToken: !!token,
      cityId: formattedData.city_id,
      regionId: formattedData.region_id,
      phone: formattedData.client_mobile
    });
    
    // تحليل نوع الخطأ وإرجاع رسالة واضحة
    if (error.message?.includes('Unauthorized') || error.message?.includes('401')) {
      throw new Error('ليس لديك صلاحية الوصول. يرجى تسجيل الدخول مجدداً إلى مدن');
    }
    
    throw error;
  }
}

/**
 * Edit order in MODON
 */
export async function editModonOrder(orderData, token) {
  const mappedData = mapToModonFields(orderData);
  const formattedData = { ...mappedData };
  
  if (!orderData.qr_id && !formattedData.qr_id) {
    throw new Error('رقم الطلب (qr_id) مطلوب للتعديل');
  }
  
  formattedData.qr_id = orderData.qr_id || formattedData.qr_id;
  
  // Format phone numbers for MODON
  if (formattedData.client_mobile) {
    formattedData.client_mobile = formatPhoneForModon(formattedData.client_mobile);
    if (!isValidModonPhone(formattedData.client_mobile)) {
      throw new Error('رقم الهاتف الأساسي غير صحيح. يجب أن يبدأ بـ +9647');
    }
  }
  
  if (formattedData.client_mobile2) {
    formattedData.client_mobile2 = formatPhoneForModon(formattedData.client_mobile2);
    if (!isValidModonPhone(formattedData.client_mobile2)) {
      delete formattedData.client_mobile2;
    }
  }

  formattedData.price = Number(formattedData.price) || 0;
  formattedData.items_number = parseInt(formattedData.items_number) || 0;
  formattedData.city_id = parseInt(formattedData.city_id) || 0;
  formattedData.region_id = parseInt(formattedData.region_id) || 0;
  formattedData.package_size = parseInt(formattedData.package_size) || 0;
  formattedData.replacement = parseInt(formattedData.replacement) || 0;
  
  devLog.log('✏️ تعديل طلب في مدن:', formattedData);
  
  const data = await handleModonApiCall(
    'edit-order',
    'POST',
    token,
    formattedData,
    { token },
    true
  );
  
  if (data.status === true && data.errNum === 'S000') {
    // ✅ MODON ترجع object مباشر، ليس array
    const orderData = Array.isArray(data.data) ? data.data[0] : data.data;
    devLog.log('✅ تم تعديل الطلب في مدن:', orderData);
    return orderData || true;
  }
  
  throw new Error(data.msg || 'فشل تعديل الطلب في مدن');
}

/**
 * Get order by QR/tracking number from MODON
 */
export async function getOrderByQR(token, qrId) {
  try {
    devLog.log(`🔍 جلب طلب بـ QR: ${qrId} من مدن...`);
    
    const allOrders = await getMerchantOrders(token);
    const order = allOrders.find(o => String(o.qr_id) === String(qrId));
    
    if (!order) {
      throw new Error(`الطلب ${qrId} غير موجود في مدن`);
    }
    
    devLog.log('✅ تم العثور على الطلب:', order);
    return order;
  } catch (error) {
    console.error('❌ خطأ في جلب الطلب من مدن:', error);
    throw error;
  }
}

/**
 * Delete order from MODON (only if status_id = 1)
 */
export async function deleteModonOrder(qrId, token) {
  try {
    devLog.log(`🗑️ حذف الطلب ${qrId} من مدن...`);
    
    const data = await handleModonApiCall(
      'delete_orders',
      'POST',
      token,
      { order_id: String(qrId) },
      { token },
      true
    );
    
    if (data.status === true) {
      devLog.log(`✅ تم حذف الطلب ${qrId} من مدن`);
      return true;
    }
    
    throw new Error(data.msg || 'فشل حذف الطلب من مدن');
  } catch (error) {
    console.error('❌ خطأ في حذف الطلب من مدن:', error);
    throw error;
  }
}

/**
 * Get orders by IDs (batch, max 25)
 */
export async function getOrdersByIdsBatch(ids, token) {
  try {
    if (!Array.isArray(ids)) {
      ids = [ids];
    }
    
    const idsString = ids.slice(0, 25).join(',');
    devLog.log(`📦 جلب ${ids.length} طلب بالدفعة من مدن...`);
    
    const data = await handleModonApiCall(
      'get-orders-by-ids-bulk',
      'POST',
      token,
      { ids: idsString },
      { token },
      true
    );
    
    if (data.status === true && data.errNum === 'S000') {
      // ✅ تأكد من أن data.data مصفوفة
      const orders = Array.isArray(data.data) ? data.data : (data.data ? [data.data] : []);
      devLog.log(`✅ تم جلب ${orders.length} طلب بالدفعة`);
      return orders;
    }
    
    throw new Error(data.msg || 'فشل جلب الطلبات بالدفعات');
  } catch (error) {
    console.error('❌ خطأ في جلب الطلبات بالدفعات:', error);
    throw error;
  }
}

// ======== القسم 6: إدارة الفواتير ========

/**
 * Get merchant invoices from MODON
 */
export async function getMerchantInvoices(token) {
  try {
    console.log('🚀 ===== بدء جلب فواتير مدن =====');
    console.log('📋 Token length:', token?.length || 0);
    console.log('📋 Token preview:', token?.substring(0, 20) + '...');
    
    devLog.log('📄 جلب الفواتير من مدن...');
    
    const data = await handleModonApiCall(
      'get_merchant_invoices',
      'GET',
      token,
      null,
      { token },
      false
    );
    
    console.log('📥 MODON Invoices Response:', {
      status: data.status,
      errNum: data.errNum,
      hasData: !!data.data,
      invoiceCount: data.data?.length || 0
    });
    
    if (data.status === true && data.errNum === 'S000') {
      devLog.log(`✅ تم جلب ${data.data?.length || 0} فاتورة من مدن`);
      
      // عرض تفاصيل الفواتير
      if (data.data && data.data.length > 0) {
        console.log('📋 تفاصيل الفواتير:', data.data.map(inv => ({
          id: inv.id,
          status: inv.status,
          orders_count: inv.delivered_orders_count,
          price: inv.merchant_price
        })));
      }
      
      return data.data || [];
    }
    
    // ✅ معالجة errNum: 21 (لا توجد فواتير) - ليس خطأ!
    if (data.errNum === 21 || data.errNum === '21') {
      devLog.log('ℹ️ لا توجد فواتير حالياً في حساب مدن');
      return []; // إرجاع array فارغ بدلاً من throw error
    }
    
    console.error('❌ فشل جلب الفواتير:', data.msg);
    throw new Error(data.msg || 'فشل جلب الفواتير من مدن');
  } catch (error) {
    console.error('❌ خطأ في جلب الفواتير من مدن:', error);
    console.error('❌ تفاصيل الخطأ:', {
      message: error.message,
      name: error.name,
      stack: error.stack?.split('\n')[0]
    });
    throw error;
  }
}

/**
 * Get invoice orders from MODON
 */
export async function getInvoiceOrders(token, invoiceId) {
  try {
    devLog.log(`📋 جلب طلبات الفاتورة ${invoiceId} من مدن...`);
    
    const data = await handleModonApiCall(
      'get_merchant_invoice_orders',
      'GET',
      token,
      null,
      { token, invoice_id: String(invoiceId) },
      false
    );
    
    if (data.status === true && data.errNum === 'S000') {
      devLog.log(`✅ تم جلب طلبات الفاتورة ${invoiceId}`);
      return {
        invoice: data.data?.invoice || [],
        orders: data.data?.orders || []
      };
    }
    
    throw new Error(data.msg || 'فشل جلب طلبات الفاتورة');
  } catch (error) {
    console.error('❌ خطأ في جلب طلبات الفاتورة من مدن:', error);
    throw error;
  }
}

/**
 * Receive (confirm) invoice from MODON
 */
export async function receiveInvoice(token, invoiceId) {
  try {
    devLog.log(`✅ استلام الفاتورة ${invoiceId} من مدن...`);
    
    const data = await handleModonApiCall(
      'receive_merchant_invoice',
      'GET',
      token,
      null,
      { token, invoice_id: String(invoiceId) },
      false
    );
    
    if (data.status === true && data.errNum === 'S000') {
      devLog.log(`✅ تم استلام الفاتورة ${invoiceId} في مدن`);
      return true;
    }
    
    throw new Error(data.msg || 'فشل استلام الفاتورة من مدن');
  } catch (error) {
    console.error('❌ خطأ في استلام الفاتورة من مدن:', error);
    throw error;
  }
}
