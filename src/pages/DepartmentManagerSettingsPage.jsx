import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useUnifiedPermissionsSystem as usePermissions } from '@/hooks/useUnifiedPermissionsSystem.jsx';
import { useInventory } from '@/contexts/InventoryContext';
import { useSupervisedEmployees } from '@/hooks/useSupervisedEmployees';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import DepartmentStatsCharts from '@/components/department/DepartmentStatsCharts';
import ProductPermissionsManager from '@/components/manage-employees/ProductPermissionsManager';
import UnifiedEmployeeDialog from '@/components/manage-employees/UnifiedEmployeeDialog';
import { Switch } from '@/components/ui/switch';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Users, 
  DollarSign, 
  Package, 
  BarChart3, 
  Plus,
  Trash2,
  Save,
  User,
  TrendingUp,
  Shield,
  Edit2,
  Eye,
  Search,
  Send,
  Hash,
  Store,
  ExternalLink,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const DepartmentManagerSettingsPage = () => {
  const { user } = useAuth();
  const { isAdmin, isDepartmentManager, productPermissions: managerOwnPermissions } = usePermissions();
  const { products: allSystemProducts } = useInventory();
  // filterProductsByPermissions removed - now using employee_allowed_products directly
  const { supervisedEmployees, supervisedEmployeeIds, loading: supervisedLoading } = useSupervisedEmployees();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('employees');
  const [profitRules, setProfitRules] = useState([]);
  const [newRule, setNewRule] = useState({
    employee_id: '',
    product_id: '',
    profit_amount: 0,
    profit_type: 'fixed',
    full_profit: false
  });
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalSales: 0,
    totalProfit: 0
  });
  // Employee management state
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeStats, setEmployeeStats] = useState({});
  const [employeeViewMode, setEmployeeViewMode] = useState('grid');
  const [employeeStatusFilter, setEmployeeStatusFilter] = useState('all');
  // Product permissions state
  const [selectedPermEmployee, setSelectedPermEmployee] = useState('');
  const [allowedProducts, setAllowedProducts] = useState([]);
  const [permLoading, setPermLoading] = useState(false);
  const [departments, setDepartments] = useState([]);

  // جلب إحصائيات الموظفين
  useEffect(() => {
    const fetchEmployeeStats = async () => {
      if (!supervisedEmployeeIds || supervisedEmployeeIds.length === 0) return;
      const statsMap = {};
      for (const empId of supervisedEmployeeIds) {
        const { count: ordersCount } = await supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('created_by', empId)
          .in('status', ['delivered', 'completed']);
        
        const { data: profitData } = await supabase
          .from('profits')
          .select('employee_profit')
          .eq('employee_id', empId)
          .in('status', ['invoice_received', 'settlement_requested', 'settled']);
        
        const totalProfit = (profitData || []).reduce((sum, p) => sum + (p.employee_profit || 0), 0);
        
        statsMap[empId] = {
          ordersCount: ordersCount || 0,
          totalProfit
        };
      }
      setEmployeeStats(statsMap);
    };
    fetchEmployeeStats();
  }, [supervisedEmployeeIds]);

  // فلترة الموظفين حسب البحث والحالة
  const filteredSupervisedEmployees = useMemo(() => {
    return supervisedEmployees.filter(emp => {
      if (!emp) return false;
      const search = employeeSearch.toLowerCase();
      const searchMatch = !search || 
        (emp.full_name?.toLowerCase() || '').includes(search) ||
        (emp.employee_code?.toLowerCase() || '').includes(search) ||
        (emp.email?.toLowerCase() || '').includes(search) ||
        (emp.username?.toLowerCase() || '').includes(search);
      const statusMatch = employeeStatusFilter === 'all' || emp.status === employeeStatusFilter;
      return searchMatch && statusMatch;
    });
  }, [supervisedEmployees, employeeSearch, employeeStatusFilter]);

  // تبديل صلاحية المتجر
  const handleToggleStorefront = async (employeeId, currentValue) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ has_storefront_access: !currentValue })
        .eq('user_id', employeeId);
      if (error) throw error;
      toast({ title: !currentValue ? 'تم تفعيل المتجر' : 'تم تعطيل المتجر' });
    } catch (err) {
      toast({ title: 'خطأ', description: 'فشل تحديث صلاحية المتجر', variant: 'destructive' });
    }
  };

  // جلب المنتجات والأقسام - يستخدم employee_allowed_products للمنتجات المصرح بها
  useEffect(() => {
    const fetchProducts = async () => {
      const userIds = new Set([user?.id, user?.user_id].filter(Boolean));
      const userId = user?.id;
      
      // 1. منتجات يملكها مدير القسم مالياً
      const ownedProducts = (allSystemProducts || []).filter(p => 
        p.is_active !== false && p.owner_user_id && userIds.has(p.owner_user_id)
      );
      
      // 2. منتجات النظام المصرح بها عبر employee_allowed_products (مصدر الحقيقة)
      let allowedSystemProducts = [];
      if (userId) {
        const { data: allowedData } = await supabase
          .from('employee_allowed_products')
          .select('product_id')
          .eq('employee_id', userId)
          .eq('is_active', true);
        
        if (allowedData?.length > 0) {
          const allowedIds = new Set(allowedData.map(d => d.product_id));
          allowedSystemProducts = (allSystemProducts || []).filter(p => 
            p.is_active !== false && !p.owner_user_id && allowedIds.has(p.id)
          );
        }
      }
      
      // 3. دمج بدون تكرار مع تمييز المصدر
      const mergedMap = new Map();
      ownedProducts.forEach(p => mergedMap.set(p.id, { ...p, _source: 'owned' }));
      allowedSystemProducts.forEach(p => {
        if (!mergedMap.has(p.id)) {
          mergedMap.set(p.id, { ...p, _source: 'system_allowed' });
        }
      });
      
      if (mergedMap.size > 0) {
        setProducts(Array.from(mergedMap.values()));
      }
    };
    const fetchDepartments = async () => {
      const { data } = await supabase
        .from('departments')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (data) setDepartments(data);
    };
    fetchProducts();
    fetchDepartments();
  }, [user, supervisedEmployeeIds, allSystemProducts]);

  // جلب قواعد الأرباح للموظفين تحت الإشراف + Realtime
  const fetchProfitRules = React.useCallback(async () => {
    if (!isDepartmentManager || supervisedEmployeeIds.length === 0) {
      console.log('⚠️ [ProfitRules] تخطي الجلب:', { isDepartmentManager, supervisedCount: supervisedEmployeeIds.length });
      setProfitRules([]);
      return;
    }
    
    console.log('🔄 [ProfitRules] جلب القواعد لـ', supervisedEmployeeIds.length, 'موظف:', supervisedEmployeeIds);
    
    // ✅ جلب منفصل (لا يوجد FK بين employee_profit_rules.employee_id و profiles.user_id)
    const { data, error } = await supabase
      .from('employee_profit_rules')
      .select('*')
      .in('employee_id', supervisedEmployeeIds)
      .eq('is_active', true);
    
    if (error) {
      console.error('❌ [ProfitRules] خطأ في الجلب:', error);
      return;
    }
    
    console.log('✅ [ProfitRules] تم جلب', data?.length || 0, 'قاعدة');
    
    if (data) {
      // جلب الموظفين منفصلاً
      const { data: employees } = await supabase
        .from('profiles')
        .select('user_id, full_name, employee_code')
        .in('user_id', supervisedEmployeeIds);
      const employeesMap = {};
      employees?.forEach(e => { employeesMap[e.user_id] = e; });

      const productTargetIds = data
        .filter(r => r.rule_type === 'product' && r.target_id && r.target_id !== 'default')
        .map(r => r.target_id);
      
      let productsMap = {};
      if (productTargetIds.length > 0) {
        const { data: productsData } = await supabase
          .from('products')
          .select('id, name')
          .in('id', productTargetIds);
        productsData?.forEach(p => { productsMap[p.id] = p; });
      }
      
      const managerUUID = user?.user_id || user?.id;
      const enrichedRules = data.map(r => ({
        ...r,
        employee: employeesMap[r.employee_id] || null,
        product: productsMap[r.target_id] || null,
        // ✅ القاعدة من مدير القسم نفسه؟ (قابلة للتعديل/الحذف)
        is_own_rule: !!managerUUID && r.created_by === managerUUID
      }));
      
      setProfitRules(enrichedRules);
    }
  }, [isDepartmentManager, supervisedEmployeeIds, user]);
  
  useEffect(() => {
    fetchProfitRules();
  }, [fetchProfitRules]);
  
  // 🔄 Realtime: تحديث القواعد فور أي تغيير
  useEffect(() => {
    if (!isDepartmentManager || supervisedEmployeeIds.length === 0) return;
    const channel = supabase
      .channel('dept-mgr-profit-rules')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_profit_rules' }, (payload) => {
        const row = payload.new || payload.old;
        if (row?.employee_id && supervisedEmployeeIds.includes(row.employee_id)) {
          console.log('🔄 [ProfitRules Realtime] تغيير مكتشف، إعادة الجلب');
          fetchProfitRules();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isDepartmentManager, supervisedEmployeeIds, fetchProfitRules]);

  // جلب إحصائيات القسم
  useEffect(() => {
    const fetchStats = async () => {
      if (!isDepartmentManager || supervisedEmployeeIds.length === 0) return;
      
      // ✅ فقط الموظفين المشرف عليهم (بدون مدير القسم نفسه)
      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, final_amount, delivery_fee, created_by, delivery_status')
        .in('created_by', supervisedEmployeeIds)
        .eq('delivery_status', '4'); // ✅ الطلبات المسلمة فعلياً
      
      if (!error && orders) {
        const totalOrders = orders.length;
        const totalSales = orders.reduce((sum, o) => sum + ((o.final_amount || 0) - (o.delivery_fee || 0)), 0);
        
        setStats({
          totalOrders,
          totalSales,
          totalProfit: 0 // سيتم حسابه من جدول الأرباح
        });
      }
    };
    fetchStats();
  }, [isDepartmentManager, supervisedEmployeeIds, user?.id]);

  // إضافة قاعدة ربح جديدة
  const handleAddProfitRule = async () => {
    if (!newRule.employee_id || (!newRule.full_profit && newRule.profit_amount <= 0)) {
      toast({ title: 'خطأ', description: 'الرجاء ملء جميع الحقول المطلوبة', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const ruleType = newRule.product_id ? 'product' : 'default';
      const targetId = newRule.product_id || null;
      const profitAmount = newRule.full_profit ? 0 : newRule.profit_amount;
      const profitPercentage = newRule.full_profit ? 100 : null;

      // للقواعد بدون منتج محدد (default): فحص يدوي ثم update/insert
      // لأن NULL != NULL في UNIQUE constraints بـ PostgreSQL
      // ملاحظة: بعض القواعد القديمة تستخدم target_id='default' بدلاً من null
      if (!targetId) {
        // فحص كلا الحالتين: target_id IS NULL أو target_id = 'default'
        const { data: existingNull } = await supabase
          .from('employee_profit_rules')
          .select('id')
          .eq('employee_id', newRule.employee_id)
          .eq('rule_type', 'default')
          .is('target_id', null)
          .eq('is_active', true)
          .maybeSingle();

        const { data: existingDefault } = await supabase
          .from('employee_profit_rules')
          .select('id')
          .eq('employee_id', newRule.employee_id)
          .eq('rule_type', 'default')
          .eq('target_id', 'default')
          .eq('is_active', true)
          .maybeSingle();

        const existing = existingNull || existingDefault;

        if (existing) {
          const { error } = await supabase
            .from('employee_profit_rules')
            .update({ profit_amount: profitAmount, profit_percentage: profitPercentage, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('employee_profit_rules')
            .insert({ employee_id: newRule.employee_id, target_id: null, rule_type: 'default', profit_amount: profitAmount, profit_percentage: profitPercentage, created_by: user?.id, is_active: true });
          if (error) throw error;
        }
      } else {
        // للقواعد مع منتج محدد: upsert يعمل بشكل طبيعي
        const { error } = await supabase
          .from('employee_profit_rules')
          .upsert({
            employee_id: newRule.employee_id, target_id: targetId, rule_type: ruleType,
            profit_amount: profitAmount, profit_percentage: profitPercentage,
            created_by: user?.id, is_active: true
          }, { onConflict: 'employee_id,rule_type,target_id' });
        if (error) throw error;
      }

      toast({ title: 'تم بنجاح', description: newRule.full_profit ? 'تمت إضافة قاعدة كامل الربح' : 'تمت إضافة قاعدة الربح' });
      setNewRule({ employee_id: '', product_id: '', profit_amount: 0, profit_type: 'fixed', full_profit: false });
      
      // إعادة جلب القواعد فوراً (جلب منفصل بدون JOIN)
      const { data } = await supabase
        .from('employee_profit_rules')
        .select('*')
        .in('employee_id', supervisedEmployeeIds);
      
      if (data) {
        const { data: employees } = await supabase
          .from('profiles')
          .select('user_id, full_name, employee_code')
          .in('user_id', supervisedEmployeeIds);
        const employeesMap = {};
        employees?.forEach(e => { employeesMap[e.user_id] = e; });

        const productTargetIds = data
          .filter(r => r.rule_type === 'product' && r.target_id && r.target_id !== 'default')
          .map(r => r.target_id);
        let productsMap = {};
        if (productTargetIds.length > 0) {
          const { data: productsData } = await supabase
            .from('products')
            .select('id, name')
            .in('id', productTargetIds);
          productsData?.forEach(p => { productsMap[p.id] = p; });
        }
        const managerUUID = user?.user_id || user?.id;
        setProfitRules(data.map(r => ({
          ...r,
          employee: employeesMap[r.employee_id] || null,
          product: productsMap[r.target_id] || null,
          is_own_rule: !!managerUUID && r.created_by === managerUUID
        })));
      }
    } catch (error) {
      console.error('❌ خطأ في حفظ قاعدة الربح:', error);
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // حذف قاعدة ربح
  const handleDeleteRule = async (ruleId) => {
    const { error } = await supabase
      .from('employee_profit_rules')
      .delete()
      .eq('id', ruleId);

    if (!error) {
      setProfitRules(prev => prev.filter(r => r.id !== ruleId));
      toast({ title: 'تم الحذف', description: 'تم حذف قاعدة الربح' });
    }
  };

  // جلب صلاحيات المنتجات للموظف المحدد
  useEffect(() => {
    const fetchAllowedProducts = async () => {
      if (!selectedPermEmployee) { setAllowedProducts([]); return; }
      setPermLoading(true);
      const { data, error } = await supabase
        .from('employee_allowed_products')
        .select('product_id')
        .eq('employee_id', selectedPermEmployee)
        .eq('is_active', true);
      if (!error && data) {
        setAllowedProducts(data.map(d => d.product_id));
      }
      setPermLoading(false);
    };
    fetchAllowedProducts();
  }, [selectedPermEmployee]);

  // تبديل صلاحية منتج
  const toggleProductPermission = async (productId) => {
    const isAllowed = allowedProducts.includes(productId);
    if (isAllowed) {
      // إزالة
      const { error } = await supabase
        .from('employee_allowed_products')
        .delete()
        .eq('employee_id', selectedPermEmployee)
        .eq('product_id', productId);
      if (!error) setAllowedProducts(prev => prev.filter(id => id !== productId));
    } else {
      // إضافة
      const { error } = await supabase
        .from('employee_allowed_products')
        .insert({
          employee_id: selectedPermEmployee,
          product_id: productId,
          added_by: user?.id,
          is_active: true
        });
      if (!error) setAllowedProducts(prev => [...prev, productId]);
      else toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    }
  };

  // تبديل كل منتجات قسم
  const toggleDepartmentProducts = async (departmentId) => {
    const deptProducts = products.filter(p => p.department_id === departmentId);
    const deptProductIds = deptProducts.map(p => p.id);
    const allAllowed = deptProductIds.every(id => allowedProducts.includes(id));
    
    if (allAllowed) {
      // إزالة كل منتجات القسم
      const { error } = await supabase
        .from('employee_allowed_products')
        .delete()
        .eq('employee_id', selectedPermEmployee)
        .in('product_id', deptProductIds);
      if (!error) setAllowedProducts(prev => prev.filter(id => !deptProductIds.includes(id)));
    } else {
      // إضافة كل منتجات القسم غير الموجودة
      const toAdd = deptProductIds.filter(id => !allowedProducts.includes(id));
      if (toAdd.length > 0) {
        const { error } = await supabase
          .from('employee_allowed_products')
          .insert(toAdd.map(pid => ({
            employee_id: selectedPermEmployee,
            product_id: pid,
            added_by: user?.id,
            is_active: true
          })));
        if (!error) setAllowedProducts(prev => [...prev, ...toAdd]);
        else toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
      }
    }
  };

  // التحقق من الصلاحيات
  if (!isDepartmentManager && !isAdmin) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">ليس لديك صلاحية الوصول لهذه الصفحة</p>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>إعدادات مدير القسم | RYUS</title>
      </Helmet>

      <div className="space-y-6 p-4">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent mb-2">
            إعدادات مدير القسم
          </h1>
          <p className="text-muted-foreground">
            إدارة الموظفين وقواعد الأرباح والإحصائيات
          </p>
        </div>

        {/* إحصائيات سريعة */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-500 to-cyan-400 text-white">
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-80" />
              <p className="text-2xl font-bold">{supervisedEmployees.length}</p>
              <p className="text-sm opacity-80">الموظفين</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-500 to-emerald-400 text-white">
            <CardContent className="p-4 text-center">
              <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-80" />
              <p className="text-2xl font-bold">{stats.totalOrders}</p>
              <p className="text-sm opacity-80">الطلبات</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-500 to-violet-400 text-white">
            <CardContent className="p-4 text-center">
              <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-80" />
              <p className="text-2xl font-bold">{(stats.totalSales / 1000).toFixed(1)}K</p>
              <p className="text-sm opacity-80">المبيعات</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-orange-500 to-amber-400 text-white">
            <CardContent className="p-4 text-center">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-80" />
              <p className="text-2xl font-bold">{profitRules.length}</p>
              <p className="text-sm opacity-80">قواعد الأرباح</p>
            </CardContent>
          </Card>
        </div>

        {/* التبويبات */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="employees" className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">الموظفين</span>
            </TabsTrigger>
            <TabsTrigger value="profits" className="flex items-center gap-1">
              <DollarSign className="w-4 h-4" />
              <span className="hidden sm:inline">قواعد الأرباح</span>
            </TabsTrigger>
            <TabsTrigger value="permissions" className="flex items-center gap-1">
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">صلاحيات المنتجات</span>
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-1">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">الإحصائيات</span>
            </TabsTrigger>
          </TabsList>

          {/* تبويب الموظفين - نسخة كاملة مثل المدير */}
          <TabsContent value="employees">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  إدارة الموظفين
                </CardTitle>
                <CardDescription>
                  إدارة شاملة للموظفين تحت إشرافك - تعديل البيانات والصلاحيات والتليغرام
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* فلاتر وأدوات بحث */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4">
                  <div className="relative lg:col-span-2">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="بحث بالاسم أو الكود أو البريد..."
                      value={employeeSearch}
                      onChange={(e) => setEmployeeSearch(e.target.value)}
                      className="pr-9"
                      dir="rtl"
                    />
                  </div>
                  <Select value={employeeStatusFilter} onValueChange={setEmployeeStatusFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الحالات</SelectItem>
                      <SelectItem value="active">نشط</SelectItem>
                      <SelectItem value="pending">قيد المراجعة</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2">
                    <Button variant={employeeViewMode === 'grid' ? 'default' : 'outline'} size="sm" onClick={() => setEmployeeViewMode('grid')} className="flex-1">
                      <LayoutGrid className="w-4 h-4 ml-1" /> بطاقات
                    </Button>
                    <Button variant={employeeViewMode === 'table' ? 'default' : 'outline'} size="sm" onClick={() => setEmployeeViewMode('table')} className="flex-1">
                      <List className="w-4 h-4 ml-1" /> جدول
                    </Button>
                    <Badge variant="secondary">{filteredSupervisedEmployees.length} موظف</Badge>
                  </div>
                </div>

                {supervisedLoading ? (
                  <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
                ) : filteredSupervisedEmployees.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <User className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p>لا يوجد موظفين مطابقين</p>
                  </div>
                ) : employeeViewMode === 'grid' ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredSupervisedEmployees.map((emp, index) => {
                      const empStats = employeeStats[emp?.user_id] || {};
                      return (
                        <motion.div key={emp?.user_id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: index * 0.05 }}>
                          <Card className="group border-2 hover:border-primary/30 hover:shadow-xl transition-all duration-300">
                            <CardContent className="p-5">
                              {/* Header */}
                              <div className="flex items-start gap-3 mb-4">
                                <div className="relative">
                                  <Avatar className="w-14 h-14 border-2 border-primary/20">
                                    <AvatarImage src={emp?.avatar_url} />
                                    <AvatarFallback className="bg-gradient-to-br from-primary to-purple-600 text-primary-foreground font-bold text-lg">
                                      {emp?.full_name?.charAt(0) || 'م'}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-card ${emp?.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-lg truncate group-hover:text-primary transition-colors">{emp?.full_name || 'موظف'}</p>
                                  <p className="text-sm text-muted-foreground">@{emp?.username || '-'}</p>
                                  <Badge variant="outline" className="mt-1 text-xs">{emp?.roles?.[0] === 'sales_employee' ? 'مبيعات' : emp?.roles?.[0] === 'warehouse_employee' ? 'مخزن' : emp?.roles?.[0] === 'cashier' ? 'كاشير' : 'موظف'}</Badge>
                                </div>
                              </div>

                              {/* Info Grid */}
                              <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                                <div className="flex items-center gap-2 p-2 bg-secondary/20 rounded-md">
                                  <Hash className="w-4 h-4 text-primary flex-shrink-0" />
                                  <span className="truncate font-mono text-xs">{emp?.employee_code || <span className="text-muted-foreground italic">غير محدد</span>}</span>
                                </div>
                                <div className={`flex items-center gap-2 p-2 rounded-md border ${emp?.telegram_linked ? 'bg-green-50 dark:bg-green-950/30 border-green-200/30' : 'bg-gray-50 dark:bg-gray-950/30 border-gray-200/30'}`}>
                                  <Send className={`w-4 h-4 ${emp?.telegram_linked ? 'text-green-600' : 'text-gray-400'}`} />
                                  <div className="flex-1 min-w-0">
                                    {emp?.telegram_code ? (
                                      <div className="flex items-center gap-1">
                                        <span className="font-mono text-xs font-semibold">{emp.telegram_code}</span>
                                        <Badge variant={emp.telegram_linked ? "success" : "outline"} className={`text-[10px] px-1 py-0 ${emp.telegram_linked ? 'bg-green-500 text-white' : ''}`}>
                                          {emp.telegram_linked ? 'متصل' : 'غير متصل'}
                                        </Badge>
                                      </div>
                                    ) : (
                                      <span className="text-xs text-muted-foreground italic">لم يُضف</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* إحصائيات */}
                              <div className="grid grid-cols-2 gap-2 mb-3 text-center">
                                <div className="bg-muted/50 rounded p-2">
                                  <p className="text-lg font-bold">{empStats.ordersCount || 0}</p>
                                  <p className="text-xs text-muted-foreground">طلبات</p>
                                </div>
                                <div className="bg-muted/50 rounded p-2">
                                  <p className="text-lg font-bold text-green-600">{((empStats.totalProfit || 0) / 1000).toFixed(1)}K</p>
                                  <p className="text-xs text-muted-foreground">أرباح</p>
                                </div>
                              </div>

                              {/* Storefront Controls */}
                              {emp?.status === 'active' && (
                                <div className="mb-3 p-2 bg-gradient-to-r from-purple-50/50 to-blue-50/50 dark:from-purple-950/20 dark:to-blue-950/20 rounded-lg border border-purple-200/30 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <Store className="w-3.5 h-3.5 text-purple-600" />
                                      <span className="text-xs font-medium">المتجر</span>
                                    </div>
                                    <Switch
                                      checked={emp?.has_storefront_access || false}
                                      onCheckedChange={() => handleToggleStorefront(emp.user_id, emp.has_storefront_access)}
                                    />
                                  </div>
                                </div>
                              )}

                              {/* أزرار */}
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm" className="flex-1" onClick={() => { setEditingEmployee(emp); setIsEditModalOpen(true); }}>
                                  <Edit2 className="w-3 h-3 ml-1" /> تعديل
                                </Button>
                                <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate(`/profile/${emp?.username || emp?.user_id}`)}>
                                  <Eye className="w-3 h-3 ml-1" /> الملف
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  /* Table View */
                  <Card>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-secondary/50">
                            <tr>
                              <th className="text-right p-3 font-semibold text-sm">الموظف</th>
                              <th className="text-right p-3 font-semibold text-sm">الكود</th>
                              <th className="text-right p-3 font-semibold text-sm">التليغرام</th>
                              <th className="text-right p-3 font-semibold text-sm">الحالة</th>
                              <th className="text-right p-3 font-semibold text-sm">الطلبات</th>
                              <th className="text-center p-3 font-semibold text-sm">إجراءات</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredSupervisedEmployees.map((emp) => {
                              const empStats = employeeStats[emp?.user_id] || {};
                              return (
                                <tr key={emp?.user_id} className="border-b hover:bg-secondary/20">
                                  <td className="p-3">
                                    <div className="flex items-center gap-2">
                                      <Avatar className="w-8 h-8">
                                        <AvatarFallback className="bg-primary text-primary-foreground text-xs">{emp?.full_name?.charAt(0)}</AvatarFallback>
                                      </Avatar>
                                      <div>
                                        <p className="font-medium text-sm">{emp?.full_name}</p>
                                        <p className="text-xs text-muted-foreground">@{emp?.username}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-3 text-sm font-mono">{emp?.employee_code || '-'}</td>
                                  <td className="p-3 text-sm">
                                    {emp?.telegram_code ? (
                                      <Badge variant={emp.telegram_linked ? "default" : "outline"} className="text-xs">
                                        {emp.telegram_code} {emp.telegram_linked ? '✓' : ''}
                                      </Badge>
                                    ) : '-'}
                                  </td>
                                  <td className="p-3">
                                    <div className={`w-2 h-2 rounded-full inline-block ml-1 ${emp?.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                                    <span className="text-sm">{emp?.status === 'active' ? 'نشط' : 'معلق'}</span>
                                  </td>
                                  <td className="p-3 text-sm font-medium">{empStats.ordersCount || 0}</td>
                                  <td className="p-3 text-center">
                                    <div className="flex justify-center gap-1">
                                      <Button variant="ghost" size="sm" onClick={() => { setEditingEmployee(emp); setIsEditModalOpen(true); }}>
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </Button>
                                      <Button variant="ghost" size="sm" onClick={() => navigate(`/profile/${emp?.username || emp?.user_id}`)}>
                                        <Eye className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
            
            {/* حوار تعديل الموظف */}
            {editingEmployee && (
              <UnifiedEmployeeDialog
                employee={editingEmployee}
                open={isEditModalOpen}
                onOpenChange={(val) => {
                  setIsEditModalOpen(val);
                  if (!val) setEditingEmployee(null);
                }}
              />
            )}
          </TabsContent>

          {/* تبويب قواعد الأرباح */}
          <TabsContent value="profits">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  قواعد الأرباح
                </CardTitle>
                <CardDescription>
                  تحديد نسب الأرباح لكل موظف تحت إشرافك
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* نموذج إضافة قاعدة جديدة */}
                <div className="p-4 border-2 border-dashed rounded-lg space-y-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    إضافة قاعدة ربح جديدة
                  </h4>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                    <div>
                      <Label>الموظف</Label>
                      <Select 
                        value={newRule.employee_id} 
                        onValueChange={(v) => setNewRule(prev => ({ ...prev, employee_id: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="اختر الموظف" />
                        </SelectTrigger>
                        <SelectContent>
                          {supervisedEmployees.filter(emp => emp?.user_id).map((emp) => (
                            <SelectItem key={emp.user_id} value={emp.user_id}>
                              {emp.full_name || emp.employee_code || 'موظف'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>المنتج (اختياري)</Label>
                      <Select 
                        value={newRule.product_id} 
                        onValueChange={(v) => setNewRule(prev => ({ ...prev, product_id: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="كل المنتجات" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">كل المنتجات</SelectItem>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} {p._source === 'owned' ? '🏷️' : '🔓'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>مبلغ الربح (د.ع)</Label>
                      <Input 
                        type="number"
                        value={newRule.profit_amount}
                        onChange={(e) => setNewRule(prev => ({ ...prev, profit_amount: Number(e.target.value) }))}
                        placeholder="1000"
                        disabled={newRule.full_profit}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={newRule.full_profit}
                          onCheckedChange={(checked) => setNewRule(prev => ({ ...prev, full_profit: checked, profit_amount: checked ? 0 : prev.profit_amount }))}
                        />
                        <Label className="text-sm">كامل الربح</Label>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {newRule.full_profit ? 'الموظف يحصل على كامل ربح المنتج (سعر البيع - التكلفة)' : 'مبلغ ثابت لكل وحدة'}
                      </p>
                    </div>
                    <div className="flex items-end">
                      <Button 
                        onClick={handleAddProfitRule} 
                        disabled={loading}
                        className="w-full"
                      >
                        <Save className="w-4 h-4 ml-2" />
                        حفظ
                      </Button>
                    </div>
                  </div>
                </div>

                {/* قائمة القواعد الحالية */}
                <div className="space-y-3">
                  <h4 className="font-semibold">القواعد الحالية</h4>
                  {profitRules.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">لا توجد قواعد أرباح محددة</p>
                  ) : (
                    profitRules.map((rule) => (
                      <div 
                        key={rule.id} 
                        className={`flex items-center justify-between p-4 border rounded-lg ${rule.is_own_rule ? 'bg-card' : 'bg-muted/40 border-dashed'}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${rule.is_own_rule ? 'bg-gradient-to-br from-green-500 to-emerald-400' : 'bg-gradient-to-br from-slate-400 to-slate-500'}`}>
                            <DollarSign className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold">{rule.employee?.full_name || 'موظف'}</p>
                              {!rule.is_own_rule && (
                                <Badge variant="secondary" className="text-[10px] gap-1">
                                  <Shield className="w-3 h-3" />
                                  من المدير العام
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {rule.product?.name || 'كل المنتجات'} - {rule.profit_percentage === 100 
                                ? <Badge className="bg-emerald-500 text-white">كامل الربح</Badge>
                                : `${rule.profit_amount?.toLocaleString()} د.ع`}
                            </p>
                          </div>
                        </div>
                        {rule.is_own_rule ? (
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleDeleteRule(rule.id)}
                            title="حذف القاعدة"
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-xs">
                            <Eye className="w-3 h-3" />
                            للقراءة فقط
                          </Badge>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* تبويب صلاحيات المنتجات - نظام كامل مثل المدير */}
          <TabsContent value="permissions">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  صلاحيات المنتجات
                </CardTitle>
                <CardDescription>
                  التحكم الكامل بالمنتجات والأقسام والأصناف والألوان والقياسات لكل موظف
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* اختيار الموظف */}
                <div>
                  <Label>اختر الموظف</Label>
                  <Select value={selectedPermEmployee} onValueChange={setSelectedPermEmployee}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر موظف لإدارة صلاحياته" />
                    </SelectTrigger>
                    <SelectContent>
                      {supervisedEmployees.filter(e => e?.user_id).map(emp => (
                        <SelectItem key={emp.user_id} value={emp.user_id}>
                          {emp.full_name || emp.employee_code || 'موظف'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedPermEmployee && (
                  <ProductPermissionsManager
                    user={{ user_id: selectedPermEmployee, full_name: supervisedEmployees.find(e => e?.user_id === selectedPermEmployee)?.full_name }}
                    onClose={() => setSelectedPermEmployee('')}
                    onUpdate={() => {
                      toast({ title: 'تم التحديث', description: 'تم تحديث صلاحيات المنتجات بنجاح' });
                    }}
                    managerScope={!isAdmin ? { permissions: managerOwnPermissions || {} } : undefined}
                  />
                )}

                {!selectedPermEmployee && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Shield className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p>اختر موظفاً لإدارة صلاحيات المنتجات الخاصة به</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* تبويب الإحصائيات */}
          <TabsContent value="stats">
            <DepartmentStatsCharts 
              supervisedEmployeeIds={supervisedEmployeeIds}
              supervisedEmployees={supervisedEmployees}
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default DepartmentManagerSettingsPage;
