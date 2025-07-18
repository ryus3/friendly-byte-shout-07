import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { DollarSign, Percent } from 'lucide-react';

const DiscountDialog = ({ open, onOpenChange, onApplyDiscount, orderTotal = 0 }) => {
  const [discountType, setDiscountType] = useState('amount'); // 'amount' أو 'percentage'
  const [discountValue, setDiscountValue] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleClose = () => {
    setDiscountValue('');
    setDiscountReason('');
    setDiscountType('amount');
    onOpenChange(false);
  };

  const calculateDiscountAmount = () => {
    const value = parseFloat(discountValue) || 0;
    if (discountType === 'percentage') {
      return (orderTotal * value) / 100;
    }
    return value;
  };

  const handleApply = async () => {
    if (!discountValue || parseFloat(discountValue) <= 0) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال قيمة الخصم",
        variant: "destructive"
      });
      return;
    }

    const discountAmount = calculateDiscountAmount();
    
    if (discountAmount >= orderTotal) {
      toast({
        title: "خطأ",
        description: "قيمة الخصم لا يمكن أن تكون أكبر من إجمالي الطلب",
        variant: "destructive"
      });
      return;
    }

    if (!discountReason.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال سبب الخصم",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      await onApplyDiscount({
        discountAmount,
        discountReason: discountReason.trim(),
        discountType,
        discountValue: parseFloat(discountValue)
      });
      
      toast({
        title: "تم تطبيق الخصم",
        description: `تم خصم ${discountAmount.toLocaleString()} د.ع بنجاح`,
        variant: "success"
      });
      
      handleClose();
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في تطبيق الخصم",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const previewAmount = calculateDiscountAmount();
  const newTotal = orderTotal - previewAmount;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-orange-500" />
            إضافة خصم للطلب
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* نوع الخصم */}
          <div className="space-y-2">
            <Label>نوع الخصم</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={discountType === 'amount' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDiscountType('amount')}
                className="flex-1"
              >
                <DollarSign className="w-4 h-4 ml-2" />
                مبلغ ثابت
              </Button>
              <Button
                type="button"
                variant={discountType === 'percentage' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDiscountType('percentage')}
                className="flex-1"
              >
                <Percent className="w-4 h-4 ml-2" />
                نسبة مئوية
              </Button>
            </div>
          </div>

          {/* قيمة الخصم */}
          <div className="space-y-2">
            <Label>
              {discountType === 'amount' ? 'مبلغ الخصم (د.ع)' : 'نسبة الخصم (%)'}
            </Label>
            <Input
              type="number"
              min="0"
              max={discountType === 'percentage' ? "100" : orderTotal.toString()}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              placeholder={discountType === 'amount' ? '0' : '0'}
              dir="ltr"
            />
          </div>

          {/* سبب الخصم */}
          <div className="space-y-2">
            <Label>سبب الخصم *</Label>
            <Textarea
              value={discountReason}
              onChange={(e) => setDiscountReason(e.target.value)}
              placeholder="اذكر سبب منح هذا الخصم..."
              rows={3}
            />
          </div>

          {/* معاينة الخصم */}
          {discountValue && parseFloat(discountValue) > 0 && (
            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">إجمالي الطلب:</span>
                <span className="font-medium">{orderTotal.toLocaleString()} د.ع</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">الخصم:</span>
                <span className="font-medium text-orange-600">-{previewAmount.toLocaleString()} د.ع</span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex justify-between">
                <span className="font-medium">المبلغ النهائي:</span>
                <span className="font-bold text-lg text-green-600">{newTotal.toLocaleString()} د.ع</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            إلغاء
          </Button>
          <Button 
            onClick={handleApply} 
            disabled={isLoading || !discountValue || !discountReason.trim()}
          >
            {isLoading ? 'جاري التطبيق...' : 'تطبيق الخصم'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DiscountDialog;