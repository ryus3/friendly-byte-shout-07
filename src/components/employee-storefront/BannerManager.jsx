import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Upload, Trash2, GripVertical } from 'lucide-react';

const BannerManager = ({ banners, onUpdate }) => {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `storefront-banners/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('storefront_assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('storefront_assets')
        .getPublicUrl(filePath);

      const { error: insertError } = await supabase
        .from('employee_banners')
        .insert({
          employee_id: user.id,
          banner_image: publicUrl,
          banner_position: 'hero',
          display_order: banners.length,
          is_active: true
        });

      if (insertError) throw insertError;

      onUpdate();
      toast({
        title: 'تم الرفع',
        description: 'تم إضافة البانر بنجاح'
      });
    } catch (err) {
      console.error('Error uploading banner:', err);
      toast({
        title: 'خطأ',
        description: 'فشل رفع البانر',
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase
        .from('employee_banners')
        .delete()
        .eq('id', id);

      if (error) throw error;

      onUpdate();
      toast({
        title: 'تم الحذف',
        description: 'تم حذف البانر'
      });
    } catch (err) {
      console.error('Error deleting banner:', err);
      toast({
        title: 'خطأ',
        description: 'فشل حذف البانر',
        variant: 'destructive'
      });
    }
  };

  const handleUpdateField = async (id, field, value) => {
    try {
      const { error } = await supabase
        .from('employee_banners')
        .update({ [field]: value })
        .eq('id', id);

      if (error) throw error;
      onUpdate();
    } catch (err) {
      console.error('Error updating banner:', err);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <input
          type="file"
          id="banner-upload"
          accept="image/*"
          onChange={handleUpload}
          className="hidden"
          disabled={uploading}
        />
        <label htmlFor="banner-upload">
          <Button asChild disabled={uploading}>
            <span>
              <Upload className="ml-2 h-4 w-4" />
              إضافة بانر جديد
            </span>
          </Button>
        </label>
      </div>

      {banners.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          لا توجد بانرات حالياً
        </Card>
      ) : (
        <div className="space-y-4">
          {banners.map(banner => (
            <Card key={banner.id} className="p-4">
              <div className="flex gap-4">
                <div className="flex items-center">
                  <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
                </div>

                <img
                  src={banner.banner_image}
                  alt="Banner"
                  className="w-40 h-24 object-cover rounded"
                />

                <div className="flex-1 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>العنوان</Label>
                      <Input
                        value={banner.banner_title || ''}
                        onChange={(e) => handleUpdateField(banner.id, 'banner_title', e.target.value)}
                        placeholder="عنوان البانر"
                      />
                    </div>

                    <div>
                      <Label>الموقع</Label>
                      <Select
                        value={banner.banner_position}
                        onValueChange={(value) => handleUpdateField(banner.id, 'banner_position', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hero">الصفحة الرئيسية</SelectItem>
                          <SelectItem value="announcement">شريط الإعلانات</SelectItem>
                          <SelectItem value="sidebar">الشريط الجانبي</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label>الرابط (اختياري)</Label>
                    <Input
                      value={banner.banner_link || ''}
                      onChange={(e) => handleUpdateField(banner.id, 'banner_link', e.target.value)}
                      placeholder="https://..."
                      dir="ltr"
                    />
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleDelete(banner.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default BannerManager;
