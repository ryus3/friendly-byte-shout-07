/**
 * حاسبة أرباح الفاتورة الدقيقة (مصدر الحقيقة الموحد)
 *
 * المبادئ:
 * - الإيراد الحقيقي لكل طلب = final_amount - delivery_fee (ما أرسلته شركة التوصيل فعلاً).
 * - الكميات المباعة فعلياً فقط هي التي تدخل في الإحصاء:
 *    • للطلب العادي (regular/completed): كل الكميات.
 *    • للطلب الجزئي (partial_delivery): فقط quantity_delivered.
 *    • للطلب الراجع (return/returned): صفر.
 * - الإيراد الافتراضي للبنود = SUM(qty_eligible * unit_price).
 * - الفرق (delta) = الإيراد الحقيقي − الإيراد الافتراضي:
 *    • إذا كان منشئ الطلب لديه قاعدة ربح فعّالة → كامل الـ delta يُعرَض كزيادة/خصم للموظف
 *      (الفعلي يأتي من profits.employee_profit المخزَّن).
 *    • وإلا → يوزَّع نسبياً على إيراد المنتجات.
 * - التكلفة المفضّلة: products.cost_price ثم product_variants.cost_price، مضروبة بالكمية الفعلية فقط.
 * - أجور التوصيل مستثناة من جميع الحسابات.
 *
 * @param {Object} args
 * @param {Array} args.orders         صفوف orders {id, created_by, final_amount, total_amount, delivery_fee, order_type, status, delivery_status}
 * @param {Array} args.orderItems     صفوف order_items مع products + product_variants + quantity_delivered/quantity_returned/item_status
 * @param {Array} args.profits        صفوف profits {order_id, employee_id, employee_profit}
 * @param {Set<string>} args.employeesWithRules مجموعة employee_id لهم قاعدة ربح فعّالة
 */
