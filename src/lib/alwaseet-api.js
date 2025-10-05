
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
    
    // معالجة خاصة لـ edit-order: فحص رسالة النجاح بدلاً من الأكواد فقط
    if (endpoint === 'edit-order') {
      console.log('📋 تحليل استجابة edit-order:', { 
        errNum: data.errNum, 
        status: data.status, 
        msg: data.msg,
        fullResponse: data 
      });
      
      // فحص رسالة النجاح أو الأكواد المعتادة
      const isSuccessMessage = data.msg && data.msg.includes('تم التعديل بنجاح');
      const isSuccessCode = data.errNum === "S000" && data.status;
      
      if (!isSuccessMessage && !isSuccessCode) {
        console.error('❌ فشل تحديث الطلب:', data);
        throw new Error(data.msg || 'فشل تحديث الطلب في شركة التوصيل.');
      }
      
      console.log('✅ نجح تحديث الطلب في Al-Waseet');
      return data.data || data;
    }
    
    // المعالجة العادية للـ endpoints الأخرى
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
  
  // استخراج أقرب نقطة دالة - استخدام landmark من النتيجة المحدثة
  let cleanedLocation = '';
  
  // أولوية للـ landmark المستخرج من العنوان المعالج
  if (orderData.order_data?.landmark && orderData.order_data.landmark.trim()) {
    cleanedLocation = orderData.order_data.landmark.trim();
  } 
  // إذا لم يكن متوفراً، استخدم العنوان الكامل وقم بتنظيفه
  else {
    cleanedLocation = orderData.customer_address || orderData.address || orderData.client_address || orderData.location || '';
    
    // تنظيف أساسي: إزالة أرقام الهاتف والأرقام القصيرة
    cleanedLocation = cleanedLocation.replace(/\b\d{7,}\b/g, ''); // أرقام الهاتف
    cleanedLocation = cleanedLocation.replace(/\b\d{1,3}\b/g, ''); // الكميات
    
    // إزالة أسماء المنتجات والألوان والأحجام فقط
    const unwantedTerms = [
      // منتجات
      'تيشرت', 'تشيرت', 'بنطال', 'جينز', 'قميص', 'فستان', 'سوت', 'شيك',
      'برشلونة', 'ارجنتين', 'ريال', 'مدريد', 'باريس', 'سان', 'جيرمان',
      // ألوان
      'احمر', 'اخضر', 'ازرق', 'اصفر', 'اسود', 'ابيض', 'بني', 'رمادي',
      'سمائي', 'سماوي', 'بنفسجي', 'وردي', 'برتقالي',
      // أحجام
      'كبير', 'صغير', 'وسط', 'ميديم', 'لارج', 'سمول', 'اكس', 'دبل',
      'xl', 'xxl', 'xxxl', 's', 'm', 'l', 'xs'
    ];
    
    // إزالة المصطلحات غير المرغوب فيها
    unwantedTerms.forEach(term => {
      const regex = new RegExp('\\b' + term + '\\b', 'gi');
      cleanedLocation = cleanedLocation.replace(regex, '');
    });
    
    // إزالة أسماء المدن والمناطق المحددة مسبقاً
    if (orderData.customer_city) {
      const cityRegex = new RegExp('\\b' + orderData.customer_city + '\\b', 'gi');
      cleanedLocation = cleanedLocation.replace(cityRegex, '');
    }
    if (orderData.customer_province && orderData.customer_province !== orderData.customer_city) {
      const regionRegex = new RegExp('\\b' + orderData.customer_province + '\\b', 'gi');
      cleanedLocation = cleanedLocation.replace(regionRegex, '');
    }
  }
  
  // تنظيف المسافات الإضافية
  cleanedLocation = cleanedLocation.replace(/\s+/g, ' ').replace(/[,،\-\s]+$/, '').trim();
  
  // إذا كان العنوان قصيراً جداً، اتركه فارغ
  if (cleanedLocation.length < 3) {
    cleanedLocation = '';
  }
  
  console.log('🧹 تنظيف العنوان:', {
    original: orderData.customer_address,
    landmark: orderData.order_data?.landmark,
    cleaned: cleanedLocation
  });
  
  const mapped = {
    qr_id: orderData.tracking_number || orderData.qr_id || orderData.delivery_partner_order_id,
    client_name: orderData.customer_name || orderData.name || orderData.client_name || '',
    client_mobile: orderData.customer_phone || orderData.phone || orderData.client_mobile || '',
    client_mobile2: orderData.customer_phone2 || orderData.phone2 || orderData.client_mobile2 || '',
    // البحث أولاً في البيانات المباشرة ثم في order_data - أولوية لـ alwaseet_* IDs
    city_id: parseInt(orderData.alwaseet_city_id || orderData.city_id || orderData.customer_city_id || orderData.order_data?.city_id || 0),
    region_id: parseInt(orderData.alwaseet_region_id || orderData.region_id || orderData.customer_region_id || orderData.order_data?.region_id || 0),
    location: cleanedLocation, // أقرب نقطة دالة فقط
    type_name: orderData.details || orderData.type_name || 'طلب عادي',
    items_number: parseInt(orderData.quantity || orderData.items_number || 1),
    price: parseInt(orderData.price || orderData.final_total || orderData.total_amount || 0),
    package_size: parseInt(orderData.package_size_id || orderData.size || orderData.package_size || 1),
    merchant_notes: orderData.notes || orderData.merchant_notes || '',
    replacement: parseInt(orderData.replacement || 0)
  };
  
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
  
  // Format secondary phone (optional) - only include if valid
  if (formattedData.client_mobile2) {
    const formatted2 = formatPhoneForAlWaseet(formattedData.client_mobile2);
    if (isValidAlWaseetPhone(formattedData.client_mobile2)) {
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

// Get specific order by QR/tracking number
export const getOrderByQR = async (token, qrId) => {
  const orders = await handleApiCall('merchant-orders', 'GET', token, null, { token });
  // البحث بـ qr_id، id، أو tracking_number لشمول جميع الحالات
  return orders.find(order => 
    order.qr_id === String(qrId) || 
    order.id === String(qrId) ||
    order.tracking_number === String(qrId)
  );
};
