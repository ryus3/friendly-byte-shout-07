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

    // Return valid 11-digit Iraqi number or empty
    if (digits.startsWith('0') && digits.length === 11) {
      return digits;
    }
    
    // If exactly 10 digits and doesn't start with 0, try adding 0
    if (digits.length === 10 && !digits.startsWith('0')) {
      return '0' + digits;
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
