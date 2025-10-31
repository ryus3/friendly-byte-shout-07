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
