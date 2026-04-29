import React, { useState, useEffect } from 'react';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Truck, CheckCircle, XCircle, Server, LogOut, UserPlus, Trash2, User, Lock, Star, Badge as BadgeIcon, RefreshCw, Clock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from './ui/use-toast';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import { Switch } from '@/components/ui/switch';
import AddDeliveryPartnerSection from './AddDeliveryPartnerSection';

const DeliveryPartnerDialog = ({ open, onOpenChange }) => {
    const { 
        login, loading, deliveryPartners, activePartner, setActivePartner, 
        isLoggedIn, logout: waseetLogout, waseetUser,
        getUserDeliveryAccounts, setDefaultDeliveryAccount, hasValidToken,
        activateAccount, deleteDeliveryAccount
    } = useAlWaseet();
    const { user } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [userAccounts, setUserAccounts] = useState([]);
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [isRenewing, setIsRenewing] = useState(false);
    const [autoRenewEnabled, setAutoRenewEnabled] = useState(false);
    
    const orderCreationMode = user?.order_creation_mode || 'choice';

    const availablePartners = orderCreationMode === 'local_only'
        ? { local: deliveryPartners.local }
        : orderCreationMode === 'partner_only'
        ? Object.fromEntries(Object.entries(deliveryPartners).filter(([key]) => key !== 'local'))
        : deliveryPartners;

    const [selectedPartner, setSelectedPartner] = useState(() => {
        // ✅ الأولوية 1: localStorage (token data)
        const savedTokenData = localStorage.getItem('delivery_partner_default_token');
        if (savedTokenData) {
            try {
                const tokenData = JSON.parse(savedTokenData);
                if (tokenData.partner_name && Object.keys(availablePartners).includes(tokenData.partner_name)) {
                    return tokenData.partner_name;
                }
            } catch (e) {
                console.error('خطأ في استعادة الشريك:', e);
            }
        }
        
        // ✅ الأولوية 2: activePartner من Context (إذا لم يكن 'local')
        if (activePartner && activePartner !== 'local' && Object.keys(availablePartners).includes(activePartner)) {
            return activePartner;
        }
        
        // ✅ الأولوية 3: أول شريك متاح (ليس local إذا كان هناك خيارات أخرى)
        const partnerKeys = Object.keys(availablePartners);
        const nonLocalPartners = partnerKeys.filter(k => k !== 'local');
        
        return nonLocalPartners.length > 0 ? nonLocalPartners[0] : partnerKeys[0];
    });

    // حالة اتصال الشركاء (محسوبة مسبقاً عند فتح النافذة)
    const [partnerConnectedMap, setPartnerConnectedMap] = useState({});

    // تهيئة الشريك المختار من profiles أو activePartner
    useEffect(() => {
        if (!open || !user?.id) return;
        
        // جلب الشريك المحفوظ في profiles
        supabase
          .from('profiles')
          .select('selected_delivery_partner')
          .eq('user_id', user.id)
          .single()
          .then(({ data: profile }) => {
            const keys = Object.keys(availablePartners);
            let initialPartner;
            
            if (profile?.selected_delivery_partner && keys.includes(profile.selected_delivery_partner)) {
              // استخدام الشريك المحفوظ في profiles
              initialPartner = profile.selected_delivery_partner;
            } else if (activePartner && keys.includes(activePartner)) {
              // استخدام الشريك النشط
              initialPartner = activePartner;
            } else {
              // استخدام أول شريك متاح
              initialPartner = keys[0];
            }
            
            setSelectedPartner((prev) => prev || initialPartner);
          });
    }, [open, user?.id, activePartner, availablePartners]);

    // تحميل حسابات المستخدم عند تغيير الشركة المختارة + Auto Re-login
    useEffect(() => {
        const loadUserAccounts = async () => {
            if (open && user?.id && selectedPartner && selectedPartner !== 'local') {
                // جلب الحساب والشريك المحفوظين في profiles أولاً
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('selected_delivery_account, selected_delivery_partner')
                    .eq('user_id', user.id)
                    .single();
                
                const accounts = await getUserDeliveryAccounts(user.id, selectedPartner);
                // فلترة الحسابات لإظهار فقط الحسابات الصالحة التي لديها توكن
                const validAccounts = accounts.filter(account => account.token && account.token.trim() !== '');
                setUserAccounts(validAccounts);
                
                // تحديد الحساب الافتراضي من profiles أو is_default
                const savedAccount = validAccounts.find(acc => acc.account_username === profile?.selected_delivery_account);
                const defaultAccount = savedAccount || validAccounts.find(acc => acc.is_default) || validAccounts[0];
                setSelectedAccount(defaultAccount || null);
                
                // تحميل حالة التجديد التلقائي للحساب المختار
                if (defaultAccount) {
                    setAutoRenewEnabled(defaultAccount.auto_renew_enabled || false);
                }
                
                // ✅ Auto Re-login: إذا كان هناك حساب افتراضي ولكن التوكن منتهي
                if (defaultAccount && defaultAccount.isExpired && !isLoggedIn) {
                  toast({
                    title: "🔄 إعادة تسجيل الدخول التلقائي",
                    description: `جارٍ تسجيل الدخول إلى ${deliveryPartners[selectedPartner]?.name}...`,
                  });
                  
                  // إعادة تسجيل الدخول تلقائياً
                  await activateAccount(defaultAccount.account_username, selectedPartner, true);
                }
            } else {
                setUserAccounts([]);
                setSelectedAccount(null);
            }
        };
        loadUserAccounts();
    }, [open, user?.id, selectedPartner, getUserDeliveryAccounts, isLoggedIn]);

    // حساب حالة الاتصال لكل شريك (باستخدام hasValidToken)
    useEffect(() => {
        if (!open) return;
        const computeConnections = async () => {
            const entries = await Promise.all(
                Object.keys(availablePartners).filter(k => k !== 'local').map(async (key) => {
                    try {
                        const ok = await hasValidToken(key);
                        return [key, !!ok];
                    } catch { return [key, false]; }
                })
            );
            const map = Object.fromEntries(entries);
            setPartnerConnectedMap(map);
        };
        computeConnections();
    }, [open, availablePartners, hasValidToken]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (selectedPartner === 'local') {
            setActivePartner('local');
            toast({ title: "تم تفعيل الوضع المحلي", description: "سيتم إنشاء الطلبات داخل النظام.", variant: 'success' });
            onOpenChange(false);
            return;
        }
        
        // التبديل إلى حساب موجود وتسجيل الدخول الفعلي
        if (selectedAccount && !username && !password && !showAddForm) {
            // تفعيل الحساب المحفوظ وتسجيل الدخول الفعلي
            const success = await activateAccount(selectedAccount.account_username, selectedPartner, selectedAccount.isExpired);
            if (success) {
                // تحديث الحساب الافتراضي أيضاً
                await setDefaultDeliveryAccount(user.id, selectedPartner, selectedAccount.account_username);
                onOpenChange(false);
            }
            return;
        }
        
        // تسجيل دخول جديد أو إضافة حساب
        const result = await login(username, password, selectedPartner);
        if (result.success) {
            onOpenChange(false);
            setUsername('');
            setPassword('');
            setShowAddForm(false);
            // إعادة تحميل الحسابات بعد تسجيل الدخول
            const accounts = await getUserDeliveryAccounts(user.id, selectedPartner);
            setUserAccounts(accounts);
            
            if (showAddForm) {
                toast({
                    title: "تم إضافة الحساب",
                    description: "تم إضافة الحساب الجديد بنجاح",
                    variant: 'success'
                });
            }
        }
    };

    const handleSetDefaultAccount = async () => {
        if (!selectedAccount || !user?.id) return;
        
        const success = await setDefaultDeliveryAccount(user.id, selectedPartner, selectedAccount.account_username);
        if (success) {
      // حفظ الحساب والشريك الافتراضيين في profiles
      await supabase
        .from('profiles')
        .update({ 
          selected_delivery_account: selectedAccount.account_username,
          selected_delivery_partner: selectedPartner
        })
        .eq('user_id', user.id);
            
            toast({ 
                title: "تم التحديث", 
                description: "تم تعيين الحساب كافتراضي بنجاح", 
                variant: 'success' 
            });
            // إعادة تحميل الحسابات
            const accounts = await getUserDeliveryAccounts(user.id, selectedPartner);
            setUserAccounts(accounts);
        } else {
            toast({ 
                title: "خطأ", 
                description: "فشل في تعيين الحساب الافتراضي", 
                variant: 'destructive' 
            });
        }
    };

    const handleSetDefaultPartner = async () => {
        if (!user?.id || !selectedPartner) return;
        
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ selected_delivery_partner: selectedPartner })
                .eq('user_id', user.id);

            if (error) throw error;

            setActivePartner(selectedPartner);
            
            toast({
                title: "تم التحديث",
                description: `تم تعيين ${availablePartners[selectedPartner]?.name} كشركة افتراضية`,
            });
        } catch (error) {
            console.error('Error setting default partner:', error);
            toast({
                title: "خطأ",
                description: "فشل تعيين الشركة الافتراضية",
                variant: "destructive"
            });
        }
    };
    
    const handleLogout = () => {
        waseetLogout();
        // إعادة تعيين الحالة
        setUserAccounts([]);
        setSelectedAccount(null);
        setUsername('');
        setPassword('');
        setShowAddForm(false);
    };

    const handleAccountLogout = async () => {
        if (!selectedAccount || !user?.id) return;

        // ✅ تسجيل خروج محلي فقط: لا نلمس DB، ولا نمسح التوكن، ولا نعطل الحساب.
        // الحساب يبقى محفوظاً ويمكن التبديل إليه لاحقاً. الحذف الفعلي يتم فقط من زر "حذف الحساب".
        try {
            // إذا كان الحساب المختار هو الجلسة النشطة، أفرغ الجلسة المحلية فقط
            const isActiveSession = isLoggedIn && (
                waseetUser?.username === selectedAccount.account_username ||
                String(waseetUser?.label || '').toLowerCase() === String(selectedAccount.account_username || '').toLowerCase()
            );

            if (isActiveSession) {
                waseetLogout(false); // false = logout محلي فقط، بدون تعطيل
            }

            toast({
                title: "تم تسجيل الخروج",
                description: "تم تسجيل الخروج من الحساب محلياً. الحساب لا يزال محفوظاً ويمكن التبديل إليه لاحقاً.",
                variant: 'default'
            });

            // إعادة تحميل الحسابات (يبقى الحساب ظاهراً)
            const accounts = await getUserDeliveryAccounts(user.id, selectedPartner);
            setUserAccounts(accounts);
        } catch (e) {
            console.error('logout error:', e);
            toast({
                title: "تنبيه",
                description: "تم تسجيل الخروج محلياً.",
                variant: 'default'
            });
        }
    }

    const handleDeleteAccount = async () => {
        if (!selectedAccount || !user?.id) return;
        
        // تأكيد حذف الحساب
        if (!confirm(`هل أنت متأكد من حذف الحساب "${selectedAccount.account_label || selectedAccount.account_username}" نهائياً؟\n\nهذا الإجراء لا يمكن التراجع عنه.`)) {
            return;
        }
        
        // حذف الحساب نهائياً من قاعدة البيانات
        const success = await deleteDeliveryAccount(user.id, selectedPartner, selectedAccount.account_username);
        if (success) {
            // إعادة تحميل الحسابات
            const accounts = await getUserDeliveryAccounts(user.id, selectedPartner);
            setUserAccounts(accounts);
            setSelectedAccount(accounts[0] || null);
        }
    }

    const handleRenewToken = async () => {
        if (!selectedAccount || !user?.id || isRenewing) return;
        
        setIsRenewing(true);
        
        try {
            toast({
                title: "🔄 جاري تجديد التوكن",
                description: `جاري تجديد التوكن للحساب ${selectedAccount.account_label || selectedAccount.account_username}...`,
            });
            
            // إعادة تسجيل الدخول باستخدام بيانات الحساب المحفوظة
            const success = await activateAccount(selectedAccount.account_username, selectedPartner, true);
            
            if (success) {
                // تحديث expires_at لـ 7 أيام جديدة
                const newExpiryDate = new Date();
                newExpiryDate.setDate(newExpiryDate.getDate() + 7);
                
                const { error } = await supabase
                    .from('delivery_partner_tokens')
                    .update({
                        expires_at: newExpiryDate.toISOString(),
                        last_used_at: new Date().toISOString()
                    })
                    .eq('user_id', user.id)
                    .eq('partner_name', selectedPartner)
                    .eq('account_username', selectedAccount.account_username);
                
                if (!error) {
                    toast({
                        title: "✅ تم تجديد التوكن",
                        description: `تم تجديد التوكن بنجاح. صالح لمدة 7 أيام جديدة.`,
                        variant: 'success'
                    });
                    
                    // إعادة تحميل الحسابات لتحديث تاريخ الانتهاء
                    const accounts = await getUserDeliveryAccounts(user.id, selectedPartner);
                    setUserAccounts(accounts);
                    const updatedAccount = accounts.find(acc => acc.account_username === selectedAccount.account_username);
                    setSelectedAccount(updatedAccount || selectedAccount);
                } else {
                    throw new Error(error.message);
                }
            } else {
                throw new Error('فشل في تجديد التوكن');
            }
        } catch (error) {
            console.error('Error renewing token:', error);
            toast({
                title: "❌ خطأ في التجديد",
                description: "فشل في تجديد التوكن. يرجى المحاولة مرة أخرى أو تسجيل الدخول يدوياً.",
                variant: 'destructive'
            });
        } finally {
        setIsRenewing(false);
        }
    }

    const handleToggleAutoRenew = async (enabled) => {
        if (!selectedAccount || !user?.id) return;
        
        try {
            const { error } = await supabase
                .from('delivery_partner_tokens')
                .update({ auto_renew_enabled: enabled })
                .eq('user_id', user.id)
                .eq('partner_name', selectedPartner)
                .eq('account_username', selectedAccount.account_username);
            
            if (error) throw error;
            
            setAutoRenewEnabled(enabled);
            
            toast({
                title: enabled ? "✅ تم تفعيل التجديد التلقائي" : "❌ تم إلغاء التجديد التلقائي",
                description: enabled 
                    ? "سيتم تجديد التوكن تلقائياً في اليوم الأخير قبل انتهاء الصلاحية" 
                    : "لن يتم تجديد التوكن تلقائياً",
                variant: enabled ? 'success' : 'default'
            });
        } catch (error) {
            console.error('Error toggling auto-renew:', error);
            toast({
                title: "خطأ",
                description: "فشل في تحديث إعدادات التجديد التلقائي",
                variant: 'destructive'
            });
        }
    }

    const isCurrentPartnerSelected = activePartner === selectedPartner;


    const renderPartnerContent = () => {
        if (selectedPartner === 'local') {
            return (
                <Card className="bg-blue-500/10 border-blue-500/30 text-foreground">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-blue-500"><Server className="w-5 h-5"/> الوضع المحلي</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">سيتم إنشاء الطلبات وحفظها داخل النظام مباشرة.</p>
                    </CardContent>
                </Card>
            );
        }

        // Check if we have saved accounts for this partner
        const hasAccounts = userAccounts.length > 0;
        
        // If we have saved accounts, show account selection
        if (userAccounts.length > 0) {
            return (
                <Card className="bg-green-500/10 border-green-500/30 text-foreground">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
                            <CheckCircle className="w-5 h-5"/> متصل - حسابات محفوظة
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                            يمكنك اختيار حساب محفوظ أو إضافة حساب جديد لـ {deliveryPartners[selectedPartner]?.name}
                        </p>
                        
                        {selectedAccount && (
                            <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-sm text-gray-800 dark:text-gray-200">
                                            <span className="font-medium">الحساب المختار:</span> {selectedAccount.account_label || selectedAccount.partner_data?.username || selectedAccount.account_username}
                                        </p>
                                        {selectedAccount.is_default && (
                                            <div className="flex items-center gap-1 text-xs mt-1">
                                                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                                                <span className="text-amber-600 dark:text-amber-400">الحساب الافتراضي</span>
                                            </div>
                                        )}
                                    </div>
                                    {selectedAccount.expires_at && (
                                        <span className="text-xs text-muted-foreground">
                                            ينتهي: {(() => {
                                                try {
                                                    const date = new Date(selectedAccount.expires_at);
                                                    return date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'numeric', year: 'numeric' });
                                                } catch {
                                                    return 'غير محدد';
                                                }
                                            })()}
                                        </span>
                                    )}
                                </div>
                                
                                {/* التجديد التلقائي Toggle */}
                                <div className="flex items-center justify-between mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-primary" />
                                        <div>
                                            <Label className="text-sm font-medium cursor-pointer">التجديد التلقائي</Label>
                                            <p className="text-xs text-muted-foreground">يجدد التوكن في اليوم الأخير تلقائياً</p>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={autoRenewEnabled}
                                        onCheckedChange={handleToggleAutoRenew}
                                    />
                                </div>
                            </div>
                        )}
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                            {selectedAccount && !selectedAccount.is_default && (
                                <Button 
                                    variant="secondary" 
                                    size="sm" 
                                    type="button" 
                                    onClick={handleSetDefaultAccount}
                                    className="w-full"
                                >
                                    تعيين كافتراضي
                                </Button>
                            )}
                            {selectedAccount && (
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    type="button" 
                                    onClick={handleRenewToken}
                                    className="w-full border-green-200 text-green-600 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950/30"
                                    disabled={isRenewing}
                                >
                                    <RefreshCw className={`w-4 h-4 ml-2 ${isRenewing ? 'animate-spin' : ''}`} />
                                    {isRenewing ? "جاري التجديد..." : "تجديد التوكن"}
                                </Button>
                            )}
                            {selectedAccount && (
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    type="button" 
                                    onClick={handleAccountLogout}
                                    className="w-full border-orange-200 text-orange-600 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-950/30"
                                >
                                    <LogOut className="w-4 h-4 ml-2" />
                                    تسجيل الخروج
                                </Button>
                            )}
                            {selectedAccount && (
                                <Button 
                                    variant="destructive" 
                                    size="sm" 
                                    type="button" 
                                    onClick={handleDeleteAccount}
                                    className="w-full"
                                >
                                    <Trash2 className="w-4 h-4 ml-2" />
                                    حذف الحساب
                                </Button>
                            )}
                        </div>
                        
                        {showAddForm && (
                            <div className="border-t pt-4 space-y-2">
                                <p className="text-sm text-muted-foreground mb-2">إضافة حساب جديد:</p>
                                <Input 
                                    type="text" 
                                    value={username} 
                                    onChange={(e) => setUsername(e.target.value)} 
                                    placeholder="اسم المستخدم الجديد" 
                                    className="h-8"
                                />
                                <Input 
                                    type="password" 
                                    value={password} 
                                    onChange={(e) => setPassword(e.target.value)} 
                                    placeholder="كلمة المرور" 
                                    className="h-8"
                                />
                            </div>
                        )}
                    </CardContent>
                </Card>
            );
        }

        // No saved accounts - show login form
        return (
            <Card className="bg-amber-500/10 border-amber-500/30 text-foreground">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                        <XCircle className="w-5 h-5"/> غير متصل
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        لا توجد حسابات محفوظة لـ {deliveryPartners[selectedPartner]?.name}. يرجى تسجيل الدخول:
                    </p>
                    <div className="space-y-2">
                        <Label htmlFor="waseet-username" className="text-base font-semibold text-foreground flex items-center gap-2">
                            <User className="w-4 h-4 text-primary" />
                            اسم المستخدم
                        </Label>
                        <Input 
                            id="waseet-username" 
                            type="text" 
                            value={username} 
                            onChange={(e) => setUsername(e.target.value)} 
                            required 
                            placeholder="أدخل اسم المستخدم"
                            className="h-12 text-base border-2 border-primary/30 focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background placeholder:text-muted-foreground/60 font-medium shadow-sm hover:shadow-md transition-all"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="waseet-password" className="text-base font-semibold text-foreground flex items-center gap-2">
                            <Lock className="w-4 h-4 text-primary" />
                            كلمة المرور
                        </Label>
                        <Input 
                            id="waseet-password" 
                            type="password" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            required 
                            placeholder="أدخل كلمة المرور"
                            className="h-12 text-base border-2 border-primary/30 focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background placeholder:text-muted-foreground/60 font-medium shadow-sm hover:shadow-md transition-all"
                        />
                    </div>
                </CardContent>
            </Card>
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><Truck className="w-5 h-5"/> إدارة شركة التوصيل</DialogTitle>
                    <DialogDescription>
                        اختر شركة التوصيل أو قم بتفعيل الوضع المحلي.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="py-4 space-y-4">
                     <div className="space-y-3">
                        <Label>اختر شركة التوصيل</Label>
                        <Select 
                            value={selectedPartner} 
                            onValueChange={(value) => {
                                setSelectedPartner(value);
                                // إعادة تعيين البيانات عند تغيير الشركة
                                setUsername('');
                                setPassword('');
                            }} 
                            disabled={Object.keys(availablePartners).length === 1}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="اختر شركة..." />
                            </SelectTrigger>
                            <SelectContent className="bg-background border border-border">
                                {Object.entries(availablePartners).map(([key, partner]) => {
                                    // تحسين منطق تحديد حالة الاتصال لكل شريك
                                    let isConnected = false;
                                    let statusLabel = 'غير متصل';
                                    
                                    if (key === 'local') {
                                        isConnected = true;
                                        statusLabel = 'محلي';
                                    } else {
                                        const tokenConnected = !!partnerConnectedMap[key];
                                        const hasAccountsForThisKey = key === selectedPartner ? (userAccounts.length > 0) : false;
                                        isConnected = tokenConnected || hasAccountsForThisKey;
                                        statusLabel = isConnected ? 'متصل' : 'غير متصل';
                                    }
                                    
                                    return (
                                        <SelectItem key={key} value={key}>
                                            <div className="flex items-center justify-between w-full gap-2">
                                                <span>{partner.name}</span>
                                                <div className="flex items-center gap-1.5">
                                                    {isConnected && key !== 'local' && (
                                                        <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                                                    )}
                                                    {activePartner === key && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400">
                                                            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                        
                        {/* زر تعيين الشركة كافتراضية */}
                        {selectedPartner !== 'local' && partnerConnectedMap[selectedPartner] && (
                            <Button 
                                type="button"
                                onClick={handleSetDefaultPartner}
                                variant="outline"
                                size="sm"
                                className="w-full mt-2"
                            >
                                <Star className="w-4 h-4 mr-2" />
                                تعيين {availablePartners[selectedPartner]?.name} كشركة افتراضية
                            </Button>
                        )}
                    </div>

                    {/* منسدلة الحسابات - أسفل اختيار الشركة مباشرة */}
                    {selectedPartner !== 'local' && userAccounts.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Label>الحسابات المحفوظة</Label>
                                <Button 
                                    type="button" 
                                    variant="secondary" 
                                    size="sm" 
                                    onClick={() => setShowAddForm(true)}
                                    className="h-7 px-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-600 border-blue-500/30 shadow-sm"
                                >
                                    <UserPlus className="w-3 h-3 ml-1" />
                                    إضافة حساب
                                </Button>
                            </div>
                            <Select 
                                value={selectedAccount?.account_username || ''} 
                                onValueChange={(value) => {
                                    const account = userAccounts.find(acc => acc.account_username === value);
                                    setSelectedAccount(account);
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="اختر حساب..." />
                                </SelectTrigger>
                                <SelectContent className="bg-background border border-border">
                                    {userAccounts.map((account) => (
                                        <SelectItem key={account.account_username} value={account.account_username}>
                                            <div className="flex items-center gap-2">
                                                <span>{account.account_label || account.partner_data?.username || account.account_username}</span>
                                                {account.is_default && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400">
                                                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                                                    </span>
                                                )}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={selectedPartner}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            {renderPartnerContent()}
                        </motion.div>
                    </AnimatePresence>

                     <DialogFooter>
                        <Button 
                            type="submit" 
                            disabled={loading || (selectedPartner !== 'local' && !selectedAccount && !username)} 
                            className="w-full"
                        >
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {selectedPartner === 'local' 
                                ? 'تفعيل الوضع المحلي' 
                                : selectedAccount && !username && !showAddForm
                                    ? `التبديل إلى ${selectedAccount.partner_data?.username || selectedAccount.account_username}`
                                    : showAddForm 
                                        ? 'إضافة الحساب الجديد'
                                        : 'تسجيل الدخول'
                            }
                        </Button>
                    </DialogFooter>
                </form>

            </DialogContent>
        </Dialog>
    );
};

export default DeliveryPartnerDialog;