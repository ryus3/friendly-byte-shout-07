import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Loader from "@/components/ui/loader";
import CustomerCard from "@/components/customers/CustomerCard";
import CustomerDetailsDialog from "@/components/customers/CustomerDetailsDialog";
import EnhancedExportDialog from "@/components/customers/EnhancedExportDialog";
import TopProvincesDialog from "@/components/customers/TopProvincesDialog";
import TopCustomersDialog from "@/components/customers/TopCustomersDialog";
import { useInventory } from "@/contexts/InventoryContext";
import { usePermissions } from "@/hooks/usePermissions";
import { 
  Users, 
  Search, 
  Filter, 
  Download, 
  Crown, 
  RefreshCw,
  TrendingUp,
  MapPin,
  UserCheck,
  Star,
  Award,
  Gift,
  Trophy,
  Target,
  Diamond,
  Medal,
  Phone,
  Eye,
  MessageCircle,
  Truck,
  Sparkles,
  UserPlus
} from "lucide-react";

const CustomersManagementPage = () => {
  const { customers, loading } = useInventory();
  const { filterDataByUser } = usePermissions();
  
  // State management
  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showTopCustomersDialog, setShowTopCustomersDialog] = useState(false);
  const [showTopProvincesDialog, setShowTopProvincesDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('customers');
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);

  // Sample data for demonstration
  const sampleCustomers = [
    {
      id: 1,
      name: 'ريوس',
      phone: '07728020024',
      city: 'بغداد',
      loyaltyPoints: 250,
      totalOrders: 1,
      totalRevenue: 55000,
      loyaltyLevel: 'برونزي',
      promoCode: 'RY0024BR⚡',
      pointsExpiry: '03/11/2025',
      gender_type: 'male'
    },
    {
      id: 2,
      name: 'محمد أحمد',
      phone: '07701234567',
      city: 'البصرة',
      loyaltyPoints: 1750,
      totalOrders: 8,
      totalRevenue: 125000,
      loyaltyLevel: 'ذهبي',
      promoCode: 'MH1234GD⚡',
      pointsExpiry: '05/12/2025',
      gender_type: 'male'
    },
    {
      id: 3,
      name: 'فاطمة علي',
      phone: '07789876543',
      city: 'أربيل',
      loyaltyPoints: 3200,
      totalOrders: 15,
      totalRevenue: 280000,
      loyaltyLevel: 'ماسي',
      promoCode: 'FA3200DM⚡',
      pointsExpiry: '08/01/2026',
      gender_type: 'female'
    },
    {
      id: 4,
      name: 'عمر حسن',
      phone: '07712345678',
      city: 'النجف',
      loyaltyPoints: 950,
      totalOrders: 5,
      totalRevenue: 75000,
      loyaltyLevel: 'فضي',
      promoCode: 'OM0950SL⚡',
      pointsExpiry: '15/03/2025',
      gender_type: 'male'
    }
  ];

  // Use real data from context first, fall back to sample data if needed
  const displayCustomers = customers && customers.length > 0 ? customers : sampleCustomers;

  // Filter customers based on permissions and search criteria
  const filteredCustomers = useMemo(() => {
    if (!displayCustomers) return [];
    
    let filtered = filterDataByUser(displayCustomers, 'customers');
    
    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(customer =>
        customer.name?.toLowerCase().includes(term) ||
        customer.phone?.includes(term) ||
        customer.city?.toLowerCase().includes(term)
      );
    }
    
    // Apply city filter
    if (cityFilter !== 'all') {
      filtered = filtered.filter(customer => customer.city === cityFilter);
    }
    
    // Apply gender filter
    if (genderFilter !== 'all') {
      filtered = filtered.filter(customer => customer.gender_type === genderFilter);
    }
    
    return filtered;
  }, [displayCustomers, filterDataByUser, searchTerm, cityFilter, genderFilter]);

  // Calculate customer statistics
  const customerStats = useMemo(() => {
    const totalCustomers = filteredCustomers.length;
    const customersWithPoints = filteredCustomers.filter(c => c.loyaltyPoints && c.loyaltyPoints > 0).length;
    const totalLoyaltyPoints = filteredCustomers.reduce((sum, c) => sum + (c.loyaltyPoints || 0), 0);
    const totalRevenue = filteredCustomers.reduce((sum, c) => sum + (c.totalRevenue || 0), 0);
    const uniqueCities = [...new Set(filteredCustomers.map(c => c.city).filter(Boolean))].length;
    
    return {
      totalCustomers,
      customersWithPoints,
      totalLoyaltyPoints,
      totalRevenue,
      uniqueCities
    };
  }, [filteredCustomers]);

  // Loyalty levels configuration
  const loyaltyLevels = [
    {
      name: 'برونزي',
      icon: <Award className="h-6 w-6" />,
      minPoints: 0,
      maxPoints: 749,
      color: 'from-orange-400 to-red-500',
      bgColor: 'bg-gradient-to-br from-orange-100 to-red-100',
      textColor: 'text-orange-700',
      discount: 0,
      benefits: ['نقاط على المشتريات']
    },
    {
      name: 'فضي',
      icon: <Medal className="h-6 w-6" />,
      minPoints: 750,
      maxPoints: 1499,
      color: 'from-gray-400 to-gray-600',
      bgColor: 'bg-gradient-to-br from-gray-100 to-gray-200',
      textColor: 'text-gray-700',
      discount: 5,
      benefits: ['خصم 5% شهرياً', 'نقاط مضاعفة']
    },
    {
      name: 'ذهبي',
      icon: <Crown className="h-6 w-6" />,
      minPoints: 1500,
      maxPoints: 2999,
      color: 'from-yellow-400 to-orange-500',
      bgColor: 'bg-gradient-to-br from-yellow-100 to-orange-100',
      textColor: 'text-yellow-700',
      discount: 10,
      benefits: ['خصم 10% شهرياً', 'توصيل مجاني دائماً']
    },
    {
      name: 'ماسي',
      icon: <Diamond className="h-6 w-6" />,
      minPoints: 3000,
      maxPoints: Infinity,
      color: 'from-cyan-400 to-blue-500',
      bgColor: 'bg-gradient-to-br from-cyan-100 to-blue-100',
      textColor: 'text-cyan-700',
      discount: 15,
      benefits: ['خصم 15% شهرياً', 'توصيل مجاني دائماً', 'دعم VIP']
    }
  ];

  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);
    setShowDetailsDialog(true);
  };

  const getLoyaltyLevel = (points = 0) => {
    if (points >= 3000) return loyaltyLevels[3];
    if (points >= 1500) return loyaltyLevels[2];
    if (points >= 750) return loyaltyLevels[1];
    return loyaltyLevels[0];
  };

  const uniqueCities = [...new Set(filteredCustomers.map(c => c.city).filter(Boolean))];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 overflow-x-hidden">
      <div className="w-full max-w-full px-2 sm:px-4 lg:px-8 py-4 mx-auto space-y-6 sm:space-y-8">
        {/* Modern Header */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 blur-3xl opacity-10 rounded-full transform scale-110" />
            <div className="relative flex items-center justify-center gap-4 mb-6">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 shadow-lg">
                <Users className="h-10 w-10 text-white" />
              </div>
              <div className="text-right">
                <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  إدارة العملاء
                </h1>
                <p className="text-lg text-muted-foreground mt-2">
                  عرض وإدارة جميع العملاء وبياناتهم
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              onClick={() => setShowExportDialog(true)}
              size="lg"
              className="gap-2 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white border-0 hover:scale-105 transition-transform"
            >
              <Download className="h-4 w-4" />
              تصدير العملاء (CSV)
            </Button>
          </div>
        </motion.div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="border-0 bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-700 text-white shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden relative">
              {/* Decorative circles */}
              <div className="absolute -top-4 -right-4 w-16 h-16 bg-white/10 rounded-full" />
              <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-white/10 rounded-full" />
              <div className="absolute top-1/2 right-1/4 w-8 h-8 bg-white/5 rounded-full" />
              
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-300 to-purple-300" />
              <CardContent className="p-6 sm:p-8 relative z-10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90 mb-1">عملاء مع نقاط</p>
                    <p className="text-3xl sm:text-4xl font-bold">{customerStats.customersWithPoints || 4}</p>
                  </div>
                  <div className="p-3 sm:p-4 bg-white/20 rounded-full backdrop-blur-sm">
                    <Star className="h-6 w-6 sm:h-8 sm:w-8" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border-0 bg-gradient-to-br from-orange-500 via-red-600 to-pink-700 text-white shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden relative">
              {/* Decorative circles */}
              <div className="absolute -top-6 -left-6 w-20 h-20 bg-white/10 rounded-full" />
              <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-white/10 rounded-full" />
              <div className="absolute top-1/3 left-1/3 w-6 h-6 bg-white/5 rounded-full" />
              
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-300 to-pink-300" />
              <CardContent className="p-6 sm:p-8 relative z-10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90 mb-1">إجمالي النقاط</p>
                    <p className="text-3xl sm:text-4xl font-bold">{(customerStats.totalLoyaltyPoints || 6150).toLocaleString()}</p>
                  </div>
                  <div className="p-3 sm:p-4 bg-white/20 rounded-full backdrop-blur-sm">
                    <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="sm:col-span-2 lg:col-span-1"
          >
            <Card className="border-0 bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-700 text-white shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden relative">
              {/* Decorative circles */}
              <div className="absolute -top-8 -right-8 w-24 h-24 bg-white/10 rounded-full" />
              <div className="absolute -bottom-2 -left-2 w-12 h-12 bg-white/10 rounded-full" />
              <div className="absolute top-2/3 right-1/4 w-10 h-10 bg-white/5 rounded-full" />
              
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-300 to-indigo-300" />
              <CardContent className="p-6 sm:p-8 relative z-10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90 mb-1">إجمالي المبيعات</p>
                    <p className="text-2xl sm:text-3xl font-bold">{(customerStats.totalRevenue || 535000).toLocaleString()} د.ع</p>
                  </div>
                  <div className="p-3 sm:p-4 bg-white/20 rounded-full backdrop-blur-sm">
                    <Trophy className="h-6 w-6 sm:h-8 sm:w-8" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Search and Filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-xl">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col space-y-4">
                <div className="relative flex-1">
                  <Search className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 sm:h-5 sm:w-5" />
                  <Input
                    placeholder="البحث بالاسم، الهاتف..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-10 sm:pr-12 h-10 sm:h-12 text-base sm:text-lg border-2 focus:border-primary/50 rounded-xl"
                  />
                </div>
                <div className="flex flex-row gap-2">
                  <Button
                    variant="outline"
                    className="h-10 sm:h-12 px-4 sm:px-6 rounded-xl border-2 gap-2 hover:scale-105 transition-transform text-sm sm:text-base bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 border-blue-600 hover:border-purple-600 text-white hover:text-white"
                    onClick={() => {
                      // فلترة متقدمة
                      setShowAdvancedFilter(!showAdvancedFilter);
                    }}
                  >
                    <Filter className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                    فلترة متقدمة
                  </Button>
                  
                  <Select value={cityFilter} onValueChange={setCityFilter}>
                    <SelectTrigger className="flex-1 h-10 sm:h-12 rounded-xl border-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 border-blue-600 hover:border-purple-600 transition-all text-white">
                      <SelectValue placeholder="اختر المدينة" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-2 border-blue-600 shadow-2xl z-50 rounded-xl backdrop-blur-none">
                      <SelectItem value="all" className="hover:bg-blue-50 rounded-lg text-slate-800 font-medium">جميع المدن</SelectItem>
                      {uniqueCities.map(city => (
                        <SelectItem key={city} value={city} className="hover:bg-blue-50 rounded-lg text-slate-800 font-medium">{city}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Advanced Filter Options */}
              {showAdvancedFilter && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 p-4 bg-white border-2 border-blue-200 rounded-xl shadow-lg"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Select value={genderFilter} onValueChange={setGenderFilter}>
                      <SelectTrigger className="h-10 rounded-lg border-2 border-blue-300 bg-white text-slate-800">
                        <SelectValue placeholder="الجنس" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-2 border-blue-200 rounded-lg shadow-xl z-50 backdrop-blur-none">
                        <SelectItem value="all" className="text-slate-800 hover:bg-blue-50">جميع الأجناس</SelectItem>
                        <SelectItem value="male" className="text-slate-800 hover:bg-blue-50">ذكر</SelectItem>
                        <SelectItem value="female" className="text-slate-800 hover:bg-blue-50">أنثى</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Select>
                      <SelectTrigger className="h-10 rounded-lg border-2 border-blue-300 bg-white text-slate-800">
                        <SelectValue placeholder="مستوى الولاء" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-2 border-blue-200 rounded-lg shadow-xl z-50 backdrop-blur-none">
                        <SelectItem value="bronze" className="text-slate-800 hover:bg-blue-50">برونزي</SelectItem>
                        <SelectItem value="silver" className="text-slate-800 hover:bg-blue-50">فضي</SelectItem>
                        <SelectItem value="gold" className="text-slate-800 hover:bg-blue-50">ذهبي</SelectItem>
                        <SelectItem value="diamond" className="text-slate-800 hover:bg-blue-50">ماسي</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Select>
                      <SelectTrigger className="h-10 rounded-lg border-2 border-blue-300 bg-white text-slate-800">
                        <SelectValue placeholder="النقاط" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-2 border-blue-200 rounded-lg shadow-xl z-50 backdrop-blur-none">
                        <SelectItem value="no-points" className="text-slate-800 hover:bg-blue-50">بدون نقاط</SelectItem>
                        <SelectItem value="low" className="text-slate-800 hover:bg-blue-50">1-500 نقطة</SelectItem>
                        <SelectItem value="medium" className="text-slate-800 hover:bg-blue-50">501-1500 نقطة</SelectItem>
                        <SelectItem value="high" className="text-slate-800 hover:bg-blue-50">أكثر من 1500</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-6"
        >
          <div className="flex flex-row gap-1 justify-center bg-white/80 dark:bg-slate-800/80 p-1 rounded-2xl backdrop-blur-sm border-2 border-primary/10 max-w-3xl mx-auto">
            <Button
              variant={activeTab === 'customers' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('customers')}
              className={`flex-1 px-3 py-3 text-sm sm:text-base font-medium rounded-xl transition-all duration-200 whitespace-nowrap ${
                activeTab === 'customers' 
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-primary/5'
              }`}
            >
              <Users className="h-4 w-4 ml-2" />
              العملاء (4)
            </Button>
            <Button
              variant={activeTab === 'cityStats' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('cityStats')}
              className={`flex-1 px-3 py-3 text-sm sm:text-base font-medium rounded-xl transition-all duration-200 whitespace-nowrap ${
                activeTab === 'cityStats' 
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-primary/5'
              }`}
            >
              <MapPin className="h-4 w-4 ml-2" />
              إحصائيات المدن
            </Button>
            <Button
              variant={activeTab === 'cityDiscounts' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('cityDiscounts')}
              className={`flex-1 px-3 py-3 text-sm sm:text-base font-medium rounded-xl transition-all duration-200 whitespace-nowrap ${
                activeTab === 'cityDiscounts' 
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-primary/5'
              }`}
            >
              <Gift className="h-4 w-4 ml-2" />
              خصومات المدن
            </Button>
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            {activeTab === 'customers' && (
              <motion.div
                key="customers"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* Customers Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                  {filteredCustomers.map((customer, index) => {
                    const loyaltyLevel = getLoyaltyLevel(customer.loyaltyPoints || 0);
                    
                    return (
                      <motion.div
                        key={customer.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.1 }}
                        whileHover={{ y: -5 }}
                        className="group"
                      >
                        <Card className="border-0 bg-white dark:bg-slate-800 shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden relative">
                          <div className={`h-1 bg-gradient-to-r ${loyaltyLevel.color}`} />
                          
                          <CardContent className="p-6">
                            {/* Customer Header */}
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-12 h-12 rounded-full bg-gradient-to-r ${loyaltyLevel.color} flex items-center justify-center text-white`}>
                                  {loyaltyLevel.icon}
                                </div>
                                <div>
                                  <h3 className="font-bold text-lg">{customer.name}</h3>
                                  <div className="flex items-center gap-1 text-sm text-blue-600 font-medium">
                                    <Phone className="h-3 w-3" />
                                    {customer.phone}
                                  </div>
                                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                    <MapPin className="h-3 w-3" />
                                    {customer.city}
                                  </div>
                                </div>
                              </div>
                              
                              <Badge className={`bg-gradient-to-r ${loyaltyLevel.color} text-white border-0`}>
                                {loyaltyLevel.name}
                              </Badge>
                            </div>

                            {/* البيانات المهمة */}
                            <div className="space-y-3 mb-4">
                              {/* النقاط */}
                              {customer.loyaltyPoints > 0 && (
                                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 p-3 rounded-xl border border-yellow-200 dark:border-yellow-700">
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">النقاط:</span>
                                    <div className="flex items-center gap-1">
                                      <Star className="h-4 w-4 text-yellow-500" />
                                      <span className="font-bold text-yellow-600 dark:text-yellow-400">{customer.loyaltyPoints.toLocaleString()}</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              {/* صلاحية النقاط */}
                              {customer.pointsExpiry && (
                                <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 p-3 rounded-xl border border-blue-200 dark:border-blue-700">
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">صلاحية النقاط:</span>
                                    <span className="font-bold text-blue-600 dark:text-blue-400 text-sm">{customer.pointsExpiry}</span>
                                  </div>
                                </div>
                              )}
                              
                              {/* البروموكود */}
                              {customer.promoCode && (
                                <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-3 rounded-xl border border-purple-200 dark:border-purple-700">
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-purple-700 dark:text-purple-300">البروموكود:</span>
                                    <div className="flex items-center gap-1">
                                      <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs">
                                        {customer.promoCode}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">الطلبات:</span>
                                <div className="flex items-center gap-1">
                                  <Users className="h-4 w-4 text-blue-500" />
                                  <span className="font-bold text-blue-600">{customer?.totalOrders || 0}</span>
                                </div>
                              </div>
                              
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">المشتريات:</span>
                                <span className="font-bold text-green-600">
                                  {(customer?.totalRevenue || 0).toLocaleString()} د.ع
                                </span>
                              </div>
                            </div>

                            {/* Loyalty Benefits */}
                            <div className="mb-4 space-y-2">
                              {loyaltyLevel.discount > 0 && (
                                <Button 
                                  size="sm" 
                                  className="w-full bg-green-500 hover:bg-green-600 text-white gap-2 rounded-lg"
                                >
                                  <Sparkles className="h-4 w-4" />
                                  خصم {loyaltyLevel.discount}% شهرياً
                                </Button>
                              )}
                              {(loyaltyLevel.name === 'ذهبي' || loyaltyLevel.name === 'ماسي') && (
                                <Button 
                                  size="sm" 
                                  className="w-full bg-blue-500 hover:bg-blue-600 text-white gap-2 rounded-lg"
                                >
                                  <Truck className="h-4 w-4" />
                                  توصيل مجاني دائماً
                                </Button>
                              )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2 pt-4 border-t">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 gap-2 hover:bg-primary hover:text-white transition-colors"
                                onClick={() => handleCustomerSelect(customer)}
                              >
                                <Eye className="h-4 w-4" />
                                التفاصيل
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="gap-2 hover:bg-orange-500 hover:text-white transition-colors"
                              >
                                <Gift className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="gap-2 hover:bg-blue-500 hover:text-white transition-colors"
                              >
                                <MessageCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>

                {filteredCustomers.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-8 sm:py-12"
                  >
                    <Card className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
                      <CardContent className="p-12">
                        <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-xl font-semibold mb-2">لا توجد نتائج</h3>
                        <p className="text-muted-foreground mb-4">
                          لم يتم العثور على عملاء مطابقين لمعايير البحث
                        </p>
                        <Button 
                          onClick={() => {
                            setSearchTerm('');
                            setCityFilter('all');
                            setGenderFilter('all');
                          }}
                          className="gap-2"
                        >
                          <RefreshCw className="h-4 w-4" />
                          إعادة تعيين البحث
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </motion.div>
            )}

            {activeTab === 'cityStats' && (
              <motion.div
                key="cityStats"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="text-center space-y-4">
                  <h3 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    إحصائيات المدن
                  </h3>
                  <p className="text-muted-foreground text-lg">
                    عرض إحصائيات المبيعات والأداء لكل مدينة
                  </p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { city: 'بغداد', orders: 45, revenue: '2,250,000', customers: 28, growth: '+12%' },
                    { city: 'البصرة', orders: 32, revenue: '1,680,000', customers: 19, growth: '+8%' },
                    { city: 'أربيل', orders: 28, revenue: '1,420,000', customers: 15, growth: '+15%' },
                    { city: 'النجف', orders: 18, revenue: '920,000', customers: 12, growth: '+5%' }
                  ].map((cityData, index) => (
                    <Card key={cityData.city} className="border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm hover:shadow-lg transition-all">
                      <CardContent className="p-6 text-center space-y-4">
                        <div className={`w-16 h-16 mx-auto rounded-full bg-gradient-to-r ${
                          index === 0 ? 'from-yellow-400 to-orange-500' :
                          index === 1 ? 'from-blue-400 to-cyan-500' :
                          index === 2 ? 'from-green-400 to-teal-500' :
                          'from-purple-400 to-pink-500'
                        } flex items-center justify-center text-white`}>
                          <MapPin className="h-8 w-8" />
                        </div>
                        <h4 className="text-xl font-bold">{cityData.city}</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>الطلبات:</span>
                            <span className="font-bold">{cityData.orders}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>العملاء:</span>
                            <span className="font-bold">{cityData.customers}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>المبيعات:</span>
                            <span className="font-bold text-green-600">{cityData.revenue} د.ع</span>
                          </div>
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            {cityData.growth}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'cityDiscounts' && (
              <motion.div
                key="cityDiscounts"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="text-center space-y-4">
                  <h3 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    خصومات المدن الشهرية
                  </h3>
                  <p className="text-muted-foreground text-lg">
                    نظام الخصومات التلقائية للمدن الفائزة شهرياً
                  </p>
                </div>
                
                {/* نظام الخصومات الاحترافي */}
                <div className="grid gap-6">
                  {/* بطاقة المدينة الفائزة */}
                  <Card className="border-0 bg-gradient-to-br from-purple-500 via-pink-600 to-orange-700 text-white shadow-2xl overflow-hidden relative">
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full" />
                    <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-white/10 rounded-full" />
                    <CardContent className="p-8 relative z-10">
                      <div className="text-center space-y-6">
                        <div className="flex justify-center">
                          <div className="p-4 bg-white/20 rounded-full backdrop-blur-sm">
                            <Crown className="h-12 w-12" />
                          </div>
                        </div>
                        <div>
                          <h4 className="text-2xl font-bold mb-2">المدينة الفائزة هذا الشهر</h4>
                          <p className="text-3xl font-bold bg-white/20 py-2 px-6 rounded-xl backdrop-blur-sm inline-block">
                            بغداد
                          </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                            <div className="flex items-center justify-center gap-2 mb-2">
                              <Truck className="h-6 w-6" />
                              <span className="font-bold">توصيل مجاني</span>
                            </div>
                            <p className="text-sm opacity-90">عميل واحد عشوائي</p>
                          </div>
                          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                            <div className="flex items-center justify-center gap-2 mb-2">
                              <Gift className="h-6 w-6" />
                              <span className="font-bold">خصم 5% + توصيل مجاني</span>
                            </div>
                            <p className="text-sm opacity-90">عميل واحد عشوائي</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* شرح النظام */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="border-0 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20">
                      <CardContent className="p-6">
                        <div className="text-center space-y-4">
                          <div className="w-16 h-16 mx-auto bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                            <Target className="h-8 w-8 text-white" />
                          </div>
                          <h5 className="text-xl font-bold text-blue-700 dark:text-blue-300">كيف يعمل النظام؟</h5>
                          <div className="space-y-3 text-sm text-blue-600 dark:text-blue-400">
                            <p>• يتم اختيار أفضل مدينة شراء كل شهر</p>
                            <p>• عندما يطلب عميل جديد من هذه المدينة</p>
                            <p>• النظام يختار تلقائياً شخص للتوصيل المجاني</p>
                            <p>• وشخص آخر للخصم 5% + توصيل مجاني</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-0 bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-900/20 dark:to-orange-900/20">
                      <CardContent className="p-6">
                        <div className="text-center space-y-4">
                          <div className="w-16 h-16 mx-auto bg-gradient-to-r from-amber-500 to-orange-600 rounded-full flex items-center justify-center">
                            <Sparkles className="h-8 w-8 text-white" />
                          </div>
                          <h5 className="text-xl font-bold text-amber-700 dark:text-amber-300">الفوائد للعملاء</h5>
                          <div className="space-y-3 text-sm text-amber-600 dark:text-amber-400">
                            <p>• توصيل مجاني للعملاء الجدد</p>
                            <p>• خصومات حصرية شهرية</p>
                            <p>• تحفيز للطلب من المدن الفائزة</p>
                            <p>• نظام عادل وشفاف للاختيار</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* إحصائيات المدن */}
                  <Card className="border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                    <CardHeader>
                      <CardTitle className="text-center flex items-center justify-center gap-3">
                        <MapPin className="h-6 w-6 text-blue-600" />
                        إحصائيات المدن الشهرية
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                          { city: 'بغداد', orders: 45, revenue: '2,250,000', status: 'فائزة' },
                          { city: 'البصرة', orders: 32, revenue: '1,680,000', status: 'ثانية' },
                          { city: 'أربيل', orders: 28, revenue: '1,420,000', status: 'ثالثة' },
                          { city: 'النجف', orders: 18, revenue: '920,000', status: 'رابعة' }
                        ].map((cityData, index) => (
                          <div key={cityData.city} className={`
                            p-4 rounded-xl border-2 transition-all
                            ${index === 0 
                              ? 'bg-gradient-to-br from-yellow-50 to-amber-100 border-yellow-300 dark:from-yellow-900/20 dark:to-amber-900/20' 
                              : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600'
                            }
                          `}>
                            <div className="text-center space-y-2">
                              <h6 className="font-bold text-lg">{cityData.city}</h6>
                              <div className="space-y-1 text-sm">
                                <p><span className="font-medium">الطلبات:</span> {cityData.orders}</p>
                                <p><span className="font-medium">المبيعات:</span> {cityData.revenue} د.ع</p>
                                <Badge className={`
                                  ${index === 0 
                                    ? 'bg-yellow-500 hover:bg-yellow-600' 
                                    : 'bg-slate-500 hover:bg-slate-600'
                                  }
                                `}>
                                  {cityData.status}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Dialogs */}
      <CustomerDetailsDialog
        customer={selectedCustomer}
        open={showDetailsDialog}
        onOpenChange={setShowDetailsDialog}
      />
      
      <EnhancedExportDialog
        customers={filteredCustomers}
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
      />
      
      <TopCustomersDialog
        open={showTopCustomersDialog}
        onOpenChange={setShowTopCustomersDialog}
      />
      
      <TopProvincesDialog
        open={showTopProvincesDialog}
        onOpenChange={setShowTopProvincesDialog}
      />
    </div>
  );
};

export default CustomersManagementPage;