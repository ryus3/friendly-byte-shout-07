import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { getUserUUID } from '@/utils/userIdUtils';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, UserPlus, MapPin, Star, Heart, Crown, Gem, UserCheck, Search, Filter, 
  Download, Loader2, RefreshCw, Trophy, Target, TrendingUp, Award,
  Gift, Sparkles, Medal, Shield, Eye, BarChart3, DollarSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import CustomerCard from '@/components/customers/CustomerCard';
import CustomerDetailsDialog from '@/components/customers/CustomerDetailsDialog';
import EnhancedExportDialog from '@/components/customers/EnhancedExportDialog';
import TopProvincesDialog from '@/components/customers/TopProvincesDialog';
import TopCustomersDialog from '@/components/dashboard/TopCustomersDialog';
import UnifiedCustomersStats from '@/components/customers/UnifiedCustomersStats';

/**
 * صفحة إدارة العملاء - إصلاح جذري
 * يستخدم البيانات الموحدة من useInventory بدلاً من الطلبات المنفصلة
 */
const CustomersManagementPage = () => {
  const { user, canViewAllData } = useAuth();
  const { customers, orders, loading } = useInventory(); // استخدام البيانات الموحدة فقط!
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isTopProvincesDialogOpen, setIsTopProvincesDialogOpen] = useState(false);
  const [isTopCustomersDialogOpen, setIsTopCustomersDialogOpen] = useState(false);
  const [loyaltyTiers, setLoyaltyTiers] = useState([]);
  const [filters, setFilters] = useState({
    city: 'all',
    loyaltyTier: 'all',
    gender: 'all'
  });

  // أيقونات مستويات الولاء
  const tierIcons = {
    'Bronze': UserCheck,
    'Silver': Star,
    'Gold': Crown,
    'Platinum': Heart,
    'Diamond': Gem,
    'Star': Star
  };

  // لا حاجة لـ fetchData منفصلة - البيانات متوفرة من النظام الموحد!
  // إزالة جميع الطلبات المنفصلة لـ supabase.from()

  // فلترة العملاء من البيانات الموحدة
  const filteredCustomers = React.useMemo(() => {
    if (!customers || !Array.isArray(customers)) return [];
    
    console.log('📊 فلترة العملاء من البيانات الموحدة - بدون طلبات منفصلة');
    
    let filtered = customers;

    // فلترة حسب الصلاحيات
    if (!canViewAllData) {
      const userUUID = getUserUUID(user);
      // الموظفين يرون عملاءهم فقط (من الطلبات التي أنشؤوها)
      const userOrderCustomers = orders?.filter(order => order.created_by === userUUID)
        .map(order => order.customer_phone)
        .filter(Boolean);
      
      const uniqueCustomerPhones = [...new Set(userOrderCustomers)];
      filtered = customers.filter(customer => 
        uniqueCustomerPhones.includes(customer.phone)
      );
    }

    // فلترة حسب البحث
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(customer =>
        customer.name?.toLowerCase().includes(term) ||
        customer.phone?.includes(term) ||
        customer.city?.toLowerCase().includes(term) ||
        customer.address?.toLowerCase().includes(term)
      );
    }

    // فلترة حسب المدينة
    if (filters.city !== 'all') {
      filtered = filtered.filter(customer => customer.city === filters.city);
    }

    // فلترة حسب الجنس
    if (filters.gender !== 'all') {
      filtered = filtered.filter(customer => customer.gender_type === filters.gender);
    }

    console.log('✅ تم فلترة العملاء:', {
      total: customers.length,
      filtered: filtered.length,
      canViewAll: canViewAllData
    });

    return filtered;
  }, [customers, orders, canViewAllData, user, searchTerm, filters]);

  // إحصائيات العملاء من البيانات الموحدة
  const customerStats = React.useMemo(() => {
    const total = filteredCustomers.length;
    const cities = [...new Set(filteredCustomers.map(c => c.city).filter(Boolean))];
    const genderStats = filteredCustomers.reduce((acc, customer) => {
      const gender = customer.gender_type || 'غير محدد';
      acc[gender] = (acc[gender] || 0) + 1;
      return acc;
    }, {});

    return {
      total,
      citiesCount: cities.length,
      cities,
      genderStats
    };
  }, [filteredCustomers]);

  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);
    setIsDetailsDialogOpen(true);
  };

  const handleRefresh = () => {
    console.log('🔄 تحديث بيانات العملاء من النظام الموحد');
    // البيانات تتحدث تلقائياً من النظام الموحد - لا حاجة لطلبات منفصلة
    toast({
      title: "تم التحديث",
      description: "تم تحديث بيانات العملاء من النظام الموحد"
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <Helmet>
        <title>إدارة العملاء - نظام إدارة المخزون</title>
        <meta name="description" content="نظام متطور لإدارة العملاء مع تحليلات الولاء والمكافآت الذكية" />
      </Helmet>

      <div className="container mx-auto p-6 space-y-8">
        {/* Header احترافي متطور */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-purple-200/50 dark:border-purple-800/50"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-pink-500/10" />
          <div className="relative p-8">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              <div className="space-y-4">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="flex items-center gap-4"
                >
                  <div className="relative">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <Users className="h-8 w-8 text-white" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                      <Crown className="h-3 w-3 text-white" />
                    </div>
                  </div>
                  <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
                      مركز إدارة العملاء المتطور
                    </h1>
                    <p className="text-muted-foreground text-lg">
                      نظام ذكي شامل لإدارة العملاء ونقاط الولاء والمكافآت التفاعلية
                    </p>
                  </div>
                </motion.div>
                
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex flex-wrap gap-3"
                >
                  <Badge variant="secondary" className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-3 py-1">
                    <Star className="h-3 w-3 mr-1" />
                    نظام الولاء الذكي
                  </Badge>
                  <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1">
                    <Target className="h-3 w-3 mr-1" />
                    تحليلات متقدمة
                  </Badge>
                  <Badge variant="secondary" className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-3 py-1">
                    <Gift className="h-3 w-3 mr-1" />
                    مكافآت تلقائية
                  </Badge>
                </motion.div>
              </div>
              
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="flex flex-wrap gap-3"
              >
                <Button onClick={handleRefresh} variant="outline" size="lg" className="shadow-lg hover:shadow-xl transition-all duration-300">
                  <RefreshCw className="h-5 w-5 mr-2" />
                  تحديث البيانات
                </Button>
                <Button onClick={() => setIsExportDialogOpen(true)} variant="outline" size="lg" className="shadow-lg hover:shadow-xl transition-all duration-300">
                  <Download className="h-5 w-5 mr-2" />
                  تصدير التقارير
                </Button>
                <Button onClick={() => setIsTopCustomersDialogOpen(true)} className="bg-gradient-to-r from-purple-600 to-blue-600 shadow-lg hover:shadow-xl transition-all duration-300">
                  <Trophy className="h-5 w-5 mr-2" />
                  أفضل العملاء
                </Button>
                <Button onClick={() => setIsTopProvincesDialogOpen(true)} className="bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg hover:shadow-xl transition-all duration-300">
                  <Award className="h-5 w-5 mr-2" />
                  أفضل المحافظات
                </Button>
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* إحصائيات العملاء المتطورة */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <UnifiedCustomersStats onStatClick={(statId) => {
            console.log('🎯 نقر على الإحصائية:', statId);
            if (statId === 'total' || statId === 'with_points') {
              setIsTopCustomersDialogOpen(true);
            }
          }} />
        </motion.div>

        {/* شرح وإرشادات النظام */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/30 border-purple-200 dark:border-purple-700 shadow-xl hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6 text-center">
              <motion.div
                className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ duration: 0.3 }}
              >
                <Crown className="h-8 w-8 text-white" />
              </motion.div>
              <h3 className="text-lg font-bold text-purple-700 dark:text-purple-300 mb-2">نظام الولاء الذكي</h3>
              <p className="text-sm text-purple-600 dark:text-purple-400">
                تراكم النقاط التلقائي مع كل عملية شراء، وترقيات المستويات الذكية لتحفيز العملاء على المزيد من الشراء
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/30 border-blue-200 dark:border-blue-700 shadow-xl hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6 text-center">
              <motion.div
                className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ duration: 0.3 }}
              >
                <BarChart3 className="h-8 w-8 text-white" />
              </motion.div>
              <h3 className="text-lg font-bold text-blue-700 dark:text-blue-300 mb-2">تحليلات متقدمة</h3>
              <p className="text-sm text-blue-600 dark:text-blue-400">
                رؤى عميقة حول سلوك العملاء وتفضيلاتهم، مع تقارير شاملة لاتخاذ قرارات تسويقية مدروسة
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/30 border-green-200 dark:border-green-700 shadow-xl hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6 text-center">
              <motion.div
                className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ duration: 0.3 }}
              >
                <Gift className="h-8 w-8 text-white" />
              </motion.div>
              <h3 className="text-lg font-bold text-green-700 dark:text-green-300 mb-2">مكافآت تلقائية</h3>
              <p className="text-sm text-green-600 dark:text-green-400">
                نظام مكافآت ذكي يمنح خصومات ومزايا خاصة للعملاء المميزين، مع تخصيص عروض لكل مدينة شهرياً
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/30 border-orange-200 dark:border-orange-700 shadow-xl hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6 text-center">
              <motion.div
                className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ duration: 0.3 }}
              >
                <MapPin className="h-8 w-8 text-white" />
              </motion.div>
              <h3 className="text-lg font-bold text-orange-700 dark:text-orange-300 mb-2">مسابقة المحافظات</h3>
              <p className="text-sm text-orange-600 dark:text-orange-400">
                كل شهر يتم اختيار محافظة بشكل تلقائي للحصول على خصم خاص، مما يحفز التنافس الإيجابي بين المناطق
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* أدوات البحث والفلترة المتطورة */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6"
        >
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
                <Input
                  placeholder="🔍 البحث الذكي: الاسم، الهاتف، المدينة، العنوان..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-12 h-12 text-lg bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-purple-500 transition-all duration-300"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Select value={filters.city} onValueChange={(value) => setFilters(prev => ({ ...prev, city: value }))}>
                <SelectTrigger className="w-[200px] h-12 bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600 rounded-xl">
                  <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="🏙️ تصفية بالمدينة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">🌍 جميع المدن</SelectItem>
                  {customerStats.cities.map(city => (
                    <SelectItem key={city} value={city}>📍 {city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filters.gender} onValueChange={(value) => setFilters(prev => ({ ...prev, gender: value }))}>
                <SelectTrigger className="w-[180px] h-12 bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600 rounded-xl">
                  <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="👥 الجنس" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">👫 الكل</SelectItem>
                  <SelectItem value="male">👨 ذكر</SelectItem>
                  <SelectItem value="female">👩 أنثى</SelectItem>
                </SelectContent>
              </Select>

              <Button 
                variant="outline" 
                size="lg"
                className="h-12 px-6 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-purple-200 dark:border-purple-700 hover:shadow-lg transition-all duration-300"
              >
                <Filter className="h-4 w-4 mr-2" />
                مرشحات متقدمة
              </Button>
            </div>
          </div>

          {/* مؤشرات البحث السريع */}
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700">
              <Eye className="h-3 w-3 mr-1" />
              {filteredCustomers.length} عميل ظاهر
            </Badge>
            <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700">
              <Users className="h-3 w-3 mr-1" />
              {customerStats.total} إجمالي
            </Badge>
            <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700">
              <MapPin className="h-3 w-3 mr-1" />
              {customerStats.citiesCount} مدينة
            </Badge>
          </div>
        </motion.div>

        {/* شبكة العملاء المتطورة */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <motion.div
                className="w-20 h-20 border-4 border-purple-200 border-t-purple-600 rounded-full mb-6"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
              <motion.div
                initial={{ opacity: 0.5 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, repeat: Infinity, repeatType: "reverse" }}
                className="text-center"
              >
                <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  🔄 جاري تحليل بيانات العملاء...
                </h3>
                <p className="text-slate-500 dark:text-slate-400">
                  نقوم بمعالجة البيانات من النظام الموحد لضمان الدقة والشمولية
                </p>
              </motion.div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <AnimatePresence mode="popLayout">
                {filteredCustomers.map((customer, index) => (
                  <motion.div
                    key={customer.id}
                    layout
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.9 }}
                    transition={{ 
                      duration: 0.4, 
                      delay: Math.min(index * 0.05, 0.5),
                      type: "spring",
                      stiffness: 100 
                    }}
                    whileHover={{ y: -5, transition: { duration: 0.2 } }}
                  >
                    <CustomerCard
                      customer={customer}
                      onSelect={handleCustomerSelect}
                      tierIcons={tierIcons}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {filteredCustomers.length === 0 && !loading && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="text-center py-20"
            >
              <motion.div
                className="w-32 h-32 mx-auto mb-8 bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 rounded-full flex items-center justify-center"
                animate={{ 
                  y: [0, -10, 0],
                  scale: [1, 1.05, 1]
                }}
                transition={{ 
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <Users className="h-16 w-16 text-purple-500" />
              </motion.div>
              <h3 className="text-2xl font-bold text-slate-700 dark:text-slate-300 mb-4">
                {searchTerm ? '🔍 لا توجد نتائج مطابقة' : '🌟 لا توجد عملاء حالياً'}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-lg max-w-md mx-auto">
                {searchTerm 
                  ? `لم يتم العثور على عملاء يطابقون "${searchTerm}". جرب مصطلحات أخرى أو قم بمراجعة الفلاتر.`
                  : 'ابدأ بإضافة عملاء جدد لبناء قاعدة عملاء قوية ومربحة.'
                }
              </p>
              <motion.div
                className="mt-8"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button 
                  size="lg" 
                  className="bg-gradient-to-r from-purple-600 to-blue-600 shadow-lg hover:shadow-xl transition-all duration-300"
                  onClick={() => setSearchTerm('')}
                >
                  <UserPlus className="h-5 w-5 mr-2" />
                  {searchTerm ? 'مسح البحث' : 'إضافة عميل جديد'}
                </Button>
              </motion.div>
            </motion.div>
          )}
        </motion.div>

        {/* النوافذ المنبثقة */}
        <CustomerDetailsDialog
          customer={selectedCustomer}
          open={isDetailsDialogOpen}
          onClose={() => {
            setIsDetailsDialogOpen(false);
            setSelectedCustomer(null);
          }}
        />

        <EnhancedExportDialog
          open={isExportDialogOpen}
          onClose={() => setIsExportDialogOpen(false)}
          customers={filteredCustomers}
        />

        <TopProvincesDialog
          open={isTopProvincesDialogOpen}
          onClose={() => setIsTopProvincesDialogOpen(false)}
        />

        <TopCustomersDialog
          open={isTopCustomersDialogOpen}
          onClose={() => setIsTopCustomersDialogOpen(false)}
        />
      </div>
    </div>
  );
};

export default CustomersManagementPage;