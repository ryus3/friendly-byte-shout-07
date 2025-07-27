import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MapPin, Calendar, Eye, TrendingUp, DollarSign, Map } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';

const TopProvincesDialog = ({ open, onOpenChange, employeeId = null }) => {
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [provinceStats, setProvinceStats] = useState([]);
  const [allOrders, setAllOrders] = useState([]);

  const periods = [
    { key: 'week', label: 'الأسبوع الماضي' },
    { key: 'month', label: 'الشهر الماضي' },
    { key: '3months', label: '3 أشهر' },
    { key: '6months', label: '6 أشهر' },
    { key: 'year', label: 'السنة الماضية' },
    { key: 'all', label: 'كل الفترات' }
  ];

  // جلب الطلبات من قاعدة البيانات مباشرة
  const fetchOrders = async () => {
    try {
      console.log('🔄 جاري جلب الطلبات للمحافظات...');
      
      let query = supabase
        .from('orders')
        .select('*')
        .in('status', ['completed', 'delivered'])
        .order('created_at', { ascending: false });

      // إذا كان هناك معرف موظف، فلتر حسب الموظف فقط
      if (employeeId) {
        query = query.eq('created_by', employeeId);
      }

      const { data: orders, error } = await query;

      if (error) {
        console.error('❌ خطأ في جلب الطلبات:', error);
        setAllOrders([]);
        return;
      }

      console.log('✅ تم جلب الطلبات بنجاح:', orders?.length || 0);
      setAllOrders(orders || []);
      setLoading(false);
    } catch (error) {
      console.error('❌ خطأ غير متوقع:', error);
      setAllOrders([]);
      setLoading(false);
    }
  };

  // جلب البيانات عند فتح النافذة
  useEffect(() => {
    if (open && allOrders.length === 0) {
      fetchOrders();
    }
  }, [open]);

  // حساب إحصائيات المحافظات
  useEffect(() => {
    console.log('🔍 بدء تحليل بيانات المحافظات...');
    console.log('📊 إجمالي الطلبات:', allOrders.length);

    if (!allOrders || allOrders.length === 0) {
      console.log('❌ لا توجد طلبات متاحة');
      setProvinceStats([]);
      return;
    }

    // فلترة الطلبات المكتملة فقط
    const completedOrders = allOrders.filter(order => {
      const isCompleted = order.status === 'completed';
      const isNotReturned = order.status !== 'return_received' && order.status !== 'cancelled';
      return isCompleted && isNotReturned;
    });

    console.log('✅ الطلبات المكتملة:', completedOrders.length);

    if (completedOrders.length === 0) {
      console.log('❌ لا توجد طلبات مكتملة');
      setProvinceStats([]);
      return;
    }

    // فلترة حسب الفترة الزمنية
    const now = new Date();
    const filteredOrders = completedOrders.filter(order => {
      if (selectedPeriod === 'all') return true;
      
      const orderDate = new Date(order.created_at);
      
      switch (selectedPeriod) {
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return orderDate >= weekAgo;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          return orderDate >= monthAgo;
        case '3months':
          const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          return orderDate >= threeMonthsAgo;
        case '6months':
          const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
          return orderDate >= sixMonthsAgo;
        case 'year':
          const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          return orderDate >= yearAgo;
        default:
          return true;
      }
    });

    console.log('📅 الطلبات بعد فلترة الفترة:', filteredOrders.length);

    // تجميع البيانات حسب المحافظة
    const provinceMap = {};

    filteredOrders.forEach(order => {
      const province = order.customer_city || order.customer_province || 'غير محدد';
      
      console.log(`🗺️ معالجة الطلب ${order.id}: المحافظة="${province}"`);

      if (!provinceMap[province]) {
        provinceMap[province] = {
          province: province,
          orderCount: 0,
          totalRevenue: 0,
          avgOrderValue: 0,
          firstOrderDate: order.created_at,
          lastOrderDate: order.created_at,
          orders: []
        };
      }

      const provinceData = provinceMap[province];
      provinceData.orderCount += 1;
      provinceData.totalRevenue += parseFloat(order.final_amount || order.total_amount || 0);
      provinceData.orders.push({
        id: order.id,
        amount: order.final_amount || order.total_amount,
        date: order.created_at
      });
      
      // تحديث التواريخ
      const orderDate = new Date(order.created_at);
      const firstDate = new Date(provinceData.firstOrderDate);
      const lastDate = new Date(provinceData.lastOrderDate);
      
      if (orderDate < firstDate) provinceData.firstOrderDate = order.created_at;
      if (orderDate > lastDate) provinceData.lastOrderDate = order.created_at;
    });

    console.log('🏙️ عدد المحافظات الفريدة:', Object.keys(provinceMap).length);

    // تحويل إلى مصفوفة وترتيب
    const result = Object.values(provinceMap)
      .map(province => ({
        ...province,
        avgOrderValue: province.orderCount > 0 ? province.totalRevenue / province.orderCount : 0
      }))
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, 10);
      
    console.log('🏆 أفضل المحافظات:', result);
    setProvinceStats(result);
  }, [allOrders, selectedPeriod]);

  const totalOrders = provinceStats.reduce((sum, province) => sum + province.orderCount, 0);
  const totalRevenue = provinceStats.reduce((sum, province) => sum + province.totalRevenue, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-background">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-lg">
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-green-500" />
            </div>
            المحافظات الأكثر طلباً
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">جاري التحليل...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* فلترة الفترة الزمنية */}
            <div className="flex flex-wrap gap-1">
              {periods.map((period) => (
                <Button
                  key={period.key}
                  variant={selectedPeriod === period.key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedPeriod(period.key)}
                  className="text-xs px-2 py-1 h-8"
                >
                  {period.label}
                </Button>
              ))}
            </div>

            {/* الإحصائيات العامة */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-gradient-to-br from-green-500 to-emerald-400 rounded-lg p-4 text-white relative overflow-hidden">
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-white/10 rounded-full"></div>
                <div className="flex items-center justify-between relative z-10">
                  <div>
                    <p className="text-xs font-medium text-white/90 mb-1">إجمالي الطلبات</p>
                    <p className="text-xl font-bold text-white">{totalOrders}</p>
                  </div>
                  <TrendingUp className="w-5 h-5 text-white/80" />
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-500 to-cyan-400 rounded-lg p-4 text-white relative overflow-hidden">
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-white/10 rounded-full"></div>
                <div className="flex items-center justify-between relative z-10">
                  <div>
                    <p className="text-xs font-medium text-white/90 mb-1">إجمالي الإيرادات</p>
                    <p className="text-xl font-bold text-white">{totalRevenue.toLocaleString()}</p>
                  </div>
                  <DollarSign className="w-5 h-5 text-white/80" />
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-500 to-violet-400 rounded-lg p-4 text-white relative overflow-hidden">
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-white/10 rounded-full"></div>
                <div className="flex items-center justify-between relative z-10">
                  <div>
                    <p className="text-xs font-medium text-white/90 mb-1">عدد المحافظات</p>
                    <p className="text-xl font-bold text-white">{provinceStats.length}</p>
                  </div>
                  <Map className="w-5 h-5 text-white/80" />
                </div>
              </div>
            </div>

            {/* قائمة المحافظات */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Eye className="w-4 h-4" />
                تفاصيل المحافظات ({provinceStats.length})
              </h3>
              
              {provinceStats.length > 0 ? (
                <div className="grid gap-2 max-h-60 overflow-y-auto">
                  {provinceStats.map((province, index) => (
                    <motion.div
                      key={province.province}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      <div className="bg-gradient-to-br from-card to-card/60 rounded-lg p-3 border border-border/60 hover:border-primary/30 transition-all duration-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-sm font-bold">
                              {index + 1}
                            </div>
                            <div>
                              <h4 className="font-semibold text-sm text-foreground">{province.province}</h4>
                              <p className="text-xs text-muted-foreground">{province.orderCount} طلب</p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3 text-right">
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">الإيرادات</p>
                              <p className="font-bold text-sm text-green-600 dark:text-green-400">
                                {province.totalRevenue.toLocaleString()}
                              </p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">المتوسط</p>
                              <p className="font-bold text-sm text-blue-600 dark:text-blue-400">
                                {Math.round(province.avgOrderValue).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        {/* شريط التقدم */}
                        <div className="mt-2">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-muted-foreground">المساهمة</span>
                            <span className="text-xs font-bold text-primary">
                              {totalOrders > 0 ? ((province.orderCount / totalOrders) * 100).toFixed(1) : 0}%
                            </span>
                          </div>
                          <div className="w-full bg-muted/50 rounded-full h-2 overflow-hidden">
                            <div 
                              className="bg-gradient-to-r from-primary to-primary/80 h-2 rounded-full transition-all duration-300"
                              style={{ 
                                width: `${totalOrders > 0 ? (province.orderCount / totalOrders) * 100 : 0}%`
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="bg-gradient-to-br from-card to-card/60 rounded-lg p-8 border border-border/60">
                  <div className="text-center">
                    <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm font-semibold text-muted-foreground mb-1">لا توجد بيانات محافظات</p>
                    <p className="text-xs text-muted-foreground">لا توجد طلبات مكتملة للفترة المحددة</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TopProvincesDialog;