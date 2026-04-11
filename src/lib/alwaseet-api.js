
// This file contains functions to interact with the Al-Waseet delivery company API.

import { supabase } from './customSupabaseClient';

const REQUEST_GAP_MS = 450;
const SHORT_CACHE_TTL_MS = 60 * 1000;
const LONG_CACHE_TTL_MS = 5 * 60 * 1000;
const inflightRequests = new Map();
const responseCache = new Map();
let requestQueue = Promise.resolve();
let lastRequestAt = 0;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const buildRequestKey = (endpoint, method, token, payload, queryParams) => JSON.stringify({
  endpoint,
  method,
  token,
  payload: payload || null,
  queryParams: queryParams || null,
});

const getCacheTtl = (endpoint) => {
  if (endpoint === 'citys' || endpoint === 'package-sizes') return LONG_CACHE_TTL_MS;
  if (endpoint === 'statuses') return SHORT_CACHE_TTL_MS;
  return 0;
};

const runQueuedRequest = async (requestFactory) => {
  const run = async () => {
    const elapsed = Date.now() - lastRequestAt;
    if (elapsed < REQUEST_GAP_MS) {
      await wait(REQUEST_GAP_MS - elapsed);
    }

    try {
      return await requestFactory();
    } finally {
      lastRequestAt = Date.now();
    }
  };

  const scheduled = requestQueue.then(run, run);
  requestQueue = scheduled.then(() => undefined, () => undefined);
  return scheduled;
};

const handleApiCall = async (endpoint, method, token, payload, queryParams, retries = 2) => {
  const requestKey = buildRequestKey(endpoint, method, token, payload, queryParams);
  const cachedEntry = responseCache.get(requestKey);
  if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
    return cachedEntry.data;
  }

  if (inflightRequests.has(requestKey)) {
    return inflightRequests.get(requestKey);
  }

  const requestPromise = (async () => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const { data, error } = await runQueuedRequest(() => supabase.functions.invoke('alwaseet-proxy', {
          body: { endpoint, method, token, payload, queryParams }
        }));

        if (error) {
          let errorMessage = `فشل الاتصال بالخادم الوكيل: ${error.message}`;
          let retryAfter = null;
          const isNetworkError = error.message?.includes('Failed to fetch') || 
                                error.message?.includes('Network') ||
                                error.message?.includes('ECONNREFUSED');
          
          try {
            const errorBody = await error.context.json();
            errorMessage = errorBody.msg || errorBody.raw || errorMessage;
            retryAfter = errorBody.retryAfter;
          } catch {
            // can't parse error body
          }
          
          const err = new Error(errorMessage);
          err.retryAfter = retryAfter;
          err.isNetworkError = isNetworkError;
          throw err;
        }
        
        if (!data) {
          throw new Error('لم يتم استلام رد من الخادم.');
        }

        // ✅ Detect structured Cloudflare block from proxy (returned as 200 with fallback flag)
        if (data.errNum === 'CF_BLOCKED' || data.error === 'DELIVERY_SERVICE_BLOCKED' || data.fallback === true) {
          const cfErr = new Error(data.msg || 'مزود التوصيل حظر الطلب مؤقتاً');
          cfErr.isCloudflareBlock = true;
          cfErr.rayId = data.details?.rayId;
          throw cfErr;
        }
        
        // معالجة خاصة لـ edit-order
        if (endpoint === 'edit-order') {
          const isSuccessMessage = data.msg && data.msg.includes('تم التعديل بنجاح');
          const isSuccessCode = data.errNum === "S000" && data.status;
          
          if (!isSuccessMessage && !isSuccessCode) {
            throw new Error(data.msg || 'فشل تحديث الطلب في شركة التوصيل.');
          }
          
          return data.data || data;
        }
        
        // المعالجة العادية
        if (data.errNum !== "S000" || !data.status) {
          throw new Error(data.msg || 'حدث خطأ غير متوقع من واجهة برمجة التطبيقات.');
        }

        const result = data.data;
        const cacheTtl = getCacheTtl(endpoint);
        if (cacheTtl > 0) {
          responseCache.set(requestKey, {
            data: result,
            expiresAt: Date.now() + cacheTtl,
          });
        }

        return result;
      } catch (error) {
        // ✅ Cloudflare block: NO retries - fail fast
        if (error.isCloudflareBlock) {
          console.warn(`⛔ Cloudflare حظر ${endpoint} - rayId: ${error.rayId || 'N/A'}`);
          throw error;
        }

        const isRateLimitError = 
          error.message?.includes('تجاوزت الحد المسموح به') || 
          error.message?.includes('rate limit') ||
          error.message?.includes('429');

        const isCloudflareBlock =
          error.message?.includes('Cloudflare') ||
          error.message?.includes('Attention Required') ||
          error.message?.includes('blocked');
        
        const isNetworkError = error.isNetworkError || 
                              error.message?.includes('Failed to fetch') ||
                              error.message?.includes('Network');
        
        if ((isRateLimitError || isCloudflareBlock) && attempt < retries) {
          const waitTime = error.retryAfter || Math.min(2000 * attempt, 5000);
          console.warn(`⚠️ تأخير لـ ${endpoint} - محاولة ${attempt}/${retries} بعد ${waitTime/1000}s`);
          await wait(waitTime);
          continue;
        }
        
        if (attempt === retries) {
          if (isNetworkError) {
            console.warn(`⚠️ خطأ شبكة لـ ${endpoint}`);
          } else if (isRateLimitError || isCloudflareBlock) {
            console.warn(`⚠️ حظر/تقييد ${endpoint} مؤقتاً`);
          }
        }
        
        throw error;
      }
    }
  })();

  inflightRequests.set(requestKey, requestPromise);

  try {
    return await requestPromise;
  } finally {
    inflightRequests.delete(requestKey);
  }
};

