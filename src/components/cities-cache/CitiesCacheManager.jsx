import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Database, MapPin, Clock, Building2 } from 'lucide-react';
import { useCitiesCache } from '@/hooks/useCitiesCache';
import { useAlWaseet } from '@/contexts/AlWaseetContext';

const CitiesCacheManager = () => {
  const { 
    cities, 
    regions,
    loading, 
    lastUpdated, 
    updateCache, 
    isCacheEmpty,
    fetchCities,
    fetchRegionsByCity
  } = useCitiesCache();
  const { isLoggedIn, activePartner, waseetUser } = useAlWaseet();

  // تحديد شركة التوصيل الحالية
  const getCurrentDeliveryPartner = () => {
    if (activePartner === 'alwaseet') {
      return {
        name: 'الوسيط',
        account: waseetUser?.label || waseetUser?.username || 'حساب غير محدد',
        color: 'from-blue-500 to-blue-600'
      };
    }
    return {
      name: 'محلي',
      account: 'توصيل داخلي',
      color: 'from-green-500 to-green-600'
    };
  };

  const currentPartner = getCurrentDeliveryPartner();

  const formatDate = (date) => {
    return date ? new Intl.DateTimeFormat('ar-IQ', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date) : 'غير محدد';
  };

  const handleUpdateCache = async (e) => {
    if (e) {
      e.preventDefault(); // منع تحديث الصفحة
      e.stopPropagation(); // منع انتشار الحدث
    }
    
    try {
      const success = await updateCache();
      if (success) {
        // تحديث قائمة المدن بعد التحديث الناجح
        await fetchCities();
      }
    } catch (error) {
      console.error('خطأ في تحديث cache:', error);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          إدارة cache المدن والمناطق
        </CardTitle>
        
        {/* عرض شركة التوصيل الحالية */}
        <div className="flex items-center gap-2 mt-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">شركة التوصيل:</span>
          <Badge 
            variant="secondary" 
            className={`bg-gradient-to-r ${currentPartner.color} text-white border-none`}
          >
            {currentPartner.name}
          </Badge>
          {currentPartner.account !== 'توصيل داخلي' && (
            <span className="text-xs text-muted-foreground">
              ({currentPartner.account})
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* معلومات Cache الحالي */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-blue-500" />
            <span className="text-sm text-muted-foreground">عدد المدن:</span>
            <Badge variant="secondary">{cities.length}</Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-orange-500" />
            <span className="text-sm text-muted-foreground">عدد المناطق:</span>
            <Badge variant="secondary">{regions?.length || 0}</Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-green-500" />
            <span className="text-sm text-muted-foreground">آخر تحديث:</span>
            <span className="text-xs text-muted-foreground">
              {formatDate(lastUpdated)}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-purple-500" />
            <span className="text-sm text-muted-foreground">الحالة:</span>
            <Badge variant={isCacheEmpty() ? "destructive" : "default"}>
              {isCacheEmpty() ? "فارغ" : "محدث"}
            </Badge>
          </div>
        </div>

        {/* عرض توزيع المناطق حسب المدن */}
        {!isCacheEmpty() && cities.length > 0 && (
          <div className="mt-4 p-4 bg-secondary/30 rounded-lg">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              توزيع المناطق حسب المدن (أول 5 مدن):
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
              {cities.slice(0, 5).map((city) => (
                <div key={city.id} className="flex items-center justify-between p-2 bg-background rounded border">
                  <span className="font-medium truncate">{city.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {regions?.filter(r => r.city_id === city.id).length || 0} منطقة
                  </Badge>
                </div>
              ))}
              {cities.length > 5 && (
                <div className="text-muted-foreground p-2">
                  و {cities.length - 5} مدن أخرى...
                </div>
              )}
            </div>
          </div>
        )}

        {/* تنبيه حسب نوع شركة التوصيل */}
        {activePartner === 'local' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-blue-800">
              <Database className="h-4 w-4" />
              <span className="font-medium">وضع التوصيل المحلي</span>
            </div>
            <p className="text-sm text-blue-700 mt-1">
              Cache المدن والمناطق مخصص لشركات التوصيل الخارجية فقط. في وضع التوصيل المحلي، يمكنك إدخال العناوين يدوياً.
            </p>
          </div>
        )}

        {/* تنبيه إذا كان Cache فارغ لشركة التوصيل */}
        {activePartner === 'alwaseet' && isCacheEmpty() && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-yellow-800">
              <Database className="h-4 w-4" />
              <span className="font-medium">Cache المدن والمناطق فارغ لشركة {currentPartner.name}</span>
            </div>
            <p className="text-sm text-yellow-700 mt-1">
              يجب تحديث cache المدن والمناطق لضمان عمل نظام العناوين في بوت التليغرام بشكل صحيح مع شركة {currentPartner.name}.
            </p>
          </div>
        )}

        {/* تنبيه تسجيل الدخول لشركة التوصيل */}
        {activePartner === 'alwaseet' && !isLoggedIn && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-800">
              <RefreshCw className="h-4 w-4" />
              <span className="font-medium">غير مسجل دخول لشركة {currentPartner.name}</span>
            </div>
            <p className="text-sm text-red-700 mt-1">
              يجب تسجيل الدخول لشركة {currentPartner.name} أولاً لتحديث cache المدن والمناطق.
            </p>
          </div>
        )}

        {/* زر التحديث */}
        <div className="flex gap-2">
          <Button 
            onClick={handleUpdateCache}
            disabled={loading || !isLoggedIn || activePartner === 'local'}
            className="flex-1"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                جاري التحديث من {currentPartner.name}...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                {activePartner === 'local' 
                  ? 'غير متاح للتوصيل المحلي' 
                  : `تحديث Cache من ${currentPartner.name}`
                }
              </>
            )}
          </Button>
        </div>

        {/* معلومات إضافية */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• يتم استخدام cache المدن والمناطق في بوت التليغرام لتحليل العناوين بدقة</p>
          <p>• يُنصح بتحديث Cache عند إضافة مدن أو مناطق جديدة في شركة التوصيل</p>
          <p>• التحديث يجلب أحدث بيانات المدن والمناطق من واجهة شركة {currentPartner.name}</p>
          {activePartner === 'alwaseet' && (
            <p>• عند تغيير شركة التوصيل، يتم تحديث Cache تلقائياً حسب الشركة الجديدة</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CitiesCacheManager;