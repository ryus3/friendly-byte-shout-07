import { useMemo } from 'react';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useInventory } from '@/contexts/InventoryContext';
import { useProfits } from '@/contexts/ProfitsContext';

const MAIN_MANAGER_ID = '91484496-b887-44f7-9e5d-be9db5567604';

/**
 * Unified manager-profits calculation.
 * Used by both ManagerProfitsCard and ManagerProfitsDialog to guarantee identical numbers.
 *
 * Per-order computation (only items owned by `ownerId`):
 *   ownedRevenue = (final_amount - delivery_fee) * (ownedItemsRevenue / allItemsRevenue)
 *   ownedCost    = Σ cost_price * qty (owned items)
 *   employeeProfit = profit.employee_profit  (already real, excludes delivery)
 *   ownerProfit  = ownedRevenue - ownedCost - employeeProfit
 *
 * Paid dues come from settlement_invoices.total_amount filtered by owner_user_id.
 */
export function useManagerProfitsCalc({ timePeriod = 'all', dateRange = null } = {}) {
  const { user } = useAuth();
  const { orders = [], products = [] } = useInventory();
  const { profits = [], settlementInvoices = [] } = useProfits();

  const ownerId = user?.user_id || user?.id;

  // Map product_id -> owner_user_id (fallback when order_items lacks owner_user_id)
  const productOwnerMap = useMemo(() => {
    const m = new Map();
    (products || []).forEach(p => m.set(p.id, p.owner_user_id || null));
    return m;
  }, [products]);

  const inPeriod = (iso) => {
    if (!iso) return false;
    if (dateRange?.start && dateRange?.end) {
      const d = new Date(iso);
      return d >= dateRange.start && d <= dateRange.end;
    }
    if (!timePeriod || timePeriod === 'all') return true;
    const d = new Date(iso);
    const now = new Date();
    switch (timePeriod) {
      case 'today': return d.toDateString() === now.toDateString();
      case 'week': return d >= new Date(now.getTime() - 7 * 86400000);
      case 'month': return d >= new Date(now.getTime() - 30 * 86400000);
      case '3months': return d >= new Date(now.getTime() - 90 * 86400000);
      case 'year': return d.getFullYear() === now.getFullYear();
      default: return true;
    }
  };

  const ordersById = useMemo(() => {
    const m = new Map();
    (orders || []).forEach(o => m.set(o.id, o));
    return m;
  }, [orders]);

  const computed = useMemo(() => {
    if (!ownerId) return { rows: [], total: 0, pending: 0, paidDues: 0, margin: 0, totalOwnedRevenue: 0, totalEmployeeProfit: 0 };

    const rows = [];
    for (const p of profits) {
      if (!p || !p.order_id) continue;
      const order = ordersById.get(p.order_id);
      if (!order) continue;
      if (order.created_by === MAIN_MANAGER_ID) continue; // skip admin's own orders
      if (!inPeriod(p.created_at || order.created_at)) continue;

      const items = order.items || order.order_items || [];
      if (items.length === 0) continue;

      const itemRev = (it) => Number(it.total_price ?? ((it.unit_price ?? it.price ?? 0) * (it.quantity || 0))) || 0;
      const itemCost = (it) => (Number(it.cost_price ?? it.products?.cost_price ?? it.product_variants?.cost_price ?? 0) || 0) * (it.quantity || 0);
      const itemOwner = (it) => it.owner_user_id || it.products?.owner_user_id || productOwnerMap.get(it.product_id) || null;
      const isOwned = (it) => itemOwner(it) === ownerId;

      const ownedItems = items.filter(isOwned);
      if (ownedItems.length === 0) continue;

      const allRev = items.reduce((s, it) => s + itemRev(it), 0);
      const ownedRev = ownedItems.reduce((s, it) => s + itemRev(it), 0);
      const ownedCost = ownedItems.reduce((s, it) => s + itemCost(it), 0);
      const finalAmt = Number(order.final_amount || order.total_amount || 0);
      const delivery = Number(order.delivery_fee || 0);
      const ratio = allRev > 0 ? ownedRev / allRev : 0;
      const ownedRevenue = (finalAmt - delivery) * ratio;

      // Employee profit attributable to owned portion only
      const empProfit = Number(p.employee_profit || 0) * ratio;
      const ownerProfit = ownedRevenue - ownedCost - empProfit;

      rows.push({
        profitId: p.id,
        orderId: p.order_id,
        order,
        employeeId: p.employee_id,
        createdAt: p.created_at || order.created_at,
        status: p.status,
        ownedRevenue,
        ownedCost,
        employeeProfit: empProfit,
        ownerProfit,
        deliveryStatus: order.delivery_status,
      });
    }

    const total = rows.reduce((s, r) => s + r.ownerProfit, 0);
    const pending = rows.filter(r => r.status !== 'settled' && r.deliveryStatus !== '4')
      .reduce((s, r) => s + r.ownerProfit, 0);
    const totalOwnedRevenue = rows.reduce((s, r) => s + r.ownedRevenue, 0);
    const totalEmployeeProfit = rows.reduce((s, r) => s + r.employeeProfit, 0);

    // Paid dues: settlement_invoices.total_amount where owner_user_id == me, within period (by created_at)
    const paidDues = (settlementInvoices || [])
      .filter(inv => inv.owner_user_id === ownerId)
      .filter(inv => inPeriod(inv.created_at || inv.settlement_date))
      .reduce((s, inv) => s + Number(inv.total_amount || 0), 0);

    const margin = totalOwnedRevenue > 0 ? (total / totalOwnedRevenue) * 100 : 0;

    return { rows, total, pending, paidDues, margin, totalOwnedRevenue, totalEmployeeProfit };
  }, [profits, ordersById, productOwnerMap, ownerId, timePeriod, dateRange, settlementInvoices]);

  return computed;
}

export default useManagerProfitsCalc;
