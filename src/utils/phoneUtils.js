// Utils for phone number normalization and lookup across the app
// Centralizes Iraqi phone formats so 077..., 77..., +964..., 00964... are treated the same

export const normalizeIraqiPhone = (phone) => {
  if (phone == null) return null;
  let s = String(phone).trim();
  // remove everything except digits
  s = s.replace(/[^\\d]/g, '');

  // remove leading international prefixes
  if (s.startsWith('00')) s = s.slice(2);
  if (s.startsWith('964')) s = s.slice(3);

  // remove local trunk prefix 0
  if (s.startsWith('0')) s = s.slice(1);

  // keep last 10 digits (Iraqi mobile NSN length)
  if (s.length > 10) s = s.slice(-10);

  // basic length validation
  if (s.length !== 10) return null;

  return s; // canonical: e.g., 7728020024
};

export const formatE164Iraq = (canonical) => (canonical ? `+964${canonical}` : null);

// Quick helper to find stats for a phone in an orders array
export const findPhoneStatsInOrders = (orders, phoneInput) => {
  const canonical = normalizeIraqiPhone(phoneInput);
  if (!canonical || !Array.isArray(orders)) return { canonical: null, count: 0, lastOrderDate: null };

  let count = 0;
  let last = null;

  for (const order of orders) {
    const raw = order?.customer_phone || order?.phone_number || order?.client_mobile || order?.phone || order?.customerinfo?.phone;
    const c = normalizeIraqiPhone(raw);
    if (c && c === canonical) {
      count++;
      const created = order?.created_at || order?.createdAt;
      const d = created ? new Date(created) : null;
      if (d && !Number.isNaN(d.getTime())) {
        if (!last || d > last) last = d;
      }
    }
  }

  return { canonical, count, lastOrderDate: last };
};
