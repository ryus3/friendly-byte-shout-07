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
  priceAdjustment?: number;
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

    // السطر 5 و 6: رسوم التوصيل وفرق السعر (اختياري)
    let deliveryFee = 5000;
    let priceAdjustment = 0;
    
    if (lines[4]) {
      const line5Value = parseFloat(lines[4].replace(/[^\d.-]/g, '')) || 0;
      // إذا كان سالب أو موجب كبير (أكثر من 10000)، فهو فرق سعر
      if (line5Value < 0 || line5Value > 10000) {
        priceAdjustment = line5Value;
        // السطر 6: رسوم التوصيل
        deliveryFee = lines[5] ? parseFloat(lines[5].replace(/[^\d.]/g, '')) || 5000 : 5000;
      } else {
        // السطر 5 هو رسوم توصيل
        deliveryFee = line5Value;
      }
    }

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
      deliveryFee,
      priceAdjustment
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
 * تحليل نص المنتج: "برشلونة ازرق M" => {name: برشلونة, color: ازرق, size: M}
 */
function parseProductString(productText: string): { name: string; color?: string; size?: string } {
  const parts = productText.trim().split(/\s+/);
  
  if (parts.length === 0) return { name: '' };
  
  // الجزء الأول دائماً هو اسم المنتج
  const name = parts[0];
  
  // الأجزاء التالية: لون، حجم
  const color = parts[1] || undefined;
  const size = parts[2] || undefined;
  
  return { name, color, size };
}
