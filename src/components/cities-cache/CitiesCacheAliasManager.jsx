import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, MapPin, Building2, Search, Sparkles, Loader2, CheckSquare, Square } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useCitiesCache } from '@/hooks/useCitiesCache';
import { BulkAliasInput } from './BulkAliasInput';
import { iraqCitiesCommonAliases } from '@/lib/iraqCitiesAliases';
import { samawahRegionAliases } from '@/lib/samawahRegionsAliases';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';
import { SearchableSelectFixed } from '@/components/ui/searchable-select-fixed';

// دالة التطبيع الشاملة للنصوص العربية
const normalizeArabicText = (text) => {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/^ال/, '')           // حذف "ال" التعريف من البداية
    .replace(/[أإآ]/g, 'ا')       // توحيد الألف
    .replace(/[ة]/g, 'ه')         // التاء المربوطة → هاء
    .replace(/[ؤ]/g, 'و')         // الواو بالهمزة
    .replace(/[ئ]/g, 'ي')         // الياء بالهمزة
    .replace(/[ء]/g, '')          // حذف الهمزة المفردة
    .replace(/\s+/g, ' ');        // توحيد المسافات
};

const CitiesCacheAliasManager = () => {
  const { cities, regions } = useCitiesCache();
  const [cityAliases, setCityAliases] = useState([]);
  const [regionAliases, setRegionAliases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // States for adding new alias
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newAlias, setNewAlias] = useState({
    type: 'city',
    name: '',
    alias: '',
    confidence: 1.0,
    cityId: '',
    regionId: ''
  });

  // States for bulk operations
  const [bulkAliases, setBulkAliases] = useState([]);
  const [isBulkMode, setIsBulkMode] = useState(true); // الافتراضي متعدد
  const [isAddingAliases, setIsAddingAliases] = useState(false);

  // State for city filter when selecting regions
  const [selectedCityForRegion, setSelectedCityForRegion] = useState('');
  const [regionSearchTerm, setRegionSearchTerm] = useState('');

  // States for multi-selection
  const [selectedCityAliases, setSelectedCityAliases] = useState([]);
  const [selectedRegionAliases, setSelectedRegionAliases] = useState([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteType, setDeleteType] = useState('city');
  const [deletingSingleId, setDeletingSingleId] = useState(null);

  // جلب المرادفات عند التحميل
  useEffect(() => {
    fetchAliases();
  }, []);

  const fetchAliases = async () => {
    setLoading(true);
    try {
      // جلب مرادفات المدن
      const { data: cityData, error: cityError } = await supabase
        .from('city_aliases')
        .select('*')
        .order('confidence_score', { ascending: false });

      if (cityError) throw cityError;

      const { data: citiesData, error: citiesError } = await supabase
        .from('cities_cache')
        .select('id, name');

      if (citiesError) throw citiesError;

      const cityAliasesWithNames = (cityData || []).map(alias => ({
        ...alias,
        cities_cache: citiesData?.find(city => city.id === alias.city_id) || null
      }));

      // جلب مرادفات المناطق مع معلومات المدينة
      const { data: regionData, error: regionError } = await supabase
        .from('region_aliases')
        .select('*')
        .order('confidence_score', { ascending: false });

      if (regionError) throw regionError;

      const { data: regionsData, error: regionsError } = await supabase
        .from('regions_cache')
        .select('id, name, city_id');

      if (regionsError) throw regionsError;

      // فلترة المرادفات التي تشير إلى مناطق موجودة فقط
      const regionAliasesWithNames = (regionData || [])
        .map(alias => {
          const region = regionsData?.find(region => region.id === alias.region_id);
          const city = citiesData?.find(city => city.id === region?.city_id);
          return {
            ...alias,
            regions_cache: region,
            city_name: city?.name || 'غير معروف'
          };
        })
        .filter(alias => alias.regions_cache !== undefined); // إزالة المرادفات الفاسدة

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
      if (newAlias.type === 'city') {
        const cityId = cities.find(c => c.name === newAlias.name)?.id;
        if (!cityId) {
          toast({
            title: "خطأ",
            description: "المدينة المحددة غير موجودة",
            variant: "destructive"
          });
          return;
        }

        const aliasesToAdd = isBulkMode ? bulkAliases : [newAlias.alias];
        
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

        const aliasObjects = newAliasesToAdd.map(alias => ({
          city_id: cityId,
          alias_name: alias,
          normalized_name: normalizeArabicText(alias),
          confidence_score: newAlias.confidence
        }));

        const { error } = await supabase.from('city_aliases').insert(aliasObjects);
        if (error) throw error;

        toast({
          title: "نجح الإضافة",
          description: `تم إضافة ${newAliasesToAdd.length} مرادف`,
          variant: "default"
        });
      } else {
        const regionId = regions.find(r => r.name === newAlias.name)?.id;
        if (!regionId) {
          toast({
            title: "خطأ",
            description: "المنطقة المحددة غير موجودة",
            variant: "destructive"
          });
          return;
        }

        const aliasesToAdd = isBulkMode ? bulkAliases : [newAlias.alias];
        
        const { data: existingAliases } = await supabase
          .from('region_aliases')
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

        const aliasObjects = newAliasesToAdd.map(alias => ({
          region_id: regionId,
          alias_name: alias,
          normalized_name: normalizeArabicText(alias),
          confidence_score: newAlias.confidence
        }));

        const { error } = await supabase.from('region_aliases').insert(aliasObjects);
        if (error) throw error;

        toast({
          title: "نجح الإضافة",
          description: `تم إضافة ${newAliasesToAdd.length} مرادف`,
          variant: "default"
        });
      }

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
      setIsBulkMode(true); // العودة للافتراضي (متعدد)
      setSelectedCityForRegion('');
      setRegionSearchTerm('');
      
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

  const handleAddSmartCityAliases = async () => {
    setIsAddingAliases(true);
    try {
      let totalAdded = 0;
      
      for (const [cityId, cityData] of Object.entries(iraqCitiesCommonAliases)) {
        const city = cities.find(c => c.name === cityData.name);
        if (!city) continue;

        const aliasNames = cityData.aliases.map(a => a.text);
        
        const { data: existingAliases } = await supabase
          .from('city_aliases')
          .select('alias_name')
          .eq('city_id', city.id)
          .in('alias_name', aliasNames);

        const existingNames = existingAliases?.map(a => a.alias_name) || [];
        const newAliases = cityData.aliases.filter(a => !existingNames.includes(a.text));

        if (newAliases.length > 0) {
          const aliasObjects = newAliases.map(alias => ({
            city_id: city.id,
            alias_name: alias.text,
            normalized_name: normalizeArabicText(alias.text),
            confidence_score: alias.confidence
          }));

          const { error } = await supabase.from('city_aliases').insert(aliasObjects);
          if (!error) {
            totalAdded += newAliases.length;
          }
        }
      }

      toast({
        title: "نجح الإضافة",
        description: `تم إضافة ${totalAdded} مرادف ذكي للمدن`,
        variant: "default"
      });

      fetchAliases();
    } catch (error) {
      console.error('خطأ في إضافة المرادفات الذكية:', error);
      toast({
        title: "فشل الإضافة",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsAddingAliases(false);
    }
  };

  const handleAddSmartSamawahRegionAliases = async () => {
    setIsAddingAliases(true);
    try {
      const samawahCity = cities.find(c => c.name === 'السماوة');
      if (!samawahCity) {
        toast({
          title: "خطأ",
          description: "مدينة السماوة غير موجودة في القاعدة",
          variant: "destructive"
        });
        return;
      }

      let totalAdded = 0;

      for (const [regionName, regionData] of Object.entries(samawahRegionAliases)) {
        const region = regions.find(r => r.name === regionName && r.city_id === samawahCity.id);
        if (!region) continue;

        const aliasNames = regionData.aliases.map(a => a.text);
        
        const { data: existingAliases } = await supabase
          .from('region_aliases')
          .select('alias_name')
          .eq('region_id', region.id)
          .in('alias_name', aliasNames);

        const existingNames = existingAliases?.map(a => a.alias_name) || [];
        const newAliases = regionData.aliases.filter(a => !existingNames.includes(a.text));

        if (newAliases.length > 0) {
          const aliasObjects = newAliases.map(alias => ({
            region_id: region.id,
            alias_name: alias.text,
            normalized_name: normalizeArabicText(alias.text),
            confidence_score: alias.confidence
          }));

          const { error } = await supabase.from('region_aliases').insert(aliasObjects);
          if (!error) {
            totalAdded += newAliases.length;
          }
        }
      }

      toast({
        title: "نجح الإضافة",
        description: `تم إضافة ${totalAdded} مرادف ذكي لمناطق السماوة`,
        variant: "default"
      });

      fetchAliases();
    } catch (error) {
      console.error('خطأ في إضافة المرادفات الذكية:', error);
      toast({
        title: "فشل الإضافة",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsAddingAliases(false);
    }
  };

  const handleDeleteSingle = async (aliasId, type) => {
    setDeletingSingleId(aliasId);
    try {
      const tableName = type === 'city' ? 'city_aliases' : 'region_aliases';

      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', aliasId);
      
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
    } finally {
      setDeletingSingleId(null);
    }
  };

  const handleDeleteSelected = async () => {
    try {
      const tableName = deleteType === 'city' ? 'city_aliases' : 'region_aliases';
      const selectedIds = deleteType === 'city' ? selectedCityAliases : selectedRegionAliases;

      if (selectedIds.length === 0) return;

      const { error } = await supabase
        .from(tableName)
        .delete()
        .in('id', selectedIds);
      
      if (error) throw error;
      
      toast({
        title: "نجح الحذف",
        description: `تم حذف ${selectedIds.length} مرادف بنجاح`,
        variant: "default"
      });
      
      if (deleteType === 'city') {
        setSelectedCityAliases([]);
      } else {
        setSelectedRegionAliases([]);
      }
      
      setShowDeleteDialog(false);
      fetchAliases();
    } catch (error) {
      console.error('خطأ في حذف المرادفات:', error);
      toast({
        title: "فشل الحذف",
        description: error.message || "حدث خطأ أثناء حذف المرادفات",
        variant: "destructive"
      });
    }
  };

  const toggleSelectAll = (type) => {
    if (type === 'city') {
      if (selectedCityAliases.length === filteredCityAliases.length) {
        setSelectedCityAliases([]);
      } else {
        setSelectedCityAliases(filteredCityAliases.map(a => a.id));
      }
    } else {
      if (selectedRegionAliases.length === filteredRegionAliases.length) {
        setSelectedRegionAliases([]);
      } else {
        setSelectedRegionAliases(filteredRegionAliases.map(a => a.id));
      }
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
    alias.city_name?.includes(searchTerm)
  );

  const getConfidenceColor = (score) => {
    if (score >= 0.9) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (score >= 0.7) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
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
        
        <Dialog open={showAddDialog} onOpenChange={(open) => {
          setShowAddDialog(open);
          if (!open) {
            setIsBulkMode(true); // العودة للافتراضي (متعدد)
            setBulkAliases([]);
            setSelectedCityForRegion('');
            setRegionSearchTerm('');
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
              <div>
                <Label>النوع</Label>
                <Select value={newAlias.type} onValueChange={(value) => setNewAlias({...newAlias, type: value, name: ''})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="city">مدينة</SelectItem>
                    <SelectItem value="region">منطقة</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label>وضع الإضافة</Label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={isBulkMode ? "default" : "outline"}
                    onClick={() => setIsBulkMode(true)}
                  >
                    متعدد
                  </Button>
                  <Button
                    size="sm"
                    variant={!isBulkMode ? "default" : "outline"}
                    onClick={() => setIsBulkMode(false)}
                  >
                    مفرد
                  </Button>
                </div>
              </div>

              {newAlias.type === 'city' ? (
                <div>
                  <Label>المدينة</Label>
                  <Select value={newAlias.name} onValueChange={(value) => setNewAlias({...newAlias, name: value})}>
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
              ) : (
                <>
                  <div>
                    <Label>المدينة (فلتر)</Label>
                    <Select 
                      value={selectedCityForRegion} 
                      onValueChange={(value) => {
                        setSelectedCityForRegion(value);
                        setNewAlias({...newAlias, name: ''});
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="اختر المدينة أولاً" />
                      </SelectTrigger>
                      <SelectContent>
                        {cities.map(city => (
                          <SelectItem key={city.id} value={city.id.toString()}>
                            {city.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>المنطقة</Label>
                    <SearchableSelectFixed
                      value={newAlias.name}
                      onValueChange={(value) => setNewAlias({...newAlias, name: value})}
                      options={regions
                        .filter(r => !selectedCityForRegion || r.city_id.toString() === selectedCityForRegion)
                        .map(region => ({
                          value: region.name,
                          label: region.name
                        }))}
                      placeholder={selectedCityForRegion ? "ابحث عن المنطقة..." : "اختر المدينة أولاً"}
                      searchPlaceholder="ابحث..."
                      emptyText="لا توجد مناطق"
                      disabled={!selectedCityForRegion}
                    />
                  </div>
                </>
              )}
              
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
                    existingAliases={newAlias.type === 'city' ? cityAliases : regionAliases}
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="البحث في المرادفات..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
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
              <Sparkles className="h-4 w-4 text-purple-500" />
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
          {selectedCityAliases.length > 0 && (
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <span className="text-sm">محدد: {selectedCityAliases.length}</span>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setDeleteType('city');
                  setShowDeleteDialog(true);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                حذف المحدد
              </Button>
            </div>
          )}

          <div className="flex items-center gap-2 mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleSelectAll('city')}
            >
              {selectedCityAliases.length === filteredCityAliases.length ? (
                <>
                  <Square className="h-4 w-4 mr-2" />
                  إلغاء التحديد
                </>
              ) : (
                <>
                  <CheckSquare className="h-4 w-4 mr-2" />
                  تحديد الكل
                </>
              )}
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-8">جاري التحميل...</div>
          ) : filteredCityAliases.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>لا توجد مرادفات للمدن</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[65vh] overflow-y-auto">
              {filteredCityAliases.map(alias => (
                <Card 
                  key={alias.id} 
                  className="p-3 md:p-4 group hover:border-destructive/50 transition-colors cursor-pointer"
                  onClick={(e) => {
                    // تجنب التفعيل عند النقر على الأزرار
                    if (e.target.closest('button')) return;
                    
                    const isSelected = selectedCityAliases.includes(alias.id);
                    if (isSelected) {
                      setSelectedCityAliases(selectedCityAliases.filter(id => id !== alias.id));
                    } else {
                      setSelectedCityAliases([...selectedCityAliases, alias.id]);
                    }
                  }}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                    <Checkbox
                      className="h-5 w-5"
                      checked={selectedCityAliases.includes(alias.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedCityAliases([...selectedCityAliases, alias.id]);
                        } else {
                          setSelectedCityAliases(selectedCityAliases.filter(id => id !== alias.id));
                        }
                      }}
                    />
                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-sm sm:text-base">{alias.cities_cache?.name}</span>
                        <span className="text-muted-foreground">←</span>
                        <span className="text-blue-600 text-sm sm:text-base break-all">{alias.alias_name}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={`text-xs ${getConfidenceColor(alias.confidence_score)}`}>
                          ثقة: {(alias.confidence_score * 100).toFixed(0)}%
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(alias.created_at).toLocaleDateString('ar-IQ')}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-100 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSingle(alias.id, 'city');
                      }}
                      disabled={deletingSingleId === alias.id}
                    >
                      {deletingSingleId === alias.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="regions" className="space-y-4">
          {selectedRegionAliases.length > 0 && (
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <span className="text-sm">محدد: {selectedRegionAliases.length}</span>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setDeleteType('region');
                  setShowDeleteDialog(true);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                حذف المحدد
              </Button>
            </div>
          )}

          <div className="flex items-center gap-2 mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleSelectAll('region')}
            >
              {selectedRegionAliases.length === filteredRegionAliases.length ? (
                <>
                  <Square className="h-4 w-4 mr-2" />
                  إلغاء التحديد
                </>
              ) : (
                <>
                  <CheckSquare className="h-4 w-4 mr-2" />
                  تحديد الكل
                </>
              )}
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-8">جاري التحميل...</div>
          ) : filteredRegionAliases.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>لا توجد مرادفات للمناطق</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[65vh] overflow-y-auto">
              {filteredRegionAliases.map(alias => (
                <Card 
                  key={alias.id} 
                  className="p-3 md:p-4 group hover:border-destructive/50 transition-colors cursor-pointer"
                  onClick={(e) => {
                    // تجنب التفعيل عند النقر على الأزرار
                    if (e.target.closest('button')) return;
                    
                    const isSelected = selectedRegionAliases.includes(alias.id);
                    if (isSelected) {
                      setSelectedRegionAliases(selectedRegionAliases.filter(id => id !== alias.id));
                    } else {
                      setSelectedRegionAliases([...selectedRegionAliases, alias.id]);
                    }
                  }}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                    <Checkbox
                      className="h-5 w-5"
                      checked={selectedRegionAliases.includes(alias.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedRegionAliases([...selectedRegionAliases, alias.id]);
                        } else {
                          setSelectedRegionAliases(selectedRegionAliases.filter(id => id !== alias.id));
                        }
                      }}
                    />
                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="text-xs shrink-0">
                          <Building2 className="h-3 w-3 mr-1" />
                          {alias.city_name}
                        </Badge>
                        <span className="font-medium text-sm sm:text-base">{alias.regions_cache?.name || 'غير معروف'}</span>
                        <span className="text-muted-foreground">←</span>
                        <span className="text-orange-600 text-sm sm:text-base break-all">{alias.alias_name}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={`text-xs ${getConfidenceColor(alias.confidence_score)}`}>
                          ثقة: {(alias.confidence_score * 100).toFixed(0)}%
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(alias.created_at).toLocaleDateString('ar-IQ')}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-100 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSingle(alias.id, 'region');
                      }}
                      disabled={deletingSingleId === alias.id}
                    >
                      {deletingSingleId === alias.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <DeleteConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDeleteSelected}
        title="حذف المرادفات المحددة"
        description={`هل أنت متأكد من حذف ${deleteType === 'city' ? selectedCityAliases.length : selectedRegionAliases.length} مرادف؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmText="حذف"
        cancelText="إلغاء"
        type="danger"
      />
    </div>
  );
};

export default CitiesCacheAliasManager;
