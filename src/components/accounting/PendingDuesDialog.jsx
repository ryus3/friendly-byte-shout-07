import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { AlertTriangle, User, DollarSign, UserCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';

const PendingDuesDialog = ({ open, onOpenChange, orders, allUsers, allProfits = [] }) => {
    const navigate = useNavigate();
    const [selectedEmployee, setSelectedEmployee] = useState('all');
    const [selectedOrders, setSelectedOrders] = useState([]);

    // استخدام بيانات جدول profits بدلاً من الحساب اليدوي
    const pendingProfitsData = useMemo(() => {
        if (!allProfits || !orders) return [];
        
        return allProfits.filter(profit => {
            // فقط الأرباح المعلقة
            if (profit.status !== 'pending') return false;
            
            // التحقق من وجود الطلب
            const order = orders.find(o => o.id === profit.order_id);
            if (!order) return false;
            
            // فقط الطلبات المسلمة ومستلمة الفاتورة
            const isDeliveredWithReceipt = (order.status === 'delivered' || order.status === 'completed') 
              && order.receipt_received === true;
            
            return isDeliveredWithReceipt;
        }).map(profit => {
            const order = orders.find(o => o.id === profit.order_id);
            return {
                ...profit,
                order: order
            };
        });
    }, [allProfits, orders]);

    const employeesWithPendingDues = useMemo(() => {
        const employeeIds = new Set(pendingProfitsData.map(p => p.employee_id));
        return allUsers.filter(u => employeeIds.has(u.id));
    }, [pendingProfitsData, allUsers]);

    const filteredData = useMemo(() => {
        if (selectedEmployee === 'all') {
            return pendingProfitsData;
        }
        return pendingProfitsData.filter(p => p.employee_id === selectedEmployee);
    }, [pendingProfitsData, selectedEmployee]);

    const totalPendingAmount = useMemo(() => {
        return filteredData.reduce((sum, profit) => sum + (profit.employee_profit || 0), 0);
    }, [filteredData]);

    const handleNavigate = (path) => {
        navigate(path);
        onOpenChange(false);
    };

    const handleSelectOrder = (profitId) => {
        setSelectedOrders(prev =>
            prev.includes(profitId) ? prev.filter(id => id !== profitId) : [...prev, profitId]
        );
    };

    const handleSettleSelected = () => {
        if (selectedOrders.length === 0) {
            toast({ title: "خطأ", description: "الرجاء تحديد طلب واحد على الأقل.", variant: "destructive" });
            return;
        }
        if (selectedEmployee === 'all') {
            toast({ title: "خطأ", description: "الرجاء تحديد موظف أولاً لتسوية مستحقاته.", variant: "destructive" });
            return;
        }
        // التوجيه لصفحة متابعة الموظفين مع تحديد البيانات
        navigate(`/employee-follow-up?employee=${selectedEmployee}&orders=${selectedOrders.join(',')}&highlight=settlement`);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl w-[95vw] sm:w-full flex flex-col max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="text-amber-500" />
                        المستحقات المعلقة للموظفين
                    </DialogTitle>
                    <DialogDescription>
                        عرض وتسوية الأرباح التي لم تتم تسويتها للموظفين بعد.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-grow space-y-4 py-4 overflow-y-auto">
                    <div className="flex flex-col sm:flex-row gap-4 items-center p-4 bg-secondary rounded-lg border">
                        <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                            <SelectTrigger className="flex-1">
                                <SelectValue placeholder="اختر موظف" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">كل الموظفين</SelectItem>
                                {employeesWithPendingDues.map(emp => (
                                    <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className="flex-1 text-center">
                            <p className="text-sm text-muted-foreground">الإجمالي المعلق للمحدد</p>
                            <p className="text-2xl font-bold text-amber-500">{totalPendingAmount.toLocaleString()} د.ع</p>
                        </div>
                    </div>
                    <ScrollArea className="h-80 border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead></TableHead>
                                    <TableHead>الموظف</TableHead>
                                    <TableHead>رقم الطلب</TableHead>
                                    <TableHead>تاريخ التسليم</TableHead>
                                    <TableHead className="text-right">الربح</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredData.length > 0 ? filteredData.map(profit => {
                                    const employee = allUsers.find(u => u.id === profit.employee_id);
                                    const order = profit.order;
                                    return (
                                        <TableRow key={profit.id}>
                                            <TableCell>
                                                <Checkbox
                                                    checked={selectedOrders.includes(profit.id)}
                                                    onCheckedChange={() => handleSelectOrder(profit.id)}
                                                    disabled={selectedEmployee === 'all' || profit.employee_id !== selectedEmployee}
                                                />
                                            </TableCell>
                                            <TableCell>{employee?.full_name || 'غير معروف'}</TableCell>
                                            <TableCell className="font-mono">{order?.order_number || 'غير معروف'}</TableCell>
                                            <TableCell>{order ? format(parseISO(order.updated_at), 'd MMM yyyy', { locale: ar }) : '-'}</TableCell>
                                            <TableCell className="text-right font-semibold text-amber-500">{(profit.employee_profit || 0).toLocaleString()} د.ع</TableCell>
                                        </TableRow>
                                    );
                                }) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center h-24">
                                            لا توجد مستحقات معلقة حالياً.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </div>
                <DialogFooter className="gap-2 sm:justify-between flex-wrap">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>إغلاق</Button>
                    <div className="flex gap-2 flex-wrap">
                        <Button onClick={() => handleNavigate('/profits-summary')}>
                            <User className="w-4 h-4 ml-2" />
                            ملخص الأرباح
                        </Button>
                         <Button onClick={() => handleNavigate('/employee-follow-up')}>
                            <DollarSign className="w-4 h-4 ml-2" />
                            متابعة الموظفين
                        </Button>
                        <Button onClick={handleSettleSelected} disabled={selectedOrders.length === 0 || selectedEmployee === 'all'}>
                            <UserCheck className="w-4 h-4 ml-2" />
                            تسوية المحدد ({selectedOrders.length})
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default PendingDuesDialog;