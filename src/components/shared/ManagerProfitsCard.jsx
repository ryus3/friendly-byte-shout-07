import React, { useState } from 'react';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useInventory } from '@/contexts/InventoryContext';
import { useProfits } from '@/contexts/ProfitsContext';
import StatCard from '@/components/dashboard/StatCard';
import ManagerProfitsDialog from '@/components/profits/ManagerProfitsDialog';
import { useManagerProfitsCalc } from '@/hooks/useManagerProfitsCalc';
import { Users } from 'lucide-react';

/**
 * كرت "أرباحي من الموظفين" — يستخدم نفس الحساب الموحّد للنافذة بالضبط.
 */
const ManagerProfitsCard = ({
  className = '',
  orders = [],
  allUsers = [],
  calculateProfit,
  profits = [],
  timePeriod = 'all',
}) => {
  const { user } = useAuth();
  const { orders: ctxOrders } = useInventory();
  const { profits: ctxProfits } = useProfits();
  const [open, setOpen] = useState(false);

  const finalOrders = orders.length > 0 ? orders : (ctxOrders || []);
  const finalProfits = profits.length > 0 ? profits : (ctxProfits || []);

  // ✅ المصدر الموحد للحساب — مطابق تماماً للنافذة
  const { total } = useManagerProfitsCalc({ timePeriod });

  return (
    <>
      <StatCard
        title="أرباحي من الموظفين"
        value={Math.round(total)}
        icon={Users}
        colors={total < 0 ? ['red-500', 'orange-500'] : ['green-500', 'emerald-500']}
        format="currency"
        onClick={() => setOpen(true)}
        className={className}
      />

      <ManagerProfitsDialog
        isOpen={open}
        onClose={() => setOpen(false)}
        orders={finalOrders}
        employees={allUsers || []}
        calculateProfit={calculateProfit}
        profits={finalProfits}
        managerId={user?.id}
        timePeriod={timePeriod}
      />
    </>
  );
};

export default ManagerProfitsCard;
