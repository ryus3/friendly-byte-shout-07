// This file contains functions to interact with the Al-Waseet delivery company API.

import { supabase } from './customSupabaseClient';

const handleApiCall = async (endpoint, method, token, payload, queryParams) => {
  try {
    const { data, error } = await supabase.functions.invoke('alwaseet-proxy', {
      body: { endpoint, method, token, payload, queryParams }
    });

    if (error) {
      let errorMessage = `فشل الاتصال بالخادم الوكيل: ${error.message}`;
      try {
        const errorBody = await error.context.json();
        errorMessage = errorBody.msg || errorMessage;
      } catch {
        // If we can't parse the error body, use the default message
      }
      throw new Error(errorMessage);
    }
    
    if (!data) {
      throw new Error('لم يتم استلام رد من الخادم.');
    }
    
    if (data.errNum !== "S000" || !data.status) {
      throw new Error(data.msg || 'حدث خطأ غير متوقع من واجهة برمجة التطبيقات.');
    }

    return data.data;
  } catch (error) {
    console.error(`API call failed for ${endpoint}:`, error);
    throw error;
  }
};

export const getCities = async (token) => {
  // Note: The API endpoint is "citys" not "cities"
  return handleApiCall('citys', 'GET', token);
};

export const getRegionsByCity = async (token, cityId) => {
  return handleApiCall('regions', 'GET', token, null, { city_id: cityId });
};

export const getPackageSizes = async (token) => {
    return handleApiCall('package-sizes', 'GET', token);
};

export const createAlWaseetOrder = async (orderData, token) => {
  // Format phones for Al-Waseet API requirements
  const { formatPhoneForAlWaseet, isValidAlWaseetPhone } = await import('../utils/phoneUtils.js');
  
  const formattedData = { ...orderData };
  
  // Format primary phone (required)
  if (formattedData.client_mobile) {
    formattedData.client_mobile = formatPhoneForAlWaseet(formattedData.client_mobile);
    if (!isValidAlWaseetPhone(orderData.client_mobile)) {
      throw new Error('رقم الهاتف الأساسي غير صحيح. يجب أن يكون رقم عراقي صحيح.');
    }
  }
  
  // Format secondary phone (optional) - only include if valid
  if (formattedData.client_mobile2) {
    const formatted2 = formatPhoneForAlWaseet(formattedData.client_mobile2);
    if (isValidAlWaseetPhone(orderData.client_mobile2)) {
      formattedData.client_mobile2 = formatted2;
    } else {
      delete formattedData.client_mobile2; // Remove invalid secondary phone
    }
  }
  
  return handleApiCall('create-order', 'POST', token, formattedData, { token });
};

export const editAlWaseetOrder = async (orderData, token) => {
  // Format phones for Al-Waseet API requirements (same as createAlWaseetOrder)
  const { formatPhoneForAlWaseet, isValidAlWaseetPhone } = await import('../utils/phoneUtils.js');
  
  const formattedData = { ...orderData };
  
  // Validate required fields
  if (!formattedData.qr_id) {
    throw new Error('رقم الطلب مطلوب للتعديل.');
  }
  
  // Format primary phone (required)
  if (formattedData.client_mobile) {
    formattedData.client_mobile = formatPhoneForAlWaseet(formattedData.client_mobile);
    if (!isValidAlWaseetPhone(orderData.client_mobile)) {
      throw new Error('رقم الهاتف الأساسي غير صحيح. يجب أن يكون رقم عراقي صحيح.');
    }
  }
  
  // Format secondary phone (optional) - only include if valid
  if (formattedData.client_mobile2) {
    const formatted2 = formatPhoneForAlWaseet(formattedData.client_mobile2);
    if (isValidAlWaseetPhone(orderData.client_mobile2)) {
      formattedData.client_mobile2 = formatted2;
    } else {
      delete formattedData.client_mobile2; // Remove invalid secondary phone
    }
  }
  
  // Ensure numeric fields are properly formatted
  formattedData.price = parseInt(formattedData.price) || 0;
  formattedData.items_number = parseInt(formattedData.items_number) || 0;
  formattedData.city_id = parseInt(formattedData.city_id) || 0;
  formattedData.region_id = parseInt(formattedData.region_id) || 0;
  formattedData.package_size = parseInt(formattedData.package_size) || 0;
  formattedData.replacement = parseInt(formattedData.replacement) || 0;
  
  return handleApiCall('edit-order', 'POST', token, formattedData, { token });
};