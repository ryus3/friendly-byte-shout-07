// Input validation utilities for Telegram bot

export interface OrderValidation {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate customer name
 */
export function validateCustomerName(name: string): { isValid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { isValid: false, error: 'الاسم مطلوب' };
  }
  
  if (name.length > 100) {
    return { isValid: false, error: 'الاسم طويل جداً (الحد الأقصى 100 حرف)' };
  }
  
  // Allow Arabic, English, numbers, and common punctuation
  const validNamePattern = /^[\u0600-\u06FFa-zA-Z0-9\s\-\.]+$/;
  if (!validNamePattern.test(name)) {
    return { isValid: false, error: 'الاسم يحتوي على حروف غير صالحة' };
  }
  
  return { isValid: true };
}

/**
 * Validate Iraqi phone number
 */
export function validatePhoneNumber(phone: string): { isValid: boolean; error?: string } {
  if (!phone || phone.trim().length === 0) {
    return { isValid: false, error: 'رقم الهاتف مطلوب' };
  }
  
  // Iraqi phone format: 07XXXXXXXXX (11 digits starting with 07)
  const phonePattern = /^07[0-9]{9}$/;
  const cleanPhone = phone.replace(/[\s\-]/g, '');
  
  if (!phonePattern.test(cleanPhone)) {
    return { isValid: false, error: 'رقم الهاتف غير صالح. يجب أن يبدأ بـ 07 ويتكون من 11 رقم' };
  }
  
  return { isValid: true };
}

/**
 * Validate address
 */
export function validateAddress(address: string): { isValid: boolean; error?: string } {
  if (!address || address.trim().length === 0) {
    return { isValid: false, error: 'العنوان مطلوب' };
  }
  
  if (address.length < 5) {
    return { isValid: false, error: 'العنوان قصير جداً' };
  }
  
  if (address.length > 500) {
    return { isValid: false, error: 'العنوان طويل جداً (الحد الأقصى 500 حرف)' };
  }
  
  return { isValid: true };
}

/**
 * Sanitize text input (remove HTML/script tags)
 */
export function sanitizeText(text: string): string {
  if (!text) return '';
  
  // Remove HTML tags and script content
  let sanitized = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/<[^>]+>/g, '');
  
  // Remove potentially dangerous characters
  sanitized = sanitized.replace(/[<>]/g, '');
  
  return sanitized.trim();
}

/**
 * Validate quantity
 */
export function validateQuantity(quantity: number): { isValid: boolean; error?: string } {
  if (!Number.isInteger(quantity)) {
    return { isValid: false, error: 'الكمية يجب أن تكون رقم صحيح' };
  }
  
  if (quantity < 1) {
    return { isValid: false, error: 'الكمية يجب أن تكون 1 على الأقل' };
  }
  
  if (quantity > 1000) {
    return { isValid: false, error: 'الكمية كبيرة جداً (الحد الأقصى 1000)' };
  }
  
  return { isValid: true };
}

/**
 * Validate order items array
 */
export function validateOrderItems(items: any[]): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!Array.isArray(items)) {
    return { isValid: false, errors: ['العناصر يجب أن تكون قائمة'] };
  }
  
  if (items.length === 0) {
    return { isValid: false, errors: ['يجب إضافة عنصر واحد على الأقل'] };
  }
  
  if (items.length > 50) {
    return { isValid: false, errors: ['عدد العناصر كبير جداً (الحد الأقصى 50 عنصر)'] };
  }
  
  items.forEach((item, index) => {
    if (!item.name || item.name.length > 200) {
      errors.push(`العنصر ${index + 1}: اسم غير صالح`);
    }
    
    const quantityValidation = validateQuantity(item.quantity);
    if (!quantityValidation.isValid) {
      errors.push(`العنصر ${index + 1}: ${quantityValidation.error}`);
    }
  });
  
  return { isValid: errors.length === 0, errors };
}

/**
 * Convert Arabic numbers to English numbers
 */
export function convertArabicToEnglishNumbers(text: string): string {
  const arabicNumbers = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  const englishNumbers = ['0','1','2','3','4','5','6','7','8','9'];
  
  let converted = text;
  arabicNumbers.forEach((arabic, index) => {
    converted = converted.replace(new RegExp(arabic, 'g'), englishNumbers[index]);
  });
  
  return converted;
}

/**
 * Parse Arabic number words (e.g., "28 الف" → "28000")
 */
export function parseArabicNumberWords(text: string): string {
  let parsed = text;
  
  // تحويل "الف" و "ألف" إلى "000"
  parsed = parsed.replace(/(\d+)\s*(?:الف|ألف|الاف|آلاف)/gi, (match, number) => {
    return (parseInt(number) * 1000).toString();
  });
  
  return parsed;
}

/**
 * Rate limiting: Check if chat_id is making too many requests
 */
const requestCounts = new Map<number, { count: number; resetTime: number }>();

export function checkRateLimit(chatId: number, maxRequests: number = 30, windowMs: number = 60000): boolean {
  const now = Date.now();
  const chatData = requestCounts.get(chatId);
  
  if (!chatData || now > chatData.resetTime) {
    requestCounts.set(chatId, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (chatData.count >= maxRequests) {
    return false;
  }
  
  chatData.count++;
  return true;
}
