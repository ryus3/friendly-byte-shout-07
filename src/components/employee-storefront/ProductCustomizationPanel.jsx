import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { X, Plus, Upload, Percent, Hash } from 'lucide-react';
import PremiumButton from '@/components/storefront/ui/PremiumButton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const ProductCustomizationPanel = ({ 
  product, 
  customDescription, 
  onSave, 
  canUploadImages 
}) => {
  const [description, setDescription] = useState(customDescription?.custom_description || '');
  const [discount, setDiscount] = useState(customDescription?.discount_percentage || 0);
  const [startDate, setStartDate] = useState(customDescription?.discount_start_date?.split('T')[0] || '');
  const [endDate, setEndDate] = useState(customDescription?.discount_end_date?.split('T')[0] || '');
  const [customColors, setCustomColors] = useState(customDescription?.custom_colors || []);
  const [customSizes, setCustomSizes] = useState(customDescription?.custom_sizes || []);
  const [customImages, setCustomImages] = useState(customDescription?.custom_images || []);
  const [hashtags, setHashtags] = useState(customDescription?.hashtags || []);
  const [newColor, setNewColor] = useState('');
  const [newSize, setNewSize] = useState('');
  const [newHashtag, setNewHashtag] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // حساب الألوان والقياسات المتاحة من المنتج الأصلي
  const getAvailableVariants = () => {
    const colors = new Map();
    const sizes = new Map();
    
    product?.variants?.forEach(v => {
      const qty = v.inventory?.quantity || 0;
      const reserved = v.inventory?.reserved_quantity || 0;
      const available = qty - reserved;
      
      if (available > 0) {
        if (v.color?.name) {
          const existing = colors.get(v.color.name) || { count: 0, hex: v.color.hex_code };
          colors.set(v.color.name, { count: existing.count + available, hex: existing.hex });
        }
        if (v.size?.name) {
          const existing = sizes.get(v.size.name) || 0;
          sizes.set(v.size.name, existing + available);
        }
      }
    });
    
    return { 
      colors: Array.from(colors.entries()), 
      sizes: Array.from(sizes.entries()) 
    };
  };

  const { colors: availableColors, sizes: availableSizes } = getAvailableVariants();

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'خطأ', description: 'الملف يجب أن يكون صورة', variant: 'destructive' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'خطأ', description: 'حجم الصورة يجب أن يكون أقل من 5MB', variant: 'destructive' });
      return;
    }

    try {
      setUploading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${product.id}/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('storefront-assets')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('storefront-assets')
        .getPublicUrl(fileName);

      setCustomImages([...customImages, publicUrl]);
      toast({ title: '✅ تم الرفع', description: 'تم رفع الصورة بنجاح' });
    } catch (err) {
      console.error('Error uploading image:', err);
      toast({ title: 'خطأ', description: 'فشل رفع الصورة', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول');

      const updateData = {
        employee_id: user.id,
        product_id: product.id,
        custom_description: description,
        discount_percentage: parseFloat(discount) || 0,
        discount_start_date: startDate || null,
        discount_end_date: endDate || null,
        custom_colors: customColors,
        custom_sizes: customSizes,
        custom_images: customImages,
        hashtags: hashtags
      };

      if (customDescription?.id) {
        await supabase
          .from('employee_product_descriptions')
          .update(updateData)
          .eq('id', customDescription.id);
      } else {
        await supabase
          .from('employee_product_descriptions')
          .insert(updateData);
      }

      toast({ title: '✅ تم الحفظ', description: 'تم حفظ التخصيصات بنجاح' });
      onSave();
    } catch (err) {
      console.error('Error saving customizations:', err);
      toast({ title: 'خطأ', description: 'فشل حفظ التخصيصات', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const addHashtag = () => {
    if (newHashtag.trim()) {
      const tag = newHashtag.trim().startsWith('#') ? newHashtag.trim() : `#${newHashtag.trim()}`;
      if (!hashtags.includes(tag)) {
        setHashtags([...hashtags, tag]);
      }
      setNewHashtag('');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          تخصيص المنتج
        </h2>
        <PremiumButton
          variant="success"
          size="md"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </PremiumButton>
      </div>

      {/* عرض الألوان والقياسات المتاحة من النظام */}
      <Card className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-2 border-blue-200 dark:border-blue-800">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Package className="h-4 w-4" />
          المتاح من النظام ({product?.name})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* الألوان المتاحة */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">الألوان المتاحة:</p>
            <div className="flex flex-wrap gap-2">
              {availableColors.length > 0 ? availableColors.map(([name, { count, hex }]) => (
                <span 
                  key={name} 
                  className="text-xs px-2 py-1 rounded-full flex items-center gap-1.5 border"
                  style={{ backgroundColor: hex ? `${hex}15` : '#f0f0f0' }}
                >
                  <span 
                    className="w-3 h-3 rounded-full border"
                    style={{ backgroundColor: hex || '#ccc' }}
                  />
                  {name} <Badge variant="secondary" className="text-[10px] px-1">{count}</Badge>
                </span>
              )) : <span className="text-xs text-muted-foreground">لا توجد ألوان</span>}
            </div>
          </div>
          {/* القياسات المتاحة */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">القياسات المتاحة:</p>
            <div className="flex flex-wrap gap-2">
              {availableSizes.length > 0 ? availableSizes.map(([name, count]) => (
                <span key={name} className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                  {name} <Badge variant="secondary" className="text-[10px] px-1">{count}</Badge>
                </span>
              )) : <span className="text-xs text-muted-foreground">لا توجد قياسات</span>}
            </div>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="description" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="description">الوصف</TabsTrigger>
          <TabsTrigger value="hashtags">الهاشتاقات</TabsTrigger>
          <TabsTrigger value="discount">الخصم</TabsTrigger>
          <TabsTrigger value="colors">الألوان</TabsTrigger>
          <TabsTrigger value="sizes">القياسات</TabsTrigger>
          {canUploadImages && <TabsTrigger value="images">الصور</TabsTrigger>}
        </TabsList>

        <TabsContent value="description" className="mt-6">
          <Card className="p-6">
            <Label htmlFor="description">وصف مخصص للمنتج</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="أضف وصفاً مخصصاً يميز منتجك..."
              className="mt-2 min-h-[200px]"
            />
          </Card>
        </TabsContent>

        {/* تاب الهاشتاقات الجديد */}
        <TabsContent value="hashtags" className="mt-6">
          <Card className="p-6 space-y-4">
            <div>
              <Label>هاشتاقات المنتج</Label>
              <p className="text-xs text-muted-foreground mt-1">
                أضف هاشتاقات لتسهيل البحث والتصنيف
              </p>
            </div>
            
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Hash className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="أضف هاشتاق جديد..."
                  value={newHashtag}
                  onChange={(e) => setNewHashtag(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addHashtag();
                    }
                  }}
                  className="pr-10"
                />
              </div>
              <Button 
                variant="outline"
                onClick={addHashtag}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {hashtags.map((tag, idx) => (
                <Badge 
                  key={idx} 
                  className="px-3 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white cursor-pointer hover:opacity-80"
                >
                  {tag}
                  <X 
                    className="h-3 w-3 mr-2 cursor-pointer hover:text-red-200" 
                    onClick={() => setHashtags(hashtags.filter((_, i) => i !== idx))}
                  />
                </Badge>
              ))}
              {hashtags.length === 0 && (
                <p className="text-sm text-muted-foreground">لم تتم إضافة هاشتاقات بعد</p>
              )}
            </div>

            {/* اقتراحات هاشتاقات */}
            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-2">اقتراحات:</p>
              <div className="flex flex-wrap gap-2">
                {['#جديد', '#عرض', '#خصم', '#حصري', '#محدود', '#أفضل_سعر'].map(tag => (
                  <Badge 
                    key={tag}
                    variant="outline"
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                    onClick={() => {
                      if (!hashtags.includes(tag)) {
                        setHashtags([...hashtags, tag]);
                      }
                    }}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="discount" className="mt-6">
          <Card className="p-6 space-y-4">
            <div>
              <Label htmlFor="discount">نسبة الخصم (%)</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="discount"
                  type="number"
                  min="0"
                  max="100"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="flex-1"
                />
                <Badge className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-4">
                  <Percent className="h-4 w-4 ml-1" />
                  {discount}%
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start_date">تاريخ البداية</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="end_date">تاريخ الانتهاء</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-2"
                />
              </div>
            </div>

            {discount > 0 && product.variants?.[0]?.price && (
              <div className="p-4 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-950/20 dark:to-pink-950/20 rounded-xl border-2 border-red-200 dark:border-red-800">
                <p className="text-sm font-semibold mb-2">معاينة السعر:</p>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">
                    {(product.variants[0].price * (1 - discount / 100)).toLocaleString('ar-IQ')} IQD
                  </span>
                  <span className="text-lg text-muted-foreground line-through">
                    {product.variants[0].price?.toLocaleString('ar-IQ')} IQD
                  </span>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="colors" className="mt-6">
          <Card className="p-6 space-y-4">
            <div>
              <Label>ألوان إضافية مخصصة</Label>
              <p className="text-xs text-muted-foreground mt-1">
                أضف ألوان تريد عرضها إضافة للألوان المتاحة من النظام
              </p>
            </div>
            
            <div className="flex gap-2">
              <Input
                placeholder="أضف لون جديد..."
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && newColor.trim()) {
                    setCustomColors([...customColors, newColor.trim()]);
                    setNewColor('');
                  }
                }}
              />
              <Button 
                variant="outline"
                onClick={() => {
                  if (newColor.trim()) {
                    setCustomColors([...customColors, newColor.trim()]);
                    setNewColor('');
                  }
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {customColors.map((color, idx) => (
                <Badge key={idx} className="px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                  {color}
                  <X 
                    className="h-3 w-3 mr-2 cursor-pointer hover:text-red-200" 
                    onClick={() => setCustomColors(customColors.filter((_, i) => i !== idx))}
                  />
                </Badge>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="sizes" className="mt-6">
          <Card className="p-6 space-y-4">
            <div>
              <Label>قياسات إضافية مخصصة</Label>
              <p className="text-xs text-muted-foreground mt-1">
                أضف قياسات تريد عرضها إضافة للقياسات المتاحة من النظام
              </p>
            </div>
            
            <div className="flex gap-2">
              <Input
                placeholder="أضف قياس جديد..."
                value={newSize}
                onChange={(e) => setNewSize(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && newSize.trim()) {
                    setCustomSizes([...customSizes, newSize.trim()]);
                    setNewSize('');
                  }
                }}
              />
              <Button 
                variant="outline"
                onClick={() => {
                  if (newSize.trim()) {
                    setCustomSizes([...customSizes, newSize.trim()]);
                    setNewSize('');
                  }
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {customSizes.map((size, idx) => (
                <Badge key={idx} className="px-3 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white">
                  {size}
                  <X 
                    className="h-3 w-3 mr-2 cursor-pointer hover:text-red-200" 
                    onClick={() => setCustomSizes(customSizes.filter((_, i) => i !== idx))}
                  />
                </Badge>
              ))}
            </div>
          </Card>
        </TabsContent>

        {canUploadImages && (
          <TabsContent value="images" className="mt-6">
            <Card className="p-6 space-y-4">
              <div>
                <Label htmlFor="image_upload">رفع صور إضافية</Label>
                <Input
                  id="image_upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploading}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  الحد الأقصى: 5MB | الأنواع المدعومة: JPG, PNG, WebP
                </p>
              </div>

              {customImages.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {customImages.map((img, idx) => (
                    <div key={idx} className="relative group">
                      <img 
                        src={img} 
                        alt={`صورة ${idx + 1}`}
                        className="w-full h-32 object-cover rounded-lg border-2 border-gray-200 dark:border-gray-700" 
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setCustomImages(customImages.filter((_, i) => i !== idx))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

// Need to import Package icon
import { Package } from 'lucide-react';

export default ProductCustomizationPanel;