import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Minus, DollarSign, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

const AddCashDialog = ({ 
  open, 
  onOpenChange, 
  cashSource, 
  type = 'add', // 'add' or 'withdraw'
  onConfirm 
}) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isWithdrawal = type === 'withdraw';
  const title = isWithdrawal ? 'سحب أموال' : 'إضافة أموال';
  const buttonText = isWithdrawal ? 'سحب' : 'إضافة';
  const Icon = isWithdrawal ? Minus : Plus;
  const colorClass = isWithdrawal ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50';
  const textClass = isWithdrawal ? 'text-red-600' : 'text-green-600';

  useEffect(() => {
    if (open) {
      setAmount('');
      setDescription('');
      setIsSubmitting(false);
    }
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      return;
    }

    // التحقق من الرصيد المتاح في حالة السحب
    if (isWithdrawal && amountValue > (cashSource?.current_balance || 0)) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      await onConfirm?.(amountValue, description);
      onOpenChange(false);
    } catch (error) {
      console.error('خطأ في العملية:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const amountValue = parseFloat(amount) || 0;
  const newBalance = isWithdrawal 
    ? (cashSource?.current_balance || 0) - amountValue
    : (cashSource?.current_balance || 0) + amountValue;

  // أمثلة سريعة للمبالغ
  const quickAmounts = [10000, 25000, 50000, 100000, 250000, 500000];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={cn("w-5 h-5", textClass)} />
            {title}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* معلومات المصدر */}
          {cashSource && (
            <Card className={cn("border", colorClass)}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">{cashSource.name}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  الرصيد الحالي: {(cashSource.current_balance || 0).toLocaleString()} د.ع
                </div>
                {amountValue > 0 && (
                  <div className={cn("text-sm font-medium mt-1", textClass)}>
                    الرصيد الجديد: {newBalance.toLocaleString()} د.ع
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* المبلغ */}
          <div className="space-y-2">
            <Label htmlFor="amount">المبلغ (د.ع)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                id="amount"
                type="number"
                placeholder="أدخل المبلغ"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-10"
                min="1"
                max={isWithdrawal ? cashSource?.current_balance : undefined}
                required
              />
            </div>
            
            {/* تحذير عدم كفاية الرصيد */}
            {isWithdrawal && amountValue > (cashSource?.current_balance || 0) && (
              <p className="text-sm text-red-600">
                الرصيد غير كافي. الحد الأقصى: {(cashSource?.current_balance || 0).toLocaleString()} د.ع
              </p>
            )}
          </div>

          {/* مبالغ سريعة */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">مبالغ سريعة</Label>
            <div className="grid grid-cols-3 gap-2">
              {quickAmounts.map((quickAmount) => (
                <Button
                  key={quickAmount}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setAmount(quickAmount.toString())}
                  disabled={isWithdrawal && quickAmount > (cashSource?.current_balance || 0)}
                >
                  {(quickAmount / 1000)}ك
                </Button>
              ))}
            </div>
          </div>

          {/* الوصف */}
          <div className="space-y-2">
            <Label htmlFor="description">الوصف (اختياري)</Label>
            <Textarea
              id="description"
              placeholder={isWithdrawal ? "سبب السحب..." : "سبب الإضافة..."}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* أزرار العمل */}
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={isSubmitting}
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              className={cn(
                "flex-1",
                isWithdrawal 
                  ? "bg-red-600 hover:bg-red-700" 
                  : "bg-green-600 hover:bg-green-700"
              )}
              disabled={
                isSubmitting || 
                !amount || 
                parseFloat(amount) <= 0 ||
                (isWithdrawal && parseFloat(amount) > (cashSource?.current_balance || 0))
              }
            >
              <Icon className="w-4 h-4 ml-1" />
              {isSubmitting ? 'جاري المعالجة...' : buttonText}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddCashDialog;