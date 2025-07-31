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
  profits = []
}) => {
  const { user } = useAuth();
  const { orders: contextOrders, calculateProfit: contextCalculateProfit } = useInventory();
  const { profits: contextProfits } = useProfits();
  const [isManagerProfitsDialogOpen, setIsManagerProfitsDialogOpen] = useState(false);

  // استخدام البيانات من المعاملات أو من الـ context
  const finalOrders = orders.length > 0 ? orders : contextOrders || [];
  const finalProfits = profits.length > 0 ? profits : contextProfits || [];
  const finalCalculateProfit = calculateProfit || contextCalculateProfit;

  // حساب أرباح المدير من الموظفين - نفس منطق متابعة الموظفين بالضبط
  const managerProfitFromEmployees = useMemo(() => {
    if (!finalOrders || !Array.isArray(finalOrders) || !allUsers || !Array.isArray(allUsers)) {
      return 0;
    }

    // معرف المدير الرئيسي لاستبعاد طلباته - نفس القيمة من متابعة الموظفين
    const ADMIN_ID = '91484496-b887-44f7-9e5d-be9db5567604';

    console.log('🔍 ManagerProfitsCard: البيانات المستلمة:', {
      ordersCount: finalOrders.length,
      usersCount: allUsers.length,
      profitsCount: finalProfits.length
    });

    // تطبيق نفس فلترة متابعة الموظفين: استبعاد المدير + فقط الطلبات المكتملة/المسلمة + فقط طلبات الموظفين النشطين
    const employeeOrders = finalOrders.filter(order => {
      if (!order || !order.created_by) return false;
      
      // استبعاد طلبات المدير الرئيسي
      if (order.created_by === ADMIN_ID) return false;
      
      // فقط الطلبات المكتملة أو المُوصلة
      if (!['completed', 'delivered'].includes(order.status)) return false;
      
      // التأكد من أن منشئ الطلب موظف نشط
      const orderCreator = allUsers.find(u => u.user_id === order.created_by || u.id === order.created_by);
      return orderCreator && orderCreator.status === 'active' && (orderCreator.role === 'employee' || orderCreator.role === 'deputy');
    });

    console.log('🔍 ManagerProfitsCard: بعد الفلترة:', {
      employeeOrdersCount: employeeOrders.length,
      employeeOrdersSample: employeeOrders.slice(0, 3).map(o => ({ 
        id: o.id, 
        number: o.order_number, 
        created_by: o.created_by,
        status: o.status 
      }))
    });

    // حساب الأرباح - نفس منطق متابعة الموظفين
    let totalManagerProfit = 0;

    employeeOrders.forEach(order => {
      // البحث عن سجل الأرباح في قاعدة البيانات
      const profitRecord = finalProfits.find(p => p.order_id === order.id);
      
      if (profitRecord) {
        // استخدام البيانات من قاعدة البيانات
        const totalProfit = profitRecord.profit_amount || 0;
        const employeeProfit = profitRecord.employee_profit || 0;
        const managerProfitFromOrder = totalProfit - employeeProfit;
        totalManagerProfit += managerProfitFromOrder;
        
        console.log(`💰 طلب ${order.order_number}: ربح إجمالي ${totalProfit}, ربح موظف ${employeeProfit}, ربح مدير ${managerProfitFromOrder}`);
      } else {
        // استخدام الحساب التقليدي إذا لم يكن هناك سجل في قاعدة البيانات
        const orderItems = order.order_items || order.items || [];
        let managerProfitFromOrder = 0;
        
        orderItems.forEach(item => {
          const sellPrice = item.unit_price || item.price || 0;
          const costPrice = item.product_variants?.cost_price || item.products?.cost_price || 0;
          const quantity = item.quantity || 0;
          const totalItemProfit = (sellPrice - costPrice) * quantity;
          
          // في الحساب التقليدي، ربح المدير هو الربح الإجمالي ناقص ربح الموظف
          const employeeProfit = finalCalculateProfit ? finalCalculateProfit(item, order.created_by) : 0;
          managerProfitFromOrder += (totalItemProfit - employeeProfit);
        });
        
        totalManagerProfit += managerProfitFromOrder;
        console.log(`💰 طلب ${order.order_number} (حساب تقليدي): ربح مدير ${managerProfitFromOrder}`);
      }
    });

    console.log('✅ ManagerProfitsCard: النتيجة النهائية:', {
      totalManagerProfit,
      ordersProcessed: employeeOrders.length
    });

    return totalManagerProfit;
  }, [finalOrders, allUsers, finalProfits, finalCalculateProfit]);

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
      />
    </>
  );
};

export default ManagerProfitsCard;