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
import { toast } from '@/hooks/use-toast';
import { PDFDownloadLink } from '@react-pdf/renderer';
import StatCard from '@/components/dashboard/StatCard';
import ManagerProfitsCard from '@/components/shared/ManagerProfitsCard';
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

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('ar-IQ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0) + ' د.ع';
};

// دالة للحصول على ربح الموظف من جدول الأرباح الفعلي
const getEmployeeProfitFromOrder = (orderId, employeeId) => {
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
    
    const [datePeriod, setDatePeriod] = useState('month');
    
    // جلب بيانات تحليل الأرباح لآخر 30 يوم
    const profitsDateRange = {
        from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        to: new Date()
    };
    const profitsFilters = {
        department: 'all',
        category: 'all',
        product: 'all',
        color: 'all',
        size: 'all',
        season: 'all',
        productType: 'all'
    };
    const { analysisData: profitsAnalysis } = useAdvancedProfitsAnalysis(profitsDateRange, profitsFilters);
    const { profitData: unifiedProfitData } = useUnifiedProfits();
    
    const [dialogs, setDialogs] = useState({ expenses: false, capital: false, settledDues: false, pendingDues: false, profitLoss: false, capitalDetails: false, inventoryDetails: false });
    const [allProfits, setAllProfits] = useState([]);
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
                
                console.log('💰 الرصيد النقدي الفعلي الموحد:', {
                    mainBalance: totalMainBalance,
                    otherSources: otherSourcesBalance,
                    total: totalRealBalance
                });
                
                setRealCashBalance(totalRealBalance);
            } catch (error) {
                console.error('❌ خطأ في حساب الرصيد النقدي الفعلي:', error);
                setRealCashBalance(0);
            }
        };
        
        fetchRealBalance();
    }, [getMainCashBalance, getTotalSourcesBalance, initialCapital]); // إضافة getMainCashBalance كـ dependency

    const financialSummary = useMemo(() => {
        const { from, to } = dateRange;
        
        // تحقق من وجود البيانات الأساسية
        if (!orders || !Array.isArray(orders)) {
            console.warn('⚠️ لا توجد بيانات طلبات، orders:', orders);
            return {
                totalRevenue: 0, cogs: 0, grossProfit: 0, netProfit: 0,
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
            o && (o.status === 'delivered' || o.status === 'completed') && 
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
        
        // حساب ربح النظام الصحيح (نفس منطق قاعدة البيانات)
        // ربح النظام = ربح المدير كاملاً + ربح النظام من طلبات الموظفين
        const managerOrdersInRange = deliveredOrders.filter(o => !o.created_by || o.created_by === currentUser?.id);
        const employeeOrdersInRange = deliveredOrders.filter(o => o.created_by && o.created_by !== currentUser?.id);
        
        const managerTotalProfit = managerOrdersInRange.reduce((sum, order) => {
          const orderProfit = (order.items || []).reduce((itemSum, item) => {
            const sellPrice = item.unit_price || item.price || 0;
            const costPrice = item.product_variants?.cost_price || item.products?.cost_price || 0;
            return itemSum + ((sellPrice - costPrice) * item.quantity);
          }, 0);
          return sum + orderProfit;
        }, 0);
        
        // حساب ربح النظام من طلبات الموظفين (باستخدام البيانات الفعلية من جدول profits)
        const employeeSystemProfit = employeeOrdersInRange.reduce((sum, order) => {
          return sum + getSystemProfitFromOrder(order.id, allProfits);
        }, 0);
        
        // ربح النظام الصحيح
        const systemProfit = managerTotalProfit + employeeSystemProfit;
        
        // المصاريف العامة - استبعاد جميع المصاريف النظامية ومستحقات الموظفين
        const generalExpenses = expensesInRange.filter(e => {
          // استبعاد جميع المصاريف النظامية
          if (e.expense_type === 'system') return false;
          
          // استبعاد مستحقات الموظفين حتى لو لم تكن نظامية
          if (e.category === 'مستحقات الموظفين') return false;
          
          // استبعاد مصاريف الشراء المرتبطة بالمشتريات
          if (e.related_data?.category === 'شراء بضاعة') return false;
          
          return true;
        }).reduce((sum, e) => sum + (e.amount || 0), 0);
        
        // مستحقات الموظفين المسددة
        const employeeSettledDues = expensesInRange.filter(e => 
          e.related_data?.category === 'مستحقات الموظفين'
        ).reduce((sum, e) => sum + (e.amount || 0), 0);
        
        // صافي الربح = ربح النظام - المصاريف العامة
        const netProfit = systemProfit - generalExpenses;
    
        
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
        const managerOrdersDelivered = deliveredOrders.filter(o => o.created_by === currentUser?.id);
        console.log('👨‍💼 طلبات المدير المُستلمة:', managerOrdersDelivered.length);
        
        const managerSales = managerOrdersDelivered.reduce((sum, o) => {
            const orderTotal = o.final_amount || o.total_amount || 0;
            const deliveryFee = o.delivery_fee || 0;
            const salesAmount = orderTotal - deliveryFee;
            return sum + salesAmount;
        }, 0);
        
        // حساب أرباح المدير بشكل مبسط (سعر البيع - التكلفة)
        const myProfit = managerOrdersDelivered.reduce((sum, o) => {
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

        // حساب مبيعات وأرباح الموظفين (المُستلمة الفواتير فقط) باستخدام القواعد الصحيحة
        const employeeOrdersDelivered = deliveredOrders.filter(o => {
            const orderUser = allUsers?.find(u => u.id === o.created_by);
            return orderUser && (orderUser.role === 'employee' || orderUser.role === 'deputy') && o.created_by !== currentUser?.id;
        });
        
        const employeeSales = employeeOrdersDelivered.reduce((sum, o) => {
            const orderTotal = o.final_amount || o.total_amount || 0;
            const deliveryFee = o.delivery_fee || 0;
            return sum + (orderTotal - deliveryFee);
        }, 0);
        
        // حساب أرباح النظام من طلبات الموظفين (باستخدام البيانات الفعلية)
        const systemProfitFromEmployees = employeeOrdersDelivered.reduce((sum, o) => {
          return sum + getSystemProfitFromOrder(o.id, allProfits);
        }, 0);
        
        const totalSystemProfit = myProfit + systemProfitFromEmployees;
    
        // حساب مستحقات الموظفين المعلقة (من جدول profits)
        const employeePendingDues = allProfits
          .filter(p => {
            const order = deliveredOrders.find(o => o.id === p.order_id);
            return order && p.status === 'pending' && p.employee_id !== currentUser?.id;
          })
          .reduce((sum, p) => sum + (p.employee_profit || 0), 0);
    
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
    
        return { totalRevenue, deliveryFees, salesWithoutDelivery, cogs, grossProfit, systemProfit, netProfit, totalSystemProfit, inventoryValue, myProfit, systemProfitFromEmployees, managerSales, employeeSales, employeePendingDues, employeeSettledDues, cashOnHand, chartData, filteredExpenses: expensesInRange, generalExpenses, deliveredOrders, employeePendingDuesDetails: [], generalExpensesFiltered: expensesInRange.filter(e => {
          if (e.expense_type === 'system') return false;
          if (e.category === 'مستحقات الموظفين') return false;
          if (e.related_data?.category === 'شراء بضاعة') return false;
          return true;
        }) };
    }, [dateRange, orders, purchases, accounting, products, currentUser?.id, allUsers, allProfits]);

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
        { key: 'inventory', title: "قيمة المخزون", value: financialSummary.inventoryValue, icon: Box, colors: ['emerald-500', 'green-500'], format: "currency", onClick: () => setDialogs(d => ({ ...d, inventoryDetails: true })) },
    ];
    
    const profitCards = [
        { 
          key: 'productProfit', 
          title: "تحليل أرباح المنتجات", 
          value: (() => {
            // استخدام بيانات تحليل الأرباح المتقدم من الصفحة المتخصصة
            const totalSystemProfit = profitsAnalysis?.systemProfit || 0;
            console.log('🔍 [DEBUG] Product Analysis Card - systemProfit:', totalSystemProfit, 'from profitsAnalysis');
            return formatCurrency(totalSystemProfit);
          })(),
          subValue: (() => {
            // حساب عدد المنتجات المباعة أو الطلبات من التحليل المتقدم
            const totalOrders = profitsAnalysis?.totalOrders || 0;
            const totalProductsSold = profitsAnalysis?.totalProductsSold || 0;
            
            if (totalProductsSold > 0) {
              return `${totalProductsSold} منتج مباع`;
            } else if (totalOrders > 0) {
              return `${totalOrders} طلب`;
            } else {
              return 'لا توجد مبيعات';
            }
          })(),
          icon: PieChart, 
          colors: ['violet-500', 'purple-500'], 
          format: 'custom', 
          onClick: () => navigate('/advanced-profits-analysis') 
        },
        // استخدام النظام الجديد المعتمد لأرباح المدير من الموظفين
        { 
          key: 'employeeProfitUnified', 
          component: 'ManagerProfitsCard',
          title: "أرباحي من الموظفين", 
          orders: orders || [], 
          employees: allUsers || [], 
          profits: allProfits || [],
          cardSize: 'default',
          showDetailedButton: true
        },
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
                    {profitCards.map((card, index) => {
                        // استخدام النظام الجديد المعتمد لأرباح المدير من الموظفين
                        if (card.component === 'ManagerProfitsCard') {
                            return (
                                <ManagerProfitsCard 
                                    key={index}
                                    orders={card.orders}
                                    employees={card.employees}
                                    profits={card.profits}
                                    title={card.title}
                                    cardSize={card.cardSize}
                                    showDetailedButton={true}
                                />
                            );
                        }
                        
                        // الكروت العادية الأخرى
                        return <StatCard key={index} {...card} />;
                    })}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <StatCard 
                        title="صافي أرباح المبيعات" 
                        value={financialSummary.netProfit} 
                        icon={PieChart} 
                        colors={['blue-500', 'sky-500']} 
                        format="currency" 
                        onClick={() => setDialogs(d => ({...d, profitLoss: true}))}
                        description="بعد خصم المصاريف العامة"
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
                                <StatRow label="مجمل الربح" value={financialSummary.systemProfit || financialSummary.grossProfit || 0} colorClass="text-blue-500 font-bold" />
                                <StatRow label="المصاريف العامة" value={financialSummary.generalExpenses || 0} colorClass="text-red-500" isNegative/>
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
                expenses={financialSummary.generalExpensesFiltered || []}
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
                orders={financialSummary.employeePendingDuesDetails}
                allUsers={allUsers}
            />
            <ProfitLossDialog
                open={dialogs.profitLoss}
                onOpenChange={(open) => setDialogs(d => ({ ...d, profitLoss: open }))}
                summary={unifiedProfitData}
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
                    await refreshAllFinancialData();
                }}
            />
            <InventoryValueDialog
                open={dialogs.inventoryDetails}
                onOpenChange={(open) => setDialogs(d => ({ ...d, inventoryDetails: open }))}
                totalInventoryValue={financialSummary.inventoryValue}
            />
        </>
    );
};

export default AccountingPage;