import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Database, MapPin, Clock, Building2, Edit2 } from 'lucide-react';
import { useCitiesCache } from '@/hooks/useCitiesCache';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { supabase } from '@/integrations/supabase/client';
import RegionDistribution from './RegionDistribution';
import CitiesCacheAliasManager from './CitiesCacheAliasManager';
import TelegramBotDeliveryPartnerSelector from './TelegramBotDeliveryPartnerSelector';

const CitiesCacheManager = () => {
  const [updateProgress, setUpdateProgress] = useState({ current: 0, total: 0, message: '' });
  
  const { 
    cities, 
    allRegions,
    loading, 
    lastUpdated, 
    syncInfo,
    updateCache, 
    isCacheEmpty,
    fetchCities,
    fetchAllRegions,
    fetchSyncInfo
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
    } else if (activePartner === 'modon') {
      return {
        name: 'مدن',
        account: waseetUser?.label || waseetUser?.username || 'حساب غير محدد',
        color: 'from-purple-500 to-purple-600'
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
    if (!date) return 'غير محدد';
    
    try {
      // التأكد من أن التاريخ صالح
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) return 'غير محدد';
      
      return new Intl.DateTimeFormat('ar-IQ', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Baghdad'
      }).format(dateObj);
    } catch (error) {
      
      return 'غير محدد';
    }
  };

  const handleUpdateCache = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    try {
      setUpdateProgress({ current: 0, total: 100, message: 'بدء تحديث المدن والمناطق...' });
      
      // ✅ تمرير اسم الشريك النشط لتحديد Edge Function المناسب
      const result = await updateCache(activePartner);
      
      if (result?.success) {
        setUpdateProgress({ current: 100, total: 100, message: 'اكتمل التحديث بنجاح' });
        
        setTimeout(() => {
          setUpdateProgress({ current: 0, total: 0, message: '' });
        }, 2000);
      } else {
        setUpdateProgress({ current: 0, total: 0, message: '' });
      }
    } catch (error) {
      setUpdateProgress({ current: 0, total: 0, message: '' });
    }
  };

  // ===================================================================
  // 🚀 المرحلة 4: Real-time Progress باستخدام Supabase Realtime - مع فلترة الشريك
  // ===================================================================
  useEffect(() => {
    const channel = supabase
      .channel('sync-progress-updates')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'cities_regions_sync_log' 
        },
        (payload) => {
          if (payload.new) {
            // ✅ تجاهل أي payload لا يطابق الشريك الحالي
            const payloadPartner = payload.new.delivery_partner || 'alwaseet';
            if (activePartner && payloadPartner !== activePartner) {
              return; // تجاهل تحديثات الشريك الآخر
            }

            const { cities_count, regions_count, success } = payload.new;
            // ✅ تقدير ديناميكي حسب الشريك
            const total = activePartner === 'modon' ? 1500 : 6200;
            const current = (cities_count || 0) + (regions_count || 0);
            
            setUpdateProgress({
              current,
              total,
              message: `تم: ${cities_count || 0} مدينة، ${regions_count || 0} منطقة`
            });

            // ✅ عند اكتمال المزامنة بنجاح - التحقق من UPDATE وليس INSERT فقط
            if (success === true && (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT')) {
              setTimeout(() => {
                fetchSyncInfo(activePartner);
                fetchCities();
              }, 500);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSyncInfo, fetchCities, activePartner]);

  // ✅ Force refresh syncInfo حسب الشريك الحالي عند التحميل أو تغيير الشريك
  useEffect(() => {
    fetchSyncInfo(activePartner);
  }, [activePartner, cities?.length, regions?.length]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          إدارة بيانات المدن والمناطق الذكي
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
        
        <Tabs defaultValue="cache" className="w-full">
          <TabsList className="grid w-full grid-cols-4 gap-1">
            <TabsTrigger value="cache" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              كاش
            </TabsTrigger>
            <TabsTrigger value="bot-settings" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              البوت
            </TabsTrigger>
            <TabsTrigger value="aliases" className="flex items-center gap-2">
              <Edit2 className="h-4 w-4" />
              المرادفات
            </TabsTrigger>
            <TabsTrigger value="regions" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              المناطق
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cache" className="space-y-4 mt-6">
        
        {/* معلومات Cache الحالي */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-blue-500" />
            <span className="text-sm text-muted-foreground">عدد المدن:</span>
            <Badge variant="secondary">
              {cities?.length || syncInfo?.cities_count || 0}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-orange-500" />
            <span className="text-sm text-muted-foreground">عدد المناطق:</span>
            <Badge variant="secondary">
              {regions?.length || syncInfo?.regions_count || 0}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-green-500" />
            <span className="text-sm text-muted-foreground">آخر تحديث:</span>
            <span className="text-xs text-muted-foreground">
              {syncInfo?.last_sync_at ? formatDate(syncInfo.last_sync_at) : 
               lastUpdated ? formatDate(lastUpdated) : 'غير متوفر'}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-purple-500" />
            <span className="text-sm text-muted-foreground">الحالة:</span>
            <Badge variant={isCacheEmpty() ? "destructive" : "default"}>
              {isCacheEmpty() ? "فارغ" : cities.length > 0 && regions.length > 0 ? "محدث" : "يحتاج تحديث"}
            </Badge>
          </div>
        </div>

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

        {/* زر التحديث مع شريط التقدم */}
        <div className="space-y-4">
          <Button 
            onClick={handleUpdateCache}
            disabled={loading || !isLoggedIn || activePartner === 'local'}
            className="w-full"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                جاري التحديث...
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

          {/* شريط التقدم */}
          {updateProgress.total > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{updateProgress.message}</span>
                <span>{Math.round((updateProgress.current / updateProgress.total) * 100)}%</span>
              </div>
              <Progress 
                value={(updateProgress.current / updateProgress.total) * 100} 
                className="w-full"
              />
            </div>
          )}
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
          </TabsContent>

          <TabsContent value="bot-settings" className="mt-6">
            <TelegramBotDeliveryPartnerSelector />
          </TabsContent>

          <TabsContent value="aliases" className="mt-6">
            <CitiesCacheAliasManager />
          </TabsContent>

          <TabsContent value="regions" className="mt-6">
            {!isCacheEmpty() && cities.length > 0 ? (
              <RegionDistribution cities={cities} />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>لا توجد بيانات مدن ومناطق لعرض التوزيع</p>
                <p className="text-sm">يجب تحديث Cache أولاً</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default CitiesCacheManager;