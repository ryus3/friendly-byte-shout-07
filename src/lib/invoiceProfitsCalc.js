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
  // ✅ Off-Channel: طلبات مبلغها من شركة التوصيل = 0 لكنها مُسلَّمة فعلاً
  // (دفع إلكتروني/تحويل مباشر للموظف أو المالك يتحمل التوصيل).
  // ليست راجعة! تُحسب القطع والتكلفة والربح بشكل طبيعي، والتوصيل يُسجَّل كتحمّل.
  let offChannelCount = 0;
  let offChannelAbsorbedDelivery = 0;
  let offChannelExpectedAmount = 0; // الإيراد "المُستحَق" off-channel (ما قبضه الموظف/المالك خارج القناة)
  const offChannelOrders = [];
  // إيراد القناة الحقيقي (مبلغ شركة التوصيل بدون أجور توصيل، بدون off-channel)
  let channelRevenue = 0;
  // قائمة الطلبات ذات الزيادة/الخصم من شركة التوصيل (للعرض)
  const deltaOrders = []; // { order_id, created_by, delta, real_revenue, planned_revenue }

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
  // للطلب الراجع كلياً → سالبة (تخصم من الإيراد/التكلفة/العدد)
  const eligibleQtyOf = (order, it, isFullReturn) => {
    if (isFullReturn) return -(Number(it.quantity) || 0);
    const orderType = order?.order_type || 'regular';
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

    // ✅ المصدر الموحّد للإيراد الحقيقي = مبلغ شركة التوصيل لهذا الطلب
    // invoice_order_amount يأتي من delivery_invoice_orders.amount (يقبل صفر/سالب).
    const hasInvoiceAmount = (o.invoice_order_amount !== null && o.invoice_order_amount !== undefined);
    const baseAmount = hasInvoiceAmount
      ? (Number(o.invoice_order_amount) || 0)
      : (Number(o.final_amount) || Number(o.total_amount) || 0);

    const items = itemsByOrder.get(o.id) || [];

    // ============================================================
    // تصنيف الطلب (المعيار العالمي — لا نستخدم المبلغ كدليل على الإرجاع أبداً)
    //   الإرجاع الحقيقي يُعرف من الحالة فقط:
    //   - order_type === 'return'
    //   - delivery_status === '17' (راجع للتاجر — الوسيط)
    //   - status === 'returned'  (مع بنود راجعة فعلاً)
    //   - كل البنود quantity_returned == quantity
    // ============================================================
    const isReturnType = (o.order_type === 'return');
    const isStatusReturned = (o.status === 'returned');
    const isDeliveryReturned = (String(o.delivery_status || '') === '17');
    const allItemsReturned = items.length > 0 && items.every((it) => {
      const q = Number(it.quantity) || 0;
      const qr = Number(it.quantity_returned) || 0;
      const qd = Number(it.quantity_delivered) || 0;
      return q > 0 && qr >= q && qd === 0;
    });
    const isFullReturn = isReturnType || isDeliveryReturned || (isStatusReturned && allItemsReturned) || allItemsReturned;

    // Off-Channel: مبلغ شركة التوصيل = 0 لكن الطلب غير راجع وغير جزئي
    //   (دفع إلكتروني / المالك يتحمل التوصيل) — يُعامل كبيع طبيعي محاسبياً.
    const isPartial = (o.order_type === 'partial_delivery') || (isStatusReturned && baseAmount > 0 && !allItemsReturned);
    const isOffChannel = hasInvoiceAmount && Number(baseAmount) === 0 && !isFullReturn && !isPartial;

    // الإيراد الحقيقي للقناة (ما دفعته شركة التوصيل فعلاً، يخصم منه التوصيل)
    const realRevenue = baseAmount - deliveryFee;
    // محاسبياً: للـ off-channel نعتمد الإيراد المُخطَّط (Σ price × qty) لأن المالك/الموظف
    // قبض المبلغ خارج القناة. للحالات الأخرى نستخدم realRevenue.
    // (سنحسب accountedRevenue بعد بناء plannedRevenue أدناه.)
    if (!isOffChannel) {
      totalRevenue += realRevenue;
      if (!isFullReturn) channelRevenue += realRevenue;
    }
    if (isOffChannel) {
      offChannelCount += 1;
      offChannelAbsorbedDelivery += deliveryFee;
    }

    // البنود المعتبرة: للطلب الراجع كلياً نستخدم بنود incoming (تمثّل ما عاد)؛
    // لباقي الطلبات نستثني incoming لأنها مدخلات استبدال.
    const lineItems = isFullReturn ? items : items.filter((it) => it.item_direction !== 'incoming');

    const baseLines = lineItems.map((it) => {
      const eligibleQty = eligibleQtyOf(o, it, isFullReturn);
      const unitPrice = Number(it.unit_price) || 0;
      const costUnit = Number(it.products?.cost_price) || Number(it.product_variants?.cost_price) || 0;
      return { it, eligibleQty, unitPrice, costUnit };
    });

    let plannedRevenue = baseLines.reduce((s, l) => s + l.eligibleQty * l.unitPrice, 0);

    // طلب جزئي بدون بيانات quantity_delivered → نشتقّ النسبة من الإيراد الحقيقي
    const isPartialMissingData = isPartial && plannedRevenue === 0 && realRevenue > 0;
    let derivedLines = baseLines;
    if (isPartialMissingData) {
      const originalTotalQty = lineItems.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
      const originalRevenue = lineItems.reduce(
        (s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0
      );
      const fraction = originalRevenue > 0 ? Math.min(1, Math.max(0, realRevenue / originalRevenue)) : 0;
      let remaining = Math.round(originalTotalQty * fraction);
      const ordered = [...lineItems].sort((a, b) =>
        (Number(b.unit_price) || 0) - (Number(a.unit_price) || 0)
      );
      const qtyByItem = new Map();
      ordered.forEach((it) => {
        const cap = Number(it.quantity) || 0;
        const take = Math.min(cap, Math.max(0, remaining));
        qtyByItem.set(it, take);
        remaining -= take;
      });
      derivedLines = lineItems.map((it) => {
        const unitPrice = Number(it.unit_price) || 0;
        const costUnit = Number(it.products?.cost_price) || Number(it.product_variants?.cost_price) || 0;
        return { it, eligibleQty: qtyByItem.get(it) || 0, unitPrice, costUnit };
      });
      plannedRevenue = derivedLines.reduce((s, l) => s + l.eligibleQty * l.unitPrice, 0);
    }

    let orderItemsRevenue = 0;
    const productLinesInOrder = [];

    derivedLines.forEach(({ it, eligibleQty, unitPrice, costUnit }) => {
      if (eligibleQty === 0) return;
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

    // ============================================================
    // Off-Channel: المبلغ من القناة = 0 لكن الطلب مُسلَّم
    //   - الإيراد المحاسبي = plannedRevenue (Σ price × qty الفعلية المُسلَّمة)
    //   - delta = 0 (لا زيادة/خصم — المبلغ غير عابر للقناة)
    //   - تُسجَّل القيمة المتوقّعة off-channel للعرض/التسوية مع الموظف لاحقاً
    //   - لا يدخل إيراد القناة (totalRevenue غير متأثر)
    // ============================================================
    if (isOffChannel) {
      offChannelExpectedAmount += orderItemsRevenue;
      offChannelOrders.push({
        order_id: o.id,
        created_by: o.created_by || null,
        expected_amount: orderItemsRevenue, // المبلغ المتوقَّع تحصيله off-channel
        delivery_fee_absorbed: deliveryFee,
        items: orderItemsRevenue,
      });
      // محاسبياً نضيف plannedRevenue للإيراد الكلي حتى يطابق التكلفة والربح يصبح حقيقياً
      totalRevenue += orderItemsRevenue;
      return; // لا delta ولا توزيع زيادة/خصم
    }

    const isExchange = o.order_type === 'replacement' || o.order_type === 'exchange';
    const delta = isExchange ? 0 : (realRevenue - orderItemsRevenue);
    totalDelta += delta;
    if (Math.abs(delta) < 0.5) return;

    const creatorId = o.created_by || null;
    const creatorHasRule = creatorId && employeesWithRules.has(creatorId);

    if (creatorHasRule) {
      employeeBonusByEmp[creatorId] = (employeeBonusByEmp[creatorId] || 0) + delta;
    } else if (Math.abs(orderItemsRevenue) > 0.5) {
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
    // ✅ Off-Channel (تحصيلات خارج قناة شركة التوصيل)
    offChannelCount,
    offChannelAbsorbedDelivery,
    offChannelExpectedAmount,
    offChannelOrders,
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
