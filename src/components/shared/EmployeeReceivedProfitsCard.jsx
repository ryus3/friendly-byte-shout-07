import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
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
  const [realTimeInvoices, setRealTimeInvoices] = useState([]);

  // جلب فواتير التسوية باستخدام المعرف الصغير employee_code بدلاً من UUID
  useEffect(() => {
    const fetchEmployeeInvoices = async () => {
      if (!user?.employee_code) {
        console.log('🔍 EmployeeReceivedProfitsCard: لا يوجد معرف موظف صغير');
        return;
      }

      try {
        console.log('🔍 EmployeeReceivedProfitsCard: جلب فواتير بالمعرف الصغير:', {
          employeeCode: user.employee_code,
          userName: user.full_name
        });
        
        // البحث بالمعرف الصغير employee_code بدلاً من UUID
        const { data: invoices, error } = await supabase
          .from('settlement_invoices')
          .select('*')
          .eq('employee_code', user.employee_code)  // استخدام المعرف الصغير EMP002
          .eq('status', 'completed')
          .order('settlement_date', { ascending: false });

        if (error) {
          console.error('❌ خطأ في جلب فواتير التسوية:', error);
          return;
        }

        console.log('✅ EmployeeReceivedProfitsCard: فواتير محملة بنجاح بالمعرف الصغير:', {
          employeeCode: user.employee_code,
          invoicesCount: invoices?.length || 0,
          invoices: invoices || [],
          invoiceDetails: invoices?.map(inv => ({
            id: inv.id,
            invoice_number: inv.invoice_number,
            total_amount: inv.total_amount,
            settlement_date: inv.settlement_date,
            employee_name: inv.employee_name,
            employee_code: inv.employee_code,
            status: inv.status
          })) || []
        });

        setRealTimeInvoices(invoices || []);
      } catch (error) {
        console.error('❌ خطأ في جلب فواتير التسوية:', error);
      }
    };

    fetchEmployeeInvoices();
  }, [user?.employee_code, user?.full_name]);

  // حساب إجمالي الأرباح المستلمة للموظف الحالي
  const employeeReceivedProfits = useMemo(() => {
    // استخدام البيانات المجلبة مباشرة من قاعدة البيانات أولاً، وإلا البيانات المُمررة
    const invoicesSource = realTimeInvoices.length > 0 ? realTimeInvoices : settlementInvoices;
    
    if (!user?.employee_code) {
      console.log('🔍 EmployeeReceivedProfitsCard: بيانات مفقودة:', {
        employeeCode: user?.employee_code || 'مفقود',
        realTimeInvoices: realTimeInvoices.length,
        propsInvoices: settlementInvoices?.length || 0
      });
      return { total: 0, invoices: [] };
    }

    // فلترة الفواتير الخاصة بالموظف الحالي باستخدام employee_code
    const employeeInvoices = invoicesSource.filter(invoice => 
      invoice.employee_code === user.employee_code && invoice.status === 'completed'
    );

    // حساب إجمالي المبلغ المستلم
    const totalReceived = employeeInvoices.reduce((sum, invoice) => 
      sum + (invoice.total_amount || 0), 0
    );

    console.log('💰 EmployeeReceivedProfitsCard: النتيجة النهائية بالمعرف الصغير:', {
      employeeCode: user.employee_code,
      employeeName: user.full_name,
      realTimeInvoicesCount: realTimeInvoices.length,
      propsInvoicesCount: settlementInvoices?.length || 0,
      finalInvoicesSourceCount: invoicesSource.length,
      employeeInvoicesCount: employeeInvoices.length,
      totalReceived,
      invoicesSample: employeeInvoices.slice(0, 2),
      finalStatus: employeeInvoices.length > 0 ? 'توجد فواتير' : 'لا توجد فواتير'
    });

    return {
      total: totalReceived,
      invoices: employeeInvoices
    };
  }, [realTimeInvoices, settlementInvoices, user?.employee_code, user?.full_name]);

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
        allUsers={allUsers}
      />
    </>
  );
};

export default EmployeeReceivedProfitsCard;