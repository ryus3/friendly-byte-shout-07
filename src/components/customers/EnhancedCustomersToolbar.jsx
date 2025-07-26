import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, 
  Filter, 
  Users, 
  Star, 
  Phone, 
  X,
  CalendarDays,
  Clock,
  History
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const EnhancedCustomersToolbar = ({ 
  searchTerm, 
  onSearchChange, 
  filterType, 
  onFilterChange,
  totalCount,
  filteredCount,
  dateRange,
  onDateRangeChange,
  pointsUsageFilter,
  onPointsUsageFilterChange
}) => {
  const [showDatePicker, setShowDatePicker] = useState(false);

  const filterOptions = [
    { id: 'all', label: 'جميع العملاء', icon: Users, count: totalCount },
    { id: 'with_points', label: 'مع نقاط', icon: Star, active: true },
    { id: 'with_phone', label: 'مع هواتف', icon: Phone, active: true },
    { id: 'points_used', label: 'استخدموا النقاط', icon: History, active: true },
    { id: 'points_expired', label: 'نقاط منتهية الصلاحية', icon: Clock, active: false }
  ];

  const timeRangeOptions = [
    { value: 'all', label: 'كل الوقت' },
    { value: 'today', label: 'اليوم' },
    { value: 'week', label: 'آخر أسبوع' },
    { value: 'month', label: 'آخر شهر' },
    { value: 'quarter', label: 'آخر ثلاثة أشهر' },
    { value: 'year', label: 'آخر سنة' },
    { value: 'custom', label: 'نطاق مخصص' }
  ];

  const activeFilter = filterOptions.find(f => f.id === filterType);

  return (
    <Card className="mb-6 border-border/50 bg-gradient-to-r from-card/80 to-card/60 backdrop-blur-sm shadow-xl">
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* شريط البحث الرئيسي */}
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="البحث بالاسم، الهاتف أو الإيميل..."
                  value={searchTerm}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-4 pr-10 h-12 bg-background/50 border-border/50 focus:border-primary/50 rounded-xl"
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
              <Badge variant="secondary" className="px-4 py-2 text-sm">
                النتائج: {filteredCount} من {totalCount}
              </Badge>
              
              {filteredCount !== totalCount && (
                <Badge variant="outline" className="px-4 py-2 border-primary/30 text-primary">
                  <Filter className="h-3 w-3 mr-1" />
                  مفلتر
                </Badge>
              )}
            </div>
          </div>

          {/* أدوات الفلترة المتقدمة */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* فلترة النوع */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">نوع العملاء</label>
              <div className="flex flex-wrap gap-2">
                {filterOptions.slice(0, 3).map((filter) => {
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
                          h-10 px-4 transition-all duration-300
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
                            className="ml-2 px-1.5 py-0.5 text-xs"
                          >
                            {filter.count}
                          </Badge>
                        )}
                      </Button>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* فلترة المدة الزمنية */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">المدة الزمنية</label>
              <Select defaultValue="all" onValueChange={(value) => {
                if (value === 'custom') {
                  setShowDatePicker(true);
                } else {
                  onDateRangeChange(value);
                }
              }}>
                <SelectTrigger className="h-10 bg-background/50">
                  <SelectValue placeholder="اختر المدة" />
                </SelectTrigger>
                <SelectContent>
                  {timeRangeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* فلترة استخدام النقاط */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">استخدام النقاط</label>
              <div className="flex gap-2">
                {filterOptions.slice(3).map((filter) => {
                  const Icon = filter.icon;
                  const isActive = pointsUsageFilter === filter.id;
                  
                  return (
                    <motion.div
                      key={filter.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Button
                        variant={isActive ? "default" : "outline"}
                        size="sm"
                        onClick={() => onPointsUsageFilterChange(filter.id)}
                        className={`
                          h-10 px-3 transition-all duration-300
                          ${isActive 
                            ? 'bg-primary text-primary-foreground shadow-lg' 
                            : 'hover:bg-primary/10 hover:border-primary/30'
                          }
                        `}
                      >
                        <Icon className="h-4 w-4 mr-1" />
                        <span className="text-xs font-medium">{filter.label.split(' ')[0]}</span>
                      </Button>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* مؤشر الفلاتر النشطة */}
          {(filterType !== 'all' || pointsUsageFilter !== 'all') && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 p-4 bg-gradient-to-r from-primary/5 to-blue/5 rounded-lg border border-primary/20"
            >
              <div className="flex items-center flex-wrap gap-2">
                {filterType !== 'all' && (
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                    <Filter className="h-3 w-3 mr-1" />
                    {activeFilter?.label}
                  </Badge>
                )}
                
                {pointsUsageFilter !== 'all' && (
                  <Badge variant="secondary" className="bg-blue/10 text-blue-600 border-blue/20">
                    <Clock className="h-3 w-3 mr-1" />
                    {filterOptions.find(f => f.id === pointsUsageFilter)?.label}
                  </Badge>
                )}
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onFilterChange('all');
                  onPointsUsageFilterChange('all');
                }}
                className="h-8 px-3 text-primary hover:bg-primary/10"
              >
                <X className="h-3 w-3 mr-1" />
                مسح الفلاتر
              </Button>
            </motion.div>
          )}

          {/* منتقي التاريخ المخصص */}
          <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
            <PopoverTrigger asChild>
              <div />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={(range) => {
                  onDateRangeChange(range);
                  setShowDatePicker(false);
                }}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
                locale={ar}
              />
            </PopoverContent>
          </Popover>

          {/* رسالة عدم وجود نتائج */}
          {filteredCount === 0 && searchTerm && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-6"
            >
              <p className="text-muted-foreground mb-2">
                لا توجد نتائج للبحث عن "{searchTerm}"
              </p>
              <Button
                variant="link"
                size="sm"
                onClick={() => onSearchChange('')}
                className="text-primary"
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

export default EnhancedCustomersToolbar;