export const getCities = async (token) => {
  try {
    return await handleApiCall('citys', 'GET', token);
  } catch (error) {
    // ✅ Fallback to local DB cache when API is blocked
    if (error.isCloudflareBlock || error.message?.includes('حظر')) {
      console.warn('⚠️ getCities: استخدام الكاش المحلي بسبب حظر Cloudflare');
      try {
        const { data } = await supabase
          .from('cities_cache')
          .select('alwaseet_id, name, name_ar, name_en, is_active')
          .eq('is_active', true)
          .order('name');
        if (data && data.length > 0) {
          return data.map(c => ({ id: c.alwaseet_id, name: c.name_ar || c.name, name_en: c.name_en }));
        }
      } catch (dbErr) {
        console.warn('⚠️ getCities DB fallback failed:', dbErr.message);
      }
    }
    throw error;
  }
};

export const getRegionsByCity = async (token, cityId) => {
  return handleApiCall('regions', 'GET', token, null, { city_id: parseInt(cityId) });
};

export const getPackageSizes = async (token) => {
    return handleApiCall('package-sizes', 'GET', token);
};

export const createAlWaseetOrder = async (orderData, token) => {
  // Format phones for Al-Waseet API requirements
  const { formatPhoneForAlWaseet, isValidAlWaseetPhone } = await import('../utils/phoneUtils.js');
  
  // Map field names to Al-Waseet API format for consistency
  const mappedData = mapToAlWaseetFields(orderData);
  const formattedData = { ...mappedData };
  
  // Format primary phone (required)
  if (formattedData.client_mobile) {
    formattedData.client_mobile = formatPhoneForAlWaseet(formattedData.client_mobile);
    if (!isValidAlWaseetPhone(mappedData.client_mobile)) {
      throw new Error('رقم الهاتف الأساسي غير صحيح. يجب أن يكون رقم عراقي صحيح.');
    }
  }
  
  // Format secondary phone (optional) - معالجة مثل الرقم الأساسي تماماً
  if (formattedData.client_mobile2) {
    formattedData.client_mobile2 = formatPhoneForAlWaseet(formattedData.client_mobile2);
    if (!isValidAlWaseetPhone(formattedData.client_mobile2)) {
      console.warn('⚠️ الرقم الثانوي غير صالح، سيتم حذفه:', formattedData.client_mobile2);
      delete formattedData.client_mobile2;
    } else {
      console.log('✅ تم تنسيق الرقم الثانوي بنجاح:', formattedData.client_mobile2);
    }
  }

  // Ensure numeric fields are properly formatted (handle negative prices correctly)
  formattedData.price = formattedData.price !== undefined && formattedData.price !== null 
    ? Number(formattedData.price) 
    : 0;
  formattedData.items_number = parseInt(formattedData.items_number) || 0;
  formattedData.city_id = parseInt(formattedData.city_id) || 0;
  formattedData.region_id = parseInt(formattedData.region_id) || 0;
  formattedData.package_size = parseInt(formattedData.package_size) || 0;
  formattedData.replacement = parseInt(formattedData.replacement) || 0;
  
  // Call proxy
  const createRes = await handleApiCall('create-order', 'POST', token, formattedData, { token });
  
  // Normalize and fallback if qr_id missing
  let normalized = createRes || {};
  let qrId = String(normalized?.qr_id || normalized?.tracking_number || normalized?.id || '').trim();
  let id = String(normalized?.id || '').trim();

  if (!qrId) {
    try {
      // Fetch recent orders and try to match by phone and price
      const orders = await handleApiCall('merchant-orders', 'GET', token, null, { token });
      const last10 = (formattedData.client_mobile || '').replace(/\D/g, '').slice(-10);
      const candidates = (orders || []).filter((o) =>
        String(o?.client_mobile || '').replace(/\D/g, '').endsWith(last10)
      );
      // Prefer exact price match
      const exact = candidates.find(o => parseInt(o?.price) === formattedData.price) || candidates[0];
      if (exact) {
        qrId = String(exact.qr_id || exact.tracking_number || exact.id || '').trim();
        id = String(exact.id || id || '').trim();
        normalized = { ...exact, id, qr_id: qrId };
      }
    } catch (fbErr) {
      console.warn('Fallback lookup for qr_id failed:', fbErr);
    }
  }

  return { ...normalized, id: id || normalized?.id || null, qr_id: qrId || normalized?.qr_id || null };
};

