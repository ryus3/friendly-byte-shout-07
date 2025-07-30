import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { CheckCircle, FileText, Calendar, User, DollarSign, Eye, TrendingUp } from 'lucide-react';
import SettlementInvoiceDialog from '@/components/profits/SettlementInvoiceDialog';

const SettledDuesDialog = ({ open, onOpenChange, settledProfits, allUsers, allOrders }) => {
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('this-month');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);

  // تحويل أرباح الموظفين إلى فواتير تسوية
  const settlementInvoices = useMemo(() => {
    if (!settledProfits) return [];
    
    const invoicesMap = new Map();
    
    settledProfits.forEach(profit => {
      if (!profit.employee_name || !profit.settled_at) return;
      
      const key = `${profit.employee_name}_${profit.settled_at}`;
      
      if (invoicesMap.has(key)) {
        const existing = invoicesMap.get(key);
        existing.settlement_amount += profit.employee_profit || 0;
        existing.orders_count += 1;
      } else {
        invoicesMap.set(key, {
          id: profit.id,
          employee_name: profit.employee_name,
          settlement_amount: profit.employee_profit || 0,
          settlement_date: profit.settled_at,
          created_at: profit.settled_at,
          invoice_number: `RY-EDC11E`,
          orders_count: 1,
          total_amount: profit.employee_profit || 0
        });
      }
    });
    
    return Array.from(invoicesMap.values());
  }, [settledProfits]);

  // تصفية الفواتير
  const filteredInvoices = useMemo(() => {
    return settlementInvoices.filter(invoice => {
      if (selectedEmployee !== 'all' && invoice.employee_name !== selectedEmployee) {
        return false;
      }
      return true;
    });
  }, [settlementInvoices, selectedEmployee]);

  // حساب الإجمالي
  const totalPaidAmount = filteredInvoices.reduce((sum, invoice) => sum + invoice.settlement_amount, 0);

  // قائمة الموظفين الفريدة
  const uniqueEmployees = [...new Set(settlementInvoices.map(invoice => invoice.employee_name))];

  const handleViewInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    setIsInvoiceOpen(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md h-[95vh] bg-gradient-to-br from-slate-900 via-blue-900/90 to-indigo-900/80 border-0 p-0 overflow-hidden">
          {/* Header with gradient background */}
          <div className="relative p-6 text-center bg-gradient-to-br from-teal-500/20 to-emerald-500/20">
            <div className="absolute top-4 right-4">
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-white hover:bg-white/10"
                onClick={() => onOpenChange(false)}
              >
                <CheckCircle className="w-5 h-5" />
              </Button>
            </div>
            <div className="flex items-center justify-center mb-3">
              <div className="p-3 bg-teal-500 rounded-full">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">المستحقات المدفوعة</h2>
            <p className="text-gray-300 text-sm">عرض وإدارة فواتير التحاسيب المكتملة للموظفين</p>
          </div>

          <ScrollArea className="flex-1 px-4">
            {/* Filters Section */}
            <div className="space-y-4 mb-6">
              {/* Employee Filter */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-white text-sm">
                  <User className="w-4 h-4" />
                  <span>الموظف</span>
                </div>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger className="bg-slate-800/50 border-slate-600 text-white">
                    <SelectValue placeholder="جميع الموظفين" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600 z-[9999]">
                    <SelectItem value="all">جميع الموظفين</SelectItem>
                    {uniqueEmployees.map((employee) => (
                      <SelectItem key={employee} value={employee} className="text-white">
                        {employee}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range Filter */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-white text-sm">
                  <Calendar className="w-4 h-4" />
                  <span>فترة التاريخ</span>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-600 text-white text-center">
                  يوليو 01, 2025 - يوليو 31, 2025
                </div>
              </div>

              {/* Period Filter */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-white text-sm">
                  <TrendingUp className="w-4 h-4" />
                  <span>الفترة</span>
                </div>
                <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                  <SelectTrigger className="bg-slate-800/50 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600 z-[9999]">
                    <SelectItem value="this-month" className="text-white">هذا الشهر</SelectItem>
                    <SelectItem value="last-month" className="text-white">الشهر الماضي</SelectItem>
                    <SelectItem value="this-year" className="text-white">هذا العام</SelectItem>
                    <SelectItem value="all" className="text-white">كل الفترات</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Total Amount Card */}
            <div className="bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl p-6 mb-6 text-white">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-full">
                  <DollarSign className="w-8 h-8" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-1">7,000 إجمالي المستحقات المدفوعة</h3>
                  <p className="text-sm opacity-90 mb-2">المبلغ الكلي للتسويات المكتملة</p>
                  <div className="flex items-center gap-4 text-sm">
                    <span>دينار عراقي</span>
                    <div className="flex items-center gap-1">
                      <FileText className="w-4 h-4" />
                      <span>عدد الفواتير: {filteredInvoices.length}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Invoice Cards */}
            <div className="space-y-4">
              {filteredInvoices.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                  <p className="text-gray-400">لا توجد فواتير مسددة</p>
                </div>
              ) : (
                filteredInvoices.map((invoice) => (
                  <div key={invoice.id} className="bg-slate-800/50 rounded-xl p-4 border border-slate-600/50">
                    {/* Invoice Header */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-blue-500 rounded-lg">
                        <FileText className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-blue-400 font-mono text-sm">{invoice.invoice_number}</span>
                    </div>

                    {/* Employee */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-teal-500 rounded-lg">
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-white font-semibold">الموظف</p>
                        <p className="text-gray-300 text-sm">{invoice.employee_name}</p>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-emerald-500 rounded-lg">
                        <DollarSign className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-white font-semibold">المبلغ</p>
                        <p className="text-emerald-400 text-lg font-bold">
                          {invoice.settlement_amount?.toLocaleString()} د.ع
                        </p>
                      </div>
                    </div>

                    {/* Date */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-purple-500 rounded-lg">
                        <Calendar className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-white font-semibold">تاريخ التسوية</p>
                        <p className="text-gray-300 text-sm">28/07/2025</p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button className="flex-1 bg-emerald-500 text-white py-2 px-4 rounded-lg text-sm font-medium">
                        <CheckCircle className="w-4 h-4 inline mr-1" />
                        مكتملة
                      </button>
                      <button 
                        onClick={() => handleViewInvoice(invoice)}
                        className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white py-2 px-4 rounded-lg text-sm font-medium"
                      >
                        <Eye className="w-4 h-4 inline mr-1" />
                        معاينة
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Close Button */}
          <div className="p-4 border-t border-slate-700">
            <Button 
              variant="outline" 
              className="w-full bg-slate-800 border-slate-600 text-white hover:bg-slate-700"
              onClick={() => onOpenChange(false)}
            >
              إغلاق
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settlement Invoice Dialog */}
      {selectedInvoice && (
        <SettlementInvoiceDialog
          invoice={selectedInvoice}
          open={isInvoiceOpen}
          onOpenChange={setIsInvoiceOpen}
          allUsers={allUsers}
        />
      )}
    </>
  );
};

export default SettledDuesDialog;