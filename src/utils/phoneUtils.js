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

    // Remove 00964 or 964 country code if present
    if (digits.startsWith('00964')) {
      digits = digits.slice(5);
    } else if (digits.startsWith('964')) {
      digits = digits.slice(3);
    }

    // Ensure local leading 0 for mobile numbers starting with 7
    if (digits.startsWith('7')) {
      digits = '0' + digits;
    }

    // If already starts with 0 and length 11, keep as is
    if (digits.startsWith('0') && digits.length === 11) return digits;

    // If length 10 (missing leading 0), add it
    if (!digits.startsWith('0') && digits.length === 10) {
      return '0' + digits;
    }

    // Fallback: return best-effort digits (trim to 11 if longer)
    if (digits.length > 11) return digits.slice(0, 11);
    return digits;
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
