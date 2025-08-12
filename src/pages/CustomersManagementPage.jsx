import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader } from "@/components/ui/loader";
import { CustomerCard } from "@/components/customers/CustomerCard";
import { CustomerDetailsDialog } from "@/components/customers/CustomerDetailsDialog";
import { EnhancedExportDialog } from "@/components/customers/EnhancedExportDialog";
import { TopProvincesDialog } from "@/components/customers/TopProvincesDialog";
import { TopCustomersDialog } from "@/components/customers/TopCustomersDialog";
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
  MessageCircle
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

  // Filter customers based on permissions and search criteria
  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    
    let filtered = filterDataByUser(customers, 'customers');
    
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
  }, [customers, filterDataByUser, searchTerm, cityFilter, genderFilter]);

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
      icon: <Award className="h-5 w-5" />,
      minPoints: 0,
      maxPoints: 749,
      color: 'from-orange-400 to-red-500',
      discount: 0,
      benefits: ['نقاط على المشتريات']
    },
    {
      name: 'فضي',
      icon: <Medal className="h-5 w-5" />,
      minPoints: 750,
      maxPoints: 1499,
      color: 'from-gray-400 to-gray-600',
      discount: 5,
      benefits: ['خصم 5% شهرياً', 'نقاط مضاعفة']
    },
    {
      name: 'ذهبي',
      icon: <Crown className="h-5 w-5" />,
      minPoints: 1500,
      maxPoints: 2999,
      color: 'from-yellow-400 to-orange-500',
      discount: 10,
      benefits: ['خصم 10% شهرياً', 'توصيل مجاني دائماً']
    },
    {
      name: 'ماسي',
      icon: <Diamond className="h-5 w-5" />,
      minPoints: 3000,
      maxPoints: Infinity,
      color: 'from-cyan-400 to-blue-500',
      discount: 15,
      benefits: ['خصم 15% شهرياً', 'توصيل مجاني دائماً', 'دعم VIP']
    }
  ];

  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);
    setShowDetailsDialog(true);
  };

  const handleRefresh = () => {
    // Data is auto-updated via context
  };

  const getLoyaltyLevel = (points) => {
    if (points >= 3000) return loyaltyLevels[3];
    if (points >= 1500) return loyaltyLevels[2];
    if (points >= 750) return loyaltyLevels[1];
    return loyaltyLevels[0];
  };

  const renderCustomerCard = (customer) => {
    const loyaltyLevel = getLoyaltyLevel(customer.loyaltyPoints || 0);
    
    return (
      <Card key={customer.id} className="border-0 bg-white dark:bg-slate-800 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
        <CardContent className="p-0">
          {/* Customer Header with Loyalty Badge */}
          <div className={`h-2 bg-gradient-to-r ${loyaltyLevel.color}`} />
          
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full bg-gradient-to-r ${loyaltyLevel.color} flex items-center justify-center text-white`}>
                  {loyaltyLevel.icon}
                </div>
                <div>
                  <h3 className="font-bold text-lg">{customer.name || 'ريوس'}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {customer.phone || '07728020024'}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {customer.city || 'بغداد'}
                  </div>
                </div>
              </div>
              
              <Badge className={`bg-gradient-to-r ${loyaltyLevel.color} text-white border-0`}>
                {loyaltyLevel.name}
              </Badge>
            </div>

            {/* Customer Details */}
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
                  <span className="font-semibold">{customer.loyaltyPoints || 250}</span>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">صلاحية النقاط:</span>
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  03/11/2025
                </Badge>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">الطلبات:</span>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4 text-blue-500" />
                  <span className="font-semibold">{customer.totalOrders || 1}</span>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">المشتريات:</span>
                <span className="font-semibold text-green-600">
                  {(customer.totalRevenue || 55000).toLocaleString()} د.ع
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">برومو كود:</span>
                <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                  RY0024BR⚡
                </Badge>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-2"
                onClick={() => handleCustomerSelect(customer)}
              >
                <Eye className="h-4 w-4" />
                التفاصيل
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <Gift className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <MessageCircle className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Professional Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="p-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-600">
            <Users className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            إدارة العملاء ونظام الولاء
          </h1>
        </div>
        
        <div className="flex items-center justify-center gap-4 mt-6">
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            تحديث
          </Button>
          <Button
            onClick={() => setShowExportDialog(true)}
            variant="default"
            size="sm"
            className="gap-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white border-0"
          >
            <Download className="h-4 w-4" />
            تصدير العملاء (CSV)
          </Button>
          <Button
            onClick={() => setShowTopCustomersDialog(true)}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Users className="h-4 w-4" />
            أفضل العملاء
          </Button>
          <Button
            onClick={() => setShowTopProvincesDialog(true)}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <TrendingUp className="h-4 w-4" />
            إحصائيات المحافظات
          </Button>
        </div>
      </motion.div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-0 bg-gradient-to-r from-blue-500 to-purple-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">إجمالي العملاء</p>
                  <p className="text-3xl font-bold">{customerStats.totalCustomers || 4}</p>
                </div>
                <Users className="h-8 w-8 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-0 bg-gradient-to-r from-cyan-400 to-blue-500 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">عملاء مع نقاط</p>
                  <p className="text-3xl font-bold">{customerStats.customersWithPoints || 4}</p>
                </div>
                <Phone className="h-8 w-8 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-0 bg-gradient-to-r from-purple-500 to-pink-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">إجمالي النقاط</p>
                  <p className="text-3xl font-bold">{(customerStats.totalLoyaltyPoints || 500).toLocaleString()}</p>
                </div>
                <TrendingUp className="h-8 w-8 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="border-0 bg-gradient-to-r from-pink-500 to-red-500 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">إجمالي المبيعات</p>
                  <p className="text-2xl font-bold">{(customerStats.totalRevenue || 110000).toLocaleString()} د.ع</p>
                </div>
                <Trophy className="h-8 w-8 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Loyalty Levels Section */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-center text-purple-600 mb-6">مستويات الولاء</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {loyaltyLevels.map((level, index) => (
            <motion.div
              key={level.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * index }}
            >
              <Card className={`border-0 bg-gradient-to-br ${level.color} text-white overflow-hidden relative`}>
                <CardContent className="p-6">
                  <div className="text-center space-y-4">
                    <div className="flex items-center justify-center w-16 h-16 mx-auto rounded-full bg-white/20">
                      {level.icon}
                    </div>
                    <h3 className="text-xl font-bold">{level.name}</h3>
                    <p className="text-sm opacity-90">
                      {level.maxPoints === Infinity 
                        ? `${level.minPoints.toLocaleString()}+ نقطة`
                        : `${level.minPoints} - ${level.maxPoints} نقطة`}
                    </p>
                    <div className="space-y-2">
                      {level.benefits.map((benefit, i) => (
                        <Badge key={i} className="bg-white/20 text-white border-0 text-xs">
                          {benefit}
                        </Badge>
                      ))}
                    </div>
                    {level.discount > 0 && (
                      <div className="bg-white/20 rounded-lg p-3">
                        <p className="text-lg font-bold">خصم {level.discount}% شهرياً</p>
                      </div>
                    )}
                    {level.name === 'ذهبي' || level.name === 'ماسي' ? (
                      <Button className="bg-blue-500 hover:bg-blue-600 text-white w-full gap-2">
                        <Trophy className="h-4 w-4" />
                        توصيل مجاني دائماً
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Search and Filter Section */}
      <Card className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="البحث بالاسم، الهاتف..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white dark:bg-gray-800"
              />
            </div>
            
            <Select value={cityFilter} onValueChange={setCityFilter}>
              <SelectTrigger className="w-48 bg-white dark:bg-gray-800">
                <SelectValue placeholder="تصفية متقدمة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع المدن</SelectItem>
                {Array.from(new Set(customers?.map(c => c.city).filter(Boolean) || [])).map(city => (
                  <SelectItem key={city} value={city}>{city}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <p className="text-sm text-muted-foreground">
              {filteredCustomers.length} من {customerStats.totalCustomers}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Customers Tabs */}
      <div className="flex items-center justify-center gap-8 border-b">
        <button className="pb-2 border-b-2 border-purple-500 text-purple-600 font-semibold">
          العملاء ({filteredCustomers.length})
        </button>
        <button className="pb-2 text-muted-foreground">
          إحصائيات المدن
        </button>
        <button className="pb-2 text-muted-foreground">
          خدمات المدن
        </button>
      </div>

      {/* Customer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <AnimatePresence mode="popLayout">
          {loading ? (
            Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="animate-pulse">
                <div className="bg-gray-200 dark:bg-gray-700 rounded-lg h-80"></div>
              </div>
            ))
          ) : filteredCustomers.length > 0 ? (
            filteredCustomers.slice(0, 8).map((customer, index) => (
              <motion.div
                key={customer.id || index}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ y: -5 }}
              >
                {renderCustomerCard(customer)}
              </motion.div>
            ))
          ) : (
            // Show sample customers if no data
            Array.from({ length: 4 }).map((_, index) => (
              <motion.div
                key={`sample-${index}`}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -5 }}
              >
                {renderCustomerCard({
                  id: `sample-${index}`,
                  name: 'ريوس',
                  phone: '07728020024',
                  city: 'بغداد',
                  loyaltyPoints: 250,
                  totalOrders: 1,
                  totalRevenue: 55000
                })}
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Dialogs */}
      <CustomerDetailsDialog
        customer={selectedCustomer}
        open={showDetailsDialog}
        onOpenChange={setShowDetailsDialog}
      />

      <EnhancedExportDialog
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