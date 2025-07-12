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
import { useAuth } from '@/contexts/AuthContext';

const StatRow = ({ label, value, colorClass, isNegative = false, onClick }) => (
    <div className={`flex justify-between items-center py-3 border-b border-border/50 ${onClick ? 'cursor-pointer hover:bg-secondary/50 -mx-4 px-4' : ''}`} onClick={onClick}>
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="flex items-center gap-2">
            <p className={`font-semibold text-base ${colorClass}`}>
                {isNegative ? `(${value.toLocaleString()})` : value.toLocaleString()} د.ع
            </p>
            {onClick && <ArrowRight className="w-4 h-4 text-muted-foreground" />}
        </div>
    </div>
);

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
        today: 'اليوم',
        week: 'أسبوع',
        month: 'شهر',
        year: 'سنة',
    };

    const salesDetails = useMemo(() => {
        if (!summary || !summary.deliveredOrders) return { managerSales: 0, employeeSales: 0 };
        
        const managerSales = summary.deliveredOrders
            .filter(o => o.created_by === user.id)
            .reduce((sum, o) => sum + o.total, 0);

        const employeeSales = summary.deliveredOrders
            .filter(o => {
                const orderUser = allUsers.find(u => u.id === o.created_by);
                return orderUser && (orderUser.role === 'employee' || orderUser.role === 'deputy');
            })
            .reduce((sum, o) => sum + o.total, 0);
            
        return { managerSales, employeeSales };
    }, [summary, user.id, allUsers]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl w-[95vw] sm:w-full max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="flex-shrink-0 p-6 pb-4 border-b">
                    <DialogTitle className="flex items-center justify-between">
                        <span className="gradient-text">تقرير الأرباح والخسائر</span>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">{periodLabels[datePeriod]}</Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {Object.entries(periodLabels).map(([key, label]) => (
                                    <DropdownMenuItem key={key} onSelect={() => onDatePeriodChange(key)}>
                                        {label}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </DialogTitle>
                    <DialogDescription>ملخص مالي للفترة المحددة.</DialogDescription>
                </DialogHeader>
                <ScrollArea className="flex-grow">
                    <div className="space-y-6 p-6">
                        <div className="h-60 flex-shrink-0">
                            <MiniChart data={summary.chartData || []} type="bar" />
                        </div>
                        <div className="space-y-2 px-1">
                            <Accordion type="multiple" value={openAccordion} onValueChange={setOpenAccordion} className="w-full">
                                <AccordionItem value="sales" className="border-b-0">
                                    <AccordionTrigger className="flex justify-between items-center py-3 hover:no-underline -mx-4 px-4 hover:bg-secondary/50">
                                        <p className="text-sm text-muted-foreground">إجمالي المبيعات</p>
                                        <p className="font-semibold text-base text-green-500">
                                            {summary.totalRevenue.toLocaleString()} د.ع
                                        </p>
                                    </AccordionTrigger>
                                    <AccordionContent className="pb-0">
                                        <div className="pl-4 pr-8 py-2 space-y-2">
                                            <StatRow label="مبيعات المدير" value={salesDetails.managerSales} colorClass="text-green-400" onClick={() => handleNavigation('/my-orders', 'status', 'delivered')}/>
                                            <StatRow label="مبيعات الموظفين" value={salesDetails.employeeSales} colorClass="text-green-400" onClick={() => handleNavigation('/employee-follow-up')}/>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>

                            <StatRow label="تكلفة البضاعة المباعة" value={summary.cogs} colorClass="text-orange-500" isNegative />
                            <StatRow label="مجمل الربح" value={summary.grossProfit} colorClass="text-blue-500 font-bold" />
                            
                            <Accordion type="multiple" value={openAccordion} onValueChange={setOpenAccordion} className="w-full">
                                <AccordionItem value="expenses" className="border-b-0">
                                    <AccordionTrigger className="flex justify-between items-center py-3 hover:no-underline -mx-4 px-4 hover:bg-secondary/50">
                                        <p className="text-sm text-muted-foreground">إجمالي المصاريف</p>
                                        <p className="font-semibold text-base text-red-500">
                                            ({summary.totalExpenses.toLocaleString()}) د.ع
                                        </p>
                                    </AccordionTrigger>
                                    <AccordionContent className="pb-0">
                                        <div className="pl-4 pr-8 py-2 space-y-2">
                                            <StatRow label="مستحقات مدفوعة" value={summary.employeeSettledDues} colorClass="text-red-400" isNegative onClick={() => handleNavigation('/accounting')}/>
                                            <StatRow label="مصاريف عامة" value={summary.generalExpenses} colorClass="text-red-400" isNegative onClick={() => handleNavigation('/accounting')}/>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>

                            <div className="flex justify-between items-center py-3 mt-2 bg-secondary rounded-lg px-4 border-t">
                                <p className="font-bold text-lg">صافي الربح</p>
                                <p className="font-bold text-lg text-primary">{summary.netProfit.toLocaleString()} د.ع</p>
                            </div>
                        </div>
                    </div>
                </ScrollArea>
                <DialogFooter className="flex-shrink-0 p-6 pt-4 border-t">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>إغلاق</Button>
                    <Button onClick={() => handleNavigation('/accounting')}>
                        <BarChart className="w-4 h-4 ml-2" />
                        الذهاب للمركز المالي
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ProfitLossDialog;