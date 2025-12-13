import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useUnifiedPermissionsSystem as usePermissions } from '@/hooks/useUnifiedPermissionsSystem.jsx';
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
import { 
  Users, 
  DollarSign, 
  Package, 
  BarChart3, 
  Plus,
  Trash2,
  Save,
  User,
  TrendingUp
} from 'lucide-react';

const DepartmentManagerSettingsPage = () => {
  const { user } = useAuth();
  const { isAdmin, isDepartmentManager } = usePermissions();
  const { supervisedEmployees, supervisedEmployeeIds, loading: supervisedLoading } = useSupervisedEmployees();
  
  const [activeTab, setActiveTab] = useState('employees');
  const [profitRules, setProfitRules] = useState([]);
  const [newRule, setNewRule] = useState({
    employee_id: '',
    product_id: '',
    profit_amount: 0,
    profit_type: 'fixed'
  });
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalSales: 0,
    totalProfit: 0
  });

  // جلب المنتجات
  useEffect(() => {
    const fetchProducts = async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      
      if (!error && data) {
        setProducts(data);
      }
    };
    fetchProducts();
  }, []);

  // جلب قواعد الأرباح للموظفين تحت الإشراف
  useEffect(() => {
    const fetchProfitRules = async () => {
      if (!isDepartmentManager || supervisedEmployeeIds.length === 0) return;
      
      const { data, error } = await supabase
        .from('employee_profit_rules')
        .select(`
          *,
          employee:profiles!employee_id(full_name, employee_code),
          product:products!target_id(name)
        `)
        .in('employee_id', supervisedEmployeeIds)
        .eq('created_by', user?.id);
      
      if (!error && data) {
        setProfitRules(data);
      }
    };
    fetchProfitRules();
  }, [isDepartmentManager, supervisedEmployeeIds, user?.id]);

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
    if (!newRule.employee_id || newRule.profit_amount <= 0) {
      toast({ title: 'خطأ', description: 'الرجاء ملء جميع الحقول المطلوبة', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('employee_profit_rules')
        .insert({
          employee_id: newRule.employee_id,
          target_id: newRule.product_id || null,
          rule_type: newRule.product_id ? 'product' : 'global',
          profit_amount: newRule.profit_amount,
          created_by: user?.id,
          is_active: true
        });

      if (error) throw error;

      toast({ title: 'تم بنجاح', description: 'تمت إضافة قاعدة الربح' });
      setNewRule({ employee_id: '', product_id: '', profit_amount: 0, profit_type: 'fixed' });
      
      // إعادة جلب القواعد
      const { data } = await supabase
        .from('employee_profit_rules')
        .select(`
          *,
          employee:profiles!employee_id(full_name, employee_code),
          product:products!target_id(name)
        `)
        .in('employee_id', supervisedEmployeeIds)
        .eq('created_by', user?.id);
      
      if (data) setProfitRules(data);
    } catch (error) {
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
      .eq('id', ruleId)
      .eq('created_by', user?.id);

    if (!error) {
      setProfitRules(prev => prev.filter(r => r.id !== ruleId));
      toast({ title: 'تم الحذف', description: 'تم حذف قاعدة الربح' });
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
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="employees" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">الموظفين</span>
            </TabsTrigger>
            <TabsTrigger value="profits" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              <span className="hidden sm:inline">قواعد الأرباح</span>
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">الإحصائيات</span>
            </TabsTrigger>
          </TabsList>

          {/* تبويب الموظفين */}
          <TabsContent value="employees">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  الموظفين تحت إشرافي
                </CardTitle>
                <CardDescription>
                  قائمة الموظفين الذين يمكنك إدارة أرباحهم ومتابعة أدائهم
                </CardDescription>
              </CardHeader>
              <CardContent>
                {supervisedLoading ? (
                  <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
                ) : supervisedEmployees.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    لا يوجد موظفين تحت إشرافك حالياً
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {supervisedEmployees.filter(emp => emp != null).map((emp) => (
                      <Card key={emp?.user_id || Math.random()} className="border-2 hover:border-primary/50 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg">
                              {emp?.full_name?.charAt(0) || 'م'}
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold">{emp?.full_name || 'موظف'}</p>
                              <p className="text-sm text-muted-foreground">{emp?.employee_code || emp?.email || '-'}</p>
                            </div>
                            <Badge variant="outline">نشط</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
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
                  <div className="grid gap-4 md:grid-cols-4">
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
                              {p.name}
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
                      />
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
                        className="flex items-center justify-between p-4 border rounded-lg bg-card"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-400 flex items-center justify-center text-white">
                            <DollarSign className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-semibold">{rule.employee?.full_name || 'موظف'}</p>
                            <p className="text-sm text-muted-foreground">
                              {rule.product?.name || 'كل المنتجات'} - {rule.profit_amount?.toLocaleString()} د.ع
                            </p>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDeleteRule(rule.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* تبويب الإحصائيات */}
          <TabsContent value="stats">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  إحصائيات القسم
                </CardTitle>
                <CardDescription>
                  ملخص أداء قسمك والموظفين تحت إشرافك
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  سيتم إضافة رسوم بيانية تفصيلية قريباً
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default DepartmentManagerSettingsPage;
