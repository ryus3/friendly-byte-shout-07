import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/customSupabaseClient';
import { 
  Package, 
  Shirt, 
  ShoppingBag, 
  Crown,
  Footprints,
  Sparkles
} from 'lucide-react';

const DepartmentOverviewCards = ({ onFilterSelect, selectedDepartment }) => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const { data } = await supabase
        .from('departments')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (data) {
        setDepartments(data);
      }
    } catch (error) {
      console.error('خطأ في جلب الأقسام:', error);
    } finally {
      setLoading(false);
    }
  };

  const getIconForDepartment = (name) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('ملابس') || lowerName.includes('clothes')) return Shirt;
    if (lowerName.includes('حقائب') || lowerName.includes('bag')) return ShoppingBag;
    if (lowerName.includes('أحذية') || lowerName.includes('shoes')) return Footprints;
    if (lowerName.includes('إكسسوار') || lowerName.includes('accessories')) return Crown;
    if (lowerName.includes('مواد') || lowerName.includes('general')) return Package;
    return Sparkles;
  };

  const getGradientForIndex = (index) => {
    const gradients = [
      'from-blue-600 to-blue-800',
      'from-purple-600 to-purple-800', 
      'from-emerald-600 to-emerald-800',
      'from-orange-600 to-orange-800',
      'from-pink-600 to-pink-800',
      'from-indigo-600 to-indigo-800',
      'from-teal-600 to-teal-800',
      'from-red-600 to-red-800'
    ];
    
    return gradients[index % gradients.length];
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-24 bg-muted rounded-xl"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {departments.map((dept, index) => {
        const IconComponent = getIconForDepartment(dept.name);
        const isSelected = selectedDepartment?.id === dept.id;
        const departmentNumber = index + 1;
        
        return (
          <Card 
            key={dept.id}
            className={`cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-2xl group ${
              isSelected ? 'ring-2 ring-primary shadow-xl scale-105' : 'hover:shadow-lg'
            }`}
            onClick={() => onFilterSelect(dept)}
          >
            <CardContent className="p-0">
              <div className={`relative bg-gradient-to-br ${getGradientForIndex(index)} text-white rounded-xl p-6 h-full min-h-[120px] flex flex-col justify-between overflow-hidden`}>
                {/* رقم القسم */}
                <div className="absolute top-3 left-3 w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold">{departmentNumber}</span>
                </div>

                {/* شعاع ضوئي خلفي */}
                <div className="absolute -top-10 -right-10 w-20 h-20 bg-white/10 rounded-full blur-xl"></div>
                <div className="absolute -bottom-8 -left-8 w-16 h-16 bg-white/5 rounded-full blur-lg"></div>

                {/* محتوى الكارت */}
                <div className="relative z-10 flex flex-col items-center text-center space-y-3">
                  <div className="p-3 bg-white/15 backdrop-blur-sm rounded-xl group-hover:scale-110 transition-transform duration-300">
                    <IconComponent className="w-8 h-8" />
                  </div>
                  
                  <div>
                    <h3 className="font-bold text-lg mb-1">{dept.name}</h3>
                    {dept.description && (
                      <p className="text-xs opacity-90 line-clamp-2">{dept.description}</p>
                    )}
                  </div>
                </div>

                {/* تأثير الانتقاء */}
                {isSelected && (
                  <div className="absolute inset-0 bg-white/10 rounded-xl border-2 border-white/30"></div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default DepartmentOverviewCards;