/**
 * مطابقة ذكية لاسم المنتج + اللون/المقاس القادم من الطلبات الذكية.
 *
 * يستقبل اسماً مركباً مثل "نايك نيلي" أو "ايرفورس احمر xl" ويحاول:
 *  1) مطابقة المنتج الأساسي بأطول prefix من كلمات الاسم يطابق منتجاً موجوداً.
 *  2) استخدام بقية الكلمات كمرشّحات للون أو المقاس.
 *  3) العودة لِـ variants للمنتج المطابق والبحث عن variant يطابق أيّاً من المرشّحات.
 */

const normalize = (v) => (v || '').toString().trim().toLowerCase();

const tokenize = (str) => normalize(str).split(/\s+/).filter(Boolean);

/**
 * يحاول إيجاد منتج يطابق "أطول prefix" من كلمات اسم الطلب.
 * يعيد { product, leftoverTokens } أو null.
 */
const findProductByLongestPrefix = (products, tokens) => {
  if (!tokens.length || !products?.length) return null;

  // جرّب من الأطول إلى الأقصر
  for (let take = tokens.length; take >= 1; take--) {
    const candidateName = tokens.slice(0, take).join(' ');
    // مطابقة دقيقة أولاً
    let product = products.find(p => normalize(p.name) === candidateName);
    // ثم مطابقة بأن اسم المنتج يحتوي المرشّح كاملاً
    if (!product) {
      product = products.find(p => normalize(p.name).includes(candidateName));
    }
    // ثم العكس: المرشّح يحتوي اسم المنتج (مفيد لو الاسم منفصل)
    if (!product && take === tokens.length) {
      product = products.find(p => {
        const pn = normalize(p.name);
        return pn && candidateName.startsWith(pn);
      });
    }
    if (product) {
      return { product, leftoverTokens: tokens.slice(take) };
    }
  }
  return null;
};

/**
 * يبحث عن variant يطابق المرشّحات (لون/مقاس).
 * يعطي أولوية: لون+مقاس معاً > لون فقط > مقاس فقط > أي variant.
 */
const findVariant = (variants, { colorHints = [], sizeHints = [] } = {}) => {
  if (!variants?.length) return null;
  if (variants.length === 1) return variants[0];

  const getColor = (v) => normalize(v.color || v.color_name);
  const getSize  = (v) => normalize(v.size  || v.size_name);

  const matchesColor = (v) => colorHints.length === 0 || colorHints.some(h => getColor(v) === h || getColor(v).includes(h) || h.includes(getColor(v)));
  const matchesSize  = (v) => sizeHints.length === 0  || sizeHints.some(h => getSize(v) === h);

  // لون + مقاس
  let v = variants.find(x => colorHints.some(h => getColor(x) === h) && sizeHints.some(h => getSize(x) === h));
  if (v) return v;
  // مطابقة جزئية على اللون + مقاس دقيق
  v = variants.find(x => matchesColor(x) && sizeHints.some(h => getSize(x) === h));
  if (v) return v;
  // لون فقط
  if (colorHints.length) {
    v = variants.find(x => colorHints.some(h => getColor(x) === h));
    if (v) return v;
    v = variants.find(x => matchesColor(x));
    if (v) return v;
  }
  // مقاس فقط
  if (sizeHints.length) {
    v = variants.find(x => sizeHints.some(h => getSize(x) === h));
    if (v) return v;
  }
  return null;
};

/**
 * مطابقة عنصر طلب ذكي مع منتج + variant.
 *
 * @param {Array} products قائمة المنتجات (مع variants)
 * @param {Object} item عنصر الطلب: { product_name, name, color, size, ... }
 * @returns {{ product, variant }|null}
 */
export function smartMatchProduct(products, item) {
  if (!products?.length) return null;

  const rawName = item.product_name || item.name || '';
  const explicitColor = normalize(item.color);
  const explicitSize  = normalize(item.size);

  const nameTokens = tokenize(rawName);
  if (!nameTokens.length && !explicitColor && !explicitSize) return null;

  // 1) ابحث عن المنتج بأطول prefix
  const found = findProductByLongestPrefix(products, nameTokens);
  if (!found) return null;

  const { product, leftoverTokens } = found;

  // 2) جمع المرشّحات للون والمقاس
  const colorHints = [];
  const sizeHints = [];
  if (explicitColor) colorHints.push(explicitColor);
  if (explicitSize)  sizeHints.push(explicitSize);

  // الكلمات المتبقية تُعتبر مرشّحات لكليهما (نُجرّبهما على variants)
  for (const tok of leftoverTokens) {
    colorHints.push(tok);
    sizeHints.push(tok);
  }

  // 3) ابحث عن variant
  const variants = Array.isArray(product.variants)
    ? product.variants
    : (product.product_variants || []);

  const variant = findVariant(variants, { colorHints, sizeHints });
  if (!variant) return { product, variant: null };

  return { product, variant };
}

export default smartMatchProduct;
