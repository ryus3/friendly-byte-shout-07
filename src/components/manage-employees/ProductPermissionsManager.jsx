import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Package, Palette, Ruler, Building, Tag, Calendar, CheckCircle, XCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';

const ProductPermissionsManager = ({ employee: selectedUser, onUpdate }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('categories');
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
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-muted/30 to-muted/50 p-4 rounded-lg border border-border/50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold">صلاحيات المنتجات المتقدمة</h3>
            <p className="text-sm text-muted-foreground">
              تحديد التصنيفات والألوان والأحجام التي يستطيع {selectedUser?.full_name} رؤيتها
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving} className="h-8 px-3 text-xs">
              {saving ? 'جاري الحفظ...' : 'حفظ الصلاحيات'}
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-4 h-auto">
          {permissionTabs.map(tab => (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              className="text-xs flex items-center gap-1 p-2 min-w-0"
            >
              <tab.icon className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {permissionTabs.map(tab => (
          <TabsContent key={tab.key} value={tab.key} className="space-y-3 m-0">
            <Card className="border">
              <CardHeader className="bg-gradient-to-r from-muted/50 to-muted/30 pb-3">
                <CardTitle className="flex items-center justify-between text-sm">
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center ml-2">
                      <tab.icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <span>صلاحيات {tab.label}</span>
                      <p className="text-xs text-muted-foreground font-normal mt-1">
                        تحديد {tab.label} التي يمكن للموظف رؤيتها في النظام
                      </p>
                    </div>
                  </div>
                  <div className="text-left">
                    <Badge variant={permissions[tab.key].has_full_access ? "default" : "secondary"} className="text-xs">
                      {permissions[tab.key].has_full_access ? "وصول كامل" : "وصول محدود"}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {permissions[tab.key].has_full_access 
                        ? `جميع ${tab.options.length} عنصر`
                        : `${permissions[tab.key].allowed_items.length} من ${tab.options.length}`
                      }
                    </p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-4">
                {/* الوصول الكامل */}
                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg border border-primary/20">
                  <div className="flex items-center space-x-3 space-x-reverse">
                    <Checkbox
                      checked={permissions[tab.key].has_full_access}
                      onCheckedChange={(checked) => 
                        updatePermission(tab.key, 'has_full_access', checked)
                      }
                      className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                    />
                    <div>
                      <Label className="text-sm font-medium cursor-pointer">وصول كامل</Label>
                      <p className="text-xs text-muted-foreground">
                        السماح بالوصول لجميع {tab.label} (الحالية والمستقبلية)
                      </p>
                    </div>
                  </div>
                  {permissions[tab.key].has_full_access ? (
                    <Badge variant="default" className="text-xs">
                      <CheckCircle className="h-3 w-3 ml-1" />
                      مفعل
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      <XCircle className="h-3 w-3 ml-1" />
                      محدود
                    </Badge>
                  )}
                </div>

                {/* اختيار عناصر محددة */}
                {!permissions[tab.key].has_full_access && (
                  <div>
                    <h4 className="text-sm font-medium mb-3 flex items-center justify-between">
                      <span>اختيار {tab.label} محددة</span>
                      <Badge variant="outline" className="text-xs">
                        {permissions[tab.key].allowed_items.length} من {tab.options.length}
                      </Badge>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                      {tab.options.map(option => (
                        <div
                          key={option.id}
                          className="flex items-center space-x-2 space-x-reverse p-2 rounded border hover:bg-muted/50 transition-colors"
                        >
                          <Checkbox
                            id={`${tab.key}-${option.id}`}
                            checked={permissions[tab.key].allowed_items.includes(option.id)}
                            onCheckedChange={() => toggleAllowedItem(tab.key, option.id)}
                          />
                          <label
                            htmlFor={`${tab.key}-${option.id}`}
                            className="text-sm cursor-pointer flex-1 truncate"
                            title={option.name}
                          >
                            {option.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* إحصائيات سريعة */}
                <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                  💡 {permissions[tab.key].has_full_access 
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