import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { 
  Package, Shirt, ShoppingBag, Settings, Footprints, Gem, Baby, 
  Hammer, Palette, Monitor, Car, Home, Utensils, Gamepad2,
  Heart, Dumbbell, Book, Music, Camera, Scissors, Wrench,
  HardHat, Paintbrush, Laptop, Smartphone, Headphones
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';

const AddEditDepartmentDialog = ({ isOpen, onClose, department, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: 'Package',
    color: 'from-blue-500 to-blue-600',
    display_order: 1,
    is_active: true
  });
  const [loading, setLoading] = useState(false);
  // لا نحتاج لـ useToast هنا، نستخدم toast مباشرة

  // خيارات الأيقونات المتنوعة
  const iconOptions = [
    // الملابس والموضة
    { value: 'Shirt', label: 'ملابس رجالية', icon: Shirt },
    { value: 'ShoppingBag', label: 'حقائب نسائية', icon: ShoppingBag },
    { value: 'Baby', label: 'ملابس أطفال', icon: Baby },
    { value: 'Footprints', label: 'أحذية', icon: Footprints },
    { value: 'Gem', label: 'إكسسوارات ومجوهرات', icon: Gem },
    
    // مواد البناء والإنشاء
    { value: 'HardHat', label: 'مواد إنشائية', icon: HardHat },
    { value: 'Hammer', label: 'أدوات البناء', icon: Hammer },
    { value: 'Wrench', label: 'أدوات عامة', icon: Wrench },
    { value: 'Paintbrush', label: 'مواد الطلاء', icon: Paintbrush },
    
    // الإلكترونيات والأجهزة
    { value: 'Monitor', label: 'أجهزة إلكترونية', icon: Monitor },
    { value: 'Laptop', label: 'أجهزة حاسوب', icon: Laptop },
    { value: 'Smartphone', label: 'هواتف ذكية', icon: Smartphone },
    { value: 'Headphones', label: 'سماعات وصوتيات', icon: Headphones },
    { value: 'Camera', label: 'كاميرات ومعدات تصوير', icon: Camera },
    
    // الصحة والعناية
    { value: 'Heart', label: 'منتجات العناية بالبشرة', icon: Heart },
    { value: 'Scissors', label: 'أدوات تجميل', icon: Scissors },
    { value: 'Dumbbell', label: 'معدات رياضية', icon: Dumbbell },
    
    // المنزل والحديقة
    { value: 'Home', label: 'أدوات منزلية', icon: Home },
    { value: 'Utensils', label: 'أدوات مطبخ', icon: Utensils },
    { value: 'Palette', label: 'ديكور ومفروشات', icon: Palette },
    
    // السيارات والنقل
    { value: 'Car', label: 'قطع غيار السيارات', icon: Car },
    
    // الترفيه والهوايات
    { value: 'Gamepad2', label: 'ألعاب وترفيه', icon: Gamepad2 },
    { value: 'Book', label: 'كتب ومجلات', icon: Book },
    { value: 'Music', label: 'آلات موسيقية', icon: Music },
    
    // عام
    { value: 'Package', label: 'مواد عامة', icon: Package },
    { value: 'Settings', label: 'متنوع', icon: Settings }
  ];

  // خيارات الألوان
  const colorOptions = [
    { value: 'from-blue-500 to-blue-600', label: 'أزرق' },
    { value: 'from-green-500 to-green-600', label: 'أخضر' },
    { value: 'from-purple-500 to-purple-600', label: 'بنفسجي' },
    { value: 'from-red-500 to-red-600', label: 'أحمر' },
    { value: 'from-yellow-500 to-yellow-600', label: 'أصفر' },
    { value: 'from-pink-500 to-pink-600', label: 'وردي' },
    { value: 'from-indigo-500 to-indigo-600', label: 'نيلي' },
    { value: 'from-teal-500 to-teal-600', label: 'تركوازي' },
    { value: 'from-orange-500 to-orange-600', label: 'برتقالي' },
    { value: 'from-cyan-500 to-cyan-600', label: 'سماوي' },
    { value: 'from-gray-500 to-gray-600', label: 'رمادي' },
    { value: 'from-emerald-500 to-emerald-600', label: 'زمردي' }
  ];

  useEffect(() => {
    if (department) {
      setFormData({
        name: department.name || '',
        description: department.description || '',
        icon: department.icon || 'Package',
        color: department.color || 'from-blue-500 to-blue-600',
        display_order: department.display_order || 1,
        is_active: department.is_active !== false
      });
    } else {
      setFormData({
        name: '',
        description: '',
        icon: 'Package',
        color: 'from-blue-500 to-blue-600',
        display_order: 1,
        is_active: true
      });
    }
  }, [department, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال اسم القسم",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      const dataToSave = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        icon: formData.icon,
        color: formData.color,
        display_order: formData.display_order,
        is_active: formData.is_active
      };

      if (department) {
        // تحديث
        const { error } = await supabase
          .from('departments')
          .update(dataToSave)
          .eq('id', department.id);

        if (error) throw error;

        toast({
          title: "تم التحديث",
          description: "تم تحديث القسم بنجاح",
        });
      } else {
        // إضافة جديد
        const { error } = await supabase
          .from('departments')
          .insert([dataToSave]);

        if (error) throw error;

        toast({
          title: "تم الإنشاء",
          description: "تم إنشاء القسم بنجاح",
        });
      }

      onClose();
      if (onSuccess) onSuccess();
    } catch (error) {
      toast({
        title: "خطأ",
        description: department ? "فشل في تحديث القسم" : "فشل في إنشاء القسم",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const SelectedIcon = iconOptions.find(opt => opt.value === formData.icon)?.icon || Package;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>
            {department ? 'تعديل القسم' : 'إضافة قسم جديد'}
          </DialogTitle>
          <DialogDescription>
            {department ? 'قم بتعديل بيانات القسم' : 'أدخل بيانات القسم الجديد'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* اسم القسم */}
            <div className="space-y-2">
              <Label htmlFor="name">اسم القسم *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="مثل: قسم الملابس"
                required
              />
            </div>

            {/* ترتيب العرض */}
            <div className="space-y-2">
              <Label htmlFor="display_order">ترتيب العرض</Label>
              <Input
                id="display_order"
                type="number"
                min="1"
                value={formData.display_order}
                onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 1 })}
              />
            </div>
          </div>

          {/* الوصف */}
          <div className="space-y-2">
            <Label htmlFor="description">الوصف</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="وصف مختصر للقسم"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* الأيقونة */}
            <div className="space-y-2">
              <Label>الأيقونة</Label>
              <Select
                value={formData.icon}
                onValueChange={(value) => setFormData({ ...formData, icon: value })}
              >
                <SelectTrigger>
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <SelectedIcon className="h-4 w-4" />
                      {iconOptions.find(opt => opt.value === formData.icon)?.label}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {iconOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <option.icon className="h-4 w-4" />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* اللون */}
            <div className="space-y-2">
              <Label>لون القسم</Label>
              <Select
                value={formData.color}
                onValueChange={(value) => setFormData({ ...formData, color: value })}
              >
                <SelectTrigger>
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded bg-gradient-to-r ${formData.color}`}></div>
                      {colorOptions.find(opt => opt.value === formData.color)?.label}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {colorOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded bg-gradient-to-r ${option.value}`}></div>
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* حالة القسم */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <Label htmlFor="is_active">تفعيل القسم</Label>
              <p className="text-sm text-muted-foreground">
                {formData.is_active ? 'القسم مفعل ومرئي للمستخدمين' : 'القسم معطل وغير مرئي'}
              </p>
            </div>
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'جاري الحفظ...' : (department ? 'تحديث' : 'إنشاء')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddEditDepartmentDialog;