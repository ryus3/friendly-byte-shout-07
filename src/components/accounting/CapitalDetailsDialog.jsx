import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Wallet, Package, Banknote, Edit, Save, X } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('ar-IQ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0) + ' د.ع';
};

const CapitalDetailsDialog = ({ 
  open, 
  onOpenChange, 
  initialCapital, 
  inventoryValue, 
  cashBalance,
  onCapitalUpdate 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [newCapital, setNewCapital] = useState(initialCapital);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setNewCapital(initialCapital);
  }, [initialCapital, open]);

  const totalCapital = initialCapital + inventoryValue;

  const handleSave = async () => {
    const capitalValue = parseFloat(newCapital);
    if (isNaN(capitalValue) || capitalValue < 0) {
      toast({ 
        title: "خطأ", 
        description: "الرجاء إدخال مبلغ صحيح أكبر من أو يساوي الصفر.", 
        variant: "destructive" 
      });
      return;
    }

    setLoading(true);
    try {
      // في النظام الجديد: لا نحفظ في قاعدة البيانات
      // رأس المال ثابت 15 مليون في الكود
      
      toast({ 
        title: "تنبيه", 
        description: "رأس المال الآن ثابت في النظام (15 مليون د.ع). لا يمكن تغييره من الواجهة.", 
        variant: "default" 
      });

      setIsEditing(false);
      
      // إشعار المستخدم بالنظام الجديد
      console.log('💰 النظام الجديد: رأس المال ثابت = 15,000,000 د.ع');
      
    } catch (error) {
      console.error('Error:', error);
      toast({ 
        title: "خطأ", 
        description: "حدث خطأ غير متوقع.", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setNewCapital(initialCapital);
    setIsEditing(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Banknote className="w-6 h-6 text-primary" />
            تفاصيل رأس المال
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* إجمالي رأس المال */}
          <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-primary">إجمالي رأس المال</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary mb-2">
                {formatCurrency(totalCapital)}
              </div>
              <Badge variant="outline" className="text-sm">
                رأس المال النقدي + قيمة المخزون
              </Badge>
            </CardContent>
          </Card>

          {/* تفاصيل رأس المال */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* رأس المال النقدي */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wallet className="w-4 h-4" />
                  رأس المال النقدي
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <div className="space-y-2">
                    <Label htmlFor="capital">المبلغ</Label>
                    <Input
                      id="capital"
                      type="number"
                      value={newCapital}
                      onChange={(e) => setNewCapital(e.target.value)}
                      placeholder="أدخل رأس المال"
                      className="text-right"
                    />
                  </div>
                ) : (
                  <div className="text-2xl font-bold text-blue-600">
                    {formatCurrency(initialCapital)}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* قيمة المخزون */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package className="w-4 h-4" />
                  قيمة المخزون
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(inventoryValue)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  محسوبة تلقائياً
                </p>
              </CardContent>
            </Card>

            {/* الرصيد النقدي الفعلي */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Banknote className="w-4 h-4" />
                  الرصيد النقدي الفعلي
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {formatCurrency(cashBalance)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  حسب حركات النقد
                </p>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* شرح المكونات */}
          <div className="bg-muted/30 p-4 rounded-lg">
            <h4 className="font-semibold mb-3 text-sm">النظام المالي الجديد:</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 shrink-0"></div>
                <span><strong>رأس المال:</strong> ثابت 15 مليون د.ع في النظام</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5 shrink-0"></div>
                <span><strong>قيمة المخزون:</strong> محسوبة تلقائياً من المنتجات</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full mt-1.5 shrink-0"></div>
                <span><strong>القاصة:</strong> رأس المال + أرباح - مصاريف - مشتريات</span>
              </li>
            </ul>
          </div>

          {/* أزرار التحكم */}
          <div className="flex justify-end gap-3">
            {isEditing ? (
              <>
                <Button 
                  variant="outline" 
                  onClick={handleCancel}
                  disabled={loading}
                >
                  <X className="w-4 h-4 mr-2" />
                  إلغاء
                </Button>
                <Button 
                  onClick={handleSave}
                  disabled={loading}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {loading ? "جاري الحفظ..." : "حفظ"}
                </Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)} disabled>
                <Edit className="w-4 h-4 mr-2" />
                رأس المال ثابت (لا يمكن التعديل)
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CapitalDetailsDialog;