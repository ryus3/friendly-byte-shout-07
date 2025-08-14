// This file contains functions to interact with the Al-Waseet delivery company API.

import { supabase } from '@/integrations/supabase/client';

const handleApiCall = async (endpoint, method, token, payload, queryParams) => {
  const { data, error } = await supabase.functions.invoke('alwaseet-proxy', {
    body: { endpoint, method, token, payload, queryParams }
  });

  if (error) {
    const errorBody = await error.context.json();
    throw new Error(errorBody.msg || `فشل الاتصال بالخادم الوكيل: ${error.message}`);
  }
  
  if (data.errNum !== "S000" || !data.status) {
    throw new Error(data.msg || 'حدث خطأ غير متوقع من واجهة برمجة التطبيقات.');
  }

  return data.data;
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
  return handleApiCall('create-order', 'POST', token, orderData, { token });
};

export const editAlWaseetOrder = async (orderData, token) => {
  return handleApiCall('edit-order', 'POST', token, orderData, { token });
};