import React, { useState, useEffect } from 'react';
import { useVariants } from '@/contexts/VariantsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Star, Type, Hash } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const AddEditSizeDialog = ({ open, onOpenChange, size: initialSize, onSuccessfulSubmit, sizeType: initialSizeType }) => {
  const { addSize, updateSize } = useVariants();
  const [sizes, setSizes] = useState([]);
  const [currentValue, setCurrentValue] = useState('');
  const [currentType, setCurrentType] = useState('letter');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (initialSize) {
        setSizes([{ value: initialSize.name, type: initialSize.type }]);
        setCurrentType(initialSize.type);
      } else {
        setSizes([]);
        setCurrentValue('');
        setCurrentType(initialSizeType || 'letter');
      }
    }
  }, [initialSize, initialSizeType, open]);

  const handleAddSize = () => {
    if (currentValue.trim() === '') {
      toast({
        title: "خطأ",
        description: "يرجى إدخال قيمة للقياس.",
        variant: "destructive"
      });
      return;
    }
    setSizes([...sizes, { value: currentValue.trim(), type: currentType }]);
    setCurrentValue('');
  };

  const handleRemoveSize = (index) => {
    setSizes(sizes.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (onSuccessfulSubmit) {
        if (initialSize) { // Editing single size
            if (sizes.length === 0 || sizes[0].value.trim() === '') {
                toast({ title: "خطأ", description: "يرجى إدخال قيمة للقياس.", variant: "destructive" });
                setIsSubmitting(false);
                return;
            }
            await onSuccessfulSubmit({ name: sizes[0].value, type: sizes[0].type });
        } else { // Batch adding
            const finalSizes = [...sizes];
            if (currentValue.trim() !== '') {
                finalSizes.push({ value: currentValue.trim(), type: currentType });
            }
            if (finalSizes.length === 0) {
                toast({ title: "خطأ", description: "يرجى إضافة قياس واحد على الأقل.", variant: "destructive" });
                setIsSubmitting(false);
                return;
            }
            await onSuccessfulSubmit(finalSizes.map(s => ({ name: s.value, type: s.type })));
        }
    } else { // Old logic for direct context calls (can be removed if not used)
        if (initialSize) {
            const result = await updateSize(initialSize.id, { name: sizes[0].value, type: sizes[0].type });
            if (result.success) toast({ title: 'تم التعديل بنجاح' });
        } else {
            const promises = sizes.map(size => addSize({ name: size.value, type: size.type }));
            const results = await Promise.all(promises);
            if (results.every(r => r.success)) toast({ title: 'تمت إضافة القياسات بنجاح' });
        }
    }
    
    onOpenChange(false);
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialSize ? 'تعديل القياس' : 'إضافة قياسات جديدة'}</DialogTitle>
          <DialogDescription>
            {initialSize ? `أنت تقوم بتعديل القياس "${initialSize.name}".` : 'أدخل تفاصيل القياسات الجديدة.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="p-4 border rounded-lg space-y-4">
                <div>
                    <Label>نوع القياس</Label>
                    <RadioGroup value={currentType} onValueChange={(value) => setCurrentType(value)} className="grid grid-cols-3 gap-4 mt-2" disabled={!!initialSize}>
                        <div className="flex items-center space-x-2 space-x-reverse">
                            <RadioGroupItem value="free" id="r-free" />
                            <Label htmlFor="r-free" className="flex items-center gap-2">
                              <Star className="w-4 h-4 text-amber-500" />
                              مقاس حر
                            </Label>
                        </div>
                        <div className="flex items-center space-x-2 space-x-reverse">
                            <RadioGroupItem value="letter" id="r-letter" />
                            <Label htmlFor="r-letter" className="flex items-center gap-2">
                              <Type className="w-4 h-4 text-green-500" />
                              حرفي (S, M, XL)
                            </Label>
                        </div>
                        <div className="flex items-center space-x-2 space-x-reverse">
                            <RadioGroupItem value="number" id="r-number" />
                            <Label htmlFor="r-number" className="flex items-center gap-2">
                              <Hash className="w-4 h-4 text-blue-500" />
                              رقمي (38, 40, 42)
                            </Label>
                        </div>
                    </RadioGroup>
                </div>
              <div className="grid grid-cols-1">
                <div>
                  <Label htmlFor="value">القياس</Label>
                  <Input
                    id="value"
                    value={initialSize ? (sizes[0]?.value || '') : currentValue}
                    onChange={(e) => initialSize ? setSizes([{...sizes[0], value: e.target.value}]) : setCurrentValue(e.target.value)}
                    placeholder={currentType === 'free' ? "مثال: Free Size" : currentType === 'letter' ? "مثال: XL" : "مثال: 42"}
                  />
                </div>
              </div>
              {!initialSize && (
                <Button type="button" onClick={handleAddSize} className="w-full">
                  <Plus className="w-4 h-4 ml-2" />
                  إضافة قياس للقائمة
                </Button>
              )}
            </div>

            {!initialSize && sizes.length > 0 && (
              <div className="space-y-2">
                <Label>القياسات المضافة</Label>
                <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[40px]">
                  {sizes.map((s, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-2 text-base py-1 px-3">
                      {s.value}
                      <button type="button" onClick={() => handleRemoveSize(index)} className="rounded-full hover:bg-destructive/20 p-0.5">
                        <X className="w-3 h-3 text-destructive" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
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

export default AddEditSizeDialog;