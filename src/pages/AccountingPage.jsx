import React, { useState, useMemo, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useCashSources } from '@/hooks/useCashSources';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Edit, BarChart, TrendingUp, TrendingDown, Wallet, Box, User, Users, Banknote, Coins as HandCoins, Hourglass, CheckCircle, PieChart } from 'lucide-react';
import { format, parseISO, isValid, startOfMonth, endOfMonth, startOfWeek, startOfYear, subDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';
import { PDFDownloadLink } from '@react-pdf/renderer';
import StatCard from '@/components/dashboard/StatCard';
import MiniChart from '@/components/dashboard/MiniChart';
import FinancialReportPDF from '@/components/pdf/FinancialReportPDF';
import { useNavigate } from 'react-router-dom';
import ExpensesDialog from '@/components/accounting/ExpensesDialog';
import UnifiedSettledDuesDialog from '@/components/shared/UnifiedSettledDuesDialog';
import PendingDuesDialog from '@/components/accounting/PendingDuesDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ProfitLossDialog from '@/components/accounting/ProfitLossDialog';
import CapitalDetailsDialog from '@/components/accounting/CapitalDetailsDialog';
import InventoryValueDialog from '@/components/accounting/InventoryValueDialog';
import { useAdvancedProfitsAnalysis } from '@/hooks/useAdvancedProfitsAnalysis';
import { useUnifiedProfits } from '@/hooks/useUnifiedProfits';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import ManagerProfitsCard from '@/components/shared/ManagerProfitsCard';
import EnhancedFinancialSummary from '@/components/shared/EnhancedFinancialSummary';
import FinancialPerformanceCard from '@/components/shared/FinancialPerformanceCard';
import UnifiedFinancialDisplay from '@/components/financial/UnifiedFinancialDisplay';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('ar-IQ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0) + ' د.ع';
};

// دالة للحصول على ربح الموظف من جدول الأرباح الفعلي
const getEmployeeProfitFromOrder = (orderId, employeeId, allProfits) => {
  // يجب جلب هذه البيانات من جدول profits
  const orderProfits = allProfits?.find(p => p.order_id === orderId && p.employee_id === employeeId);
  return orderProfits?.employee_profit || 0;
};

const getSystemProfitFromOrder = (orderId, allProfits) => {
  // الحصول على ربح النظام من جدول profits
  const orderProfits = allProfits?.find(p => p.order_id === orderId);
  if (!orderProfits) return 0;
  return (orderProfits.profit_amount || 0) - (orderProfits.employee_profit || 0);
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
    
    // فلترة حسب الفترة المحددة - افتراضي "كل الفترات" 
    const [selectedTimePeriod, setSelectedTimePeriod] = useLocalStorage('accounting-time-period', 'all');
    const [dateRange, setDateRange] = useLocalStorage('accounting-date-range', {
        from: null,
        to: null
    });
    
    
    
    // تحليل أرباح المنتجات - مطابق لفترة المركز المالي
    const getDateRangeForPeriod = React.useCallback((period) => {
        const now = new Date();
        switch (period) {
            case 'today': return { from: subDays(now, 1), to: now };
            case 'week': return { from: startOfWeek(now, { weekStartsOn: 1 }), to: now };
            case 'month': return { from: startOfMonth(now), to: endOfMonth(now) };
            case 'year': return { from: startOfYear(now), to: now };
            case 'all':
            default:
                return { from: null, to: null };
        }
    }, []);
    const profitsDateRange = getDateRangeForPeriod(selectedTimePeriod);
    const profitsFilters = React.useMemo(() => ({
        period: selectedTimePeriod || 'all',
        department: 'all',
        category: 'all',
        product: 'all',
        color: 'all',
        size: 'all',
        season: 'all',
        productType: 'all'
    }), [selectedTimePeriod]);
    const { analysisData: profitsAnalysis } = useAdvancedProfitsAnalysis(profitsDateRange, profitsFilters);
    const { profitData: unifiedProfitData, loading: unifiedLoading } = useUnifiedProfits(selectedTimePeriod);
    
    // استخدام البيانات الموحدة لجميع الحسابات
    
    const [dialogs, setDialogs] = useState({ expenses: false, capital: false, settledDues: false, pendingDues: false, profitLoss: false, capitalDetails: false, inventoryDetails: false });
    const [allProfits, setAllProfits] = useState([]);
    const [realCashBalance, setRealCashBalance] = useState(0);
    const [initialCapital, setInitialCapital] = useState(0);

    const calculatedDateRange = useMemo(() => {
        const now = new Date();
        switch (selectedTimePeriod) {
            case 'today': return { from: subDays(now, 1), to: now };
            case 'week': return { from: startOfWeek(now, { weekStartsOn: 1 }), to: now };
            case 'year': return { from: startOfYear(now), to: now };
            case 'month': return { from: startOfMonth(now), to: endOfMonth(now) };
            case 'all': return { from: null, to: null };
            default:
                return { from: startOfMonth(now), to: endOfMonth(now) };
        }
    }, [selectedTimePeriod]);

    // دالة لإعادة تحميل جميع البيانات المالية
    const refreshAllFinancialData = async () => {
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

            const totalRealBalance = getTotalSourcesBalance();
            setRealCashBalance(totalRealBalance);
            
        } catch (error) {
            console.error('❌ خطأ في تحديث البيانات المالية:', error);
        }
    };

    // جلب رأس المال الحقيقي من قاعدة البيانات
    useEffect(() => {
        const fetchData = async () => {
            await refreshAllFinancialData();
            
            // جلب بيانات الأرباح
            try {
                const { data: profitsData } = await supabase
                    .from('profits')
                    .select(`
                        *,
                        order:orders(order_number, status, receipt_received),
                        employee:profiles!employee_id(full_name)
                    `);
                setAllProfits(profitsData || []);
            } catch (error) {
                console.error('خطأ في جلب بيانات الأرباح:', error);
            }
        };
        
        fetchData();
    }, []);

    // جلب الرصيد النقدي الفعلي (مجموع جميع المصادر الحقيقية)
    useEffect(() => {
        const fetchRealBalance = async () => {
            try {
                // استخدام نفس الطريقة المباشرة والموحدة
                const totalMainBalance = await getMainCashBalance();
                const otherSourcesBalance = getTotalSourcesBalance();
                const totalRealBalance = totalMainBalance + otherSourcesBalance;
                
                setRealCashBalance(totalRealBalance);
            } catch (error) {
                console.error('❌ خطأ في حساب الرصيد النقدي الفعلي:', error);
                setRealCashBalance(0);
            }
        };
        
        fetchRealBalance();
    }, [getMainCashBalance, getTotalSourcesBalance, initialCapital]); // إضافة getMainCashBalance كـ dependency

    // حساب قيمة المخزون والمصاريف المفلترة فقط - باقي البيانات من unifiedProfitData
    const inventoryValue = useMemo(() => {
        if (!products || !Array.isArray(products)) return 0;
        
        return products.reduce((sum, p) => {
            if (!p.variants || !Array.isArray(p.variants)) return sum;
            return sum + p.variants.reduce((variantSum, v) => {
                const quantity = v.quantity || 0;
                const price = v.price || p.base_price || 0;
                return variantSum + (quantity * price);
            }, 0);
        }, 0);
    }, [products]);

    // استخراج المصاريف العامة المفلترة لنافذة المصاريف
    const generalExpensesFiltered = useMemo(() => {
        if (!accounting?.expenses || !Array.isArray(accounting.expenses)) return [];
        
        const { from, to } = calculatedDateRange;
        
        const filterByDate = (itemDateStr) => {
            if (selectedTimePeriod === 'all') return true;
            if (!from || !to || !itemDateStr) return true;
            try {
                const itemDate = parseISO(itemDateStr);
                return isValid(itemDate) && itemDate >= from && itemDate <= to;
            } catch (e) {
                return false;
            }
        };
        
        return accounting.expenses.filter(expense => {
            if (!filterByDate(expense.transaction_date)) return false;
            if (expense.expense_type === 'system') return false;
            if (
                expense.category === 'مستحقات الموظفين' ||
                expense.related_data?.category === 'مستحقات الموظفين' ||
                expense.metadata?.category === 'مستحقات الموظفين'
            ) return false;
            if (
                expense.related_data?.category === 'شراء بضاعة' ||
                expense.metadata?.category === 'شراء بضاعة'
            ) return false;
            return true;
        });
    }, [accounting?.expenses, calculatedDateRange, selectedTimePeriod]);

    const totalCapital = initialCapital + inventoryValue;
    
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
        { key: 'inventory', title: "قيمة المخزون", value: inventoryValue, icon: Box, colors: ['purple-500', 'violet-600'], format: "currency", onClick: () => setDialogs(d => ({ ...d, inventoryDetails: true })) },
    ];
    
    const profitCards = [
        { 
          key: 'productProfit', 
          title: "تحليل أرباح المنتجات", 
          value: (() => {
            const totalProductsSold = profitsAnalysis?.totalProductsSold ?? profitsAnalysis?.filteredItemsCount ?? 0;
            return totalProductsSold > 0 ? `${totalProductsSold} منتجات` : 'لا توجد مبيعات';
          })(),
          icon: PieChart, 
          colors: ['violet-500', 'purple-500'], 
          format: 'text', 
          onClick: () => navigate('/advanced-profits-analysis') 
        },
        // تم استبدال هذا الكارت بـ ManagerProfitsCard الموحد
        { key: 'generalExpenses', title: "المصاريف العامة", value: unifiedProfitData?.generalExpenses || 0, icon: TrendingDown, colors:['red-500', 'orange-500'], format:'currency', onClick: () => setDialogs(d => ({...d, expenses: true}))},
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
                    <div className="flex gap-2 flex-wrap items-center">
                        <select 
                            className="px-3 py-2 border border-border rounded-md bg-background text-foreground"
                            value={selectedTimePeriod}
                            onChange={(e) => setSelectedTimePeriod(e.target.value)}
                        >
                            <option value="all">كل الفترات</option>
                            <option value="today">اليوم</option>
                            <option value="week">هذا الأسبوع</option>
                            <option value="month">هذا الشهر</option>
                            <option value="year">هذا العام</option>
                        </select>
                        <PDFDownloadLink
                            document={<FinancialReportPDF summary={unifiedProfitData} dateRange={calculatedDateRange} />}
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
                    {profitCards.filter(card => card.key !== 'employeeProfit').map((card, index) => (
                        <StatCard key={index} {...card} />
                    ))}
                    {/* كارت أرباحي من الموظفين الموحد */}
                    <ManagerProfitsCard 
                        orders={orders || []}
                        allUsers={allUsers || []}
                        calculateProfit={calculateProfit}
                        profits={allProfits || []}
                        timePeriod={selectedTimePeriod}
                    />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <StatCard 
                        title="صافي أرباح المبيعات" 
                        value={unifiedProfitData?.netProfit || 0} 
                        icon={PieChart} 
                        colors={['blue-500', 'sky-500']} 
                        format="currency" 
                        onClick={() => setDialogs(d => ({...d, profitLoss: true}))}
                        description={`الفترة: ${selectedTimePeriod === 'all' ? 'كل الفترات' : selectedTimePeriod}`}
                    />
                     <Card className="h-full">
                        <CardHeader>
                            <CardTitle>مستحقات الموظفين</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col justify-center gap-4">
                            <Button variant="outline" className="w-full" onClick={() => setDialogs(d => ({...d, settledDues: true}))}>
                                <span>المستحقات المدفوعة:</span>
                                <span className="font-bold mr-2">{(unifiedProfitData?.employeeSettledDues || 0).toLocaleString()} د.ع</span>
                            </Button>
                            <Button variant="outline" className="w-full" onClick={() => setDialogs(d => ({...d, pendingDues: true}))}>
                                <Hourglass className="w-4 h-4 ml-2 text-amber-500"/>
                                <span>المستحقات المعلقة:</span>
                                <span className="font-bold mr-2">{(unifiedProfitData?.employeePendingDues || 0).toLocaleString()} د.ع</span>
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <FinancialPerformanceCard 
                            unifiedProfitData={unifiedProfitData}
                            selectedTimePeriod={selectedTimePeriod}
                            onTimePeriodChange={(period) => {
                                setSelectedTimePeriod(period);
                                localStorage.setItem('financialTimePeriod', period);
                            }}
                        />
                    </div>
                    <div className="lg:col-span-1">
                        <Card>
                            <CardHeader>
                                <CardTitle>تقرير الأرباح والخسائر</CardTitle>
                                <CardDescription>ملخص مالي للفترة المحددة</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <StatRow label="إجمالي المبيعات (مع التوصيل)" value={unifiedProfitData?.totalRevenue || 0} colorClass="text-green-500" />
                                <StatRow label="رسوم التوصيل" value={unifiedProfitData?.deliveryFees || 0} colorClass="text-blue-400" />
                                <StatRow label="المبيعات (بدون التوصيل)" value={unifiedProfitData?.salesWithoutDelivery || 0} colorClass="text-green-600" />
                                <StatRow label="تكلفة البضاعة المباعة" value={unifiedProfitData?.cogs || 0} colorClass="text-orange-500" isNegative/>
                                <StatRow label="مجمل الربح" value={unifiedProfitData?.grossProfit || 0} colorClass="text-blue-500 font-bold" />
                                <StatRow label="المصاريف العامة" value={unifiedProfitData?.generalExpenses || 0} colorClass="text-red-500" isNegative/>
                                <StatRow label="المستحقات المدفوعة" value={unifiedProfitData?.employeeSettledDues || 0} colorClass="text-purple-500" isNegative/>
                                <div className="flex justify-between items-center py-3 mt-2 bg-secondary rounded-lg px-4">
                                    <p className="font-bold text-lg">صافي الربح</p>
                                    <p className="font-bold text-lg text-primary">{(unifiedProfitData?.netProfit || 0).toLocaleString()} د.ع</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
                
            </div>
            <ExpensesDialog
                open={dialogs.expenses}
                onOpenChange={(open) => setDialogs(d => ({ ...d, expenses: open }))}
                expenses={generalExpensesFiltered || []}
                addExpense={addExpense}
                deleteExpense={deleteExpense}
            />
            <EditCapitalDialog
                open={dialogs.capital}
                onOpenChange={(open) => setDialogs(d => ({ ...d, capital: open }))}
                currentCapital={initialCapital}
                onSave={(newCapital) => setInitialCapital(newCapital)}
            />
            <UnifiedSettledDuesDialog
                open={dialogs.settledDues}
                onOpenChange={(open) => setDialogs(d => ({...d, settledDues: open}))}
                invoices={settlementInvoices}
                allUsers={allUsers}
            />
            <PendingDuesDialog
                open={dialogs.pendingDues}
                onOpenChange={(open) => setDialogs(d => ({...d, pendingDues: open}))}
                orders={orders}
                allUsers={allUsers}
                allProfits={allProfits}
            />
            <ProfitLossDialog
                open={dialogs.profitLoss}
                onOpenChange={(open) => setDialogs(d => ({ ...d, profitLoss: open }))}
                summary={unifiedProfitData}
                datePeriod={selectedTimePeriod}
                onDatePeriodChange={setSelectedTimePeriod}
            />
            <CapitalDetailsDialog
                open={dialogs.capitalDetails}
                onOpenChange={(open) => setDialogs(d => ({ ...d, capitalDetails: open }))}
                initialCapital={initialCapital}
                inventoryValue={inventoryValue}
                cashBalance={realCashBalance}
                onCapitalUpdate={async (newCapital) => {
                    // تحديث فوري محلي
                    setInitialCapital(newCapital);
                    // تحديث شامل لجميع البيانات المترابطة
                    await refreshAllFinancialData();
                }}
            />
            <InventoryValueDialog
                open={dialogs.inventoryDetails}
                onOpenChange={(open) => setDialogs(d => ({ ...d, inventoryDetails: open }))}
                totalInventoryValue={inventoryValue}
            />
        </>
    );
};

export default AccountingPage;