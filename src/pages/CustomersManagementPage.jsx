import React, { useState, useMemo, useEffect } from 'react';
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
import CityDiscountsContent from "@/components/customers/CityDiscountsContent";
import { supabase } from "@/integrations/supabase/client";
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
  const [loyaltyLevelFilter, setLoyaltyLevelFilter] = useState('all');
  const [pointsRangeFilter, setPointsRangeFilter] = useState('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
const [showTopProvincesDialog, setShowTopProvincesDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('customers');
  const [cityDiscountsData, setCityDiscountsData] = useState({ cityDiscounts: [], monthlyBenefits: [], topCities: [] });

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

  // عرض العملاء الحقيقيين فقط بدون بيانات تجريبية
  const displayCustomers = Array.isArray(customers) ? customers : [];


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
      benefits: ['خصم 5% شهرياً', 'توصيل مجاني']

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
      benefits: ['خصم 10% شهرياً', 'توصيل مجاني']
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
      benefits: ['خصم 15% شهرياً', 'توصيل مجاني']
    }
  ];

  // Get loyalty level function - defined before use
  const getLoyaltyLevel = (points = 0) => {
    if (points >= 3000) return loyaltyLevels[3];
    if (points >= 1500) return loyaltyLevels[2];
    if (points >= 750) return loyaltyLevels[1];
    return loyaltyLevels[0];
  };

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
    
    // Apply loyalty level filter
    if (loyaltyLevelFilter !== 'all') {
      filtered = filtered.filter(customer => {
        const level = getLoyaltyLevel(customer.loyaltyPoints || 0);
        return level.name === loyaltyLevelFilter;
      });
    }
    
    // Apply points range filter
    if (pointsRangeFilter !== 'all') {
      filtered = filtered.filter(customer => {
        const points = customer.loyaltyPoints || 0;
        switch (pointsRangeFilter) {
          case 'none': return points === 0;
          case '1-749': return points >= 1 && points <= 749;
          case '750-1499': return points >= 750 && points <= 1499;
          case '1500-2999': return points >= 1500 && points <= 2999;
          case '3000+': return points >= 3000;
          default: return true;
        }
      });
    }
    
    return filtered;
  }, [displayCustomers, filterDataByUser, searchTerm, cityFilter, genderFilter, loyaltyLevelFilter, pointsRangeFilter, getLoyaltyLevel]);

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

  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);
    setShowDetailsDialog(true);
  };

  const handleRefresh = () => {
    // Data is auto-updated via context
  };

  const uniqueCities = [...new Set(filteredCustomers.map(c => c.city).filter(Boolean))];

  useEffect(() => {
    const fetchCityDiscountsData = async () => {
      try {
        const month = new Date().getMonth() + 1;
        const year = new Date().getFullYear();

        const { data: discounts } = await supabase
          .from('city_random_discounts')
          .select('*')
          .eq('discount_month', month)
          .eq('discount_year', year);

        const { data: benefits } = await supabase
          .from('city_monthly_benefits')
          .select('*')
          .eq('month', month)
          .eq('year', year);

        const { data: cities } = await supabase
          .from('city_order_stats')
          .select('*')
          .eq('month', month)
          .eq('year', year)
          .order('total_amount', { ascending: false })
          .limit(5);

        setCityDiscountsData({
          cityDiscounts: discounts || [],
          monthlyBenefits: benefits || [],
          topCities: cities || []
        });
      } catch (e) {
        console.error('Error preloading city discounts:', e);
      }
    };

    fetchCityDiscountsData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="container mx-auto p-2 sm:p-4 lg:p-8 space-y-6 sm:space-y-8">
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
                  إدارة شاملة للعملاء
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
            <Card className="border-0 bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-700 text-white shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden relative h-full">
              {/* Decorative circles */}
              <div className="absolute -top-4 -right-4 w-16 h-16 bg-white/10 rounded-full" />
              <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-white/10 rounded-full" />
              <div className="absolute top-1/2 right-1/4 w-8 h-8 bg-white/5 rounded-full" />
              
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-300 to-purple-300" />
              <CardContent className="p-6 sm:p-8 relative z-10 min-h-[152px]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90 mb-1">عملاء مع نقاط</p>
                    <p className="text-3xl sm:text-4xl font-bold">{customerStats.customersWithPoints || 0}</p>

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
            <Card className="border-0 bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 text-white shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden relative h-full">
              {/* Decorative circles */}
              <div className="absolute -top-6 -left-6 w-20 h-20 bg-white/10 rounded-full" />
              <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-white/10 rounded-full" />
              <div className="absolute top-1/3 left-1/3 w-6 h-6 bg-white/5 rounded-full" />
              
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-300 to-teal-300" />
              <CardContent className="p-6 sm:p-8 relative z-10 min-h-[152px]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90 mb-1">إجمالي النقاط</p>
                    <p className="text-3xl sm:text-4xl font-bold">{(customerStats.totalLoyaltyPoints || 0).toLocaleString()}</p>

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
            <Card className="border-0 bg-gradient-to-br from-rose-500 via-pink-600 to-orange-700 text-white shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden relative h-full">
              {/* Decorative circles */}
              <div className="absolute -top-8 -right-8 w-24 h-24 bg-white/10 rounded-full" />
              <div className="absolute -bottom-2 -left-2 w-12 h-12 bg-white/10 rounded-full" />
              <div className="absolute top-2/3 right-1/4 w-10 h-10 bg-white/5 rounded-full" />
              
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-300 to-pink-300" />
              <CardContent className="p-6 sm:p-8 relative z-10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90 mb-1">إجمالي المبيعات</p>
                    <p className="text-2xl sm:text-3xl font-bold">{(customerStats.totalRevenue || 0).toLocaleString()} د.ع</p>

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
            <CardContent className="p-3 sm:p-6">
              <div className="space-y-4">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="البحث بالاسم، الهاتف، المدينة..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-10 h-12 text-base border-2 focus:border-primary/50 rounded-xl bg-background"
                  />
                </div>
                
                {/* Main Filter Row */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex gap-2 flex-1">
                    <Select value={cityFilter} onValueChange={setCityFilter}>
                      <SelectTrigger className="flex-1 sm:min-w-[140px] h-11 rounded-xl border-2 bg-background">
                        <SelectValue placeholder="جميع العملاء" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-2 rounded-xl shadow-xl z-50">
                        <SelectItem value="all">جميع العملاء</SelectItem>
                        {uniqueCities.map(city => (
                          <SelectItem key={city} value={city}>{city}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Button
                      variant="outline"
                      onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                      className="h-11 px-4 rounded-xl border-2 gap-2 bg-background hover:bg-muted transition-all"
                    >
                      <Filter className="h-4 w-4" />
                      فلترة متقدمة
                    </Button>
                  </div>
                  
                </div>
                
                {/* Advanced Filters */}
                <AnimatePresence>
                  {showAdvancedFilters && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-4 border-t border-border">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          <div>
                            <label className="text-sm font-medium text-muted-foreground mb-2 block">مستوى الولاء</label>
                            <Select value={loyaltyLevelFilter} onValueChange={setLoyaltyLevelFilter}>
                              <SelectTrigger className="h-10 rounded-lg border-2 bg-background">
                                <SelectValue placeholder="جميع المستويات" />
                              </SelectTrigger>
                              <SelectContent className="bg-background border-2 rounded-xl shadow-xl z-50">
                                <SelectItem value="all">جميع المستويات</SelectItem>
                                <SelectItem value="برونزي">برونزي</SelectItem>
                                <SelectItem value="فضي">فضي</SelectItem>
                                <SelectItem value="ذهبي">ذهبي</SelectItem>
                                <SelectItem value="ماسي">ماسي</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div>
                            <label className="text-sm font-medium text-muted-foreground mb-2 block">نطاق النقاط</label>
                            <Select value={pointsRangeFilter} onValueChange={setPointsRangeFilter}>
                              <SelectTrigger className="h-10 rounded-lg border-2 bg-background">
                                <SelectValue placeholder="جميع النطاقات" />
                              </SelectTrigger>
                              <SelectContent className="bg-background border-2 rounded-xl shadow-xl z-50">
                                <SelectItem value="all">جميع النطاقات</SelectItem>
                                <SelectItem value="none">بدون نقاط</SelectItem>
                                <SelectItem value="1-749">1 - 749 نقطة</SelectItem>
                                <SelectItem value="750-1499">750 - 1499 نقطة</SelectItem>
                                <SelectItem value="1500-2999">1500 - 2999 نقطة</SelectItem>
                                <SelectItem value="3000+">3000+ نقطة</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div>
                            <label className="text-sm font-medium text-muted-foreground mb-2 block">الجنس</label>
                            <Select value={genderFilter} onValueChange={setGenderFilter}>
                              <SelectTrigger className="h-10 rounded-lg border-2 bg-background">
                                <SelectValue placeholder="جميع الأجناس" />
                              </SelectTrigger>
                              <SelectContent className="bg-background border-2 rounded-xl shadow-xl z-50">
                                <SelectItem value="all">جميع الأجناس</SelectItem>
                                <SelectItem value="male">ذكر</SelectItem>
                                <SelectItem value="female">أنثى</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <div className="flex gap-2 mt-4">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setCityFilter('all');
                              setGenderFilter('all');
                              setLoyaltyLevelFilter('all');
                              setPointsRangeFilter('all');
                            }}
                            className="h-9 px-4 rounded-lg text-sm"
                          >
                            مسح الفلاتر
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Loyalty Levels */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-6"
        >
          <h2 className="text-2xl sm:text-3xl font-bold text-center bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            مستويات الولاء
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            {loyaltyLevels.map((level, index) => (
              <motion.div
                key={level.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
                whileHover={{ scale: 1.05 }}
                className="group"
              >
                <Card className={`border-0 bg-white dark:bg-slate-800 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden relative`}>
                  <div className={`h-1 sm:h-2 bg-gradient-to-r ${level.color}`} />
                  <CardContent className="p-3 sm:p-6 text-center space-y-2 sm:space-y-4">
                    <div className={`w-12 h-12 sm:w-20 sm:h-20 mx-auto rounded-full bg-gradient-to-r ${level.color} flex items-center justify-center text-white group-hover:scale-110 transition-transform`}>
                      {React.cloneElement(level.icon, { className: "h-4 w-4 sm:h-6 sm:w-6" })}
                    </div>
                    <h3 className="text-lg sm:text-2xl font-bold">{level.name}</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {level.maxPoints === Infinity 
                        ? `${level.minPoints.toLocaleString()}+ نقطة`
                        : `${level.minPoints} - ${level.maxPoints} نقطة`}
                    </p>
                    <div className="space-y-1 sm:space-y-2">
                      {level.benefits.map((benefit, i) => (
                        <Badge key={i} className="bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-200 text-xs block">
                          {benefit}
                        </Badge>
                      ))}
                    </div>
                    {level.discount > 0 && (
                      <div className={`bg-gradient-to-r ${level.color} text-white rounded-lg p-3`}>
                        <p className="font-bold">خصم {level.discount}% شهرياً</p>
                      </div>
                    )}
                    {(level.name === 'ذهبي' || level.name === 'ماسي') && (
                      <Button className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white w-full gap-2 rounded-xl">
                        <Truck className="h-4 w-4" />
                        توصيل مجاني
                      </Button>
                    )}
                    {level.name === 'فضي' && (
                      <Button className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white w-full gap-2 rounded-xl">
                        <Truck className="h-4 w-4" />
                        توصيل مجاني
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Tabs Navigation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-xl">
            <CardContent className="p-4 sm:p-6">
              {/* Horizontal Tabs */}
              <div className="flex justify-center gap-1 sm:gap-2 mb-6 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
                <Button
                  onClick={() => setActiveTab('customers')}
                  variant={activeTab === 'customers' ? 'default' : 'ghost'}
                  className={`flex-1 h-10 sm:h-12 px-2 sm:px-4 rounded-lg text-xs sm:text-sm transition-all duration-300 ${
                    activeTab === 'customers' 
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg' 
                      : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <Users className="h-3 w-3 sm:h-4 sm:w-4 ml-1 sm:ml-2" />
                  العملاء ({filteredCustomers.length})
                </Button>
                
                <Button
                  onClick={() => setActiveTab('cities')}
                  variant={activeTab === 'cities' ? 'default' : 'ghost'}
                  className={`flex-1 h-10 sm:h-12 px-2 sm:px-4 rounded-lg text-xs sm:text-sm transition-all duration-300 ${
                    activeTab === 'cities' 
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg' 
                      : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <MapPin className="h-3 w-3 sm:h-4 sm:w-4 ml-1 sm:ml-2" />
                  إحصائيات المدن
                </Button>
                
                <Button
                  onClick={() => setActiveTab('discounts')}
                  variant={activeTab === 'discounts' ? 'default' : 'ghost'}
                  className={`flex-1 h-10 sm:h-12 px-2 sm:px-4 rounded-lg text-xs sm:text-sm transition-all duration-300 ${
                    activeTab === 'discounts' 
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg' 
                      : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <Gift className="h-3 w-3 sm:h-4 sm:w-4 ml-1 sm:ml-2" />
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
                  >
                    <div className="text-center p-4">
                      <h3 className="text-lg font-bold mb-2">إدارة العملاء</h3>
                      <p className="text-muted-foreground">عرض وإدارة جميع العملاء والولاء</p>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'cities' && (
                  <motion.div
                    key="cities"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="text-center p-4 space-y-4">
                      <div className="flex items-center justify-center gap-3 mb-4">
                        <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full">
                          <Target className="h-6 w-6 text-white" />
                        </div>
                        <h3 className="text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                          نظام المسابقات الشهرية
                        </h3>
                      </div>
                      <p className="text-muted-foreground mb-4">
                        اختر عشوائياً الفائز من كل مدينة حسب الأداء والنشاط
                      </p>
                      <Button 
                        className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white gap-2"
                        onClick={() => setShowTopProvincesDialog(true)}
                      >
                        <Trophy className="h-4 w-4" />
                        اختيار الفائزين
                      </Button>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'discounts' && (
                  <motion.div
                    key="discounts"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
<CityDiscountsContent 
            cityDiscounts={cityDiscountsData.cityDiscounts}
            monthlyBenefits={cityDiscountsData.monthlyBenefits}
            topCities={cityDiscountsData.topCities}
          />
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>

        {/* Customers Grid - Only show when customers tab is active */}
        {activeTab === 'customers' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between px-2">
              <h2 className="text-xl sm:text-2xl font-bold">العملاء ({filteredCustomers.length})</h2>
              <div className="flex gap-2">
                <Badge className="bg-primary/10 text-primary text-xs sm:text-sm">
                  مُتقدمة
                </Badge>
                <Badge variant="outline" className="text-xs sm:text-sm">
                  {filteredCustomers.length} من {filteredCustomers.length}
                </Badge>
              </div>
            </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            <AnimatePresence>
              {filteredCustomers.map((customer, index) => {
                const loyaltyLevel = getLoyaltyLevel(customer.loyaltyPoints || 0);
                
                return (
                  <motion.div
                    key={customer.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
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
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
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

                        {/* Customer Stats */}
                        <div className="space-y-3 mb-4">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">المستوى:</span>
                            <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                              كيروزتي
                            </Badge>
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">النقاط:</span>
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 text-yellow-500" />
                              <span className="font-bold text-orange-600">{customer?.loyaltyPoints || 0}</span>
                            </div>
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">صلاحية النقاط:</span>
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">
                              {customer.pointsExpiry || 'غير محدد'}
                            </Badge>
                          </div>
                          
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
                          
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">برومو كود:</span>
                            <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 text-xs">
                              {customer.promoCode || 'غير متوفر'}
                            </Badge>
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
                              توصيل مجاني
                            </Button>
                          )}
                          {loyaltyLevel.name === 'فضي' && (
                            <Button 
                              size="sm" 
                              className="w-full bg-blue-500 hover:bg-blue-600 text-white gap-2 rounded-lg"
                            >
                              <Truck className="h-4 w-4" />
                              توصيل مجاني
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
            </AnimatePresence>
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

      <TopProvincesDialog
        open={showTopProvincesDialog}
        onOpenChange={setShowTopProvincesDialog}
      />
    </div>
  );
};

export default CustomersManagementPage;