import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Wallet, TrendingUp, TrendingDown, Plus, Minus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import StatCard from '@/components/dashboard/StatCard';
import AddCashDialog from '@/components/cash/AddCashDialog';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('ar-IQ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0) + ' د.ع';
};

const EmployeeCashManagementPage = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const userId = currentUser?.id || currentUser?.user_id;

  const [cashSource, setCashSource] = useState(null);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogType, setDialogType] = useState(null);
  const [showDialog, setShowDialog] = useState(false);

  const fetchData = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data: source } = await supabase
        .from('cash_sources')
        .select('*')
        .eq('owner_user_id', userId)
        .eq('is_active', true)
        .single();
      setCashSource(source);

      if (source) {
        const { data: movs } = await supabase
          .from('cash_movements')
          .select('*')
          .eq('cash_source_id', source.id)
          .order('effective_at', { ascending: false })
          .order('created_at', { ascending: false })
          .order('balance_after', { ascending: false })
          .limit(500);
        setMovements(movs || []);
      }
    } catch (error) {
      console.error('Error fetching cash data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('emp_cash_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_sources' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_movements' }, () => fetchData())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [userId]);

  const stats = useMemo(() => {
    const totalIn = movements.filter(m => m.movement_type === 'in').reduce((s, m) => s + Number(m.amount), 0);
    const totalOut = movements.filter(m => m.movement_type === 'out').reduce((s, m) => s + Number(m.amount), 0);
    return { totalIn, totalOut, balance: cashSource?.current_balance || 0 };
  }, [movements, cashSource]);

  const handleAddCash = async (amount, description) => {
    if (!cashSource) return;
    try {
      const { error } = await supabase.from('cash_movements').insert({
        cash_source_id: cashSource.id,
        movement_type: 'in',
        amount: amount,
        description: description || 'إضافة رصيد',
        reference_type: 'capital_injection',
        created_by: userId,
      });
      if (error) throw error;

      await supabase
        .from('cash_sources')
        .update({ current_balance: (cashSource.current_balance || 0) + amount, updated_at: new Date().toISOString() })
        .eq('id', cashSource.id);

      toast({ title: "تمت الإضافة", description: `تم إضافة ${formatCurrency(amount)} بنجاح` });
      fetchData();
    } catch (error) {
      console.error('Error adding cash:', error);
      toast({ title: "خطأ", description: "فشل في إضافة الرصيد", variant: "destructive" });
    }
    setShowDialog(false);
  };

  const handleWithdrawCash = async (amount, description) => {
    if (!cashSource) return;
    try {
      const { error } = await supabase.from('cash_movements').insert({
        cash_source_id: cashSource.id,
        movement_type: 'out',
        amount: amount,
        description: description || 'سحب رصيد',
        reference_type: 'capital_withdrawal',
        created_by: userId,
      });
      if (error) throw error;

      await supabase
        .from('cash_sources')
        .update({ current_balance: (cashSource.current_balance || 0) - amount, updated_at: new Date().toISOString() })
        .eq('id', cashSource.id);

      toast({ title: "تم السحب", description: `تم سحب ${formatCurrency(amount)} بنجاح` });
      fetchData();
    } catch (error) {
      console.error('Error withdrawing cash:', error);
      toast({ title: "خطأ", description: "فشل في سحب الرصيد", variant: "destructive" });
    }
    setShowDialog(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!cashSource) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Wallet className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-bold text-muted-foreground">لا توجد قاصة مفعّلة</h2>
        <p className="text-muted-foreground">تواصل مع المدير لتفعيل قاصتك</p>
        <Button variant="outline" onClick={() => navigate('/employee-financial-center')}>
          <ArrowRight className="h-4 w-4 ml-2" />
          العودة للمركز المالي
        </Button>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>إدارة القاصة - {currentUser?.full_name}</title>
      </Helmet>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/employee-financial-center')}>
            <ArrowRight className="h-4 w-4 ml-2" />
            رجوع
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">إدارة القاصة</h1>
            <p className="text-muted-foreground">{currentUser?.full_name} — {cashSource.name}</p>
          </div>
        </div>

        {/* الإحصائيات */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard title="الرصيد الحالي" value={stats.balance} icon={Wallet} colors={['sky-500', 'blue-500']} format="currency" />
          <StatCard title="إجمالي الدخل" value={stats.totalIn} icon={TrendingUp} colors={['green-500', 'emerald-500']} format="currency" />
          <StatCard title="إجمالي المصروفات" value={stats.totalOut} icon={TrendingDown} colors={['red-500', 'orange-500']} format="currency" />
        </div>

        {/* أزرار الإضافة والسحب */}
        <div className="flex gap-3">
          <Button onClick={() => { setDialogType('add'); setShowDialog(true); }}>
            <Plus className="w-4 h-4 ml-2" />
            إضافة رصيد
          </Button>
          <Button variant="outline" onClick={() => { setDialogType('withdraw'); setShowDialog(true); }}>
            <Minus className="w-4 h-4 ml-2" />
            سحب رصيد
          </Button>
        </div>

        {/* معلومات القاصة */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              {cashSource.name}
              <Badge variant={cashSource.is_active ? 'default' : 'secondary'}>
                {cashSource.is_active ? 'نشطة' : 'غير نشطة'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">الرصيد الأولي</p>
                <p className="text-lg font-bold">{formatCurrency(cashSource.initial_balance)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">الرصيد الحالي</p>
                <p className={`text-lg font-bold ${cashSource.current_balance >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                  {formatCurrency(cashSource.current_balance)}
                </p>
              </div>
              {cashSource.initial_capital != null && (
                <div>
                  <p className="text-sm text-muted-foreground">رأس المال</p>
                  <p className="text-lg font-bold">{formatCurrency(cashSource.initial_capital)}</p>
                </div>
              )}
              {cashSource.description && (
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">الوصف</p>
                  <p>{cashSource.description}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* حركات النقد */}
        <Card>
          <CardHeader>
            <CardTitle>حركات النقد ({movements.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {movements.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد حركات بعد</p>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {movements.map((m) => (
                  <div key={m.id} className="flex justify-between items-center py-3 px-4 rounded-lg bg-secondary/30 border border-border/30">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{m.description}</p>
                      <div className="flex gap-2 items-center mt-1">
                        <p className="text-xs text-muted-foreground">
                          {m.created_at ? format(parseISO(m.created_at), 'dd/MM/yyyy HH:mm', { locale: ar }) : ''}
                        </p>
                        {m.reference_type && (
                          <Badge variant="outline" className="text-xs">
                            {m.reference_type === 'order' ? 'طلب' :
                             m.reference_type === 'expense' ? 'مصروف' :
                             m.reference_type === 'purchase' ? 'شراء' :
                             m.reference_type === 'capital_injection' ? 'إضافة رأس مال' :
                             m.reference_type === 'capital_withdrawal' ? 'سحب' :
                             m.reference_type === 'employee_dues' ? 'مستحقات' :
                             m.reference_type}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-left min-w-[120px]">
                      <p className={`font-bold ${m.movement_type === 'in' ? 'text-green-500' : 'text-red-500'}`}>
                        {m.movement_type === 'in' ? '+' : '-'}{Number(m.amount).toLocaleString()} د.ع
                      </p>
                      <p className="text-xs text-muted-foreground">
                        الرصيد: {Number(m.balance_after).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {showDialog && (
        <AddCashDialog
          open={showDialog}
          onOpenChange={setShowDialog}
          onSubmit={dialogType === 'add' ? handleAddCash : handleWithdrawCash}
          title={dialogType === 'add' ? 'إضافة رصيد' : 'سحب رصيد'}
          type={dialogType}
        />
      )}
    </>
  );
};

export default EmployeeCashManagementPage;
