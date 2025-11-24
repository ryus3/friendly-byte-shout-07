import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { StorefrontProvider, useStorefront } from '@/contexts/StorefrontContext';
import StorefrontLayout from '@/components/storefront/StorefrontLayout';
import ProductGrid from '@/components/storefront/ProductGrid';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const StorefrontProducts = () => {
  const { settings, filters, updateFilters, resetFilters, trackPageView } = useStorefront();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [colors, setColors] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [sortBy, setSortBy] = useState('newest');

  useEffect(() => {
    trackPageView();
  }, [trackPageView]);

  // جلب الفلاتر المتاحة
  useEffect(() => {
    const fetchFilters = async () => {
      const [categoriesData, departmentsData, colorsData, sizesData] = await Promise.all([
        supabase.from('categories').select('*').eq('type', 'product'),
        supabase.from('departments').select('*').eq('is_active', true),
        supabase.from('colors').select('*'),
        supabase.from('sizes').select('*')
      ]);

      setCategories(categoriesData.data || []);
      setDepartments(departmentsData.data || []);
      setColors(colorsData.data || []);
      setSizes(sizesData.data || []);
    };

    fetchFilters();
  }, []);

  // جلب المنتجات
  useEffect(() => {
    if (!settings?.employee_id) return;

    const fetchProducts = async () => {
      try {
        setLoading(true);

        let query = supabase
          .from('products')
          .select(`
            *,
            variants:product_variants(
              id,
              color,
              size,
              price,
              quantity,
              reserved_quantity,
              images
            )
          `)
          .eq('is_active', true);

        const { data, error } = await query;
        if (error) throw error;

        // فلترة المنتجات المتاحة فقط
        const available = data?.filter(p => 
          p.variants?.some(v => (v.quantity - (v.reserved_quantity || 0)) > 0)
        ) || [];

        setProducts(available);
      } catch (err) {
        console.error('Error fetching products:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [settings?.employee_id]);

  // تطبيق الفلاتر والترتيب
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // فلتر البحث
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(p => 
        p.name?.toLowerCase().includes(searchLower) ||
        p.brand?.toLowerCase().includes(searchLower)
      );
    }

    // فلتر الفئة
    if (filters.category) {
      result = result.filter(p => p.category_id === filters.category);
    }

    // فلتر القسم
    if (filters.department) {
      result = result.filter(p => p.department_id === filters.department);
    }

    // فلتر السعر
    result = result.filter(p => {
      const minPrice = Math.min(...p.variants.map(v => v.price));
      return minPrice >= filters.minPrice && minPrice <= filters.maxPrice;
    });

    // فلتر الألوان
    if (filters.colors.length > 0) {
      result = result.filter(p =>
        p.variants.some(v => filters.colors.includes(v.color))
      );
    }

    // فلتر الأحجام
    if (filters.sizes.length > 0) {
      result = result.filter(p =>
        p.variants.some(v => filters.sizes.includes(v.size))
      );
    }

    // الترتيب
    switch (sortBy) {
      case 'newest':
        result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        break;
      case 'price-low':
        result.sort((a, b) => {
          const minA = Math.min(...a.variants.map(v => v.price));
          const minB = Math.min(...b.variants.map(v => v.price));
          return minA - minB;
        });
        break;
      case 'price-high':
        result.sort((a, b) => {
          const minA = Math.min(...a.variants.map(v => v.price));
          const minB = Math.min(...b.variants.map(v => v.price));
          return minB - minA;
        });
        break;
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
        break;
    }

    return result;
  }, [products, filters, sortBy]);

  const FilterPanel = () => (
    <div className="space-y-6">
      {/* الفئات */}
      {categories.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3">الفئة</h3>
          <div className="space-y-2">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center gap-2">
                <Checkbox
                  id={`cat-${cat.id}`}
                  checked={filters.category === cat.id}
                  onCheckedChange={(checked) => 
                    updateFilters({ category: checked ? cat.id : null })
                  }
                />
                <Label htmlFor={`cat-${cat.id}`}>{cat.name}</Label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* الأقسام */}
      {departments.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3">القسم</h3>
          <div className="space-y-2">
            {departments.map(dept => (
              <div key={dept.id} className="flex items-center gap-2">
                <Checkbox
                  id={`dept-${dept.id}`}
                  checked={filters.department === dept.id}
                  onCheckedChange={(checked) => 
                    updateFilters({ department: checked ? dept.id : null })
                  }
                />
                <Label htmlFor={`dept-${dept.id}`}>{dept.name}</Label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* الألوان */}
      {colors.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3">اللون</h3>
          <div className="space-y-2">
            {colors.map(color => (
              <div key={color.id} className="flex items-center gap-2">
                <Checkbox
                  id={`color-${color.id}`}
                  checked={filters.colors.includes(color.name)}
                  onCheckedChange={(checked) => {
                    const newColors = checked
                      ? [...filters.colors, color.name]
                      : filters.colors.filter(c => c !== color.name);
                    updateFilters({ colors: newColors });
                  }}
                />
                <Label htmlFor={`color-${color.id}`} className="flex items-center gap-2">
                  {color.hex_code && (
                    <div
                      className="w-4 h-4 rounded-full border"
                      style={{ backgroundColor: color.hex_code }}
                    />
                  )}
                  {color.name}
                </Label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* إعادة تعيين */}
      <Button variant="outline" onClick={resetFilters} className="w-full">
        <X className="h-4 w-4 ml-2" />
        إعادة تعيين الفلاتر
      </Button>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">جميع المنتجات</h1>
        
        <div className="flex items-center gap-4">
          {/* الترتيب */}
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">الأحدث</SelectItem>
              <SelectItem value="price-low">السعر: من الأقل</SelectItem>
              <SelectItem value="price-high">السعر: من الأعلى</SelectItem>
              <SelectItem value="name">الاسم</SelectItem>
            </SelectContent>
          </Select>

          {/* فلتر موبايل */}
          <Sheet>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>الفلاتر</SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <FilterPanel />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Filters - Desktop */}
        <aside className="hidden md:block">
          <div className="sticky top-20 bg-card border border-border rounded-lg p-4">
            <FilterPanel />
          </div>
        </aside>

        {/* Products Grid */}
        <div className="md:col-span-3">
          <div className="mb-4 text-sm text-muted-foreground">
            {filteredProducts.length} منتج
          </div>
          <ProductGrid products={filteredProducts} loading={loading} />
        </div>
      </div>
    </div>
  );
};

const StorefrontProductsPageWrapper = () => {
  const { slug } = useParams();

  return (
    <StorefrontProvider slug={slug}>
      <StorefrontLayout>
        <StorefrontProducts />
      </StorefrontLayout>
    </StorefrontProvider>
  );
};

export default StorefrontProductsPageWrapper;
