import { supabase } from '@/integrations/supabase/client';

/**
 * MODON Express API Integration
 * Base URL: https://mcht.modon-express.net/v1/merchant
 */

/**
 * Login to MODON and get authentication token
 * @param {string} username - Merchant username
 * @param {string} password - Merchant password
 * @returns {Promise<{success: boolean, token?: string, error?: string}>}
 */
export async function loginToModon(username, password) {
  try {
    console.log('🔐 تسجيل الدخول إلى مدن...');

    const data = await handleModonApiCall(
      'login',
      'POST',
      null, // No token needed for login
      { username, password },
      null,
      true // isFormData flag
    );

    console.log('📦 استجابة مدن:', data);

    if (data.status === true && data.errNum === 'S000') {
      return {
        success: true,
        token: data.data.token,
      };
    } else {
      return {
        success: false,
        error: data.msg || 'فشل تسجيل الدخول',
      };
    }
  } catch (error) {
    console.error('❌ خطأ في تسجيل الدخول:', error);
    return {
      success: false,
      error: error.message || 'خطأ في الاتصال بالخادم',
    };
  }
}

/**
 * Generic API call handler for MODON
 */
async function handleModonApiCall(endpoint, method, token, payload = null, queryParams = null, isFormData = false) {
  try {
    const { data, error } = await supabase.functions.invoke('modon-proxy', {
      body: {
        endpoint,
        method,
        token,
        payload,
        queryParams,
        isFormData,
      },
    });

    if (error) {
      console.error('❌ Proxy Error:', error);
      throw new Error(error.message);
    }

    return data;
  } catch (error) {
    console.error('❌ MODON API Error:', error);
    throw error;
  }
}

/**
 * Get all cities from MODON
 * @param {string} token - Authentication token
 * @returns {Promise<Array>} List of cities
 */
export async function getCities(token) {
  try {
    console.log('🌆 جلب المدن من مدن...');
    const data = await handleModonApiCall('citys', 'GET', token);
    
    if (data.status === true && data.errNum === 'S000') {
      console.log(`✅ تم جلب ${data.data.length} مدينة من مدن`);
      return data.data; // [{id: "1", city_name: "بغداد"}]
    }
    throw new Error(data.msg || 'فشل جلب المدن');
  } catch (error) {
    console.error('❌ خطأ في جلب المدن من مدن:', error);
    throw error;
  }
}

/**
 * Get regions by city ID from MODON
 * @param {string} token - Authentication token
 * @param {string|number} cityId - City ID
 * @returns {Promise<Array>} List of regions
 */
export async function getRegionsByCity(token, cityId) {
  try {
    console.log(`🏘️ جلب مناطق المدينة ${cityId} من مدن...`);
    const data = await handleModonApiCall(
      'regions',
      'GET',
      token,
      null,
      { city_id: cityId }
    );
    
    if (data.status === true && data.errNum === 'S000') {
      console.log(`✅ تم جلب ${data.data.length} منطقة من مدن`);
      return data.data; // [{id: "1", region_name: "الكرادة"}]
    }
    throw new Error(data.msg || 'فشل جلب المناطق');
  } catch (error) {
    console.error('❌ خطأ في جلب المناطق من مدن:', error);
    throw error;
  }
}

/**
 * Get package sizes from MODON
 * @param {string} token - Authentication token
 * @returns {Promise<Array>} List of package sizes
 */
export async function getPackageSizes(token) {
  try {
    console.log('📦 جلب أحجام الطرود من مدن...');
    const data = await handleModonApiCall('package-sizes', 'GET', token);
    
    if (data.status === true && data.errNum === 'S000') {
      console.log(`✅ تم جلب ${data.data.length} حجم من مدن`);
      return data.data; // [{id: "1", size: "صغير"}]
    }
    throw new Error(data.msg || 'فشل جلب أحجام الطرود');
  } catch (error) {
    console.error('❌ خطأ في جلب أحجام الطرود من مدن:', error);
    throw error;
  }
}

/**
 * Get all merchant orders from MODON
 * @param {string} token - Authentication token
 * @returns {Promise<Array>} List of merchant orders
 */
export async function getMerchantOrders(token) {
  try {
    console.log('📦 جلب طلبات التاجر من مدن...');
    const data = await handleModonApiCall('orders', 'GET', token);
    
    if (data.status === true && data.errNum === 'S000') {
      console.log(`✅ تم جلب ${data.data?.length || 0} طلب`);
      return data.data || [];
    }
    throw new Error(data.msg || 'فشل جلب الطلبات');
  } catch (error) {
    console.error('❌ خطأ في جلب الطلبات من مدن:', error);
    throw error;
  }
}

/**
 * Map order data to MODON fields format
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
 * Create a new order in MODON
 * @param {Object} orderData - Order details
 * @param {string} token - Authentication token
 * @returns {Promise<Object>} Created order data
 */
