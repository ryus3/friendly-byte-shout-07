import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { 
  User, Store, Link2, ExternalLink, ShoppingCart, TrendingUp, Target, 
  Edit2, ArrowRight, Mail, Phone, Hash, Send, MapPin, Award,
  Calendar, Activity, Briefcase
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import Loader from '@/components/ui/loader';
import EditProfileDialog from '@/components/profile/EditProfileDialog';

/**
 * صفحة الملف الشخصي - تعرض معلومات المستخدم الكاملة
 * يمكن للمستخدم عرض ملفه الخاص أو ملفات الموظفين الآخرين
 */
const ProfilePage = () => {
  const { identifier } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { canViewAllData, canManageEmployees } = usePermissions();
  
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  
  const targetIdentifier = identifier || currentUser?.username;
  const isOwnProfile = !identifier || identifier === currentUser?.username || identifier === currentUser?.id;
  const canEdit = isOwnProfile || canManageEmployees;

  useEffect(() => {
    if (targetIdentifier) {
      fetchProfileData();
    }
  }, [targetIdentifier]);

  const fetchProfileData = async () => {
    try {
      setLoading(true);

      // تحديد إذا كان identifier هو UUID أو username
      const isUUID = targetIdentifier?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      
      // جلب معلومات المستخدم والبروفايل - بحث ذكي
    const query = supabase
      .from('profiles')
      .select(`
        id,
        user_id,
        username,
        full_name,
        email,
        phone,
        avatar_url,
        employee_code,
        telegram_code,
        business_name,
        business_page_name,
        business_links,
        social_media,
        created_at,
        updated_at,
        user_roles!left(
          is_active,
          roles(name, display_name)
        )
      `);
      
      // إضافة شرط البحث حسب النوع
      if (isUUID) {
        query.eq('id', targetIdentifier);
      } else {
        query.eq('username', targetIdentifier);
      }
      
      const { data: profileData, error: profileError } = await query.maybeSingle();

      if (profileError) {
        console.error('خطأ في جلب البروفايل:', profileError);
        toast({
          title: 'خطأ',
          description: 'فشل تحميل بيانات الملف الشخصي',
          variant: 'destructive'
        });
        setLoading(false);
        return;
      }
      
      if (!profileData) {
        toast({
          title: 'غير موجود',
          description: 'لم يتم العثور على المستخدم',
          variant: 'destructive'
        });
        setLoading(false);
        return;
      }

      // تحويل URL تلقائياً إلى username إذا كان UUID
      if (profileData && isUUID && profileData.username) {
        window.history.replaceState(null, '', `/profile/${profileData.username}`);
      }

      // جلب الإحصائيات - استخدام profileData.user_id الصحيح
      const { data: ordersData } = await supabase
        .from('orders')
        .select('id, status, total_amount')
        .eq('created_by', profileData.user_id);

      const totalOrders = ordersData?.length || 0;
      const deliveredOrders = ordersData?.filter(o => o.status === 'delivered').length || 0;
      const successRate = totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 0;

      // حساب الأرباح - استخدام profileData.user_id الصحيح
      const { data: profitsData } = await supabase
        .from('profits_tracking')
        .select('employee_profit')
        .eq('employee_id', profileData.user_id);

      const totalProfits = profitsData?.reduce((sum, p) => sum + (parseFloat(p.employee_profit) || 0), 0) || 0;

      // رموز التليغرام موجودة بالفعل في profileData من allUsers - لا حاجة لجلب إضافي
      setProfile(profileData);
      setStats({
        totalOrders,
        totalProfits,
        successRate,
        deliveredOrders
      });

    } catch (error) {
      console.error('خطأ في جلب بيانات الملف الشخصي:', error);
      toast({
        title: 'خطأ',
        description: 'فشل تحميل بيانات الملف الشخصي',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'م';
    const parts = name.trim().split(' ');
    return parts.slice(0, 2).map(p => p[0]).join('').toUpperCase();
  };

  const getRoleBadge = (roles) => {
    if (!roles || roles.length === 0) return 'موظف';
    
    const activeRoles = roles
      .filter(r => r && r.is_active && r.roles)
      .map(r => r.roles.name);
    
    if (activeRoles.length === 0) return 'موظف';
    
    const roleDisplay = {
      'super_admin': 'المدير العام',
      'admin': 'مدير',
      'department_manager': 'مدير قسم',
      'sales_employee': 'موظف مبيعات',
      'warehouse_employee': 'موظف مخزن',
      'cashier': 'أمين صندوق'
    };
    
    const priorities = ['super_admin', 'admin', 'department_manager', 'sales_employee', 'warehouse_employee', 'cashier'];
    for (const role of priorities) {
      if (activeRoles.includes(role)) {
        return roleDisplay[role] || 'موظف';
      }
    }
    
    return 'موظف';
  };

  const getLinkIcon = (type) => {
    const icons = {
      facebook: <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,
      instagram: <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>,
      website: <Store className="w-5 h-5 text-white" />,
      other: <Link2 className="w-5 h-5 text-white" />
    };
    return icons[type] || icons.other;
  };

  const getLinkGradient = (type) => {
    const gradients = {
      facebook: 'from-blue-500 to-blue-700',
      instagram: 'from-pink-500 via-purple-500 to-orange-500',
      website: 'from-green-500 to-emerald-600',
      other: 'from-gray-500 to-gray-700'
    };
    return gradients[type] || gradients.other;
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('ar-IQ', {
      style: 'currency',
      currency: 'IQD',
      minimumFractionDigits: 0
    }).format(value || 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-6 text-center">
          <p className="text-muted-foreground">لم يتم العثور على المستخدم</p>
          <Button onClick={() => navigate(-1)} className="mt-4">
            <ArrowRight className="w-4 h-4 ml-2" />
            رجوع
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{profile.full_name} - الملف الشخصي</title>
        <meta name="description" content={`الملف الشخصي لـ ${profile.full_name}`} />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/5 p-4 md:p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header Card */}
          <Card className="relative overflow-hidden border-2">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-purple-500/5 to-pink-500/5" />
            <CardContent className="relative p-6">
              <div className="flex items-start gap-6 flex-col md:flex-row">
                <div className="relative">
                  <Avatar className="w-24 h-24 border-4 border-primary/20 shadow-lg">
                    <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
                    <AvatarFallback className="text-2xl bg-gradient-to-br from-primary to-purple-600 text-primary-foreground font-bold">
                      {getInitials(profile.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <Badge variant="secondary" className="absolute -bottom-2 left-1/2 -translate-x-1/2 shadow-md">
                    {getRoleBadge(profile.user_roles)}
                  </Badge>
                </div>
                
                <div className="flex-1">
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 dark:from-primary dark:to-purple-400 bg-clip-text text-transparent mb-2">
                    {profile.full_name}
                  </h1>
                  <p className="text-muted-foreground mb-4">@{profile.username}</p>
                  
                  {profile.business_name && (
                    <div className="mt-4 p-4 bg-primary/5 dark:bg-primary/10 rounded-lg border border-primary/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Store className="w-5 h-5 text-primary" />
                        <span className="font-semibold text-lg text-foreground">
                          {profile.business_name}
                        </span>
                      </div>
                      {profile.business_page_name && (
                        <p className="text-sm text-muted-foreground">
                          {profile.business_page_name}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                
                {canEdit && (
                  <Button onClick={() => setEditDialogOpen(true)} variant="outline" size="lg">
                    <Edit2 className="w-4 h-4 ml-2" />
                    تعديل الملف
                  </Button>
                )}
              </div>

              {/* معلومات الاتصال */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6 pt-6 border-t border-border">
                {profile.email && (
                  <div className="flex items-center gap-3 p-3 bg-secondary/20 rounded-lg">
                    <Mail className="w-5 h-5 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">البريد الإلكتروني</p>
                      <p className="text-sm font-medium truncate">{profile.email}</p>
                    </div>
                  </div>
                )}
                
                {profile.employee_code && (
                  <div className="flex items-center gap-3 p-3 bg-secondary/20 rounded-lg">
                    <Hash className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">معرف الموظف</p>
                      <p className="text-sm font-medium">{profile.employee_code}</p>
                    </div>
                  </div>
                )}
                
                {profile.telegram_code && (
                  <div className="flex items-center gap-3 p-3 bg-secondary/20 rounded-lg">
                    <Send className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">رمز التليغرام</p>
                      <p className="text-sm font-medium">{profile.telegram_code}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* روابط الأنشطة التجارية */}
          {profile.business_links && profile.business_links.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="w-5 h-5 text-primary" />
                  روابط الأنشطة التجارية
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {profile.business_links.map((link, idx) => (
                    <a
                      key={idx}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-lg"
                    >
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-br ${getLinkGradient(link.type)} shadow-md`}>
                        {getLinkIcon(link.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm group-hover:text-primary transition-colors">
                          {link.title || link.type}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {link.url}
                        </p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* إحصائيات الأداء */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="hover:shadow-xl transition-all duration-300 border-l-4 border-l-green-500 transform hover:-translate-y-1">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">إجمالي الطلبات</p>
                      <p className="text-4xl font-bold text-green-600 dark:text-green-400">
                        {stats.totalOrders}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {stats.deliveredOrders} تم توصيلها
                      </p>
                    </div>
                    <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <ShoppingCart className="w-7 h-7 text-green-600 dark:text-green-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="hover:shadow-xl transition-all duration-300 border-l-4 border-l-blue-500 transform hover:-translate-y-1">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">إجمالي الأرباح</p>
                      <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                        {formatCurrency(stats.totalProfits)}
                      </p>
                    </div>
                    <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <TrendingUp className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="hover:shadow-xl transition-all duration-300 border-l-4 border-l-purple-500 transform hover:-translate-y-1">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">نسبة النجاح</p>
                      <p className="text-4xl font-bold text-purple-600 dark:text-purple-400">
                        {stats.successRate}%
                      </p>
                    </div>
                    <div className="w-14 h-14 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <Target className="w-7 h-7 text-purple-600 dark:text-purple-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      {editDialogOpen && (
        <EditProfileDialog
          profile={profile}
          isOpen={editDialogOpen}
          onClose={() => {
            setEditDialogOpen(false);
            fetchProfileData();
          }}
        />
      )}
    </>
  );
};

export default ProfilePage;