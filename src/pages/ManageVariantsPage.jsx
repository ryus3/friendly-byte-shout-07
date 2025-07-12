import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CategoriesManager from '@/components/manage-variants/CategoriesManager';
import ColorsManager from '@/components/manage-variants/ColorsManager';
import SizesManager from '@/components/manage-variants/SizesManager';
import DepartmentsManager from '@/components/manage-variants/DepartmentsManager';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Palette, Tags, Ruler, Package, Shirt, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { useVariants } from '@/contexts/VariantsContext';
import { supabase } from '@/integrations/supabase/client';

const ManageVariantsPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('departments');
  const { categories, colors, sizes } = useVariants();
  
  // Fetch departments data
  const [departments, setDepartments] = useState([]);

  const getTabStats = (type) => {
    switch (type) {
      case 'departments': return { count: departments?.length || 0, status: 'قسم' };
      case 'categories': return { count: categories?.length || 0, status: 'تصنيف' };
      case 'colors': return { count: colors?.length || 0, status: 'لون' };
      case 'sizes': return { count: sizes?.length || 0, status: 'قياس' };
      default: return { count: '0', status: 'غير متاح' };
    }
  };

  // Load departments from database
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const { data } = await supabase
          .from('departments')
          .select('*')
          .eq('is_active', true)
          .order('display_order');
        setDepartments(data || []);
      } catch (error) {
        console.error('Error fetching departments:', error);
      }
    };
    fetchDepartments();
  }, []);

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

              {/* Beautiful Stats Cards with Real Data */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-900/30 border-purple-200 dark:border-purple-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                        <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-purple-600 dark:text-purple-400">الأقسام الرئيسية</p>
                        <p className="text-2xl font-bold text-purple-800 dark:text-purple-200">{departments?.length || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-emerald-200 dark:border-emerald-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
                        <Tags className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
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
                      <div className="p-2 bg-pink-100 dark:bg-pink-900/50 rounded-lg">
                        <Palette className="h-5 w-5 text-pink-600 dark:text-pink-400" />
                      </div>
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
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                        <Ruler className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
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
                          relative p-6 space-y-3 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 
                          data-[state=active]:shadow-lg rounded-xl transition-all duration-300
                          ${isActive ? 'transform scale-105' : 'hover:scale-102'}
                        `}
                      >
                        <div className="flex flex-col items-center space-y-2">
                          <div className={`
                            p-3 rounded-xl bg-gradient-to-r ${tab.color} 
                            ${isActive ? 'shadow-lg' : 'opacity-70'}
                            transition-all duration-300
                          `}>
                            <IconComponent className="h-6 w-6 text-white" />
                          </div>
                          <div className="text-center">
                            <p className={`font-semibold text-base ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {tab.label}
                            </p>
                            <Badge 
                              variant={isActive ? "default" : "secondary"} 
                              className="text-xs mt-1"
                            >
                              {stats.count} {stats.status}
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
                    <div className="p-8">
                      <div className="mb-6">
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`p-2 rounded-lg bg-gradient-to-r ${tab.color}`}>
                            <tab.icon className="h-5 w-5 text-white" />
                          </div>
                          <h2 className="text-2xl font-bold text-foreground">
                            إدارة {tab.label}
                          </h2>
                        </div>
                        <p className="text-muted-foreground text-lg">
                          {tab.description}
                        </p>
                      </div>
                      
                      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-6">
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