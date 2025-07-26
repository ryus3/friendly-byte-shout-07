
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Filter, ChevronDown, ChevronUp, X, Users, Star, Phone, Gift } from 'lucide-react';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const CustomerFilters = ({
  filters,
  setFilters,
  loyaltyTiers = [],
  departments = []
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value });
  };

  const resetFilters = () => {
    setFilters({
      searchTerm: '',
      timeFilter: 'all',
      pointsFilter: 'all',
      loyaltyTierFilter: 'all',
      genderSegmentation: 'all',
      departmentFilter: 'all',
      dateRange: null
    });
  };

  const hasActiveFilters = 
    filters.searchTerm !== '' ||
    filters.timeFilter !== 'all' ||
    filters.pointsFilter !== 'all' ||
    filters.loyaltyTierFilter !== 'all' ||
    filters.genderSegmentation !== 'all' ||
    filters.departmentFilter !== 'all' ||
    filters.dateRange !== null;

  return (
    <div className="space-y-4">

      {/* Search Bar */}
      <div className="relative">
        <Input
          placeholder="ابحث بالاسم أو الهاتف أو البريد الإلكتروني..."
          value={filters.searchTerm || ''}
          onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
          className="pr-12"
        />
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
        >
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {/* Advanced Filters */}
      <Card>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Filter className="h-5 w-5" />
                  فلاتر متقدمة
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="mr-2">
                      {Object.values(filters).filter(v => v !== '' && v !== 'all' && v !== null).length}
                    </Badge>
                  )}
                </CardTitle>
                {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <CardContent className="space-y-6">
              {/* Time and Points Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">فلتر الوقت</Label>
                  <Select value={filters.timeFilter} onValueChange={(value) => handleFilterChange('timeFilter', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الفترات</SelectItem>
                      <SelectItem value="today">اليوم</SelectItem>
                      <SelectItem value="week">هذا الأسبوع</SelectItem>
                      <SelectItem value="month">هذا الشهر</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">فلتر النقاط</Label>
                  <Select value={filters.pointsFilter} onValueChange={(value) => handleFilterChange('pointsFilter', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل العملاء</SelectItem>
                      <SelectItem value="with_points">لديهم نقاط</SelectItem>
                      <SelectItem value="no_points">بدون نقاط</SelectItem>
                      <SelectItem value="high_points">نقاط عالية (+1000)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">مستوى الولاء</Label>
                  <Select value={filters.loyaltyTierFilter} onValueChange={(value) => handleFilterChange('loyaltyTierFilter', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل المستويات</SelectItem>
                      {loyaltyTiers.map((tier) => (
                        <SelectItem key={tier.id} value={tier.id}>
                          {tier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Gender and Department Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">الجمهور المستهدف</Label>
                  <Select value={filters.genderSegmentation} onValueChange={(value) => handleFilterChange('genderSegmentation', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الجمهور</SelectItem>
                      <SelectItem value="male">🧑 جمهور رجالي</SelectItem>
                      <SelectItem value="female">👩 جمهور نسائي</SelectItem>
                      <SelectItem value="unisex">👥 للجنسين</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">الأقسام والتصنيفات</Label>
                  <Select value={filters.departmentFilter} onValueChange={(value) => handleFilterChange('departmentFilter', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الأقسام</SelectItem>
                      {departments.map((dept) => (
                        <SelectItem key={`${dept.type}-${dept.id}`} value={dept.id}>
                          {dept.name} ({dept.type === 'department' ? 'قسم' : 'تصنيف'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Date Range */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">نطاق التاريخ</Label>
                <DateRangePicker
                  date={filters.dateRange}
                  onDateChange={(date) => handleFilterChange('dateRange', date)}
                />
              </div>

              {/* Active Filters Display */}
              {hasActiveFilters && (
                <div className="flex flex-wrap gap-2 p-3 bg-accent/30 rounded-lg">
                  <span className="text-sm font-medium text-muted-foreground">الفلاتر النشطة:</span>
                  {filters.searchTerm && (
                    <Badge variant="secondary" className="gap-1">
                      البحث: {filters.searchTerm}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => handleFilterChange('searchTerm', '')} />
                    </Badge>
                  )}
                  {filters.timeFilter !== 'all' && (
                    <Badge variant="secondary" className="gap-1">
                      الوقت: {filters.timeFilter}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => handleFilterChange('timeFilter', 'all')} />
                    </Badge>
                  )}
                  {filters.genderSegmentation !== 'all' && (
                    <Badge variant="secondary" className="gap-1">
                      الجمهور: {
                        filters.genderSegmentation === 'male' ? 'رجالي' :
                        filters.genderSegmentation === 'female' ? 'نسائي' : 'للجنسين'
                      }
                      <X className="h-3 w-3 cursor-pointer" onClick={() => handleFilterChange('genderSegmentation', 'all')} />
                    </Badge>
                  )}
                </div>
              )}

              {/* Reset Button */}
              {hasActiveFilters && (
                <div className="flex justify-center pt-4 border-t">
                  <Button variant="outline" onClick={resetFilters} className="gap-2">
                    <X className="h-4 w-4" />
                    مسح جميع الفلاتر
                  </Button>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
};

export default CustomerFilters;
