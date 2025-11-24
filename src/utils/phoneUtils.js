// Shared phone utilities for consistent normalization and matching across the app
// Canonical format: local Iraqi mobile starting with 0 and 11 digits (e.g., 07728020024)

export function normalizePhone(input) {
  if (!input) return '';
  try {
    let s = String(input).trim();
    // Remove spaces, dashes, parentheses, plus signs
    s = s.replace(/[\s\-\(\)\+]/g, '');

    // Keep digits only
    let digits = s.replace(/\D/g, '');

    // Handle different Iraqi phone formats
    // Remove country codes: 00964, 964
    if (digits.startsWith('00964')) {
      digits = digits.slice(5);
    } else if (digits.startsWith('964')) {
      digits = digits.slice(3);
    }

    // Ensure proper Iraqi mobile format
    // Add leading 0 if missing for mobile numbers (7, 8, 9)
    if (digits.length === 10 && /^[789]/.test(digits)) {
      digits = '0' + digits;
    }
    
    // If starts with 7, 8, or 9 and shorter than 10, add leading 0
    if (/^[789]/.test(digits) && digits.length < 11) {
      digits = '0' + digits;
    }

    // Validate Iraqi mobile number patterns
    // Iraqi mobile should start with 07, 076X, 077X, 078X, 079X
    const validMobilePattern = /^0(7[789]|7[0156])\d{8}$/;
    
    // Return valid 11-digit Iraqi number or format for API
    if (digits.startsWith('0') && digits.length === 11 && validMobilePattern.test(digits)) {
      return digits;
    }
    
    // If exactly 10 digits and doesn't start with 0, try adding 0
    if (digits.length === 10 && !digits.startsWith('0') && /^[789]/.test(digits)) {
      const formatted = '0' + digits;
      if (validMobilePattern.test(formatted)) {
        return formatted;
      }
    }

    // Invalid format
    return '';
  } catch (_) {
    return '';
  }
}

export function phonesEqual(a, b) {
  return normalizePhone(a) === normalizePhone(b);
}

// Try to extract a phone from various known order shapes
export function extractOrderPhone(order) {
  if (!order || typeof order !== 'object') return '';
  return (
    order.customer_phone ||
    order.order_data?.customer_phone ||
    order.client_mobile ||
    order.phone ||
    order.customerinfo?.phone ||
    order.customer?.phone ||
    ''
  );
}

export function formatLocalPhone(phone) {
  const p = normalizePhone(phone);
  // Simple grouping 077 280 200 24 (optional display)
  return p;
}

// Format WhatsApp link with proper validation and conversion
export function formatWhatsAppLink(link) {
  if (!link) return null;
  
  // ✅ WhatsApp shortlinks (wa.me/message/CODE) - remove any extra query params
  if (link.includes('wa.me/message/')) {
    // Remove any text or extra query params
    const cleanLink = link.split('?')[0]; // https://wa.me/message/XXXXX only
    return cleanLink;
  }
  
  // ✅ api.whatsapp.com/send links - convert to wa.me
  if (link.includes('api.whatsapp.com/send')) {
    const phoneMatch = link.match(/phone=(\d+)/);
    if (phoneMatch) {
      let phone = phoneMatch[1];
      
      // Convert local Iraqi format (07...) to international (9647...)
      if (phone.startsWith('07') && phone.length === 11) {
        phone = '964' + phone.slice(1); // 07728020024 -> 9647728020024
      } else if (phone.startsWith('7') && phone.length === 10) {
        phone = '964' + phone; // 7728020024 -> 9647728020024
      }
      
      const defaultMessage = encodeURIComponent('مرحباً، أريد الاستفسار عن طلبي');
      return `https://wa.me/${phone}?text=${defaultMessage}`;
    }
  }
  
  // ✅ wa.me/{phone} links without message - add default message
  if (link.includes('wa.me/') && !link.includes('/message/') && !link.includes('text=')) {
    let cleanUrl = link;
    
    // Extract phone number and convert if needed
    const phoneMatch = link.match(/wa\.me\/(\d+)/);
    if (phoneMatch) {
      let phone = phoneMatch[1];
      
      // Convert local Iraqi format to international
      if (phone.startsWith('07') && phone.length === 11) {
        phone = '964' + phone.slice(1);
        cleanUrl = link.replace(/wa\.me\/\d+/, `wa.me/${phone}`);
      } else if (phone.startsWith('7') && phone.length === 10) {
        phone = '964' + phone;
        cleanUrl = link.replace(/wa\.me\/\d+/, `wa.me/${phone}`);
      }
    }
    
    const defaultMessage = encodeURIComponent('مرحباً، أريد الاستفسار');
    const separator = cleanUrl.includes('?') ? '&' : '?';
    return `${cleanUrl}${separator}text=${defaultMessage}`;
  }
  
  return link;
}

// Format phone for Al-Waseet API (requires +9647XXXXXXXXX format)
export function formatPhoneForAlWaseet(phone) {
  if (!phone) return '';
  
  const normalized = normalizePhone(phone);
  if (!normalized || normalized.length !== 11) return '';
  
  // Remove leading 0 and add +964
  const withoutZero = normalized.startsWith('0') ? normalized.slice(1) : normalized;
  return `+964${withoutZero}`;
}

// Validate if phone is suitable for Al-Waseet API
export function isValidAlWaseetPhone(phone) {
  const formatted = formatPhoneForAlWaseet(phone);
  return formatted.length === 14 && formatted.startsWith('+9647');
}
