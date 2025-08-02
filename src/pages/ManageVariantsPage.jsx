import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CategoriesManager from '@/components/manage-variants/CategoriesManager';
import ColorsManager from '@/components/manage-variants/ColorsManager';
import SizesManager from '@/components/manage-variants/SizesManager';
import DepartmentsManager from '@/components/manage-variants/DepartmentsManager';
import ProductTypesManager from '@/components/manage-variants/ProductTypesManager';
import SeasonsOccasionsManager from '@/components/manage-variants/SeasonsOccasionsManager';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ArrowRight, Palette, Tags, Ruler, Package, Shirt, ShoppingBag, Building2,
  Footprints, Gem, Baby, Hammer, Monitor, Car, Home, Utensils, Gamepad2,
  Heart, Dumbbell, Book, Music, Camera, Scissors, Wrench,
  HardHat, Paintbrush, Laptop, Smartphone, Headphones, Settings, Calendar
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/customSupabaseClient';
import { VariantsProvider } from '@/contexts/VariantsContext';

const ManageVariantsPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('departments');
  const [stats, setStats] = useState({
    departments: { count: 0, status: 'تحميل...' },
    categories: { count: 0, status: 'تحميل...' },
    colors: { count: 0, status: 'تحميل...' },
    sizes: { count: 0, status: 'تحميل...' },
    productTypes: { count: 0, status: 'تحميل...' },
    seasonsOccasions: { count: 0, status: 'تحميل...' }
  });
  const [departments, setDepartments] = useState([]);

  // جلب الإحصائيات الحقيقية
  const fetchStats = async () => {
    try {
      const [deptResult, catResult, colorResult, sizeResult, productTypesResult, seasonsResult] = await Promise.all([
        supabase.from('departments').select('*', { count: 'exact' }),
        supabase.from('categories').select('*', { count: 'exact' }),
        supabase.from('colors').select('*', { count: 'exact' }),
        supabase.from('sizes').select('*', { count: 'exact' }),
        supabase.from('product_types').select('*', { count: 'exact' }),
        supabase.from('seasons_occasions').select('*', { count: 'exact' })
      ]);

      setStats({
        departments: { 
          count: deptResult.count || 0, 
          status: (deptResult.count || 0) > 0 ? 'نشطة' : 'فارغة' 
        },
        categories: { 
          count: catResult.count || 0, 
          status: (catResult.count || 0) > 0 ? 'نشطة' : 'فارغة' 
        },
        colors: { 
          count: colorResult.count || 0, 
          status: (colorResult.count || 0) > 0 ? 'متاحة' : 'فارغة' 
        },
        sizes: { 
          count: sizeResult.count || 0, 
          status: (sizeResult.count || 0) > 0 ? 'منظمة' : 'فارغة' 
        },
        productTypes: { 
          count: productTypesResult.count || 0, 
          status: (productTypesResult.count || 0) > 0 ? 'متاحة' : 'فارغة' 
        },
        seasonsOccasions: { 
          count: seasonsResult.count || 0, 
          status: (seasonsResult.count || 0) > 0 ? 'متاحة' : 'فارغة' 
        }
      });

      setDepartments(deptResult.data || []);
    } catch (error) {
      console.error('خطأ في جلب الإحصائيات:', error);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // أيقونات الأقسام المتاحة
  const iconComponents = {
    'Shirt': Shirt,
    'ShoppingBag': ShoppingBag,
    'Package': Package,
    'Building2': Building2,
    'Footprints': Footprints,
    'Gem': Gem,
    'Baby': Baby,
    'Hammer': Hammer,
    'Monitor': Monitor,
    'Car': Car,
    'Home': Home,
    'Utensils': Utensils,
    'Gamepad2': Gamepad2,
    'Heart': Heart,
    'Dumbbell': Dumbbell,
    'Book': Book,
    'Music': Music,
    'Camera': Camera,
    'Scissors': Scissors,
    'Wrench': Wrench,
    'HardHat': HardHat,
    'Paintbrush': Paintbrush,
    'Laptop': Laptop,
    'Smartphone': Smartphone,
    'Headphones': Headphones,
    'Settings': Settings
  };

  const tabConfig = [
    {
      value: 'departments',
      label: 'الأقسام الرئيسية',
      icon: Building2,
      description: 'إدارة الأقسام الرئيسية للمنتجات',
      color: 'from-indigo-500 to-purple-600',
      component: DepartmentsManager
    },
    {
      value: 'categories',
      label: 'التصنيفات',
      icon: Tags,
      description: 'إدارة التصنيفات الرئيسية',
      color: 'from-emerald-500 to-teal-600',
      component: CategoriesManager
    },
    {
      value: 'productTypes',
      label: 'أنواع المنتجات',
      icon: Package,
      description: 'إدارة أنواع المنتجات المختلفة',
      color: 'from-orange-500 to-red-600',
      component: ProductTypesManager
    },
    {
      value: 'seasonsOccasions',
      label: 'المواسم',
      icon: Calendar,
      description: 'إدارة المواسم',
      color: 'from-purple-500 to-pink-600',
      component: SeasonsOccasionsManager
    },
    {
      value: 'colors',
      label: 'الألوان',
      icon: Palette,
      description: 'إدارة وتنظيم ألوان المنتجات',
      color: 'from-pink-500 to-rose-600',
      component: ColorsManager
    },
    {
      value: 'sizes',
      label: 'القياسات',
      icon: Ruler,
      description: 'إدارة القياسات والأحجام المختلفة',
      color: 'from-blue-500 to-indigo-600',
      component: SizesManager
    }
  ];

  return (
    <VariantsProvider>
      <Helmet>
        <title>إدارة المتغيرات - نظام RYUS</title>
        <meta name="description" content="نظام متطور لإدارة التصنيفات، الألوان، والقياسات للمنتجات" />
      </Helmet>
      
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <div className="container mx-auto p-6 space-y-8">
          {/* Header Section */}
          <div className="relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl border shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10" />
            <div className="relative p-8">
                <div className="flex items-center gap-6 mb-6">
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/manage-products')}
                  className="hover:bg-blue-50 dark:hover:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                >
                  <ArrowRight className="h-4 w-4 ml-2" />
                  رجوع
                </Button>
                <div className="flex-1">
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    إدارة المتغيرات
                  </h1>
                  <p className="text-lg text-muted-foreground max-w-2xl">
                    نظام متطور ومتكامل لإدارة جميع متغيرات المنتجات بطريقة احترافية
                  </p>
                </div>
              </div>

              {/* الأقسام الرئيسية - مرتبة حسب ترتيب العرض */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {departments
                  .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                  .slice(0, 3)
                  .map((dept, index) => {
                  const IconComponent = iconComponents[dept.icon] || Package;
                  return (
                    <Card key={dept.id} className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all duration-300">
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-3 rounded-lg bg-gradient-to-r ${dept.color} shadow-lg`}>
                            <IconComponent className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <CardTitle className="text-sm font-semibold">{dept.name}</CardTitle>
                            <CardDescription className="text-xs">{dept.description}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">حالة القسم:</span>
                            <Badge variant={dept.is_active ? "default" : "secondary"} className="text-xs">
                              {dept.is_active ? "نشط" : "غير نشط"}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">ترتيب العرض:</span>
                            <Badge variant="outline" className="text-xs">{dept.display_order}</Badge>
                          </div>
                          <div className="pt-2 border-t">
                            <p className="text-xs text-muted-foreground">
                              تم الإنشاء: {new Date(dept.created_at).toLocaleDateString('en-US')}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                
                {departments.length === 0 && (
                  <div className="col-span-3 text-center py-8">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">لا توجد أقسام رئيسية</p>
                    <p className="text-sm text-muted-foreground">استخدم تبويب "الأقسام الرئيسية" لإضافة أقسام جديدة</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border shadow-lg overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" dir="rtl">
              <div className="border-b bg-slate-50 dark:bg-slate-900/50">
                <TabsList className="w-full grid grid-cols-6 h-auto p-2 bg-transparent">
                  {tabConfig.map((tab) => {
                    const IconComponent = tab.icon;
                    const tabStats = stats[tab.value] || { count: 0, status: 'فارغة' };
                    const isActive = activeTab === tab.value;
                    
                    return (
                      <TabsTrigger
                        key={tab.value}
                        value={tab.value}
                        className={`
                          relative p-4 space-y-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 
                          data-[state=active]:shadow-lg rounded-xl transition-all duration-300
                          ${isActive ? 'transform scale-105' : 'hover:scale-102'}
                        `}
                      >
                        <div className="flex flex-col items-center space-y-2">
                          <div className={`
                            p-2 rounded-lg bg-gradient-to-r ${tab.color} 
                            ${isActive ? 'shadow-lg' : 'opacity-70'}
                            transition-all duration-300
                          `}>
                            <IconComponent className="h-5 w-5 text-white" />
                          </div>
                          <div className="text-center">
                            <p className={`font-semibold text-sm ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {tab.label}
                            </p>
                            <Badge 
                              variant={isActive ? "default" : "secondary"} 
                              className="text-xs mt-1"
                            >
                              {tabStats.count}
                            </Badge>
                          </div>
                        </div>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>

              {/* Tab Contents */}
              {tabConfig.map((tab) => {
                const ComponentToRender = tab.component;
                return (
                  <TabsContent key={tab.value} value={tab.value} className="mt-0">
                    <div className="p-6">
                      <div className="mb-4">
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`p-2 rounded-lg bg-gradient-to-r ${tab.color}`}>
                            <tab.icon className="h-4 w-4 text-white" />
                          </div>
                          <h2 className="text-xl font-bold text-foreground">
                            إدارة {tab.label}
                          </h2>
                        </div>
                        <p className="text-muted-foreground">
                          {tab.description}
                        </p>
                      </div>
                      
                      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4">
                        <ComponentToRender />
                      </div>
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          </div>
        </div>
      </div>
    </VariantsProvider>
  );
};

export default ManageVariantsPage;