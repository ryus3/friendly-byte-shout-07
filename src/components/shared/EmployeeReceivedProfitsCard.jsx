import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import StatCard from '@/components/dashboard/StatCard';
import { Receipt } from 'lucide-react';
import EmployeeReceivedProfitsDialog from './EmployeeReceivedProfitsDialog';

/**
 * كارت أرباحي المستلمة للموظفين
 * يعرض إجمالي الأرباح التي تم دفعها للموظف مع تفاصيل الفواتير
 */
const EmployeeReceivedProfitsCard = ({ 
  className = '',
  settlementInvoices = [],
  allUsers = []
}) => {
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // حساب إجمالي الأرباح المستلمة للموظف الحالي
  const employeeReceivedProfits = useMemo(() => {
    if (!settlementInvoices || !Array.isArray(settlementInvoices) || !user?.id) {
      console.log('🔍 EmployeeReceivedProfitsCard: بيانات مفقودة:', {
        settlementInvoices: settlementInvoices?.length || 0,
        userId: user?.id || 'مفقود'
      });
      return { total: 0, invoices: [] };
    }

    // فلترة الفواتير الخاصة بالموظف الحالي
    const employeeInvoices = settlementInvoices.filter(invoice => 
      invoice.employee_id === user.id && invoice.status === 'completed'
    );

    // حساب إجمالي المبلغ المستلم
    const totalReceived = employeeInvoices.reduce((sum, invoice) => 
      sum + (invoice.total_amount || 0), 0
    );

    console.log('💰 EmployeeReceivedProfitsCard: حساب الأرباح المستلمة:', {
      employeeId: user.id,
      allInvoices: settlementInvoices.length,
      employeeInvoices: employeeInvoices.length,
      totalReceived,
      invoicesSample: employeeInvoices.slice(0, 2)
    });

    return {
      total: totalReceived,
      invoices: employeeInvoices
    };
  }, [settlementInvoices, user?.id]);

  return (
    <>
      <StatCard 
        title="أرباحي المستلمة" 
        value={employeeReceivedProfits.total} 
        icon={Receipt} 
        colors={['blue-500', 'cyan-500']} 
        format="currency" 
        onClick={() => setIsDialogOpen(true)}
        className={className}
        subtitle={
          employeeReceivedProfits.invoices.length > 0 
            ? `${employeeReceivedProfits.invoices.length} فاتورة مستلمة`
            : 'لا توجد أرباح مستلمة بعد'
        }
      />
      
      <EmployeeReceivedProfitsDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        invoices={employeeReceivedProfits.invoices}
        totalAmount={employeeReceivedProfits.total}
        employeeName={user?.full_name}
        employeeCode={user?.employee_code}
        allUsers={allUsers}
      />
    </>
  );
};

export default EmployeeReceivedProfitsCard;