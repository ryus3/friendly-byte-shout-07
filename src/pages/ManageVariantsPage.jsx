import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CategoriesManager from '@/components/manage-variants/CategoriesManager';
import ColorsManager from '@/components/manage-variants/ColorsManager';
import SizesManager from '@/components/manage-variants/SizesManager';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Palette, Tags, Ruler, Package, Shirt, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { useVariants } from '@/contexts/VariantsContext';

const ManageVariantsPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('departments');
  const { categories, colors, sizes } = useVariants();

  const getTabStats = (type) => {
    switch (type) {
      case 'departments': return { count: '3', status: 'أقسام' };
      case 'categories': return { count: categories?.length || 0, status: 'تصنيف' };
      case 'colors': return { count: colors?.length || 0, status: 'لون' };
      case 'sizes': return { count: sizes?.length || 0, status: 'قياس' };
      default: return { count: '0', status: 'غير متاح' };
    }
  };

  // Real department data
  const departmentSections = [
    {
      title: 'قسم الملابس',
      count: categories?.filter(c => c.type === 'main_category' && c.name.includes('ملابس')).length || 0,
      description: 'ملابس رجالية ونسائية وأطفال'
    },
    {
      title: 'قسم الأحذية', 
      count: categories?.filter(c => c.type === 'main_category' && c.name.includes('أحذية')).length || 0,
      description: 'أحذية متنوعة لجميع الأعمار'
    },
    {
      title: 'قسم المواد العامة',
      count: categories?.filter(c => c.type === 'main_category' && !c.name.includes('ملابس') && !c.name.includes('أحذية')).length || 0,
      description: 'مواد وأدوات متنوعة'
    }
  ];

  // Departments Manager Component (placeholder for now)
  const DepartmentsManager = () => (
    <div className="text-center py-8">
      <h3 className="text-lg font-semibold mb-2">إدارة الأقسام الرئيسية</h3>
      <p className="text-muted-foreground mb-4">يمكنك إدارة الأقسام الرئيسية مثل قسم الملابس، الأحذية، والمواد العامة</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {departmentSections.map((dept, index) => (
          <div key={index} className="p-4 border rounded-lg bg-card">
            <h4 className="font-semibold">{dept.title}</h4>
            <p className="text-sm text-muted-foreground mt-1">{dept.description}</p>
            <p className="text-sm font-medium mt-2">{dept.count} تصنيف</p>
          </div>
        ))}
      </div>
    </div>
  );

  const tabConfig = [
    {
      value: 'departments',
      label: 'الأقسام الرئيسية',
      icon: Package,
      description: 'إدارة الأقسام الرئيسية للمتجر',
      color: 'from-purple-500 to-purple-600',
      component: DepartmentsManager
    },
    {
      value: 'categories',
      label: 'التصنيفات',
      icon: Tags,
      description: 'إدارة الأقسام والتصنيفات والمنتجات',
      color: 'from-emerald-500 to-teal-600',
      component: CategoriesManager
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
    <>
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

              {/* Real Data Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-900/30 border-purple-200 dark:border-purple-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-sm font-medium text-purple-600 dark:text-purple-400">الأقسام الرئيسية</p>
                        <p className="text-2xl font-bold text-purple-800 dark:text-purple-200">{departmentSections.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-emerald-200 dark:border-emerald-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">التصنيفات</p>
                        <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">{categories?.length || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 border-pink-200 dark:border-pink-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-sm font-medium text-pink-600 dark:text-pink-400">الألوان</p>
                        <p className="text-2xl font-bold text-pink-800 dark:text-pink-200">{colors?.length || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-sm font-medium text-blue-600 dark:text-blue-400">القياسات</p>
                        <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">{sizes?.length || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border shadow-lg overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" dir="rtl">
              <div className="border-b bg-slate-50 dark:bg-slate-900/50">
                <TabsList className="w-full grid grid-cols-4 h-auto p-2 bg-transparent">
                  {tabConfig.map((tab) => {
                    const IconComponent = tab.icon;
                    const stats = getTabStats(tab.value);
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
                              {stats.count}
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
    </>
  );
};

export default ManageVariantsPage;