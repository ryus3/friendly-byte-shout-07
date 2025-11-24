import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const CustomDescriptionEditor = ({ product, customDescription, onSave }) => {
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDescription(customDescription?.custom_description || product?.description || '');
  }, [customDescription, product]);

  const handleSave = async () => {
    try {
      setSaving(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (customDescription) {
        const { error } = await supabase
          .from('employee_product_descriptions')
          .update({ custom_description: description })
          .eq('id', customDescription.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('employee_product_descriptions')
          .insert({
            employee_id: user.id,
            product_id: product.id,
            custom_description: description,
            is_featured: false
          });

        if (error) throw error;
      }

      onSave();
      toast({
        title: 'تم الحفظ',
        description: 'تم حفظ الوصف المخصص'
      });
    } catch (err) {
      console.error('Error saving description:', err);
      toast({
        title: 'خطأ',
        description: 'فشل حفظ الوصف',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  if (!product) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{product.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <img
            src={product.variants?.[0]?.images?.[0] || product.image || '/placeholder.png'}
            alt={product.name}
            className="w-32 h-32 object-cover rounded"
          />
          <div>
            <p className="text-sm text-muted-foreground">{product.brand}</p>
            <p className="text-lg font-bold text-primary mt-1">
              {product.variants?.[0]?.price?.toLocaleString('ar-IQ')} IQD
            </p>
          </div>
        </div>

        <div>
          <Label>الوصف الافتراضي</Label>
          <p className="text-sm text-muted-foreground p-3 bg-muted rounded-lg mt-1">
            {product.description || 'لا يوجد وصف'}
          </p>
        </div>

        <div>
          <Label htmlFor="custom_description">الوصف المخصص</Label>
          <Textarea
            id="custom_description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            className="mt-1"
            placeholder="أضف وصفاً مخصصاً لهذا المنتج..."
          />
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
          حفظ الوصف المخصص
        </Button>
      </CardContent>
    </Card>
  );
};

export default CustomDescriptionEditor;
