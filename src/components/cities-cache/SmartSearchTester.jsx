import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, MapPin, Building2, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { useCitiesCache } from '@/hooks/useCitiesCache';

const SmartSearchTester = () => {
  const { cities } = useCitiesCache();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState('city');
  const [selectedCity, setSelectedCity] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      toast({
        title: "تنبيه",
        description: "يجب إدخال نص للبحث",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      let results = [];
      
      if (searchType === 'city') {
        const { data, error } = await supabase.rpc('smart_search_city', {
          search_term: searchTerm
        });
        
        if (error) throw error;
        results = data || [];
      } else {
        const cityIdParam = selectedCity ? parseInt(selectedCity) : null;
        const { data, error } = await supabase.rpc('smart_search_region', {
          search_term: searchTerm,
          city_id_param: cityIdParam
        });
        
        if (error) throw error;
        results = data || [];
      }

      setSearchResults(results);
      
      // إضافة للتاريخ
      const historyItem = {
        id: Date.now(),
        searchTerm,
        searchType,
        selectedCity: selectedCity || null,
        resultsCount: results.length,
        timestamp: new Date(),
        success: results.length > 0
      };
      
      setSearchHistory(prev => [historyItem, ...prev.slice(0, 9)]); // الاحتفاظ بآخر 10 بحثات

    } catch (error) {
      console.error('خطأ في البحث:', error);
      toast({
        title: "خطأ في البحث",
        description: error.message || "حدث خطأ أثناء البحث",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getMatchTypeColor = (matchType) => {
    switch (matchType) {
      case 'exact_alias':
      case 'exact_original':
        return 'bg-green-100 text-green-800';
      case 'partial_alias':
        return 'bg-blue-100 text-blue-800';
      case 'partial_original':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getMatchTypeLabel = (matchType) => {
    switch (matchType) {
      case 'exact_alias':
        return 'مطابقة تامة (مرادف)';
      case 'exact_original':
        return 'مطابقة تامة (أصلي)';
      case 'partial_alias':
        return 'مطابقة جزئية (مرادف)';
      case 'partial_original':
        return 'مطابقة جزئية (أصلي)';
      default:
        return 'غير محدد';
    }
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.9) return 'text-green-600';
    if (confidence >= 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  // أمثلة للاختبار السريع
  const quickTestExamples = [
    { text: 'بغداد', type: 'city' },
    { text: 'بقداد', type: 'city' },
    { text: 'ديوانيه', type: 'city' },
    { text: 'كراده', type: 'region' },
    { text: 'منصور', type: 'region' },
    { text: 'دوره', type: 'region' }
  ];

  const runQuickTest = (example) => {
    setSearchTerm(example.text);
    setSearchType(example.type);
    if (example.type === 'region') {
      setSelectedCity(''); // البحث في جميع المدن
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold">اختبار البحث الذكي</h3>
        <p className="text-sm text-muted-foreground">
          اختبر دقة وفعالية نظام البحث الذكي للمدن والمناطق
        </p>
      </div>

      {/* Search Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            نموذج البحث
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>نوع البحث</Label>
              <Select value={searchType} onValueChange={setSearchType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="city">مدينة</SelectItem>
                  <SelectItem value="region">منطقة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {searchType === 'region' && (
              <div>
                <Label>المدينة (اختياري)</Label>
                <Select value={selectedCity} onValueChange={setSelectedCity}>
                  <SelectTrigger>
                    <SelectValue placeholder="جميع المدن" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">جميع المدن</SelectItem>
                    {cities.map(city => (
                      <SelectItem key={city.id} value={city.id.toString()}>
                        {city.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className={searchType === 'city' ? 'md:col-span-2' : ''}>
              <Label>نص البحث</Label>
              <div className="flex gap-2">
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={`أدخل اسم ${searchType === 'city' ? 'المدينة' : 'المنطقة'}`}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={loading}>
                  {loading ? (
                    <Search className="h-4 w-4 animate-pulse" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Quick Test Examples */}
          <div>
            <Label className="text-sm">اختبارات سريعة:</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {quickTestExamples.map((example, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => runQuickTest(example)}
                  className="text-xs"
                >
                  {example.text} ({example.type === 'city' ? 'مدينة' : 'منطقة'})
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              نتائج البحث ({searchResults.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {searchResults.map((result, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {searchType === 'city' ? (
                          <Building2 className="h-4 w-4 text-blue-500" />
                        ) : (
                          <MapPin className="h-4 w-4 text-orange-500" />
                        )}
                        <span className="font-medium text-lg">
                          {searchType === 'city' ? result.city_name : result.region_name}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge className={getMatchTypeColor(result.match_type)}>
                          {getMatchTypeLabel(result.match_type)}
                        </Badge>
                        <span className={`text-sm font-medium ${getConfidenceColor(result.confidence)}`}>
                          ثقة: {(result.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">
                        {searchType === 'city' ? 'معرف المدينة' : 'معرف المنطقة'}: {searchType === 'city' ? result.city_id : result.region_id}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Results */}
      {searchResults.length === 0 && searchTerm && !loading && (
        <Card>
          <CardContent className="py-8 text-center">
            <XCircle className="h-12 w-12 mx-auto mb-4 text-red-500 opacity-50" />
            <h3 className="text-lg font-medium mb-2">لا توجد نتائج</h3>
            <p className="text-muted-foreground">
              لم يتم العثور على أي نتائج لـ "{searchTerm}"
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              جرب استخدام صيغة مختلفة أو تأكد من الإملاء
            </p>
          </CardContent>
        </Card>
      )}

      {/* Search History */}
      {searchHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              تاريخ البحث
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {searchHistory.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {item.success ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <div>
                      <span className="font-medium">"{item.searchTerm}"</span>
                      <div className="text-sm text-muted-foreground">
                        {item.searchType === 'city' ? 'بحث مدينة' : 'بحث منطقة'}
                        {item.selectedCity && ` في المدينة المحددة`}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-sm">
                      {item.resultsCount} نتيجة
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.timestamp.toLocaleTimeString('ar-IQ')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SmartSearchTester;