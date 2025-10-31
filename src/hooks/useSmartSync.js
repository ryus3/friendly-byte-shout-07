import { useState, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';

/**
 * Hook للمزامنة الذكية والمحسنة
 */
export const useSmartSync = () => {
  const [syncing, setSyncing] = useState(false);
  const [syncingEmployee, setSyncingEmployee] = useState(null);

  // مزامنة ذكية سريعة - الفواتير فقط (مُعطلة - سيتم استخدام المزامنة المباشرة)
  const smartSync = useCallback(async () => {
    console.log('⚠️ smartSync مُعطلة - استخدم المزامنة المباشرة من useAlWaseetInvoices');
    return { success: false, error: 'Use direct sync instead' };
  }, []);

  // مزامنة موظف محدد ذكية (مُعطلة)
  const syncSpecificEmployeeSmart = useCallback(async (employeeId, employeeName) => {
    console.log('⚠️ syncSpecificEmployeeSmart مُعطلة - استخدم المزامنة المباشرة');
    return { success: false, error: 'Use direct sync instead' };
  }, []);

  // مزامنة موظف محدد شاملة (مُعطلة)
  const syncSpecificEmployee = useCallback(async (employeeId, employeeName) => {
    console.log('⚠️ syncSpecificEmployee مُعطلة - استخدم المزامنة المباشرة');
    return { success: false, error: 'Use direct sync instead' };
  }, []);

  // مزامنة شاملة ذكية - استخدام المزامنة المباشرة فقط
  const comprehensiveSync = useCallback(async (visibleOrders = null, syncVisibleOrdersBatch = null) => {
    setSyncing(true);
    const startTime = Date.now();
    
    try {
      console.log('🚀 بدء المزامنة الشاملة المباشرة...');
      
      // استخدام المزامنة المباشرة للطلبات الظاهرة
      const shouldUseSmart = visibleOrders && Array.isArray(visibleOrders) && visibleOrders.length > 0 && syncVisibleOrdersBatch;
      
      if (shouldUseSmart) {
        console.log(`📋 مزامنة الطلبات الظاهرة: ${visibleOrders.length} طلب`);
        
        // مزامنة الطلبات الظاهرة فقط
        const ordersResult = await syncVisibleOrdersBatch(visibleOrders);
        
        if (!ordersResult.success) {
          throw new Error('فشل في مزامنة الطلبات الظاهرة');
        }

        const duration = Math.round((Date.now() - startTime) / 1000);
        
        toast({
          title: "🎉 مزامنة شاملة مكتملة",
          description: `تم تحديث ${ordersResult.updatedCount || 0} طلب في ${duration} ثانية`,
          variant: "default",
          duration: 8000
        });

        return { 
          success: true, 
          data: {
            invoices_synced: 0,
            orders_updated: ordersResult.updatedCount || 0,
            smart_mode: true
          } 
        };
      } else {
        toast({
          title: "تنبيه",
          description: "يرجى تمرير الطلبات الظاهرة للمزامنة",
          variant: "secondary"
        });
        return { success: false, error: 'No visible orders provided' };
      }

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

  // مزامنة سريعة للطلبات (مُعطلة)
  const syncOrdersOnly = useCallback(async (employeeId = null) => {
    console.log('⚠️ syncOrdersOnly مُعطلة - استخدم المزامنة المباشرة');
    return { success: false, error: 'Use direct sync instead' };
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