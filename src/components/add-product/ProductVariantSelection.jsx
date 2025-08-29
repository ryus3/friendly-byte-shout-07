import React, { useState } from 'react';
import { useVariants } from '@/contexts/VariantsContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandList } from '@/components/ui/command';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
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
          <MultiSelectDropdownColors
            items={colors}
            selectedItems={selectedColors}
            onToggle={(color) => {
              const isSelected = selectedColors.some(c => c.id === color.id);
              if (isSelected) {
                setSelectedColors(prev => prev.filter(c => c.id !== color.id));
              } else {
                setSelectedColors(prev => [...prev, color]);
              }
            }}
            placeholder="اختر الألوان..."
            onAddNew={() => setColorDialogOpen(true)}
            addNewText="إضافة لون جديد"
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

// MultiSelect Component for Colors
const MultiSelectDropdownColors = ({ items, selectedItems, onToggle, placeholder, onAddNew, addNewText }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-full justify-between h-auto min-h-[2.5rem] py-2"
        >
          <div className="flex flex-wrap gap-1 max-w-full">
            {selectedItems.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              selectedItems.map((item) => (
                <Badge key={item.id} variant="secondary" className="gap-1 flex items-center">
                  {item.hex_code && (
                    <div 
                      className="w-3 h-3 rounded-full border"
                      style={{ backgroundColor: item.hex_code }}
                    />
                  )}
                  {item.name}
                </Badge>
              ))
            )}
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 bg-background/95 backdrop-blur-sm border shadow-lg z-[9999]" align="start">
        <Command>
          <CommandInput 
            placeholder="البحث..." 
            value={search} 
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty className="p-4 text-center">
              <p className="text-sm text-muted-foreground mb-2">لا توجد نتائج.</p>
              <Button 
                size="sm" 
                onClick={() => {
                  onAddNew();
                  setOpen(false);
                }}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                {addNewText}
              </Button>
            </CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto bg-background">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onToggle(item)}
                  className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent/80 hover:text-accent-foreground transition-colors bg-background"
                >
                  <div className="flex items-center gap-2 flex-1">
                    {item.hex_code && (
                      <div 
                        className="w-4 h-4 rounded-full border"
                        style={{ backgroundColor: item.hex_code }}
                      />
                    )}
                    <span>{item.name}</span>
                  </div>
                  <Check
                    className={cn(
                      "h-4 w-4",
                      selectedItems.some(c => c.id === item.id) ? "opacity-100" : "opacity-0"
                    )}
                  />
                </div>
              ))}
              {filteredItems.length > 0 && (
                <div
                  onClick={() => {
                    onAddNew();
                    setOpen(false);
                  }}
                  className="flex items-center gap-2 cursor-pointer hover:bg-muted/80 border-t px-2 py-1.5 text-sm bg-background transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>{addNewText}</span>
                </div>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default ProductVariantSelection;