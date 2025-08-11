import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import useInventoryStats from '@/hooks/useInventoryStats';
import { 
  Package, 
  Shirt, 
  ShoppingBag, 
  PackageOpen,
  Crown,
  Star,
  Archive
} from 'lucide-react';

const DepartmentOverviewCards = ({ onDepartmentFilter, extraCard = null }) => {
  const { stats, loading } = useInventoryStats();
  const departments = stats.departments || [];

  // تحديد موضع قسم الأحذية لإدراج كرت لاحقًا
  const shoesIndex = departments.findIndex((d) => {
    const n = (d?.name || '').toLowerCase();
    return n.includes('أحذية') || n.includes('shoes');
  });
  // تحديد موضع قسم المواد العامة لعكسه مع الأرشيف
  const generalIndex = departments.findIndex((d) => {
    const n = (d?.name || '').toLowerCase();
    return n.includes('مواد عامة') || n.includes('general');
  });
  const generalDept = generalIndex >= 0 ? departments[generalIndex] : null;

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
      <div className="grid grid-cols-2 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {departments.map((dept, index) => {
          const IconComponent = getIconForDepartment(dept.name, index);
          const isGeneral = index === generalIndex;

          return (
            <React.Fragment key={`dept-${dept.id}-${index}`}>
              {/* إن كان هذا موضع المواد العامة فنستبدله بكرت الأرشيف */}
              {isGeneral ? (
                <Card
                  className="cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl relative overflow-hidden min-h-[180px]"
                  onClick={() => onDepartmentFilter && onDepartmentFilter({ id: 'archived', name: 'أرشيف المنتجات', archived: true })}
                >
                  <CardContent className="p-4">
                    <div className="text-center space-y-3 bg-gradient-to-br from-slate-500 to-slate-700 text-white rounded-lg p-4 relative overflow-hidden h-full flex flex-col justify-between">
                      <div className="absolute top-2 right-2">
                        <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs">أرشيف</Badge>
                      </div>
                      <div className="flex justify-center">
                        <div className="p-3 bg-white/10 rounded-full backdrop-blur-sm">
                          <Archive className="w-8 h-8" />
                        </div>
                      </div>
                      <div>
                        <h4 className="font-bold text-sm md:text-base leading-none whitespace-nowrap truncate">أرشيف المنتجات</h4>
                        <p className="text-xs opacity-90 mt-1">المنتجات النافذة والمؤرشفة</p>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-white/20">
                        <div className="text-right">
                          <p className="text-xl font-bold">0</p>
                          <p className="text-white/80 text-xs">منتج</p>
                        </div>
                        <div className="flex items-center gap-1 text-white/70">
                          <Archive className="w-4 h-4" />
                          <span className="text-xs">أرشيف</span>
                        </div>
                      </div>
                      <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-white/5 rounded-full"></div>
                      <div className="absolute -top-2 -left-2 w-12 h-12 bg-white/5 rounded-full"></div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card 
                  className="cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl relative overflow-hidden min-h-[180px]"
                  onClick={() => onDepartmentFilter && onDepartmentFilter(dept)}
                >
                  <CardContent className="p-4">
                    <div className={`text-center space-y-3 bg-gradient-to-br ${getGradientForIndex(index)} text-white rounded-lg p-4 relative overflow-hidden h-full flex flex-col justify-between`}>
                      {/* رقم القسم */}
                      <div className="absolute top-2 right-2">
                        <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs">
                          {dept.display_order || (index + 1)}
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
                          <p className="text-xl font-bold">{dept.product_count || 0}</p>
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
              )}

              {/* كرت المواد العامة أسفل كرت الأحذية مباشرة (عكس الموضع) */}
              {index === shoesIndex && generalDept && (
                <Card
                  className="cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl relative overflow-hidden min-h-[180px]"
                  onClick={() => onDepartmentFilter && onDepartmentFilter(generalDept)}
                >
                  <CardContent className="p-4">
                    <div className={`text-center space-y-3 bg-gradient-to-br ${getGradientForIndex(generalIndex)} text-white rounded-lg p-4 relative overflow-hidden h-full flex flex-col justify-between`}>
                      <div className="absolute top-2 right-2">
                        <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs">
                          {generalDept.display_order || (generalIndex + 1)}
                        </Badge>
                      </div>
                      <div className="flex justify-center">
                        <div className="p-3 bg-white/10 rounded-full backdrop-blur-sm">
                          {(() => {
                            const IconGen = getIconForDepartment(generalDept.name, generalIndex);
                            return <IconGen className="w-8 h-8" />;
                          })()}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-bold text-lg">{generalDept.name}</h4>
                        {generalDept.description && (
                          <p className="text-xs opacity-90 mt-1">{generalDept.description}</p>
                        )}
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-white/20">
                        <div className="text-right">
                          <p className="text-xl font-bold">{generalDept.product_count || 0}</p>
                          <p className="text-white/80 text-xs">منتج</p>
                        </div>
                        <div className="flex items-center gap-1 text-white/70">
                          <Package className="w-4 h-4" />
                          <span className="text-xs">متاح</span>
                        </div>
                      </div>
                      <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-white/5 rounded-full"></div>
                      <div className="absolute -top-2 -left-2 w-12 h-12 bg-white/5 rounded-full"></div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default DepartmentOverviewCards;
