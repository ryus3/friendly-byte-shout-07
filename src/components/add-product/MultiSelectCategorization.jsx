import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Check, ChevronDown, Tag, Package, Calendar, Building2, Plus } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import AddEditDepartmentDialog from '@/components/manage-variants/AddEditDepartmentDialog';
import AddEditCategoryDialog from '@/components/manage-variants/AddEditCategoryDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  const [categories, setCategories] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [seasonsOccasions, setSeasonsOccasions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [departmentDialogOpen, setDepartmentDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [productTypeDialogOpen, setProductTypeDialogOpen] = useState(false);
  const [seasonOccasionDialogOpen, setSeasonOccasionDialogOpen] = useState(false);

  // جلب البيانات من قاعدة البيانات
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [categoriesRes, productTypesRes, seasonsOccasionsRes, departmentsRes] = await Promise.all([
          supabase.from('categories').select('*').order('name'),
          supabase.from('product_types').select('*').order('name'),
          supabase.from('seasons_occasions').select('*').order('name'),
          supabase.from('departments').select('*').eq('is_active', true).order('display_order')
        ]);

        setCategories(categoriesRes.data || []);
        setProductTypes(productTypesRes.data || []);
        setSeasonsOccasions(seasonsOccasionsRes.data || []);
        setDepartments(departmentsRes.data || []);
      } catch (error) {
        console.error('خطأ في جلب البيانات:', error);
        toast({
          title: 'خطأ',
          description: 'فشل في تحميل بيانات التصنيفات',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleCategoryToggle = (category) => {
    setSelectedCategories(prev => {
      const isSelected = prev.some(c => c.id === category.id);
      if (isSelected) {
        return prev.filter(c => c.id !== category.id);
      } else {
        return [...prev, category];
      }
    });
  };

  const handleProductTypeToggle = (productType) => {
    setSelectedProductTypes(prev => {
      const isSelected = prev.some(pt => pt.id === productType.id);
      if (isSelected) {
        return prev.filter(pt => pt.id !== productType.id);
      } else {
        return [...prev, productType];
      }
    });
  };

  const handleSeasonOccasionToggle = (seasonOccasion) => {
    setSelectedSeasonsOccasions(prev => {
      const isSelected = prev.some(so => so.id === seasonOccasion.id);
      if (isSelected) {
        return prev.filter(so => so.id !== seasonOccasion.id);
      } else {
        return [...prev, seasonOccasion];
      }
    });
  };

  const handleDepartmentToggle = (department) => {
    setSelectedDepartments(prev => {
      const isSelected = prev.some(d => d.id === department.id);
      if (isSelected) {
        return prev.filter(d => d.id !== department.id);
      } else {
        return [...prev, department];
      }
    });
  };

  // Refresh data functions
  const refreshDepartments = async () => {
    try {
      const { data } = await supabase.from('departments').select('*').eq('is_active', true).order('display_order');
      setDepartments(data || []);
    } catch (error) {
      console.error('خطأ في تحديث الأقسام:', error);
    }
  };

  const refreshCategories = async () => {
    try {
      const { data } = await supabase.from('categories').select('*').order('name');
      setCategories(data || []);
    } catch (error) {
      console.error('خطأ في تحديث التصنيفات:', error);
    }
  };

  const refreshProductTypes = async () => {
    try {
      const { data } = await supabase.from('product_types').select('*').order('name');
      setProductTypes(data || []);
    } catch (error) {
      console.error('خطأ في تحديث أنواع المنتجات:', error);
    }
  };

  const refreshSeasonsOccasions = async () => {
    try {
      const { data } = await supabase.from('seasons_occasions').select('*').order('name');
      setSeasonsOccasions(data || []);
    } catch (error) {
      console.error('خطأ في تحديث المواسم والمناسبات:', error);
    }
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
          </div>
        </CardContent>
      </Card>
    );
  }

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
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-full justify-between h-auto min-h-[2.5rem] py-2"
              >
                <div className="flex flex-wrap gap-1 max-w-full">
                  {selectedDepartments.length === 0 ? (
                    <span className="text-muted-foreground">اختر الأقسام...</span>
                  ) : (
                    selectedDepartments.map((department) => (
                      <Badge key={department.id} variant="secondary" className="gap-1">
                        {department.name}
                      </Badge>
                    ))
                  )}
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0 bg-background border shadow-lg z-50" align="start">
              <Command>
                <CommandInput placeholder="البحث في الأقسام..." />
                <CommandEmpty>
                  <div className="p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-2">لا توجد أقسام.</p>
                    <Button 
                      size="sm" 
                      onClick={() => setDepartmentDialogOpen(true)}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      إضافة قسم جديد
                    </Button>
                  </div>
                </CommandEmpty>
                <CommandGroup className="max-h-64 overflow-auto">
                  {departments.map((department) => (
                    <CommandItem
                      key={department.id}
                      value={department.name}
                      onSelect={() => handleDepartmentToggle(department)}
                      className="flex items-center justify-between cursor-pointer hover:bg-muted"
                    >
                      <span>{department.name}</span>
                      <Check
                        className={cn(
                          "h-4 w-4",
                          selectedDepartments.some(d => d.id === department.id) ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  ))}
                  {departments.length > 0 && (
                    <CommandItem
                      onSelect={() => setDepartmentDialogOpen(true)}
                      className="flex items-center gap-2 cursor-pointer hover:bg-muted border-t"
                    >
                      <Plus className="h-4 w-4" />
                      <span>إضافة قسم جديد</span>
                    </CommandItem>
                  )}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* التصنيفات الرئيسية */}
        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Tag className="h-4 w-4" />
            التصنيفات الرئيسية
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-full justify-between h-auto min-h-[2.5rem] py-2"
              >
                <div className="flex flex-wrap gap-1 max-w-full">
                  {selectedCategories.length === 0 ? (
                    <span className="text-muted-foreground">اختر التصنيفات...</span>
                  ) : (
                    selectedCategories.map((category) => (
                      <Badge key={category.id} variant="secondary" className="gap-1">
                        {category.name}
                      </Badge>
                    ))
                  )}
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0 bg-background border shadow-lg z-50" align="start">
              <Command>
                <CommandInput placeholder="البحث في التصنيفات..." />
                <CommandEmpty>
                  <div className="p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-2">لا توجد تصنيفات.</p>
                    <Button 
                      size="sm" 
                      onClick={() => setCategoryDialogOpen(true)}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      إضافة تصنيف جديد
                    </Button>
                  </div>
                </CommandEmpty>
                <CommandGroup className="max-h-64 overflow-auto">
                  {categories.map((category) => (
                    <CommandItem
                      key={category.id}
                      value={category.name}
                      onSelect={() => handleCategoryToggle(category)}
                      className="flex items-center justify-between cursor-pointer hover:bg-muted"
                    >
                      <span>{category.name}</span>
                      <Check
                        className={cn(
                          "h-4 w-4",
                          selectedCategories.some(c => c.id === category.id) ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  ))}
                  {categories.length > 0 && (
                    <CommandItem
                      onSelect={() => setCategoryDialogOpen(true)}
                      className="flex items-center gap-2 cursor-pointer hover:bg-muted border-t"
                    >
                      <Plus className="h-4 w-4" />
                      <span>إضافة تصنيف جديد</span>
                    </CommandItem>
                  )}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* أنواع المنتجات */}
        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Package className="h-4 w-4" />
            أنواع المنتجات
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-full justify-between h-auto min-h-[2.5rem] py-2"
              >
                <div className="flex flex-wrap gap-1 max-w-full">
                  {selectedProductTypes.length === 0 ? (
                    <span className="text-muted-foreground">اختر أنواع المنتجات...</span>
                  ) : (
                    selectedProductTypes.map((productType) => (
                      <Badge key={productType.id} variant="secondary" className="gap-1">
                        {productType.name}
                      </Badge>
                    ))
                  )}
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0 bg-background border shadow-lg z-50" align="start">
              <Command>
                <CommandInput placeholder="البحث في أنواع المنتجات..." />
                <CommandEmpty>
                  <div className="p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-2">لا توجد أنواع منتجات.</p>
                    <Button 
                      size="sm" 
                      onClick={() => setProductTypeDialogOpen(true)}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      إضافة نوع جديد
                    </Button>
                  </div>
                </CommandEmpty>
                <CommandGroup className="max-h-64 overflow-auto">
                  {productTypes.map((productType) => (
                    <CommandItem
                      key={productType.id}
                      value={productType.name}
                      onSelect={() => handleProductTypeToggle(productType)}
                      className="flex items-center justify-between cursor-pointer hover:bg-muted"
                    >
                      <span>{productType.name}</span>
                      <Check
                        className={cn(
                          "h-4 w-4",
                          selectedProductTypes.some(pt => pt.id === productType.id) ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  ))}
                  {productTypes.length > 0 && (
                    <CommandItem
                      onSelect={() => setProductTypeDialogOpen(true)}
                      className="flex items-center gap-2 cursor-pointer hover:bg-muted border-t"
                    >
                      <Plus className="h-4 w-4" />
                      <span>إضافة نوع جديد</span>
                    </CommandItem>
                  )}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* المواسم والمناسبات */}
        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            المواسم والمناسبات
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-full justify-between h-auto min-h-[2.5rem] py-2"
              >
                <div className="flex flex-wrap gap-1 max-w-full">
                  {selectedSeasonsOccasions.length === 0 ? (
                    <span className="text-muted-foreground">اختر المواسم والمناسبات...</span>
                  ) : (
                    selectedSeasonsOccasions.map((seasonOccasion) => (
                      <Badge key={seasonOccasion.id} variant="secondary" className="gap-1">
                        {seasonOccasion.name}
                        {seasonOccasion.type && (
                          <span className="text-xs opacity-70">
                            ({seasonOccasion.type === 'season' ? 'موسم' : 'مناسبة'})
                          </span>
                        )}
                      </Badge>
                    ))
                  )}
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0 bg-background border shadow-lg z-50" align="start">
              <Command>
                <CommandInput placeholder="البحث في المواسم والمناسبات..." />
                <CommandEmpty>
                  <div className="p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-2">لا توجد مواسم أو مناسبات.</p>
                    <Button 
                      size="sm" 
                      onClick={() => setSeasonOccasionDialogOpen(true)}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      إضافة موسم/مناسبة جديدة
                    </Button>
                  </div>
                </CommandEmpty>
                <CommandGroup className="max-h-64 overflow-auto">
                  {seasonsOccasions.map((seasonOccasion) => (
                    <CommandItem
                      key={seasonOccasion.id}
                      value={seasonOccasion.name}
                      onSelect={() => handleSeasonOccasionToggle(seasonOccasion)}
                      className="flex items-center justify-between cursor-pointer hover:bg-muted"
                    >
                      <div className="flex items-center gap-2">
                        <span>{seasonOccasion.name}</span>
                        {seasonOccasion.type && (
                          <Badge variant="outline" className="text-xs">
                            {seasonOccasion.type === 'season' ? 'موسم' : 'مناسبة'}
                          </Badge>
                        )}
                      </div>
                      <Check
                        className={cn(
                          "h-4 w-4",
                          selectedSeasonsOccasions.some(so => so.id === seasonOccasion.id) ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  ))}
                  {seasonsOccasions.length > 0 && (
                    <CommandItem
                      onSelect={() => setSeasonOccasionDialogOpen(true)}
                      className="flex items-center gap-2 cursor-pointer hover:bg-muted border-t"
                    >
                      <Plus className="h-4 w-4" />
                      <span>إضافة موسم/مناسبة جديدة</span>
                    </CommandItem>
                  )}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
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