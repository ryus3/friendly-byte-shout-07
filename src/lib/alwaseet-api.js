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
  
  // Format secondary phone (optional) - only include if valid
  if (formattedData.client_mobile2) {
    const formatted2 = formatPhoneForAlWaseet(formattedData.client_mobile2);
    if (isValidAlWaseetPhone(mappedData.client_mobile2)) {
      formattedData.client_mobile2 = formatted2;
    } else {
      delete formattedData.client_mobile2; // Remove invalid secondary phone
    }
  }

  // Ensure numeric fields are properly formatted (align with edit behavior)
  formattedData.price = parseInt(formattedData.price) || 0;
  formattedData.items_number = parseInt(formattedData.items_number) || 0;
  formattedData.city_id = parseInt(formattedData.city_id) || 0;
  formattedData.region_id = parseInt(formattedData.region_id) || 0;
  formattedData.package_size = parseInt(formattedData.package_size) || 0;
  formattedData.replacement = parseInt(formattedData.replacement) || 0;
  
  return handleApiCall('create-order', 'POST', token, formattedData, { token });
};

// Helper function to map local field names to Al-Waseet API field names
const mapToAlWaseetFields = (orderData) => {
  return {
    qr_id: orderData.tracking_number || orderData.qr_id,
    client_name: orderData.name || orderData.client_name,
    client_mobile: orderData.phone || orderData.client_mobile,
    client_mobile2: orderData.phone2 || orderData.client_mobile2,
    city_id: orderData.city_id,
    region_id: orderData.region_id,
    location: orderData.address || orderData.client_address || orderData.location,
    type_name: orderData.details || orderData.type_name,
    items_number: orderData.quantity || orderData.items_number,
    price: orderData.price,
    package_size: orderData.size || orderData.package_size,
    merchant_notes: orderData.notes || orderData.merchant_notes,
    replacement: orderData.replacement || 0
  };
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

export const getMerchantOrders = async (token) => {
  return handleApiCall('merchant-orders', 'GET', token, null, { token });
};

export const getOrderById = async (token, orderId) => {
  return handleApiCall('merchant-orders', 'GET', token, null, { token, order_id: orderId });
};

export const getOrderStatuses = async (token) => {
  return handleApiCall('order-statuses', 'GET', token);
};