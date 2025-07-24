import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Crown, 
  TrendingUp, 
  Users, 
  MapPin,
  Package
} from 'lucide-react';

const TopPerformanceCards = ({ orders = [], products = [], isPersonal = false }) => {
  // حساب أفضل العملاء حسب رقم الهاتف - فقط الطلبات الموصلة
  const topCustomers = React.useMemo(() => {
    if (!orders?.length) return [];
    
    // فلترة الطلبات الموصلة واستبعاد المرجعة والملغية
    const deliveredOrders = orders.filter(order => {
      const isDelivered = order.delivery_status === 'delivered' || 
                         order.status === 'delivered' || 
                         order.order_status === 'delivered';
      
      const isReturnedOrCancelled = order.status === 'returned' || 
                                   order.status === 'cancelled' ||
                                   order.delivery_status === 'returned' ||
                                   order.delivery_status === 'cancelled' ||
                                   order.order_status === 'returned' ||
                                   order.order_status === 'cancelled';
      
      return isDelivered && !isReturnedOrCancelled;
    });
    
    const customerStats = deliveredOrders.reduce((acc, order) => {
      const customerPhone = order.customer_phone || 'غير محدد';
      const customerName = order.customer_name || 'غير محدد';
      if (!acc[customerPhone]) {
        acc[customerPhone] = {
          phone: customerPhone,
          name: customerName,
          totalOrders: 0,
          totalAmount: 0
        };
      }
      acc[customerPhone].totalOrders += 1;
      acc[customerPhone].totalAmount += order.final_amount || 0;
      return acc;
    }, {});

    return Object.values(customerStats)
      .sort((a, b) => b.totalOrders - a.totalOrders)
      .slice(0, 3);
  }, [orders]);

  // حساب أفضل المدن حسب عدد الطلبات - فقط الطلبات الموصلة
  const topProvinces = React.useMemo(() => {
    if (!orders?.length) return [];
    
    // فلترة الطلبات الموصلة واستبعاد المرجعة والملغية
    const deliveredOrders = orders.filter(order => {
      const isDelivered = order.delivery_status === 'delivered' || 
                         order.status === 'delivered' || 
                         order.order_status === 'delivered';
      
      const isReturnedOrCancelled = order.status === 'returned' || 
                                   order.status === 'cancelled' ||
                                   order.delivery_status === 'returned' ||
                                   order.delivery_status === 'cancelled' ||
                                   order.order_status === 'returned' ||
                                   order.order_status === 'cancelled';
      
      return isDelivered && !isReturnedOrCancelled;
    });
    
    const cityStats = deliveredOrders.reduce((acc, order) => {
      const city = order.customer_city || order.customer_province || 'غير محدد';
      if (!acc[city]) {
        acc[city] = {
          name: city,
          totalOrders: 0,
          totalAmount: 0
        };
      }
      acc[city].totalOrders += 1;
      acc[city].totalAmount += order.final_amount || 0;
      return acc;
    }, {});

    return Object.values(cityStats)
      .sort((a, b) => b.totalOrders - a.totalOrders)
      .slice(0, 3);
  }, [orders]);

  // حساب أفضل المنتجات - فقط من الطلبات الموصلة
  const topProducts = React.useMemo(() => {
    if (!orders?.length) return [];
    
    // فلترة الطلبات الموصلة واستبعاد المرجعة والملغية
    const deliveredOrders = orders.filter(order => {
      const isDelivered = order.delivery_status === 'delivered' || 
                         order.status === 'delivered' || 
                         order.order_status === 'delivered';
      
      const isReturnedOrCancelled = order.status === 'returned' || 
                                   order.status === 'cancelled' ||
                                   order.delivery_status === 'returned' ||
                                   order.delivery_status === 'cancelled' ||
                                   order.order_status === 'returned' ||
                                   order.order_status === 'cancelled';
      
      return isDelivered && !isReturnedOrCancelled;
    });
    
    const productStats = {};
    
    deliveredOrders.forEach(order => {
      if (order.order_items && Array.isArray(order.order_items)) {
        order.order_items.forEach(item => {
          const productName = item.products?.name || item.product_name || `منتج ${item.product_id}`;
          if (!productStats[productName]) {
            productStats[productName] = {
              name: productName,
              totalQuantity: 0,
              totalAmount: 0
            };
          }
          productStats[productName].totalQuantity += item.quantity || 0;
          productStats[productName].totalAmount += item.total_price || 0;
        });
      }
    });

    return Object.values(productStats)
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, 3);
  }, [orders]);

  if (!orders?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-right flex items-center">
            <Crown className="ml-2 h-5 w-5 text-yellow-500" />
            {isPersonal ? 'أدائك الشخصي' : 'أفضل الأداء'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            لا توجد بيانات كافية لعرض الإحصائيات
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* أفضل العملاء */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center">
            <Users className="ml-2 h-4 w-4 text-blue-500" />
            أفضل العملاء
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {topCustomers.length > 0 ? topCustomers.map((customer, index) => (
            <div key={customer.phone} className="flex items-center justify-between">
              <div className="flex items-center">
                <Badge variant={index === 0 ? "default" : "secondary"} className="w-6 h-6 rounded-full p-0 flex items-center justify-center text-xs">
                  {index + 1}
                </Badge>
                <div className="mr-2">
                  <div className="text-sm truncate max-w-[100px]">{customer.name}</div>
                  <div className="text-xs text-muted-foreground">{customer.phone}</div>
                </div>
              </div>
              <div className="text-left">
                <div className="text-sm font-medium">{customer.totalOrders} طلب</div>
                <div className="text-xs text-muted-foreground">{customer.totalAmount.toLocaleString()} د.ع</div>
              </div>
            </div>
          )) : (
            <div className="text-center text-muted-foreground text-sm py-4">
              لا توجد بيانات
            </div>
          )}
        </CardContent>
      </Card>

      {/* أفضل المحافظات */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center">
            <MapPin className="ml-2 h-4 w-4 text-green-500" />
            أكثر المدن طلباً
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {topProvinces.length > 0 ? topProvinces.map((province, index) => (
            <div key={province.name} className="flex items-center justify-between">
              <div className="flex items-center">
                <Badge variant={index === 0 ? "default" : "secondary"} className="w-6 h-6 rounded-full p-0 flex items-center justify-center text-xs">
                  {index + 1}
                </Badge>
                <span className="mr-2 text-sm truncate max-w-[100px]">{province.name}</span>
              </div>
              <div className="text-left">
                <div className="text-sm font-medium">{province.totalOrders} طلب</div>
                <div className="text-xs text-muted-foreground">{province.totalAmount.toLocaleString()} د.ع</div>
              </div>
            </div>
          )) : (
            <div className="text-center text-muted-foreground text-sm py-4">
              لا توجد بيانات
            </div>
          )}
        </CardContent>
      </Card>

      {/* أفضل المنتجات */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center">
            <Package className="ml-2 h-4 w-4 text-purple-500" />
            أفضل المنتجات
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {topProducts.length > 0 ? topProducts.map((product, index) => (
            <div key={product.name} className="flex items-center justify-between">
              <div className="flex items-center">
                <Badge variant={index === 0 ? "default" : "secondary"} className="w-6 h-6 rounded-full p-0 flex items-center justify-center text-xs">
                  {index + 1}
                </Badge>
                <span className="mr-2 text-sm truncate max-w-[100px]">{product.name}</span>
              </div>
              <div className="text-left">
                <div className="text-sm font-medium">{product.totalQuantity} قطعة</div>
                <div className="text-xs text-muted-foreground">{product.totalAmount.toLocaleString()} د.ع</div>
              </div>
            </div>
          )) : (
            <div className="text-center text-muted-foreground text-sm py-4">
              لا توجد بيانات
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TopPerformanceCards;