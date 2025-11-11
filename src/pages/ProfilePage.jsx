import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { 
  User, Mail, ShoppingCart, TrendingUp, Award, 
  Edit2, Store, Send, Phone, Loader, Hash
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
  const { isAdmin } = usePermissions();
  
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({ totalOrders: 0, deliveredOrders: 0, totalProfits: 0, successRate: 0 });
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const targetIdentifier = identifier || user?.username;
  const isOwnProfile = !identifier || identifier === user?.username || identifier === user?.id;

  useEffect(() => {
    if (targetIdentifier) {
      fetchProfileData();
    }
  }, [targetIdentifier]);

  const fetchProfileData = async () => {
    try {
      setLoading(true);

      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetIdentifier);
      
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
        .eq(isUUID ? 'id' : 'username', targetIdentifier)
        .maybeSingle();

      if (profileError) {
        console.error('خطأ في جلب البروفايل:', profileError);
        toast({
          title: "خطأ",
          description: "فشل في تحميل بيانات الملف الشخصي",
          variant: "destructive",
        });
        return;
      }

      if (!profileData) {
        toast({
          title: "غير موجود",
          description: "الملف الشخصي المطلوب غير موجود",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      const enrichedProfile = allUsers?.find(u => u.user_id === profileData.user_id);
      if (enrichedProfile) {
        profileData.telegram_code = enrichedProfile.telegram_code || profileData.telegram_code;
        profileData.telegram_linked = enrichedProfile.telegram_linked;
        profileData.telegram_linked_at = enrichedProfile.telegram_linked_at;
      }

      setProfile(profileData);

      const { data: ordersData } = await supabase
        .from('orders')
        .select('status, delivery_status')
        .eq('created_by', profileData.user_id);

      const { data: profitsData } = await supabase
        .from('profits')
        .select('profit_amount')
        .eq('employee_id', profileData.user_id);

      const totalOrders = ordersData?.length || 0;
      const deliveredOrders = ordersData?.filter(o => o.delivery_status === '4' || o.status === 'completed')?.length || 0;
      const totalProfits = profitsData?.reduce((sum, p) => sum + (parseFloat(p.profit_amount) || 0), 0) || 0;
      const successRate = totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 0;

      setStats({ totalOrders, deliveredOrders, totalProfits, successRate });

    } catch (error) {
      console.error('خطأ في جلب بيانات الملف الشخصي:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تحميل البيانات",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const getRoleBadge = (userRoles) => {
    if (!userRoles || userRoles.length === 0) return 'موظف';
    
    const rolePriority = ['super-admin', 'department-manager', 'employee'];
    const activeRoles = userRoles.filter(ur => ur.is_active && ur.roles);
    
    for (const priority of rolePriority) {
      const found = activeRoles.find(ur => ur.roles.name === priority);
      if (found) return found.roles.display_name || found.roles.name;
    }
    
    return activeRoles[0]?.roles?.display_name || 'موظف';
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('ar-IQ', {
      style: 'currency',
      currency: 'IQD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const canEdit = isOwnProfile || isAdmin;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <User className="w-24 h-24 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold text-foreground mb-2">الملف الشخصي غير موجود</h2>
        <p className="text-muted-foreground">لم يتم العثور على المستخدم المطلوب</p>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{profile.full_name} - الملف الشخصي</title>
        <meta name="description" content={`الملف الشخصي لـ ${profile.full_name}`} />
      </Helmet>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header Card - تصميم عالمي احترافي مبهر */}
        <Card className="relative overflow-hidden border-2 border-primary/20 shadow-2xl mb-8">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-purple-500/5 to-pink-500/5" />
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          
          <CardContent className="relative p-8">
            <div className="flex flex-col md:flex-row items-start gap-8">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-purple-600 rounded-full blur-md opacity-50 group-hover:opacity-75 transition-opacity" />
                <Avatar className="relative w-32 h-32 border-4 border-background shadow-2xl">
                  <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
                  <AvatarFallback className="text-3xl font-bold bg-gradient-to-br from-primary to-purple-600 text-white">
                    {getInitials(profile.full_name)}
                  </AvatarFallback>
                </Avatar>
                <Badge className="absolute -bottom-3 left-1/2 -translate-x-1/2 shadow-lg px-3 py-1">
                  {getRoleBadge(profile.user_roles)}
                </Badge>
              </div>
              
              <div className="flex-1">
                <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-primary via-purple-600 to-pink-600 bg-clip-text text-transparent mb-3 drop-shadow-lg">
                  {profile.full_name}
                </h1>
                <p className="text-xl text-muted-foreground mb-6">@{profile.username}</p>
                
                {profile.business_name && (
                  <div className="p-5 bg-gradient-to-br from-primary/10 to-purple-500/5 rounded-xl border-2 border-primary/30 shadow-xl backdrop-blur-sm">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-primary/20 rounded-lg">
                        <Store className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <span className="text-2xl font-bold text-foreground">
                          {profile.business_name}
                        </span>
                        {profile.business_page_name && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {profile.business_page_name}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {canEdit && (
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="hover:scale-105 transition-transform shadow-md"
                  onClick={() => setEditDialogOpen(true)}
                >
                  <Edit2 className="w-5 h-5 ml-2" />
                  تعديل الملف
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* معلومات الاتصال - Cards احترافية ملونة */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {profile.email && (
            <div className="group p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 rounded-xl border-2 border-blue-200 dark:border-blue-800 hover:shadow-xl hover:-translate-y-1 transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-500 rounded-lg shadow-md">
                  <Mail className="w-5 h-5 text-white" />
                </div>
                <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase">البريد الإلكتروني</p>
              </div>
              <p className="text-sm font-semibold text-foreground truncate pr-1">{profile.email}</p>
            </div>
          )}
          
          {profile.employee_code && (
            <div className="group p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20 rounded-xl border-2 border-purple-200 dark:border-purple-800 hover:shadow-xl hover:-translate-y-1 transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-500 rounded-lg shadow-md">
                  <Hash className="w-5 h-5 text-white" />
                </div>
                <p className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase">معرف الموظف</p>
              </div>
              <p className="text-sm font-semibold font-mono text-foreground">{profile.employee_code}</p>
            </div>
          )}
          
          {profile.telegram_code && (
            <div className="group p-4 bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950/30 dark:to-emerald-900/20 rounded-xl border-2 border-green-200 dark:border-green-800 hover:shadow-xl hover:-translate-y-1 transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-500 rounded-lg shadow-md">
                  <Send className="w-5 h-5 text-white" />
                </div>
                <p className="text-xs font-medium text-green-600 dark:text-green-400 uppercase">رمز التليغرام</p>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold font-mono text-foreground">{profile.telegram_code}</p>
                {profile.telegram_linked && (
                  <Badge variant="outline" className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700">
                    متصل
                  </Badge>
                )}
              </div>
            </div>
          )}
          
          {profile.phone && (
            <div className="group p-4 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/20 rounded-xl border-2 border-orange-200 dark:border-orange-800 hover:shadow-xl hover:-translate-y-1 transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-orange-500 rounded-lg shadow-md">
                  <Phone className="w-5 h-5 text-white" />
                </div>
                <p className="text-xs font-medium text-orange-600 dark:text-orange-400 uppercase">رقم الهاتف</p>
              </div>
              <p className="text-sm font-semibold font-mono text-foreground">{profile.phone}</p>
            </div>
          )}
        </div>

        {/* إحصائيات الأداء - Cards ديناميكية */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="group relative overflow-hidden border-2 border-green-500/30 hover:border-green-500 hover:shadow-2xl hover:shadow-green-500/20 hover:-translate-y-2 transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500/20 to-transparent rounded-bl-full" />
            <CardContent className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                  <ShoppingCart className="w-8 h-8 text-green-600" />
                </div>
                <div className="text-5xl font-black text-green-600 dark:text-green-400 drop-shadow-lg">
                  {stats.totalOrders}
                </div>
              </div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">إجمالي الطلبات</h3>
              <p className="text-xs text-green-600 dark:text-green-400 font-semibold">
                {stats.deliveredOrders} تم توصيلها بنجاح
              </p>
              <div className="mt-3 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-600 transition-all duration-500"
                  style={{ width: `${stats.successRate}%` }}
                />
              </div>
            </CardContent>
          </Card>
          
          <Card className="group relative overflow-hidden border-2 border-blue-500/30 hover:border-blue-500 hover:shadow-2xl hover:shadow-blue-500/20 hover:-translate-y-2 transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/20 to-transparent rounded-bl-full" />
            <CardContent className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                  <TrendingUp className="w-8 h-8 text-blue-600" />
                </div>
                <div className="text-3xl font-black text-blue-600 dark:text-blue-400 drop-shadow-lg">
                  {formatCurrency(stats.totalProfits)}
                </div>
              </div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">إجمالي الأرباح</h3>
              <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">
                من {stats.deliveredOrders} طلب مكتمل
              </p>
              <div className="mt-3 flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-2 flex-1 bg-gradient-to-r from-blue-400 to-blue-600 rounded-full opacity-50" 
                       style={{ animationDelay: `${i * 0.1}s` }} />
                ))}
              </div>
            </CardContent>
          </Card>
          
          <Card className="group relative overflow-hidden border-2 border-purple-500/30 hover:border-purple-500 hover:shadow-2xl hover:shadow-purple-500/20 hover:-translate-y-2 transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/20 to-transparent rounded-bl-full" />
            <CardContent className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                  <Award className="w-8 h-8 text-purple-600" />
                </div>
                <div className="text-5xl font-black text-purple-600 dark:text-purple-400 drop-shadow-lg">
                  {stats.successRate}%
                </div>
              </div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">نسبة النجاح</h3>
              <p className="text-xs text-purple-600 dark:text-purple-400 font-semibold">
                معدل التوصيل الناجح
              </p>
              <div className="mt-3 flex justify-center">
                <div className="relative w-16 h-16">
                  <svg className="w-16 h-16 transform -rotate-90">
                    <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="none" className="text-gray-200 dark:text-gray-700" />
                    <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="none" className="text-purple-600 dark:text-purple-400"
                            strokeDasharray={`${stats.successRate * 1.76} 176`} strokeLinecap="round" />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {canEdit && (
        <EditProfileDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          profile={profile}
          onProfileUpdated={fetchProfileData}
        />
      )}
    </>
  );
};

export default ProfilePage;
