import React, { useState, useMemo, useEffect } from 'react';
import { useVariants } from '@/contexts/VariantsContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { ChevronsUpDown, PlusCircle, Check, Building2 } from 'lucide-react';
import AddEditCategoryDialog from '@/components/manage-variants/AddEditCategoryDialog';
import AddEditDepartmentDialog from '@/components/manage-variants/AddEditDepartmentDialog';
import { cn } from "@/lib/utils";
import { supabase } from '@/lib/customSupabaseClient';

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

const CreatableDepartmentSelect = ({ value, onChange, onDepartmentCreated }) => {
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    const fetchDepartments = async () => {
      const { data } = await supabase
        .from('departments')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      setDepartments(data || []);
    };
    fetchDepartments();
  }, []);

  const selectedDepartment = departments.find(d => d.name === value);

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
            {selectedDepartment ? (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                {selectedDepartment.name}
              </div>
            ) : (
              'اختر القسم الرئيسي...'
            )}
            <ChevronsUpDown className="mr-auto h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput placeholder="بحث..." />
            <CommandList>
              <CommandEmpty className="p-2 text-sm text-center">
                <p>لا توجد أقسام.</p>
                <Button variant="link" onClick={handleCreateNew}>
                  <PlusCircle className="w-4 h-4 ml-2" />
                  إضافة قسم جديد
                </Button>
              </CommandEmpty>
              <CommandGroup>
                {departments.map((department) => (
                  <div
                    key={department.id}
                    onClick={() => handleSelect(department.name)}
                    className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                  >
                    <Check className={cn("ml-2 h-4 w-4", value === department.name ? "opacity-100" : "opacity-0")} />
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      {department.name}
                    </div>
                  </div>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <AddEditDepartmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={(newDepartment) => {
          setDepartments(prev => [...prev, newDepartment]);
          onChange(newDepartment.name);
          onDepartmentCreated(newDepartment);
        }}
      />
    </>
  );
};

const NewProductCategorization = ({ selectedCategories, setSelectedCategories }) => {
  const { categories } = useVariants();

  const categoryTypes = [
    { id: 'main_category', label: 'التصنيف الرئيسي' },
    { id: 'product_type', label: 'نوع المنتج' },
    { id: 'season_occasion', label: 'الموسم/المناسبة' }
  ];

  const handleCategoryCreated = (newCategory) => {
    // This function is mostly to refresh data, which is handled by context
  };

  const handleDepartmentCreated = (newDepartment) => {
    // This function is mostly to refresh data
  };

  return (
    <Card>
      <CardHeader><CardTitle>التصنيفات والأقسام</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {/* القسم الرئيسي */}
        <div>
          <Label>القسم الرئيسي</Label>
          <CreatableDepartmentSelect
            value={selectedCategories.department}
            onChange={value => setSelectedCategories(prev => ({ ...prev, department: value }))}
            onDepartmentCreated={handleDepartmentCreated}
          />
        </div>
        
        {/* التصنيفات الفرعية */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        </div>
      </CardContent>
    </Card>
  );
};

export default NewProductCategorization;