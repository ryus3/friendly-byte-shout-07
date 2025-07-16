import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { 
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Package, Palette, Ruler, Building, Tag, Calendar } from 'lucide-react';

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

  const [availableOptions, setAvailableOptions] = useState({
    categories: [],
    colors: [],
    sizes: [],
    departments: [],
    product_types: [],
    seasons_occasions: []
  });

  // جلب البيانات عند تحميل المكون
  useEffect(() => {
    if (!selectedUser?.user_id) return;
    
    const fetchData = async () => {
      try {
        setLoading(true);

        // جلب جميع الخيارات المتاحة
        const [
          categoriesResponse,
          colorsResponse,
          sizesResponse,
          departmentsResponse,
          productTypesResponse,
          seasonsOccasionsResponse,
          userPermissionsResponse
        ] = await Promise.all([
          supabase.from('categories').select('id, name').order('name'),
          supabase.from('colors').select('id, name').order('name'),
          supabase.from('sizes').select('id, name').order('display_order'),
          supabase.from('departments').select('id, name').order('name'),
          supabase.from('product_types').select('id, name').order('name'),
          supabase.from('seasons_occasions').select('id, name').order('name'),
          supabase
            .from('user_product_permissions')
            .select('*')
            .eq('user_id', selectedUser.user_id)
        ]);

        // تحديث الخيارات المتاحة
        setAvailableOptions({
          categories: categoriesResponse.data || [],
          colors: colorsResponse.data || [],
          sizes: sizesResponse.data || [],
          departments: departmentsResponse.data || [],
          product_types: productTypesResponse.data || [],
          seasons_occasions: seasonsOccasionsResponse.data || []
        });

        // تحديث الصلاحيات الحالية
        const currentPermissions = { ...permissions };
        (userPermissionsResponse.data || []).forEach(perm => {
          currentPermissions[perm.permission_type] = {
            has_full_access: perm.has_full_access,
            allowed_items: perm.allowed_items || []
          };
        });
        setPermissions(currentPermissions);

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

    fetchData();
  }, [selectedUser?.user_id]);

  // تحديث صلاحية معينة
  const updatePermission = (type, field, value) => {
    setPermissions(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value
      }
    }));
  };

  // تبديل عنصر من القائمة المسموحة
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

  // حفظ الصلاحيات
  const handleSave = async () => {
    try {
      setSaving(true);

      // حذف الصلاحيات الحالية
      await supabase
        .from('user_product_permissions')
        .delete()
        .eq('user_id', selectedUser.user_id);

      // إدراج الصلاحيات الجديدة
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

  const permissionTabs = [
    { key: 'category', label: 'التصنيفات', icon: Tag, options: availableOptions.categories },
    { key: 'color', label: 'الألوان', icon: Palette, options: availableOptions.colors },
    { key: 'size', label: 'الأحجام', icon: Ruler, options: availableOptions.sizes },
    { key: 'department', label: 'الأقسام', icon: Building, options: availableOptions.departments },
    { key: 'product_type', label: 'أنواع المنتجات', icon: Package, options: availableOptions.product_types },
    { key: 'season_occasion', label: 'المواسم والمناسبات', icon: Calendar, options: availableOptions.seasons_occasions }
  ];

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

      <Tabs defaultValue="category" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
          {permissionTabs.map(tab => (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              className="text-xs"
            >
              <tab.icon className="h-4 w-4 mr-1" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {permissionTabs.map(tab => (
          <TabsContent key={tab.key} value={tab.key}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <tab.icon className="ml-2 h-5 w-5" />
                  صلاحيات {tab.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* الوصول الكامل */}
                <div className="flex items-center space-x-2 space-x-reverse">
                  <Checkbox
                    id={`${tab.key}-full-access`}
                    checked={permissions[tab.key].has_full_access}
                    onCheckedChange={(checked) => 
                      updatePermission(tab.key, 'has_full_access', checked)
                    }
                  />
                  <label
                    htmlFor={`${tab.key}-full-access`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    وصول كامل لجميع {tab.label}
                  </label>
                  {permissions[tab.key].has_full_access && (
                    <Badge variant="default">وصول كامل</Badge>
                  )}
                </div>

                {/* اختيار عناصر محددة */}
                {!permissions[tab.key].has_full_access && (
                  <div>
                    <h4 className="text-sm font-medium mb-3">
                      اختيار {tab.label} محددة ({permissions[tab.key].allowed_items.length} من {tab.options.length})
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-60 overflow-y-auto">
                      {tab.options.map(option => (
                        <div
                          key={option.id}
                          className="flex items-center space-x-2 space-x-reverse p-2 rounded border hover:bg-muted/50"
                        >
                          <Checkbox
                            id={`${tab.key}-${option.id}`}
                            checked={permissions[tab.key].allowed_items.includes(option.id)}
                            onCheckedChange={() => toggleAllowedItem(tab.key, option.id)}
                          />
                          <label
                            htmlFor={`${tab.key}-${option.id}`}
                            className="text-sm cursor-pointer flex-1"
                          >
                            {option.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* إحصائيات */}
                <div className="text-xs text-muted-foreground">
                  {permissions[tab.key].has_full_access 
                    ? `الموظف يستطيع رؤية جميع ${tab.label} (${tab.options.length} عنصر)`
                    : `الموظف يستطيع رؤية ${permissions[tab.key].allowed_items.length} من ${tab.options.length} عنصر`
                  }
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default ProductPermissionsManager;