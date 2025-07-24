import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  Database, 
  Zap, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  RefreshCw,
  Wrench,
  TrendingUp,
  Users,
  Package,
  ShoppingCart
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { runSystemCheck, repairSystem } from '@/utils/systemOptimizer';

const SystemHealthDashboard = () => {
  const [healthReport, setHealthReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [repairing, setRepairing] = useState(false);

  useEffect(() => {
    runHealthCheck();
  }, []);

  const runHealthCheck = async () => {
    setLoading(true);
    try {
      const report = await runSystemCheck();
      setHealthReport(report);
      
      toast({
        title: "✅ اكتمل الفحص",
        description: `حالة النظام: ${getStatusText(report.overall_status)}`,
      });
    } catch (error) {
      console.error('خطأ في فحص النظام:', error);
      toast({
        title: "❌ خطأ في الفحص",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const runAutoRepair = async () => {
    setRepairing(true);
    try {
      const repairs = await repairSystem();
      
      toast({
        title: "🔧 اكتمل الإصلاح",
        description: `تم إصلاح ${repairs.length} مشكلة`,
      });
      
      // إعادة تشغيل الفحص بعد الإصلاح
      await runHealthCheck();
    } catch (error) {
      console.error('خطأ في الإصلاح:', error);
      toast({
        title: "❌ خطأ في الإصلاح",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRepairing(false);
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'healthy': return 'ممتاز';
      case 'good': return 'جيد';
      case 'needs_attention': return 'يحتاج انتباه';
      case 'vulnerable': return 'معرض للخطر';
      default: return 'غير معروف';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy':
      case 'excellent':
      case 'secure':
        return 'bg-green-500';
      case 'good':
      case 'protected':
        return 'bg-blue-500';
      case 'needs_attention':
      case 'slow':
        return 'bg-yellow-500';
      case 'vulnerable':
      case 'exposed':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const StatusBadge = ({ status, label }) => (
    <Badge 
      variant="outline" 
      className={`${getStatusColor(status)} text-white border-none`}
    >
      {label || getStatusText(status)}
    </Badge>
  );

  if (loading && !healthReport) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">جاري فحص النظام...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">لوحة مراقبة صحة النظام</h1>
          <p className="text-muted-foreground">
            آخر فحص: {healthReport?.timestamp ? new Date(healthReport.timestamp).toLocaleString('ar-SA') : 'لم يتم بعد'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={runHealthCheck} 
            disabled={loading}
            className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
            إعادة الفحص
          </Button>
          <Button 
            onClick={runAutoRepair} 
            disabled={repairing || !healthReport}
            variant="outline"
          >
            {repairing ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Wrench className="h-4 w-4 mr-2" />}
            إصلاح تلقائي
          </Button>
        </div>
      </div>

      {healthReport && (
        <>
          {/* Overall Status */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {healthReport.overall_status === 'healthy' ? (
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                ) : (
                  <AlertTriangle className="h-6 w-6 text-yellow-500" />
                )}
                الحالة العامة للنظام
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <StatusBadge status={healthReport.overall_status} />
                <Progress 
                  value={healthReport.overall_status === 'healthy' ? 100 : 70} 
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground">
                  {healthReport.overall_status === 'healthy' ? '100%' : '70%'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Tabs */}
          <Tabs defaultValue="performance" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="performance" className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                الأداء
              </TabsTrigger>
              <TabsTrigger value="data" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                البيانات
              </TabsTrigger>
              <TabsTrigger value="security" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                الأمان
              </TabsTrigger>
              <TabsTrigger value="recommendations" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                التوصيات
              </TabsTrigger>
            </TabsList>

            {/* Performance Tab */}
            <TabsContent value="performance" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>مقاييس الأداء</CardTitle>
                  <CardDescription>سرعة الاستجابة والاستعلامات</CardDescription>
                </CardHeader>
                <CardContent>
                  {healthReport.performance ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span>سرعة الاستعلامات</span>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={healthReport.performance.status} />
                          <span className="text-sm text-muted-foreground">
                            {Math.round(healthReport.performance.queryTime)}ms
                          </span>
                        </div>
                      </div>
                      
                      {healthReport.performance.queries && (
                        <div className="space-y-2">
                          <h4 className="font-medium">تفاصيل الاستعلامات:</h4>
                          {healthReport.performance.queries.map((query, index) => (
                            <div key={index} className="flex items-center justify-between text-sm">
                              <span>{query.table}</span>
                              <Badge variant={query.success ? "default" : "destructive"}>
                                {query.success ? "نجح" : "فشل"}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">لا توجد بيانات أداء متاحة</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Data Integrity Tab */}
            <TabsContent value="data" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>تكامل البيانات</CardTitle>
                    <CardDescription>فحص العلاقات والثبات</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {healthReport.data_integrity ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span>حالة البيانات</span>
                          <StatusBadge status={healthReport.data_integrity.status} />
                        </div>
                        
                        {healthReport.data_integrity.issues && healthReport.data_integrity.issues.map((issue, index) => (
                          <div key={index} className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-yellow-500" />
                              <span className="text-sm font-medium">
                                {issue.type === 'missing_variants' && 'منتجات بدون متغيرات'}
                                {issue.type === 'missing_inventory' && 'متغيرات بدون مخزون'}
                              </span>
                              <Badge variant="outline">{issue.count}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">لا توجد بيانات تكامل متاحة</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>العناصر غير المستخدمة</CardTitle>
                    <CardDescription>ألوان وأحجام يمكن حذفها</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {healthReport.data_integrity && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span>ألوان غير مستخدمة</span>
                          <Badge variant="outline">
                            {healthReport.data_integrity.unusedColors?.length || 0}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>أحجام غير مستخدمة</span>
                          <Badge variant="outline">
                            {healthReport.data_integrity.unusedSizes?.length || 0}
                          </Badge>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>حالة الأمان</CardTitle>
                  <CardDescription>فحص RLS وإعدادات الحماية</CardDescription>
                </CardHeader>
                <CardContent>
                  {healthReport.security ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span>الحالة العامة</span>
                        <StatusBadge status={healthReport.security.status} />
                      </div>
                      
                      {healthReport.security.tables && (
                        <div className="space-y-2">
                          <h4 className="font-medium">حماية الجداول:</h4>
                          {healthReport.security.tables.map((table, index) => (
                            <div key={index} className="flex items-center justify-between text-sm">
                              <span>{table.table}</span>
                              <Badge variant={table.protected ? "default" : "destructive"}>
                                {table.protected ? "محمي" : "مكشوف"}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">لا توجد بيانات أمان متاحة</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Recommendations Tab */}
            <TabsContent value="recommendations" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>التوصيات والتحسينات</CardTitle>
                  <CardDescription>اقتراحات لتحسين الأداء والأمان</CardDescription>
                </CardHeader>
                <CardContent>
                  {healthReport.recommendations && healthReport.recommendations.length > 0 ? (
                    <div className="space-y-3">
                      {healthReport.recommendations.map((recommendation, index) => (
                        <div key={index} className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <div className="flex items-start gap-2">
                            <TrendingUp className="h-4 w-4 text-blue-500 mt-0.5" />
                            <span className="text-sm">{recommendation}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                      <h3 className="font-medium text-green-600 mb-2">النظام في حالة ممتازة!</h3>
                      <p className="text-muted-foreground">لا توجد توصيات للتحسين في الوقت الحالي</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};

export default SystemHealthDashboard;