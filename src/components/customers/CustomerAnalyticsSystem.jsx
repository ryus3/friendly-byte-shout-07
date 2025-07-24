import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Users, 
  Phone, 
  MapPin, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  Download, 
  Filter,
  Eye,
  Star,
  Clock,
  BarChart3,
  PieChart,
  Target,
  MessageCircle,
  Heart,
  AlertCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from '@/components/ui/use-toast';
import { useOrders } from '@/hooks/useOrders';

const CustomerAnalyticsSystem = () => {
  const { orders } = useOrders();
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('totalSpent');

  // تطبيع رقم الهاتف - إزالة الأصفار الزائدة والمسافات
  const normalizePhone = (phone) => {
    if (!phone) return 'غير محدد';
    
    // إزالة المسافات والرموز الخاصة
    let cleaned = phone.toString().replace(/[\s\-\(\)\+]/g, '');
    
    // إزالة 964 إذا كان موجوداً
    if (cleaned.startsWith('964')) {
      cleaned = cleaned.substring(3);
    }
    
    // إزالة 0 من البداية إذا كان موجوداً
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    
    // التأكد من أن الرقم 10 أو 11 خانة
    if (cleaned.length >= 10 && cleaned.length <= 11) {
      return cleaned;
    }
    
    return phone; // إرجاع الرقم الأصلي إذا لم يكن صالحاً
  };

  // تحليل بيانات العملاء من الطلبات
  const analyzeCustomers = useMemo(() => {
    if (!orders || orders.length === 0) return [];

    // فلترة الطلبات المكتملة فقط
    const completedOrders = orders.filter(order => 
      order.status === 'delivered' || order.delivery_status === 'delivered'
    );

    // تجميع البيانات حسب رقم الهاتف المطبع
    const customerMap = new Map();

    completedOrders.forEach(order => {
      const rawPhone = order.customer_phone;
      const normalizedPhone = normalizePhone(rawPhone);
      
      if (normalizedPhone === 'غير محدد') return;

      if (!customerMap.has(normalizedPhone)) {
        customerMap.set(normalizedPhone, {
          phone: normalizedPhone,
          displayPhone: rawPhone, // الرقم كما هو مخزن أصلاً
          name: order.customer_name || 'عميل غير محدد',
          city: order.customer_city || order.customer_province || 'غير محدد',
          address: order.customer_address || 'غير محدد',
          orders: [],
          totalOrders: 0,
          totalSpent: 0,
          averageOrderValue: 0,
          firstOrderDate: order.created_at,
          lastOrderDate: order.created_at,
          favoriteProducts: new Map(),
          orderFrequency: 0
        });
      }

      const customer = customerMap.get(normalizedPhone);
      customer.orders.push(order);
      customer.totalOrders += 1;
      customer.totalSpent += parseFloat(order.final_amount || order.total_amount || 0);
      
      // تحديث التواريخ
      if (new Date(order.created_at) < new Date(customer.firstOrderDate)) {
        customer.firstOrderDate = order.created_at;
      }
      if (new Date(order.created_at) > new Date(customer.lastOrderDate)) {
        customer.lastOrderDate = order.created_at;
      }

      // تحليل المنتجات المفضلة
      if (order.order_items) {
        order.order_items.forEach(item => {
          const productName = item.products?.name || item.product_name || 'منتج غير محدد';
          const currentCount = customer.favoriteProducts.get(productName) || 0;
          customer.favoriteProducts.set(productName, currentCount + (item.quantity || 1));
        });
      }
    });

    // حساب المتوسطات والتقييمات
    return Array.from(customerMap.values()).map(customer => {
      customer.averageOrderValue = customer.totalOrders > 0 ? customer.totalSpent / customer.totalOrders : 0;
      
      // حساب تكرار الطلبات (أيام بين الطلبات)
      if (customer.totalOrders > 1) {
        const daysDiff = (new Date(customer.lastOrderDate) - new Date(customer.firstOrderDate)) / (1000 * 60 * 60 * 24);
        customer.orderFrequency = daysDiff / customer.totalOrders;
      }

      // تحديد المنتج المفضل
      customer.favoriteProduct = customer.favoriteProducts.size > 0 
        ? Array.from(customer.favoriteProducts.entries()).sort((a, b) => b[1] - a[1])[0][0]
        : 'غير محدد';

      // تقييم العميل (نجوم)
      let score = 0;
      if (customer.totalOrders >= 5) score += 2;
      else if (customer.totalOrders >= 3) score += 1;
      
      if (customer.totalSpent >= 500000) score += 2;
      else if (customer.totalSpent >= 200000) score += 1;
      
      if (customer.orderFrequency > 0 && customer.orderFrequency <= 30) score += 1;
      
      customer.customerScore = Math.min(score, 5);

      // حالة العميل
      const daysSinceLastOrder = (new Date() - new Date(customer.lastOrderDate)) / (1000 * 60 * 60 * 24);
      if (daysSinceLastOrder <= 30) {
        customer.status = 'نشط';
        customer.statusColor = 'green';
      } else if (daysSinceLastOrder <= 90) {
        customer.status = 'متوسط النشاط';
        customer.statusColor = 'yellow';
      } else {
        customer.status = 'غير نشط';
        customer.statusColor = 'red';
      }

      return customer;
    });
  }, [orders]);

  // فلترة العملاء حسب الفترة والبحث
  const filteredCustomers = useMemo(() => {
    let filtered = analyzeCustomers;

    // فلترة حسب الفترة
    if (selectedPeriod !== 'all') {
      const now = new Date();
      let dateLimit;
      
      switch (selectedPeriod) {
        case 'week':
          dateLimit = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          dateLimit = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '3months':
          dateLimit = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          dateLimit = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          dateLimit = null;
      }

      if (dateLimit) {
        filtered = filtered.filter(customer => 
          new Date(customer.lastOrderDate) >= dateLimit
        );
      }
    }

    // فلترة حسب البحث
    if (searchTerm) {
      filtered = filtered.filter(customer => 
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.phone.includes(searchTerm) ||
        customer.city.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // ترتيب العملاء
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'totalSpent':
          return b.totalSpent - a.totalSpent;
        case 'totalOrders':
          return b.totalOrders - a.totalOrders;
        case 'lastOrder':
          return new Date(b.lastOrderDate) - new Date(a.lastOrderDate);
        case 'customerScore':
          return b.customerScore - a.customerScore;
        default:
          return b.totalSpent - a.totalSpent;
      }
    });

    return filtered;
  }, [analyzeCustomers, selectedPeriod, searchTerm, sortBy]);

  // إحصائيات عامة
  const stats = useMemo(() => {
    if (filteredCustomers.length === 0) return {
      totalCustomers: 0,
      activeCustomers: 0,
      totalRevenue: 0,
      averageOrderValue: 0,
      topSpender: null,
      loyalCustomers: 0
    };

    return {
      totalCustomers: filteredCustomers.length,
      activeCustomers: filteredCustomers.filter(c => c.status === 'نشط').length,
      totalRevenue: filteredCustomers.reduce((sum, c) => sum + c.totalSpent, 0),
      averageOrderValue: filteredCustomers.reduce((sum, c) => sum + c.averageOrderValue, 0) / filteredCustomers.length,
      topSpender: filteredCustomers[0],
      loyalCustomers: filteredCustomers.filter(c => c.totalOrders >= 5).length
    };
  }, [filteredCustomers]);

  // تحميل البيانات كـ CSV
  const exportToCSV = () => {
    const headers = [
      'اسم العميل',
      'رقم الهاتف',
      'المدينة',
      'عدد الطلبات',
      'إجمالي المبالغ',
      'متوسط قيمة الطلب',
      'أول طلب',
      'آخر طلب',
      'المنتج المفضل',
      'حالة العميل',
      'تقييم العميل'
    ];

    const csvData = filteredCustomers.map(customer => [
      customer.name,
      customer.displayPhone,
      customer.city,
      customer.totalOrders,
      customer.totalSpent,
      Math.round(customer.averageOrderValue),
      new Date(customer.firstOrderDate).toLocaleDateString('ar-SA'),
      new Date(customer.lastOrderDate).toLocaleDateString('ar-SA'),
      customer.favoriteProduct,
      customer.status,
      customer.customerScore
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `customer_analytics_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "تم التصدير بنجاح",
      description: `تم تصدير بيانات ${filteredCustomers.length} عميل`,
      variant: "success"
    });
  };

  // إذا لم توجد طلبات، اعرض رسالة
  if (!orders || orders.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-muted-foreground mb-2">لا توجد طلبات متاحة</h3>
          <p className="text-muted-foreground">لا يمكن تحليل العملاء بدون وجود طلبات في النظام</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">نظام تحليل العملاء</h1>
          <p className="text-muted-foreground mt-1">تحليل شامل لبيانات العملاء والاستفادة منها</p>
        </div>
        <Button onClick={exportToCSV} className="gap-2">
          <Download className="w-4 h-4" />
          تصدير البيانات
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي العملاء</p>
                <p className="text-2xl font-bold">{stats.totalCustomers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">العملاء النشطون</p>
                <p className="text-2xl font-bold">{stats.activeCustomers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي الإيرادات</p>
                <p className="text-2xl font-bold">{stats.totalRevenue.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
                <Heart className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">العملاء المخلصون</p>
                <p className="text-2xl font-bold">{stats.loyalCustomers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            فلترة وبحث
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>الفترة الزمنية</Label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border border-border z-50">
                  <SelectItem value="all">كل الفترات</SelectItem>
                  <SelectItem value="week">الأسبوع الماضي</SelectItem>
                  <SelectItem value="month">الشهر الماضي</SelectItem>
                  <SelectItem value="3months">3 أشهر</SelectItem>
                  <SelectItem value="year">السنة الماضية</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>ترتيب حسب</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border border-border z-50">
                  <SelectItem value="totalSpent">إجمالي المبالغ</SelectItem>
                  <SelectItem value="totalOrders">عدد الطلبات</SelectItem>
                  <SelectItem value="lastOrder">آخر طلب</SelectItem>
                  <SelectItem value="customerScore">تقييم العميل</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <Label>البحث</Label>
              <Input
                placeholder="ابحث باسم العميل أو رقم الهاتف أو المدينة..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-background"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customers List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            قائمة العملاء ({filteredCustomers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredCustomers.map((customer, index) => (
              <motion.div
                key={customer.phone}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => setSelectedCustomer(customer)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center text-white font-bold">
                      {customer.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{customer.name}</h3>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {customer.displayPhone}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {customer.city}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground">عدد الطلبات</div>
                      <div className="font-bold text-blue-600">{customer.totalOrders}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground">إجمالي المبالغ</div>
                      <div className="font-bold text-green-600">{customer.totalSpent.toLocaleString()}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground">التقييم</div>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star 
                            key={i} 
                            className={`w-3 h-3 ${i < customer.customerScore ? 'text-yellow-500 fill-current' : 'text-gray-300'}`} 
                          />
                        ))}
                      </div>
                    </div>
                    <Badge 
                      variant={customer.statusColor === 'green' ? 'default' : customer.statusColor === 'yellow' ? 'secondary' : 'destructive'}
                    >
                      {customer.status}
                    </Badge>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {filteredCustomers.length === 0 && (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">لا توجد عملاء تطابق معايير البحث</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer Details Dialog */}
      {selectedCustomer && (
        <Dialog open={!!selectedCustomer} onOpenChange={() => setSelectedCustomer(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-background">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center text-white font-bold">
                  {selectedCustomer.name.charAt(0)}
                </div>
                تفاصيل العميل: {selectedCustomer.name}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Customer Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">المعلومات الأساسية</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span>{selectedCustomer.displayPhone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span>{selectedCustomer.city}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span>عميل منذ: {new Date(selectedCustomer.firstOrderDate).toLocaleDateString('ar-SA')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span>آخر طلب: {new Date(selectedCustomer.lastOrderDate).toLocaleDateString('ar-SA')}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">إحصائيات الطلبات</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span>عدد الطلبات:</span>
                      <span className="font-bold">{selectedCustomer.totalOrders}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>إجمالي المبالغ:</span>
                      <span className="font-bold">{selectedCustomer.totalSpent.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>متوسط قيمة الطلب:</span>
                      <span className="font-bold">{Math.round(selectedCustomer.averageOrderValue).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>المنتج المفضل:</span>
                      <span className="font-bold">{selectedCustomer.favoriteProduct}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Orders */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">الطلبات الأخيرة</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {selectedCustomer.orders.slice(0, 5).map((order, index) => (
                      <div key={order.id} className="flex items-center justify-between border-b pb-2">
                        <div>
                          <div className="font-medium">طلب #{order.order_number}</div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(order.created_at).toLocaleDateString('ar-SA')}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{(order.final_amount || order.total_amount).toLocaleString()}</div>
                          <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'}>
                            {order.status === 'delivered' ? 'مكتمل' : order.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default CustomerAnalyticsSystem;