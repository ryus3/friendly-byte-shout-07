import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandList } from '@/components/ui/command';
import { Check, ChevronDown, Tag, Package, Calendar, Building2, Plus } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import AddEditDepartmentDialog from '@/components/manage-variants/AddEditDepartmentDialog';
import AddEditCategoryDialog from '@/components/manage-variants/AddEditCategoryDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFiltersData } from '@/hooks/useFiltersData';

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
  // استخدام النظام التوحيدي للمرشحات
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

  // البيانات تأتي من النظام التوحيدي

  // حالة تحميل البيانات المحسنة مع معالجة المنتجات بدون تصنيفات
  const [dataReady, setDataReady] = useState(false);
  const [showEmptyState, setShowEmptyState] = useState(false);
  
  // التحقق من جاهزية البيانات للعرض
  useEffect(() => {
    const hasBasicData = !loading && categories.length > 0 && departments.length > 0;
    
    if (hasBasicData) {
      setDataReady(true);
      
      // التحقق من وجود تصنيفات محددة للمنتج
      const hasSelectedData = selectedCategories?.length > 0 || 
                             selectedDepartments?.length > 0 || 
                             selectedProductTypes?.length > 0 || 
                             selectedSeasonsOccasions?.length > 0;
      
      // إذا لم تكن هناك تصنيفات محددة، اعرض حالة فارغة مع إمكانية الإضافة
      if (!hasSelectedData) {
        setShowEmptyState(true);
      }
    }
  }, [loading, categories, departments, productTypes, seasonsOccasions, selectedCategories, selectedDepartments, selectedProductTypes, selectedSeasonsOccasions]);

  // التحقق من وجود عناصر محددة وإظهارها حتى لو لم تكن الأسماء محملة
  const getSelectedDisplayItems = (selectedIds, items, label) => {
    if (!selectedIds || selectedIds.length === 0) return [];
    
    console.log(`🔍 فحص العناصر المحددة لـ ${label}:`, { selectedIds, items: items?.map(i => ({ id: i.id, name: i.name })) });
    
    return selectedIds.map(id => {
      const item = items.find(i => i.id === id);
      if (item) {
        console.log(`✅ تم العثور على ${label}:`, item.name);
        return { id, name: item.name, found: true };
      } else {
        console.warn(`⚠️ لم يتم العثور على ${label} بالمعرف:`, id);
        // عرض ID مؤقت حتى يتم تحميل الاسم
        return { id, name: `${label} (${id})`, found: false };
      }
    });
  };

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

  // Refresh data functions
  // دوال التحديث تستخدم النظام التوحيدي
  const refreshDepartments = () => {
    refreshFiltersData();
  };

  const refreshCategories = () => {
    refreshFiltersData();
  };

  const refreshProductTypes = () => {
    refreshFiltersData();
  };

  const refreshSeasonsOccasions = () => {
    refreshFiltersData();
  };

  // Handle new item creation
  const handleDepartmentSuccess = async () => {
    await refreshDepartments();
    toast({
      title: 'نجاح',
      description: 'تم إضافة القسم بنجاح',
      variant: 'success'
    });
  };

  const handleCategorySuccess = async () => {
    await refreshCategories();
    toast({
      title: 'نجاح', 
      description: 'تم إضافة التصنيف بنجاح',
      variant: 'success'
    });
  };

  if (loading || !dataReady) {
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

  // التحقق إذا كانت هناك تصنيفات محددة لإخفاء الحالة الفارغة
  const hasAnySelections = selectedCategories?.length > 0 || 
                           selectedDepartments?.length > 0 || 
                           selectedProductTypes?.length > 0 || 
                           selectedSeasonsOccasions?.length > 0;

  // إخفاء الحالة الفارغة إذا تم تحديد أي تصنيفات
  useEffect(() => {
    if (hasAnySelections) {
      setShowEmptyState(false);
    }
  }, [hasAnySelections]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="h-5 w-5" />
          تصنيف المنتج
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* الأقسام */}
        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            الأقسام
          </Label>
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
          <Label className="text-sm font-medium flex items-center gap-2">
            <Tag className="h-4 w-4" />
            التصنيفات الرئيسية
          </Label>
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
          <Label className="text-sm font-medium flex items-center gap-2">
            <Package className="h-4 w-4" />
            أنواع المنتجات
          </Label>
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
          <Label className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            المواسم والمناسبات
          </Label>
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
        onSuccess={handleDepartmentSuccess}
      />

      <AddEditCategoryDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        category={null}
        onSuccess={handleCategorySuccess}
      />

      {/* Simple Product Type Dialog */}
      {productTypeDialogOpen && (
        <ProductTypeDialog
          open={productTypeDialogOpen}
          onOpenChange={setProductTypeDialogOpen}
          onSuccess={refreshProductTypes}
        />
      )}

      {/* Simple Season/Occasion Dialog */}
      {seasonOccasionDialogOpen && (
        <SeasonOccasionDialog
          open={seasonOccasionDialogOpen}
          onOpenChange={setSeasonOccasionDialogOpen}
          onSuccess={refreshSeasonsOccasions}
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
                  // عرض معرف مؤقت مع تصميم مميز
                  return (
                    <Badge key={itemId} variant="outline" className="gap-1 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                      <span className="text-xs">ID: {itemId}</span>
                    </Badge>
                  );
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
                <div
                  key={item.id}
                  onClick={() => onToggle(item)}
                  className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent/80 hover:text-accent-foreground transition-colors bg-background"
                >
                  <div className="flex items-center gap-2 flex-1">
                    <span>{item.name}</span>
                    {showType && item.type && (
                      <Badge variant="outline" className="text-xs">
                        {item.type === 'season' ? 'موسم' : 'مناسبة'}
                      </Badge>
                    )}
                  </div>
                  <Check
                    className={cn(
                      "h-4 w-4",
                      selectedItems.includes(item.id) ? "opacity-100" : "opacity-0"
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
      
      toast({
        title: 'نجاح',
        description: 'تم إضافة نوع المنتج بنجاح',
        variant: 'success'
      });
      
      setName('');
      setDescription('');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'خطأ',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>إضافة نوع منتج جديد</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">اسم نوع المنتج</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ادخل اسم نوع المنتج"
              required
            />
          </div>
          <div>
            <Label htmlFor="description">الوصف (اختياري)</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ادخل وصف نوع المنتج"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'جاري الحفظ...' : 'حفظ'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
      
      toast({
        title: 'نجاح',
        description: 'تم إضافة الموسم/المناسبة بنجاح',
        variant: 'success'
      });
      
      setName('');
      setDescription('');
      setType('season');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'خطأ',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>إضافة موسم/مناسبة جديدة</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">الاسم</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ادخل اسم الموسم أو المناسبة"
              required
            />
          </div>
          <div>
            <Label htmlFor="type">النوع</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="season">موسم</SelectItem>
                <SelectItem value="occasion">مناسبة</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="description">الوصف (اختياري)</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ادخل الوصف"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'جاري الحفظ...' : 'حفظ'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default MultiSelectCategorization;