import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit2, Trash2, MapPin, Building2, Search, Download, Upload, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useCitiesCache } from '@/hooks/useCitiesCache';
import { BulkAliasInput } from './BulkAliasInput';
import { iraqCitiesCommonAliases, getCityAliases } from '@/lib/iraqCitiesAliases';

const CitiesCacheAliasManager = () => {
  const { cities, regions } = useCitiesCache();
  const [cityAliases, setCityAliases] = useState([]);
  const [regionAliases, setRegionAliases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  
  // States for adding new alias
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newAlias, setNewAlias] = useState({
    type: 'city', // 'city' or 'region'
    name: '',
    alias: '',
    confidence: 1.0,
    cityId: '',
    regionId: ''
  });

  // States for bulk operations
  const [bulkAliases, setBulkAliases] = useState([]);
  const [isCommonAliasesDialogOpen, setIsCommonAliasesDialogOpen] = useState(false);
  const [selectedCommonAliases, setSelectedCommonAliases] = useState([]);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [isAddingAliases, setIsAddingAliases] = useState(false);

  // جلب المرادفات عند التحميل
  useEffect(() => {
    fetchAliases();
  }, []);

  const fetchAliases = async () => {
    setLoading(true);
    try {
      // جلب مرادفات المدن مع join يدوي
      const { data: cityData, error: cityError } = await supabase
        .from('city_aliases')
        .select(`
          *,
          city_id,
          alias_name,
          confidence_score,
          created_at
        `)
        .order('confidence_score', { ascending: false });

      if (cityError) {
        console.error('خطأ في جلب مرادفات المدن:', cityError);
        throw cityError;
      }

      // جلب أسماء المدن منفصلة
      const { data: citiesData, error: citiesError } = await supabase
        .from('cities_cache')
        .select('id, name');

      if (citiesError) throw citiesError;

      // ربط البيانات يدوياً
      const cityAliasesWithNames = (cityData || []).map(alias => ({
        ...alias,
        cities_cache: citiesData?.find(city => city.id === alias.city_id) || null
      }));

      // جلب مرادفات المناطق مع join يدوي
      const { data: regionData, error: regionError } = await supabase
        .from('region_aliases')
        .select(`
          *,
          region_id,
          alias_name,
          confidence_score,
          created_at
        `)
        .order('confidence_score', { ascending: false });

      if (regionError) {
        console.error('خطأ في جلب مرادفات المناطق:', regionError);
        throw regionError;
      }

      // جلب أسماء المناطق منفصلة
      const { data: regionsData, error: regionsError } = await supabase
        .from('regions_cache')
        .select('id, name, city_id');

      if (regionsError) throw regionsError;

      // ربط البيانات يدوياً
      const regionAliasesWithNames = (regionData || []).map(alias => ({
        ...alias,
        regions_cache: regionsData?.find(region => region.id === alias.region_id) || null
      }));

      setCityAliases(cityAliasesWithNames);
      setRegionAliases(regionAliasesWithNames);
      
    } catch (error) {
      console.error('خطأ في جلب المرادفات:', error);
      toast({
        title: "خطأ",
        description: "فشل جلب المرادفات",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddAlias = async () => {
    if (!newAlias.name || (!newAlias.alias && bulkAliases.length === 0)) {
      toast({
        title: "خطأ",
        description: "يجب ملء جميع الحقول المطلوبة",
        variant: "destructive"
      });
      return;
    }

    setIsAddingAliases(true);
    try {
      const cityId = cities.find(c => c.name === newAlias.name)?.id;
      if (!cityId) {
        toast({
          title: "خطأ",
          description: "المدينة المحددة غير موجودة",
          variant: "destructive"
        });
        return;
      }

      // Prepare aliases to add
      const aliasesToAdd = isBulkMode ? bulkAliases : [newAlias.alias];
      
      if (aliasesToAdd.length === 0) {
        toast({
          title: "تنبيه",
          description: "لا توجد مرادفات صالحة للإضافة",
          variant: "destructive"
        });
        return;
      }

      // Check for existing aliases
      const { data: existingAliases } = await supabase
        .from('city_aliases')
        .select('alias_name')
        .in('alias_name', aliasesToAdd);

      const existingAliasNames = existingAliases?.map(a => a.alias_name) || [];
      const newAliasesToAdd = aliasesToAdd.filter(a => !existingAliasNames.includes(a));

      if (newAliasesToAdd.length === 0) {
        toast({
          title: "تنبيه",
          description: "جميع المرادفات موجودة مسبقاً",
          variant: "destructive"
        });
        return;
      }

      // Insert new aliases
      const aliasObjects = newAliasesToAdd.map(alias => ({
        city_id: cityId,
        alias_name: alias,
        normalized_name: alias.toLowerCase().replace(/[أإآ]/g, 'ا').replace(/[ة]/g, 'ه'),
        confidence_score: newAlias.confidence
      }));

      const { error } = await supabase.from('city_aliases').insert(aliasObjects);

      if (error) throw error;

      const skippedCount = aliasesToAdd.length - newAliasesToAdd.length;
      toast({
        title: "نجح الإضافة",
        description: `تم إضافة ${newAliasesToAdd.length} مرادف${skippedCount > 0 ? `، تم تجاهل ${skippedCount} مكررات` : ''}`,
        variant: "default"
      });

      setShowAddDialog(false);
      setNewAlias({
        type: 'city',
        name: '',
        alias: '',
        confidence: 1.0,
        cityId: '',
        regionId: ''
      });
      setBulkAliases([]);
      setIsBulkMode(false);
      
      fetchAliases();
    } catch (error) {
      console.error('خطأ في إضافة المرادف:', error);
      toast({
        title: "فشل الإضافة",
        description: error.message || "حدث خطأ أثناء إضافة المرادف",
        variant: "destructive"
      });
    } finally {
      setIsAddingAliases(false);
    }
  };

  const handleAddCommonAliases = async () => {
    if (!newAlias.name || selectedCommonAliases.length === 0) {
      toast({
        title: "خطأ",
        description: "يجب اختيار مرادفات للإضافة",
        variant: "destructive"
      });
      return;
    }

    setIsAddingAliases(true);
    try {
      const cityId = cities.find(c => c.name === newAlias.name)?.id;
      if (!cityId) {
        toast({
          title: "خطأ",
          description: "المدينة المحددة غير موجودة",
          variant: "destructive"
        });
        return;
      }

      // Check for existing aliases
      const aliasNames = selectedCommonAliases.map(a => a.text);
      const { data: existingAliases } = await supabase
        .from('city_aliases')
        .select('alias_name')
        .in('alias_name', aliasNames);

      const existingAliasNames = existingAliases?.map(a => a.alias_name) || [];
      const newAliasesToAdd = selectedCommonAliases.filter(a => !existingAliasNames.includes(a.text));

      if (newAliasesToAdd.length === 0) {
        toast({
          title: "تنبيه",
          description: "جميع المرادفات المحددة موجودة مسبقاً",
          variant: "destructive"
        });
        return;
      }

      // Insert new aliases
      const aliasObjects = newAliasesToAdd.map(alias => ({
        city_id: cityId,
        alias_name: alias.text,
        normalized_name: alias.text.toLowerCase().replace(/[أإآ]/g, 'ا').replace(/[ة]/g, 'ه'),
        confidence_score: alias.confidence
      }));

      const { error } = await supabase.from('city_aliases').insert(aliasObjects);

      if (error) throw error;

      const skippedCount = selectedCommonAliases.length - newAliasesToAdd.length;
      toast({
        title: "نجح الإضافة",
        description: `تم إضافة ${newAliasesToAdd.length} مرادف${skippedCount > 0 ? `، تم تجاهل ${skippedCount} مكررات` : ''}`,
        variant: "default"
      });

      setIsCommonAliasesDialogOpen(false);
      setSelectedCommonAliases([]);
      
      fetchAliases();
    } catch (error) {
      console.error('خطأ في إضافة المرادفات:', error);
      toast({
        title: "فشل الإضافة",
        description: error.message || "حدث خطأ أثناء إضافة المرادفات",
        variant: "destructive"
      });
    } finally {
      setIsAddingAliases(false);
    }
  };

  const handleDeleteAlias = async (id, type) => {
    try {
      const tableName = type === 'city' ? 'city_aliases' : 'region_aliases';
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      
      if (error) throw error;
      
      toast({
        title: "نجح الحذف",
        description: "تم حذف المرادف بنجاح",
        variant: "default"
      });
      
      fetchAliases();
    } catch (error) {
      console.error('خطأ في حذف المرادف:', error);
      toast({
        title: "فشل الحذف",
        description: error.message || "حدث خطأ أثناء حذف المرادف",
        variant: "destructive"
      });
    }
  };

  // Filter aliases based on search
  const filteredCityAliases = cityAliases.filter(alias => 
    alias.alias_name.includes(searchTerm) || 
    alias.cities_cache?.name.includes(searchTerm)
  );

  const filteredRegionAliases = regionAliases.filter(alias => 
    alias.alias_name.includes(searchTerm) || 
    alias.regions_cache?.name.includes(searchTerm) ||
    (selectedCity && selectedCity !== "all" && alias.regions_cache?.city_id.toString() === selectedCity)
  );

  const getConfidenceColor = (score) => {
    if (score >= 0.9) return 'bg-green-100 text-green-800';
    if (score >= 0.7) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const handlePopulateAllAliases = async () => {
    setIsAddingAliases(true);
    try {
      const { data, error } = await supabase.functions.invoke('populate-city-aliases');
      
      if (error) throw error;
      
      if (data.success) {
        toast({
          title: "نجحت العملية",
          description: `تم إضافة ${data.summary.total_added} مرادف، تم تجاهل ${data.summary.total_skipped} مكررات`,
          variant: "default"
        });
        fetchAliases();
      } else {
        throw new Error(data.error || 'فشلت العملية');
      }
    } catch (error) {
      console.error('خطأ في إضافة المرادفات:', error);
      toast({
        title: "فشلت العملية",
        description: error.message || "حدث خطأ أثناء إضافة المرادفات",
        variant: "destructive"
      });
    } finally {
      setIsAddingAliases(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">إدارة المرادفات الذكية</h3>
          <p className="text-sm text-muted-foreground">
            إدارة المرادفات للمدن والمناطق لتحسين دقة البحث الذكي
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={handlePopulateAllAliases}
            disabled={isAddingAliases}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {isAddingAliases ? 'جاري الإضافة...' : 'إضافة جميع المرادفات'}
          </Button>

          <Dialog open={isCommonAliasesDialogOpen} onOpenChange={setIsCommonAliasesDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Sparkles className="h-4 w-4 mr-2" />
                مرادفات شائعة
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>إضافة المرادفات الشائعة</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>المدينة</Label>
                  <Select value={newAlias.name} onValueChange={(value) => {
                    setNewAlias({...newAlias, name: value});
                    setSelectedCommonAliases([]);
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر المدينة" />
                    </SelectTrigger>
                    <SelectContent>
                      {cities.map(city => (
                        <SelectItem key={city.id} value={city.name}>
                          {city.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {newAlias.name && (() => {
                  const cityData = Object.values(iraqCitiesCommonAliases).find(
                    c => c.name === newAlias.name
                  );
                  
                  if (!cityData) return <p className="text-sm text-muted-foreground">لا توجد مرادفات شائعة لهذه المدينة</p>;

                  const aliasesByType = {
                    english: cityData.aliases.filter(a => a.type === 'english'),
                    misspelling: cityData.aliases.filter(a => a.type === 'misspelling'),
                    alternative: cityData.aliases.filter(a => a.type === 'alternative'),
                    abbreviation: cityData.aliases.filter(a => a.type === 'abbreviation'),
                    kurdish: cityData.aliases.filter(a => a.type === 'kurdish'),
                  };

                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">اختر المرادفات للإضافة:</p>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setSelectedCommonAliases(cityData.aliases)}
                          >
                            تحديد الكل ({cityData.aliases.length})
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setSelectedCommonAliases([])}
                          >
                            إلغاء التحديد
                          </Button>
                        </div>
                      </div>

                      {Object.entries(aliasesByType).map(([type, aliases]) => {
                        if (aliases.length === 0) return null;
                        
                        const typeLabels = {
                          english: 'إنجليزي',
                          misspelling: 'أخطاء إملائية',
                          alternative: 'بدائل',
                          abbreviation: 'اختصارات',
                          kurdish: 'كردي'
                        };

                        return (
                          <div key={type} className="space-y-2">
                            <h4 className="text-sm font-medium text-muted-foreground">{typeLabels[type]}</h4>
                            <div className="flex flex-wrap gap-2">
                              {aliases.map((alias, idx) => {
                                const isSelected = selectedCommonAliases.some(a => a.text === alias.text);
                                return (
                                  <Badge
                                    key={idx}
                                    variant={isSelected ? "default" : "outline"}
                                    className="cursor-pointer"
                                    onClick={() => {
                                      if (isSelected) {
                                        setSelectedCommonAliases(prev => prev.filter(a => a.text !== alias.text));
                                      } else {
                                        setSelectedCommonAliases(prev => [...prev, alias]);
                                      }
                                    }}
                                  >
                                    {alias.text} ({(alias.confidence * 100).toFixed(0)}%)
                                  </Badge>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}

                      <div className="pt-4 border-t">
                        <p className="text-sm text-muted-foreground mb-2">
                          المرادفات المحددة: {selectedCommonAliases.length}
                        </p>
                        <div className="flex gap-2">
                          <Button 
                            onClick={handleAddCommonAliases} 
                            disabled={selectedCommonAliases.length === 0 || isAddingAliases}
                            className="flex-1"
                          >
                            {isAddingAliases ? 'جاري الإضافة...' : `إضافة ${selectedCommonAliases.length} مرادف`}
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={() => setIsCommonAliasesDialogOpen(false)} 
                            className="flex-1"
                          >
                            إلغاء
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showAddDialog} onOpenChange={(open) => {
            setShowAddDialog(open);
            if (!open) {
              setIsBulkMode(false);
              setBulkAliases([]);
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                إضافة مرادف
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>إضافة مرادف جديد</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>وضع الإضافة</Label>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={!isBulkMode ? "default" : "outline"}
                      onClick={() => setIsBulkMode(false)}
                    >
                      مفرد
                    </Button>
                    <Button
                      size="sm"
                      variant={isBulkMode ? "default" : "outline"}
                      onClick={() => setIsBulkMode(true)}
                    >
                      متعدد
                    </Button>
                  </div>
                </div>

                <div>
                  <Label>المدينة الأصلية</Label>
                  <Select value={newAlias.name} onValueChange={(value) => setNewAlias({...newAlias, name: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر المدينة" />
                    </SelectTrigger>
                    <SelectContent>
                      {cities.map(item => (
                        <SelectItem key={item.id} value={item.name}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {!isBulkMode ? (
                  <div>
                    <Label>المرادف</Label>
                    <Input
                      value={newAlias.alias}
                      onChange={(e) => setNewAlias({...newAlias, alias: e.target.value})}
                      placeholder="أدخل المرادف"
                    />
                  </div>
                ) : (
                  <div>
                    <Label>المرادفات (كل مرادف في سطر منفصل)</Label>
                    <BulkAliasInput
                      value={bulkAliases}
                      onChange={setBulkAliases}
                      existingAliases={cityAliases}
                      placeholder="أدخل المرادفات (كل مرادف في سطر منفصل)"
                    />
                  </div>
                )}
                
                <div>
                  <Label>درجة الثقة ({(newAlias.confidence * 100).toFixed(0)}%)</Label>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.1"
                    value={newAlias.confidence}
                    onChange={(e) => setNewAlias({...newAlias, confidence: parseFloat(e.target.value)})}
                    className="w-full"
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    onClick={handleAddAlias} 
                    className="flex-1"
                    disabled={isAddingAliases}
                  >
                    {isAddingAliases ? 'جاري الإضافة...' : 'إضافة'}
                  </Button>
                  <Button variant="outline" onClick={() => setShowAddDialog(false)} className="flex-1">
                    إلغاء
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="البحث في المرادفات..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedCity} onValueChange={setSelectedCity}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="فلترة حسب المدينة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع المدن</SelectItem>
            {cities.map(city => (
              <SelectItem key={city.id} value={city.id.toString()}>
                {city.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">مرادفات المدن</span>
            </div>
            <div className="text-2xl font-bold mt-1">{cityAliases.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">مرادفات المناطق</span>
            </div>
            <div className="text-2xl font-bold mt-1">{regionAliases.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">إجمالي المرادفات</span>
            </div>
            <div className="text-2xl font-bold mt-1">{cityAliases.length + regionAliases.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Edit2 className="h-4 w-4 text-purple-500" />
              <span className="text-sm text-muted-foreground">عالية الثقة</span>
            </div>
            <div className="text-2xl font-bold mt-1">
              {[...cityAliases, ...regionAliases].filter(a => a.confidence_score >= 0.9).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Aliases Tables */}
      <Tabs defaultValue="cities" className="w-full">
        <TabsList>
          <TabsTrigger value="cities">مرادفات المدن ({filteredCityAliases.length})</TabsTrigger>
          <TabsTrigger value="regions">مرادفات المناطق ({filteredRegionAliases.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="cities" className="space-y-4">
          {loading ? (
            <div className="text-center py-8">جاري التحميل...</div>
          ) : filteredCityAliases.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>لا توجد مرادفات للمدن</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCityAliases.map(alias => (
                <Card key={alias.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{alias.cities_cache?.name}</span>
                        <span className="text-muted-foreground">←</span>
                        <span className="text-blue-600">{alias.alias_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={getConfidenceColor(alias.confidence_score)}>
                          ثقة: {(alias.confidence_score * 100).toFixed(0)}%
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(alias.created_at).toLocaleDateString('ar-IQ')}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteAlias(alias.id, 'city')}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="regions" className="space-y-4">
          {loading ? (
            <div className="text-center py-8">جاري التحميل...</div>
          ) : filteredRegionAliases.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>لا توجد مرادفات للمناطق</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRegionAliases.map(alias => (
                <Card key={alias.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{alias.regions_cache?.name}</span>
                        <span className="text-muted-foreground">←</span>
                        <span className="text-orange-600">{alias.alias_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={getConfidenceColor(alias.confidence_score)}>
                          ثقة: {(alias.confidence_score * 100).toFixed(0)}%
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(alias.created_at).toLocaleDateString('ar-IQ')}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteAlias(alias.id, 'region')}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CitiesCacheAliasManager;