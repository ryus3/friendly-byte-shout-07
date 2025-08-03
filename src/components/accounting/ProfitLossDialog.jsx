import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BarChart, ArrowRight } from 'lucide-react';
import MiniChart from '@/components/dashboard/MiniChart';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/UnifiedAuthContext';

const StatRow = ({ label, value, colorClass, isNegative = false, onClick }) => {
    const safeValue = value ?? 0;
    return (
        <div className={`flex justify-between items-center py-3 border-b border-border/50 ${onClick ? 'cursor-pointer hover:bg-secondary/50 -mx-4 px-4' : ''}`} onClick={onClick}>
            <p className="text-sm text-muted-foreground">{label}</p>
            <div className="flex items-center gap-2">
                <p className={`font-semibold text-base ${colorClass}`}>
                    {isNegative ? `(${safeValue.toLocaleString()})` : safeValue.toLocaleString()} د.ع
                </p>
                {onClick && <ArrowRight className="w-4 h-4 text-muted-foreground" />}
            </div>
        </div>
    );
};

const ProfitLossDialog = ({ open, onOpenChange, summary, datePeriod, onDatePeriodChange }) => {
    const navigate = useNavigate();
    const { user, allUsers } = useAuth();
    const [openAccordion, setOpenAccordion] = useState([]);

    const handleNavigation = (path, filterKey, filterValue) => {
        const params = new URLSearchParams();
        if(filterKey && filterValue) {
            params.set(filterKey, filterValue);
        }
        navigate(`${path}?${params.toString()}`);
        onOpenChange(false);
    };

    const periodLabels = {
        all: 'كل الفترات',
        today: 'اليوم',
        week: 'أسبوع',
        month: 'شهر',
        year: 'سنة',
    };

    const salesDetails = useMemo(() => {
        // استخدام البيانات المحسوبة مسبقاً من AccountingPage
        return {
            managerSales: summary?.managerSales || 0,
            employeeSales: summary?.employeeSales || 0
        };
    }, [summary]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] max-w-2xl h-[90vh] flex flex-col p-0 gap-0">
                <DialogHeader className="flex-shrink-0 p-4 sm:p-6 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                    <DialogTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="gradient-text text-lg sm:text-xl">تقرير الأرباح والخسائر</span>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="w-full sm:w-auto">{periodLabels[datePeriod]}</Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent 
                                align="end" 
                                className="z-[9999] bg-background border shadow-lg"
                                sideOffset={4}
                            >
                                {Object.entries(periodLabels).map(([key, label]) => (
                                    <DropdownMenuItem key={key} onSelect={() => onDatePeriodChange(key)}>
                                        {label}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </DialogTitle>
                    <DialogDescription className="text-sm">ملخص مالي للفترة المحددة.</DialogDescription>
                </DialogHeader>
                <div className="flex-1 flex flex-col min-h-0">
                    <ScrollArea className="flex-1 w-full">
                        <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
                            <div className="h-48 sm:h-60 flex-shrink-0">
                                <MiniChart 
                                    data={[
                                        { 
                                            name: 'البيانات المالية',
                                            revenue: (summary?.totalRevenue || 0) - (summary?.deliveryFees || 0),
                                            cogs: summary?.cogs || 0,
                                            expenses: summary?.generalExpenses || 0,
                                            dues: summary?.employeeSettledDues || 0,
                                            profit: summary?.netProfit || 0
                                        }
                                    ]} 
                                    type="bar" 
                                />
                            </div>
                            <div className="space-y-1 sm:space-y-2">
                                <Accordion type="multiple" value={openAccordion} onValueChange={setOpenAccordion} className="w-full">
                                    <AccordionItem value="sales" className="border-b-0">
                                        <AccordionTrigger className="flex justify-between items-center py-2 sm:py-3 hover:no-underline -mx-2 sm:-mx-4 px-2 sm:px-4 hover:bg-secondary/50 text-sm sm:text-base">
                                            <p className="text-sm text-muted-foreground">إجمالي المبيعات (بدون توصيل)</p>
                                            <p className="font-semibold text-green-500">
                                                {((summary?.totalRevenue || 0) - (summary?.deliveryFees || 0)).toLocaleString()} د.ع
                                            </p>
                                        </AccordionTrigger>
                                        <AccordionContent className="pb-0">
                                            <div className="pl-2 sm:pl-4 pr-4 sm:pr-8 py-2 space-y-2">
                                                <StatRow label="مبيعات المدير" value={salesDetails.managerSales} colorClass="text-green-400" onClick={() => handleNavigation('/my-orders', 'status', 'delivered')}/>
                                                <StatRow label="مبيعات الموظفين" value={salesDetails.employeeSales} colorClass="text-green-400" onClick={() => handleNavigation('/employee-follow-up')}/>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                </Accordion>

                                <StatRow label="رسوم التوصيل" value={summary?.deliveryFees || 0} colorClass="text-cyan-500" />
                                <StatRow label="تكلفة البضاعة المباعة" value={summary?.cogs || 0} colorClass="text-orange-500" isNegative />
                                <StatRow label="مجمل الربح (قبل المصاريف)" value={summary?.grossProfit || 0} colorClass="text-blue-500 font-bold" />
                                
                                <StatRow label="مستحقات مدفوعة" value={summary?.employeeSettledDues || 0} colorClass="text-red-400" isNegative onClick={() => handleNavigation('/accounting')}/>
                                <StatRow label="المصاريف العامة" value={summary?.generalExpenses || 0} colorClass="text-red-500" isNegative onClick={() => handleNavigation('/accounting')}/>
                                

                                <div className="flex justify-between items-center py-2 sm:py-3 mt-2 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg px-3 sm:px-4 border border-primary/20">
                                    <p className="font-bold text-base sm:text-lg">صافي الربح</p>
                                    <p className="font-bold text-base sm:text-lg text-primary">{(summary?.netProfit || 0).toLocaleString()} د.ع</p>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                </div>
                <div className="flex-shrink-0 p-4 sm:p-6 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                    <div className="flex flex-col sm:flex-row gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">إغلاق</Button>
                        <Button onClick={() => handleNavigation('/accounting')} className="w-full sm:w-auto">
                            <BarChart className="w-4 h-4 ml-2" />
                            الذهاب للمركز المالي
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ProfitLossDialog;