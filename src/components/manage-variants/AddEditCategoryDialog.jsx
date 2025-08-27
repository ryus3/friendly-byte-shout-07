import React, { useState, useEffect } from 'react';
import { useVariants } from '@/contexts/VariantsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';

const AddEditCategoryDialog = ({ open, onOpenChange, category, categoryType, onSuccess }) => {
  const { addCategory, updateCategory } = useVariants();
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (category) {
        setName(category.name);
      } else {
        setName('');
      }
    }
  }, [category, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: "خطأ", description: "الاسم مطلوب.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const data = { name, type: categoryType || 'main' };
    let result;
    if (category) {
      result = await updateCategory(category.id, data);
    } else {
      result = await addCategory(data);
    }
    if (result.success) {
      toast({ title: category ? 'تم التحديث بنجاح' : 'تمت الإضافة بنجاح' });
      if (onSuccess) {
        onSuccess(result.data);
      }
      onOpenChange(false);
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? 'تعديل التصنيف' : 'إضافة تصنيف جديد'}</DialogTitle>
          <DialogDescription>
            {category ? `أنت تقوم بتعديل التصنيف "${category.name}".` : 'أدخل اسم التصنيف الجديد.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                الاسم
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="col-span-3"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'جاري الحفظ...' : 'حفظ'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddEditCategoryDialog;