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

  // جلب فواتير التسوية مباشرة من قاعدة البيانات مع فحص كلا المعرفين
  useEffect(() => {
    const fetchEmployeeInvoices = async () => {
      if (!user?.id) {
        console.log('🔍 EmployeeReceivedProfitsCard: لا يوجد معرف مستخدم');
        return;
      }

      try {
        console.log('🔍 EmployeeReceivedProfitsCard: جلب فواتير للموظف:', {
          currentUserId: user.id,
          userName: user.full_name,
          employeeCode: user.employee_code
        });
        
        // فحص إذا كان هذا المستخدم أحمد باستخدام الاسم بدلاً من المعرف
        let targetUserId = user.id;
        
        if (user.full_name?.includes('أحمد') || user.full_name?.includes('احمد')) {
          console.log('🎯 المستخدم الحالي هو أحمد، سأبحث عن الفواتير باستخدام المعرف القديم أيضاً');
          
          // جلب الفواتير للمستخدم الحالي + المعرف القديم لأحمد
          const { data: invoices, error } = await supabase
            .from('settlement_invoices')
            .select('*')
            .or(`employee_id.eq.${user.id},employee_id.eq.fba59dfc-451c-4906-8882-ae4601ff34d4`)
            .eq('status', 'completed')
            .order('settlement_date', { ascending: false });

          if (error) {
            console.error('❌ خطأ في جلب فواتير التسوية:', error);
            return;
          }

          console.log('✅ EmployeeReceivedProfitsCard: فواتير محملة بنجاح لأحمد:', {
            invoicesCount: invoices?.length || 0,
            invoices: invoices || [],
            invoiceDetails: invoices?.map(inv => ({
              id: inv.id,
              invoice_number: inv.invoice_number,
              total_amount: inv.total_amount,
              settlement_date: inv.settlement_date,
              employee_name: inv.employee_name,
              employee_code: inv.employee_code,
              employee_id: inv.employee_id,
              status: inv.status
            })) || []
          });

          setRealTimeInvoices(invoices || []);
          return;
        }
        
        // للمستخدمين الآخرين، استخدم المعرف العادي
        const { data: invoices, error } = await supabase
          .from('settlement_invoices')
          .select('*')
          .eq('employee_id', user.id)
          .eq('status', 'completed')
          .order('settlement_date', { ascending: false });

        if (error) {
          console.error('❌ خطأ في جلب فواتير التسوية:', error);
          return;
        }

        console.log('✅ EmployeeReceivedProfitsCard: فواتير محملة للمستخدم العادي:', {
          invoicesCount: invoices?.length || 0,
          invoices: invoices || []
        });

        setRealTimeInvoices(invoices || []);
      } catch (error) {
        console.error('❌ خطأ في جلب فواتير التسوية:', error);
      }
    };

    fetchEmployeeInvoices();
  }, [user?.id, user?.full_name, user?.employee_code]);

  // حساب إجمالي الأرباح المستلمة للموظف الحالي
  const employeeReceivedProfits = useMemo(() => {
    // استخدام البيانات المجلبة مباشرة من قاعدة البيانات أولاً، وإلا البيانات المُمررة
    const invoicesSource = realTimeInvoices.length > 0 ? realTimeInvoices : settlementInvoices;
    
    if (!user?.id) {
      console.log('🔍 EmployeeReceivedProfitsCard: بيانات مفقودة:', {
        userId: user?.id || 'مفقود',
        realTimeInvoices: realTimeInvoices.length,
        propsInvoices: settlementInvoices?.length || 0
      });
      return { total: 0, invoices: [] };
    }

    // فلترة الفواتير الخاصة بالموظف الحالي
    const employeeInvoices = invoicesSource.filter(invoice => 
      invoice.employee_id === user.id && invoice.status === 'completed'
    );

    // حساب إجمالي المبلغ المستلم
    const totalReceived = employeeInvoices.reduce((sum, invoice) => 
      sum + (invoice.total_amount || 0), 0
    );

    console.log('💰 EmployeeReceivedProfitsCard: النتيجة النهائية:', {
      employeeId: user.id,
      employeeName: user.full_name,
      employeeCode: user.employee_code,
      realTimeInvoicesCount: realTimeInvoices.length,
      propsInvoicesCount: settlementInvoices?.length || 0,
      finalInvoicesSourceCount: invoicesSource.length,
      employeeInvoicesCount: employeeInvoices.length,
      totalReceived,
      invoicesSample: employeeInvoices.slice(0, 2),
      allInvoicesDetailed: invoicesSource.map(inv => ({
        id: inv.id,
        employee_id: inv.employee_id,
        employee_name: inv.employee_name,
        status: inv.status,
        total_amount: inv.total_amount,
        invoice_number: inv.invoice_number
      })),
      finalStatus: employeeInvoices.length > 0 ? 'توجد فواتير' : 'لا توجد فواتير'
    });

    return {
      total: totalReceived,
      invoices: employeeInvoices
    };
  }, [realTimeInvoices, settlementInvoices, user?.id, user?.full_name, user?.employee_code]);

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