import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  DollarSign,
  FileX,
  Settings
} from 'lucide-react';
import { useFinancialIntegrityChecker } from '@/hooks/useFinancialIntegrityChecker';

/**
 * نافذة فحص وتنظيف النظام المالي
 */
const FinancialIntegrityDialog = ({ open, onOpenChange }) => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  
  const { 
    generateFinancialHealthReport, 
    fixDuplicateMovements 
  } = useFinancialIntegrityChecker();

  // تشغيل الفحص عند فتح النافذة
  useEffect(() => {
    if (open) {
      runHealthCheck();
    }
  }, [open]);

  const runHealthCheck = async () => {
    setLoading(true);
    try {
      const healthReport = await generateFinancialHealthReport();
      setReport(healthReport);
    } catch (error) {
      console.error('خطأ في فحص النظام المالي:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFixDuplicates = async () => {
    if (!report?.details?.duplicates?.length) return;
    
    setFixing(true);
    try {
      const fixResults = await fixDuplicateMovements(report.details.duplicates);
      console.log('نتائج الإصلاح:', fixResults);
      
      // إعادة تشغيل الفحص
      await runHealthCheck();
    } catch (error) {
      console.error('خطأ في إصلاح التكرارات:', error);
    } finally {
      setFixing(false);
    }
  };

  const getHealthIcon = (health) => {
    switch (health) {
      case 'healthy':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'needs_attention':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Settings className="w-5 h-5 text-gray-500" />;
    }
  };

  const getHealthColor = (health) => {
    switch (health) {
      case 'healthy':
        return 'from-green-500 to-emerald-600';
      case 'needs_attention':
        return 'from-yellow-500 to-orange-600';
      case 'error':
        return 'from-red-500 to-red-600';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Settings className="w-4 h-4 text-blue-500" />
            </div>
            فحص وتنظيف النظام المالي
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* أزرار التحكم */}
          <div className="flex gap-2">
            <Button 
              onClick={runHealthCheck} 
              disabled={loading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              إعادة الفحص
            </Button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">جاري فحص النظام المالي...</p>
              </div>
            </div>
          )}

          {report && (
            <div className="space-y-4">
              {/* نظرة عامة على الصحة */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {getHealthIcon(report.health?.overallHealth)}
                    الصحة العامة للنظام المالي
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`bg-gradient-to-r ${getHealthColor(report.health?.overallHealth)} rounded-lg p-4 text-white mb-4`}>
                    <h3 className="text-lg font-bold mb-2">
                      {report.health?.overallHealth === 'healthy' && 'النظام المالي سليم ✅'}
                      {report.health?.overallHealth === 'needs_attention' && 'النظام يحتاج لانتباه ⚠️'}
                      {report.health?.overallHealth === 'error' && 'يوجد مشاكل في النظام ❌'}
                    </h3>
                    <p className="text-sm opacity-90">
                      آخر فحص: {new Date(report.timestamp).toLocaleString('ar-EG')}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">
                        {report.health?.duplicateMovements || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">حركات مكررة</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {(report.health?.totalDuplicateAmount || 0).toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">د.ع مبلغ مكرر</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* الحركات المكررة */}
              {report.details?.duplicates?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <FileX className="w-5 h-5 text-red-500" />
                        الحركات المالية المكررة ({report.details.duplicates.length})
                      </span>
                      <Button 
                        onClick={handleFixDuplicates}
                        disabled={fixing}
                        variant="destructive"
                        size="sm"
                      >
                        {fixing ? 'جاري الإصلاح...' : 'إصلاح التكرارات'}
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {report.details.duplicates.map((duplicate, index) => (
                        <div key={index} className="border rounded-lg p-3 bg-red-50 dark:bg-red-900/20">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-red-700 dark:text-red-300">
                                مصروف مكرر: {duplicate.amount.toLocaleString()} د.ع
                              </p>
                              <p className="text-sm text-muted-foreground">
                                مكرر {duplicate.count} مرات - معرف المرجع: {duplicate.referenceId}
                              </p>
                            </div>
                            <Badge variant="destructive">
                              {duplicate.count}x
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* عدم التطابق */}
              {report.details?.inconsistencies?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-yellow-500" />
                      عدم التطابق ({report.details.inconsistencies.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {report.details.inconsistencies.map((issue, index) => (
                        <div key={index} className="border rounded-lg p-3 bg-yellow-50 dark:bg-yellow-900/20">
                          <p className="font-semibold text-yellow-700 dark:text-yellow-300">
                            {issue.issue}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            مصروف: {issue.expense?.description} - {issue.expense?.amount} د.ع
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* التوصيات */}
              {report.recommendations?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-blue-500" />
                      التوصيات
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {report.recommendations.map((rec, index) => (
                        <Alert key={index}>
                          <AlertDescription>{rec.message}</AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* النظام سليم */}
              {report.health?.overallHealth === 'healthy' && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    ممتاز! النظام المالي يعمل بشكل صحيح ولا توجد مشاكل تحتاج لإصلاح.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FinancialIntegrityDialog;