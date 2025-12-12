import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Loader2, User, CheckCircle, AlertTriangle, MinusCircle } from 'lucide-react';
import { useInventory } from '@/contexts/InventoryContext';
import { toast } from '@/hooks/use-toast';
import { useUnifiedPermissionsSystem } from '@/hooks/useUnifiedPermissionsSystem';
import { isPendingStatus } from '@/utils/profitStatusHelper';
import { supabase } from '@/integrations/supabase/client';

// معرف المدير الرئيسي - يجب عدم عرض التسوية له
const ADMIN_ID = '91484496-b887-44f7-9e5d-be9db5567604';

const EmployeeSettlementCard = ({ 
  employee, 
  selectedOrders, 
  onClearSelection,
  calculateProfit 
}) => {
  const { settleEmployeeProfits, profits } = useInventory();
  const { canManageEmployees, isAdmin } = useUnifiedPermissionsSystem();
  const [isSettling, setIsSettling] = useState(false);
  const [pendingDeductions, setPendingDeductions] = useState({ total: 0, count: 0, items: [] });

  // التحقق من صلاحية المدير لدفع المستحقات
  if (!canManageEmployees && !isAdmin) {
    return null;
  }

  // جلب الخصومات المعلقة للموظف
  useEffect(() => {
    const fetchDeductions = async () => {
      if (!employee?.user_id) return;
      
      try {
        const { data, error } = await supabase
          .rpc('get_employee_pending_deductions', { p_employee_id: employee.user_id });
        
        if (error) {
          console.error('خطأ في جلب الخصومات المعلقة:', error);
          return;
        }
        
        if (data && data[0]) {
          setPendingDeductions({
            total: data[0].total_pending_deductions || 0,
            count: data[0].deductions_count || 0,
            items: data[0].deductions || []
          });
        }
      } catch (err) {
        console.error('خطأ:', err);
      }
    };
    
    fetchDeductions();
  }, [employee?.user_id]);

  // حساب إجمالي المستحقات من جدول الأرباح المعلقة
  const totalSettlement = useMemo(() => {
    if (!profits || !selectedOrders) return 0;
    
    // البحث عن الأرباح المعلقة للطلبات المحددة
    const selectedOrderIds = selectedOrders
      .filter(order => order.created_by === employee.user_id)
      .map(order => order.id);
      
    return profits
      .filter(profit => 
        profit.employee_id === employee.user_id &&
        // استخدام دالة موحدة لفحص الحالات المعلقة
        isPendingStatus(profit.status) &&
        selectedOrderIds.includes(profit.order_id)
      )
      .reduce((sum, profit) => sum + (profit.employee_profit || 0), 0);
  }, [selectedOrders, employee.user_id, profits]);

  // المبلغ النهائي بعد الخصومات
  const deductionToApply = Math.min(pendingDeductions.total, totalSettlement);
  const finalAmount = totalSettlement - deductionToApply;

  // الطلبات الخاصة بهذا الموظف فقط
  const employeeOrders = useMemo(() => {
    return selectedOrders.filter(order => order.created_by === employee.user_id);
  }, [selectedOrders, employee.user_id]);

  const handleSettlement = async () => {
    if (employeeOrders.length === 0 || totalSettlement <= 0) {
      toast({ 
        title: 'خطأ', 
        description: 'لا توجد طلبات محددة للتسوية أو المبلغ صفر.', 
        variant: 'destructive' 
      });
      return;
    }

    try {
      if (typeof settleEmployeeProfits !== 'function') {
        console.error('settleEmployeeProfits is not available:', settleEmployeeProfits);
        toast({ title: 'تعذر إجراء التسوية', description: 'وظيفة التسوية غير متاحة حالياً. حدّث الصفحة وحاول مجدداً.', variant: 'destructive' });
        return;
      }
      setIsSettling(true);
      const orderIds = employeeOrders.map(order => order.id);
      await settleEmployeeProfits(employee.user_id, totalSettlement, employee.full_name, orderIds);
      onClearSelection(); // إلغاء التحديد بعد التسوية
    } catch (error) {
      console.error('Error in settlement:', error);
      toast({ 
        title: 'خطأ', 
        description: 'حدث خطأ أثناء التسوية.', 
        variant: 'destructive' 
      });
    } finally {
      setIsSettling(false);
    }
  };

  // عدم عرض كارت التسوية للمدير أو إذا لم توجد طلبات
  if (employeeOrders.length === 0 || employee.user_id === ADMIN_ID) return null;

  return (
    <Card 
      className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800"
      data-employee-id={employee.user_id}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-200">
          <User className="w-5 h-5" />
          تسوية مستحقات {employee.full_name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">عدد الطلبات المحددة</p>
            <Badge variant="secondary" className="text-lg font-semibold">
              {employeeOrders.length} طلب
            </Badge>
          </div>
          <div className="space-y-1 text-right">
            <p className="text-sm text-muted-foreground">إجمالي المستحقات</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {totalSettlement.toLocaleString()} د.ع
            </p>
          </div>
        </div>

        {/* عرض الخصومات المعلقة إن وجدت */}
        {pendingDeductions.total > 0 && (
          <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
            <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300 mb-2">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-medium">خصومات معلقة</span>
              <Badge variant="outline" className="text-orange-600 border-orange-300">
                {pendingDeductions.count} خصم
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">سيتم خصمها من المستحقات:</span>
              <span className="font-bold text-orange-600">-{deductionToApply.toLocaleString()} د.ع</span>
            </div>
            {deductionToApply < pendingDeductions.total && (
              <p className="text-xs text-muted-foreground mt-1">
                (متبقي {(pendingDeductions.total - deductionToApply).toLocaleString()} د.ع للتسويات القادمة)
              </p>
            )}
          </div>
        )}

        {/* المبلغ النهائي */}
        {pendingDeductions.total > 0 && (
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="font-medium">المبلغ النهائي للدفع:</span>
            <span className="text-2xl font-bold text-green-600 dark:text-green-400">
              {finalAmount.toLocaleString()} د.ع
            </span>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onClearSelection}
            className="flex-1"
            disabled={isSettling}
          >
            إلغاء التحديد
          </Button>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                disabled={isSettling || totalSettlement <= 0}
              >
                {isSettling ? (
                  <Loader2 className="w-4 h-4 animate-spin ml-2" />
                ) : (
                  <DollarSign className="w-4 h-4 ml-2" />
                )}
                دفع المستحقات
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  تأكيد دفع المستحقات
                </AlertDialogTitle>
                <AlertDialogDescription className="text-right space-y-3">
                  <p>
                    هل أنت متأكد من دفع مستحقات <strong>{employee.full_name}</strong>؟
                  </p>
                  
                  <div className="bg-muted/50 p-3 rounded-lg space-y-2">
                    <div className="flex justify-between">
                      <span>إجمالي المستحقات:</span>
                      <span className="font-medium">{totalSettlement.toLocaleString()} د.ع</span>
                    </div>
                    {pendingDeductions.total > 0 && (
                      <>
                        <div className="flex justify-between text-orange-600">
                          <span className="flex items-center gap-1">
                            <MinusCircle className="w-3 h-3" />
                            خصومات معلقة:
                          </span>
                          <span className="font-medium">-{deductionToApply.toLocaleString()} د.ع</span>
                        </div>
                        <div className="flex justify-between border-t pt-2 text-green-600 font-bold">
                          <span>المبلغ النهائي:</span>
                          <span>{finalAmount.toLocaleString()} د.ع</span>
                        </div>
                      </>
                    )}
                  </div>
                  
                  <p className="text-sm">سيتم:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>تسجيل المبلغ كمصروف في النظام</li>
                    <li>أرشفة {employeeOrders.length} طلب تلقائياً</li>
                    <li>تحديث سجلات الأرباح</li>
                    {pendingDeductions.total > 0 && <li>تطبيق الخصومات المعلقة</li>}
                  </ul>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleSettlement}
                  className="bg-green-600 hover:bg-green-700"
                >
                  تأكيد الدفع
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
};

export default EmployeeSettlementCard;