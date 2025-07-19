import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFullPurchases } from '@/hooks/useFullPurchases';
import { toast } from '@/hooks/use-toast';
import { Plus, Zap } from 'lucide-react';

const QuickAddPurchaseCard = ({ onPurchaseAdded }) => {
  const { addPurchase } = useFullPurchases();
  const [isExpanded, setIsExpanded] = useState(false);
  const [quickData, setQuickData] = useState({
    supplier: '',
    amount: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);

  const handleQuickSubmit = async () => {
    if (!quickData.supplier || !quickData.amount) {
      toast({ 
        title: "خطأ", 
        description: "يرجى إدخال اسم المورد والمبلغ على الأقل", 
        variant: "destructive" 
      });
      return;
    }

    setLoading(true);
    try {
      const purchaseData = {
        supplier: quickData.supplier,
        purchaseDate: new Date(),
        items: [{
          productName: quickData.description || 'شراء عام',
          productId: null,
          variantId: null,
          variantSku: `QUICK-${Date.now()}`,
          quantity: 1,
          costPrice: Number(quickData.amount),
          color: 'افتراضي',
          size: 'افتراضي'
        }],
        totalCost: Number(quickData.amount),
        shippingCost: 0,
        status: 'completed'
      };

      const result = await addPurchase(purchaseData);
      if (result.success) {
        toast({ 
          title: "نجاح", 
          description: "تمت إضافة فاتورة الشراء السريعة بنجاح", 
          variant: "success" 
        });
        setQuickData({ supplier: '', amount: '', description: '' });
        setIsExpanded(false);
        onPurchaseAdded?.();
      }
    } catch (error) {
      toast({ 
        title: "خطأ", 
        description: "فشل في إضافة الفاتورة السريعة", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isExpanded) {
    return (
      <Card className="border-dashed border-2 hover:border-primary/50 transition-colors cursor-pointer" 
            onClick={() => setIsExpanded(true)}>
        <CardContent className="flex flex-col items-center justify-center p-6">
          <Zap className="h-8 w-8 text-muted-foreground mb-2" />
          <h3 className="font-semibold text-lg">إضافة سريعة</h3>
          <p className="text-sm text-muted-foreground text-center">
            إضافة فاتورة شراء بسيطة بسرعة
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          إضافة فاتورة سريعة
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="quickSupplier">اسم المورد</Label>
          <Input 
            id="quickSupplier"
            value={quickData.supplier}
            onChange={(e) => setQuickData(prev => ({ ...prev, supplier: e.target.value }))}
            placeholder="أدخل اسم المورد"
          />
        </div>
        
        <div>
          <Label htmlFor="quickAmount">المبلغ (د.ع)</Label>
          <Input 
            id="quickAmount"
            type="number"
            value={quickData.amount}
            onChange={(e) => setQuickData(prev => ({ ...prev, amount: e.target.value }))}
            placeholder="أدخل المبلغ الإجمالي"
          />
        </div>
        
        <div>
          <Label htmlFor="quickDescription">الوصف (اختياري)</Label>
          <Input 
            id="quickDescription"
            value={quickData.description}
            onChange={(e) => setQuickData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="وصف مختصر للمشتريات"
          />
        </div>
        
        <div className="flex gap-2">
          <Button onClick={handleQuickSubmit} disabled={loading} className="flex-1">
            <Plus className="w-4 h-4 ml-2" />
            {loading ? 'جاري الحفظ...' : 'حفظ'}
          </Button>
          <Button variant="outline" onClick={() => setIsExpanded(false)}>
            إلغاء
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default QuickAddPurchaseCard;