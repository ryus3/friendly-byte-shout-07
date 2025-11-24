import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const PromotionBuilder = ({ promotion, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: promotion?.name || '',
    description: promotion?.description || '',
    discount_type: promotion?.discount_type || 'percentage',
    discount_value: promotion?.discount_value || 0,
    min_purchase_amount: promotion?.min_purchase_amount || 0,
    start_date: promotion?.start_date || new Date().toISOString().split('T')[0],
    end_date: promotion?.end_date || '',
    is_active: promotion?.is_active ?? true
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (promotion) {
        const { error } = await supabase
          .from('employee_promotions')
          .update(formData)
          .eq('id', promotion.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('employee_promotions')
          .insert({
            ...formData,
            employee_id: user.id
          });

        if (error) throw error;
      }

      toast({
        title: 'تم الحفظ',
        description: `تم ${promotion ? 'تحديث' : 'إنشاء'} العرض بنجاح`
      });

      onSave();
    } catch (err) {
      console.error('Error saving promotion:', err);
      toast({
        title: 'خطأ',
        description: 'فشل حفظ العرض',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">
          {promotion ? 'تعديل العرض' : 'إنشاء عرض جديد'}
        </h1>
        <Button variant="outline" onClick={onCancel}>
          إلغاء
        </Button>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>تفاصيل العرض</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">اسم العرض *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="description">الوصف</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="discount_type">نوع الخصم *</Label>
                <Select
                  value={formData.discount_type}
                  onValueChange={(value) => setFormData({ ...formData, discount_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">نسبة مئوية %</SelectItem>
                    <SelectItem value="fixed">مبلغ ثابت IQD</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="discount_value">قيمة الخصم *</Label>
                <Input
                  id="discount_value"
                  type="number"
                  min="0"
                  value={formData.discount_value}
                  onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) })}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="min_purchase_amount">الحد الأدنى للشراء (IQD)</Label>
              <Input
                id="min_purchase_amount"
                type="number"
                min="0"
                value={formData.min_purchase_amount}
                onChange={(e) => setFormData({ ...formData, min_purchase_amount: parseFloat(e.target.value) })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start_date">تاريخ البداية *</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="end_date">تاريخ الانتهاء *</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4">
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                {promotion ? 'تحديث العرض' : 'إنشاء العرض'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
};

export default PromotionBuilder;
