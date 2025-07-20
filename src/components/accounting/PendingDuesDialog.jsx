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
import { toast } from '@/components/ui/use-toast';

const PendingDuesDialog = ({ open, onOpenChange, orders, allUsers }) => {
    const navigate = useNavigate();
    const [selectedEmployee, setSelectedEmployee] = useState('all');
    const [selectedOrders, setSelectedOrders] = useState([]);

    // فلترة الطلبات للأرباح المعلقة فقط (للموظفين فقط، وليس للمدير)
    const pendingDuesOrders = useMemo(() => {
        if (!orders || !Array.isArray(orders)) return [];
        
        return orders.filter(order => {
            // التحقق من الشروط:
            // 1. تم تسليم الطلب أو اكتماله
            // 2. تم استلام الفاتورة
            // 3. ليس الطلب من إنشاء المدير (معرف المدير: 91484496-b887-44f7-9e5d-be9db5567604)
            // 4. له موظف محدد أنشأه
            // 5. يجب أن يكون للطلب مستحقات موظف (employee_profit > 0)
            const isDelivered = order.status === 'delivered' || order.status === 'completed';
            const hasReceiptReceived = order.receipt_received === true;
            const isNotManagerOrder = order.created_by && order.created_by !== '91484496-b887-44f7-9e5d-be9db5567604';
            
            // حساب ربح الموظف للطلب
            const employeeProfit = (order.items || []).reduce((sum, item) => {
                const profit = (item.price - (item.costPrice || 0)) * item.quantity * 0.1; // 10% للموظف افتراضياً
                return sum + profit;
            }, 0);
            
            return isDelivered && hasReceiptReceived && isNotManagerOrder && employeeProfit > 0;
        });
    }, [orders]);

    const employeesWithPendingDues = useMemo(() => {
        const employeeIds = new Set(pendingDuesOrders.map(o => o.created_by));
        return allUsers.filter(u => employeeIds.has(u.id));
    }, [pendingDuesOrders, allUsers]);

    const filteredOrders = useMemo(() => {
        const ordersWithProfit = pendingDuesOrders.map(o => ({
            ...o,
            employee_profit: (o.items || []).reduce((sum, item) => {
                const profit = (item.price - (item.costPrice || 0)) * item.quantity;
                return sum + profit;
            }, 0)
        }));

        if (selectedEmployee === 'all') {
            return ordersWithProfit;
        }
        return ordersWithProfit.filter(o => o.created_by === selectedEmployee);
    }, [pendingDuesOrders, selectedEmployee]);

    const totalPendingAmount = useMemo(() => {
        return filteredOrders.reduce((sum, order) => sum + (order.employee_profit || 0), 0);
    }, [filteredOrders]);

    const handleNavigate = (path) => {
        navigate(path);
        onOpenChange(false);
    };

    const handleSelectOrder = (orderId) => {
        setSelectedOrders(prev =>
            prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
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
        navigate(`/profit-settlement/${selectedEmployee}?orders=${selectedOrders.join(',')}`);
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
                                {filteredOrders.length > 0 ? filteredOrders.map(order => {
                                    const employee = allUsers.find(u => u.id === order.created_by);
                                    return (
                                        <TableRow key={order.id}>
                                            <TableCell>
                                                <Checkbox
                                                    checked={selectedOrders.includes(order.id)}
                                                    onCheckedChange={() => handleSelectOrder(order.id)}
                                                    disabled={selectedEmployee === 'all' || order.created_by !== selectedEmployee}
                                                />
                                            </TableCell>
                                            <TableCell>{employee?.full_name || 'غير معروف'}</TableCell>
                                            <TableCell className="font-mono">{order.trackingnumber}</TableCell>
                                            <TableCell>{format(parseISO(order.updated_at), 'd MMM yyyy', { locale: ar })}</TableCell>
                                            <TableCell className="text-right font-semibold text-amber-500">{(order.employee_profit || 0).toLocaleString()} د.ع</TableCell>
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