import React, { useState, useMemo, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useCashSources } from '@/hooks/useCashSources';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Edit, BarChart, TrendingUp, TrendingDown, Wallet, Box, User, Users, Banknote, Coins as HandCoins, Hourglass, CheckCircle, PieChart } from 'lucide-react';
import { format, parseISO, isValid, startOfMonth, endOfMonth, startOfWeek, startOfYear, subDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from '@/components/ui/use-toast';
import { PDFDownloadLink } from '@react-pdf/renderer';
import StatCard from '@/components/dashboard/StatCard';
import MiniChart from '@/components/dashboard/MiniChart';
import FinancialReportPDF from '@/components/pdf/FinancialReportPDF';
import { useNavigate } from 'react-router-dom';
import ExpensesDialog from '@/components/accounting/ExpensesDialog';
import SettledDuesDialog from '@/components/accounting/SettledDuesDialog';
import PendingDuesDialog from '@/components/accounting/PendingDuesDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ProfitLossDialog from '@/components/accounting/ProfitLossDialog';
import CapitalDetailsDialog from '@/components/accounting/CapitalDetailsDialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('ar-IQ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0) + ' د.ع';
};

const StatRow = ({ label, value, colorClass, isNegative = false, onClick }) => {
    const safeValue = value ?? 0;
    return (
        <div className={`flex justify-between items-center py-3 border-b border-border/50 ${onClick ? 'cursor-pointer hover:bg-secondary/50 -mx-4 px-4' : ''}`} onClick={onClick}>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={`font-semibold text-base ${colorClass}`}>
                {isNegative ? `(${safeValue.toLocaleString()})` : safeValue.toLocaleString()} د.ع
            </p>
        </div>
    );
};

const EditCapitalDialog = ({ open, onOpenChange, currentCapital, onSave }) => {
    const [newCapital, setNewCapital] = useState(currentCapital);

    useEffect(() => {
        setNewCapital(currentCapital);
    }, [currentCapital, open]);

    const handleSave = async () => {
        const capitalValue = parseFloat(newCapital);
        if (isNaN(capitalValue)) {
            toast({ title: "خطأ", description: "الرجاء إدخال مبلغ صحيح.", variant: "destructive" });
            return;
        }
        
        try {
            // تحديث رأس المال في قاعدة البيانات
            const { error } = await supabase
                .from('settings')
                .update({ 
                    value: capitalValue,
                    updated_at: new Date().toISOString()
                })
                .eq('key', 'initial_capital');

            if (error) throw error;

            onSave(capitalValue);
            
            toast({
                title: "تم التحديث",
                description: "تم تحديث رأس المال بنجاح",
            });
        } catch (error) {
            console.error('خطأ في تحديث رأس المال:', error);
            toast({
                title: "خطأ",
                description: "فشل في تحديث رأس المال",
                variant: "destructive",
            });
        }
        
        onOpenChange(false);
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>تعديل رأس المال</AlertDialogTitle>
                    <AlertDialogDescription>
                        أدخل القيمة الجديدة لرأس المال. سيؤثر هذا على حسابات "المبلغ في القاصة".
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-4">
                    <Label htmlFor="capital-input">رأس المال (د.ع)</Label>
                    <Input
                        id="capital-input"
                        type="number"
                        value={newCapital}
                        onChange={(e) => setNewCapital(e.target.value)}
                        placeholder="أدخل رأس المال"
                    />
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSave}>حفظ التغييرات</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};

