import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, Receipt, AlertCircle } from 'lucide-react';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useUnifiedPermissionsSystem } from '@/hooks/useUnifiedPermissionsSystem';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import ReceiveInvoiceButton from '@/components/orders/ReceiveInvoiceButton';

/**
 * كارت الأرباح المعلقة - يعرض أرباح الموظف للموظفين وأرباح النظام للمديرين
 */
const PendingProfitsCard = () => {
  const { user } = useAuth();
  const { profits, orders, loading, calculateProfit } = useInventory();
  const { canViewAllData } = useUnifiedPermissionsSystem();
  
  if (!user) return null;

  // الطلبات المسلمة بدون استلام فاتورة
  const pendingInvoiceOrders = useMemo(() => {
    if (!orders || !user) return [];
    
    if (canViewAllData) {
      // المدير يرى جميع الطلبات المسلمة بدون فاتورة
      return orders.filter(order => 
        order.status === 'delivered' &&
        !order.receipt_received
      );
    } else {
      // الموظف يرى طلباته فقط
      return orders.filter(order => 
        order.created_by === user.id &&
        order.status === 'delivered' &&
        !order.receipt_received
      );
    }
  }, [orders, user, canViewAllData]);

  // الأرباح المعلقة
  const pendingProfits = useMemo(() => {
    if (!profits || !user) return [];
    
    if (canViewAllData) {
      // المدير يرى جميع الأرباح المعلقة
      return profits.filter(profit => profit.status === 'pending');
    } else {
      // الموظف يرى أرباحه فقط
      return profits.filter(profit => 
        profit.employee_id === user.id &&
        profit.status === 'pending'
      );
    }
  }, [profits, user, canViewAllData]);

  const formatCurrency = (amount) => {
    return `${(amount || 0).toLocaleString()} د.ع`;
  };

  const formatDate = (dateString) => {
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: ar });
  };

  // حساب الأرباح المعلقة الإجمالية
  const totalPendingAmount = useMemo(() => {
    const userType = canViewAllData ? 'مدير' : 'موظف';
    console.log(`🔄 حساب الأرباح المعلقة - ${userType}:`, user?.id);
    
    // أرباح محسوبة ومسجلة في profits
    const settledProfits = pendingProfits.reduce((sum, profit) => sum + (profit.employee_profit || 0), 0);
    console.log('💰 أرباح محسوبة:', settledProfits);
    
    // أرباح متوقعة من الطلبات المسلمة بدون فاتورة
    const expectedProfits = pendingInvoiceOrders.reduce((sum, order) => {
      let orderProfit = 0;
      
      if (calculateProfit) {
        if (canViewAllData) {
          // المدير: يحسب ربح الموظف الذي أنشأ الطلب
          orderProfit = calculateProfit(order);
        } else {
          // الموظف: يحسب ربحه فقط إذا كان هو من أنشأ الطلب
          if (order.created_by === user.id) {
            orderProfit = calculateProfit(order);
          } else {
            orderProfit = 0; // ليس طلبه، ربحه = 0
          }
        }
      }
      
      console.log(`🔍 ربح متوقع للطلب ${order.order_number}:`, {
        orderId: order.id,
        createdBy: order.created_by,
        currentUserId: user.id,
        isUserOrder: order.created_by === user.id,
        calculatedProfit: orderProfit,
        userType,
        canViewAllData
      });
      
      return sum + orderProfit;
    }, 0);
    
    const total = settledProfits + expectedProfits;
    console.log(`📊 ملخص الأرباح المعلقة - ${userType}:`, {
      settledProfits,
      expectedProfits,
      total,
      userCanViewAll: canViewAllData
    });
    
    return total;
  }, [pendingProfits, pendingInvoiceOrders, calculateProfit, user?.id, canViewAllData]);

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-8 bg-muted rounded w-3/4"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full border-border/40 shadow-sm bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-4 border-b border-border/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-600" />
            <CardTitle className="text-lg font-semibold text-foreground">
              {canViewAllData ? 'الأرباح المعلقة الإجمالية' : 'أرباحي المعلقة'}
            </CardTitle>
          </div>
          {totalPendingAmount > 0 && (
            <Badge className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
              {formatCurrency(totalPendingAmount)}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* الطلبات المسلمة بحاجة لاستلام فاتورة */}
        {pendingInvoiceOrders.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-medium text-foreground">
                طلبات بحاجة لاستلام فاتورة ({pendingInvoiceOrders.length})
              </h3>
            </div>
            
            {pendingInvoiceOrders.slice(0, 3).map((order) => {
              // حساب الربح حسب نوع المستخدم
              let expectedProfit = 0;
              if (calculateProfit) {
                if (canViewAllData) {
                  // المدير: يحسب ربح الموظف الذي أنشأ الطلب
                  expectedProfit = calculateProfit(order);
                } else {
                  // الموظف: يحسب ربحه فقط إذا كان هو من أنشأ الطلب
                  expectedProfit = order.created_by === user.id ? calculateProfit(order) : 0;
                }
              }
              const hasRule = expectedProfit > 0;
              
              return (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-3 bg-card border border-border/50 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {order.order_number || order.tracking_number}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {order.delivery_partner || 'محلي'}
                      </Badge>
                      {!hasRule && (
                        <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">
                          بلا قاعدة
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      العميل: {order.customer_name} - {formatDate(order.created_at)}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-green-600 font-medium">
                        المبلغ: {formatCurrency(order.final_amount)}
                      </p>
                      <p className={`text-xs font-medium ${hasRule ? 'text-blue-600' : 'text-muted-foreground'}`}>
                        {canViewAllData ? 'الربح المتوقع' : 'ربحي المتوقع'}: {formatCurrency(expectedProfit)}
                      </p>
                    </div>
                  </div>
                  
                  {/* إظهار زر استلام الفاتورة للطلبات التي ينشئها المستخدم أو للمدير */}
                  {(order.created_by === user.id || canViewAllData) && (
                    <ReceiveInvoiceButton 
                      order={order}
                      onSuccess={() => {
                        // سيتم إعادة تحميل البيانات تلقائياً عبر الـ context
                        toast({
                          title: "✅ تم استلام الفاتورة",
                          description: "سيتم حساب الأرباح تلقائياً",
                          variant: "success",
                        });
                      }}
                    />
                  )}
                </div>
              );
            })}
            
            {pendingInvoiceOrders.length > 3 && (
              <p className="text-xs text-muted-foreground text-center">
                و {pendingInvoiceOrders.length - 3} طلبات أخرى...
              </p>
            )}
          </div>
        )}

        {/* الأرباح المحسوبة والمعلقة */}
        {pendingProfits.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-medium text-foreground">
                أرباح محسوبة ومعلقة ({pendingProfits.length})
              </h3>
            </div>
            
            {pendingProfits.slice(0, 3).map((profit) => {
              const relatedOrder = orders?.find(o => o.id === profit.order_id);
              return (
                <div
                  key={profit.id}
                  className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {relatedOrder?.order_number || `طلب #${profit.order_id.slice(0, 8)}`}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        معلق
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(profit.created_at)}
                    </p>
                  </div>
                  
                  <div className="text-right">
                    <p className="font-bold text-green-600 text-sm">
                      {formatCurrency(profit.employee_profit)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {canViewAllData ? 'ربح الموظف' : 'ربحي'}
                    </p>
                  </div>
                </div>
              );
            })}
            
            {pendingProfits.length > 3 && (
              <p className="text-xs text-muted-foreground text-center">
                و {pendingProfits.length - 3} أرباح أخرى...
              </p>
            )}
          </div>
        )}

        {/* رسالة عدم وجود أرباح معلقة */}
        {pendingInvoiceOrders.length === 0 && pendingProfits.length === 0 && (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-green-600 font-medium text-sm">ممتاز! 🎉</p>
            <p className="text-muted-foreground text-xs mt-0.5">
              لا توجد أرباح معلقة حالياً
            </p>
          </div>
        )}

        {/* رسالة تشجيعية */}
        {totalPendingAmount > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-blue-700 dark:text-blue-300 text-xs">
              💡 نصيحة: تأكد من استلام الفواتير لجميع الطلبات المسلمة لحساب أرباحك
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PendingProfitsCard;