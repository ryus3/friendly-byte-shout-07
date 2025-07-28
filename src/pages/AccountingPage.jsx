import React, { useState, useMemo, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useCashSources } from '@/hooks/useCashSources';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Edit, BarChart, BarChart3, TrendingUp, TrendingDown, Wallet, Box, User, Users, Banknote, Coins as HandCoins, Hourglass, CheckCircle, PieChart } from 'lucide-react';
import { format, parseISO, isValid, startOfMonth, endOfMonth, startOfWeek, startOfYear, subDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from '@/components/ui/use-toast';

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

const AccountingPage = () => {
    const { orders, purchases, accounting, products } = useInventory();
    const { user: currentUser } = useAuth();
    const { hasPermission } = usePermissions();
    const { getTotalSourcesBalance, getMainCashBalance } = useCashSources();
    
    const [datePeriod, setDatePeriod] = useState('month');
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

    // جلب رأس المال من قاعدة البيانات
    useEffect(() => {
        const fetchCapital = async () => {
            try {
                const { data: capitalData, error: capitalError } = await supabase
                    .from('settings')
                    .select('value')
                    .eq('key', 'initial_capital')
                    .single();

                if (capitalError) throw capitalError;
                
                const capitalValue = Number(capitalData?.value) || 0;
                setInitialCapital(capitalValue);
                
                // جلب الرصيد النقدي الفعلي
                const totalMainBalance = await getMainCashBalance();
                const otherSourcesBalance = getTotalSourcesBalance();
                const totalRealBalance = totalMainBalance + otherSourcesBalance;
                setRealCashBalance(totalRealBalance);
                
            } catch (error) {
                console.error('❌ خطأ في جلب البيانات المالية:', error);
            }
        };
        
        fetchCapital();
    }, [getMainCashBalance, getTotalSourcesBalance]);

    const financialSummary = useMemo(() => {
        const { from, to } = dateRange;
        
        if (!orders || !Array.isArray(orders)) {
            return {
                totalRevenue: 0, totalSystemProfit: 0, netProfit: 0,
                inventoryValue: 0, chartData: []
            };
        }
        
        const safeOrders = Array.isArray(orders) ? orders : [];
        
        const filterByDate = (itemDateStr) => {
            if (!from || !to || !itemDateStr) return true;
            try {
                const itemDate = parseISO(itemDateStr);
                return isValid(itemDate) && itemDate >= from && itemDate <= to;
            } catch (e) {
                return false;
            }
        };
        
        // الطلبات المُستلمة الفواتير فقط
        const deliveredOrders = safeOrders.filter(o => 
            o && (o.status === 'delivered' || o.status === 'completed') && 
            o.receipt_received === true && 
            filterByDate(o.updated_at || o.created_at)
        );
        
        // حساب إجمالي الإيرادات
        const totalRevenue = deliveredOrders.reduce((sum, o) => {
            const amount = o.final_amount || o.total_amount || 0;
            return sum + amount;
        }, 0);
        
        // حساب ربح النظام الكامل
        const totalSystemProfit = deliveredOrders.reduce((sum, order) => {
            if (!order.order_items || !Array.isArray(order.order_items)) return sum;
            
            const orderProfit = order.order_items.reduce((itemSum, item) => {
                const sellPrice = item.unit_price || item.price || 0;
                const costPrice = item.product_variants?.cost_price || item.products?.cost_price || 0;
                const quantity = item.quantity || 0;
                return itemSum + ((sellPrice - costPrice) * quantity);
            }, 0);
            
            return sum + orderProfit;
        }, 0);
        
        // حساب قيمة المخزون
        const inventoryValue = Array.isArray(products) ? products.reduce((sum, p) => {
            if (!p.variants || !Array.isArray(p.variants)) return sum;
            return sum + p.variants.reduce((variantSum, v) => {
                const quantity = v.quantity || 0;
                const price = v.price || p.base_price || 0;
                return variantSum + (quantity * price);
            }, 0);
        }, 0) : 0;
        
        return {
            totalRevenue,
            totalSystemProfit,
            netProfit: totalSystemProfit,
            inventoryValue,
            chartData: []
        };
    }, [dateRange, orders, products, allProfits, currentUser?.id]);

    // حساب نسبة ربح المنتجات
    const productProfitPercentage = useMemo(() => {
        if (financialSummary.totalRevenue === 0) return 0;
        return ((financialSummary.totalSystemProfit / financialSummary.totalRevenue) * 100).toFixed(1);
    }, [financialSummary.totalSystemProfit, financialSummary.totalRevenue]);

    return (
        <>
            <Helmet>
                <title>المركز المالي - RYUS BRAND</title>
                <meta name="description" content="نظرة شاملة على الحالة المالية للشركة" />
            </Helmet>

            <div className="container mx-auto px-4 py-6 space-y-6 max-w-7xl">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">المركز المالي</h1>
                        <p className="text-muted-foreground mt-1">نظرة شاملة على الحالة المالية للشركة</p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <select 
                            value={datePeriod} 
                            onChange={(e) => setDatePeriod(e.target.value)}
                            className="px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                        >
                            <option value="today">اليوم</option>
                            <option value="week">هذا الأسبوع</option>
                            <option value="month">هذا الشهر</option>
                            <option value="year">هذا العام</option>
                        </select>
                    </div>
                </div>

                {/* الكروت الرئيسية */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* إجمالي الإيرادات */}
                    <Card className="bg-gradient-to-br from-blue-500/5 to-blue-600/5 border-blue-200/20 dark:border-blue-800/20">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                إجمالي الإيرادات
                            </CardTitle>
                            <TrendingUp className="h-5 w-5 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                {formatCurrency(financialSummary.totalRevenue)}
                            </div>
                        </CardContent>
                    </Card>

                    {/* ربح النظام */}
                    <Card className="bg-gradient-to-br from-green-500/5 to-green-600/5 border-green-200/20 dark:border-green-800/20">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                ربح النظام
                            </CardTitle>
                            <Wallet className="h-5 w-5 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                {formatCurrency(financialSummary.totalSystemProfit)}
                            </div>
                        </CardContent>
                    </Card>

                    {/* تحليل أرباح المنتجات */}
                    <Card className="bg-gradient-to-br from-orange-500/5 to-amber-600/5 border-orange-200/20 dark:border-orange-800/20">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                تحليل أرباح المنتجات
                            </CardTitle>
                            <BarChart3 className="h-5 w-5 text-orange-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                                {productProfitPercentage}%
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                نسبة الربح من المبيعات
                            </p>
                        </CardContent>
                    </Card>

                    {/* قيمة المخزون */}
                    <Card className="bg-gradient-to-br from-purple-500/5 to-purple-600/5 border-purple-200/20 dark:border-purple-800/20">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                قيمة المخزون
                            </CardTitle>
                            <Box className="h-5 w-5 text-purple-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                                {formatCurrency(financialSummary.inventoryValue)}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* معلومات إضافية */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <PieChart className="h-5 w-5" />
                                ملخص مالي سريع
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <StatRow 
                                label="رأس المال" 
                                value={initialCapital} 
                                colorClass="text-blue-600 dark:text-blue-400" 
                            />
                            <StatRow 
                                label="الرصيد النقدي الفعلي" 
                                value={realCashBalance} 
                                colorClass="text-green-600 dark:text-green-400" 
                            />
                            <StatRow 
                                label="قيمة المخزون" 
                                value={financialSummary.inventoryValue} 
                                colorClass="text-purple-600 dark:text-purple-400" 
                            />
                            <StatRow 
                                label="صافي الربح للفترة" 
                                value={financialSummary.netProfit} 
                                colorClass="text-orange-600 dark:text-orange-400" 
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BarChart className="h-5 w-5" />
                                إحصائيات الأداء
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="text-center py-8">
                                <div className="text-4xl font-bold text-primary mb-2">
                                    {productProfitPercentage}%
                                </div>
                                <p className="text-muted-foreground">
                                    نسبة ربح المنتجات من إجمالي المبيعات
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
};

export default AccountingPage;