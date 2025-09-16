import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Database, MapPin, Clock } from 'lucide-react';
import { useCitiesCache } from '@/hooks/useCitiesCache';
import { useAlWaseet } from '@/contexts/AlWaseetContext';

const CitiesCacheManager = () => {
  const { 
    cities, 
    loading, 
    lastUpdated, 
    updateCache, 
    isCacheEmpty 
  } = useCitiesCache();
  const { isLoggedIn } = useAlWaseet();

  const formatDate = (date) => {
    return date ? new Intl.DateTimeFormat('ar-IQ', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date) : 'غير محدد';
  };

  const handleUpdateCache = async () => {
    await updateCache();
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          إدارة cache المدن والمناطق
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* معلومات Cache الحالي */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-blue-500" />
            <span className="text-sm text-muted-foreground">عدد المدن:</span>
            <Badge variant="secondary">{cities.length}</Badge>
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

        {/* تنبيه إذا كان Cache فارغ */}
        {isCacheEmpty() && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-yellow-800">
              <Database className="h-4 w-4" />
              <span className="font-medium">Cache المدن والمناطق فارغ</span>
            </div>
            <p className="text-sm text-yellow-700 mt-1">
              يجب تحديث cache المدن والمناطق لضمان عمل نظام العناوين في بوت التليغرام بشكل صحيح.
            </p>
          </div>
        )}

        {/* تنبيه تسجيل الدخول */}
        {!isLoggedIn && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-800">
              <RefreshCw className="h-4 w-4" />
              <span className="font-medium">غير مسجل دخول لشركة التوصيل</span>
            </div>
            <p className="text-sm text-red-700 mt-1">
              يجب تسجيل الدخول لشركة التوصيل أولاً لتحديث cache المدن والمناطق.
            </p>
          </div>
        )}

        {/* زر التحديث */}
        <div className="flex gap-2">
          <Button 
            onClick={handleUpdateCache}
            disabled={loading || !isLoggedIn}
            className="flex-1"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                جاري التحديث...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                تحديث Cache من شركة التوصيل
              </>
            )}
          </Button>
        </div>

        {/* معلومات إضافية */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• يتم استخدام cache المدن والمناطق في بوت التليغرام لتحليل العناوين بدقة</p>
          <p>• يُنصح بتحديث Cache عند إضافة مدن أو مناطق جديدة في شركة التوصيل</p>
          <p>• التحديث يجلب أحدث بيانات المدن والمناطق من واجهة شركة التوصيل</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default CitiesCacheManager;