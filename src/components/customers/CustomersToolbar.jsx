import React from 'react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Search, 
  Filter, 
  Users, 
  Star, 
  Phone, 
  X,
  SortAsc,
  SortDesc
} from 'lucide-react';

const CustomersToolbar = ({ 
  searchTerm, 
  onSearchChange, 
  filterType, 
  onFilterChange,
  totalCount,
  filteredCount
}) => {
  const filterOptions = [
    { id: 'all', label: 'جميع العملاء', icon: Users, count: totalCount },
    { id: 'with_points', label: 'مع نقاط', icon: Star, active: true },
    { id: 'with_phone', label: 'مع هواتف', icon: Phone, active: true },
    { id: 'no_points', label: 'بدون نقاط', icon: Users, active: false }
  ];

  const activeFilter = filterOptions.find(f => f.id === filterType);

  return (
    <Card className="mb-6 border-border/50 bg-card/80 backdrop-blur-sm shadow-lg">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* شريط البحث والإحصائيات */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="البحث بالاسم، الهاتف أو الإيميل..."
                  value={searchTerm}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-4 pr-10 h-11 bg-background/50 border-border/50 focus:border-primary/50"
                  dir="rtl"
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute left-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                    onClick={() => onSearchChange('')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
            
            {/* إحصائيات النتائج */}
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="px-3 py-1">
                النتائج: {filteredCount} من {totalCount}
              </Badge>
              
              {filteredCount !== totalCount && (
                <Badge variant="outline" className="px-3 py-1 border-primary/30 text-primary">
                  <Filter className="h-3 w-3 mr-1" />
                  مفلتر
                </Badge>
              )}
            </div>
          </div>

          {/* أزرار الفلترة */}
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((filter) => {
              const Icon = filter.icon;
              const isActive = filterType === filter.id;
              
              return (
                <motion.div
                  key={filter.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    onClick={() => onFilterChange(filter.id)}
                    className={`
                      h-9 px-3 transition-all duration-300
                      ${isActive 
                        ? 'bg-primary text-primary-foreground shadow-lg' 
                        : 'hover:bg-primary/10 hover:border-primary/30'
                      }
                    `}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    <span className="font-medium">{filter.label}</span>
                    {filter.count !== undefined && (
                      <Badge 
                        variant={isActive ? "secondary" : "outline"} 
                        className={`
                          ml-2 px-1.5 py-0.5 text-xs
                          ${isActive 
                            ? 'bg-primary-foreground/20 text-primary-foreground border-0' 
                            : 'bg-muted/50'
                          }
                        `}
                      >
                        {filter.count}
                      </Badge>
                    )}
                  </Button>
                </motion.div>
              );
            })}
          </div>

          {/* مؤشر الفلتر النشط */}
          {filterType !== 'all' && activeFilter && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 p-3 bg-gradient-to-r from-primary/5 to-blue/5 rounded-lg border border-primary/20"
            >
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                  <Filter className="h-3 w-3 mr-1" />
                  الفلتر النشط: {activeFilter.label}
                </Badge>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onFilterChange('all')}
                className="h-8 px-3 text-primary hover:bg-primary/10 hover:text-primary"
              >
                <X className="h-3 w-3 mr-1" />
                إزالة الفلتر
              </Button>
            </motion.div>
          )}

          {/* رسالة عدم وجود نتائج */}
          {filteredCount === 0 && searchTerm && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-4"
            >
              <p className="text-muted-foreground">
                لا توجد نتائج للبحث عن "{searchTerm}"
              </p>
              <Button
                variant="link"
                size="sm"
                onClick={() => onSearchChange('')}
                className="mt-2 text-primary"
              >
                مسح البحث
              </Button>
            </motion.div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CustomersToolbar;