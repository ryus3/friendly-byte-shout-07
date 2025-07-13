import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Plus, Tag, Package, Calendar, Building2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';

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
        
        {/* التصنيفات الرئيسية */}
        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Tag className="h-4 w-4" />
            التصنيفات الرئيسية
          </Label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {categories.map((category) => (
              <Button
                key={category.id}
                variant={selectedCategories.some(c => c.id === category.id) ? "default" : "outline"}
                size="sm"
                onClick={() => handleCategoryToggle(category)}
                className="justify-start"
              >
                <Plus className="h-3 w-3 mr-1" />
                {category.name}
              </Button>
            ))}
          </div>
          {selectedCategories.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selectedCategories.map((category) => (
                <Badge key={category.id} variant="secondary" className="gap-1">
                  {category.name}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => handleCategoryToggle(category)}
                  />
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* أنواع المنتجات */}
        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Package className="h-4 w-4" />
            أنواع المنتجات
          </Label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {productTypes.map((productType) => (
              <Button
                key={productType.id}
                variant={selectedProductTypes.some(pt => pt.id === productType.id) ? "default" : "outline"}
                size="sm"
                onClick={() => handleProductTypeToggle(productType)}
                className="justify-start"
              >
                <Plus className="h-3 w-3 mr-1" />
                {productType.name}
              </Button>
            ))}
          </div>
          {selectedProductTypes.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selectedProductTypes.map((productType) => (
                <Badge key={productType.id} variant="secondary" className="gap-1">
                  {productType.name}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => handleProductTypeToggle(productType)}
                  />
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* المواسم والمناسبات */}
        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            المواسم والمناسبات
          </Label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {seasonsOccasions.map((seasonOccasion) => (
              <Button
                key={seasonOccasion.id}
                variant={selectedSeasonsOccasions.some(so => so.id === seasonOccasion.id) ? "default" : "outline"}
                size="sm"
                onClick={() => handleSeasonOccasionToggle(seasonOccasion)}
                className="justify-start"
              >
                <Plus className="h-3 w-3 mr-1" />
                {seasonOccasion.name}
                <Badge variant="outline" className="text-xs ml-1">
                  {seasonOccasion.type === 'season' ? 'موسم' : 'مناسبة'}
                </Badge>
              </Button>
            ))}
          </div>
          {selectedSeasonsOccasions.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selectedSeasonsOccasions.map((seasonOccasion) => (
                <Badge key={seasonOccasion.id} variant="secondary" className="gap-1">
                  {seasonOccasion.name}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => handleSeasonOccasionToggle(seasonOccasion)}
                  />
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* الأقسام */}
        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            الأقسام
          </Label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {departments.map((department) => (
              <Button
                key={department.id}
                variant={selectedDepartments.some(d => d.id === department.id) ? "default" : "outline"}
                size="sm"
                onClick={() => handleDepartmentToggle(department)}
                className="justify-start"
              >
                <Plus className="h-3 w-3 mr-1" />
                {department.name}
              </Button>
            ))}
          </div>
          {selectedDepartments.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selectedDepartments.map((department) => (
                <Badge key={department.id} variant="secondary" className="gap-1">
                  {department.name}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => handleDepartmentToggle(department)}
                  />
                </Badge>
              ))}
            </div>
          )}
        </div>

      </CardContent>
    </Card>
  );
};

export default MultiSelectCategorization;