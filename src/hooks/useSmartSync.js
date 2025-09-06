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

  // مزامنة موظف محدد ذكية (بدون force refresh)
  const syncSpecificEmployeeSmart = useCallback(async (employeeId, employeeName) => {
    setSyncingEmployee(employeeId);
    const startTime = Date.now();
    
    try {
      console.log(`🔄 مزامنة ذكية للموظف: ${employeeName}`);
      
      const { data, error } = await supabase.functions.invoke('smart-invoice-sync', {
        body: { 
          mode: 'specific_employee',
          employee_id: employeeId,
          sync_invoices: true,
          sync_orders: true,
          force_refresh: false // مزامنة ذكية فقط للجديد
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
          title: "✅ مزامنة ذكية للموظف مكتملة",
          description: `${employeeName}: ${data.invoices_synced} فاتورة جديدة | ${data.orders_updated} طلب محدث في ${duration} ثانية`,
          variant: "default",
          duration: 7000
        });
      }

      return { success: true, data };

    } catch (error) {
      console.error(`خطأ في المزامنة الذكية للموظف ${employeeName}:`, error);
      toast({
        title: "خطأ في المزامنة الذكية للموظف",
        description: `${employeeName}: ${error.message}`,
        variant: "destructive"
      });
      return { success: false, error };
    } finally {
      setSyncingEmployee(null);
    }
  }, []);

  // مزامنة موظف محدد شاملة (مع force refresh)
  const syncSpecificEmployee = useCallback(async (employeeId, employeeName) => {
    setSyncingEmployee(employeeId);
    const startTime = Date.now();
    
    try {
      console.log(`🔄 مزامنة شاملة للموظف: ${employeeName}`);
      
      const { data, error } = await supabase.functions.invoke('smart-invoice-sync', {
        body: { 
          mode: 'specific_employee',
          employee_id: employeeId,
          sync_invoices: true,
          sync_orders: true,
          force_refresh: true // مزامنة شاملة لكل البيانات
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
          title: "✅ مزامنة شاملة للموظف مكتملة",
          description: `${employeeName}: ${data.invoices_synced} فاتورة | ${data.orders_updated} طلب محدث في ${duration} ثانية`,
          variant: "default",
          duration: 7000
        });
      }

      return { success: true, data };

    } catch (error) {
      console.error(`خطأ في المزامنة الشاملة للموظف ${employeeName}:`, error);
      toast({
        title: "خطأ في المزامنة الشاملة للموظف",
        description: `${employeeName}: ${error.message}`,
        variant: "destructive"
      });
      return { success: false, error };
    } finally {
      setSyncingEmployee(null);
    }
  }, []);

  // مزامنة شاملة ذكية - فقط الطلبات الظاهرة والفواتير الجديدة
  const comprehensiveSync = useCallback(async (visibleOrders = null, syncVisibleOrdersBatch = null) => {
    setSyncing(true);
    const startTime = Date.now();
    
    try {
      console.log('🚀 بدء المزامنة الشاملة الذكية...');
      
      // إذا تم تمرير الطلبات الظاهرة ودالة المزامنة، استخدم البدل الذكي
      if (visibleOrders && Array.isArray(visibleOrders) && visibleOrders.length > 0 && syncVisibleOrdersBatch) {
        console.log(`📋 استخدام المزامنة الذكية للطلبات الظاهرة: ${visibleOrders.length} طلب`);
        
        // مزامنة الطلبات الظاهرة فقط
        const ordersResult = await syncVisibleOrdersBatch(visibleOrders);
        
        // مزامنة الفواتير الجديدة فقط
        const { data: invoiceData, error: invoiceError } = await supabase.functions.invoke('smart-invoice-sync', {
          body: { 
            mode: 'smart',
            sync_invoices: true,
            sync_orders: false,
            force_refresh: false
          }
        });

        if (invoiceError) throw invoiceError;

        const duration = Math.round((Date.now() - startTime) / 1000);
        
        toast({
          title: "🎉 مزامنة شاملة ذكية مكتملة",
          description: `${invoiceData.invoices_synced || 0} فاتورة جديدة | ${ordersResult.updatedCount || 0} طلب محدث في ${duration} ثانية (ذكية وسريعة!)`,
          variant: "default",
          duration: 8000
        });

        return { 
          success: true, 
          data: {
            invoices_synced: invoiceData.invoices_synced || 0,
            orders_updated: ordersResult.updatedCount || 0,
            smart_mode: true
          } 
        };
      }
      
      // المزامنة الشاملة التقليدية (للاستخدام في حالات خاصة)
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
    syncSpecificEmployeeSmart,
    comprehensiveSync,
    syncOrdersOnly
  };
};