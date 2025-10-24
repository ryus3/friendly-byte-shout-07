// ==========================================
// Replacement & Return Order Parser
// ==========================================

export interface ReplacementOrderData {
  type: 'replacement';
  outgoingProduct: {
    name: string;
    color?: string;
    size?: string;
  };
  incomingProduct: {
    name: string;
    color?: string;
    size?: string;
  };
  customerInfo: {
    name: string;
    phone: string;
    city: string;
    address: string;
  };
  deliveryFee: number;
}

export interface ReturnOrderData {
  type: 'return';
  product: {
    name: string;
    color?: string;
    size?: string;
  };
  customerInfo: {
    name: string;
    phone: string;
    city: string;
    address: string;
  };
  refundAmount: number;
}

/**
 * كشف نوع الطلب: عادي، استبدال، ترجيع
 */
export function detectOrderType(text: string): 'replacement' | 'return' | 'regular' {
  const replacementRegex = /#(استبدال|استبذال|أستبدال|تبديل)/;
  const returnRegex = /#(ارجاع|ترجيع|استرجاع|إرجاع)/;
  
  if (replacementRegex.test(text)) return 'replacement';
  if (returnRegex.test(text)) return 'return';
  return 'regular';
}

/**
 * تحليل طلب الاستبدال
 * مثال: برشلونة ازرق M #استبدال برشلونة ابيض S
 */
export function parseReplacementOrder(text: string): ReplacementOrderData | null {
  try {
    const lines = text.trim().split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length < 4) return null;

    // السطر 1: الاسم
    const customerName = lines[0];

    // السطر 2: المدينة - المنطقة
    const locationLine = lines[1];
    const locationParts = locationLine.split(/[-–—]/);
    const customerCity = locationParts[0]?.trim() || '';
    const customerAddress = locationParts.slice(1).join(' - ').trim() || '';

    // السطر 3: رقم الهاتف
    const customerPhone = lines[2];

    // السطر 4: المنتجات والاستبدال
    const productsLine = lines[3];
    const replacementRegex = /(.*?)\s*#(استبدال|استبذال|أستبدال|تبديل)\s*(.*)/;
    const match = productsLine.match(replacementRegex);

    if (!match) return null;

    const outgoingText = match[1].trim();
    const incomingText = match[3].trim();

    // تحليل المنتج الخارج
    const outgoingProduct = parseProductString(outgoingText);
    
    // تحليل المنتج الداخل
    const incomingProduct = parseProductString(incomingText);

    // السطر 5: رسوم التوصيل (اختياري)
    const deliveryFee = lines[4] ? parseFloat(lines[4].replace(/[^\d.]/g, '')) || 5000 : 5000;

    return {
      type: 'replacement',
      outgoingProduct,
      incomingProduct,
      customerInfo: {
        name: customerName,
        phone: customerPhone,
        city: customerCity,
        address: customerAddress
      },
      deliveryFee
    };
  } catch (error) {
    console.error('❌ خطأ في تحليل طلب الاستبدال:', error);
    return null;
  }
}

/**
 * تحليل طلب الترجيع
 * مثال: برشلونة ازرق M #ترجيع\n15000
 */
export function parseReturnOrder(text: string): ReturnOrderData | null {
  try {
    const lines = text.trim().split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length < 4) return null;

    // السطر 1: الاسم
    const customerName = lines[0];

    // السطر 2: المدينة - المنطقة
    const locationLine = lines[1];
    const locationParts = locationLine.split(/[-–—]/);
    const customerCity = locationParts[0]?.trim() || '';
    const customerAddress = locationParts.slice(1).join(' - ').trim() || '';

    // السطر 3: رقم الهاتف
    const customerPhone = lines[2];

    // السطر 4: المنتج + #ترجيع
    const productLine = lines[3];
    const returnRegex = /(.*?)\s*#(ارجاع|ترجيع|استرجاع|إرجاع)/;
    const match = productLine.match(returnRegex);

    if (!match) return null;

    const productText = match[1].trim();
    const product = parseProductString(productText);

    // السطر 5: المبلغ المسترجع (إجباري)
    const refundAmount = lines[4] ? parseFloat(lines[4].replace(/[^\d.]/g, '')) || 0 : 0;

    return {
      type: 'return',
      product,
      customerInfo: {
        name: customerName,
        phone: customerPhone,
        city: customerCity,
        address: customerAddress
      },
      refundAmount
    };
  } catch (error) {
    console.error('❌ خطأ في تحليل طلب الترجيع:', error);
    return null;
  }
}

/**
 * تحليل نص المنتج بطريقة ديناميكية - يتعرف على المنتجات متعددة الكلمات تلقائياً
 * يعمل بطريقة عكسية: يحدد الحجم واللون أولاً، والباقي هو اسم المنتج
 * مثال: "ريال مدريد ازرق L" => {name: "ريال مدريد", color: "ازرق", size: "L"}
 */
function parseProductString(productText: string): { name: string; color?: string; size?: string } {
  const trimmedText = productText.trim();
  const parts = trimmedText.split(/\s+/);
  
  if (parts.length === 0) return { name: '' };
  
  // قوائم الأحجام والألوان المعروفة
  const KNOWN_SIZES = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL', '2XL', '3XL', '4XL',
                       'صغير', 'وسط', 'كبير', 'لارج', 'ميديوم', 'سمول'];
  const KNOWN_COLORS = ['ازرق', 'احمر', 'اسود', 'ابيض', 'اخضر', 'اصفر',
                        'رمادي', 'بني', 'برتقالي', 'بنفسجي', 'وردي', 'كحلي',
                        'سمائي', 'برونزي', 'ذهبي', 'فضي', 'نيلي', 'زهري'];
  
  // دالة فحص الحجم
  const isKnownSize = (text: string): boolean => {
    const upper = text.toUpperCase();
    return KNOWN_SIZES.includes(upper) || KNOWN_SIZES.includes(text);
  };
  
  // دالة فحص اللون
  const isKnownColor = (text: string): boolean => {
    return KNOWN_COLORS.includes(text);
  };
  
  // منطق التحليل الذكي: نبدأ من الآخر ونبحث عن الحجم واللون
  let productName = parts[0];
  let color: string | undefined = undefined;
  let size: string | undefined = undefined;
  
  // فحص آخر جزء: هل هو حجم؟
  if (parts.length >= 2 && isKnownSize(parts[parts.length - 1])) {
    size = parts[parts.length - 1];
    
    // فحص ما قبل الأخير: هل هو لون؟
    if (parts.length >= 3 && isKnownColor(parts[parts.length - 2])) {
      color = parts[parts.length - 2];
      productName = parts.slice(0, parts.length - 2).join(' ');
    } else {
      productName = parts.slice(0, parts.length - 1).join(' ');
    }
  }
  // إذا لم يكن الأخير حجم، فحص: هل الأخير لون؟
  else if (parts.length >= 2 && isKnownColor(parts[parts.length - 1])) {
    color = parts[parts.length - 1];
    productName = parts.slice(0, parts.length - 1).join(' ');
  }
  // حالة: 3 أجزاء بدون تطابق مباشر
  else if (parts.length === 3) {
    productName = `${parts[0]} ${parts[1]}`;
    if (isKnownSize(parts[2])) {
      size = parts[2];
    } else if (isKnownColor(parts[2])) {
      color = parts[2];
    }
  }
  // حالة: 4+ أجزاء
  else if (parts.length >= 4) {
    const possibleSize = parts[parts.length - 1];
    const possibleColor = parts[parts.length - 2];
    
    if (isKnownSize(possibleSize) && isKnownColor(possibleColor)) {
      size = possibleSize;
      color = possibleColor;
      productName = parts.slice(0, parts.length - 2).join(' ');
    } else if (isKnownSize(possibleSize)) {
      size = possibleSize;
      productName = parts.slice(0, parts.length - 1).join(' ');
    } else if (isKnownColor(possibleColor)) {
      color = possibleColor;
      productName = parts.slice(0, parts.length - 1).join(' ');
    } else {
      productName = parts.join(' ');
    }
  }
  
  return { name: productName, color, size };
}
