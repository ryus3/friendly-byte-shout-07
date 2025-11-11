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
  ExternalLink, Instagram, Facebook, Globe, ArrowUpRight
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
        {/* Header Card - Revolutionary Design */}
        <Card className="relative overflow-hidden border-none shadow-2xl bg-gradient-to-br from-white to-gray-50 dark:from-zinc-900 dark:to-zinc-950">
          {/* Decorative Background Shapes */}
          <div className="absolute -top-32 -right-32 w-64 h-64 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-gradient-to-br from-emerald-400/20 to-teal-400/20 rounded-full blur-3xl" />
          <div className="absolute top-10 right-20 w-40 h-40 bg-orange-400/10 rounded-full blur-2xl animate-pulse" />
          
          <CardContent className="relative p-8 md:p-12">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
              {/* Avatar - أصغر حجماً */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-full blur-lg opacity-60 group-hover:opacity-80 transition-all animate-pulse" />
                <Avatar className="relative w-24 h-24 border-4 border-white dark:border-zinc-800 shadow-2xl ring-4 ring-primary/20">
                  <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
                  <AvatarFallback className="text-2xl font-black bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                    {getInitials(profile.full_name)}
                  </AvatarFallback>
                </Avatar>
                <Badge className="absolute -bottom-2 left-1/2 -translate-x-1/2 shadow-xl px-4 py-1.5 text-xs font-bold bg-gradient-to-r from-primary to-purple-600 text-white border-0">
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

        {/* User Information - Beautiful Colored Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {/* Email Card */}
          {profile.email && (
            <div className="group relative overflow-hidden p-6 bg-gradient-to-br from-blue-400 to-blue-600 dark:from-blue-600 dark:to-blue-800 rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
              <div className="absolute -top-8 -right-8 w-24 h-24 bg-white/10 rounded-full blur-xl" />
              
              <div className="relative">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
                    <Mail className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-xs font-bold text-white/80 uppercase tracking-wide">البريد الإلكتروني</p>
                </div>
                <p className="text-sm font-bold text-white truncate">{profile.email}</p>
              </div>
            </div>
          )}
          
          {/* Phone Card */}
          {profile.phone && (
            <div className="group relative overflow-hidden p-6 bg-gradient-to-br from-orange-400 to-red-500 dark:from-orange-600 dark:to-red-700 rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
              <div className="absolute -top-8 -right-8 w-24 h-24 bg-white/10 rounded-full blur-xl" />
              
              <div className="relative">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
                    <Phone className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-xs font-bold text-white/80 uppercase tracking-wide">رقم الهاتف</p>
                </div>
                <p className="text-sm font-bold text-white font-mono">{profile.phone}</p>
              </div>
            </div>
          )}
          
          {/* Telegram Card */}
          {profile.telegram_code && (
            <div className="group relative overflow-hidden p-6 bg-gradient-to-br from-emerald-400 to-teal-600 dark:from-emerald-600 dark:to-teal-800 rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
              <div className="absolute -top-8 -right-8 w-24 h-24 bg-white/10 rounded-full blur-xl" />
              
              <div className="relative">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
                    <Send className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-xs font-bold text-white/80 uppercase tracking-wide">رمز التليغرام</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-white font-mono">{profile.telegram_code}</p>
                  {profile.telegram_linked && (
                    <Badge variant="outline" className="bg-white/20 text-white border-white/30 backdrop-blur-sm text-xs">
                      متصل
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Employee Code Card */}
          {profile.employee_code && (
            <div className="group relative overflow-hidden p-6 bg-gradient-to-br from-purple-400 to-indigo-600 dark:from-purple-600 dark:to-indigo-800 rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
              <div className="absolute -top-8 -right-8 w-24 h-24 bg-white/10 rounded-full blur-xl" />
              
              <div className="relative">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
                    <Hash className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-xs font-bold text-white/80 uppercase tracking-wide">معرف الموظف</p>
                </div>
                <p className="text-sm font-bold text-white font-mono">{profile.employee_code}</p>
              </div>
            </div>
          )}
        </div>

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
                  <div className="text-6xl font-black bg-gradient-to-br from-blue-600 to-green-600 bg-clip-text text-transparent drop-shadow-2xl">
                    {stats.totalOrders}
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
                  <div className="text-4xl md:text-5xl font-black bg-gradient-to-br from-orange-600 to-red-600 bg-clip-text text-transparent drop-shadow-2xl">
                    {formatCurrency(stats.totalProfits)}
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
                  <div className="text-6xl font-black bg-gradient-to-br from-purple-600 to-pink-600 bg-clip-text text-transparent drop-shadow-2xl">
                    {stats.successRate}%
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
