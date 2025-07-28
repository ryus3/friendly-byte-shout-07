import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Loader2, User, CheckCircle } from 'lucide-react';
import { useInventory } from '@/contexts/InventoryContext';
import { toast } from '@/hooks/use-toast';

// معرف المدير الرئيسي - يجب عدم عرض التسوية له
const ADMIN_ID = '91484496-b887-44f7-9e5d-be9db5567604';

const EmployeeSettlementCard = ({ 
  employee, 
  selectedOrders, 
  onClearSelection,
  calculateProfit 
}) => {
  const { settleEmployeeProfits } = useInventory();
  const [isSettling, setIsSettling] = useState(false);

  // حساب إجمالي المستحقات للطلبات المحددة
  const totalSettlement = useMemo(() => {
    return selectedOrders
      .filter(order => order.created_by === employee.user_id)
      .reduce((sum, order) => {
        const employeeProfit = (order.items || []).reduce((itemSum, item) => 
          itemSum + (calculateProfit ? calculateProfit(item, order.created_by) : 0), 0
        );
        return sum + employeeProfit;
      }, 0);
  }, [selectedOrders, employee.user_id, calculateProfit]);

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
                <AlertDialogDescription className="text-right">
                  هل أنت متأكد من دفع مستحقات <strong>{employee.full_name}</strong> بمبلغ{' '}
                  <strong className="text-green-600">{totalSettlement.toLocaleString()} د.ع</strong>؟
                  <br />
                  <br />
                  سيتم:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>تسجيل المبلغ كمصروف في النظام</li>
                    <li>أرشفة {employeeOrders.length} طلب تلقائياً</li>
                    <li>تحديث سجلات الأرباح</li>
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