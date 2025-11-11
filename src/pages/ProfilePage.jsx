import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { 
  User, Mail, ShoppingCart, TrendingUp, Award, 
  Edit2, Store, Send, Phone, Loader, Hash,
  ExternalLink, Instagram, Facebook, Globe, ArrowUpRight, Copy
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import EditProfileDialog from '@/components/profile/EditProfileDialog';

const ProfilePage = () => {
  const { identifier } = useParams();
  const navigate = useNavigate();
  const { user, allUsers } = useAuth();
  const { hasPermission } = usePermissions();
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({
    totalOrders: 0,
    deliveredOrders: 0,
    totalProfits: 0,
    successRate: 0
  });
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // التحقق إذا كان المعرف UUID أو username
  const isUUID = (str) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  useEffect(() => {
    if (identifier) {
      fetchProfileData();
    } else if (user) {
      navigate(`/${user.username}`, { replace: true });
    }
  }, [identifier, user]);

  const fetchProfileData = async () => {
    try {
      setLoading(true);

      const searchColumn = isUUID(identifier) ? 'id' : 'username';
      
      const { data: profileData, error: profileError } = await supabase
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
          user_roles!user_roles_user_id_fkey!left(
            is_active,
            roles(name, display_name)
          )
        `)
        .eq(searchColumn, identifier)
        .maybeSingle();

      if (profileError) {
        console.error('Profile fetch error:', profileError);
        throw profileError;
      }

      if (!profileData) {
        toast({
          title: 'خطأ',
          description: 'لم يتم العثور على الملف الشخصي',
          variant: 'destructive',
        });
        navigate('/');
        return;
      }

      const userFromContext = allUsers?.find(u => u.user_id === profileData.user_id);
      if (userFromContext) {
        profileData.telegram_code = userFromContext.telegram_code;
        profileData.telegram_linked = userFromContext.telegram_linked;
        profileData.telegram_linked_at = userFromContext.telegram_linked_at;
      }

      setProfile(profileData);

      if (isUUID(identifier) && profileData.username) {
        window.history.replaceState(null, '', `/${profileData.username}`);
      }

      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('delivery_status')
        .eq('created_by', profileData.user_id);

      if (ordersError) {
        console.error('Orders fetch error:', ordersError);
      } else {
        const totalOrders = ordersData?.length || 0;
        const deliveredOrders = ordersData?.filter(o => o.delivery_status === '4').length || 0;
        const successRate = totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 0;

        setStats(prev => ({
          ...prev,
          totalOrders,
          deliveredOrders,
          successRate
        }));
      }

      const { data: profitsData, error: profitsError } = await supabase
        .from('profits')
        .select('profit_amount')
        .eq('employee_id', profileData.user_id);

      if (profitsError) {
        console.error('Profits fetch error:', profitsError);
      } else {
        const totalProfits = profitsData?.reduce((sum, p) => sum + (Number(p.profit_amount) || 0), 0) || 0;
        setStats(prev => ({ ...prev, totalProfits }));
      }

    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء تحميل البيانات',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    return parts.length >= 2 
      ? `${parts[0][0]}${parts[1][0]}` 
      : name.substring(0, 2);
  };

  const getRoleBadge = (userRoles) => {
    if (!userRoles || userRoles.length === 0) return 'موظف';
    const activeRoles = userRoles.filter(ur => ur.is_active && ur.roles);
    if (activeRoles.length === 0) return 'موظف';
    return activeRoles.map(ur => ur.roles.display_name).join(' • ');
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ar-IQ', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getLinkStyle = (link) => {
    const url = link.url?.toLowerCase() || '';
    
    if (url.includes('instagram.com') || link.type === 'instagram') {
      return {
        gradient: 'from-pink-500 via-purple-500 to-orange-500',
        icon: <Instagram className="w-5 h-5 text-white" />,
        label: 'Instagram'
      };
    }
    if (url.includes('facebook.com') || link.type === 'facebook') {
      return {
        gradient: 'from-blue-600 to-blue-800',
        icon: <Facebook className="w-5 h-5 text-white" />,
        label: 'Facebook'
      };
    }
    if (link.type === 'website' || (!url.includes('instagram') && !url.includes('facebook'))) {
      return {
        gradient: 'from-gray-600 to-gray-800',
        icon: <Globe className="w-5 h-5 text-white" />,
        label: link.title || 'موقع إلكتروني'
      };
    }
    
    return {
      gradient: 'from-indigo-600 to-purple-600',
      icon: <ExternalLink className="w-5 h-5 text-white" />,
      label: link.title || 'رابط'
    };
  };

  const canEdit = user && profile && (
    user.user_id === profile.user_id || 
    hasPermission('view_all_users')
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6">
        <User className="w-24 h-24 text-muted-foreground" />
        <p className="text-2xl font-bold text-muted-foreground">لم يتم العثور على الملف الشخصي</p>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{profile.full_name} - الملف الشخصي</title>
      </Helmet>

      <div className="container mx-auto p-4 md:p-8 space-y-8 max-w-7xl">
      {/* Header Card - Professional Gradient */}
      <Card className="relative overflow-hidden border-none shadow-2xl">
        {/* Unified Professional Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-purple-50/40 to-pink-50/40 dark:from-blue-950/30 dark:via-purple-950/20 dark:to-pink-950/20" />
        
        {/* Decorative Circles - More Subtle */}
        <div className="absolute -top-24 -right-24 w-56 h-56 bg-gradient-to-br from-blue-400/15 to-purple-400/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-gradient-to-br from-purple-400/10 to-pink-400/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/3 right-1/4 w-32 h-32 bg-blue-300/10 rounded-full blur-2xl" />
          
          <CardContent className="relative p-8 md:p-12">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            {/* Avatar - أصغر حجماً */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-full blur-md opacity-50 group-hover:opacity-70 transition-all" />
              <Avatar className="relative w-24 h-24 border-4 border-white dark:border-zinc-800 shadow-2xl">
                  <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
                  <AvatarFallback className="text-2xl font-black bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                    {getInitials(profile.full_name)}
                  </AvatarFallback>
                </Avatar>
              <Badge className="absolute -bottom-2 left-1/2 -translate-x-1/2 shadow-lg px-3 py-1 text-xs font-bold bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0">
                  {getRoleBadge(profile.user_roles)}
                </Badge>
              </div>
              
              {/* Info Section */}
              <div className="flex-1 text-center md:text-right space-y-4">
                <div>
                  <h1 className="text-4xl md:text-6xl font-black bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent drop-shadow-2xl mb-2">
                    {profile.full_name}
                  </h1>
                  <p className="text-lg md:text-xl text-muted-foreground font-medium">@{profile.username}</p>
                </div>
                
                {/* Business Info */}
                {profile.business_name && (
                  <div className="inline-block p-4 md:p-6 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20 rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 shadow-lg backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-md">
                        <Store className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-right">
                        <p className="text-xl md:text-2xl font-black text-foreground">
                          {profile.business_name}
                        </p>
                        {profile.business_page_name && (
                          <p className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                            {profile.business_page_name}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Edit Button */}
              {canEdit && (
                <Button 
                  size="lg" 
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 border-0"
                  onClick={() => setEditDialogOpen(true)}
                >
                  <Edit2 className="w-5 h-5 ml-2" />
                  تعديل الملف
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

      {/* User Information - Unified Stunning Card */}
      <Card className="relative overflow-hidden border-none shadow-2xl">
        {/* Decorative Background with Transparent Circles */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30 dark:from-zinc-900/50 dark:via-blue-950/20 dark:to-purple-950/20" />
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-gradient-to-br from-purple-400/15 to-pink-400/15 rounded-full blur-2xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-emerald-400/10 rounded-full blur-3xl" />
        
        <CardContent className="relative p-6 md:p-8">
          <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
            <User className="w-6 h-6 text-primary" />
            معلومات الاتصال
          </h2>
          
          {/* Grid 2x2 للمعلومات */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Email */}
            {profile.email && (
              <div className="flex items-center gap-4 p-4 bg-white/60 dark:bg-zinc-800/40 backdrop-blur-sm rounded-xl border border-blue-200/50 dark:border-blue-800/30 hover:border-blue-400 dark:hover:border-blue-600 transition-all group">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-md group-hover:scale-110 transition-transform">
                  <Mail className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">البريد الإلكتروني</p>
                  <p className="text-sm font-bold text-foreground truncate">{profile.email}</p>
                </div>
              </div>
            )}
            
            {/* Phone */}
            {profile.phone && (
              <div className="flex items-center gap-4 p-4 bg-white/60 dark:bg-zinc-800/40 backdrop-blur-sm rounded-xl border border-orange-200/50 dark:border-orange-800/30 hover:border-orange-400 dark:hover:border-orange-600 transition-all group">
                <div className="p-3 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg shadow-md group-hover:scale-110 transition-transform">
                  <Phone className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 mb-1">رقم الهاتف</p>
                  <p className="text-sm font-bold text-foreground font-mono" dir="ltr">{profile.phone}</p>
                </div>
              </div>
            )}
            
            {/* Telegram with Copy Button */}
            {profile.telegram_code && (
              <div className="flex items-center gap-4 p-4 bg-white/60 dark:bg-zinc-800/40 backdrop-blur-sm rounded-xl border border-emerald-200/50 dark:border-emerald-800/30 hover:border-emerald-400 dark:hover:border-emerald-600 transition-all group">
                <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg shadow-md group-hover:scale-110 transition-transform">
                  <Send className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">رمز التليغرام</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-foreground font-mono" dir="ltr">{profile.telegram_code}</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
                      onClick={() => {
                        navigator.clipboard.writeText(profile.telegram_code);
                        toast({
                          title: '✓ تم النسخ',
                          description: `تم نسخ الرمز: ${profile.telegram_code}`,
                        });
                      }}
                    >
                      <Copy className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Employee Code */}
            {profile.employee_code && (
              <div className="flex items-center gap-4 p-4 bg-white/60 dark:bg-zinc-800/40 backdrop-blur-sm rounded-xl border border-purple-200/50 dark:border-purple-800/30 hover:border-purple-400 dark:hover:border-purple-600 transition-all group">
                <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg shadow-md group-hover:scale-110 transition-transform">
                  <Hash className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 mb-1">معرف الموظف</p>
                  <p className="text-sm font-bold text-foreground font-mono" dir="ltr">{profile.employee_code}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

        {/* Business Links */}
        {profile.business_links && profile.business_links.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <ExternalLink className="w-6 h-6 text-primary" />
              روابط الصفحات
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {profile.business_links.map((link, index) => {
                const style = getLinkStyle(link);
                
                return (
                  <a
                    key={index}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`group relative overflow-hidden p-5 bg-gradient-to-br ${style.gradient} rounded-2xl shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300`}
                  >
                    <div className="absolute -top-6 -right-6 w-20 h-20 bg-white/10 rounded-full blur-xl" />
                    
                    <div className="relative flex items-center gap-4">
                      <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl shadow-md">
                        {style.icon}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-white/80 uppercase tracking-wide mb-1">
                          {style.label}
                        </p>
                        <p className="text-sm font-bold text-white truncate">
                          {link.title || new URL(link.url).hostname}
                        </p>
                      </div>
                      <ArrowUpRight className="w-5 h-5 text-white/60 group-hover:text-white group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* Performance Statistics */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-primary" />
            إحصائيات الأداء
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {/* Total Orders */}
            <Card className="group relative overflow-hidden border-none shadow-2xl bg-gradient-to-br from-blue-50 to-green-50 dark:from-blue-950/50 dark:to-green-950/50 hover:scale-105 transition-all duration-500">
              <div className="absolute -top-16 -right-16 w-32 h-32 bg-gradient-to-br from-blue-400/30 to-green-400/30 rounded-full blur-2xl" />
              <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-blue-300/20 rounded-full blur-xl animate-pulse" />
              
              <CardContent className="relative p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="p-4 bg-gradient-to-br from-blue-500 to-green-600 rounded-2xl shadow-xl">
                    <ShoppingCart className="w-10 h-10 text-white" />
                  </div>
                  <div className="text-6xl font-black bg-gradient-to-br from-blue-600 to-green-600 bg-clip-text text-transparent drop-shadow-2xl font-mono" dir="ltr">
                    {stats.totalOrders.toLocaleString('en-US')}
                  </div>
                </div>
                
                <h3 className="text-lg font-bold text-foreground mb-2">إجمالي الطلبات</h3>
                <p className="text-sm text-blue-600 dark:text-blue-400 font-semibold mb-4">
                  {stats.deliveredOrders} تم توصيلها بنجاح ✓
                </p>
                
                <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="absolute inset-y-0 right-0 bg-gradient-to-l from-blue-500 via-green-500 to-emerald-600 rounded-full transition-all duration-1000 ease-out shadow-lg"
                    style={{ width: `${stats.successRate}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-pulse" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center font-medium">
                  {stats.successRate}% نسبة النجاح
                </p>
              </CardContent>
            </Card>

            {/* Total Profits */}
            <Card className="group relative overflow-hidden border-none shadow-2xl bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/50 dark:to-red-950/50 hover:scale-105 transition-all duration-500">
              <div className="absolute -top-16 -right-16 w-32 h-32 bg-gradient-to-br from-orange-400/30 to-red-400/30 rounded-full blur-2xl" />
              <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-orange-300/20 rounded-full blur-xl animate-pulse" />
              
              <CardContent className="relative p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="p-4 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl shadow-xl">
                    <TrendingUp className="w-10 h-10 text-white" />
                  </div>
                  <div className="text-4xl md:text-5xl font-black bg-gradient-to-br from-orange-600 to-red-600 bg-clip-text text-transparent drop-shadow-2xl font-mono" dir="ltr">
                    {stats.totalProfits.toLocaleString('en-US')}
                  </div>
                </div>
                
                <h3 className="text-lg font-bold text-foreground mb-2">إجمالي الأرباح</h3>
                <p className="text-sm text-orange-600 dark:text-orange-400 font-semibold">
                  دينار عراقي 💰
                </p>
              </CardContent>
            </Card>

            {/* Success Rate */}
            <Card className="group relative overflow-hidden border-none shadow-2xl bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/50 dark:to-pink-950/50 hover:scale-105 transition-all duration-500">
              <div className="absolute -top-16 -right-16 w-32 h-32 bg-gradient-to-br from-purple-400/30 to-pink-400/30 rounded-full blur-2xl" />
              <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-purple-300/20 rounded-full blur-xl animate-pulse" />
              
              <CardContent className="relative p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="p-4 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl shadow-xl">
                    <Award className="w-10 h-10 text-white" />
                  </div>
                  <div className="text-6xl font-black bg-gradient-to-br from-purple-600 to-pink-600 bg-clip-text text-transparent drop-shadow-2xl font-mono" dir="ltr">
                    {stats.successRate.toFixed(1)}%
                  </div>
                </div>
                
                <h3 className="text-lg font-bold text-foreground mb-2">نسبة النجاح</h3>
                <p className="text-sm text-purple-600 dark:text-purple-400 font-semibold mb-4">
                  من {stats.totalOrders} طلب إجمالي
                </p>
                
                <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="absolute inset-y-0 right-0 bg-gradient-to-l from-purple-500 via-pink-500 to-fuchsia-600 rounded-full transition-all duration-1000 ease-out shadow-lg"
                    style={{ width: `${stats.successRate}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-pulse" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Edit Profile Dialog */}
      {canEdit && (
        <EditProfileDialog
          isOpen={editDialogOpen}
          onClose={() => {
            setEditDialogOpen(false);
            fetchProfileData();
          }}
          profile={profile}
        />
      )}
    </>
  );
};

export default ProfilePage;
