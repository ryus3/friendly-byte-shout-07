import React, { useState } from 'react';
import { useVariants } from '@/contexts/VariantsContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import NewCreatableMultiSelect from './NewCreatableMultiSelect';
import AddEditColorDialog from '@/components/manage-variants/AddEditColorDialog';

const ProductVariantSelection = ({
  selectedColors,
  setSelectedColors,
  sizeType,
  setSizeType,
}) => {
  const { addColor, colors, sizes } = useVariants();
  const [colorDialogOpen, setColorDialogOpen] = useState(false);

  const handleCreateColor = async (newColorData) => {
    const result = await addColor(newColorData);
    if (result.success && result.data) {
      setSelectedColors(prev => [...prev, result.data]);
      return true; 
    }
    return false;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>اختيار المتغيرات</CardTitle>
        <CardDescription>سيتم توليد المتغيرات تلقائياً عند اختيار الألوان ونوع القياس.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>الألوان</Label>
          <NewCreatableMultiSelect
            items={colors}
            selectedItems={selectedColors}
            onSelect={setSelectedColors}
            title="لون"
            itemLabel="name"
            onCreateNew={(name) => setColorDialogOpen(true)}
          />
        </div>
        <div className="space-y-4">
          <Label>القياسات</Label>
          <RadioGroup value={sizeType} onValueChange={setSizeType} className="flex gap-4">
            {[...new Set(sizes.filter(s => s.name !== 'فري سايز' && s.name !== 'Free Size').map(s => s.type))].map(type => (
              <div key={type} className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value={type} id={`s-${type}`} />
                <Label htmlFor={`s-${type}`}>
                  {type === 'letter' ? 'حرفية (S, M, L...)' : 
                   type === 'number' ? 'رقمية (38, 40...)' : 
                   type === 'shoe' ? 'أحذية' : 
                   type === 'baby' ? 'أطفال' : type}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      </CardContent>
      <AddEditColorDialog
        open={colorDialogOpen}
        onOpenChange={setColorDialogOpen}
        onSuccess={handleCreateColor}
      />
    </Card>
  );
};

export default ProductVariantSelection;