export function computeInvoiceProfits({ orders = [], orderItems = [], profits = [], employeesWithRules = new Set() }) {
  const itemsByOrder = new Map();
  (orderItems || []).forEach((it) => {
    if (!itemsByOrder.has(it.order_id)) itemsByOrder.set(it.order_id, []);
    itemsByOrder.get(it.order_id).push(it);
  });

  const productMap = {}; // pid -> { id, name, ownerId, qty, revenue, cost }
  const byOwner = {};    // ownerId -> { revenue, cost, items, products: [] }
  const employeeBonusByEmp = {}; // delta للعرض فقط
  const employeeProfitByEmp = {}; // من جدول profits (المصدر الفعلي)

  let totalRevenue = 0;     // = Σ (final_amount - delivery_fee) للطلبات غير الراجعة
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

  // الكمية الفعلية المباعة لكل بند حسب نوع الطلب
  const eligibleQtyOf = (order, it) => {
    const orderType = order?.order_type || 'regular';
    const orderStatus = order?.status || '';
    if (orderType === 'return' || orderStatus === 'returned') return 0;
    if (orderType === 'partial_delivery') {
      const qd = Number(it.quantity_delivered) || 0;
      if (qd > 0) return qd;
      if (it.item_status === 'delivered') return Number(it.quantity) || 0;
      return 0;
    }
    return Number(it.quantity) || 0;
  };

  (orders || []).forEach((o) => {
    const deliveryFee = Number(o.delivery_fee) || 0;
    totalDelivery += deliveryFee;

    const isReturn = (o.order_type === 'return') || (o.status === 'returned');
    if (isReturn) return;

    // ✅ المصدر الموحّد للإيراد الحقيقي:
    // 1) مبلغ شركة التوصيل لهذا الطلب (invoice_order_amount) إن وُجد
    // 2) وإلا final_amount المسجَّل بالنظام
    // ثم نطرح أجور التوصيل للحصول على إيراد المنتجات الصافي
    const invoiceOrderAmount = Number(o.invoice_order_amount) || 0;
    const baseAmount = invoiceOrderAmount > 0
      ? invoiceOrderAmount
      : (Number(o.final_amount) || Number(o.total_amount) || 0);
    const realRevenue = baseAmount - deliveryFee;
    totalRevenue += realRevenue;

    const items = itemsByOrder.get(o.id) || [];

    // الخطوة الأولى: حساب الإيراد الافتراضي والكميات المؤهلة لكل بند
    const baseLines = items
      .filter((it) => it.item_direction !== 'incoming')
      .map((it) => {
        const eligibleQty = eligibleQtyOf(o, it);
        const unitPrice = Number(it.unit_price) || 0;
        const costUnit = Number(it.products?.cost_price) || Number(it.product_variants?.cost_price) || 0;
        return { it, eligibleQty, unitPrice, costUnit };
      });

    let plannedRevenue = baseLines.reduce((s, l) => s + l.eligibleQty * l.unitPrice, 0);

    // إذا كان الطلب جزئياً ولم نستطع تحديد الكميات المسلَّمة من البنود،
    // نشتقّ نسبة التسليم من النسبة بين الإيراد الحقيقي وإيراد البنود الأصلية
    const isPartialMissingData = (o.order_type === 'partial_delivery') && plannedRevenue === 0;
    let derivedLines = baseLines;
    if (isPartialMissingData) {
      const incomingFiltered = items.filter((it) => it.item_direction !== 'incoming');
      const originalTotalQty = incomingFiltered.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
      const originalRevenue = incomingFiltered.reduce(
        (s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0
      );
      const fraction = originalRevenue > 0 ? Math.min(1, Math.max(0, realRevenue / originalRevenue)) : 0;
      // العدد الكلي للقطع المسلَّمة فعلياً (مقرّب)
      let remaining = Math.round(originalTotalQty * fraction);
      // نوزّع الكميات من البنود الأعلى سعراً أولاً للحفاظ على توازن الإيراد
      const ordered = [...incomingFiltered].sort((a, b) =>
        (Number(b.unit_price) || 0) - (Number(a.unit_price) || 0)
      );
      const qtyByItem = new Map();
      ordered.forEach((it) => {
        const cap = Number(it.quantity) || 0;
        const take = Math.min(cap, Math.max(0, remaining));
        qtyByItem.set(it, take);
        remaining -= take;
      });
      derivedLines = incomingFiltered.map((it) => {
        const unitPrice = Number(it.unit_price) || 0;
        const costUnit = Number(it.products?.cost_price) || Number(it.product_variants?.cost_price) || 0;
        return { it, eligibleQty: qtyByItem.get(it) || 0, unitPrice, costUnit };
      });
      plannedRevenue = derivedLines.reduce((s, l) => s + l.eligibleQty * l.unitPrice, 0);
    }

    let orderItemsRevenue = 0;
    const productLinesInOrder = [];

    derivedLines.forEach(({ it, eligibleQty, unitPrice, costUnit }) => {
      if (eligibleQty <= 0) return;
      const lineRevenue = eligibleQty * unitPrice;
      const lineCost = eligibleQty * costUnit;
      const prod = ensureProduct(it);
      prod.qty += eligibleQty;
      prod.revenue += lineRevenue;
      prod.cost += lineCost;
      totalQty += eligibleQty;
      totalCost += lineCost;
      orderItemsRevenue += lineRevenue;
      productLinesInOrder.push({ pid: prod.id, ownerId: prod.ownerId, revenue: lineRevenue });
    });
    revenueFromItemsAll += orderItemsRevenue;

    const isExchange = o.order_type === 'replacement' || o.order_type === 'exchange';
    const delta = isExchange ? 0 : (realRevenue - orderItemsRevenue);
    totalDelta += delta;
    if (Math.abs(delta) < 0.5) return;

    const creatorId = o.created_by || null;
    const creatorHasRule = creatorId && employeesWithRules.has(creatorId);

    if (creatorHasRule) {
      employeeBonusByEmp[creatorId] = (employeeBonusByEmp[creatorId] || 0) + delta;
    } else if (orderItemsRevenue > 0) {
      productLinesInOrder.forEach((line) => {
        const share = line.revenue / orderItemsRevenue;
        const add = delta * share;
        if (productMap[line.pid]) productMap[line.pid].revenue += add;
      });
    } else {
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
  const employeeTotalCombined = employeeProfitTotal;
  const employeeCombinedByEmp = { ...employeeProfitByEmp };

  const totalProfit = totalRevenue - totalCost;
  const netForOwners = totalProfit - employeeTotalCombined;

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
      .select('id, created_by, final_amount, total_amount, delivery_fee, order_type, status, delivery_status')
      .in('id', orderIds),
    supabase.from('order_items')
      .select(`
        order_id, product_id, variant_id, quantity, quantity_delivered, quantity_returned,
        item_status, item_direction, unit_price, total_price,
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