const AccountingPage = () => {
    const { orders, purchases, accounting, products, addExpense, deleteExpense, updateCapital, settlementInvoices, calculateManagerProfit, calculateProfit } = useInventory();
    const { user: currentUser, allUsers } = useAuth();
    const { hasPermission } = usePermissions();
    const { getTotalSourcesBalance, getMainCashBalance, getTotalAllSourcesBalance, cashSources } = useCashSources();
    const navigate = useNavigate();
    
    const [datePeriod, setDatePeriod] = useState('month');
    const [dialogs, setDialogs] = useState({ expenses: false, capital: false, settledDues: false, pendingDues: false, profitLoss: false, capitalDetails: false });
    const [realCashBalance, setRealCashBalance] = useState(0);
    const [initialCapital, setInitialCapital] = useState(0);

    const dateRange = useMemo(() => {
        const now = new Date();
        switch (datePeriod) {
            case 'today': return { from: subDays(now, 1), to: now };
            case 'week': return { from: startOfWeek(now, { weekStartsOn: 1 }), to: now };
            case 'year': return { from: startOfYear(now), to: now };
            case 'month':
            default:
                return { from: startOfMonth(now), to: endOfMonth(now) };
        }
    }, [datePeriod]);

    // دالة لإعادة تحميل جميع البيانات المالية
    const refreshFinancialData = async () => {
        try {
            // جلب رأس المال المحدث
            const { data: capitalData, error: capitalError } = await supabase
                .from('settings')
                .select('value')
                .eq('key', 'initial_capital')
                .single();

            if (capitalError) throw capitalError;
            
            const capitalValue = Number(capitalData?.value) || 0;
            setInitialCapital(capitalValue);
            
            console.log('💰 تم تحديث رأس المال:', capitalValue);

            // إعادة حساب الرصيد النقدي الفعلي
            const totalRealBalance = getTotalSourcesBalance();
            setRealCashBalance(totalRealBalance);
            
            console.log('💰 تم تحديث الرصيد النقدي الفعلي:', totalRealBalance);
            
        } catch (error) {
            console.error('❌ خطأ في تحديث البيانات المالية:', error);
        }
    };

    // جلب رأس المال الحقيقي من قاعدة البيانات
    useEffect(() => {
        refreshFinancialData();
    }, []);

    // جلب الرصيد النقدي الفعلي (مجموع جميع المصادر الحقيقية)
    useEffect(() => {
        const fetchRealBalance = async () => {
            try {
                // حساب الرصيد الفعلي لجميع المصادر النشطة
                const { data: cashSourcesData, error } = await supabase
                    .from('cash_sources')
                    .select('current_balance')
                    .eq('is_active', true);
                
                if (error) throw error;
                
                const totalRealBalance = cashSourcesData?.reduce((sum, source) => 
                    sum + Number(source.current_balance || 0), 0) || 0;
                
                console.log('💰 الرصيد النقدي الفعلي (من قاعدة البيانات):', totalRealBalance);
                
                setRealCashBalance(totalRealBalance);
            } catch (error) {
                console.error('❌ خطأ في حساب الرصيد النقدي الفعلي:', error);
                // fallback إلى طريقة أخرى في حالة الخطأ
                const fallbackBalance = getTotalSourcesBalance() || 0;
                setRealCashBalance(fallbackBalance);
            }
        };
        
        fetchRealBalance();
    }, [getTotalSourcesBalance, initialCapital]); // إضافة initialCapital كـ dependency

    const financialSummary = useMemo(() => {
        const { from, to } = dateRange;
        
        // تحقق من وجود البيانات الأساسية
        if (!orders || !Array.isArray(orders)) {
            console.warn('⚠️ لا توجد بيانات طلبات، orders:', orders);
            return {
                totalRevenue: 0, cogs: 0, grossProfit: 0, totalExpenses: 0, netProfit: 0,
                inventoryValue: 0, myProfit: 0, managerProfitFromEmployees: 0, 
                employeePendingDues: 0, employeeSettledDues: 0, chartData: [], 
                filteredExpenses: [], deliveredOrders: [], employeePendingDuesDetails: []
            };
        }
        
        const safeOrders = Array.isArray(orders) ? orders : [];
        const safeExpenses = Array.isArray(accounting?.expenses) ? accounting.expenses : [];
        
        console.log('🔥 === تشخيص البيانات المالية ===');
        console.log('📊 إجمالي الطلبات:', safeOrders.length);
        console.log('📊 حالة البيانات:', { 
            orders: !!orders, 
            ordersLength: orders?.length,
            accounting: !!accounting,
            expensesLength: accounting?.expenses?.length,
            capital: accounting?.capital
        });
        console.log('📊 الطلبات مع البيانات:', safeOrders.slice(0, 2));
        
        const filterByDate = (itemDateStr) => {
            if (!from || !to || !itemDateStr) return true;
            try {
                const itemDate = parseISO(itemDateStr);
                return isValid(itemDate) && itemDate >= from && itemDate <= to;
            } catch (e) {
                return false;
            }
        };
        
        // استخدام نفس منطق لوحة التحكم: الطلبات المُستلمة الفواتير فقط
        const deliveredOrders = safeOrders.filter(o => 
            o && o.status === 'delivered' && 
            o.receipt_received === true && 
            filterByDate(o.updated_at || o.created_at)
        );
        console.log('✅ الطلبات المُوصلة والمُستلمة الفواتير:', deliveredOrders.length);
        console.log('✅ أمثلة الطلبات المُستلمة:', deliveredOrders.slice(0, 2));
        
        const expensesInRange = safeExpenses.filter(e => filterByDate(e.transaction_date));
        
        // حساب إجمالي الإيرادات من الطلبات المُوصلة
        const totalRevenue = deliveredOrders.reduce((sum, o) => {
            const amount = o.final_amount || o.total_amount || 0;
            console.log(`💰 طلب ${o.order_number}: ${amount}`);
            return sum + amount;
        }, 0);
        
        const deliveryFees = deliveredOrders.reduce((sum, o) => sum + (o.delivery_fee || 0), 0);
        const salesWithoutDelivery = totalRevenue - deliveryFees;
        
        // حساب تكلفة البضاعة المباعة
        const cogs = deliveredOrders.reduce((sum, o) => {
            if (!o.order_items || !Array.isArray(o.order_items)) {
                console.warn(`⚠️ طلب ${o.order_number} لا يحتوي على عناصر`);
                return sum;
            }
            
            const orderCogs = o.order_items.reduce((itemSum, item) => {
                const costPrice = item.product_variants?.cost_price || item.products?.cost_price || 0;
                const quantity = item.quantity || 0;
                console.log(`📦 عنصر: تكلفة=${costPrice}, كمية=${quantity}, إجمالي=${costPrice * quantity}`);
                return itemSum + (costPrice * quantity);
            }, 0);
            console.log(`📊 تكلفة الطلب ${o.order_number}: ${orderCogs}`);
            return sum + orderCogs;
        }, 0);
        
        const grossProfit = salesWithoutDelivery - cogs;
        // حساب صافي ربح المبيعات (بدون طرح المصاريف العامة)
        const netSalesProfit = salesWithoutDelivery - cogs; // هذا هو صافي ربح المبيعات فقط
        
        // المصاريف العامة (للعرض منفصلة وليس لطرحها من صافي الربح)
        const generalExpenses = expensesInRange.filter(e => 
          e.expense_type !== 'system' && 
          e.category !== 'فئات_المصاريف' &&
          e.related_data?.category !== 'مستحقات الموظفين'
        ).reduce((sum, e) => sum + (e.amount || 0), 0);
        
        const totalExpenses = generalExpenses + employeeSettledDues;
        const netProfit = grossProfit - totalExpenses;
    
        
        // حساب قيمة المخزون
        const inventoryValue = Array.isArray(products) ? products.reduce((sum, p) => {
            if (!p.variants || !Array.isArray(p.variants)) return sum;
            return sum + p.variants.reduce((variantSum, v) => {
                const quantity = v.quantity || 0;
                const price = v.price || p.base_price || 0;
                return variantSum + (quantity * price);
            }, 0);
        }, 0) : 0;
        
        console.log('🏪 قيمة المخزون:', inventoryValue);
        
        // حساب مبيعات وأرباح المدير (المُستلمة الفواتير فقط)
        const managerOrders = deliveredOrders.filter(o => o.created_by === currentUser?.id);
        console.log('👨‍💼 طلبات المدير المُستلمة:', managerOrders.length);
        
        const managerSales = managerOrders.reduce((sum, o) => {
            const orderTotal = o.final_amount || o.total_amount || 0;
            const deliveryFee = o.delivery_fee || 0;
            const salesAmount = orderTotal - deliveryFee;
            return sum + salesAmount;
        }, 0);
        
        // حساب أرباح المدير بشكل مبسط (سعر البيع - التكلفة)
        const myProfit = managerOrders.reduce((sum, o) => {
            if (!o.order_items || !Array.isArray(o.order_items)) return sum;
            
            const orderProfit = o.order_items.reduce((itemSum, item) => {
                const sellPrice = item.unit_price || 0;
                const costPrice = item.product_variants?.cost_price || item.products?.cost_price || 0;
                const quantity = item.quantity || 0;
                const itemProfit = (sellPrice - costPrice) * quantity;
                return itemSum + Math.max(itemProfit, 0);
            }, 0);
            return sum + orderProfit;
        }, 0);

        // حساب مبيعات وأرباح الموظفين (المُستلمة الفواتير فقط)
        const employeeOrders = deliveredOrders.filter(o => {
            const orderUser = allUsers?.find(u => u.id === o.created_by);
            return orderUser && (orderUser.role === 'employee' || orderUser.role === 'deputy') && o.created_by !== currentUser?.id;
        });
        
        const employeeSales = employeeOrders.reduce((sum, o) => {
            const orderTotal = o.final_amount || o.total_amount || 0;
            const deliveryFee = o.delivery_fee || 0;
            return sum + (orderTotal - deliveryFee);
        }, 0);
        
        // حساب أرباح المدير من الموظفين (نسبة من أرباحهم)
        const managerProfitFromEmployees = employeeOrders.reduce((sum, o) => {
            if (!o.order_items || !Array.isArray(o.order_items)) return sum;
            
            const orderTotalProfit = o.order_items.reduce((itemSum, item) => {
                const sellPrice = item.unit_price || 0;
                const costPrice = item.product_variants?.cost_price || item.products?.cost_price || 0;
                const quantity = item.quantity || 0;
                return itemSum + Math.max((sellPrice - costPrice) * quantity, 0);
            }, 0);
            
            // افتراض أن المدير يحصل على 30% من أرباح الموظفين
            return sum + (orderTotalProfit * 0.3);
        }, 0);
        
        const totalProfit = myProfit + managerProfitFromEmployees;
    
        const employeePendingDuesDetails = safeOrders
          .filter(o => o.status === 'delivered' && (o.profitStatus || 'pending') === 'pending' && o.created_by !== currentUser?.id);
        
        const employeePendingDues = employeePendingDuesDetails.reduce((sum, o) => sum + ((o.items || []).reduce((itemSum, item) => itemSum + calculateProfit(item, o.created_by), 0) || 0), 0);
    
        // حساب رصيد القاصة الحقيقي = رأس المال + صافي الأرباح
        const cashOnHand = realCashBalance || ((accounting?.capital || 0) + netProfit);
    
        const salesByDay = {};
        deliveredOrders.forEach(o => {
            const dateStr = o.updated_at || o.created_at;
            if (dateStr) {
                try {
                    const day = format(parseISO(dateStr), 'dd');
                    if (!salesByDay[day]) salesByDay[day] = 0;
                    // استخدام final_amount للمبيعات اليومية
                    salesByDay[day] += o.final_amount || o.total_amount || 0;
                } catch (error) {
                    console.warn('⚠️ خطأ في تحليل تاريخ الطلب:', dateStr, error);
                }
            }
        });
        
        const expensesByDay = {};
        expensesInRange.forEach(e => {
            if (e.transaction_date) {
                try {
                    const day = format(parseISO(e.transaction_date), 'dd');
                    if (!expensesByDay[day]) expensesByDay[day] = 0;
                    expensesByDay[day] += e.amount;
                } catch (error) {
                    console.warn('⚠️ خطأ في تحليل تاريخ المصروف:', e.transaction_date, error);
                }
            }
        });
    
        const allDays = [...new Set([...Object.keys(salesByDay), ...Object.keys(expensesByDay)])].sort();
        
        const chartData = allDays.map(day => ({
            name: day,
            sales: salesByDay[day] || 0,
            expenses: expensesByDay[day] || 0,
            net: (salesByDay[day] || 0) - (expensesByDay[day] || 0)
        }));
    
        return { totalRevenue, deliveryFees, salesWithoutDelivery, cogs, grossProfit, totalExpenses, netProfit, totalProfit, inventoryValue, myProfit, managerProfitFromEmployees, managerSales, employeeSales, employeePendingDues, employeeSettledDues, cashOnHand, chartData, filteredExpenses: expensesInRange, generalExpenses, deliveredOrders, employeePendingDuesDetails };
    }, [dateRange, orders, purchases, accounting, products, currentUser?.id, allUsers, calculateManagerProfit, calculateProfit]);

    const totalCapital = initialCapital + financialSummary.inventoryValue;
    
    const topRowCards = [
        { 
            key: 'capital', 
            title: "رأس المال الكلي", 
            value: totalCapital, 
            icon: Banknote, 
            colors: ['slate-500', 'gray-600'], 
            format: "currency", 
            onClick: () => setDialogs(d => ({ ...d, capitalDetails: true }))
        },
        { key: 'cash', title: "الرصيد النقدي الفعلي", value: realCashBalance, icon: Wallet, colors: ['sky-500', 'blue-500'], format: "currency", onClick: () => navigate('/cash-management') },
        { key: 'inventory', title: "قيمة المخزون", value: financialSummary.inventoryValue, icon: Box, colors: ['emerald-500', 'green-500'], format: "currency", onClick: () => navigate('/inventory') },
    ];
    
    const profitCards = [
        { key: 'myProfit', title: "أرباحي", value: financialSummary.myProfit, icon: User, colors: ['rose-500', 'red-500'], format: 'currency', onClick: () => navigate('/profits-summary') },
        { key: 'employeeProfit', title: "أرباح من الموظفين", value: financialSummary.managerProfitFromEmployees, icon: Users, colors: ['fuchsia-500', 'purple-500'], format: 'currency', onClick: () => navigate('/employee-follow-up') },
        { key: 'generalExpenses', title: "المصاريف العامة", value: financialSummary.generalExpenses, icon: TrendingDown, colors:['red-500', 'orange-500'], format:'currency', onClick: () => setDialogs(d => ({...d, expenses: true}))},
    ];

    return (
        <>
            <Helmet>
                <title>المركز المالي - نظام RYUS</title>
                <meta name="description" content="نظرة شاملة على الوضع المالي للمتجر." />
            </Helmet>
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <h1 className="text-3xl font-bold gradient-text">المركز المالي</h1>
                    <div className="flex gap-2 flex-wrap">
                        <PDFDownloadLink
                            document={<FinancialReportPDF summary={financialSummary} dateRange={dateRange} />}
                            fileName={`financial-report-${new Date().toISOString().slice(0, 10)}.pdf`}
                        >
                            {({ loading: pdfLoading }) => (
                                <Button variant="outline" disabled={pdfLoading}>
                                    <FileText className="w-4 h-4 ml-2" />
                                    {pdfLoading ? 'جاري التجهيز...' : 'تصدير تقرير'}
                                </Button>
                            )}
                        </PDFDownloadLink>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {topRowCards.map((card, index) => (
                        <StatCard key={index} {...card} />
                    ))}
                </div>
                
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {profitCards.map((card, index) => (
                        <StatCard key={index} {...card} />
                    ))}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <StatCard 
                        title="صافي أرباح المبيعات" 
                        value={financialSummary.grossProfit} 
                        icon={PieChart} 
                        colors={['blue-500', 'sky-500']} 
                        format="currency" 
                        onClick={() => setDialogs(d => ({...d, profitLoss: true}))}
                    />
                     <Card className="h-full">
                        <CardHeader>
                            <CardTitle>مستحقات الموظفين</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col justify-center gap-4">
                            <Button variant="outline" className="w-full" onClick={() => setDialogs(d => ({...d, settledDues: true}))}>
                                <CheckCircle className="w-4 h-4 ml-2 text-green-500"/>
                                <span>المستحقات المدفوعة:</span>
                                <span className="font-bold mr-2">{(financialSummary.employeeSettledDues || 0).toLocaleString()} د.ع</span>
                            </Button>
                            <Button variant="outline" className="w-full" onClick={() => setDialogs(d => ({...d, pendingDues: true}))}>
                                <Hourglass className="w-4 h-4 ml-2 text-amber-500"/>
                                <span>المستحقات المعلقة:</span>
                                <span className="font-bold mr-2">{(financialSummary.employeePendingDues || 0).toLocaleString()} د.ع</span>
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><BarChart/> ملخص الأداء المالي</CardTitle>
                                <CardDescription>نظرة بيانية على الإيرادات، المصاريف، والأرباح الصافية</CardDescription>
                            </CardHeader>
                            <CardContent className="h-72">
                                <MiniChart data={financialSummary.chartData} type="bar" colors={['#3b82f6', '#ef4444']} />
                            </CardContent>
                        </Card>
                    </div>
                    <div className="lg:col-span-1">
                        <Card>
                            <CardHeader>
                                <CardTitle>تقرير الأرباح والخسائر</CardTitle>
                                <CardDescription>ملخص مالي للفترة المحددة</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <StatRow label="إجمالي المبيعات (مع التوصيل)" value={financialSummary.totalRevenue || 0} colorClass="text-green-500" />
                                <StatRow label="رسوم التوصيل" value={financialSummary.deliveryFees || 0} colorClass="text-blue-400" />
                                <StatRow label="المبيعات (بدون التوصيل)" value={financialSummary.salesWithoutDelivery || 0} colorClass="text-green-600" />
                                <StatRow label="تكلفة البضاعة المباعة" value={financialSummary.cogs || 0} colorClass="text-orange-500" isNegative/>
                                <StatRow label="مجمل الربح" value={financialSummary.grossProfit || 0} colorClass="text-blue-500 font-bold" />
                                <StatRow label="إجمالي المصاريف" value={financialSummary.totalExpenses || 0} colorClass="text-red-500" isNegative/>
                                <div className="flex justify-between items-center py-3 mt-2 bg-secondary rounded-lg px-4">
                                    <p className="font-bold text-lg">صافي الربح</p>
                                    <p className="font-bold text-lg text-primary">{(financialSummary.netProfit || 0).toLocaleString()} د.ع</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
            <ExpensesDialog
                open={dialogs.expenses}
                onOpenChange={(open) => setDialogs(d => ({ ...d, expenses: open }))}
                expenses={accounting?.expenses || []}
                addExpense={addExpense}
                deleteExpense={deleteExpense}
            />
            <EditCapitalDialog
                open={dialogs.capital}
                onOpenChange={(open) => setDialogs(d => ({ ...d, capital: open }))}
                currentCapital={initialCapital}
                onSave={(newCapital) => setInitialCapital(newCapital)}
            />
            <SettledDuesDialog
                open={dialogs.settledDues}
                onOpenChange={(open) => setDialogs(d => ({...d, settledDues: open}))}
                invoices={settlementInvoices}
                allUsers={allUsers}
            />
            <PendingDuesDialog
                open={dialogs.pendingDues}
                onOpenChange={(open) => setDialogs(d => ({...d, pendingDues: open}))}
                orders={financialSummary.employeePendingDuesDetails}
                allUsers={allUsers}
            />
            <ProfitLossDialog
                open={dialogs.profitLoss}
                onOpenChange={(open) => setDialogs(d => ({ ...d, profitLoss: open }))}
                summary={financialSummary}
                datePeriod={datePeriod}
                onDatePeriodChange={setDatePeriod}
            />
            <CapitalDetailsDialog
                open={dialogs.capitalDetails}
                onOpenChange={(open) => setDialogs(d => ({ ...d, capitalDetails: open }))}
                initialCapital={initialCapital}
                inventoryValue={financialSummary.inventoryValue}
                cashBalance={realCashBalance}
                onCapitalUpdate={async (newCapital) => {
                    // تحديث فوري محلي
                    setInitialCapital(newCapital);
                    // تحديث شامل لجميع البيانات المترابطة
                    await refreshFinancialData();
                }}
            />
        </>
    );
};

export default AccountingPage;