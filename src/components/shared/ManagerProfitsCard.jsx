import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useInventory } from '@/contexts/InventoryContext';
import { useProfits } from '@/contexts/ProfitsContext';
import StatCard from '@/components/dashboard/StatCard';
import ManagerProfitsDialog from '@/components/profits/ManagerProfitsDialog';
import { Users } from 'lucide-react';

/**
 * مكون مشترك لكارت "أرباحي من الموظفين" مع النافذة
 * يستخدم نفس المنطق والحسابات في كلا الصفحتين
 */
const ManagerProfitsCard = ({ 
  className = '',
  orders = [],
  allUsers = [],
  calculateProfit,
  profits = [],
  timePeriod = 'all'
}) => {
  const { user } = useAuth();
  const { orders: contextOrders, calculateProfit: contextCalculateProfit } = useInventory();
  const { profits: contextProfits } = useProfits();
  const [isManagerProfitsDialogOpen, setIsManagerProfitsDialogOpen] = useState(false);

  // استخدام البيانات من المعاملات أو من الـ context
  const finalOrders = orders.length > 0 ? orders : contextOrders || [];
  const finalProfits = profits.length > 0 ? profits : contextProfits || [];
  const finalCalculateProfit = calculateProfit || contextCalculateProfit;

  // فلتر الفترة الزمنية
  const filterByTimePeriod = (order) => {
    if (timePeriod === 'all') return true;
    
    const orderDate = new Date(order.created_at);
    const now = new Date();
    
    switch (timePeriod) {
      case 'today':
        return orderDate.toDateString() === now.toDateString();
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return orderDate >= weekAgo;
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return orderDate >= monthAgo;
      case '3months':
        const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        return orderDate >= threeMonthsAgo;
      default:
        return true;
    }
  };

  // حساب أرباح المدير المعلقة - من جدول الأرباح فقط (بعد التوحيد)
  const managerProfitFromEmployees = useMemo(() => {
    if (!finalProfits || !Array.isArray(finalProfits)) {
      return 0;
    }

    console.log('🔍 ManagerProfitsCard: حساب أرباح المدير من جدول الأرباح:', {
      totalProfits: finalProfits.length,
      timePeriod
    });

    // فلتر الأرباح حسب الفترة الزمنية والحالة
    const relevantProfits = finalProfits.filter(profit => {
      if (!profit) return false;
      
      // فقط الأرباح المعلقة أو المستلمة الفواتير (غير المسوّاة)
      const isPendingOrInvoiceReceived = profit.status === 'pending' || profit.status === 'invoice_received';
      if (!isPendingOrInvoiceReceived) return false;

      // استبعاد أرباح المدير الرئيسي (الذي له employee_percentage = 0)
      if (profit.employee_percentage === 0) return false;

      // فلتر الفترة الزمنية بناءً على created_at للربح
      if (timePeriod && timePeriod !== 'all') {
        const profitDate = new Date(profit.created_at);
        const now = new Date();
        
        switch (timePeriod) {
          case 'today':
            if (profitDate.toDateString() !== now.toDateString()) return false;
            break;
          case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            if (profitDate < weekAgo) return false;
            break;
          case 'month':
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            if (profitDate < monthAgo) return false;
            break;
          case '3months':
            const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            if (profitDate < threeMonthsAgo) return false;
            break;
        }
      }

      return true;
    });

    // حساب أرباح النظام المعلقة = إجمالي الربح - ربح الموظف
    const totalManagerProfits = relevantProfits.reduce((sum, profit) => {
      const systemProfit = (profit.profit_amount || 0) - (profit.employee_profit || 0);
      return sum + Math.max(0, systemProfit);
    }, 0);

    console.log('✅ ManagerProfitsCard: النتيجة النهائية (من جدول الأرباح):', {
      relevantProfitsCount: relevantProfits.length,
      managerProfitFromEmployees: totalManagerProfits,
      timePeriod
    });

    return totalManagerProfits;
  }, [finalProfits, timePeriod]);

  return (
    <>
      <StatCard 
        title="أرباحي من الموظفين" 
        value={managerProfitFromEmployees} 
        icon={Users} 
        colors={['green-500', 'emerald-500']} 
        format="currency" 
        onClick={() => setIsManagerProfitsDialogOpen(true)}
        className={className}
      />
      
      <ManagerProfitsDialog
        isOpen={isManagerProfitsDialogOpen}
        onClose={() => setIsManagerProfitsDialogOpen(false)}
        orders={finalOrders} 
        employees={allUsers || []}
        calculateProfit={finalCalculateProfit}
        profits={finalProfits}
        managerId={user?.id}
        stats={{ totalManagerProfits: managerProfitFromEmployees }}
        timePeriod={timePeriod}
      />
    </>
  );
};

export default ManagerProfitsCard;