import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';

function intelligentStringToColor(str) {
  const nameLower = str.toLowerCase().trim();
  const colorMap = {
      'احمر': '#ff0000', 'أحمر': '#ff0000', 'red': '#ff0000',
      'ازرق': '#0000ff', 'أزرق': '#0000ff', 'blue': '#0000ff',
      'اخضر': '#008000', 'أخضر': '#008000', 'green': '#008000',
      'اصفر': '#ffff00', 'أصفر': '#ffff00', 'yellow': '#ffff00',
      'برتقالي': '#ffa500', 'orange': '#ffa500',
      'وردي': '#ffc0cb', 'pink': '#ffc0cb',
      'بنفسجي': '#800080', 'purple': '#800080',
      'بني': '#a52a2a', 'brown': '#a52a2a',
      'اسود': '#000000', 'أسود': '#000000', 'black': '#000000',
      'ابيض': '#ffffff', 'أبيض': '#ffffff', 'white': '#ffffff',
      'رمادي': '#808080', 'gray': '#808080',
      'رصاصي': '#808080', 'grey': '#808080',
      'بيج': '#f5f5dc', 'beige': '#f5f5dc',
      'زيتوني': '#808000', 'olive': '#808000',
      'نيلي': '#4682b4', 'steel blue': '#4682b4',
      'ماروني': '#800000', 'maroon': '#800000',
      'ذهبي': '#ffd700', 'gold': '#ffd700',
      'فضي': '#c0c0c0', 'silver': '#c0c0c0',
  };
  if (colorMap[nameLower]) {
      return colorMap[nameLower];
  }
  let hash = 0;
  if (str.length === 0) return '#000000';
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  let color = '#';
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xFF;
    color += ('00' + value.toString(16)).substr(-2);
  }
  return color;
}

const AddEditColorDialog = ({ open, onOpenChange, color: initialColor, onSuccess, initialName = '' }) => {
  const [name, setName] = useState('');
  const [hexCode, setHexCode] = useState('#000000');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (initialColor) {
        setName(initialColor.name);
        setHexCode(initialColor.hex_code);
      } else {
        setName(initialName);
        setHexCode(intelligentStringToColor(initialName));
      }
    }
  }, [initialColor, open, initialName]);

  const handleNameChange = (newName) => {
    setName(newName);
    if (!initialColor) { // Only auto-update color for new entries
        setHexCode(intelligentStringToColor(newName));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: "خطأ", description: "اسم اللون مطلوب.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    
    const success = await onSuccess({ name, hex_code: hexCode });
    
    if (success) {
      toast({ title: 'تم الحفظ بنجاح' });
      onOpenChange(false);
    } else {
      toast({ title: 'فشل الحفظ', description: 'حدث خطأ أثناء حفظ اللون.', variant: 'destructive' });
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialColor ? 'تعديل اللون' : 'إضافة لون جديد'}</DialogTitle>
          <DialogDescription>
            {initialColor ? `أنت تقوم بتعديل اللون "${initialColor.name}".` : 'أدخل تفاصيل اللون الجديد.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="p-4 border rounded-lg space-y-3">
              <div className="grid grid-cols-3 items-end gap-3">
                <div className="col-span-2">
                  <Label htmlFor="color-name">اسم اللون</Label>
                  <Input
                    id="color-name"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="color-hex">اللون</Label>
                  <Input
                    id="color-hex"
                    type="color"
                    value={hexCode}
                    onChange={(e) => setHexCode(e.target.value)}
                    className="p-1 h-10 w-full"
                  />
                </div>
              </div>
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

export default AddEditColorDialog;