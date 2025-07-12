import React, { useState } from 'react';
import { useVariants } from '@/contexts/VariantsContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, Plus } from 'lucide-react';
import NewCreatableMultiSelect from './NewCreatableMultiSelect';
import AddEditColorDialog from '@/components/manage-variants/AddEditColorDialog';

const ProductVariantSelection = ({
  selectedColors,
  setSelectedColors,
  sizeType,
  setSizeType,
  colorSizeTypes,
  setColorSizeTypes,
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

  const handleColorSizeTypeChange = (colorId, sizeType) => {
    setColorSizeTypes(prev => ({
      ...prev,
      [colorId]: sizeType
    }));
  };

  const addSizeToColor = (colorId, sizeType) => {
    setColorSizeTypes(prev => ({
      ...prev,
      [colorId]: prev[colorId] ? [...new Set([...prev[colorId], sizeType])] : [sizeType]
    }));
  };

  const removeSizeFromColor = (colorId, sizeType) => {
    setColorSizeTypes(prev => ({
      ...prev,
      [colorId]: prev[colorId]?.filter(type => type !== sizeType) || []
    }));
  };

  const sizeTypeOptions = [
    { value: 'letter', label: 'حرفية (S, M, L, XL...)' },
    { value: 'number', label: 'رقمية (38, 40, 42...)' },
    { value: 'free', label: 'فري سايز' }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>اختيار المتغيرات</CardTitle>
        <CardDescription>اختر الألوان وحدد أنواع القياسات لكل لون بشكل منفصل.</CardDescription>
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

        {/* نوع القياس العام */}
        <div className="space-y-4">
          <Label>نوع القياس الافتراضي</Label>
          <RadioGroup value={sizeType} onValueChange={setSizeType} className="grid grid-cols-3 gap-4">
            <div className="flex items-center space-x-2 space-x-reverse">
              <RadioGroupItem value="letter" id="s-letter" />
              <Label htmlFor="s-letter">حرفية (S, M, L...)</Label>
            </div>
            <div className="flex items-center space-x-2 space-x-reverse">
              <RadioGroupItem value="number" id="s-number" />
              <Label htmlFor="s-number">رقمية (38, 40...)</Label>
            </div>
            <div className="flex items-center space-x-2 space-x-reverse">
              <RadioGroupItem value="free" id="s-free" />
              <Label htmlFor="s-free">فري سايز</Label>
            </div>
          </RadioGroup>
        </div>

        {/* إعدادات القياسات لكل لون */}
        {selectedColors.length > 0 && (
          <div className="space-y-4">
            <Label className="text-lg font-semibold">إعدادات القياسات للألوان</Label>
            <div className="space-y-4">
              {selectedColors.map(color => (
                <Card key={color.id} className="p-4 bg-muted/30">
                  <div className="flex items-center gap-3 mb-3">
                    <div 
                      className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: color.hex_code || '#ccc' }}
                    />
                    <span className="font-medium">{color.name}</span>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Select onValueChange={(value) => addSizeToColor(color.id, value)}>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="إضافة نوع قياس" />
                        </SelectTrigger>
                        <SelectContent>
                          {sizeTypeOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addSizeToColor(color.id, sizeType)}
                      >
                        <Plus className="w-4 h-4 ml-1" />
                        إضافة النوع الافتراضي
                      </Button>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {(colorSizeTypes[color.id] || []).map(type => (
                        <Badge key={type} variant="secondary" className="flex items-center gap-1">
                          {sizeTypeOptions.find(opt => opt.value === type)?.label}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-auto p-0 w-4 h-4"
                            onClick={() => removeSizeFromColor(color.id, type)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </Badge>
                      ))}
                      {(!colorSizeTypes[color.id] || colorSizeTypes[color.id].length === 0) && (
                        <Badge variant="outline">سيتم استخدام النوع الافتراضي: {sizeTypeOptions.find(opt => opt.value === sizeType)?.label}</Badge>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
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