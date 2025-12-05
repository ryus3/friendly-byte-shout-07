import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Package, Palette, Ruler, Building, Tag, Calendar, CheckCircle, XCircle, Store, Search, Plus, Trash2 } from 'lucide-react';
import { useFiltersData } from '@/hooks/useFiltersData';
import ProductSelectionDialog from './ProductSelectionDialog';

const ProductPermissionsManager = ({ user: selectedUser, onClose, onUpdate }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [permissions, setPermissions] = useState({
    category: { has_full_access: false, allowed_items: [] },
    color: { has_full_access: false, allowed_items: [] },
    size: { has_full_access: false, allowed_items: [] },
    department: { has_full_access: false, allowed_items: [] },
    product_type: { has_full_access: false, allowed_items: [] },
    season_occasion: { has_full_access: false, allowed_items: [] }
  });

  // حالة المنتجات المسموحة للمتجر
  const [allowedProducts, setAllowedProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(false);
  
  // حالة نافذة اختيار المنتجات الجديدة
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState([]);

  const [availableOptions, setAvailableOptions] = useState({
    categories: [],
    colors: [],
    sizes: [],
    departments: [],
    product_types: [],
    seasons_occasions: []
  });

  const {
    categories: filterCategories,
    departments: filterDepartments,
    productTypes: filterProductTypes,
    seasonsOccasions: filterSeasonsOccasions,
    colors: filterColors,
    sizes: filterSizes,
    loading: filtersLoading,
  } = useFiltersData();

  useEffect(() => {
    if (!filtersLoading) {
      setAvailableOptions({
        categories: filterCategories || [],
        colors: filterColors || [],
        sizes: filterSizes || [],
        departments: filterDepartments || [],
        product_types: filterProductTypes || [],
        seasons_occasions: filterSeasonsOccasions || []
      });
    }
  }, [filtersLoading, filterCategories, filterDepartments, filterProductTypes, filterSeasonsOccasions, filterColors, filterSizes]);

  useEffect(() => {
    if (!selectedUser?.user_id) return;
    
    const fetchData = async () => {
      try {
        setLoading(true);

        const { data: userPermissionsData, error: userPermissionsError } = await supabase
          .from('user_product_permissions')
          .select('*')
          .eq('user_id', selectedUser.user_id);

        if (userPermissionsError) throw userPermissionsError;

        const currentPermissions = { ...permissions };
        (userPermissionsData || []).forEach(perm => {
          currentPermissions[perm.permission_type] = {
            has_full_access: perm.has_full_access,
            allowed_items: perm.allowed_items || []
          };
        });
        setPermissions(currentPermissions);

        // جلب المنتجات المسموحة للمتجر
        await fetchAllowedProducts();
        await fetchAllProducts();

      } catch (error) {
        console.error('خطأ في جلب البيانات:', error);
        toast({
          title: 'خطأ',
          description: 'حدث خطأ في جلب البيانات',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };

    if (!filtersLoading) {
      fetchData();
    }
  }, [selectedUser?.user_id, filtersLoading]);

  // جلب المنتجات المسموحة للموظف
  const fetchAllowedProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('employee_allowed_products')
        .select(`
          id,
          product_id,
          is_active,
          added_at,
          product:products(
            id, 
            name, 
            images, 
            base_price,
            variants:product_variants(
              id,
              color:colors(id, name, hex_code),
              size:sizes(id, name),
              inventory!inventory_variant_id_fkey(quantity, reserved_quantity)
            )
          )
        `)
        .eq('employee_id', selectedUser.user_id);

      if (error) throw error;
      setAllowedProducts(data || []);
    } catch (error) {
      console.error('خطأ في جلب المنتجات المسموحة:', error);
    }
  };

  // جلب جميع المنتجات
  const fetchAllProducts = async () => {
    try {
      setLoadingProducts(true);
      const { data, error } = await supabase
        .from('products')
        .select(`
          id, 
          name, 
          images, 
          base_price,
          variants:product_variants(
            id,
            color:colors(id, name, hex_code),
            size:sizes(id, name),
            inventory!inventory_variant_id_fkey(quantity, reserved_quantity)
          )
        `)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setAllProducts(data || []);
    } catch (error) {
      console.error('خطأ في جلب المنتجات:', error);
    } finally {
      setLoadingProducts(false);
    }
  };

  // إضافة منتج واحد للقائمة المسموحة
  const addAllowedProduct = async (productId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('employee_allowed_products')
        .insert({
          employee_id: selectedUser.user_id,
          product_id: productId,
          added_by: user.id
        });

      if (error) {
        if (error.code === '23505') {
          toast({ title: 'المنتج موجود بالفعل', variant: 'destructive' });
          return;
        }
        throw error;
      }

      toast({ title: 'تمت إضافة المنتج بنجاح' });
      await fetchAllowedProducts();
    } catch (error) {
      console.error('خطأ في إضافة المنتج:', error);
      toast({ title: 'خطأ في إضافة المنتج', variant: 'destructive' });
    }
  };

  // إضافة عدة منتجات دفعة واحدة
  const addSelectedProducts = async () => {
    if (selectedProducts.length === 0) {
      toast({ title: 'اختر منتجات أولاً', variant: 'destructive' });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const productsToInsert = selectedProducts.map(productId => ({
        employee_id: selectedUser.user_id,
        product_id: productId,
        added_by: user.id
      }));

      const { error } = await supabase
        .from('employee_allowed_products')
        .upsert(productsToInsert, { onConflict: 'employee_id,product_id', ignoreDuplicates: true });

      if (error) throw error;

      toast({ title: `تمت إضافة ${selectedProducts.length} منتج بنجاح` });
      setSelectedProducts([]);
      setDropdownOpen(false);
      await fetchAllowedProducts();
    } catch (error) {
      console.error('خطأ في إضافة المنتجات:', error);
      toast({ title: 'خطأ في إضافة المنتجات', variant: 'destructive' });
    }
  };

  // تبديل اختيار منتج في Dialog
  const toggleProductSelection = (productId) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  // تأكيد إضافة المنتجات المحددة
  const handleConfirmSelection = async () => {
    await addSelectedProducts();
    setDialogOpen(false);
  };

  // حذف منتج من القائمة المسموحة
  const removeAllowedProduct = async (allowedProductId) => {
    try {
      const { error } = await supabase
        .from('employee_allowed_products')
        .delete()
        .eq('id', allowedProductId);

      if (error) throw error;

      toast({ title: 'تم حذف المنتج من القائمة' });
      await fetchAllowedProducts();
    } catch (error) {
      console.error('خطأ في حذف المنتج:', error);
      toast({ title: 'خطأ في حذف المنتج', variant: 'destructive' });
    }
  };

  const updatePermission = (type, field, value) => {
    setPermissions(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value
      }
    }));
  };

  const toggleAllowedItem = (type, itemId) => {
    setPermissions(prev => {
      const currentItems = prev[type].allowed_items;
      const isIncluded = currentItems.includes(itemId);
      
      return {
        ...prev,
        [type]: {
          ...prev[type],
          allowed_items: isIncluded 
            ? currentItems.filter(id => id !== itemId)
            : [...currentItems, itemId]
        }
      };
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      await supabase
        .from('user_product_permissions')
        .delete()
        .eq('user_id', selectedUser.user_id);

      const newPermissions = Object.entries(permissions).map(([type, perm]) => ({
        user_id: selectedUser.user_id,
        permission_type: type,
        has_full_access: perm.has_full_access,
        allowed_items: perm.has_full_access ? [] : perm.allowed_items
      }));

      const { error } = await supabase
        .from('user_product_permissions')
        .insert(newPermissions);

      if (error) throw error;

      toast({
        title: 'نجح',
        description: 'تم حفظ صلاحيات المنتجات بنجاح',
      });

      onUpdate?.();
    } catch (error) {
      console.error('خطأ في حفظ الصلاحيات:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ في حفظ الصلاحيات',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  // حساب الألوان والقياسات المتاحة لمنتج
  const getAvailableVariants = (product) => {
    const colors = new Map();
    const sizes = new Map();
    
    product?.variants?.forEach(v => {
      const qty = v.inventory?.quantity || 0;
      const reserved = v.inventory?.reserved_quantity || 0;
      const available = qty - reserved;
      
      if (available > 0) {
        if (v.color?.name) {
          const existing = colors.get(v.color.name) || { count: 0, hex: v.color.hex_code };
          colors.set(v.color.name, { count: existing.count + available, hex: existing.hex });
        }
        if (v.size?.name) {
          const existing = sizes.get(v.size.name) || 0;
          sizes.set(v.size.name, existing + available);
        }
      }
    });
    
    return { colors: Array.from(colors.entries()), sizes: Array.from(sizes.entries()) };
  };

  const permissionTabs = [
    { key: 'storefront', label: 'منتجات المتجر', icon: Store, isStorefront: true },
    { key: 'category', label: 'التصنيفات', icon: Tag, options: availableOptions.categories },
    { key: 'color', label: 'الألوان', icon: Palette, options: availableOptions.colors },
    { key: 'size', label: 'الأحجام', icon: Ruler, options: availableOptions.sizes },
    { key: 'department', label: 'الأقسام', icon: Building, options: availableOptions.departments },
    { key: 'product_type', label: 'أنواع المنتجات', icon: Package, options: availableOptions.product_types },
    { key: 'season_occasion', label: 'المواسم', icon: Calendar, options: availableOptions.seasons_occasions }
  ];

  // فلترة المنتجات للبحث (المنتجات غير المضافة)
  const filteredProducts = allProducts.filter(p => {
    const isNotAllowed = !allowedProducts.some(ap => ap.product_id === p.id);
    const matchesSearch = p.name?.toLowerCase().includes(productSearchTerm.toLowerCase());
    return isNotAllowed && matchesSearch;
  });

  // المنتجات غير المضافة للـ Dialog
  const availableForSelection = allProducts.filter(p => 
    !allowedProducts.some(ap => ap.product_id === p.id)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">صلاحيات المنتجات المتقدمة</h3>
          <p className="text-sm text-muted-foreground">
            {selectedUser?.full_name} ({selectedUser?.email})
          </p>
        </div>
        <div className="flex space-x-2 space-x-reverse">
          <Button variant="outline" onClick={onClose}>
            إغلاق
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'جاري الحفظ...' : 'حفظ الصلاحيات'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="storefront" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-7 mb-6">
          {permissionTabs.map(tab => (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              className="text-xs flex items-center space-x-1 space-x-reverse"
            >
              <tab.icon className="h-3 w-3" />
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* تاب منتجات المتجر */}
        <TabsContent value="storefront" className="space-y-4">
          <Card className="border-2 border-purple-200 dark:border-purple-800">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30">
              <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center ml-3">
                    <Store className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <span>المنتجات المسموحة للمتجر الإلكتروني</span>
                    <p className="text-xs text-muted-foreground font-normal mt-1">
                      حدد المنتجات التي يستطيع الموظف عرضها في متجره
                    </p>
                  </div>
                </div>
                <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0">
                  {allowedProducts.length} منتج
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {/* زر فتح نافذة اختيار المنتجات الاحترافية */}
              <div className="space-y-3">
                <Button 
                  onClick={() => {
                    setSelectedProducts([]);
                    setDialogOpen(true);
                  }}
                  className="w-full h-14 bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 hover:opacity-90 text-base font-medium"
                >
                  <Plus className="h-5 w-5 ml-2" />
                  إضافة منتجات للمتجر
                </Button>
              </div>

              {/* البحث المباشر السريع */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium">أو ابحث وأضف منتج واحد</h4>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="ابحث عن منتج لإضافته..."
                    value={productSearchTerm}
                    onChange={(e) => setProductSearchTerm(e.target.value)}
                    className="pr-10"
                  />
                </div>
                
                {productSearchTerm && (
                  <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                    {filteredProducts.slice(0, 10).map(product => {
                      const { colors, sizes } = getAvailableVariants(product);
                      
                      return (
                        <div 
                          key={product.id}
                          className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {product.images?.[0] && (
                              <img src={product.images[0]} alt="" className="w-10 h-10 rounded object-cover" />
                            )}
                            <div>
                              <p className="font-medium text-sm">{product.name}</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {colors.slice(0, 3).map(([name, { count, hex }]) => (
                                  <span 
                                    key={name} 
                                    className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1"
                                    style={{ backgroundColor: hex ? `${hex}20` : '#f0f0f0' }}
                                  >
                                    <span 
                                      className="w-2 h-2 rounded-full"
                                      style={{ backgroundColor: hex || '#ccc' }}
                                    />
                                    {name} ({count})
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => addAllowedProduct(product.id)}
                          >
                            <Plus className="h-4 w-4 ml-1" />
                            إضافة
                          </Button>
                        </div>
                      );
                    })}
                    {filteredProducts.length === 0 && (
                      <p className="text-center py-4 text-muted-foreground text-sm">
                        لا توجد منتجات مطابقة
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* قائمة المنتجات المسموحة مع الألوان والقياسات */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium">
                  المنتجات المسموحة ({allowedProducts.length})
                </h4>
                
                {allowedProducts.length === 0 ? (
                  <div className="text-center py-8 bg-muted/30 rounded-xl">
                    <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-muted-foreground">لا توجد منتجات مسموحة</p>
                    <p className="text-xs text-muted-foreground">ابحث وأضف منتجات للموظف</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 max-h-80 overflow-y-auto">
                    {allowedProducts.map(ap => {
                      const { colors, sizes } = getAvailableVariants(ap.product);
                      
                      return (
                        <div 
                          key={ap.id}
                          className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {ap.product?.images?.[0] && (
                              <img src={ap.product.images[0]} alt="" className="w-14 h-14 rounded object-cover" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{ap.product?.name || 'منتج محذوف'}</p>
                              <p className="text-xs text-muted-foreground">{ap.product?.base_price?.toLocaleString('ar-IQ')} IQD</p>
                              
                              {/* عرض الألوان المتاحة */}
                              {colors.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  <span className="text-[10px] text-muted-foreground">الألوان:</span>
                                  {colors.map(([name, { count, hex }]) => (
                                    <span 
                                      key={name} 
                                      className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1"
                                      style={{ backgroundColor: hex ? `${hex}20` : '#f0f0f0' }}
                                    >
                                      <span 
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: hex || '#ccc' }}
                                      />
                                      {name} ({count})
                                    </span>
                                  ))}
                                </div>
                              )}
                              
                              {/* عرض القياسات المتاحة */}
                              {sizes.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  <span className="text-[10px] text-muted-foreground">القياسات:</span>
                                  {sizes.map(([name, count]) => (
                                    <span key={name} className="text-[10px] bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">
                                      {name} ({count})
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => removeAllowedProduct(ap.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* باقي التابات */}
        {permissionTabs.filter(t => !t.isStorefront).map(tab => (
          <TabsContent key={tab.key} value={tab.key} className="space-y-4">
            <Card className="border-2">
              <CardHeader className="bg-gradient-to-r from-muted/50 to-muted/30">
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center ml-3">
                      <tab.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <span>صلاحيات {tab.label}</span>
                      <p className="text-xs text-muted-foreground font-normal mt-1">
                        تحديد {tab.label} التي يمكن للموظف رؤيتها
                      </p>
                    </div>
                  </div>
                  {permissions[tab.key]?.has_full_access && (
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      صلاحية كاملة
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <label className="flex items-center space-x-2 space-x-reverse cursor-pointer p-3 rounded-lg border-2 hover:bg-muted/50 transition-colors">
                  <Checkbox
                    checked={permissions[tab.key]?.has_full_access || false}
                    onCheckedChange={(checked) => updatePermission(tab.key, 'has_full_access', checked)}
                  />
                  <div className="flex-1">
                    <span className="font-medium">صلاحية كاملة</span>
                    <p className="text-xs text-muted-foreground">السماح بالوصول لجميع {tab.label}</p>
                  </div>
                  {permissions[tab.key]?.has_full_access ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-muted-foreground/30" />
                  )}
                </label>

                {!permissions[tab.key]?.has_full_access && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      أو اختر {tab.label} المحددة:
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto p-2">
                      {(tab.options || []).map(option => {
                        const isSelected = permissions[tab.key]?.allowed_items?.includes(option.id);
                        return (
                          <label 
                            key={option.id}
                            className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                              isSelected 
                                ? 'border-primary bg-primary/5' 
                                : 'border-muted hover:border-muted-foreground/30'
                            }`}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleAllowedItem(tab.key, option.id)}
                            />
                            <span className="text-sm truncate">{option.name}</span>
                          </label>
                        );
                      })}
                    </div>
                    {permissions[tab.key]?.allowed_items?.length > 0 && (
                      <p className="text-xs text-muted-foreground text-center">
                        {permissions[tab.key].allowed_items.length} عنصر محدد
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* نافذة اختيار المنتجات الاحترافية */}
      <ProductSelectionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        products={availableForSelection}
        selectedProducts={selectedProducts}
        onToggleProduct={toggleProductSelection}
        onConfirm={handleConfirmSelection}
        loading={loadingProducts}
        title="اختر المنتجات لإضافتها للمتجر"
      />
    </div>
  );
};

export default ProductPermissionsManager;