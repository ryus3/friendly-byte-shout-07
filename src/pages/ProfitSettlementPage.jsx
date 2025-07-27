import React, { useState, useMemo, useEffect } from 'react';
    import { Helmet } from 'react-helmet-async';
    import { useParams, useNavigate, useLocation } from 'react-router-dom';
    import { useInventory } from '@/contexts/InventoryContext';
    import { useAuth } from '@/contexts/UnifiedAuthContext';
    import { Button } from '@/components/ui/button';
    import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
    import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
    import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
    import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from '@/components/ui/table';
    import { Checkbox } from '@/components/ui/checkbox';
    import { Loader2, ArrowRight, DollarSign, User, AlertCircle } from 'lucide-react';
    import { toast } from '@/components/ui/use-toast';
    import { format, parseISO, isValid } from 'date-fns';
    import { ar } from 'date-fns/locale';
    
    function useQuery() {
        return new URLSearchParams(useLocation().search);
    }
    
    const ProfitSettlementPage = () => {
        const { employeeId } = useParams();
        const navigate = useNavigate();
        const query = useQuery();
        const { orders, loading, settleEmployeeProfits, calculateProfit } = useInventory();
        const { allUsers } = useAuth();
        const [selectedOrderIds, setSelectedOrderIds] = useState([]);
        const [isSettling, setIsSettling] = useState(false);
    
    const employee = useMemo(() => allUsers.find(u => u.user_id === employeeId || u.id === employeeId), [allUsers, employeeId]);
    
    const requestedOrderIds = useMemo(() => {
        const orderIdsParam = query.get('orders');
        return orderIdsParam ? orderIdsParam.split(',') : null;
    }, [query]);
    
    const unsettledOrders = useMemo(() => {
        if (!orders || !employeeId) return [];
        let filteredOrders = orders
            .filter(o => 
                (o.created_by === employeeId) && 
                (o.status === 'delivered' || o.status === 'completed') && 
                o.receipt_received === true &&
                (o.profitStatus || 'pending') === 'pending'
            );
        
        if (requestedOrderIds) {
            filteredOrders = filteredOrders.filter(o => requestedOrderIds.includes(o.id));
        }

        return filteredOrders.map(o => ({
            ...o, 
            employee_profit: (o.items || []).reduce((sum, item) => sum + calculateProfit(item, o.created_by), 0)
        }));
    }, [orders, employeeId, calculateProfit, requestedOrderIds]);
    
        const totalUnsettledProfit = useMemo(() => {
            return unsettledOrders
                .filter(o => selectedOrderIds.includes(o.id))
                .reduce((sum, o) => sum + (o.employee_profit || 0), 0);
        }, [unsettledOrders, selectedOrderIds]);
    
        useEffect(() => {
            // Select all by default
            setSelectedOrderIds(unsettledOrders.map(o => o.id));
        }, [unsettledOrders]);
    
        const handleSelectOrder = (orderId) => {
            setSelectedOrderIds(prev =>
                prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
            );
        };
    
        const handleSelectAll = (checked) => {
            if (checked) {
                setSelectedOrderIds(unsettledOrders.map(o => o.id));
            } else {
                setSelectedOrderIds([]);
            }
        };
        
        const handleSettleProfits = async () => {
            if (selectedOrderIds.length === 0 || totalUnsettledProfit <= 0) {
                toast({ title: 'خطأ', description: 'الرجاء تحديد طلبات لتسويتها.', variant: 'destructive' });
                return;
            }
            setIsSettling(true);
            await settleEmployeeProfits(employeeId, totalUnsettledProfit, employee.full_name, selectedOrderIds);
            setIsSettling(false);
            navigate('/profits-summary');
        };
    
        if (loading) return <div className="flex justify-center items-center h-full"><Loader2 className="w-8 h-8 animate-spin" /></div>;
        if (!employee) return <div className="text-center text-red-500">لم يتم العثور على الموظف.</div>;
    
        return (
            <>
                <Helmet>
                    <title>محاسبة {employee.full_name} - نظام RYUS</title>
                </Helmet>
                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold gradient-text">محاسبة الموظف</h1>
                            <p className="text-muted-foreground flex items-center gap-2 mt-1">
                                <User className="w-4 h-4" /> {employee.full_name}
                            </p>
                        </div>
                         <Button variant="outline" onClick={() => navigate(-1)}>
                            <ArrowRight className="h-4 w-4 ml-2" />
                            رجوع
                        </Button>
                    </div>
    
                    <Card>
                        <CardHeader>
                            <CardTitle>ملخص المستحقات</CardTitle>
                            <CardDescription>المبلغ الإجمالي للأرباح المحددة والجاهزة للتسوية.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-secondary rounded-lg">
                            <div className="flex items-center gap-3">
                               <div className="p-3 bg-green-500/10 rounded-full">
                                 <DollarSign className="w-8 h-8 text-green-500" />
                               </div>
                               <div>
                                <p className="text-sm text-muted-foreground">المبلغ المستحق</p>
                                <p className="text-3xl font-bold text-green-500">
                                    {totalUnsettledProfit.toLocaleString()} د.ع
                                </p>
                               </div>
                            </div>
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button size="lg" disabled={isSettling || selectedOrderIds.length === 0}>
                                        {isSettling ? <Loader2 className="w-5 h-5 animate-spin ml-2" /> : <DollarSign className="w-5 h-5 ml-2" />}
                                        تسوية الأرباح المحددة
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>تأكيد تسوية الأرباح</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            هل أنت متأكد من أنك تريد تسوية أرباح {employee.full_name} بمبلغ {totalUnsettledProfit.toLocaleString()} د.ع؟ سيتم تسجيل هذا كمصروف وأرشفة الطلبات المحددة.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleSettleProfits}>تأكيد التسوية</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader>
                            <CardTitle>الطلبات المستحقة</CardTitle>
                            <CardDescription>
                                {requestedOrderIds 
                                    ? "قائمة بالطلبات التي طلب الموظف المحاسبة عليها."
                                    : "قائمة بكل الطلبات التي تم تسليمها ولم تتم تسوية أرباحها."
                                }
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {unsettledOrders.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>
                                            <Checkbox
                                                checked={selectedOrderIds.length === unsettledOrders.length && unsettledOrders.length > 0}
                                                onCheckedChange={handleSelectAll}
                                            />
                                        </TableHead>
                                        <TableHead>رقم الطلب</TableHead>
                                        <TableHead>الزبون</TableHead>
                                        <TableHead>تاريخ التسليم</TableHead>
                                        <TableHead className="text-right">ربح الموظف</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {unsettledOrders.map(order => (
                                        <TableRow key={order.id} data-state={selectedOrderIds.includes(order.id) && "selected"}>
                                            <TableCell>
                                                <Checkbox
                                                    checked={selectedOrderIds.includes(order.id)}
                                                    onCheckedChange={() => handleSelectOrder(order.id)}
                                                />
                                            </TableCell>
                                            <TableCell className="font-medium">{order.order_number || 'لا يوجد رقم'}</TableCell>
                                            <TableCell>{order.customer_name || 'غير معروف'}</TableCell>
                                            <TableCell>
                                                {order.created_at ? format(parseISO(order.created_at), 'd MMMM yyyy', { locale: ar }) : 'غير محدد'}
                                            </TableCell>
                                            <TableCell className="text-right font-semibold text-primary">{order.employee_profit.toLocaleString()} د.ع</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            ) : (
                                 <Alert>
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle>لا توجد أرباح معلقة</AlertTitle>
                                    <AlertDescription>
                                        هذا الموظف ليس لديه أي أرباح معلقة لتسويتها في الوقت الحالي.
                                    </AlertDescription>
                                </Alert>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </>
        );
    };
    
    export default ProfitSettlementPage;