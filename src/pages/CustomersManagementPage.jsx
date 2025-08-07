import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { getUserUUID } from '@/utils/userIdUtils';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, UserPlus, MapPin, Star, Heart, Crown, Gem, UserCheck, Search, Filter, Download, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import CustomerCard from '@/components/customers/CustomerCard';
import CustomerDetailsDialog from '@/components/customers/CustomerDetailsDialog';
import EnhancedExportDialog from '@/components/customers/EnhancedExportDialog';
import TopProvincesDialog from '@/components/customers/TopProvincesDialog';
import { Badge } from '@/components/ui/badge';

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
    <div className="container mx-auto p-4 space-y-6">
      <Helmet>
        <title>إدارة العملاء - نظام إدارة المخزون</title>
      </Helmet>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-8 w-8 text-primary" />
            إدارة العملاء
          </h1>
          <p className="text-muted-foreground mt-1">
            إدارة وتتبع بيانات العملاء ومستويات الولاء
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            تحديث
          </Button>
          <Button onClick={() => setIsExportDialogOpen(true)} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            تصدير
          </Button>
          <Button onClick={() => setIsTopProvincesDialogOpen(true)} variant="outline" size="sm">
            <MapPin className="h-4 w-4 mr-2" />
            أفضل المحافظات
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">إجمالي العملاء</p>
                <p className="text-2xl font-bold text-primary">{customerStats.total}</p>
              </div>
              <Users className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">المدن</p>
                <p className="text-2xl font-bold text-primary">{customerStats.citiesCount}</p>
              </div>
              <MapPin className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">ذكور</p>
                <p className="text-2xl font-bold text-blue-600">{customerStats.genderStats['male'] || 0}</p>
              </div>
              <UserCheck className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">إناث</p>
                <p className="text-2xl font-bold text-pink-600">{customerStats.genderStats['female'] || 0}</p>
              </div>
              <Heart className="h-8 w-8 text-pink-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="البحث بالاسم، الهاتف، المدينة، أو العنوان..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Select value={filters.city} onValueChange={(value) => setFilters(prev => ({ ...prev, city: value }))}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="تصفية بالمدينة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع المدن</SelectItem>
              {customerStats.cities.map(city => (
                <SelectItem key={city} value={city}>{city}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.gender} onValueChange={(value) => setFilters(prev => ({ ...prev, gender: value }))}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="الجنس" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="male">ذكر</SelectItem>
              <SelectItem value="female">أنثى</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Customers Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="mr-2 text-muted-foreground">جاري تحميل البيانات من النظام الموحد...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence>
            {filteredCustomers.map((customer, index) => (
              <motion.div
                key={customer.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
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
        <div className="text-center py-12">
          <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">لا توجد نتائج</h3>
          <p className="text-muted-foreground">
            {searchTerm ? 'لم يتم العثور على عملاء يطابقون البحث' : 'لا توجد عملاء حالياً'}
          </p>
        </div>
      )}

      {/* Dialogs */}
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
    </div>
  );
};

export default CustomersManagementPage;