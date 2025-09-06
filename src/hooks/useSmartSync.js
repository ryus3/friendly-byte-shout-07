import { useState, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';

/**
 * Hook للمزامنة الذكية والمحسنة
 */
export const useSmartSync = () => {
  const [syncing, setSyncing] = useState(false);
  const [syncingEmployee, setSyncingEmployee] = useState(null);

  // مزامنة ذكية سريعة - فواتير جديدة فقط
  const smartSync = useCallback(async () => {
    setSyncing(true);
    const startTime = Date.now();
    
    try {
      console.log('🚀 بدء المزامنة الذكية...');
      
      const { data, error } = await supabase.functions.invoke('smart-invoice-sync', {
        body: { 
          mode: 'smart',
          sync_invoices: true,
          sync_orders: false, // فقط الفواتير للسرعة
          force_refresh: false
        }
      });

      if (error) throw error;

      const duration = Math.round((Date.now() - startTime) / 1000);
      
      toast({
        title: "✅ مزامنة ذكية مكتملة",
        description: data.invoices_synced > 0 
          ? `تم جلب ${data.invoices_synced} فاتورة جديدة في ${duration} ثانية فقط${data.needs_login?.length > 0 ? ` | ${data.needs_login.length} موظف يحتاج إعادة تسجيل دخول` : ''}`
          : `لا توجد فواتير جديدة - آخر تحديث في ${duration} ثانية${data.needs_login?.length > 0 ? ` | ${data.needs_login.length} موظف يحتاج إعادة تسجيل دخول` : ''}`,
        variant: data.invoices_synced > 0 ? "default" : "secondary",
        duration: 6000
      });

      return { success: true, data };

    } catch (error) {
      console.error('خطأ في المزامنة الذكية:', error);
      toast({
        title: "خطأ في المزامنة الذكية",
        description: error.message,
        variant: "destructive"
      });
      return { success: false, error };
    } finally {
      setSyncing(false);
    }
  }, []);

  // مزامنة موظف محدد
  const syncSpecificEmployee = useCallback(async (employeeId, employeeName) => {
    setSyncingEmployee(employeeId);
    const startTime = Date.now();
    
    try {
      console.log(`🔄 مزامنة موظف محدد: ${employeeName}`);
      
      const { data, error } = await supabase.functions.invoke('smart-invoice-sync', {
        body: { 
          mode: 'specific_employee',
          employee_id: employeeId,
          sync_invoices: true,
          sync_orders: true,
          force_refresh: true
        }
      });

      if (error) throw error;

      const duration = Math.round((Date.now() - startTime) / 1000);
      
      if (data.needs_login?.includes(employeeName)) {
        toast({
          title: "يحتاج تسجيل دخول",
          description: `${employeeName} يحتاج تسجيل دخول في الوسيط`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "✅ مزامنة الموظف مكتملة",
          description: `${employeeName}: ${data.invoices_synced} فاتورة جديدة | ${data.orders_updated} طلب محدث في ${duration} ثانية`,
          variant: "default",
          duration: 7000
        });
      }

      return { success: true, data };

    } catch (error) {
      console.error(`خطأ في مزامنة الموظف ${employeeName}:`, error);
      toast({
        title: "خطأ في مزامنة الموظف",
        description: `${employeeName}: ${error.message}`,
        variant: "destructive"
      });
      return { success: false, error };
    } finally {
      setSyncingEmployee(null);
    }
  }, []);

  // مزامنة شاملة - جميع الموظفين
  const comprehensiveSync = useCallback(async () => {
    setSyncing(true);
    const startTime = Date.now();
    
    try {
      console.log('🚀 بدء المزامنة الشاملة...');
      
      const { data, error } = await supabase.functions.invoke('smart-invoice-sync', {
        body: { 
          mode: 'comprehensive',
          sync_invoices: true,
          sync_orders: true,
          force_refresh: true
        }
      });

      if (error) throw error;

      const duration = Math.round((Date.now() - startTime) / 1000);
      
      toast({
        title: "🎉 مزامنة شاملة مكتملة",
        description: `تمت معالجة ${data.employees_processed} موظف | ${data.invoices_synced} فاتورة جديدة | ${data.orders_updated} طلب محدث في ${duration} ثانية${data.needs_login?.length > 0 ? ` | ${data.needs_login.length} موظف يحتاج إعادة تسجيل دخول` : ''}`,
        variant: "default",
        duration: 10000
      });

      return { success: true, data };

    } catch (error) {
      console.error('خطأ في المزامنة الشاملة:', error);
      toast({
        title: "خطأ في المزامنة الشاملة",
        description: error.message,
        variant: "destructive"
      });
      return { success: false, error };
    } finally {
      setSyncing(false);
    }
  }, []);

  // مزامنة سريعة للطلبات فقط
  const syncOrdersOnly = useCallback(async (employeeId = null) => {
    const isSingleEmployee = !!employeeId;
    if (isSingleEmployee) setSyncingEmployee(employeeId);
    else setSyncing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('smart-invoice-sync', {
        body: { 
          mode: isSingleEmployee ? 'specific_employee' : 'smart',
          employee_id: employeeId,
          sync_invoices: false,
          sync_orders: true,
          force_refresh: false
        }
      });

      if (error) throw error;

      toast({
        title: "تحديث حالات الطلبات",
        description: `تم تحديث ${data.orders_updated} طلب`,
        variant: "default"
      });

      return { success: true, data };

    } catch (error) {
      console.error('خطأ في مزامنة الطلبات:', error);
      toast({
        title: "خطأ في تحديث الطلبات",
        description: error.message,
        variant: "destructive"
      });
      return { success: false, error };
    } finally {
      if (isSingleEmployee) setSyncingEmployee(null);
      else setSyncing(false);
    }
  }, []);

  return {
    syncing,
    syncingEmployee,
    smartSync,
    syncSpecificEmployee,
    comprehensiveSync,
    syncOrdersOnly
  };
};