import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CategoriesManager from '@/components/manage-variants/CategoriesManager';
import ColorsManager from '@/components/manage-variants/ColorsManager';
import SizesManager from '@/components/manage-variants/SizesManager';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Palette, Tags, Ruler, BarChart3, Globe, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';

const ManageVariantsPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('categories');

  const getTabStats = (type) => {
    // يمكن تحسين هذا لاحقاً لعرض إحصائيات حقيقية
    switch (type) {
      case 'categories': return { count: '12+', status: 'نشطة' };
      case 'colors': return { count: '8+', status: 'متاحة' };
      case 'sizes': return { count: '15+', status: 'منظمة' };
      default: return { count: '0', status: 'غير متاح' };
    }
  };

  const tabConfig = [
    {
      value: 'categories',
      label: 'التصنيفات',
      icon: Tags,
      description: 'إدارة الأقسام الرئيسية وأنواع المنتجات والمواسم',
      color: 'from-emerald-500 to-teal-600',
      component: CategoriesManager
    },
    {
      value: 'colors',
      label: 'الألوان',
      icon: Palette,
      description: 'إدارة وتنظيم ألوان المنتجات مع الرموز اللونية',
      color: 'from-pink-500 to-rose-600',
      component: ColorsManager
    },
    {
      value: 'sizes',
      label: 'القياسات',
      icon: Ruler,
      description: 'إدارة القياسات الحرفية والرقمية والأحجام الحرة',
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
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl">
                      <Globe className="h-6 w-6 text-white" />
                    </div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      إدارة المتغيرات العالمية
                    </h1>
                    <Sparkles className="h-6 w-6 text-yellow-500" />
                  </div>
                  <p className="text-lg text-muted-foreground max-w-2xl">
                    نظام متطور ومتكامل لإدارة جميع متغيرات المنتجات بطريقة احترافية وعالمية
                  </p>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-emerald-200 dark:border-emerald-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
                        <Tags className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">التصنيفات</p>
                        <p className="text-lg font-bold text-emerald-800 dark:text-emerald-200">12+ نشطة</p>
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
                        <p className="text-lg font-bold text-pink-800 dark:text-pink-200">8+ متاحة</p>
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
                        <p className="text-lg font-bold text-blue-800 dark:text-blue-200">15+ منظمة</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 border-purple-200 dark:border-purple-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                        <BarChart3 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-purple-600 dark:text-purple-400">المتغيرات</p>
                        <p className="text-lg font-bold text-purple-800 dark:text-purple-200">35+ إجمالي</p>
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
                <TabsList className="w-full grid grid-cols-3 h-auto p-2 bg-transparent">
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