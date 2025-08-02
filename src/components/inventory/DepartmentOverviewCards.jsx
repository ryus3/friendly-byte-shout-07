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

      // جلب عدد المنتجات لكل قسم
      const { data: productsData } = await supabase
        .from('product_departments')
        .select('department_id, products(id)')
        .eq('products.is_active', true);

      // حساب عدد المنتجات لكل قسم
      const productCounts = {};
      productsData?.forEach(pd => {
        if (productCounts[pd.department_id]) {
          productCounts[pd.department_id]++;
        } else {
          productCounts[pd.department_id] = 1;
        }
      });

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {departments.map((dept, index) => {
          const IconComponent = getIconForDepartment(dept.name, index);
          
          return (
            <Card 
              key={dept.id}
              className="cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl relative overflow-hidden"
              onClick={() => onDepartmentFilter && onDepartmentFilter(dept)}
            >
              <CardContent className="p-6">
                <div className={`text-center space-y-4 bg-gradient-to-br ${getGradientForIndex(index)} text-white rounded-lg p-6 relative overflow-hidden`}>
                  {/* رقم القسم */}
                  <div className="absolute top-2 right-2">
                    <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs">
                      {dept.order}
                    </Badge>
                  </div>
                  
                  {/* الأيقونة */}
                  <div className="flex justify-center">
                    <div className="p-3 bg-white/10 rounded-full backdrop-blur-sm">
                      <IconComponent className="w-8 h-8" />
                    </div>
                  </div>
                  
                  {/* اسم القسم */}
                  <div>
                    <h4 className="font-bold text-lg">{dept.name}</h4>
                    {dept.description && (
                      <p className="text-xs opacity-90 mt-1">{dept.description}</p>
                    )}
                  </div>
                  
                  {/* عدد المنتجات */}
                  <div className="flex items-center justify-between pt-2 border-t border-white/20">
                    <div className="text-right">
                      <p className="text-xl font-bold">{dept.productCount}</p>
                      <p className="text-white/80 text-xs">منتج</p>
                    </div>
                    <div className="flex items-center gap-1 text-white/70">
                      <Package className="w-4 h-4" />
                      <span className="text-xs">متاح</span>
                    </div>
                  </div>
                  
                  {/* تأثير الخلفية */}
                  <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-white/5 rounded-full"></div>
                  <div className="absolute -top-2 -left-2 w-12 h-12 bg-white/5 rounded-full"></div>
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