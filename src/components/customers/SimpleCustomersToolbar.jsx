import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Search, 
  Filter, 
  Users, 
  Star, 
  Phone, 
  X,
  Clock,
  History,
  ChevronDown
} from 'lucide-react';

const SimpleCustomersToolbar = ({ 
  searchTerm, 
  onSearchChange, 
  filterType, 
  onFilterChange,
  totalCount,
  filteredCount,
  loyaltyTiers = [] // إضافة مستويات الولاء
}) => {
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);

  const filterOptions = [
    { id: 'all', label: 'جميع العملاء', icon: Users, count: totalCount },
    { id: 'with_points', label: 'عملاء مع نقاط', icon: Star },
    { id: 'with_phone', label: 'عملاء مع هواتف', icon: Phone },
    { id: 'male_customers', label: 'عملاء رجال', icon: Users },
    { id: 'female_customers', label: 'عميلات نساء', icon: Users },
    { id: 'points_used', label: 'استخدموا النقاط', icon: History },
    { id: 'points_expired', label: 'نقاط منتهية الصلاحية', icon: Clock }
  ];

  // إضافة مستويات الولاء إلى خيارات الفلتر
  const tierFilters = loyaltyTiers.map(tier => ({
    id: `tier_${tier.id}`,
    label: `مستوى ${tier.name}`,
    icon: Star,
    tierData: tier
  }));

  const allFilterOptions = [...filterOptions, ...tierFilters];
  const activeFilter = allFilterOptions.find(f => f.id === filterType);

  return (
    <Card className="mb-6 border-border/50 bg-card/80 backdrop-blur-sm shadow-xl shadow-black/5 dark:shadow-black/20">
      <CardContent className="p-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          {/* شريط البحث */}
          <div className="flex-1 max-w-lg">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="البحث بالاسم، الهاتف أو الإيميل..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-4 pr-12 h-12 bg-background/60 border-border/50 focus:border-primary/50 rounded-xl text-right"
                dir="rtl"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute left-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => onSearchChange('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* زر الفلترة المتقدمة */}
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className={`
                    h-12 px-4 bg-background/60 border-border/50 hover:bg-primary/5 hover:border-primary/30
                    transition-all duration-300 rounded-xl
                    ${filterType !== 'all' ? 'border-primary/50 bg-primary/5' : ''}
                  `}
                >
                  <Filter className={`h-4 w-4 mr-2 ${filterType !== 'all' ? 'text-primary' : ''}`} />
                  <span className="font-medium">
                    {filterType !== 'all' ? activeFilter?.label : 'فلترة متقدمة'}
                  </span>
                  <ChevronDown className="h-4 w-4 ml-2" />
                  {filterType !== 'all' && (
                    <Badge variant="secondary" className="ml-2 px-1.5 py-0.5 text-xs bg-primary/10 text-primary">
                      نشط
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 bg-card/95 backdrop-blur-sm border-border/50 max-h-80 overflow-y-auto">
                {/* الفلاتر الأساسية */}
                {filterOptions.map((filter, index) => {
                  const Icon = filter.icon;
                  const isActive = filterType === filter.id;
                  
                  return (
                    <div key={filter.id}>
                      <DropdownMenuItem
                        onClick={() => onFilterChange(filter.id)}
                        className={`
                          cursor-pointer transition-all duration-200 rounded-lg mx-1
                          ${isActive 
                            ? 'bg-primary/10 text-primary font-medium' 
                            : 'hover:bg-accent/50'
                          }
                        `}
                      >
                        <Icon className={`h-4 w-4 mr-2 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="flex-1">{filter.label}</span>
                        {filter.count !== undefined && (
                          <Badge variant="outline" className="text-xs">
                            {filter.count}
                          </Badge>
                        )}
                        {isActive && (
                          <div className="w-2 h-2 rounded-full bg-primary ml-2"></div>
                        )}
                      </DropdownMenuItem>
                      {index === 0 && <DropdownMenuSeparator className="mx-2" />}
                    </div>
                  );
                })}

                {/* مستويات الولاء */}
                {tierFilters.length > 0 && (
                  <>
                    <DropdownMenuSeparator className="mx-2" />
                    <div className="px-3 py-2 text-xs font-semibold text-muted-foreground">
                      مستويات الولاء
                    </div>
                    {tierFilters.map((filter) => {
                      const Icon = filter.icon;
                      const isActive = filterType === filter.id;
                      
                      return (
                        <DropdownMenuItem
                          key={filter.id}
                          onClick={() => onFilterChange(filter.id)}
                          className={`
                            cursor-pointer transition-all duration-200 rounded-lg mx-1
                            ${isActive 
                              ? 'bg-primary/10 text-primary font-medium' 
                              : 'hover:bg-accent/50'
                            }
                          `}
                        >
                          <Icon className={`h-4 w-4 mr-2 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                          <span className="flex-1">{filter.label}</span>
                          {filter.tierData && (
                            <div 
                              className="w-3 h-3 rounded-full ml-2" 
                              style={{ backgroundColor: filter.tierData.color }}
                            />
                          )}
                          {isActive && (
                            <div className="w-2 h-2 rounded-full bg-primary ml-2"></div>
                          )}
                        </DropdownMenuItem>
                      );
                    })}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* إحصائيات النتائج */}
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="px-3 py-1.5 text-sm bg-background/60 text-foreground">
                {filteredCount} من {totalCount}
              </Badge>
              
              {filteredCount !== totalCount && (
                <Badge variant="outline" className="px-3 py-1.5 border-primary/30 text-primary bg-primary/5">
                  مفلتر
                </Badge>
              )}
            </div>
          </div>
        </div>


        {/* رسالة عدم وجود نتائج */}
        {filteredCount === 0 && searchTerm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-6 mt-4"
          >
            <p className="text-muted-foreground mb-2">
              لا توجد نتائج للبحث عن "{searchTerm}"
            </p>
            <Button
              variant="link"
              size="sm"
              onClick={() => onSearchChange('')}
              className="text-primary hover:text-primary/80"
            >
              مسح البحث
            </Button>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
};

export default SimpleCustomersToolbar;