// Helper function to map local field names to Al-Waseet API field names
const mapToAlWaseetFields = (orderData) => {
  console.log('🔍 mapToAlWaseetFields - Input data:', orderData);
  
  // ✅ استخدام customer_address مباشرة - يحتوي فقط على أقرب نقطة دالة
  const cleanedLocation = orderData.customer_address || orderData.address || orderData.client_address || orderData.location || '';
  
  console.log('🧹 استخدام العنوان:', {
    customer_address: orderData.customer_address,
    final_location: cleanedLocation
  });
  
  // ✅ حساب السعر - دعم طلبات الإرجاع والاستبدال
  const isReturn = orderData.order_type === 'return';
  const refundAmount = orderData.refund_amount || 0;
  const deliveryFee = orderData.delivery_fee || 0;
  const finalPrice = orderData.final_amount || orderData.price || orderData.final_total || orderData.total_amount || 0;
  const merchantPrice = Math.round(Number(finalPrice));
  
  const mapped = {
    qr_id: orderData.tracking_number || orderData.qr_id || orderData.delivery_partner_order_id,
    client_name: orderData.customer_name || orderData.name || orderData.client_name || '',
    client_mobile: orderData.customer_phone || orderData.phone || orderData.client_mobile || '',
    client_mobile2: orderData.customer_phone2 || orderData.phone2 || orderData.client_mobile2 || '',
    city_id: parseInt(orderData.alwaseet_city_id || orderData.city_id || orderData.customer_city_id || orderData.order_data?.city_id || 0),
    region_id: parseInt(orderData.alwaseet_region_id || orderData.region_id || orderData.customer_region_id || orderData.order_data?.region_id || 0),
    location: cleanedLocation,
    type_name: orderData.details || orderData.type_name || 'طلب عادي',
    items_number: parseInt(orderData.quantity || orderData.items_number || 1),
    // ✅ إرسال السعر كما هو (سالب للإرجاع، موجب للطلب العادي)
    price: merchantPrice,
    package_size: parseInt(orderData.package_size_id || orderData.size || orderData.package_size || 1),
    // ✅ استخدام الملاحظات المُمررة مباشرة من QuickOrderContent
    merchant_notes: orderData.merchant_notes || orderData.notes || '',
    // ✅ تمييز الإرجاع والاستبدال
    replacement: (orderData.order_type === 'return' || orderData.order_type === 'replacement' || parseInt(orderData.replacement || 0) === 1) ? 1 : 0
  }
  
  console.log('🔍 [mapToAlWaseetFields] client_mobile2 بعد mapping:', {
    orderData_customer_phone2: orderData.customer_phone2,
    orderData_phone2: orderData.phone2,
    orderData_client_mobile2: orderData.client_mobile2,
    final_client_mobile2: mapped.client_mobile2
  });
  
  console.log('📋 mapToAlWaseetFields - Mapped result:', mapped);
  
  // التحقق من البيانات المطلوبة
  if (!mapped.qr_id) {
    console.error('❌ Missing qr_id/tracking_number in order data');
  }
  if (!mapped.client_name) {
    console.warn('⚠️ Missing customer name in order data');
  }
  if (!mapped.client_mobile) {
    console.warn('⚠️ Missing customer phone in order data');
  }
  if (mapped.city_id === 0) {
    console.warn('⚠️ Missing or invalid city_id in order data');
  }
  if (mapped.region_id === 0) {
    console.warn('⚠️ Missing or invalid region_id in order data');
  }
  
  return mapped;
};

