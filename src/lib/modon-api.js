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

// المزيد من الدوال سيتم إضافتها لاحقاً (getCities, createOrder, etc.)
