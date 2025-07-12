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
  const { addColor, colors } = useVariants();
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
            <div className="flex items-center space-x-2 space-x-reverse"><RadioGroupItem value="letter" id="s-letter" /><Label htmlFor="s-letter">حرفية (S, M, L...)</Label></div>
            <div className="flex items-center space-x-2 space-x-reverse"><RadioGroupItem value="number" id="s-number" /><Label htmlFor="s-number">رقمية (38, 40...)</Label></div>
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