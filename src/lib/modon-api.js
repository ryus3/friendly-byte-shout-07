import devLog from './devLogger';

// ======== القسم 1: دوال المساعدة ========

/**
 * Handle phone number formatting for MODON API
 */
export function formatPhoneForModon(phone) {
  if (!phone) return '';
  
  let cleaned = String(phone).replace(/\D/g, '');
  
  // إذا كان الرقم يبدأ بـ 07، حذف الصفر وإضافة البادئة
  if (cleaned.startsWith('07')) {
    cleaned = cleaned.substring(1);
  }
  // إذا كان يبدأ بـ 9647، استخدامه مباشرة
  else if (!cleaned.startsWith('964')) {
    // إزالة أي بادئة خاطئة والبدء من 7
    cleaned = cleaned.replace(/^0+/, '');
  }
  
  // التأكد من البادئة الصحيحة
  if (!cleaned.startsWith('964')) {
    cleaned = '964' + cleaned;
  }
  
  return '+' + cleaned;
}

/**
 * Validate MODON phone number format
 */
export function isValidModonPhone(phone) {
  if (!phone) return false;
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
  try {
    const requestBody = {
      endpoint,
      method,
      token: token || null,
      payload: payload || null,
      queryParams: queryParams || null,
      isFormData: isFormData || false
    };
    
    devLog.log('📤 MODON API Request:', { endpoint, method, hasToken: !!token, hasPayload: !!payload });
    
    const response = await fetch(
      'https://tkheostkubborwkwzugl.supabase.co/functions/v1/modon-proxy',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGVvc3RrdWJib3J3a3d6dWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTE4NTEsImV4cCI6MjA2NzkyNzg1MX0.ar867zsTy9JCTaLs9_Hjf5YhKJ9s0rQfUNq7dKpzYfA`
        },
        body: JSON.stringify(requestBody)
      }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    devLog.log('📥 MODON API Response:', { status: data.status, hasData: !!data.data });
    
    return data;
  } catch (error) {
    console.error('❌ MODON API Call Failed:', error);
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
 * Get all merchant orders from MODON
 */
export async function getMerchantOrders(token) {
  try {
    const data = await handleModonApiCall(
      'merchant-orders',
      'GET',
      token,
      null,
      { token }
    );
    
    if (data.status === true && data.errNum === 'S000') {
      devLog.log(`✅ تم جلب ${data.data?.length || 0} طلب من مدن`);
      return data.data || [];
    }
    
    throw new Error(data.msg || 'فشل جلب الطلبات من مدن');
  } catch (error) {
    console.error('❌ خطأ في جلب الطلبات من مدن:', error);
    throw error;
  }
}

// ======== القسم 5: إدارة الطلبات ========

/**
 * Map order data to MODON fields
 */
function mapToModonFields(orderData) {
  const cleanedLocation = orderData.customer_address || orderData.address || '';
  
  return {
    client_name: orderData.customer_name || orderData.name || '',
    client_mobile: orderData.customer_phone || orderData.phone || '',
    client_mobile2: orderData.customer_phone2 || orderData.phone2 || '',
    city_id: parseInt(orderData.modon_city_id || orderData.city_id || 0),
    region_id: parseInt(orderData.modon_region_id || orderData.region_id || 0),
    location: cleanedLocation,
    type_name: orderData.details || 'طلب عادي',
    items_number: parseInt(orderData.quantity || 1),
    price: Number(orderData.price || 0),
    package_size: parseInt(orderData.package_size_id || orderData.size || 1),
    merchant_notes: orderData.merchant_notes || orderData.notes || '',
    replacement: orderData.order_type === 'replacement' ? 1 : 0
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
  
  devLog.log('📦 إنشاء طلب في مدن:', formattedData);
  
  const data = await handleModonApiCall(
    'create-order', 
    'POST', 
    token, 
    formattedData, 
    { token },
    true
  );
  
  if (data.status === true && data.errNum === 'S000') {
    devLog.log('✅ تم إنشاء الطلب في مدن:', data.data[0]);
    return data.data[0];
  }
  
  throw new Error(data.msg || 'فشل إنشاء الطلب في مدن');
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
    devLog.log('✅ تم تعديل الطلب في مدن');
    return data.data?.[0] || true;
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
      devLog.log(`✅ تم جلب ${data.data?.length || 0} طلب بالدفعة`);
      return data.data || [];
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
    devLog.log('📄 جلب الفواتير من مدن...');
    
    const data = await handleModonApiCall(
      'get_merchant_invoices',
      'GET',
      token,
      null,
      { token },
      false
    );
    
    if (data.status === true && data.errNum === 'S000') {
      devLog.log(`✅ تم جلب ${data.data?.length || 0} فاتورة من مدن`);
      return data.data || [];
    }
    
    throw new Error(data.msg || 'فشل جلب الفواتير من مدن');
  } catch (error) {
    console.error('❌ خطأ في جلب الفواتير من مدن:', error);
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
