import React, { useState, useMemo, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useEnhancedFinancialData } from '@/hooks/useEnhancedFinancialData';
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
    const { orders, products } = useInventory();
    const { user: currentUser } = useAuth();
    const { hasPermission } = usePermissions();
    const { financialData, loading: financialLoading, error: financialError, refreshData } = useEnhancedFinancialData();
    
    const [datePeriod, setDatePeriod] = useState('month');

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

    // تحديث البيانات عند تغيير الفترة
    useEffect(() => {
        refreshData();
    }, [datePeriod, refreshData]);

    // البيانات المالية المحسنة
    const financialSummary = useMemo(() => {
        if (financialLoading || !financialData) {
            return {
                totalRevenue: 0,
                totalSystemProfit: 0,
                grossProfit: 0,
                netProfit: 0,
                inventoryValue: 0,
                capitalValue: 0,
                finalBalance: 0
            };
        }

        // حساب قيمة المخزون الحالية
        const inventoryValue = Array.isArray(products) ? products.reduce((sum, p) => {
            if (!p.variants || !Array.isArray(p.variants)) return sum;
            return sum + p.variants.reduce((variantSum, v) => {
                const quantity = v.quantity || 0;
                const price = v.price || p.base_price || 0;
                return variantSum + (quantity * price);
            }, 0);
        }, 0) : 0;

        return {
            totalRevenue: financialData.totalRevenue || 0,
            totalSystemProfit: financialData.systemProfit || 0,
            grossProfit: financialData.grossProfit || 0,
            netProfit: financialData.netProfit || 0,
            inventoryValue,
            capitalValue: financialData.capitalValue || 0,
            finalBalance: financialData.finalBalance || 0
        };
    }, [financialData, financialLoading, products]);

    // حساب نسبة ربح المنتجات الصحيحة
    const productProfitPercentage = useMemo(() => {
        if (financialSummary.totalRevenue === 0) return 0;
        return ((financialSummary.grossProfit / financialSummary.totalRevenue) * 100).toFixed(1);
    }, [financialSummary.grossProfit, financialSummary.totalRevenue]);

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
                                {formatCurrency(financialSummary.grossProfit)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                الربح الخام من المبيعات
                            </p>
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
                                value={financialSummary.capitalValue} 
                                colorClass="text-blue-600 dark:text-blue-400" 
                            />
                            <StatRow 
                                label="الرصيد النقدي النهائي" 
                                value={financialSummary.finalBalance} 
                                colorClass="text-green-600 dark:text-green-400" 
                            />
                            <StatRow 
                                label="قيمة المخزون الحالية" 
                                value={financialSummary.inventoryValue} 
                                colorClass="text-purple-600 dark:text-purple-400" 
                            />
                            <StatRow 
                                label="صافي الربح المحقق" 
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