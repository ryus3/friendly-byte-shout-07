import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, Plus, Wallet, TrendingUp, TrendingDown,
  DollarSign, Banknote, Activity, PieChart, BarChart3
} from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';
import CashSourceCard from '@/components/cash/CashSourceCard';
import CashMovementsList from '@/components/cash/CashMovementsList';
import AddCashDialog from '@/components/cash/AddCashDialog';
import AddCashSourceDialog from '@/components/cash/AddCashSourceDialog';
import StatCard from '@/components/dashboard/StatCard';
import { format, startOfMonth, startOfWeek, startOfDay } from 'date-fns';
import { ar } from 'date-fns/locale';

const EmployeeCashManagementPage = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const userId = currentUser?.id || currentUser?.user_id;

  const [cashSources, setCashSources] = useState([]);
  const [cashMovements, setCashMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSource, setSelectedSource] = useState(null);
  const [dialogType, setDialogType] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [deleteSource, setDeleteSource] = useState(null);

  const fetchData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // Fetch cash sources owned by this employee
      const { data: sources } = await supabase
        .from('cash_sources')
        .select('*')
        .eq('owner_user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      setCashSources(sources || []);

      if (sources && sources.length > 0) {
        const sourceIds = sources.map(s => s.id);
        const { data: movs } = await supabase
          .from('cash_movements')
          .select('*')
          .in('cash_source_id', sourceIds)
          .order('effective_at', { ascending: false })
          .order('created_at', { ascending: false })
          .order('balance_after', { ascending: false })
          .limit(1000);
        setCashMovements(movs || []);
      } else {
        setCashMovements([]);
      }
    } catch (error) {
      console.error('Error fetching cash data:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('emp_cash_full')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_sources' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_movements' }, () => fetchData())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchData]);

  // Stats calculations
  const today = new Date();
  const todayStart = startOfDay(today);
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const monthStart = startOfMonth(today);

  const todayMovements = cashMovements.filter(m => new Date(m.effective_at || m.created_at) >= todayStart);
  const weekMovements = cashMovements.filter(m => new Date(m.effective_at || m.created_at) >= weekStart);
  const monthMovements = cashMovements.filter(m => new Date(m.effective_at || m.created_at) >= monthStart);

  const calculateStats = useCallback((movements) => {
    const totalIn = movements.filter(m => m.movement_type === 'in').reduce((sum, m) => sum + (m.amount || 0), 0);
    const totalOut = movements.filter(m => m.movement_type === 'out').reduce((sum, m) => sum + (m.amount || 0), 0);
    return { totalIn, totalOut, net: totalIn - totalOut };
  }, []);

  const todayStats = useMemo(() => calculateStats(todayMovements), [todayMovements, calculateStats]);
  const weekStats = useMemo(() => calculateStats(weekMovements), [weekMovements, calculateStats]);
  const monthStats = useMemo(() => calculateStats(monthMovements), [monthMovements, calculateStats]);

  const totalBalance = useMemo(() => cashSources.reduce((sum, s) => sum + (s.current_balance || 0), 0), [cashSources]);

  const kpiCards = [
    { title: 'الرصيد النقدي الفعلي', value: totalBalance, format: 'currency', icon: DollarSign, colors: ['emerald-600', 'teal-600'], change: `مجموع ${cashSources.length} مصدر نقد` },
    { title: 'داخل اليوم', value: todayStats.totalIn, format: 'currency', icon: TrendingUp, colors: ['green-500', 'emerald-500'], change: `${todayMovements.filter(m => m.movement_type === 'in').length} حركة` },
    { title: 'خارج اليوم', value: todayStats.totalOut, format: 'currency', icon: TrendingDown, colors: ['red-500', 'orange-500'], change: `${todayMovements.filter(m => m.movement_type === 'out').length} حركة` },
    { title: 'داخل هذا الشهر', value: monthStats.totalIn, format: 'currency', icon: TrendingUp, colors: ['teal-500', 'cyan-500'], change: `${monthMovements.filter(m => m.movement_type === 'in').length} حركة` },
    { title: 'خارج هذا الشهر', value: monthStats.totalOut, format: 'currency', icon: TrendingDown, colors: ['red-500', 'orange-500'], change: `${monthMovements.filter(m => m.movement_type === 'out').length} حركة` },
  ];

  const handleAddCash = (source) => {
    setSelectedSource(source);
    setDialogType('add');
    setShowDialog(true);
  };

  const handleWithdrawCash = (source) => {
    setSelectedSource(source);
    setDialogType('withdraw');
    setShowDialog(true);
  };

  const handleConfirmOperation = async (amount, description) => {
    if (!selectedSource) return;
    try {
      const movementType = dialogType === 'add' ? 'in' : 'out';
      const { error } = await supabase.from('cash_movements').insert({
        cash_source_id: selectedSource.id,
        movement_type: movementType,
        amount: amount,
        description: description || (dialogType === 'add' ? 'إضافة رصيد' : 'سحب رصيد'),
        reference_type: dialogType === 'add' ? 'capital_injection' : 'capital_withdrawal',
        created_by: userId,
      });
      if (error) throw error;

      const newBalance = dialogType === 'add'
        ? (selectedSource.current_balance || 0) + amount
        : (selectedSource.current_balance || 0) - amount;

      await supabase
        .from('cash_sources')
        .update({ current_balance: newBalance, updated_at: new Date().toISOString() })
        .eq('id', selectedSource.id);

      toast({ title: dialogType === 'add' ? "تمت الإضافة" : "تم السحب", description: `${amount.toLocaleString()} د.ع` });
      fetchData();
    } catch (error) {
      console.error('Cash operation error:', error);
      toast({ title: "خطأ", description: "فشل في تنفيذ العملية", variant: "destructive" });
    }
    setShowDialog(false);
  };

  const handleAddCashSource = async (sourceData) => {
    try {
      const { error } = await supabase.from('cash_sources').insert({
        ...sourceData,
        owner_user_id: userId,
        created_by: userId,
        current_balance: sourceData.initial_balance || 0,
      });
      if (error) throw error;
      toast({ title: "تم بنجاح", description: "تم إضافة مصدر النقد الجديد" });
      fetchData();
    } catch (error) {
      console.error('Add cash source error:', error);
      toast({ title: "خطأ", description: "فشل في إضافة مصدر النقد", variant: "destructive" });
    }
  };

  const handleDeleteSource = (source) => {
    if (source.current_balance > 0) {
      toast({ title: "خطأ", description: "لا يمكن حذف مصدر يحتوي على رصيد", variant: "destructive" });
      return;
    }
    setDeleteSource(source);
  };

  const confirmDeleteSource = async () => {
    if (!deleteSource) return;
    try {
      const { error } = await supabase
        .from('cash_sources')
        .update({ is_active: false })
        .eq('id', deleteSource.id);
      if (error) throw error;
      setDeleteSource(null);
      toast({ title: "تم بنجاح", description: "تم حذف مصدر النقد" });
      fetchData();
    } catch (error) {
      toast({ title: "خطأ", description: "فشل في حذف مصدر النقد", variant: "destructive" });
    }
  };

  if (loading && cashSources.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">جاري تحميل بيانات القاصة...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>إدارة القاصة - {currentUser?.full_name}</title>
      </Helmet>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/employee-financial-center')} className="text-muted-foreground hover:text-foreground">
              <ArrowRight className="w-4 h-4 ml-1" />
              العودة للمركز المالي
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold gradient-text">إدارة القاصة</h1>
            <Wallet className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {kpiCards.map((stat, index) => (
            <StatCard key={`${stat.title}-${index}`} {...stat} />
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="sources" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="sources" className="flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              مصادر النقد
            </TabsTrigger>
            <TabsTrigger value="movements" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              حركات النقد
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              التحليلات
            </TabsTrigger>
          </TabsList>

          {/* مصادر النقد */}
          <TabsContent value="sources" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">مصادر النقد النشطة</h2>
              <AddCashSourceDialog onAdd={handleAddCashSource}>
                <Button size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  إضافة مصدر جديد
                </Button>
              </AddCashSourceDialog>
            </div>

            {cashSources.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <Wallet className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">لا توجد مصادر نقد</p>
                  <p className="text-sm text-muted-foreground mt-1">تواصل مع المدير لتفعيل قاصتك</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {cashSources.map((source) => {
                  const sourceMovements = cashMovements.filter(m => m.cash_source_id === source.id);
                  return (
                    <CashSourceCard
                      key={source.id}
                      cashSource={source}
                      movements={sourceMovements}
                      onAddCash={handleAddCash}
                      onWithdrawCash={handleWithdrawCash}
                      onViewDetails={() => {}}
                      onDelete={handleDeleteSource}
                      realBalance={source.current_balance}
                    />
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* حركات النقد */}
          <TabsContent value="movements">
            <CashMovementsList
              movements={cashMovements}
              cashSources={cashSources}
            />
          </TabsContent>

          {/* التحليلات */}
          <TabsContent value="analytics" className="space-y-6">
            {/* إحصائيات فترية */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { title: 'اليوم', stats: todayStats },
                { title: 'هذا الأسبوع', stats: weekStats },
                { title: 'هذا الشهر', stats: monthStats },
              ].map(({ title, stats }) => (
                <Card key={title}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600">داخل:</span>
                        <span className="font-medium">{stats.totalIn.toLocaleString()} د.ع</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-red-600">خارج:</span>
                        <span className="font-medium">{stats.totalOut.toLocaleString()} د.ع</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold border-t pt-2">
                        <span>الصافي:</span>
                        <span className={stats.net >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {stats.net.toLocaleString()} د.ع
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* توزيع المصادر */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="w-5 h-5" />
                  توزيع الأرصدة حسب المصدر
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {cashSources.map((source) => {
                    const percentage = totalBalance > 0
                      ? ((source.current_balance / totalBalance) * 100).toFixed(1)
                      : '0.0';
                    return (
                      <div key={source.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{
                              backgroundColor: source.type === 'bank' ? '#3b82f6' :
                                source.type === 'digital_wallet' ? '#8b5cf6' : '#10b981'
                            }}
                          />
                          <span className="font-medium">{source.name}</span>
                        </div>
                        <div className="text-left">
                          <span className="font-semibold">{(source.current_balance || 0).toLocaleString()} د.ع</span>
                          <span className="text-sm text-muted-foreground ml-2">({percentage}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* نافذة إضافة/سحب */}
        <AddCashDialog
          open={showDialog}
          onOpenChange={setShowDialog}
          cashSource={selectedSource}
          type={dialogType}
          onConfirm={handleConfirmOperation}
        />

        {/* نافذة تأكيد الحذف */}
        <AlertDialog open={!!deleteSource} onOpenChange={() => setDeleteSource(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>تأكيد حذف المصدر</AlertDialogTitle>
              <AlertDialogDescription>
                هل أنت متأكد من حذف مصدر النقد "{deleteSource?.name}"؟
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteSource} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                حذف المصدر
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
};

export default EmployeeCashManagementPage;
