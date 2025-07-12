import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const AddEditDepartmentDialog = ({ open, onOpenChange, department, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: 'Package',
    color: 'from-blue-500 to-blue-600'
  });
  const [loading, setLoading] = useState(false);

  const iconOptions = [
    { value: 'Package', label: 'صندوق' },
    { value: 'Shirt', label: 'قميص' },
    { value: 'ShoppingBag', label: 'حقيبة تسوق' }
  ];

  const colorOptions = [
    { value: 'from-blue-500 to-blue-600', label: 'أزرق' },
    { value: 'from-green-500 to-green-600', label: 'أخضر' },
    { value: 'from-purple-500 to-purple-600', label: 'بنفسجي' },
    { value: 'from-red-500 to-red-600', label: 'أحمر' },
    { value: 'from-orange-500 to-orange-600', label: 'برتقالي' },
    { value: 'from-pink-500 to-pink-600', label: 'وردي' },
    { value: 'from-teal-500 to-teal-600', label: 'تيل' },
    { value: 'from-indigo-500 to-indigo-600', label: 'نيلي' }
  ];

  useEffect(() => {
    if (department) {
      setFormData({
        name: department.name || '',
        description: department.description || '',
        icon: department.icon || 'Package',
        color: department.color || 'from-blue-500 to-blue-600'
      });
    } else {
      setFormData({
        name: '',
        description: '',
        icon: 'Package',
        color: 'from-blue-500 to-blue-600'
      });
    }
  }, [department, open]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSelectChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: "خطأ", description: "الرجاء إدخال اسم القسم", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      if (department) {
        // Update existing department
        const { error } = await supabase
          .from('departments')
          .update({
            name: formData.name.trim(),
            description: formData.description.trim(),
            icon: formData.icon,
            color: formData.color,
            updated_at: new Date().toISOString()
          })
          .eq('id', department.id);

        if (error) throw error;
        toast({ title: "نجاح", description: "تم تحديث القسم بنجاح" });
      } else {
        // Create new department
        const { error } = await supabase
          .from('departments')
          .insert({
            name: formData.name.trim(),
            description: formData.description.trim(),
            icon: formData.icon,
            color: formData.color
          });

        if (error) throw error;
        toast({ title: "نجاح", description: "تم إضافة القسم بنجاح" });
      }

      onSave();
    } catch (error) {
      toast({ 
        title: "خطأ", 
        description: department ? "فشل في تحديث القسم" : "فشل في إضافة القسم", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{department ? 'تعديل القسم' : 'إضافة قسم جديد'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">اسم القسم</Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="مثال: قسم الملابس"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">الوصف</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="وصف القسم..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>الأيقونة</Label>
            <Select value={formData.icon} onValueChange={(value) => handleSelectChange('icon', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {iconOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>اللون</Label>
            <Select value={formData.color} onValueChange={(value) => handleSelectChange('color', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {colorOptions.map(option => (
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              {department ? 'تحديث' : 'إضافة'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddEditDepartmentDialog;