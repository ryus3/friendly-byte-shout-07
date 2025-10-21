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

// ✅ قائمة المنتجات ذات الكلمتين (يجب تحديثها عند إضافة منتجات جديدة)
const TWO_WORD_PRODUCTS = [
  'سوت شيك',
  'سوت مايسترو',
  'ترنج اديداس',
  'جاكيت اديداس',
  'بنطلون جينز',
  'تي شيرت',
  'بولو شيرت'
];

/**
 * تحليل نص المنتج: "برشلونة ازرق M" => {name: برشلونة, color: ازرق, size: M}
 * يدعم المنتجات ذات الكلمة الواحدة والكلمتين
 */
function parseProductString(productText: string): { name: string; color?: string; size?: string } {
  const trimmedText = productText.trim();
  const parts = trimmedText.split(/\s+/);
  
  if (parts.length === 0) return { name: '' };
  
  // ✅ التحقق من وجود منتج من كلمتين
  let name = parts[0];
  let startIndex = 1;
  
  // فحص إذا كانت أول كلمتين تشكلان اسم منتج معروف
  if (parts.length >= 2) {
    const possibleTwoWordName = `${parts[0]} ${parts[1]}`;
    const foundTwoWord = TWO_WORD_PRODUCTS.find(product => 
      possibleTwoWordName.includes(product) || product.includes(possibleTwoWordName)
    );
    
    if (foundTwoWord) {
      name = foundTwoWord;
      startIndex = 2;  // الأجزاء التالية تبدأ من الفهرس 2
    }
  }
  
  // الأجزاء التالية: لون، حجم
  const color = parts[startIndex] || undefined;
  const size = parts[startIndex + 1] || undefined;
  
  return { name, color, size };
}
