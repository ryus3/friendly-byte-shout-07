import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFiltersData } from '@/hooks/useFiltersData';
import { AddEditDepartmentDialog } from '@/components/manage-variants/AddEditDepartmentDialog';
import { AddEditCategoryDialog } from '@/components/manage-variants/AddEditCategoryDialog';
import { supabase } from '@/integrations/supabase/client';

// مكون منفصل لعرض العناصر المفقودة والبحث عنها
const MissingItemBadge = ({ itemId }) => {
  const [itemName, setItemName] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchItemName = async () => {
      try {
        setLoading(true);
        
        // البحث في جميع الجداول المختلفة
        const searches = await Promise.all([
          supabase.from('categories').select('name').eq('id', itemId).single(),
          supabase.from('departments').select('name').eq('id', itemId).single(), 
          supabase.from('product_types').select('name').eq('id', itemId).single(),
          supabase.from('seasons_occasions').select('name').eq('id', itemId).single()
        ]);

        // العثور على النتيجة الصحيحة
        const result = searches.find(s => s.data && !s.error);
        if (result?.data?.name) {
          setItemName(result.data.name);
        }
      } catch (error) {
        console.error('خطأ في جلب اسم العنصر:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchItemName();
  }, [itemId]);

  if (loading) {
    return (
      <Badge variant="outline" className="gap-1 bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800">
        <span className="text-xs">جاري التحميل...</span>
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="gap-1 bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
      <span className="text-xs">{itemName || `غير معروف: ${itemId.slice(0, 8)}`}</span>
    </Badge>
  );
};

const MultiSelectCategorization = ({ 
  selectedCategories = [],
  setSelectedCategories,
  selectedProductTypes = [],
  setSelectedProductTypes,
  selectedSeasonsOccasions = [],
  setSelectedSeasonsOccasions,
  selectedDepartments = [],
  setSelectedDepartments
}) => {
  const {
    categories,
    departments,
    productTypes,
    seasonsOccasions,
    loading,
    refreshFiltersData
  } = useFiltersData();
  
  // Dialog states
  const [departmentDialogOpen, setDepartmentDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [productTypeDialogOpen, setProductTypeDialogOpen] = useState(false);
  const [seasonOccasionDialogOpen, setSeasonOccasionDialogOpen] = useState(false);

  const handleCategoryToggle = (category) => {
    setSelectedCategories(prev => {
      const isSelected = prev.includes(category.id);
      if (isSelected) {
        return prev.filter(id => id !== category.id);
      } else {
        return [...prev, category.id];
      }
    });
  };

  const handleProductTypeToggle = (productType) => {
    setSelectedProductTypes(prev => {
      const isSelected = prev.includes(productType.id);
      if (isSelected) {
        return prev.filter(id => id !== productType.id);
      } else {
        return [...prev, productType.id];
      }
    });
  };

  const handleSeasonOccasionToggle = (seasonOccasion) => {
    setSelectedSeasonsOccasions(prev => {
      const isSelected = prev.includes(seasonOccasion.id);
      if (isSelected) {
        return prev.filter(id => id !== seasonOccasion.id);
      } else {
        return [...prev, seasonOccasion.id];
      }
    });
  };

  const handleDepartmentToggle = (department) => {
    setSelectedDepartments(prev => {
      const isSelected = prev.includes(department.id);
      if (isSelected) {
        return prev.filter(id => id !== department.id);
      } else {
        return [...prev, department.id];
      }
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>تصنيف المنتج</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="text-xs text-muted-foreground mt-2">جاري تحميل بيانات التصنيفات...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>تصنيف المنتج</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* الأقسام */}
        <div className="space-y-3">
          <label className="text-sm font-medium">الأقسام</label>
          <MultiSelectDropdown
            items={departments}
            selectedItems={selectedDepartments}
            onToggle={handleDepartmentToggle}
            placeholder="اختر الأقسام..."
            onAddNew={() => setDepartmentDialogOpen(true)}
            addNewText="إضافة قسم جديد"
          />
        </div>

        {/* التصنيفات الرئيسية */}
        <div className="space-y-3">
          <label className="text-sm font-medium">التصنيفات الرئيسية</label>
          <MultiSelectDropdown
            items={categories}
            selectedItems={selectedCategories}
            onToggle={handleCategoryToggle}
            placeholder="اختر التصنيفات..."
            onAddNew={() => setCategoryDialogOpen(true)}
            addNewText="إضافة تصنيف جديد"
          />
        </div>

        {/* أنواع المنتجات */}
        <div className="space-y-3">
          <label className="text-sm font-medium">أنواع المنتجات</label>
          <MultiSelectDropdown
            items={productTypes}
            selectedItems={selectedProductTypes}
            onToggle={handleProductTypeToggle}
            placeholder="اختر أنواع المنتجات..."
            onAddNew={() => setProductTypeDialogOpen(true)}
            addNewText="إضافة نوع جديد"
          />
        </div>

        {/* المواسم والمناسبات */}
        <div className="space-y-3">
          <label className="text-sm font-medium">المواسم والمناسبات</label>
          <MultiSelectDropdown
            items={seasonsOccasions}
            selectedItems={selectedSeasonsOccasions}
            onToggle={handleSeasonOccasionToggle}
            placeholder="اختر المواسم والمناسبات..."
            onAddNew={() => setSeasonOccasionDialogOpen(true)}
            addNewText="إضافة موسم/مناسبة جديدة"
            showType={true}
          />
        </div>

      </CardContent>

      {/* Dialogs for adding new items */}
      <AddEditDepartmentDialog
        open={departmentDialogOpen}
        onOpenChange={setDepartmentDialogOpen}
        department={null}
        onSuccess={() => {
          refreshFiltersData();
          setDepartmentDialogOpen(false);
        }}
      />

      <AddEditCategoryDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        category={null}
        onSuccess={() => {
          refreshFiltersData();
          setCategoryDialogOpen(false);
        }}
      />

      {/* Simple Product Type Dialog */}
      {productTypeDialogOpen && (
        <ProductTypeDialog
          open={productTypeDialogOpen}
          onOpenChange={setProductTypeDialogOpen}
          onSuccess={() => {
            refreshFiltersData();
            setProductTypeDialogOpen(false);
          }}
        />
      )}

      {/* Simple Season/Occasion Dialog */}
      {seasonOccasionDialogOpen && (
        <SeasonOccasionDialog
          open={seasonOccasionDialogOpen}
          onOpenChange={setSeasonOccasionDialogOpen}
          onSuccess={() => {
            refreshFiltersData();
            setSeasonOccasionDialogOpen(false);
          }}
        />
      )}
    </Card>
  );
};

// Reusable MultiSelect Dropdown Component
const MultiSelectDropdown = ({ items, selectedItems, onToggle, placeholder, onAddNew, addNewText, showType = false }) => {
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
              selectedItems.map((itemId) => {
                const item = items.find(i => i.id === itemId);
                if (!item) {
                  return <MissingItemBadge key={itemId} itemId={itemId} />;
                }
                return (
                  <Badge key={item.id} variant="secondary" className="gap-1">
                    {item.name}
                    {showType && item.type && (
                      <span className="text-xs opacity-70">
                        ({item.type === 'season' ? 'موسم' : 'مناسبة'})
                      </span>
                    )}
                  </Badge>
                );
              })
            )}
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 bg-background/95 backdrop-blur-sm border shadow-lg z-[1000]" align="start">
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
                <CommandItem
                  key={item.id}
                  onSelect={() => onToggle(item)}
                  className="flex items-center gap-2"
                >
                  <Check
                    className={cn(
                      "h-4 w-4",
                      selectedItems.includes(item.id) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span>{item.name}</span>
                  {showType && item.type && (
                    <Badge variant="outline" className="text-xs">
                      {item.type === 'season' ? 'موسم' : 'مناسبة'}
                    </Badge>
                  )}
                </CommandItem>
              ))}
              {filteredItems.length > 0 && (
                <CommandItem
                  onSelect={() => {
                    onAddNew();
                    setOpen(false);
                  }}
                  className="flex items-center gap-2 border-t"
                >
                  <Plus className="h-4 w-4" />
                  <span>{addNewText}</span>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

// Simple Dialog Components
const ProductTypeDialog = ({ open, onOpenChange, onSuccess }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('product_types')
        .insert({ name: name.trim(), description: description.trim() || null });
      
      if (error) throw error;
      
      setName('');
      setDescription('');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error adding product type:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg">
        <div className="flex flex-col space-y-1.5 text-center sm:text-left">
          <h2 className="text-lg font-semibold">إضافة نوع منتج جديد</h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">اسم نوع المنتج</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ادخل اسم نوع المنتج"
              className="w-full mt-1 px-3 py-2 border rounded-md"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">الوصف (اختياري)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ادخل وصف نوع المنتج"
              className="w-full mt-1 px-3 py-2 border rounded-md"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'جاري الحفظ...' : 'حفظ'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

const SeasonOccasionDialog = ({ open, onOpenChange, onSuccess }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState('season');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('seasons_occasions')
        .insert({ 
          name: name.trim(), 
          type,
          description: description.trim() || null 
        });
      
      if (error) throw error;
      
      setName('');
      setDescription('');
      setType('season');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error adding season/occasion:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg">
        <div className="flex flex-col space-y-1.5 text-center sm:text-left">
          <h2 className="text-lg font-semibold">إضافة موسم/مناسبة جديدة</h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">الاسم</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ادخل اسم الموسم أو المناسبة"
              className="w-full mt-1 px-3 py-2 border rounded-md"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">النوع</label>
            <select 
              value={type} 
              onChange={(e) => setType(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-md"
            >
              <option value="season">موسم</option>
              <option value="occasion">مناسبة</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">الوصف (اختياري)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ادخل الوصف"
              className="w-full mt-1 px-3 py-2 border rounded-md"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'جاري الحفظ...' : 'حفظ'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MultiSelectCategorization;