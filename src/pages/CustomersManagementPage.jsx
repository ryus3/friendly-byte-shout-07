import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Download, Users, Eye, Send, Phone, MapPin, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import CustomerFilters from '@/components/customers/CustomerFilters';
import CustomerStats from '@/components/customers/CustomerStats';
import CustomerCard from '@/components/customers/CustomerCard';
import ExportDialog from '@/components/customers/ExportDialog';

const CustomersManagementPage = () => {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [loyaltyTiers, setLoyaltyTiers] = useState([]);
  
  // Filter states
  const [activeFilter, setActiveFilter] = useState('all');
  const [filters, setFilters] = useState({
    searchTerm: '',
    timeFilter: 'all',
    pointsFilter: 'all',
    loyaltyTierFilter: 'all',
    genderSegmentation: 'all',
    departmentFilter: 'all'
  });

  // جلب بيانات العملاء
  const fetchCustomers = async () => {
    try {
      setLoading(true);
      
      const { data: customersData, error } = await supabase
        .from('customers')
        .select(`
          *,
          customer_loyalty (
            total_points,
            total_orders,
            total_spent,
            current_tier_id,
            loyalty_tiers (
              name,
              color,
              icon,
              discount_percentage,
              points_required
            )
          ),
          customer_product_segments (
            gender_segment,
            departments (name),
            categories (name)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // حساب عدد أعضاء كل مستوى ولاء
      const tierCounts = {};
      (customersData || []).forEach(customer => {
        const loyaltyData = customer.customer_loyalty; // إزالة [0] لأنه object وليس array
        if (loyaltyData?.current_tier_id) {
          const tierId = loyaltyData.current_tier_id;
          tierCounts[tierId] = (tierCounts[tierId] || 0) + 1;
        }
      });

      // إضافة عدد الأعضاء لمستويات الولاء
      const updatedTiers = loyaltyTiers.map(tier => ({
        ...tier,
        memberCount: tierCounts[tier.id] || 0
      }));
      
      setLoyaltyTiers(updatedTiers);
      setCustomers(customersData || []);
      setFilteredCustomers(customersData || []);
      
    } catch (error) {
      console.error('خطأ في جلب العملاء:', error);
      toast({
        title: 'خطأ في جلب البيانات',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // جلب مستويات الولاء
  const fetchLoyaltyTiers = async () => {
    try {
      const { data, error } = await supabase
        .from('loyalty_tiers')
        .select('*')
        .order('points_required');

      if (error) throw error;
      setLoyaltyTiers(data || []);
    } catch (error) {
      console.error('خطأ في جلب مستويات الولاء:', error);
    }
  };

  useEffect(() => {
    fetchLoyaltyTiers();
  }, []);

  useEffect(() => {
    if (loyaltyTiers.length > 0) {
      fetchCustomers();
    }
  }, [loyaltyTiers]);

  // تطبيق الفلاتر
  useEffect(() => {
    let filtered = customers;

    // فلتر البحث
    if (filters.searchTerm) {
      filtered = filtered.filter(customer => 
        customer.name.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        customer.phone?.includes(filters.searchTerm) ||
        customer.email?.toLowerCase().includes(filters.searchTerm.toLowerCase())
      );
    }

    // فلتر النقاط
    if (filters.pointsFilter === 'with_points') {
      filtered = filtered.filter(c => (c.customer_loyalty?.total_points || 0) > 0);
    } else if (filters.pointsFilter === 'no_points') {
      filtered = filtered.filter(c => (c.customer_loyalty?.total_points || 0) === 0);
    } else if (filters.pointsFilter === 'high_points') {
      filtered = filtered.filter(c => (c.customer_loyalty?.total_points || 0) >= 1000);
    }

    // فلتر مستوى الولاء
    if (filters.loyaltyTierFilter !== 'all') {
      filtered = filtered.filter(customer => {
        const customerTier = customer.customer_loyalty?.current_tier_id;
        return customerTier === filters.loyaltyTierFilter;
      });
    }

    // فلتر الجنس
    if (filters.genderSegmentation !== 'all') {
      filtered = filtered.filter(customer => {
        return customer.customer_product_segments?.some(seg => 
          seg.gender_segment === filters.genderSegmentation
        );
      });
    }

    // تطبيق الفلتر النشط من الكروت
    if (activeFilter === 'with_points') {
      filtered = filtered.filter(c => (c.customer_loyalty?.total_points || 0) > 0);
    } else if (activeFilter === 'with_phones') {
      filtered = filtered.filter(c => c.phone);
    } else if (activeFilter === 'high_points') {
      filtered = filtered.filter(c => (c.customer_loyalty?.total_points || 0) >= 1000);
    }

    setFilteredCustomers(filtered);
  }, [customers, filters, activeFilter]);

  // معالج التصدير
  const handleExport = (exportType, includeFields) => {
    let dataToExport = [];
    
    switch (exportType) {
      case 'with_points':
        dataToExport = customers.filter(c => (c.customer_loyalty?.total_points || 0) > 0);
        break;
      case 'with_phones':
        dataToExport = customers.filter(c => c.phone);
        break;
      case 'high_points':
        dataToExport = customers.filter(c => (c.customer_loyalty?.total_points || 0) >= 1000);
        break;
      case 'male_segment':
        dataToExport = customers.filter(c => c.customer_product_segments?.some(s => s.gender_segment === 'male'));
        break;
      case 'female_segment':
        dataToExport = customers.filter(c => c.customer_product_segments?.some(s => s.gender_segment === 'female'));
        break;
      default:
        dataToExport = customers;
    }

    const csvHeaders = ['الاسم', 'الهاتف', 'البريد الإلكتروني', 'المدينة', 'العنوان', 'إجمالي النقاط', 'إجمالي الطلبات', 'تاريخ التسجيل'];

    const csvData = dataToExport.map(customer => [
      customer.name,
      customer.phone || '',
      customer.email || '',
      customer.city || '',
      customer.address || '',
      customer.customer_loyalty?.total_points || 0,
      customer.customer_loyalty?.total_orders || 0,
      new Date(customer.created_at).toLocaleDateString('ar')
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    
    const timestamp = new Date().toISOString().split('T')[0];
    link.download = `عملاء_${timestamp}.csv`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: 'تم التصدير بنجاح',
      description: `تم تصدير ${csvData.length} عميل إلى ملف CSV`
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // إحصائيات العملاء
  const customersWithPoints = customers.filter(c => (c.customer_loyalty?.total_points || 0) > 0).length;
  const customersWithPhones = customers.filter(c => c.phone).length;
  const highPointsCustomers = customers.filter(c => (c.customer_loyalty?.total_points || 0) >= 1000).length;

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            إدارة العملاء
          </h1>
          <p className="text-muted-foreground mt-1">
            إدارة وتتبع عملائك ومستويات ولائهم
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            onClick={() => setShowExportDialog(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg"
          >
            <Download className="h-4 w-4 mr-2" />
            تصدير البيانات
          </Button>
        </div>
      </div>

      {/* الإحصائيات */}
      <CustomerStats 
        customers={customers}
        loyaltyTiers={loyaltyTiers}
        activeFilter={activeFilter}
        setActiveFilter={setActiveFilter}
      />

      {/* الفلاتر */}
      <CustomerFilters 
        filters={filters}
        setFilters={setFilters}
        loyaltyTiers={loyaltyTiers}
        departments={[]}
      />

      {/* قائمة العملاء */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">
            العملاء ({filteredCustomers.length})
          </h2>
        </div>

        {filteredCustomers.length === 0 ? (
          <Card className="p-8 text-center">
            <CardContent>
              <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">لا توجد عملاء</h3>
              <p className="text-muted-foreground">
                لم يتم العثور على عملاء يطابقون معايير البحث المحددة
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredCustomers.map((customer) => (
              <CustomerCard
                key={customer.id}
                customer={customer}
                onViewDetails={(customer) => {
                  toast({
                    title: 'عرض تفاصيل العميل',
                    description: `تم فتح تفاصيل العميل: ${customer.name}`
                  });
                }}
                onSendNotification={(customer) => {
                  toast({
                    title: 'إرسال إشعار',
                    description: `تم إرسال إشعار للعميل: ${customer.name}`
                  });
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* مربع حوار التصدير */}
      <ExportDialog
        open={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        customers={customers}
        onExport={handleExport}
      />
    </div>
  );
};

export default CustomersManagementPage;