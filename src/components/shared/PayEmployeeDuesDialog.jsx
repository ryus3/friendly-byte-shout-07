import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Badge } from '@/components/ui/badge';
import { 
  DollarSign, 
  User, 
  Calendar, 
  AlertTriangle,
  CheckCircle,
  CreditCard 
} from 'lucide-react';

/**
 * مكون دفع مستحقات الموظفين
 * يستخدم الدالة الجديدة pay_employee_dues لتسجيل الدفع بشكل صحيح
 */
const PayEmployeeDuesDialog = ({ 
  open, 
  onOpenChange, 
  employee = null, 
  pendingAmount = 0,
  onPaymentComplete = () => {}
}) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!employee) {
      toast({
        title: "خطأ",
        description: "يجب اختيار موظف",
        variant: "destructive"
      });
      return;
    }

    const paymentAmount = parseFloat(amount);
    if (!paymentAmount || paymentAmount <= 0) {
      toast({
        title: "خطأ",
        description: "يجب إدخال مبلغ صحيح",
        variant: "destructive"
      });
      return;
    }

    if (paymentAmount > pendingAmount) {
      toast({
        title: "خطأ",
        description: "المبلغ أكبر من المستحقات المعلقة",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      // استخدام الدالة الجديدة لدفع المستحقات مع إنشاء فاتورة حقيقية
      const { data, error } = await supabase
        .rpc('pay_employee_dues_with_invoice', {
          p_employee_id: employee.user_id,
          p_amount: paymentAmount,
          p_description: description || `دفع مستحقات ${employee.full_name}`,
          p_paid_by: null, // سيستخدم المستخدم الحالي
          p_order_ids: '{}', // يمكن إضافة معرفات الطلبات لاحقاً
          p_profit_ids: '{}' // يمكن إضافة معرفات الأرباح لاحقاً
        });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "تم الدفع بنجاح",
          description: data.message,
          variant: "default"
        });

        // إعادة تعيين النموذج
        setAmount('');
        setDescription('');
        onOpenChange(false);
        onPaymentComplete(paymentAmount);
      } else {
        throw new Error(data.error || 'حدث خطأ أثناء الدفع');
      }

    } catch (error) {
      console.error('Error paying employee dues:', error);
      toast({
        title: "خطأ في الدفع",
        description: error.message || 'حدث خطأ أثناء دفع المستحقات',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ar-IQ', {
      style: 'decimal',
      minimumFractionDigits: 0
    }).format(amount || 0) + ' د.ع';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            دفع مستحقات الموظف
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* معلومات الموظف */}
          {employee && (
            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{employee.full_name}</span>
                <Badge variant="outline">{employee.role}</Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">المستحقات المعلقة:</span>
                <span className="font-bold text-primary">
                  {formatCurrency(pendingAmount)}
                </span>
              </div>
              
              {pendingAmount > 0 ? (
                <div className="flex items-center gap-2 text-sm text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                  <span>يوجد مستحقات معلقة للدفع</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>لا توجد مستحقات معلقة</span>
                </div>
              )}
            </div>
          )}

          {/* مبلغ الدفع */}
          <div className="space-y-2">
            <Label htmlFor="amount">المبلغ المدفوع</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="أدخل المبلغ"
                className="pl-10"
                min="0"
                max={pendingAmount}
                step="1000"
                required
              />
            </div>
            {amount && (
              <p className="text-xs text-muted-foreground">
                المبلغ: {formatCurrency(parseFloat(amount) || 0)}
              </p>
            )}
          </div>

          {/* الوصف */}
          <div className="space-y-2">
            <Label htmlFor="description">وصف الدفع (اختياري)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="أدخل تفاصيل إضافية للدفع..."
              rows={3}
            />
          </div>

          {/* معلومات إضافية */}
          <div className="bg-blue-50 p-3 rounded-lg text-sm">
            <div className="flex items-center gap-2 text-blue-700 mb-2">
              <Calendar className="h-4 w-4" />
              <span className="font-medium">معلومات الدفع:</span>
            </div>
            <ul className="text-blue-600 space-y-1 text-xs">
              <li>• سيتم خصم المبلغ من القاصة الرئيسية</li>
              <li>• سيتم تسجيل المبلغ كمصروف من نوع "مستحقات الموظفين"</li>
              <li>• سيتم تحديث حالة الأرباح إلى "مدفوعة"</li>
              <li>• سيتم إنشاء حركة نقدية للتتبع</li>
            </ul>
          </div>

          <DialogFooter className="gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              إلغاء
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !amount || parseFloat(amount) <= 0}
              className="gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  جاري الدفع...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4" />
                  دفع المستحقات
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PayEmployeeDuesDialog;