import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, TrendingUp, Wallet, Users, Package, Crown, Boxes, Truck, FileText,
  ChevronLeft, ChevronRight, AlertCircle, UserCheck, Building2, ChevronDown, Check,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { computeInvoiceProfits } from '@/lib/invoiceProfitsCalc';
import { startOfDay, startOfWeek, startOfMonth, startOfYear, endOfDay } from 'date-fns';

const GENERAL_MANAGER_ID = '91484496-b887-44f7-9e5d-be9db5567604';

const PERIODS = [
  { id: 'day', label: 'اليوم' },
  { id: 'week', label: 'الأسبوع' },
  { id: 'month', label: 'الشهر' },
  { id: 'year', label: 'السنة' },
  { id: 'all', label: 'الكل' },
  { id: 'custom', label: 'مخصص' },
];

const TABS = [
  { id: 'summary', label: 'الملخص', icon: TrendingUp },
  { id: 'invoices', label: 'الفواتير', icon: FileText },
  { id: 'products', label: 'المنتجات', icon: Boxes },
  { id: 'distribution', label: 'التوزيع', icon: Users },
];

const computeRange = (period) => {
  const now = new Date();
  const to = endOfDay(now);
  let from;
  switch (period) {
    case 'day': from = startOfDay(now); break;
    case 'week': from = startOfWeek(now, { weekStartsOn: 6 }); break;
    case 'month': from = startOfMonth(now); break;
    case 'year': from = startOfYear(now); break;
    case 'all': from = new Date(2000, 0, 1); break;
    default: return null;
  }
  return { from, to };
};

/**
 * Props:
 *  - defaultScope: 'active_accounts' | 'self' | 'employee' | 'employees' | 'managed' | 'all'
 *  - employeeId: لفلترة موظف واحد محدد مسبقاً
 *  - allowScopeSelection: إظهار اختيار النطاق (لصفحة متابعة الموظفين)
 *  - supervisedEmployeeIds: لقصر قائمة الموظفين على المشرف عليهم
 *  - scope: للتوافق مع الاستدعاءات القديمة
 */
