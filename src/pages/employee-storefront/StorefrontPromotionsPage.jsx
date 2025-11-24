import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import PromotionBuilder from '@/components/employee-storefront/PromotionBuilder';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

const StorefrontPromotionsPage = () => {
  const [promotions, setPromotions] = useState([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPromotions();
  }, []);

  const fetchPromotions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('employee_promotions')
        .select('*')
        .eq('employee_id', user.id)
        .order('created_at', { ascending: false });

      setPromotions(data || []);
    } catch (err) {
      console.error('Error fetching promotions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase
        .from('employee_promotions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setPromotions(promotions.filter(p => p.id !== id));
      toast({
        title: 'تم الحذف',
        description: 'تم حذف العرض بنجاح'
      });
    } catch (err) {
      console.error('Error deleting promotion:', err);
      toast({
        title: 'خطأ',
        description: 'فشل حذف العرض',
        variant: 'destructive'
      });
    }
  };

  const handleToggleActive = async (promotion) => {
    try {
      const { error } = await supabase
        .from('employee_promotions')
        .update({ is_active: !promotion.is_active })
        .eq('id', promotion.id);

      if (error) throw error;

      fetchPromotions();
      toast({
        title: promotion.is_active ? 'تم التعطيل' : 'تم التفعيل',
        description: `تم ${promotion.is_active ? 'تعطيل' : 'تفعيل'} العرض`
      });
    } catch (err) {
      console.error('Error toggling promotion:', err);
      toast({
        title: 'خطأ',
        description: 'فشل تحديث العرض',
        variant: 'destructive'
      });
    }
  };

  if (showBuilder) {
    return (
      <PromotionBuilder
        promotion={editingPromotion}
        onSave={() => {
          setShowBuilder(false);
          setEditingPromotion(null);
          fetchPromotions();
        }}
        onCancel={() => {
          setShowBuilder(false);
          setEditingPromotion(null);
        }}
      />
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">العروض والخصومات</h1>
        <Button onClick={() => setShowBuilder(true)}>
          <Plus className="h-4 w-4 ml-2" />
          إضافة عرض جديد
        </Button>
      </div>

      {loading ? (
        <div>جاري التحميل...</div>
      ) : promotions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-96 space-y-4">
            <p className="text-muted-foreground">لا توجد عروض حالياً</p>
            <Button onClick={() => setShowBuilder(true)}>
              <Plus className="h-4 w-4 ml-2" />
              إنشاء عرض جديد
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {promotions.map(promo => (
            <Card key={promo.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{promo.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {promo.discount_type === 'percentage' 
                        ? `${promo.discount_value}% خصم`
                        : `${promo.discount_value.toLocaleString('ar-IQ')} IQD خصم`
                      }
                    </p>
                  </div>
                  <Badge variant={promo.is_active ? 'default' : 'secondary'}>
                    {promo.is_active ? 'نشط' : 'معطّل'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {promo.description && (
                  <p className="text-sm text-muted-foreground">{promo.description}</p>
                )}
                
                <div className="text-xs text-muted-foreground">
                  <div>من: {new Date(promo.start_date).toLocaleDateString('ar-IQ')}</div>
                  <div>إلى: {new Date(promo.end_date).toLocaleDateString('ar-IQ')}</div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleToggleActive(promo)}
                  >
                    {promo.is_active ? 'تعطيل' : 'تفعيل'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingPromotion(promo);
                      setShowBuilder(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(promo.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default StorefrontPromotionsPage;