export const editAlWaseetOrder = async (orderData, token) => {
  // Format phones for Al-Waseet API requirements (same as createAlWaseetOrder)
  const { formatPhoneForAlWaseet, isValidAlWaseetPhone } = await import('../utils/phoneUtils.js');
  
  // Map field names to Al-Waseet API format
  const mappedData = mapToAlWaseetFields(orderData);
  const formattedData = { ...mappedData };
  
  // Validate required fields
  if (!formattedData.qr_id) {
    throw new Error('رقم الطلب مطلوب للتعديل.');
  }
  
  console.log('📋 Mapped data for Al-Waseet edit:', formattedData);
  
  // Format primary phone (required)
  if (formattedData.client_mobile) {
    formattedData.client_mobile = formatPhoneForAlWaseet(formattedData.client_mobile);
    if (!isValidAlWaseetPhone(formattedData.client_mobile)) {
      throw new Error('رقم الهاتف الأساسي غير صحيح. يجب أن يكون رقم عراقي صحيح.');
    }
  }
  
  // Format secondary phone (optional) - معالجة مثل الرقم الأساسي تماماً
  if (formattedData.client_mobile2) {
    formattedData.client_mobile2 = formatPhoneForAlWaseet(formattedData.client_mobile2);
    if (!isValidAlWaseetPhone(formattedData.client_mobile2)) {
      console.warn('⚠️ الرقم الثانوي غير صالح، سيتم حذفه:', formattedData.client_mobile2);
      delete formattedData.client_mobile2;
    } else {
      console.log('✅ تم تنسيق الرقم الثانوي بنجاح للتعديل:', formattedData.client_mobile2);
    }
  }
  
  // Ensure numeric fields are properly formatted
  formattedData.price = Math.round(Number(formattedData.price)) || 0;
  formattedData.items_number = parseInt(formattedData.items_number) || 0;
  formattedData.city_id = parseInt(formattedData.city_id) || 0;
  formattedData.region_id = parseInt(formattedData.region_id) || 0;
  formattedData.package_size = parseInt(formattedData.package_size) || 0;
  formattedData.replacement = parseInt(formattedData.replacement) || 0;
  
  console.log('📤 إرسال طلب التحديث إلى Al Waseet:', formattedData);
  
  const response = await handleApiCall('edit-order', 'POST', token, formattedData, { token });
  
  console.log('📥 استجابة تحديث Al Waseet:', response);
  
  // نجاح الوصول إلى هنا يعني أن handleApiCall تحقق من النجاح ولم يرمِ خطأ
  return {
    success: true,
    data: response,
    message: 'تم تحديث الطلب في شركة التوصيل بنجاح'
  };
};
export const getMerchantOrders = async (token) => {
  return handleApiCall('merchant-orders', 'GET', token, null, { token });
};

export const getOrderById = async (token, orderId) => {
  return handleApiCall('merchant-orders', 'GET', token, null, { token, order_id: orderId });
};

export const getOrderStatuses = async (token) => {
  return handleApiCall('statuses', 'GET', token, null, { token });
};

// New: Retrieve orders by IDs in bulk (max 25 per request)
export const getOrdersByIdsBulk = async (token, ids) => {
  const arr = Array.isArray(ids) ? ids : String(ids || '').split(',').map(s => s.trim()).filter(Boolean);
  const unique = Array.from(new Set(arr.map(String)));
  const first25 = unique.slice(0, 25);
  if (first25.length === 0) return [];
  const payload = { ids: first25.join(',') };
  return handleApiCall('get-orders-by-ids-bulk', 'POST', token, payload, { token });
};

// ===== Invoice Management APIs =====

// Get all merchant invoices
export const getMerchantInvoices = async (token) => {
  return handleApiCall('get_merchant_invoices', 'GET', token, null, { token });
};

// Get orders for a specific invoice
export const getInvoiceOrders = async (token, invoiceId) => {
  return handleApiCall('get_merchant_invoice_orders', 'GET', token, null, { token, invoice_id: invoiceId });
};

// Receive (confirm) an invoice
export const receiveInvoice = async (token, invoiceId) => {
  return handleApiCall('receive_merchant_invoice', 'GET', token, null, { token, invoice_id: invoiceId });
};

// ✅ Get specific order by QR/tracking number - استخدام bulk API بدلاً من merchant-orders
export const getOrderByQR = async (token, qrId) => {
  try {
    // ✅ استخدام getOrdersByIdsBulk بدلاً من جلب كل الطلبات
    // هذا يرسل استدعاء واحد فقط بـ ID محدد بدلاً من جلب آلاف الطلبات
    const orders = await getOrdersByIdsBulk(token, [qrId]);
    
    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return null;
    }
    
    const found = orders[0];
    
    // ✅ إضافة timestamp للتحقق من حداثة البيانات
    found._fetched_at = new Date().toISOString();
    // ✅ توحيد: ضمان وجود qr_id دائماً
    if (!found.qr_id && found.id) {
      found.qr_id = found.id;
    }
    
    return found;
  } catch (error) {
    // ✅ معالجة هادئة للأخطاء - خاصة أخطاء الشبكة
    const isNetworkError = error.message?.includes('Failed to fetch') || 
                          error.message?.includes('Network');
    
    if (isNetworkError) {
      // تسجيل واحد هادئ بدون spam
      console.warn(`⚠️ getOrderByQR: API خارجي غير متاح (${qrId})`);
    } else {
      console.warn(`⚠️ getOrderByQR failed for ${qrId}:`, error.message);
    }
    
    return null;
  }
};

// ✅ تسجيل الدخول للحصول على توكن جديد
export const loginToWaseet = async (username, password) => {
  const { data, error } = await supabase.functions.invoke('alwaseet-proxy', {
    body: {
      endpoint: 'login',
      method: 'POST',
      payload: { username, password }
    }
  });

  if (error) {
    let errorMessage = 'فشل الاتصال بالخادم.';
    try {
      const errorBody = await error.context.json();
      errorMessage = errorBody.msg || errorMessage;
    } catch {}
    throw new Error(errorMessage);
  }
  
  if (!data) {
    throw new Error('لم يتم استلام رد من الخادم.');
  }
  
  if (data.errNum !== "S000" || !data.status) {
    throw new Error(data.msg || 'فشل تسجيل الدخول. تحقق من البيانات.');
  }

  return data.data; // يحتوي على { token, merchant_id, ... }
};
