import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Receipt, Calendar, User, DollarSign, FileText, CheckCircle, TrendingUp, Award, Banknote } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';

/**
 * نافذة تفاصيل الأرباح المستلمة للموظف
 * تعرض قائمة الفواتير المدفوعة مع التفاصيل - نفس تصميم نافذة المدير
 */
const EmployeeReceivedProfitsDialog = ({
  isOpen,
  onClose,
  invoices = [],
  totalAmount = 0,
  employeeName,
  employeeCode,
  allUsers = []
}) => {

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ar-IQ', {
      style: 'currency',
      currency: 'IQD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const getPayerName = (createdBy) => {
    const payer = allUsers.find(u => u.id === createdBy);
    return payer ? payer.full_name : 'غير محدد';
  };

  // حساب الإحصائيات
  const stats = {
    totalReceived: totalAmount,
    invoicesCount: invoices.length,
    averageAmount: invoices.length > 0 ? totalAmount / invoices.length : 0,
    lastPaymentDate: invoices.length > 0 ? invoices[0]?.settlement_date : null
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden p-0">
        <ScrollArea className="h-full max-h-[85vh]">
          <div className="p-4 md:p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-4 mb-6">
                <div className="p-3 bg-gradient-to-r from-blue-500 to-green-600 rounded-full text-white shadow-lg">
                  <Receipt className="w-10 h-10" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-slate-800 dark:text-slate-100">أرباحي المستلمة</h1>
                  <p className="text-lg text-slate-600 dark:text-slate-400">تفاصيل الأرباح المدفوعة</p>
                </div>
              </div>
            </div>

            {/* معلومات الموظف والمبلغ الإجمالي */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              {/* معلومات الموظف */}
              <Card className="lg:col-span-2 relative overflow-hidden group cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl bg-background border-border">
                <CardContent className="relative p-5">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20 group-hover:scale-110 transition-all duration-300">
                      <User className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-bold text-lg text-foreground">معلومات الموظف</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-2 md:p-3 backdrop-blur-sm hover:from-blue-600 hover:to-blue-700 transition-all duration-300 relative overflow-hidden">
                        <div className="absolute -bottom-2 -right-2 w-6 h-6 md:w-8 md:h-8 bg-white/10 rounded-full"></div>
                        <p className="text-xs opacity-90 font-medium mb-1">اسم الموظف</p>
                        <p className="font-bold text-sm md:text-base">{employeeName || 'غير محدد'}</p>
                      </div>
                      <div className="bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-lg p-2 md:p-3 backdrop-blur-sm hover:from-emerald-600 hover:to-green-700 transition-all duration-300 relative overflow-hidden">
                        <div className="absolute -bottom-2 -right-2 w-6 h-6 md:w-8 md:h-8 bg-white/10 rounded-full"></div>
                        <p className="text-xs opacity-90 font-medium mb-1">معرف الموظف</p>
                        <p className="font-mono font-bold text-xs md:text-sm">{employeeCode || 'غير محدد'}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-lg p-2 md:p-3 backdrop-blur-sm hover:from-purple-600 hover:to-violet-700 transition-all duration-300 relative overflow-hidden">
                        <div className="absolute -bottom-2 -right-2 w-6 h-6 md:w-8 md:h-8 bg-white/10 rounded-full"></div>
                        <p className="text-xs opacity-90 font-medium mb-1">عدد الفواتير</p>
                        <p className="font-mono font-bold text-xs md:text-sm">{stats.invoicesCount}</p>
                      </div>
                      <div className="bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-lg p-2 md:p-3 backdrop-blur-sm hover:from-orange-600 hover:to-amber-700 transition-all duration-300 relative overflow-hidden">
                        <div className="absolute -bottom-2 -right-2 w-6 h-6 md:w-8 md:h-8 bg-white/10 rounded-full"></div>
                        <p className="text-xs opacity-90 font-medium mb-1">متوسط الفاتورة</p>
                        <p className="font-bold text-xs md:text-sm">{stats.averageAmount.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* المبلغ الإجمالي المستلم */}
              <Card className="relative overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl group cursor-pointer">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-green-600 to-teal-700 opacity-90"></div>
                <div className="absolute inset-0 bg-black/10"></div>
                <CardContent className="relative p-3 md:p-5 text-white text-center">
                  <div className="flex items-center justify-center gap-2 md:gap-3 mb-3 md:mb-4">
                    <div className="p-2 md:p-3 bg-white/20 rounded-xl backdrop-blur-sm border border-white/30 group-hover:scale-110 transition-all duration-300">
                      <DollarSign className="w-6 h-6 md:w-8 md:h-8 drop-shadow-lg" />
                    </div>
                    <h3 className="text-base md:text-lg font-bold drop-shadow-lg">إجمالي المستلم</h3>
                  </div>
                  <p className="text-2xl md:text-4xl font-black mb-2 md:mb-3 drop-shadow-2xl">
                    {totalAmount?.toLocaleString()}
                  </p>
                  <p className="text-sm md:text-base font-bold opacity-90 mb-3 md:mb-4 drop-shadow-lg">دينار عراقي</p>
                  <div className="bg-white/10 rounded-xl p-2 md:p-3 backdrop-blur-sm border border-white/20">
                    <div className="flex items-center justify-center gap-2 text-xs md:text-sm font-bold">
                      <CheckCircle className="w-4 h-4 md:w-5 md:h-5" />
                      <span>تم الاستلام بنجاح</span>
                    </div>
                  </div>
                  {/* تأثيرات بصرية محسنة */}
                  <div className="absolute -bottom-4 -right-4 w-12 h-12 md:w-16 md:h-16 bg-white/5 rounded-full"></div>
                  <div className="absolute -top-3 -left-3 w-8 h-8 md:w-12 md:h-12 bg-white/5 rounded-full"></div>
                </CardContent>
              </Card>
            </div>

            {/* إحصائيات سريعة */}
            {stats.invoicesCount > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 md:mb-6">
                <Card className="relative overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl">
                  <CardContent className="p-2 md:p-3 text-center">
                    <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-lg p-2 md:p-3 relative overflow-hidden">
                      <div className="flex justify-center mb-1 md:mb-2">
                        <div className="p-1 md:p-1.5 bg-white/10 rounded-full backdrop-blur-sm">
                          <Award className="w-4 h-4 md:w-5 md:h-5" />
                        </div>
                      </div>
                      <p className="text-[10px] md:text-xs opacity-90 mb-1">عدد الفواتير</p>
                      <p className="text-lg md:text-xl font-black">{stats.invoicesCount}</p>
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 md:w-6 md:h-6 bg-white/5 rounded-full"></div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="relative overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl">
                  <CardContent className="p-2 md:p-3 text-center">
                    <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-lg p-2 md:p-3 relative overflow-hidden">
                      <div className="flex justify-center mb-1 md:mb-2">
                        <div className="p-1 md:p-1.5 bg-white/10 rounded-full backdrop-blur-sm">
                          <TrendingUp className="w-4 h-4 md:w-5 md:h-5" />
                        </div>
                      </div>
                      <p className="text-[10px] md:text-xs opacity-90 mb-1">إجمالي المبلغ</p>
                      <p className="text-sm md:text-base font-black">{stats.totalReceived.toLocaleString()}</p>
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 md:w-6 md:h-6 bg-white/5 rounded-full"></div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="relative overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl">
                  <CardContent className="p-2 md:p-3 text-center">
                    <div className="bg-gradient-to-br from-purple-500 to-pink-600 text-white rounded-lg p-2 md:p-3 relative overflow-hidden">
                      <div className="flex justify-center mb-1 md:mb-2">
                        <div className="p-1 md:p-1.5 bg-white/10 rounded-full backdrop-blur-sm">
                          <Banknote className="w-4 h-4 md:w-5 md:h-5" />
                        </div>
                      </div>
                      <p className="text-[10px] md:text-xs opacity-90 mb-1">متوسط الفاتورة</p>
                      <p className="text-sm md:text-base font-black">{stats.averageAmount.toLocaleString()}</p>
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 md:w-6 md:h-6 bg-white/5 rounded-full"></div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="relative overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl">
                  <CardContent className="p-2 md:p-3 text-center">
                    <div className="bg-gradient-to-br from-orange-500 to-red-600 text-white rounded-lg p-2 md:p-3 relative overflow-hidden">
                      <div className="flex justify-center mb-1 md:mb-2">
                        <div className="p-1 md:p-1.5 bg-white/10 rounded-full backdrop-blur-sm">
                          <Calendar className="w-4 h-4 md:w-5 md:h-5" />
                        </div>
                      </div>
                      <p className="text-[10px] md:text-xs opacity-90 mb-1">آخر دفعة</p>
                      <p className="text-[10px] md:text-xs font-black">
                        {stats.lastPaymentDate ? format(parseISO(stats.lastPaymentDate), 'dd/MM', { locale: ar }) : 'لا يوجد'}
                      </p>
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 md:w-6 md:h-6 bg-white/5 rounded-full"></div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* قائمة الفواتير */}
            {invoices.length === 0 ? (
              <Card className="mb-4 md:mb-8 relative overflow-hidden shadow-2xl">
                <CardContent className="p-8 text-center">
                  <div className="bg-gradient-to-br from-gray-400 to-gray-600 text-white rounded-xl md:rounded-2xl p-8 relative overflow-hidden">
                    <Receipt className="w-16 h-16 text-white/50 mx-auto mb-4" />
                    <h3 className="text-xl font-bold mb-2">لم يتم دفع أي أرباح بعد</h3>
                    <p className="text-white/80">ستظهر فواتير الأرباح المستلمة هنا عند دفعها</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="mb-4 md:mb-8 relative overflow-hidden shadow-2xl">
                <CardContent className="p-4 md:p-8">
                  <div className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white rounded-xl md:rounded-2xl p-4 md:p-8 relative overflow-hidden">
                    <div className="flex items-center gap-2 md:gap-4 mb-4 md:mb-8">
                      <div className="p-2 md:p-4 bg-white/10 rounded-xl md:rounded-2xl backdrop-blur-sm">
                        <FileText className="w-6 h-6 md:w-10 md:h-10" />
                      </div>
                      <h3 className="font-black text-xl md:text-3xl">
                        تفاصيل الفواتير المستلمة ({invoices.length})
                      </h3>
                    </div>
                    
                    {/* عرض الهاتف - بدون جدول */}
                    <div className="md:hidden space-y-3">
                      {invoices
                        .sort((a, b) => new Date(b.settlement_date) - new Date(a.settlement_date))
                        .map((invoice, index) => (
                        <div key={invoice.id} className="bg-white/10 rounded-xl p-3 backdrop-blur-sm space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-blue-300 font-bold text-sm">#{invoice.invoice_number}</span>
                            <span className="text-cyan-300 text-xs">
                              {format(parseISO(invoice.settlement_date), 'dd/MM/yyyy', { locale: ar })}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="text-green-300">
                              <span className="opacity-70">المبلغ: </span>
                              <span className="font-bold">{invoice.total_amount?.toLocaleString() || '0'}</span>
                            </div>
                            <div className="text-orange-300">
                              <span className="opacity-70">دفع بواسطة: </span>
                              <span className="font-bold">{getPayerName(invoice.created_by)}</span>
                            </div>
                          </div>
                          {invoice.description && (
                            <div className="text-purple-300 text-xs">
                              <span className="opacity-70">الوصف: </span>
                              <span>{invoice.description}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* عرض الديسكتوب - جدول */}
                    <div className="hidden md:block bg-white/10 rounded-2xl p-1 backdrop-blur-sm">
                      <div className="bg-slate-900/80 rounded-xl overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-4 md:px-8 py-4 md:py-6">
                          <div className="grid grid-cols-5 gap-3 md:gap-6 text-center font-bold text-sm md:text-lg">
                            <div className="text-blue-300 flex items-center justify-center gap-1 md:gap-2">
                              <FileText className="w-3 h-3 md:w-4 md:h-4" />
                              رقم الفاتورة
                            </div>
                            <div className="text-green-300 flex items-center justify-center gap-1 md:gap-2">
                              <DollarSign className="w-3 h-3 md:w-4 md:h-4" />
                              المبلغ
                            </div>
                            <div className="text-purple-300 flex items-center justify-center gap-1 md:gap-2">
                              <Calendar className="w-3 h-3 md:w-4 md:h-4" />
                              تاريخ الدفع
                            </div>
                            <div className="text-orange-300 flex items-center justify-center gap-1 md:gap-2">
                              <User className="w-3 h-3 md:w-4 md:h-4" />
                              دفع بواسطة
                            </div>
                            <div className="text-cyan-300 flex items-center justify-center gap-1 md:gap-2">
                              الوصف
                            </div>
                          </div>
                        </div>
                        
                        {/* الفواتير */}
                        <div className="divide-y divide-slate-700/50">
                          {invoices
                            .sort((a, b) => new Date(b.settlement_date) - new Date(a.settlement_date))
                            .map((invoice, index) => (
                            <div key={invoice.id} className="px-4 md:px-8 py-3 md:py-4 hover:bg-white/5 transition-all duration-200">
                              <div className="grid grid-cols-5 gap-3 md:gap-6 text-center text-xs md:text-sm">
                                <div className="text-blue-300 font-mono font-bold">
                                  {invoice.invoice_number}
                                </div>
                                <div className="text-green-300 font-bold">
                                  {invoice.total_amount?.toLocaleString() || '0'}
                                </div>
                                <div className="text-purple-300">
                                  {format(parseISO(invoice.settlement_date), 'dd/MM/yyyy', { locale: ar })}
                                </div>
                                <div className="text-orange-300">
                                  {getPayerName(invoice.created_by)}
                                </div>
                                <div className="text-cyan-300 truncate" title={invoice.description}>
                                  {invoice.description || 'لا يوجد وصف'}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
};

export default EmployeeReceivedProfitsDialog;