import React, { useState, useMemo } from 'react';
import { useVariants } from '@/contexts/VariantsContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { ChevronsUpDown, PlusCircle, Check } from 'lucide-react';
import AddEditCategoryDialog from '@/components/manage-variants/AddEditCategoryDialog';
import { cn } from "@/lib/utils";

const CreatableCategorySelect = ({ categoryType, value, onChange, categories, onCategoryCreated }) => {
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const filteredCategories = useMemo(() => 
    categories.filter(c => c.type === categoryType),
    [categories, categoryType]
  );

  const selectedCategoryName = value ? categories.find(c => c.name === value)?.name : 'اختر...';

  const handleCreateNew = () => {
    setOpen(false);
    setDialogOpen(true);
  };

  const handleSelect = (currentValue) => {
    onChange(currentValue);
    setOpen(false);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
            {selectedCategoryName}
            <ChevronsUpDown className="mr-auto h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput placeholder="بحث..." />
            <CommandList>
              <CommandEmpty className="p-2 text-sm text-center">
                <p>لا توجد نتائج.</p>
                <Button variant="link" onClick={handleCreateNew}>
                  <PlusCircle className="w-4 h-4 ml-2" />
                  إضافة تصنيف جديد
                </Button>
              </CommandEmpty>
              <CommandGroup>
                {filteredCategories.map((category) => (
                  <div
                    key={category.id}
                    onClick={() => handleSelect(category.name)}
                    className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                  >
                    <Check className={cn("ml-2 h-4 w-4", value === category.name ? "opacity-100" : "opacity-0")} />
                    {category.name}
                  </div>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <AddEditCategoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        categoryType={categoryType}
        onSuccess={(newCategory) => {
          onCategoryCreated(newCategory);
          onChange(newCategory.name);
        }}
      />
    </>
  );
};

const NewProductCategorization = ({ selectedCategories, setSelectedCategories }) => {
  const { categories } = useVariants();

  const categoryTypes = [
    { id: 'main_category', label: 'القسم الرئيسي' },
    { id: 'product_type', label: 'نوع المنتج' },
    { id: 'season_occasion', label: 'الموسم/المناسبة' }
  ];

  const handleCategoryCreated = (newCategory) => {
    // This function is mostly to refresh data, which is handled by context
  };

  return (
    <Card>
      <CardHeader><CardTitle>التصنيفات</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {categoryTypes.map(ct => (
          <div key={ct.id}>
            <Label>{ct.label}</Label>
            <CreatableCategorySelect
              categoryType={ct.id}
              value={selectedCategories[ct.id]}
              onChange={value => setSelectedCategories(prev => ({ ...prev, [ct.id]: value }))}
              categories={categories}
              onCategoryCreated={handleCategoryCreated}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default NewProductCategorization;