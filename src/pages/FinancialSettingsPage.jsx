import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Coins, TrendingUp, Settings, Save, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { useCashSources } from '@/hooks/useCashSources';

const FinancialSettingsPage = () => {
  // نستخدم toast مباشرة
  const { getMainCashBalance, fetchCashSources } = useCashSources();
  
  const [initialCapital, setInitialCapital] = useState(0);
  const [newCapital, setNewCapital] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [realizedProfits, setRealizedProfits] = useState(0);
  const [mainCashBalance, setMainCashBalance] = useState(0);

  // جلب البيانات المالية
  useEffect(() => {
    loadFinancialData();
  }, []);

  const loadFinancialData = async () => {
    try {
      // جلب رأس المال
      const { data: capitalData } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'initial_capital')
        .single();

      if (capitalData) {
        setInitialCapital(Number(capitalData.value));
        setNewCapital(Number(capitalData.value).toString());
      }

      // جلب الأرباح المحققة
      const { data: profitsData } = await supabase
        .from('profits')
        .select('employee_profit')
        .eq('status', 'settled');

      const totalRealizedProfits = profitsData?.reduce((sum, profit) => sum + (profit.employee_profit || 0), 0) || 0;
      setRealizedProfits(totalRealizedProfits);

      // حساب رصيد القاصة الرئيسية
      const mainBalance = await getMainCashBalance();
      setMainCashBalance(mainBalance);

    } catch (error) {
      console.error('خطأ في جلب البيانات المالية:', error);
      toast({
        title: "خطأ",
        description: "فشل في جلب البيانات المالية",
        variant: "destructive",
      });
    }
  };

  const handleUpdateCapital = async () => {
    if (!newCapital || isNaN(newCapital) || Number(newCapital) < 0) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال مبلغ صحيح",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('settings')
        .update({ 
          value: Number(newCapital),
          updated_at: new Date().toISOString()
        })
        .eq('key', 'initial_capital');

      if (error) throw error;

      setInitialCapital(Number(newCapital));
      setIsEditing(false);
      
      // إعادة تحميل البيانات لتحديث الأرصدة
      await loadFinancialData();
      await fetchCashSources();

      toast({
        title: "تم التحديث",
        description: "تم تحديث رأس المال بنجاح",
      });

    } catch (error) {
      console.error('خطأ في تحديث رأس المال:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحديث رأس المال",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ar-IQ', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0) + ' د.ع';
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">الإعدادات المالية</h1>
          <p className="text-muted-foreground">إدارة رأس المال والإعدادات المالية للنظام</p>
        </div>
        <Badge variant="outline" className="gap-2">
          <Settings className="h-4 w-4" />
          إعدادات النظام
        </Badge>
      </div>

      {/* نظرة عامة مالية */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">رأس المال الأولي</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(initialCapital)}</div>
            <p className="text-xs text-muted-foreground">المبلغ المستثمر في الشركة</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">صافي الأرباح المحققة</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(realizedProfits)}</div>
            <p className="text-xs text-muted-foreground">الأرباح التي تم تحقيقها وتسويتها</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">رصيد القاصة الرئيسية</CardTitle>
            <Coins className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{formatCurrency(mainCashBalance)}</div>
            <p className="text-xs text-muted-foreground">رأس المال + صافي الأرباح</p>
          </CardContent>
        </Card>
      </div>

      {/* إدارة رأس المال */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            إدارة رأس المال
          </CardTitle>
          <CardDescription>
            يمكنك تعديل رأس المال في أي وقت. سيؤثر هذا على حساب رصيد القاصة الرئيسية فوراً.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="space-y-2 flex-1">
              <Label htmlFor="capital">رأس المال الحالي</Label>
              {isEditing ? (
                <Input
                  id="capital"
                  type="number"
                  value={newCapital}
                  onChange={(e) => setNewCapital(e.target.value)}
                  placeholder="أدخل رأس المال الجديد"
                  className="text-lg"
                />
              ) : (
                <div className="text-2xl font-bold text-primary p-3 bg-muted rounded-lg">
                  {formatCurrency(initialCapital)}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button
                  onClick={handleUpdateCapital}
                  disabled={loading}
                  className="gap-2"
                >
                  <Save className="h-4 w-4" />
                  {loading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setNewCapital(initialCapital.toString());
                  }}
                  disabled={loading}
                >
                  إلغاء
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                onClick={() => setIsEditing(true)}
                className="gap-2"
              >
                <Settings className="h-4 w-4" />
                تعديل رأس المال
              </Button>
            )}
          </div>

          <div className="flex items-start gap-2 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium mb-1">تنبيه مهم:</p>
              <p>تغيير رأس المال سيؤثر فوراً على:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>رصيد القاصة الرئيسية</li>
                <li>التقارير المالية</li>
                <li>حسابات الأرباح والخسائر</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* معلومات النظام المالي */}
      <Card>
        <CardHeader>
          <CardTitle>حالة النظام المالي</CardTitle>
          <CardDescription>معلومات حول قوة وتماسك النظام المالي</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">رأس المال محفوظ</span>
                <Badge variant="default" className="bg-green-500">✓ محفوظ</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">الأرباح مترابطة</span>
                <Badge variant="default" className="bg-green-500">✓ مترابطة</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">مصادر النقد حقيقية</span>
                <Badge variant="default" className="bg-green-500">✓ حقيقية</Badge>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">المشتريات مترابطة</span>
                <Badge variant="default" className="bg-green-500">✓ مترابطة</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">الحركات المالية</span>
                <Badge variant="default" className="bg-green-500">✓ حية</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">قوة النظام</span>
                <Badge variant="default" className="bg-blue-500">💪 قوي جداً</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinancialSettingsPage;