import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Package, Sparkles, TrendingUp, Plus, Tags, Palette, Ruler, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { Helmet } from 'react-helmet-async';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/components/ui/use-toast';

const AddProductPage = () => {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState([]);
  const [stats, setStats] = useState({
    categories: 0,
    colors: 0, 
    sizes: 0,
    products: 0
  });
  const [loading, setLoading] = useState(true);

  // أيقونات الأقسام المتاحة
  const iconComponents = {
    'Shirt': require('lucide-react').Shirt,
    'ShoppingBag': require('lucide-react').ShoppingBag,
    'Package': Package,
    'Building2': require('lucide-react').Building2
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // جلب الأقسام والإحصائيات
      const [deptResult, catResult, colorResult, sizeResult, prodResult] = await Promise.all([
        supabase.from('departments').select('*').eq('is_active', true).order('display_order'),
        supabase.from('categories').select('*', { count: 'exact' }),
        supabase.from('colors').select('*', { count: 'exact' }),
        supabase.from('sizes').select('*', { count: 'exact' }),
        supabase.from('products').select('*', { count: 'exact' })
      ]);

      setDepartments(deptResult.data || []);
      setStats({
        categories: catResult.count || 0,
        colors: colorResult.count || 0,
        sizes: sizeResult.count || 0,
        products: prodResult.count || 0
      });

    } catch (error) {
      console.error('خطأ في جلب البيانات:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحميل البيانات",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDepartmentSelect = (dept) => {
    // الانتقال لصفحة إضافة المنتج مع تحديد القسم مسبقاً
    navigate('/add-product/create', { 
      state: { 
        selectedDepartment: dept,
        fromDashboard: true 
      } 
    });
  };

  const goToVariantsManager = () => {
    navigate('/manage-variants');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>إضافة منتج جديد - نظام RYUS</title>
        <meta name="description" content="إضافة منتجات جديدة بطريقة احترافية ومنظمة" />
      </Helmet>
      
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <div className="container mx-auto p-6 space-y-8">
          
          {/* Header Section */}
          <div className="relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl border shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/10 to-blue-600/10" />
            <div className="relative p-8">
              <div className="flex items-center gap-6 mb-6">
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/products')}
                  className="hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
                >
                  <ArrowRight className="h-4 w-4 ml-2" />
                  رجوع
                </Button>
                <div className="flex-1">
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">
                    إضافة منتج جديد
                  </h1>
                  <p className="text-lg text-muted-foreground max-w-2xl">
                    نظام متطور وذكي لإضافة المنتجات بطريقة احترافية ومنظمة
                  </p>
                </div>
              </div>

              {/* إحصائيات سريعة */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-emerald-200 dark:border-emerald-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
                        <Package className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">المنتجات</p>
                        <p className="text-lg font-bold text-emerald-800 dark:text-emerald-200">{stats.products}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                        <Tags className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-blue-600 dark:text-blue-400">التصنيفات</p>
                        <p className="text-lg font-bold text-blue-800 dark:text-blue-200">{stats.categories}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                        <Palette className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-purple-600 dark:text-purple-400">الألوان</p>
                        <p className="text-lg font-bold text-purple-800 dark:text-purple-200">{stats.colors}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border-orange-200 dark:border-orange-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
                        <Ruler className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-orange-600 dark:text-orange-400">القياسات</p>
                        <p className="text-lg font-bold text-orange-800 dark:text-orange-200">{stats.sizes}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* رسالة تحفيزية */}
              <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 p-6 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-100 dark:bg-emerald-900/50 rounded-full">
                    <Sparkles className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-emerald-800 dark:text-emerald-200">
                      جاهز لإضافة منتج جديد؟
                    </h3>
                    <p className="text-emerald-700 dark:text-emerald-300">
                      اختر القسم المناسب لمنتجك أو ابدأ مباشرة في إضافة منتج عام
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* اختيار القسم */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <TrendingUp className="h-6 w-6 text-primary" />
                اختر القسم المناسب لمنتجك
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {departments.map((dept) => {
                  const IconComponent = iconComponents[dept.icon] || Package;
                  
                  return (
                    <Card 
                      key={dept.id} 
                      className="group cursor-pointer hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/30"
                      onClick={() => handleDepartmentSelect(dept)}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-center gap-4 mb-4">
                          <div className={`p-4 rounded-lg bg-gradient-to-r ${dept.color} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                            <IconComponent className="h-8 w-8 text-white" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                              {dept.name}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {dept.description}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between pt-4 border-t">
                          <Badge variant="secondary" className="text-xs">
                            نشط ومتاح
                          </Badge>
                          <Button variant="ghost" size="sm" className="group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                            اختيار
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                
                {/* خيار الإضافة العامة */}
                <Card 
                  className="group cursor-pointer hover:shadow-lg transition-all duration-300 border-2 border-dashed border-primary/30 hover:border-primary"
                  onClick={() => navigate('/add-product/create')}
                >
                  <CardContent className="p-6 h-full flex flex-col items-center justify-center text-center">
                    <div className="p-4 rounded-lg bg-gradient-to-r from-primary/10 to-primary/20 mb-4 group-hover:scale-110 transition-transform duration-300">
                      <Plus className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors mb-2">
                      إضافة عامة
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      ابدأ بإضافة منتج بدون تحديد قسم مسبق
                    </p>
                    <Button variant="outline" size="sm" className="group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      ابدأ الآن
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* إدارة المتغيرات */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Settings className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">إدارة المتغيرات والتصنيفات</h3>
                    <p className="text-muted-foreground">إضافة وتعديل الألوان، القياسات، والتصنيفات</p>
                  </div>
                </div>
                  <Button onClick={goToVariantsManager} variant="outline">
                    <Settings className="h-4 w-4 ml-2" />
                    إدارة المتغيرات
                  </Button>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </>
  );
};

export default AddProductPage;