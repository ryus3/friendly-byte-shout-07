import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit2, Trash2, MapPin, Building2, Search, Download, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { useCitiesCache } from '@/hooks/useCitiesCache';

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
    if (!newAlias.name || !newAlias.alias) {
      toast({
        title: "خطأ",
        description: "يجب ملء جميع الحقول المطلوبة",
        variant: "destructive"
      });
      return;
    }

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

        const { error } = await supabase.from('city_aliases').insert([{
          city_id: cityId,
          alias_name: newAlias.alias,
          normalized_name: newAlias.alias.toLowerCase().replace(/[أإآ]/g, 'ا').replace(/[ة]/g, 'ه'),
          confidence_score: newAlias.confidence
        }]);

        if (error) throw error;
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

        const { error } = await supabase.from('region_aliases').insert([{
          region_id: regionId,
          alias_name: newAlias.alias,
          normalized_name: newAlias.alias.toLowerCase().replace(/[أإآ]/g, 'ا').replace(/[ة]/g, 'ه'),
          confidence_score: newAlias.confidence
        }]);

        if (error) throw error;
      }

      toast({
        title: "نجح الإضافة",
        description: "تم إضافة المرادف بنجاح",
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
      
      fetchAliases();
    } catch (error) {
      console.error('خطأ في إضافة المرادف:', error);
      toast({
        title: "فشل الإضافة",
        description: error.message || "حدث خطأ أثناء إضافة المرادف",
        variant: "destructive"
      });
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
        
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
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
                <Select value={newAlias.type} onValueChange={(value) => setNewAlias({...newAlias, type: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر النوع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="city">مدينة</SelectItem>
                    <SelectItem value="region">منطقة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>{newAlias.type === 'city' ? 'المدينة الأصلية' : 'المنطقة الأصلية'}</Label>
                <Select value={newAlias.name} onValueChange={(value) => setNewAlias({...newAlias, name: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder={`اختر ${newAlias.type === 'city' ? 'المدينة' : 'المنطقة'}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {(newAlias.type === 'city' ? cities : regions).map(item => (
                      <SelectItem key={item.id} value={item.name}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>المرادف</Label>
                <Input
                  value={newAlias.alias}
                  onChange={(e) => setNewAlias({...newAlias, alias: e.target.value})}
                  placeholder="أدخل المرادف"
                />
              </div>
              
              <div>
                <Label>درجة الثقة ({newAlias.confidence})</Label>
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
                <Button onClick={handleAddAlias} className="flex-1">
                  إضافة
                </Button>
                <Button variant="outline" onClick={() => setShowAddDialog(false)} className="flex-1">
                  إلغاء
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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