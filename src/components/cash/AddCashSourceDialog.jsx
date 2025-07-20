import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Wallet, CreditCard, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';

const AddCashSourceDialog = ({ children, onAdd }) => {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'cash',
    description: '',
    initial_balance: 0
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    
    try {
      await onAdd?.(formData);
      
      // إعادة تعيين النموذج
      setFormData({
        name: '',
        type: 'cash',
        description: '',
        initial_balance: 0
      });
      
      setOpen(false);
    } catch (error) {
      console.error('خطأ في إضافة مصدر النقد:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'bank': return CreditCard;
      case 'digital_wallet': return Smartphone;
      default: return Wallet;
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'bank': return 'حساب بنكي';
      case 'digital_wallet': return 'محفظة إلكترونية';
      default: return 'نقد';
    }
  };

  const TypeIcon = getTypeIcon(formData.type);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            إضافة مصدر جديد
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TypeIcon className="w-5 h-5 text-primary" />
            إضافة مصدر نقد جديد
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* اسم المصدر */}
          <div className="space-y-2">
            <Label htmlFor="name">اسم المصدر</Label>
            <Input
              id="name"
              placeholder="مثال: القاصة الفرعية، حساب البنك الأهلي"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          {/* نوع المصدر */}
          <div className="space-y-2">
            <Label>نوع المصدر</Label>
            <Select 
              value={formData.type} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
            >
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  <TypeIcon className="w-4 h-4" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    {getTypeLabel('cash')}
                  </div>
                </SelectItem>
                <SelectItem value="bank">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    {getTypeLabel('bank')}
                  </div>
                </SelectItem>
                <SelectItem value="digital_wallet">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4" />
                    {getTypeLabel('digital_wallet')}
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* الرصيد الابتدائي */}
          <div className="space-y-2">
            <Label htmlFor="initial_balance">الرصيد الابتدائي (د.ع)</Label>
            <Input
              id="initial_balance"
              type="number"
              placeholder="0"
              value={formData.initial_balance}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                initial_balance: parseFloat(e.target.value) || 0 
              }))}
              min="0"
            />
          </div>

          {/* الوصف */}
          <div className="space-y-2">
            <Label htmlFor="description">الوصف (اختياري)</Label>
            <Textarea
              id="description"
              placeholder="وصف المصدر أو ملاحظات إضافية..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>

          {/* أزرار العمل */}
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1"
              disabled={isSubmitting}
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={isSubmitting || !formData.name.trim()}
            >
              <Plus className="w-4 h-4 ml-1" />
              {isSubmitting ? 'جاري الإضافة...' : 'إضافة المصدر'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddCashSourceDialog;