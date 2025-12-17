import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { usePeriodClosing } from '@/hooks/usePeriodClosing';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subMonths } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  Calendar,
  Lock,
  Trash2,
  Plus,
  Eye,
  FileText,
  TrendingUp,
  DollarSign,
  Package,
  BarChart3,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  CalendarRange,
  CalendarDays,
  CalendarCheck,
  Settings
} from 'lucide-react';

const PeriodClosingManager = ({ className = '' }) => {
  const {
    closedPeriods,
    loading,
    creating,
    previewing,
    previewPeriod,
    createPeriod,
    closePeriod,
    lockPeriod,
    deletePeriod,
    updatePeriodNotes
  } = usePeriodClosing();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [periodType, setPeriodType] = useState('current_month');
  const [customRange, setCustomRange] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [preview, setPreview] = useState(null);

  // تحديث المعاينة عند تغيير نوع الفترة
  useEffect(() => {
    if (createDialogOpen && periodType !== 'custom') {
      loadPreview();
    }
  }, [periodType, createDialogOpen]);

  useEffect(() => {
    if (createDialogOpen && periodType === 'custom' && customRange?.from && customRange?.to) {
      loadPreview();
    }
  }, [customRange]);

  const loadPreview = async () => {
    const data = await previewPeriod(periodType, customRange);
    setPreview(data);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ar-IQ', {
      style: 'decimal',
      minimumFractionDigits: 0
    }).format(Math.abs(amount || 0));
  };

  const getStatusBadge = (status) => {
    const configs = {
      open: { label: 'مفتوحة', variant: 'default', icon: Clock, color: 'bg-blue-500' },
      closed: { label: 'مغلقة', variant: 'secondary', icon: CheckCircle2, color: 'bg-green-500' },
      locked: { label: 'مقفلة', variant: 'destructive', icon: Lock, color: 'bg-red-500' }
    };
    const config = configs[status] || configs.open;
    const Icon = config.icon;
    return (
      <Badge className={cn('flex items-center gap-1', config.color, 'text-white')}>
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  // خيارات الفترات مع التواريخ
  const getPeriodOptions = () => {
    const now = new Date();
    const lastMonth = subMonths(now, 1);
    
    return [
      {
        value: 'current_month',
        label: 'الشهر الحالي',
        description: format(now, 'MMMM yyyy', { locale: ar }),
        dates: `${format(startOfMonth(now), 'dd/MM')} - ${format(endOfMonth(now), 'dd/MM/yyyy')}`,
        icon: CalendarDays,
        recommended: true
      },
      {
        value: 'last_month',
        label: 'الشهر الماضي',
        description: format(lastMonth, 'MMMM yyyy', { locale: ar }),
        dates: `${format(startOfMonth(lastMonth), 'dd/MM')} - ${format(endOfMonth(lastMonth), 'dd/MM/yyyy')}`,
        icon: Calendar
      },
      {
        value: 'current_quarter',
        label: 'الربع الحالي',
        description: `الربع ${Math.ceil((now.getMonth() + 1) / 3)} - ${now.getFullYear()}`,
        dates: `${format(startOfQuarter(now), 'dd/MM')} - ${format(endOfQuarter(now), 'dd/MM/yyyy')}`,
        icon: CalendarCheck
      },
      {
        value: 'current_year',
        label: 'السنة الحالية',
        description: `${now.getFullYear()}`,
        dates: `${format(startOfYear(now), 'dd/MM')} - ${format(endOfYear(now), 'dd/MM/yyyy')}`,
        icon: CalendarRange
      },
      {
        value: 'custom',
        label: 'فترة مخصصة',
        description: 'حدد تاريخ البداية والنهاية',
        icon: Settings
      }
    ];
  };

  const handleCreate = async () => {
    const result = await createPeriod(periodType, customRange);
    if (result) {
      setCreateDialogOpen(false);
      setPeriodType('current_month');
      setCustomRange(null);
      setPreview(null);
    }
  };

  const handleViewDetails = (period) => {
    setSelectedPeriod(period);
    setDetailsDialogOpen(true);
  };

  const periodOptions = getPeriodOptions();

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-indigo-600 to-purple-600 text-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3 text-xl font-bold">
              <div className="p-2 bg-white/20 rounded-xl">
                <CalendarRange className="w-6 h-6" />
              </div>
              إغلاق الفترات المالية
            </CardTitle>
            
            <Dialog open={createDialogOpen} onOpenChange={(open) => {
              setCreateDialogOpen(open);
              if (!open) {
                setPreview(null);
                setPeriodType('current_month');
                setCustomRange(null);
              }
            }}>
              <DialogTrigger asChild>
                <Button variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0">
                  <Plus className="w-4 h-4 ml-2" />
                  إنشاء فترة جديدة
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    إنشاء فترة مالية جديدة
                  </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  {/* Period Type Selection */}
                  <RadioGroup value={periodType} onValueChange={setPeriodType} className="space-y-2">
                    {periodOptions.map((option) => {
                      const Icon = option.icon;
                      return (
                        <div
                          key={option.value}
                          className={cn(
                            'flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all',
                            periodType === option.value 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border hover:border-primary/50'
                          )}
                          onClick={() => setPeriodType(option.value)}
                        >
                          <RadioGroupItem value={option.value} id={option.value} />
                          <div className={cn(
                            'p-2 rounded-lg',
                            periodType === option.value ? 'bg-primary text-white' : 'bg-muted'
                          )}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1">
                            <Label htmlFor={option.value} className="font-medium cursor-pointer flex items-center gap-2">
                              {option.label}
                              {option.recommended && (
                                <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700">
                                  موصى به
                                </Badge>
                              )}
                            </Label>
                            <p className="text-sm text-muted-foreground">{option.description}</p>
                            {option.dates && (
                              <p className="text-xs text-muted-foreground mt-1">{option.dates}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </RadioGroup>

                  {/* Custom Date Range */}
                  {periodType === 'custom' && (
                    <div className="space-y-2 p-3 bg-muted rounded-lg">
                      <label className="text-sm font-medium">نطاق التواريخ</label>
                      <DateRangePicker
                        date={customRange}
                        onDateChange={setCustomRange}
                      />
                    </div>
                  )}

                  {/* Smart Preview */}
                  {previewing ? (
                    <div className="flex items-center justify-center p-6">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      <span className="mr-2 text-sm">جاري حساب البيانات...</span>
                    </div>
                  ) : preview && (
                    <div className={cn(
                      'p-4 rounded-lg border-2',
                      preview.isEmpty 
                        ? 'bg-amber-50 border-amber-200' 
                        : 'bg-emerald-50 border-emerald-200'
                    )}>
                      {preview.isEmpty ? (
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                          <div>
                            <p className="font-medium text-amber-800">تحذير: الفترة فارغة</p>
                            <p className="text-sm text-amber-600">لا توجد طلبات مستلمة فاتورتها في هذه الفترة</p>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            <span className="font-medium text-emerald-800">معاينة: {preview.periodName}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="flex items-center gap-2">
                              <Package className="w-4 h-4 text-blue-600" />
                              <span>{preview.delivered_orders} طلب مستلم</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <DollarSign className="w-4 h-4 text-emerald-600" />
                              <span>{formatCurrency(preview.total_revenue)} د.ع</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <TrendingUp className="w-4 h-4 text-purple-600" />
                              <span>صافي: {formatCurrency(preview.net_profit)} د.ع</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <BarChart3 className="w-4 h-4 text-orange-600" />
                              <span>رصيد: {formatCurrency(preview.closing_cash_balance)} د.ع</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    إلغاء
                  </Button>
                  <Button 
                    onClick={handleCreate} 
                    disabled={creating || (periodType === 'custom' && !customRange?.from)}
                  >
                    {creating && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                    إنشاء الفترة
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          
          <p className="text-white/80 text-sm mt-2">
            إدارة وتوثيق الفترات المالية - الشهرية والربعية والسنوية
          </p>
        </CardHeader>
      </Card>

      {/* Periods List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : closedPeriods.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CalendarRange className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">لا توجد فترات مغلقة</h3>
            <p className="text-muted-foreground mb-4">ابدأ بإنشاء أول فترة مالية لتوثيق الحسابات</p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 ml-2" />
              إنشاء فترة جديدة
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {closedPeriods.map((period) => (
            <Card key={period.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Period Info */}
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      'p-3 rounded-xl',
                      period.status === 'locked' ? 'bg-red-100 text-red-600' :
                      period.status === 'closed' ? 'bg-green-100 text-green-600' :
                      'bg-blue-100 text-blue-600'
                    )}>
                      <Calendar className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg flex items-center gap-2">
                        {period.period_name}
                        {getStatusBadge(period.status)}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(period.start_date), 'dd/MM/yyyy')} - {format(new Date(period.end_date), 'dd/MM/yyyy')}
                      </p>
                      <div className="flex flex-wrap gap-3 mt-2 text-sm">
                        <span className="flex items-center gap-1 text-emerald-600">
                          <TrendingUp className="w-4 h-4" />
                          صافي الربح: {formatCurrency(period.net_profit)} د.ع
                        </span>
                        <span className="flex items-center gap-1 text-blue-600">
                          <DollarSign className="w-4 h-4" />
                          الإيرادات: {formatCurrency(period.total_revenue)} د.ع
                        </span>
                        <span className="flex items-center gap-1 text-orange-600">
                          <Package className="w-4 h-4" />
                          {period.delivered_orders} طلب مستلم
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => handleViewDetails(period)}>
                      <Eye className="w-4 h-4 ml-1" />
                      التفاصيل
                    </Button>
                    
                    {period.status === 'open' && (
                      <>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-green-600 border-green-200 hover:bg-green-50">
                              <CheckCircle2 className="w-4 h-4 ml-1" />
                              إغلاق
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>إغلاق الفترة</AlertDialogTitle>
                              <AlertDialogDescription>
                                هل أنت متأكد من إغلاق فترة "{period.period_name}"؟
                                لا يزال بإمكانك إعادة فتحها لاحقاً.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction onClick={() => closePeriod(period.id)}>
                                إغلاق الفترة
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50">
                              <Trash2 className="w-4 h-4 ml-1" />
                              حذف
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>حذف الفترة</AlertDialogTitle>
                              <AlertDialogDescription>
                                هل أنت متأكد من حذف فترة "{period.period_name}"؟
                                هذا الإجراء لا يمكن التراجع عنه.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deletePeriod(period.id)} className="bg-red-600 hover:bg-red-700">
                                حذف
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}

                    {period.status === 'closed' && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-amber-600 border-amber-200 hover:bg-amber-50">
                            <Lock className="w-4 h-4 ml-1" />
                            قفل نهائي
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>قفل الفترة نهائياً</AlertDialogTitle>
                            <AlertDialogDescription>
                              <AlertTriangle className="w-5 h-5 inline ml-1 text-amber-500" />
                              هل أنت متأكد من قفل فترة "{period.period_name}" نهائياً؟
                              <br />
                              <strong className="text-red-600">لا يمكن التعديل على الفترة بعد قفلها.</strong>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                            <AlertDialogAction onClick={() => lockPeriod(period.id)} className="bg-amber-600 hover:bg-amber-700">
                              قفل نهائي
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}

                    {period.status === 'locked' && (
                      <Badge variant="outline" className="text-red-600 border-red-200">
                        <Lock className="w-3 h-3 ml-1" />
                        مقفلة نهائياً
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedPeriod && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  تفاصيل فترة: {selectedPeriod.period_name}
                  {getStatusBadge(selectedPeriod.status)}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Financial Summary */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Card className="bg-gradient-to-br from-emerald-500 to-teal-500 text-white border-0">
                    <CardContent className="p-3 text-center">
                      <TrendingUp className="w-5 h-5 mx-auto mb-1" />
                      <p className="text-xs opacity-80">صافي الربح</p>
                      <p className="text-lg font-bold">{formatCurrency(selectedPeriod.net_profit)}</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-blue-500 to-indigo-500 text-white border-0">
                    <CardContent className="p-3 text-center">
                      <DollarSign className="w-5 h-5 mx-auto mb-1" />
                      <p className="text-xs opacity-80">إجمالي الإيرادات</p>
                      <p className="text-lg font-bold">{formatCurrency(selectedPeriod.total_revenue)}</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-purple-500 to-pink-500 text-white border-0">
                    <CardContent className="p-3 text-center">
                      <BarChart3 className="w-5 h-5 mx-auto mb-1" />
                      <p className="text-xs opacity-80">الربح الإجمالي</p>
                      <p className="text-lg font-bold">{formatCurrency(selectedPeriod.gross_profit)}</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-orange-500 to-amber-500 text-white border-0">
                    <CardContent className="p-3 text-center">
                      <Package className="w-5 h-5 mx-auto mb-1" />
                      <p className="text-xs opacity-80">تكلفة البضاعة</p>
                      <p className="text-lg font-bold">{formatCurrency(selectedPeriod.total_cogs)}</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-red-500 to-rose-500 text-white border-0">
                    <CardContent className="p-3 text-center">
                      <TrendingUp className="w-5 h-5 mx-auto mb-1 rotate-180" />
                      <p className="text-xs opacity-80">المصاريف العامة</p>
                      <p className="text-lg font-bold">{formatCurrency(selectedPeriod.total_general_expenses)}</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-cyan-500 to-blue-500 text-white border-0">
                    <CardContent className="p-3 text-center">
                      <DollarSign className="w-5 h-5 mx-auto mb-1" />
                      <p className="text-xs opacity-80">رصيد الإغلاق</p>
                      <p className="text-lg font-bold">{formatCurrency(selectedPeriod.closing_cash_balance)}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Detailed Breakdown */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">التفاصيل المالية</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">رصيد الافتتاح</span>
                      <span className="font-medium">{formatCurrency(selectedPeriod.opening_cash_balance)} د.ع</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">إجمالي الإيرادات</span>
                      <span className="font-medium text-emerald-600">+{formatCurrency(selectedPeriod.total_revenue)} د.ع</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">رسوم التوصيل</span>
                      <span className="font-medium">{formatCurrency(selectedPeriod.total_delivery_fees)} د.ع</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">المبيعات بدون التوصيل</span>
                      <span className="font-medium">{formatCurrency(selectedPeriod.sales_without_delivery)} د.ع</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">تكلفة البضاعة المباعة</span>
                      <span className="font-medium text-red-600">-{formatCurrency(selectedPeriod.total_cogs)} د.ع</span>
                    </div>
                    <div className="flex justify-between py-2 border-b bg-muted/50 px-2 rounded">
                      <span className="font-medium">الربح الإجمالي</span>
                      <span className="font-bold text-purple-600">{formatCurrency(selectedPeriod.gross_profit)} د.ع ({selectedPeriod.gross_profit_margin?.toFixed(1)}%)</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">المصاريف العامة</span>
                      <span className="font-medium text-red-600">-{formatCurrency(selectedPeriod.total_general_expenses)} د.ع</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">مستحقات الموظفين المدفوعة</span>
                      <span className="font-medium text-orange-600">{formatCurrency(selectedPeriod.total_employee_dues_paid)} د.ع</span>
                    </div>
                    <div className="flex justify-between py-2 bg-emerald-50 px-2 rounded">
                      <span className="font-bold">صافي الربح</span>
                      <span className="font-bold text-emerald-600">{formatCurrency(selectedPeriod.net_profit)} د.ع ({selectedPeriod.net_profit_margin?.toFixed(1)}%)</span>
                    </div>
                    <div className="flex justify-between py-2 border-t-2 mt-2">
                      <span className="font-bold">رصيد الإغلاق</span>
                      <span className="font-bold text-blue-600">{formatCurrency(selectedPeriod.closing_cash_balance)} د.ع</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Orders Statistics */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">إحصائيات الطلبات</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-blue-600">{selectedPeriod.total_orders}</p>
                      <p className="text-xs text-muted-foreground">إجمالي الطلبات</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-emerald-600">{selectedPeriod.delivered_orders}</p>
                      <p className="text-xs text-muted-foreground">طلبات مستلمة</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-600">{selectedPeriod.returned_orders}</p>
                      <p className="text-xs text-muted-foreground">طلبات مرجعة</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Notes */}
                {selectedPeriod.status !== 'locked' && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">ملاحظات</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Textarea
                        placeholder="أضف ملاحظات حول هذه الفترة..."
                        value={selectedPeriod.notes || ''}
                        onChange={(e) => {
                          setSelectedPeriod({ ...selectedPeriod, notes: e.target.value });
                        }}
                        onBlur={() => {
                          if (selectedPeriod.notes !== undefined) {
                            updatePeriodNotes(selectedPeriod.id, selectedPeriod.notes);
                          }
                        }}
                        rows={3}
                      />
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PeriodClosingManager;