export async function createModonOrder(orderData, token) {
  try {
    console.log('📦 إنشاء طلب جديد في مدن...');
    
    // Import phone utilities
    const { formatPhoneForAlWaseet, isValidAlWaseetPhone } = await import('../utils/phoneUtils.js');
    
    const mappedData = mapToModonFields(orderData);
    const formattedData = { ...mappedData };
    
    // Format and validate phone numbers
    if (formattedData.client_mobile) {
      formattedData.client_mobile = formatPhoneForAlWaseet(formattedData.client_mobile);
      if (!isValidAlWaseetPhone(formattedData.client_mobile)) {
        throw new Error('رقم الهاتف الأساسي غير صحيح - يجب أن يكون بصيغة +9647XXXXXXXXX');
      }
    } else {
      throw new Error('رقم هاتف العميل مطلوب');
    }
    
    // Format secondary phone
    if (formattedData.client_mobile2) {
      formattedData.client_mobile2 = formatPhoneForAlWaseet(formattedData.client_mobile2);
      if (!isValidAlWaseetPhone(formattedData.client_mobile2)) {
        console.warn('⚠️ رقم الهاتف الثانوي غير صحيح، سيتم حذفه');
        delete formattedData.client_mobile2;
      }
    }

    // Ensure numeric fields are properly formatted
    formattedData.price = Number(formattedData.price) || 0;
    formattedData.items_number = parseInt(formattedData.items_number) || 1;
    formattedData.city_id = parseInt(formattedData.city_id) || 0;
    formattedData.region_id = parseInt(formattedData.region_id) || 0;
    formattedData.package_size = parseInt(formattedData.package_size) || 1;
    formattedData.replacement = parseInt(formattedData.replacement) || 0;
    
    console.log('📤 بيانات الطلب المُرسلة لمدن:', formattedData);
    
    const data = await handleModonApiCall(
      'create-order',
      'POST',
      token,
      formattedData,
      { token },
      true // isFormData
    );
    
    if (data.status === true && data.errNum === 'S000') {
      console.log('✅ تم إنشاء الطلب في مدن بنجاح:', data.data[0]);
      return data.data[0]; // MODON returns array with single order
    }
    
    throw new Error(data.msg || 'فشل إنشاء الطلب في مدن');
  } catch (error) {
    console.error('❌ خطأ في إنشاء الطلب في مدن:', error);
    throw error;
  }
}

/**
 * Edit an existing order in MODON
 * @param {Object} orderData - Updated order details (must include qr_id)
 * @param {string} token - Authentication token
 * @returns {Promise<Object>} Updated order data
 */
export async function editModonOrder(orderData, token) {
  try {
    console.log('✏️ تعديل طلب في مدن...');
    
    if (!orderData.qr_id) {
      throw new Error('رقم الطلب (qr_id) مطلوب للتعديل');
    }
    
    const { formatPhoneForAlWaseet, isValidAlWaseetPhone } = await import('../utils/phoneUtils.js');
    
    const mappedData = mapToModonFields(orderData);
    const formattedData = { ...mappedData, qr_id: orderData.qr_id };
    
    // Format and validate phone numbers
    if (formattedData.client_mobile) {
      formattedData.client_mobile = formatPhoneForAlWaseet(formattedData.client_mobile);
      if (!isValidAlWaseetPhone(formattedData.client_mobile)) {
        throw new Error('رقم الهاتف الأساسي غير صحيح');
      }
    }
    
    if (formattedData.client_mobile2) {
      formattedData.client_mobile2 = formatPhoneForAlWaseet(formattedData.client_mobile2);
      if (!isValidAlWaseetPhone(formattedData.client_mobile2)) {
        delete formattedData.client_mobile2;
      }
    }

    // Format numeric fields
    formattedData.price = Number(formattedData.price) || 0;
    formattedData.items_number = parseInt(formattedData.items_number) || 1;
    formattedData.city_id = parseInt(formattedData.city_id) || 0;
    formattedData.region_id = parseInt(formattedData.region_id) || 0;
    formattedData.package_size = parseInt(formattedData.package_size) || 1;
    formattedData.replacement = parseInt(formattedData.replacement) || 0;
    
    console.log('📤 بيانات التعديل المُرسلة لمدن:', formattedData);
    
    const data = await handleModonApiCall(
      'edit-order',
      'POST',
      token,
      formattedData,
      { token },
      true
    );
    
    if (data.status === true && data.errNum === 'S000') {
      console.log('✅ تم تعديل الطلب في مدن بنجاح');
      return data.data[0];
    }
    
    throw new Error(data.msg || 'فشل تعديل الطلب');
  } catch (error) {
    console.error('❌ خطأ في تعديل الطلب في مدن:', error);
    throw error;
  }
}

/**
 * Get order by QR/tracking number from MODON
 * @param {string} token - Authentication token
 * @param {string|number} qrId - QR/tracking number
 * @returns {Promise<Object>} Order data
 */
export async function getOrderByQR(token, qrId) {
  try {
    console.log(`🔍 جلب طلب بـ QR: ${qrId} من مدن...`);
    
    const allOrders = await getMerchantOrders(token);
    const order = allOrders.find(o => String(o.qr_id) === String(qrId));
    
    if (!order) {
      throw new Error(`الطلب ${qrId} غير موجود في مدن`);
    }
    
    console.log('✅ تم العثور على الطلب:', order);
    return order;
  } catch (error) {
    console.error('❌ خطأ في جلب الطلب من مدن:', error);
    throw error;
  }
}
