import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, DollarSign, TrendingUp, Clock, CheckCircle, XCircle, FileText, Download } from 'lucide-react';
import { useProfits } from '@/contexts/ProfitsContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const ProfitsManagementPage = () => {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const { 
    profits, 
    settlementRequests, 
    settlementInvoices,
    loading,
    createSettlementRequest,
    approveSettlementRequest,
    rejectSettlementRequest
  } = useProfits();

  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [selectedOrders, setSelectedOrders] = useState([]);

  // إحصائيات الأرباح
  const profitStats = useMemo(() => {
    const now = new Date();
    const filterByPeriod = (date) => {
      const itemDate = new Date(date);
      switch (selectedPeriod) {
        case 'today':
          return itemDate.toDateString() === now.toDateString();
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return itemDate >= weekAgo;
        case 'month':
          const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          return itemDate >= monthAgo;
        default:
          return true;
      }
    };

    const filteredProfits = profits.filter(p => filterByPeriod(p.created_at));

    return {
      totalProfits: filteredProfits.reduce((sum, p) => sum + p.total_profit, 0),
      pendingProfits: filteredProfits.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.total_profit, 0),
      availableForSettlement: filteredProfits.filter(p => p.status === 'invoice_received').reduce((sum, p) => sum + p.total_profit, 0),
      settledProfits: filteredProfits.filter(p => p.status === 'settled').reduce((sum, p) => sum + p.total_profit, 0),
      count: filteredProfits.length
    };
  }, [profits, selectedPeriod]);

  // الأرباح المتاحة للتحاسب (للموظف)
  const availableForSettlement = useMemo(() => {
    return profits.filter(p => 
      p.status === 'invoice_received' && 
      p.employee_id === user?.id
    );
  }, [profits, user?.id]);

  // طلب تحاسب
  const handleSettlementRequest = async () => {
    if (selectedOrders.length === 0) {
      toast({
        title: "لم تحدد طلبات",
        description: "الرجاء تحديد الطلبات المراد التحاسب عليها",
        variant: "destructive"
      });
      return;
    }

    await createSettlementRequest(selectedOrders);
    setSelectedOrders([]);
  };

  const formatDate = (dateString) => {
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: ar });
  };

  const formatCurrency = (amount) => {
    return `${amount.toLocaleString()} د.ع`;
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: { label: 'قيد التجهيز', variant: 'secondary' },
      sales_pending: { label: 'مبيعات معلقة', variant: 'outline' },
      profits_pending: { label: 'أرباح معلقة', variant: 'default' },
      invoice_received: { label: 'مؤهل للتحاسب', variant: 'success' },
      settlement_requested: { label: 'طلب تحاسب', variant: 'warning' },
      settled: { label: 'تم التحاسب', variant: 'success' },
      cancelled: { label: 'ملغي', variant: 'destructive' }
    };

    const config = statusMap[status] || { label: status, variant: 'secondary' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold gradient-text">إدارة الأرباح</h1>
          <p className="text-muted-foreground">نظام متكامل لتتبع الأرباح والتحاسب</p>
        </div>
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">اليوم</SelectItem>
            <SelectItem value="week">هذا الأسبوع</SelectItem>
            <SelectItem value="month">هذا الشهر</SelectItem>
            <SelectItem value="all">كل الوقت</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* إحصائيات */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">إجمالي الأرباح</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(profitStats.totalProfits)}
              </div>
              <p className="text-xs text-muted-foreground">
                {profitStats.count} طلب
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">أرباح معلقة</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {formatCurrency(profitStats.pendingProfits)}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">مؤهل للتحاسب</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(profitStats.availableForSettlement)}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">تم التحاسب</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">
                {formatCurrency(profitStats.settledProfits)}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* المحتوى الرئيسي */}
      <Tabs defaultValue={hasPermission('manage_settlements') ? 'overview' : 'my-profits'}>
        <TabsList>
          {hasPermission('manage_settlements') && (
            <>
              <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
              <TabsTrigger value="requests">طلبات التحاسب</TabsTrigger>
              <TabsTrigger value="invoices">الفواتير</TabsTrigger>
            </>
          )}
          <TabsTrigger value="my-profits">أرباحي</TabsTrigger>
        </TabsList>

        {/* نظرة عامة - للمدير */}
        {hasPermission('manage_settlements') && (
          <TabsContent value="overview">
            <Card>
              <CardHeader>
                <CardTitle>جميع الأرباح</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {profits.length > 0 ? profits.map(profit => (
                    <div key={profit.id} className="flex justify-between items-center p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">طلب #{profit.order_id}</p>
                        <p className="text-sm text-muted-foreground">
                          الموظف: {profit.employee?.full_name || 'غير محدد'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(profit.created_at)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatCurrency(profit.employee_profit || 0)}</p>
                        {getStatusBadge(profit.status)}
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>لا توجد أرباح مسجلة حتى الآن</p>
                      <p className="text-sm mt-2">ستظهر الأرباح تلقائياً عند إنشاء الطلبات</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* طلبات التحاسب - للمدير */}
        {hasPermission('manage_settlements') && (
          <TabsContent value="requests">
            <Card>
              <CardHeader>
                <CardTitle>طلبات التحاسب</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {settlementRequests.filter(r => r.status === 'pending').map(request => (
                    <div key={request.id} className="p-4 border rounded-lg space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">طلب من الموظف #{request.employee_id}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(request.requested_at)}
                          </p>
                          <p className="text-sm">
                            {request.order_ids.length} طلب - {formatCurrency(request.total_profit)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => approveSettlementRequest(request.id)}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="w-4 h-4 ml-2" />
                            موافقة
                          </Button>
                          <Button
                            onClick={() => rejectSettlementRequest(request.id)}
                            variant="destructive"
                            size="sm"
                          >
                            <XCircle className="w-4 h-4 ml-2" />
                            رفض
                          </Button>
                        </div>
                      </div>
                      {request.notes && (
                        <div className="bg-muted p-3 rounded">
                          <p className="text-sm">{request.notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* الفواتير - للمدير */}
        {hasPermission('manage_settlements') && (
          <TabsContent value="invoices">
            <Card>
              <CardHeader>
                <CardTitle>فواتير التحاسب</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {settlementInvoices.map(invoice => (
                    <div key={invoice.id} className="flex justify-between items-center p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{invoice.invoice_number}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(invoice.generated_at)}
                        </p>
                      </div>
                      <div className="text-right flex items-center gap-4">
                        <p className="font-bold">{formatCurrency(invoice.total_amount)}</p>
                        <Button variant="outline" size="sm">
                          <Download className="w-4 h-4 ml-2" />
                          تحميل PDF
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* أرباحي - للموظفين */}
        <TabsContent value="my-profits">
          <div className="space-y-6">
            {/* أرباح متاحة للتحاسب */}
            {availableForSettlement.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>أرباح متاحة للتحاسب</CardTitle>
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">
                      اختر الطلبات التي تريد التحاسب عليها
                    </p>
                    <Button 
                      onClick={handleSettlementRequest}
                      disabled={selectedOrders.length === 0}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      طلب تحاسب ({selectedOrders.length})
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {availableForSettlement.map(profit => (
                      <div key={profit.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selectedOrders.includes(profit.order_id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedOrders(prev => [...prev, profit.order_id]);
                              } else {
                                setSelectedOrders(prev => prev.filter(id => id !== profit.order_id));
                              }
                            }}
                            className="w-4 h-4"
                          />
                          <div>
                            <p className="font-medium">طلب #{profit.order_id}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(profit.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">
                            {formatCurrency(profit.total_profit)}
                          </p>
                          {getStatusBadge(profit.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* جميع أرباحي */}
            <Card>
              <CardHeader>
                <CardTitle>جميع أرباحي</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {profits.filter(p => p.employee_id === user?.id).length > 0 ? (
                    profits.filter(p => p.employee_id === user?.id).map(profit => (
                      <div key={profit.id} className="flex justify-between items-center p-4 border rounded-lg">
                        <div>
                          <p className="font-medium">طلب #{profit.order_id}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(profit.created_at)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{formatCurrency(profit.employee_profit || 0)}</p>
                          {getStatusBadge(profit.status)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>لا توجد أرباح لك حتى الآن</p>
                      <p className="text-sm mt-2">أنشئ طلبات مبيعات لبدء تجميع الأرباح</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProfitsManagementPage;