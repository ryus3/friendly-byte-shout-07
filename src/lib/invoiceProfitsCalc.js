/**
 * حاسبة أرباح الفاتورة الدقيقة (مصدر الحقيقة: orders.final_amount - delivery_fee)
 *
 * المبدأ:
 * - الإيراد الحقيقي لكل طلب = final_amount - delivery_fee (ما أرسلته شركة التوصيل فعلاً).
 * - إيراد البنود الافتراضي = SUM(qty * unit_price) من order_items.
 * - الفرق (delta) = الإيراد الحقيقي - إيراد البنود = الزيادة (+) أو الخصم (-).
 * - توزيع الـ delta:
 *    • إذا كان منشئ الطلب لديه قاعدة ربح فعّالة → كامل الـ delta يُضاف لمستحقاته.
 *    • وإلا → يُضاف لإيراد/ربح مالكي المنتجات في الطلب بنسبة حصة كل منتج.
 * - التكلفة المفضّلة: products.cost_price (الأحدث) ثم product_variants.cost_price.
 * - أجور التوصيل مستثناة من جميع الحسابات.
 *
 * @param {Object} args
 * @param {Array} args.orders         صفوف orders {id, created_by, final_amount, total_amount, delivery_fee}
 * @param {Array} args.orderItems     صفوف order_items مع products + product_variants
 * @param {Array} args.profits        صفوف profits {order_id, employee_id, employee_profit}
 * @param {Set<string>} args.employeesWithRules  مجموعة employee_id لهم قاعدة ربح فعّالة
 */
export function computeInvoiceProfits({ orders = [], orderItems = [], profits = [], employeesWithRules = new Set() }) {
  const itemsByOrder = new Map();
  (orderItems || []).forEach((it) => {
    if (!itemsByOrder.has(it.order_id)) itemsByOrder.set(it.order_id, []);
    itemsByOrder.get(it.order_id).push(it);
  });

  const productMap = {}; // pid -> { id, name, ownerId, qty, revenue, cost }
  const byOwner = {};    // ownerId -> { revenue, cost, items, products: [] }
  const employeeBonusByEmp = {}; // delta-only bonus محسوب من الزيادة/الخصم
  const employeeProfitByEmp = {}; // من جدول profits

  let totalRevenue = 0;     // = Σ (final_amount - delivery_fee)
  let totalCost = 0;
  let totalQty = 0;
  let totalDelivery = 0;
  let totalDelta = 0;
  let revenueFromItemsAll = 0;

  const ensureOwner = (ownerId) => {
    if (!byOwner[ownerId]) byOwner[ownerId] = { revenue: 0, cost: 0, items: 0, products: [] };
    return byOwner[ownerId];
  };
  const ensureProduct = (it) => {
    const pid = it.product_id || '__unknown__';
    if (!productMap[pid]) {
      productMap[pid] = {
        id: pid,
        name: it.products?.name || 'منتج',
        ownerId: it.products?.owner_user_id || '__system__',
        qty: 0, revenue: 0, cost: 0,
      };
    }
    return productMap[pid];
  };

  (profits || []).forEach((p) => {
    const k = p.employee_id || '__unknown__';
    employeeProfitByEmp[k] = (employeeProfitByEmp[k] || 0) + (Number(p.employee_profit) || 0);
  });

  (orders || []).forEach((o) => {
    const deliveryFee = Number(o.delivery_fee) || 0;
    const realRevenue = (Number(o.final_amount) || Number(o.total_amount) || 0) - deliveryFee;
    totalDelivery += deliveryFee;
    totalRevenue += realRevenue;

    const items = itemsByOrder.get(o.id) || [];
    // إيراد البنود لهذا الطلب + per-owner items revenue
    let orderItemsRevenue = 0;
    const ownerRevenueInOrder = {}; // ownerId -> items revenue for this order
    const productLinesInOrder = []; // { pid, ownerId, revenue }

    items.forEach((it) => {
      const qty = Number(it.quantity) || 0;
      const unitPrice = Number(it.unit_price) || 0;
      const costUnit = Number(it.products?.cost_price) || Number(it.product_variants?.cost_price) || 0;
      const lineRevenue = qty * unitPrice;
      const lineCost = qty * costUnit;

      const prod = ensureProduct(it);
      prod.qty += qty;
      prod.revenue += lineRevenue;
      prod.cost += lineCost;
      totalQty += qty;
      totalCost += lineCost;

      orderItemsRevenue += lineRevenue;
      const ownerId = prod.ownerId;
      ownerRevenueInOrder[ownerId] = (ownerRevenueInOrder[ownerId] || 0) + lineRevenue;
      productLinesInOrder.push({ pid: prod.id, ownerId, revenue: lineRevenue });
    });
    revenueFromItemsAll += orderItemsRevenue;

    // التبديل/الاستبدال ليس خصماً ولا زيادة منتج — الفرق فيه = أجور توصيل فقط
    const isExchange = o.order_type === 'replacement' || o.order_type === 'exchange';
    const delta = isExchange ? 0 : (realRevenue - orderItemsRevenue);
    totalDelta += delta;
    if (Math.abs(delta) < 0.5) return;

    const creatorId = o.created_by || null;
    const creatorHasRule = creatorId && employeesWithRules.has(creatorId);

    if (creatorHasRule) {
      // كامل الـ delta لمستحقات الموظف منشئ الطلب
      employeeBonusByEmp[creatorId] = (employeeBonusByEmp[creatorId] || 0) + delta;
    } else if (orderItemsRevenue > 0) {
      // توزيع نسبي للـ delta على المالكين داخل هذا الطلب + توزيع على المنتجات
      productLinesInOrder.forEach((line) => {
        const share = line.revenue / orderItemsRevenue;
        const add = delta * share;
        // أضف للمنتج
        if (productMap[line.pid]) productMap[line.pid].revenue += add;
      });
    } else {
      // طلب بدون items: نسبه كاملة لـ "النظام"
      ensureOwner('__system__').revenue += delta;
    }
  });

  // بناء byOwner من productMap بعد توزيع delta
  Object.values(productMap).forEach((prod) => {
    const o = ensureOwner(prod.ownerId);
    o.revenue += prod.revenue;
    o.cost += prod.cost;
    o.items += prod.qty;
    o.products.push(prod);
  });

  const employeeBonusTotal = Object.values(employeeBonusByEmp).reduce((s, v) => s + v, 0);
  const employeeProfitTotal = Object.values(employeeProfitByEmp).reduce((s, v) => s + v, 0);
  const employeeTotalCombined = employeeProfitTotal + employeeBonusTotal;

  const totalProfit = totalRevenue - totalCost;
  const netForOwners = totalProfit - employeeTotalCombined;

  // ❗ employeeProfitByEmp مأخوذ من جدول profits المخزّن، وهو يتضمن أصلاً الزيادة/الخصم
  // (الترِجر يحسب: قاعدة + زيادة − خصم). لا نُضيف employeeBonusByEmp فوقه لتجنب الازدواج.
  // employeeBonusByEmp يبقى للإعلام فقط (سطر "يشمل ... من الزيادة/الخصم").
  const employeeCombinedByEmp = { ...employeeProfitByEmp };

  const productsList = Object.values(productMap).sort((a, b) => b.revenue - a.revenue);

  return {
    totalRevenue, totalCost, totalProfit, totalQty, totalDelivery, totalDelta,
    revenueFromItems: revenueFromItemsAll,
    employeeProfitByEmp, employeeBonusByEmp, employeeCombinedByEmp,
    employeeProfitTotal, employeeBonusTotal, employeeTotalCombined,
    netForOwners,
    byOwner,
    productsList, productCount: productsList.length,
    itemsAvailable: productsList.length > 0,
  };
}

