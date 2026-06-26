/**
 * حاسبة أرباح الفاتورة الدقيقة (مصدر الحقيقة الموحد)
 *
 * المبادئ:
 * - الإيراد الحقيقي لكل طلب = مبلغ الفاتورة المرتبط بالطلب - delivery_fee (لأغراض ربح المنتجات).
 * - الكميات المباعة فعلياً فقط هي التي تدخل في الإحصاء:
 *    • للطلب العادي (regular/completed): كل الكميات.
 *    • للطلب الجزئي (partial_delivery): فقط quantity_delivered.
 *    • للطلب الراجع (order_type='return'): صفر — لا يُحسب كمنتج مباع.
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
 * @param {Array} args.offChannelCollections صفوف off_channel_collections المسجلة لهذه الفاتورة
 * @param {Set<string>} args.employeesWithRules مجموعة employee_id لهم قاعدة ربح فعّالة
 */
export function computeInvoiceProfits({ orders = [], orderItems = [], profits = [], employeesWithRules = new Set(), offChannelCollections = [], invoiceAmount = null }) {
  const itemsByOrder = new Map();
  (orderItems || []).forEach((it) => {
    if (!itemsByOrder.has(it.order_id)) itemsByOrder.set(it.order_id, []);
    itemsByOrder.get(it.order_id).push(it);
  });

  const productMap = {}; // pid -> { id, name, ownerId, qty, revenue, cost }
  const byOwner = {};    // ownerId -> { revenue, cost, items, products: [] }
  const employeeBonusByEmp = {}; // مجموع delta (موجب وسالب) للموظفين أصحاب القواعد — للعرض
  const employeePositiveDeltaByEmp = {}; // مجموع الزيادات الموجبة فقط (لأن DB لا يطبّق الـ delta السالب)
  const employeeProfitByEmp = {}; // من جدول profits (المصدر الفعلي المخزّن)
  const offChannelByOrder = new Map();

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
  // مجموع الخصومات السالبة من شركة التوصيل (قيمة موجبة — للعرض "قبل الخصم")
  let negativeDeltaAbs = 0;
  // قائمة الطلبات ذات الزيادة/الخصم من شركة التوصيل (للعرض)
  const deltaOrders = []; // { order_id, created_by, delta, real_revenue, planned_revenue }
  // ✅ قائمة طلبات الإرجاع داخل هذه الفاتورة (لعرضها كقسم مستقل، لا تُعتبر "خصم")
  const returnsOrders = []; // { order_id, created_by, real_revenue, planned_revenue, delivery_fee }
  let returnsTotalLoss = 0; // مجموع خسارة الإرجاع (مبلغ الوسيط السالب) — للعرض فقط
  // ✅ خسارة الإرجاع موزّعة على المالكين (تُخصم من إيراد المالك في byOwner)
  const ownerReturnLoss = {}; // ownerId -> سالب (مثلاً -25000)

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

  (offChannelCollections || []).forEach((row) => {
    if (row?.order_id) offChannelByOrder.set(row.order_id, row);
  });

  // الكمية الفعلية المباعة لكل بند حسب نوع الطلب
  // للطلب الراجع كلياً → صفر، لأنه ليس بيعاً ولا يدخل ضمن عدد المنتجات المباعة
  const eligibleQtyOf = (order, it, isFullReturn) => {
    if (isFullReturn) return 0;
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
    // تصنيف الطلب (قاعدة صارمة): الإرجاع يُعرف من نوع الطلب فقط.
    // لا نعتمد delivery_status/status أبداً حتى لا تتحول حالة وسيط مثل 16 إلى إرجاع بالخطأ.
    // ============================================================
    const orderType = o.order_type || 'regular';
    const isFullReturn = orderType === 'return';

    // Off-Channel: مبلغ شركة التوصيل = 0 لكن الطلب غير راجع وغير جزئي
    //   (دفع إلكتروني / المالك يتحمل التوصيل) — يُعامل كبيع طبيعي محاسبياً.
    const isPartial = orderType === 'partial_delivery';
    const isOffChannel = hasInvoiceAmount && Number(baseAmount) === 0 && !isFullReturn && !isPartial;

    // ✅ هل تأكَّد المالك استلام مبلغ الـ off-channel؟
    // إذا لا: لا نُدخل قطعه/إيراده/تكلفته ضمن "توزيع الأرباح على المالكين".
    const occRecord = isOffChannel ? offChannelByOrder.get(o.id) : null;
    const isOffChannelConfirmed = !!(occRecord && (
      occRecord.cash_movement_id ||
      ['settled', 'confirmed', 'owner_confirmed'].includes(occRecord.status)
    ));
    const isOffChannelPending = isOffChannel && !isOffChannelConfirmed;

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
    const returnProductValue = isFullReturn
      ? Math.abs(lineItems.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0))
      : 0;

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
      orderItemsRevenue += lineRevenue;
      // ✅ off-channel غير المؤكَّد: لا نُضيفه لإحصاءات المالك/التكلفة/القطع
      //    حتى يضغط المالك "استلمت" فيتحوّل لـ confirmed.
      if (isOffChannelPending) return;
      const prod = ensureProduct(it);
      prod.qty += eligibleQty;
      prod.revenue += lineRevenue;
      prod.cost += lineCost;
      totalQty += eligibleQty;
      totalCost += lineCost;
      productLinesInOrder.push({ pid: prod.id, ownerId: prod.ownerId, revenue: lineRevenue });
    });
    if (!isOffChannelPending) revenueFromItemsAll += orderItemsRevenue;

    // ============================================================
    // Off-Channel: المبلغ من القناة = 0 لكن الطلب مُسلَّم
    //   - المؤكَّد: يدخل ضمن إيراد/قطع/ربح المالك كبيع طبيعي.
    //   - المعلَّق: يُعرض فقط في بطاقة "تحصيلات خارج القناة"، ولا يدخل
    //     لا في `totalRevenue` ولا في `byOwner` حتى يؤكّد المالك الاستلام.
    // ============================================================
    if (isOffChannel) {
      const record = offChannelByOrder.get(o.id);
      const registeredPaid = Number(record?.customer_paid_amount) || 0;
      const expectedPaid = registeredPaid > 0 ? registeredPaid : (orderItemsRevenue + deliveryFee);

      offChannelExpectedAmount += expectedPaid;
      offChannelOrders.push({
        order_id: o.id,
        created_by: o.created_by || null,
        expected_amount: expectedPaid,
        product_amount: orderItemsRevenue,
        delivery_fee_absorbed: deliveryFee,
        collection_type: record?.collection_type || null,
        collection_status: record?.status || 'pending_classification',
        owner_due_amount: Number(record?.owner_due_amount) || 0,
        items: orderItemsRevenue,
        confirmed: isOffChannelConfirmed,
      });
      if (isOffChannelConfirmed) {
        // محاسبياً نضيف plannedRevenue للإيراد الكلي حتى يطابق التكلفة والربح يصبح حقيقياً
        totalRevenue += orderItemsRevenue;
      }
      return; // لا delta ولا توزيع زيادة/خصم
    }

    // ============================================================
    // طلبات الإرجاع: تُعرض في قسم مستقل، وتُخصم من إيراد المالك
    // ============================================================
    if (isFullReturn) {
      returnsOrders.push({
        order_id: o.id,
        created_by: o.created_by || null,
        real_revenue: realRevenue,         // عادةً سالب (مثلاً -25,000)
        planned_revenue: -returnProductValue, // قيمة المنتج المرجعة للزبون (مثلاً -20,000)
        delivery_fee: deliveryFee,
      });
      returnsTotalLoss += realRevenue; // مجموع الخسارة الحقيقية من القناة

      // ✅ توزيع خسارة الإرجاع (realRevenue السالب، يشمل التوصيل) على المالكين
      //    بحسب نسبة قيمة منتجاتهم المرجعة. هكذا يظهر "صافي ربح المالك" مطابقاً
      //    لـ "صافي للمالكين" في الكروت العلوية.
      const returnOwnerSums = new Map();
      let returnOwnerTotal = 0;
      lineItems.forEach((it) => {
        const ownerId = it.products?.owner_user_id || '__system__';
        const value = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
        if (value <= 0) return;
        returnOwnerSums.set(ownerId, (returnOwnerSums.get(ownerId) || 0) + value);
        returnOwnerTotal += value;
      });
      if (returnOwnerTotal > 0) {
        returnOwnerSums.forEach((value, ownerId) => {
          const share = value / returnOwnerTotal;
          ownerReturnLoss[ownerId] = (ownerReturnLoss[ownerId] || 0) + realRevenue * share;
        });
      } else {
        ownerReturnLoss['__system__'] = (ownerReturnLoss['__system__'] || 0) + realRevenue;
      }
      return; // لا delta للإرجاع
    }


    const isExchange = o.order_type === 'replacement' || o.order_type === 'exchange';
    const delta = isExchange ? 0 : (realRevenue - orderItemsRevenue);
    totalDelta += delta;
    if (Math.abs(delta) >= 0.5) {
      deltaOrders.push({
        order_id: o.id,
        created_by: o.created_by || null,
        delta,
        real_revenue: realRevenue,
        planned_revenue: orderItemsRevenue,
      });
    }
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

  // ✅ خصم خسارة الإرجاع من إيراد المالك (لينعكس مباشرة على ربحه الصافي)
  Object.entries(ownerReturnLoss).forEach(([ownerId, loss]) => {
    ensureOwner(ownerId).revenue += loss; // loss سالب
  });

  // ✅ مصدر الحقيقة لإيراد القناة = delivery_invoices.amount (المبلغ الذي دفعته شركة التوصيل فعلاً).
  //    يشمل أصلاً خصم الإرجاع وخصم أجور توصيل طلبات الـ off-channel.
  //    نضيف فوقه فقط الـ off-channel المؤكَّد من المالك.
  if (invoiceAmount !== null && invoiceAmount !== undefined) {
    const confirmedOffChannel = offChannelOrders
      .filter((o) => o.confirmed)
      .reduce((s, o) => s + (Number(o.expected_amount) || 0), 0);
    totalRevenue = Number(invoiceAmount) + confirmedOffChannel;
    channelRevenue = Number(invoiceAmount);
  }

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
    // ✅ إيراد القناة (شركة التوصيل) بدون أجور توصيل وبدون off-channel
    channelRevenue,
    // ✅ صافي إيراد القناة = إيراد القناة − الخصم/الزيادة من الوسيط
    //    (channelRevenue يساوي الـ planned للقناة فعلاً + delta لأن realRevenue = planned + delta،
    //     لذلك صافي إيراد القناة بمعنى "ما وصلنا فعلاً من الوسيط بدون توصيل" = channelRevenue نفسه.
    //     نعرضه باسم netChannelRevenue للوضوح في الواجهة.)
    netChannelRevenue: channelRevenue,
    // ✅ Off-Channel (تحصيلات خارج قناة شركة التوصيل)
    offChannelCount,
    offChannelAbsorbedDelivery,
    offChannelExpectedAmount,
    offChannelOrders,
    // ✅ قائمة طلبات الزيادة/الخصم من الوسيط
    deltaOrders,
    // ✅ قائمة الإرجاعات في هذه الفاتورة (قسم مستقل)
    returnsOrders,
    returnsCount: returnsOrders.length,
    returnsTotalLoss,
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
  const [{ data: oData }, { data: itemsData }, { data: pData }, { data: occData }] = await Promise.all([
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
    supabase.from('off_channel_collections')
      .select('*')
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

  return { orders: oData || [], orderItems: itemsData || [], profits: pData || [], offChannelCollections: occData || [], employeesWithRules, namesMap };
}
