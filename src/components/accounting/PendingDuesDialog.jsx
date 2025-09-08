import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { AlertTriangle, User, DollarSign, UserCheck, Calendar, Package, TrendingUp, CheckSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { isPendingStatus } from '@/utils/profitStatusHelper';
import { cn } from '@/lib/utils';

const PendingDuesDialog = ({ open, onOpenChange, orders, allUsers, allProfits = [] }) => {
    const navigate = useNavigate();
    const [selectedEmployee, setSelectedEmployee] = useState('all');
    const [selectedOrders, setSelectedOrders] = useState([]);

    // استخدام بيانات جدول profits بدلاً من الحساب اليدوي
    const pendingProfitsData = useMemo(() => {
        if (!allProfits || !orders) return [];
        
        return allProfits.filter(profit => {
            // استخدام دالة موحدة لفحص الحالات المعلقة
            if (!isPendingStatus(profit.status)) return false;
            
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
        
        // إذا كان "كل الموظفين" محدد، نحتاج لتحديد موظف واحد
        if (selectedEmployee === 'all') {
            // فحص الطلبات المحددة للتأكد من أنها لموظف واحد
            const selectedProfits = filteredData.filter(p => selectedOrders.includes(p.id));
            const uniqueEmployees = new Set(selectedProfits.map(p => p.employee_id));
            
            if (uniqueEmployees.size > 1) {
                toast({ 
                    title: "خطأ", 
                    description: "يجب تحديد طلبات لموظف واحد فقط أو اختيار موظف محدد من الفلتر.", 
                    variant: "destructive" 
                });
                return;
            }
            
            const employeeId = Array.from(uniqueEmployees)[0];
            navigate(`/employee-follow-up?employee=${employeeId}&orders=${selectedOrders.join(',')}&highlight=settlement`);
        } else {
            navigate(`/employee-follow-up?employee=${selectedEmployee}&orders=${selectedOrders.join(',')}&highlight=settlement`);
        }
        
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
                <div className="flex-grow space-y-6 py-4 overflow-y-auto">
                    {/* لوحة التحكم والإحصائيات */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2">
                            <Card className="border-l-4 border-l-primary">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <User className="w-5 h-5 text-primary" />
                                        تصفية حسب الموظف
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                                        <SelectTrigger className="h-11">
                                            <SelectValue placeholder="اختر موظف" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">
                                                <div className="flex items-center gap-2">
                                                    <User className="w-4 h-4" />
                                                    كل الموظفين
                                                </div>
                                            </SelectItem>
                                            {employeesWithPendingDues.map(emp => (
                                                <SelectItem key={emp.id} value={emp.id}>
                                                    <div className="flex items-center gap-2">
                                                        <User className="w-4 h-4" />
                                                        {emp.full_name}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </CardContent>
                            </Card>
                        </div>
                        
                        <Card className="border-l-4 border-l-amber-500 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/50 dark:to-amber-900/50">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm text-amber-700 dark:text-amber-300">الإجمالي المعلق</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="w-6 h-6 text-amber-600" />
                                    <span className="text-2xl font-bold text-amber-600">{totalPendingAmount.toLocaleString()}</span>
                                    <span className="text-sm text-amber-600">د.ع</span>
                                </div>
                                <p className="text-xs text-amber-600/80 mt-1">
                                    {filteredData.length} طلب معلق
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* إحصائيات التحديد */}
                    {selectedOrders.length > 0 && (
                        <Card className="border-l-4 border-l-green-500 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-900/50 animate-fade-in">
                            <CardContent className="py-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <CheckSquare className="w-5 h-5 text-green-600" />
                                        <span className="font-medium text-green-700 dark:text-green-300">
                                            تم تحديد {selectedOrders.length} طلب
                                        </span>
                                    </div>
                                    <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                                        {filteredData.filter(p => selectedOrders.includes(p.id)).reduce((sum, p) => sum + (p.employee_profit || 0), 0).toLocaleString()} د.ع
                                    </Badge>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* قائمة الطلبات */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2">
                            <Package className="w-5 h-5 text-primary" />
                            <h3 className="font-semibold text-lg">الطلبات المعلقة</h3>
                            <Badge variant="secondary">{filteredData.length}</Badge>
                        </div>
                        
                        <ScrollArea className="h-96">
                            <div className="space-y-3 p-1">
                                {filteredData.length > 0 ? filteredData.map(profit => {
                                    const employee = allUsers.find(u => u.id === profit.employee_id) || profit.employee;
                                    const order = profit.order;
                                    const isSelected = selectedOrders.includes(profit.id);
                                    
                                    return (
                                        <Card 
                                            key={profit.id} 
                                            className={cn(
                                                "transition-all duration-200 cursor-pointer hover:shadow-md border-l-4",
                                                isSelected ? "ring-2 ring-primary shadow-md border-l-primary bg-primary/5" : "border-l-muted hover:border-l-primary/50",
                                                "hover:scale-[1.01] active:scale-[0.99]"
                                            )}
                                            onClick={() => handleSelectOrder(profit.id)}
                                        >
                                            <CardContent className="p-3">
                                                <div className="flex items-center gap-3">
                                                    {/* Checkbox على اليسار */}
                                                    <div className="flex-shrink-0">
                                                        <Checkbox
                                                            checked={isSelected}
                                                            onCheckedChange={() => handleSelectOrder(profit.id)}
                                                            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                                        />
                                                    </div>
                                                    
                                                    {/* محتوى الكارت المضغوط */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between">
                                                            {/* اسم الموظف والحالة */}
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                                                    {(employee?.full_name || 'غ')[0]}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="font-medium text-sm truncate">{employee?.full_name || 'غير معروف'}</p>
                                                                    <Badge variant="outline" className="text-xs h-5 px-1.5">
                                                                        {profit.status === 'invoice_received' ? 'مستلم الفاتورة' : 'معلق'}
                                                                    </Badge>
                                                                </div>
                                                            </div>
                                                            
                                                            {/* المبلغ */}
                                                            <div className="text-left flex-shrink-0">
                                                                <div className="flex items-center gap-1">
                                                                    <span className="text-lg font-bold text-primary">
                                                                        {(profit.employee_profit || 0).toLocaleString()}
                                                                    </span>
                                                                    <span className="text-xs text-muted-foreground">د.ع</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* تفاصيل الطلب */}
                                                        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                                                            <div className="flex items-center gap-3">
                                                                {/* رقم الطلب + رقم التتبع */}
                                                                <div className="flex items-center gap-1">
                                                                    <Package className="w-3 h-3" />
                                                                    <span className="font-mono">#{order?.order_number || 'غير معروف'}</span>
                                                                    {order?.tracking_number && (
                                                                        <span className="text-muted-foreground/60">• {order.tracking_number}</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            
                                                            {/* تاريخ التسليم */}
                                                            <div className="flex items-center gap-1">
                                                                <Calendar className="w-3 h-3" />
                                                                <span>
                                                                    {order ? format(parseISO(order.updated_at), 'd/M/yyyy', { locale: ar }) : '-'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                }) : (
                                    <Card className="border-dashed">
                                        <CardContent className="flex flex-col items-center justify-center py-12">
                                            <AlertTriangle className="w-12 h-12 text-muted-foreground mb-4" />
                                            <h3 className="font-medium text-lg mb-2">لا توجد مستحقات معلقة</h3>
                                            <p className="text-muted-foreground text-center">
                                                جميع المستحقات تم تسويتها أو لا توجد أرباح معلقة حالياً.
                                            </p>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
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