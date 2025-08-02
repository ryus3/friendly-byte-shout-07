import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/customSupabaseClient';
import { 
  Package, 
  Shirt, 
  ShoppingBag, 
  PackageOpen,
  Crown,
  Star,
  Archive
} from 'lucide-react';

const DepartmentOverviewCards = ({ onDepartmentFilter }) => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalProducts, setTotalProducts] = useState(0);

  // جلب البيانات من قاعدة البيانات
  useEffect(() => {
    fetchDepartmentsData();
  }, []);

  const fetchDepartmentsData = async () => {
    try {
      setLoading(true);

      // جلب الأقسام الرئيسية
      const { data: deptData, error: deptError } = await supabase
        .from('departments')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (deptError) throw deptError;

      // ترتيب الأقسام حسب الأولوية المطلوبة
      const orderedDepts = [];
      const clothingDept = deptData?.find(d => d.name.includes('ملابس') || d.name.toLowerCase().includes('clothes'));
      const shoesDept = deptData?.find(d => d.name.includes('أحذية') || d.name.toLowerCase().includes('shoes'));
      const generalDept = deptData?.find(d => d.name.includes('مواد عامة') || d.name.includes('عامة') || d.name.toLowerCase().includes('general'));

      // إضافة الأقسام بالترتيب المطلوب
      if (clothingDept) orderedDepts.push({ ...clothingDept, order: 1 });
      if (shoesDept) orderedDepts.push({ ...shoesDept, order: 2 });
      if (generalDept) orderedDepts.push({ ...generalDept, order: 3 });

      // إضافة باقي الأقسام
      const otherDepts = deptData?.filter(d => 
        d !== clothingDept && d !== shoesDept && d !== generalDept
      ) || [];
      
      otherDepts.forEach((dept, index) => {
        orderedDepts.push({ ...dept, order: 4 + index });
      });

      // جلب عدد المنتجات لكل قسم بطريقة مصححة
      const { data: productsData, error: productError } = await supabase
        .from('products')
        .select(`
          id, 
          is_active,
          product_departments!inner(department_id)
        `)
        .eq('is_active', true);

      console.log('جلب بيانات المنتجات للأقسام:', productsData);
      if (productError) {
        console.error('خطأ في جلب المنتجات:', productError);
      }

      // حساب عدد المنتجات لكل قسم
      const productCounts = {};
      if (productsData && Array.isArray(productsData)) {
        productsData.forEach(product => {
          if (product.product_departments && Array.isArray(product.product_departments)) {
            product.product_departments.forEach(pd => {
              if (pd.department_id) {
                if (productCounts[pd.department_id]) {
                  productCounts[pd.department_id]++;
                } else {
                  productCounts[pd.department_id] = 1;
                }
              }
            });
          }
        });
      }

      console.log('Product counts by department:', productCounts);

      // إضافة العدد للأقسام
      const deptsWithCounts = orderedDepts.map(dept => ({
        ...dept,
        productCount: productCounts[dept.id] || 0
      }));

      setDepartments(deptsWithCounts);

      // حساب إجمالي المنتجات
      const total = Object.values(productCounts).reduce((sum, count) => sum + count, 0);
      setTotalProducts(total);

    } catch (error) {
      console.error('خطأ في جلب بيانات الأقسام:', error);
    } finally {
      setLoading(false);
    }
  };

  // أيقونات للأقسام المختلفة
  const getIconForDepartment = (name, index) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('ملابس') || lowerName.includes('clothes')) return Shirt;
    if (lowerName.includes('حقائب') || lowerName.includes('bag')) return ShoppingBag;
    if (lowerName.includes('أحذية') || lowerName.includes('shoes')) return PackageOpen;
    if (lowerName.includes('إكسسوار') || lowerName.includes('accessories')) return Crown;
    if (lowerName.includes('مواد عامة') || lowerName.includes('عامة')) return Package;
    return Package;
  };

  // ألوان متدرجة للكروت مع تنويع أكبر
  const getGradientForIndex = (index) => {
    const gradients = [
      'from-blue-500 to-blue-700',        // ملابس - أزرق
      'from-orange-500 to-red-600',       // أحذية - برتقالي لأحمر  
      'from-purple-500 to-pink-600',      // مواد عامة - بنفسجي لوردي
      'from-emerald-500 to-teal-600',     // قسم رابع - أخضر لتيل
      'from-yellow-500 to-orange-600',    // قسم خامس - أصفر لبرتقالي
      'from-indigo-500 to-purple-600',    // قسم سادس - نيلي لبنفسجي
      'from-cyan-500 to-blue-600'         // قسم سابع - سماوي
    ];
    
    return gradients[index % gradients.length];
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-32 bg-muted rounded-lg"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* كروت الأقسام */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {departments.map((dept, index) => {
          const IconComponent = getIconForDepartment(dept.name, index);
          
          return (
            <Card 
              key={dept.id}
              className="cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-xl relative overflow-hidden h-full"
              onClick={() => onDepartmentFilter && onDepartmentFilter(dept)}
            >
              <CardContent className="p-0 h-full">
                <div className={`h-full min-h-[180px] text-center flex flex-col justify-between bg-gradient-to-br ${getGradientForIndex(index)} text-white rounded-lg p-4 relative overflow-hidden`}>
                  {/* رقم القسم */}
                  <div className="absolute top-2 right-2 z-10">
                    <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs font-medium">
                      {dept.order}
                    </Badge>
                  </div>
                  
                  {/* الجزء العلوي */}
                  <div className="space-y-3">
                    {/* الأيقونة */}
                    <div className="flex justify-center">
                      <div className="p-3 bg-white/15 rounded-full backdrop-blur-sm shadow-lg">
                        <IconComponent className="w-7 h-7" />
                      </div>
                    </div>
                    
                    {/* اسم القسم */}
                    <div>
                      <h4 className="font-bold text-base leading-tight">{dept.name}</h4>
                      {dept.description && (
                        <p className="text-xs opacity-85 mt-1 line-clamp-2">{dept.description}</p>
                      )}
                    </div>
                  </div>
                  
                  {/* الجزء السفلي - عدد المنتجات */}
                  <div className="mt-4 pt-3 border-t border-white/25">
                    <div className="flex items-center justify-between">
                      <div className="text-right">
                        <p className="text-2xl font-bold">{dept.productCount}</p>
                        <p className="text-white/75 text-xs">منتج</p>
                      </div>
                      <div className="flex items-center gap-1 text-white/70">
                        <Package className="w-4 h-4" />
                        <span className="text-xs">متاح</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* تأثيرات الخلفية */}
                  <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-white/5 rounded-full"></div>
                  <div className="absolute -top-4 -left-4 w-16 h-16 bg-white/5 rounded-full"></div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-white/3 rounded-full"></div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default DepartmentOverviewCards;