/**
 * يجلب البيانات اللازمة لحساب أرباح مجموعة طلبات.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string[]} orderIds
 */
export async function fetchInvoiceProfitsData(supabase, orderIds) {
  if (!orderIds?.length) {
    return { orders: [], orderItems: [], profits: [], employeesWithRules: new Set(), namesMap: {} };
  }
  const [{ data: oData }, { data: itemsData }, { data: pData }] = await Promise.all([
    supabase.from('orders')
      .select('id, created_by, final_amount, total_amount, delivery_fee, order_type')
      .in('id', orderIds),
    supabase.from('order_items')
      .select(`
        order_id, product_id, variant_id, quantity, unit_price, total_price,
        products:product_id(id, name, owner_user_id, cost_price),
        product_variants:variant_id(id, cost_price)
      `)
      .in('order_id', orderIds),
    supabase.from('profits')
      .select('order_id, employee_id, employee_profit, profit_amount, total_revenue, total_cost, status')
      .in('order_id', orderIds),
  ]);

  const creatorIds = Array.from(new Set((oData || []).map((o) => o.created_by).filter(Boolean)));
  let employeesWithRules = new Set();
  if (creatorIds.length) {
    const { data: rules } = await supabase
      .from('employee_profit_rules')
      .select('employee_id')
      .in('employee_id', creatorIds)
      .eq('is_active', true);
    (rules || []).forEach((r) => employeesWithRules.add(r.employee_id));
  }

  const employeeIds = (pData || []).map((p) => p.employee_id).filter(Boolean);
  const ownerIds = (itemsData || []).map((i) => i.products?.owner_user_id).filter(Boolean);
  const allUserIds = Array.from(new Set([...employeeIds, ...ownerIds, ...creatorIds]));
  const namesMap = {};
  if (allUserIds.length) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', allUserIds);
    (profs || []).forEach((p) => { namesMap[p.user_id] = p.full_name; });
  }

  return { orders: oData || [], orderItems: itemsData || [], profits: pData || [], employeesWithRules, namesMap };
}