const InvoicesProfitReportDialog = ({
  open,
  onOpenChange,
  defaultScope,
  scope: legacyScope,
  employeeId = null,
  allowScopeSelection = false,
  supervisedEmployeeIds = [],
}) => {
  const initialScope = defaultScope || legacyScope || 'self';
  const { user, allUsers = [] } = useAuth();
  const { isAdmin, isDepartmentManager } = usePermissions();
  const userId = user?.user_id || user?.id;

  const [period, setPeriod] = useState('month');
  const [dateRange, setDateRange] = useState(() => computeRange('month'));
  const [scope, setScope] = useState(initialScope);
  const [singleEmployee, setSingleEmployee] = useState(employeeId || 'all');
  const [multiEmployeeIds, setMultiEmployeeIds] = useState([]);
  const [selectedAccountKeys, setSelectedAccountKeys] = useState([]); // [] = جميع الحسابات النشطة
  const [duesExpanded, setDuesExpanded] = useState(false);

  const [invoices, setInvoices] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [invoicesError, setInvoicesError] = useState(null);
  const [activeAccounts, setActiveAccounts] = useState([]); // [{partner, account_username}]

  const [data, setData] = useState({ orders: [], orderItems: [], profits: [], employeesWithRules: new Set(), namesMap: {} });
  const [computing, setComputing] = useState(false);
  const [computeError, setComputeError] = useState(null);
  const [tabIndex, setTabIndex] = useState(0);

  // ✅ قائمة الموظفين القابلين للاختيار: استبعاد المدير العام دائماً، واستبعاد الذات للمدير
  const selectableEmployees = useMemo(() => {
    const list = (allUsers || []).filter(u => {
      if (!u) return false;
      const id = u.user_id || u.id;
      if (!id) return false;
      if (id === GENERAL_MANAGER_ID) return false;
      if (isAdmin && id === userId) return false; // المدير العام لا يرى نفسه
      return true;
    });
    if (isAdmin) return list;
    if (isDepartmentManager) {
      const ids = new Set(supervisedEmployeeIds || []);
      return list.filter(u => ids.has(u.user_id || u.id));
    }
    return list.filter(u => (u.user_id || u.id) === userId);
  }, [allUsers, isAdmin, isDepartmentManager, supervisedEmployeeIds, userId]);

  useEffect(() => {
    if (open) {
      setScope(initialScope);
      setSingleEmployee(employeeId || 'all');
      setMultiEmployeeIds([]);
      setSelectedAccountKeys([]);
      setDuesExpanded(false);
      setTabIndex(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialScope, employeeId]);

  // جلب حسابات المستخدم النشطة لعرضها في رأس التقرير
  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: toks } = await supabase
          .from('delivery_partner_tokens')
          .select('partner_name, account_username, normalized_username')
          .eq('user_id', userId)
          .eq('is_active', true);
        if (cancelled) return;
        const seen = new Set();
        const list = [];
        (toks || []).forEach(t => {
          const u = (t.account_username || t.normalized_username || '').trim();
          if (!u) return;
          const key = `${t.partner_name}::${u.toLowerCase()}`;
          if (seen.has(key)) return;
          seen.add(key);
          list.push({ partner: t.partner_name, account_username: u });
        });
        setActiveAccounts(list);
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [open, userId]);

  const handlePeriodChange = (p) => {
    setPeriod(p);
    if (p !== 'custom') setDateRange(computeRange(p));
  };

  useEffect(() => {
    if (!open || !dateRange?.from || !dateRange?.to || !userId) return;
    let cancelled = false;
    (async () => {
      setLoadingInvoices(true);
      setInvoicesError(null);
      try {
        const fromIso = new Date(dateRange.from); fromIso.setHours(0, 0, 0, 0);
        const toIso = new Date(dateRange.to); toIso.setHours(23, 59, 59, 999);

        let effectiveScope = scope;
        let pEmployee = null;
        let pEmployees = null;

        if (scope === 'all' && !isAdmin) effectiveScope = isDepartmentManager ? 'managed' : 'self';
        if (scope === 'managed' && !isAdmin && !isDepartmentManager) effectiveScope = 'self';

        if (effectiveScope === 'employee') {
          if (!singleEmployee || singleEmployee === 'all') {
            effectiveScope = isAdmin ? 'all' : (isDepartmentManager ? 'managed' : 'self');
          } else {
            pEmployee = singleEmployee;
          }
        }
        if (effectiveScope === 'employees') {
          if (!multiEmployeeIds || multiEmployeeIds.length === 0) {
            effectiveScope = isAdmin ? 'all' : (isDepartmentManager ? 'managed' : 'self');
          } else {
            pEmployees = multiEmployeeIds;
          }
        }

        const { data: invs, error } = await supabase.rpc('get_visible_invoices_for_report', {
          p_from: fromIso.toISOString(),
          p_to: toIso.toISOString(),
          p_scope: effectiveScope,
          p_employee: pEmployee,
          p_employees: pEmployees,
          p_account_keys: (effectiveScope === 'active_accounts' && selectedAccountKeys.length > 0) ? selectedAccountKeys : null,
        });
        if (error) throw error;
        if (cancelled) return;

        const list = invs || [];
        setInvoices(list);
        setSelectedIds(new Set(list.map(i => i.id)));
      } catch (e) {
        console.error('invoices report fetch error', e);
        if (!cancelled) {
          setInvoices([]);
          setSelectedIds(new Set());
          setInvoicesError(e?.message || 'تعذر جلب الفواتير');
        }
      } finally {
        if (!cancelled) setLoadingInvoices(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dateRange?.from?.getTime(), dateRange?.to?.getTime(), userId, isAdmin, isDepartmentManager, scope, singleEmployee, multiEmployeeIds.join(','), selectedAccountKeys.join(',')]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      if (selectedIds.size === 0) {
        setData({ orders: [], orderItems: [], profits: [], employeesWithRules: new Set(), namesMap: {} });
        setComputeError(null);
        return;
      }
      setComputing(true);
      setComputeError(null);
      try {
        const { data: rpc, error } = await supabase.rpc('get_invoice_profits_report', {
          p_invoice_ids: Array.from(selectedIds),
        });
        if (error) throw error;
        if (cancelled) return;
        setData({
          orders: rpc?.orders || [],
          orderItems: rpc?.orderItems || [],
          profits: rpc?.profits || [],
          employeesWithRules: new Set(rpc?.employeesWithRules || []),
          namesMap: rpc?.namesMap || {},
        });
      } catch (e) {
        console.error('report rpc error', e);
        if (!cancelled) setComputeError(e?.message || 'تعذر حساب الأرباح');
      } finally {
        if (!cancelled) setComputing(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, Array.from(selectedIds).sort().join(',')]);

  const calc = useMemo(() => computeInvoiceProfits(data), [data]);
  const fmt = (n) => `${Math.round(Number(n) || 0).toLocaleString()} د.ع`;

  const toggleAll = () => setSelectedIds(selectedIds.size === invoices.length ? new Set() : new Set(invoices.map(i => i.id)));
  const toggleOne = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const namesMap = data.namesMap;
  const ownerEntries = Object.entries(calc.byOwner)
    .map(([ownerId, stats]) => ({ ownerId, name: ownerId === '__system__' ? 'النظام' : (namesMap[ownerId] || 'مالك'), ...stats, netProfit: stats.revenue - stats.cost }))
    .sort((a, b) => b.netProfit - a.netProfit);
  // عدد الطلبات لكل موظف (مستخلص من profits)
  const employeeOrderCounts = useMemo(() => {
    const map = {};
    (data.profits || []).forEach(p => {
      if (!p.employee_id || !p.order_id) return;
      if (!map[p.employee_id]) map[p.employee_id] = new Set();
      map[p.employee_id].add(p.order_id);
    });
    const result = {};
    Object.entries(map).forEach(([k, v]) => { result[k] = v.size; });
    return result;
  }, [data.profits]);

  const employeeEntries = Object.entries(calc.employeeCombinedByEmp)
    .filter(([, v]) => Number(v) !== 0)
    .map(([empId, amount]) => ({ empId, name: namesMap[empId] || 'موظف', amount, bonus: calc.employeeBonusByEmp[empId] || 0, ordersCount: employeeOrderCounts[empId] || 0 }))
    .sort((a, b) => b.amount - a.amount);

  const goTab = (i) => setTabIndex(Math.max(0, Math.min(TABS.length - 1, i)));
  const toggleMultiEmployee = (id) => {
    setMultiEmployeeIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleAccountKey = (key) => {
    setSelectedAccountKeys(prev => prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key]);
  };

  const partnerLabel = (p) => (p === 'modon' ? 'مدن' : p === 'alwaseet' ? 'الوسيط' : p);
  const scopeLabel = (() => {
    switch (scope) {
      case 'active_accounts': {
        if (!activeAccounts.length) return 'حساباتي النشطة';
        const list = selectedAccountKeys.length
          ? activeAccounts.filter(a => selectedAccountKeys.includes(`${a.partner}::${a.account_username.toLowerCase()}`))
          : activeAccounts;
        return list.map(a => `${partnerLabel(a.partner)}: ${a.account_username}`).join(' • ');
      }
      case 'all': return 'كل الموظفين';
      case 'managed': return 'موظفيّ';
      case 'employee': {
        const u = selectableEmployees.find(x => (x.user_id || x.id) === singleEmployee);
        return u ? (u.full_name || u.username || 'موظف') : 'اختر موظفاً';
      }
      case 'employees': return multiEmployeeIds.length ? `${multiEmployeeIds.length} موظف محدد` : 'اختر عدة موظفين';
      default: return 'فواتيري';
    }
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] h-[90vh] sm:h-[85vh] overflow-hidden flex flex-col p-0 gap-0" dir="rtl">
        <div className="relative overflow-hidden flex-shrink-0">
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-purple-600 to-pink-500 opacity-95" />
          <DialogHeader className="relative px-5 pt-5 pb-3">
            <DialogTitle className="flex items-center gap-3 text-white">
              <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} className="p-2.5 rounded-2xl bg-white/20 backdrop-blur-md shadow-xl shadow-black/20">
                <FileText className="w-5 h-5" />
              </motion.div>
              <div className="flex flex-col items-start">
                <span className="font-bold text-lg drop-shadow-md">تقرير أرباح الفواتير</span>
                <span className="text-[11px] font-normal text-white/85 mt-0.5">{scopeLabel}</span>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="relative px-4 pb-2 flex gap-1.5 overflow-x-auto no-scrollbar">
            {PERIODS.map(p => (
              <button key={p.id} onClick={() => handlePeriodChange(p.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${period === p.id ? 'bg-white text-primary shadow-lg scale-105' : 'bg-white/15 text-white hover:bg-white/25'}`}>
                {p.label}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="relative px-4 pb-3">
              <DateRangePicker date={dateRange} onDateChange={setDateRange} />
            </div>
          )}

          {allowScopeSelection && (
            <div className="relative px-4 pb-3 flex flex-wrap items-center gap-1.5">
              <ScopeChip active={scope === 'active_accounts'} onClick={() => setScope('active_accounts')} icon={Building2}>حساباتي النشطة</ScopeChip>

              {scope === 'active_accounts' && activeAccounts.length > 1 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-white/95 text-primary shadow-md">
                      <Building2 className="w-3 h-3" />
                      {selectedAccountKeys.length === 0 ? `كل الحسابات (${activeAccounts.length})` : `${selectedAccountKeys.length}/${activeAccounts.length} حساب`}
                      <ChevronDown className="w-3 h-3 opacity-70" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 max-h-72 overflow-y-auto p-2" dir="rtl">
                    <div className="flex items-center justify-between mb-2 pb-2 border-b">
                      <span className="text-[11px] font-bold text-muted-foreground">اختر الحسابات</span>
                      <button onClick={() => setSelectedAccountKeys([])} className="text-[10px] text-primary font-bold hover:underline">
                        تحديد الكل
                      </button>
                    </div>
                    {activeAccounts.map(a => {
                      const key = `${a.partner}::${a.account_username.toLowerCase()}`;
                      const checked = selectedAccountKeys.length === 0 || selectedAccountKeys.includes(key);
                      return (
                        <label key={key} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm">
                          <Checkbox checked={checked} onCheckedChange={() => toggleAccountKey(key)} />
                          <span className="flex-1 truncate">{a.account_username}</span>
                          <Badge variant="outline" className="text-[10px] shrink-0">{partnerLabel(a.partner)}</Badge>
                        </label>
                      );
                    })}
                  </PopoverContent>
                </Popover>
              )}

              {(isAdmin || isDepartmentManager) && (
                <ScopeChip active={scope === (isAdmin ? 'all' : 'managed')} onClick={() => setScope(isAdmin ? 'all' : 'managed')} icon={Users}>
                  {isAdmin ? 'كل الموظفين' : 'موظفيّ'}
                </ScopeChip>
              )}
              <ScopeChip active={scope === 'employee'} onClick={() => setScope('employee')} icon={UserCheck}>موظف واحد</ScopeChip>
              <ScopeChip active={scope === 'employees'} onClick={() => setScope('employees')} icon={Users}>عدة موظفين</ScopeChip>

              {scope === 'employee' && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-white/95 text-primary shadow-md max-w-[200px] truncate">
                      <UserCheck className="w-3 h-3 shrink-0" />
                      <span className="truncate">
                        {(() => {
                          if (!singleEmployee || singleEmployee === 'all') return 'اختر موظفاً';
                          const u = selectableEmployees.find(x => (x.user_id || x.id) === singleEmployee);
                          return u ? (u.full_name || u.username || 'موظف') : 'اختر موظفاً';
                        })()}
                      </span>
                      <ChevronDown className="w-3 h-3 shrink-0 opacity-70" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-60 max-h-64 overflow-y-auto p-1.5" dir="rtl">
                    {selectableEmployees.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3">لا يوجد موظفون</p>
                    ) : selectableEmployees.map(u => {
                      const id = u.user_id || u.id;
                      const active = singleEmployee === id;
                      return (
                        <button key={id} onClick={() => setSingleEmployee(id)}
                          className={`w-full flex items-center gap-2 p-2 rounded text-sm text-right ${active ? 'bg-primary/15 text-primary font-bold' : 'hover:bg-muted/60'}`}>
                          {active && <Check className="w-3.5 h-3.5" />}
                          <span className="truncate flex-1">{u.full_name || u.username || 'موظف'}</span>
                        </button>
                      );
                    })}
                  </PopoverContent>
                </Popover>
              )}

              {scope === 'employees' && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-white/95 text-primary shadow-md">
                      <Users className="w-3 h-3" />
                      {multiEmployeeIds.length ? `${multiEmployeeIds.length} محدد` : 'اختر الموظفين'}
                      <ChevronDown className="w-3 h-3 opacity-70" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 max-h-64 overflow-y-auto p-2" dir="rtl">
                    {selectableEmployees.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3">لا يوجد موظفون</p>
                    ) : selectableEmployees.map(u => {
                      const id = u.user_id || u.id;
                      const checked = multiEmployeeIds.includes(id);
                      return (
                        <label key={id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm">
                          <Checkbox checked={checked} onCheckedChange={() => toggleMultiEmployee(id)} />
                          <span>{u.full_name || u.username || 'موظف'}</span>
                        </label>
                      );
                    })}
                  </PopoverContent>
                </Popover>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-3 pt-2 pb-1 border-b bg-background flex-shrink-0">
          <button onClick={() => goTab(tabIndex - 1)} disabled={tabIndex === 0} className="p-1 rounded-md hover:bg-muted disabled:opacity-30">
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="flex-1 flex justify-around">
            {TABS.map((t, i) => {
              const Icon = t.icon;
              const active = i === tabIndex;
              return (
                <button key={t.id} onClick={() => goTab(i)} className="relative px-2 py-1.5 flex flex-col items-center gap-0.5">
                  <Icon className={`w-4 h-4 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className={`text-[10px] font-medium ${active ? 'text-primary' : 'text-muted-foreground'}`}>{t.label}</span>
                  {active && <motion.div layoutId="tab-underline" className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary rounded-full" />}
                </button>
              );
            })}
          </div>
          <button onClick={() => goTab(tabIndex + 1)} disabled={tabIndex === TABS.length - 1} className="p-1 rounded-md hover:bg-muted disabled:opacity-30">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={tabIndex} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.2 }}
              drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.2}
              onDragEnd={(_, info) => { if (info.offset.x < -60) goTab(tabIndex + 1); else if (info.offset.x > 60) goTab(tabIndex - 1); }}>
              {tabIndex === 0 && (
                <div className="space-y-3">
                  {invoicesError && <ErrorRow message={invoicesError} />}
                  {computeError && <ErrorRow message={computeError} />}
                  {loadingInvoices || computing ? (
                    <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>
                  ) : invoices.length === 0 ? <EmptyHint /> : (
                    <>
                      <div className="grid grid-cols-2 gap-2.5">
                        <Stat icon={FileText} label="عدد الفواتير" sub={`${selectedIds.size}/${invoices.length} محدّد`} value={`${invoices.length}`} color="blue" />
                        <Stat icon={TrendingUp} label="إجمالي الإيراد" sub="بدون توصيل" value={fmt(calc.totalRevenue)} color="blue" />
                        <Stat icon={Package} label="إجمالي التكلفة" value={fmt(calc.totalCost)} color="orange" />
                        <Stat icon={Boxes} label="عدد القطع" sub={`${calc.productCount} منتج`} value={`${calc.totalQty}`} color="purple" />
                        <Stat icon={Wallet} label="صافي الربح" value={fmt(calc.totalProfit)} color="emerald" highlight />
                        <Stat icon={Crown} label="صافي للمالكين" value={fmt(calc.netForOwners)} color="emerald" />
                        <Stat icon={Users} label="مستحقات الموظفين" sub={`${Object.keys(calc.employeeCombinedByEmp || {}).filter(k => Number(calc.employeeCombinedByEmp[k]) !== 0).length} موظف`} value={fmt(calc.employeeTotalCombined)} color="purple" />
                      </div>
                      {Math.abs(calc.totalDelta) > 1 && (
                        <div className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border border-dashed text-xs ${calc.totalDelta > 0 ? 'text-emerald-600 bg-emerald-500/5 border-emerald-500/30' : 'text-orange-600 bg-orange-500/5 border-orange-500/30'}`}>
                          <TrendingUp className="w-4 h-4" />
                          <span>إجمالي {calc.totalDelta > 0 ? 'الزيادة' : 'الخصم'}: {fmt(Math.abs(calc.totalDelta))}</span>
                        </div>
                      )}
                      {calc.totalDelivery > 0 && (
                        <div className="flex items-center justify-center gap-2 p-2 rounded-lg bg-muted/30 border border-dashed text-xs text-muted-foreground">
                          <Truck className="w-4 h-4" />
                          <span>أجور التوصيل {fmt(calc.totalDelivery)} مستثناة</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {tabIndex === 1 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-muted-foreground">{selectedIds.size}/{invoices.length} محدّد</span>
                    <Button variant="outline" size="sm" onClick={toggleAll} disabled={!invoices.length} className="h-7 text-xs">
                      {selectedIds.size === invoices.length ? 'إلغاء الكل' : 'تحديد الكل'}
                    </Button>
                  </div>
                  {loadingInvoices ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
                    : invoicesError ? <ErrorRow message={invoicesError} />
                    : invoices.length === 0 ? <EmptyHint /> : (
                      <div className="space-y-1.5">
                        {invoices.map(inv => {
                          const selected = selectedIds.has(inv.id);
                          return (
                            <label key={inv.id} className={`flex items-center gap-2 p-2.5 rounded-lg cursor-pointer text-sm transition-all border ${selected ? 'bg-primary/10 border-primary/40' : 'bg-card hover:bg-muted/40 border-border'}`}>
                              <Checkbox checked={selected} onCheckedChange={() => toggleOne(inv.id)} />
                              <span className="font-mono text-xs font-bold">#{inv.external_id}</span>
                              <Badge variant="outline" className="text-[10px]">{inv.partner}</Badge>
                              {inv.account_username && <Badge className="text-[10px] bg-primary/15 text-primary border-primary/30">{inv.account_username}</Badge>}
                              <span className="text-muted-foreground text-[11px]">{inv.orders_count} طلب</span>
                              <span className="mr-auto font-bold text-emerald-600 text-xs">{fmt(inv.amount)}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                </div>
              )}

              {tabIndex === 2 && (
                computing ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                  : calc.productsList.length === 0 ? <EmptyHint text="لا توجد بيانات منتجات للفواتير المحددة" />
                  : (
                    <div className="space-y-1.5">
                      {calc.productsList.map((p, idx) => (
                        <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 gap-2 text-sm border border-border/50">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {idx === 0 && <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                            <Package className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span className="font-medium truncate">{p.name}</span>
                            <Badge variant="outline" className="text-[10px] shrink-0">×{p.qty}</Badge>
                          </div>
                          <div className="text-left shrink-0">
                            <div className="font-bold text-blue-600 text-xs">{fmt(p.revenue)}</div>
                            <div className="text-[10px] text-emerald-600">ربح {fmt(p.revenue - p.cost)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
              )}

              {tabIndex === 3 && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-bold mb-2 flex items-center gap-2"><Crown className="w-4 h-4 text-amber-500" /> المالكون</h4>
                    {ownerEntries.length === 0 ? <EmptyHint text="لا توجد بيانات توزيع" small /> : (
                      <div className="space-y-1.5">
                        {ownerEntries.map(o => (
                          <div key={o.ownerId} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 text-sm border border-border/50">
                            <div className="flex items-center gap-2">
                              <Crown className="w-3.5 h-3.5 text-amber-500" />
                              <span className="font-medium">{o.name}</span>
                              <Badge variant="outline" className="text-[10px]">{o.items} قطعة</Badge>
                            </div>
                            <div className="text-left">
                              <div className="font-bold text-emerald-600 text-xs">{fmt(o.netProfit)}</div>
                              <div className="text-[10px] text-muted-foreground">إيراد {fmt(o.revenue)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold mb-2 flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> الموظفون</h4>
                    {employeeEntries.length === 0 ? <EmptyHint text="لا توجد مستحقات للموظفين" small /> : (
                      <div className="space-y-1.5">
                        {employeeEntries.map(e => (
                          <div key={e.empId} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 text-sm border border-border/50">
                            <div className="flex flex-col">
                              <span className="font-medium">{e.name}</span>
                              {e.bonus !== 0 && <span className="text-[10px] text-amber-600">+ {fmt(e.bonus)} زيادة/خصم</span>}
                            </div>
                            <Badge variant="secondary" className="text-emerald-600 bg-emerald-500/10 font-bold">{fmt(e.amount)}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Stat = ({ icon: Icon, label, sub, value, color = 'blue', highlight = false }) => {
  const map = {
    blue: 'from-blue-500/15 to-blue-500/5 border-blue-500/30 text-blue-600',
    orange: 'from-orange-500/15 to-orange-500/5 border-orange-500/30 text-orange-600',
    emerald: 'from-emerald-500/15 to-emerald-500/5 border-emerald-500/30 text-emerald-600',
    purple: 'from-purple-500/15 to-purple-500/5 border-purple-500/30 text-purple-600',
  };
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className={`bg-gradient-to-br ${map[color]} backdrop-blur-sm ${highlight ? 'ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-500/10' : ''}`}>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Icon className="w-4 h-4" />
            <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
          </div>
          <div className="text-lg font-bold">{value}</div>
          {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
        </CardContent>
      </Card>
    </motion.div>
  );
};

const ScopeChip = ({ active, onClick, icon: Icon, children }) => (
  <button onClick={onClick}
    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${active ? 'bg-white text-primary shadow-md scale-105' : 'bg-white/15 text-white hover:bg-white/25'}`}>
    <Icon className="w-3 h-3" />
    {children}
  </button>
);

const ErrorRow = ({ message }) => (
  <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
    <AlertCircle className="w-4 h-4 shrink-0" />
    <span className="font-medium">{message}</span>
  </div>
);

const EmptyHint = ({ text = 'لا توجد فواتير في هذه الفترة', small = false }) => (
  <div className={`flex flex-col items-center justify-center text-center text-muted-foreground gap-2 ${small ? 'py-4' : 'py-12'}`}>
    <FileText className={`${small ? 'w-6 h-6' : 'w-10 h-10'} opacity-40`} />
    <p className={small ? 'text-xs' : 'text-sm'}>{text}</p>
  </div>
);

export default InvoicesProfitReportDialog;
