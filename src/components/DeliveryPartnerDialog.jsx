import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/UnifiedAuthContext";
import { useAlWaseet } from "@/contexts/AlWaseetContext";
import { 
    CheckCircle, 
    AlertCircle, 
    Loader2, 
    UserPlus,
    Settings,
    Server,
    LogOut,
    Trash2
} from "lucide-react";
import { useState, useEffect } from 'react';

export function DeliveryPartnerDialog({ open, onOpenChange }) {
    const { toast } = useToast();
    const { user } = useAuth();
    const { 
        isLoggedIn, 
        activePartner, 
        setActivePartner, 
        waseetLogin, 
        waseetLogout, 
        connectionStatus, 
        getUserDeliveryAccounts, 
        setDefaultDeliveryAccount, 
        deleteDeliveryAccount,
        permanentDeleteDeliveryAccount 
    } = useAlWaseet();

    // حالات الحوار
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [userAccounts, setUserAccounts] = useState([]);
    const [selectedAccount, setSelectedAccount] = useState(null);

    // شركات التوصيل المتاحة حسب الصلاحيات
    const { orderCreationMode } = user?.profile || {};
    const availablePartners = orderCreationMode === 'both' ? ['local', 'alwaseet'] : 
                             orderCreationMode === 'delivery_only' ? ['alwaseet'] : ['local'];

    const [selectedPartner, setSelectedPartner] = useState(availablePartners[0] || 'local');

    // تحديث الشريك المختار عند فتح الحوار أو تغيير الشريك النشط
    useEffect(() => {
        if (open && activePartner && availablePartners.includes(activePartner)) {
            setSelectedPartner(activePartner);
        }
    }, [open, activePartner, availablePartners]);

    // تحميل حسابات المستخدم
    useEffect(() => {
        const loadUserAccounts = async () => {
            if (open && user?.id && selectedPartner && selectedPartner !== 'local') {
                const accounts = await getUserDeliveryAccounts(user.id, selectedPartner);
                // فلترة الحسابات لإظهار فقط الحسابات الصالحة التي لديها توكن
                const validAccounts = accounts.filter(account => account.token && account.token.trim() !== '');
                setUserAccounts(validAccounts);
                const defaultAccount = validAccounts.find(acc => acc.is_default);
                setSelectedAccount(defaultAccount || validAccounts[0] || null);
            } else {
                setUserAccounts([]);
                setSelectedAccount(null);
            }
        };

        loadUserAccounts();
    }, [open, user?.id, selectedPartner, getUserDeliveryAccounts]);

    // تحديث حالة الاتصال
    useEffect(() => {
        const updateConnectionStatus = async () => {
            if (open && selectedPartner && connectionStatus[selectedPartner] !== undefined) {
                // تحديث حالة الاتصال حسب الشريك المختار
            }
        };

        updateConnectionStatus();
    }, [open, selectedPartner, connectionStatus]);

    // معالجة الإرسال (تسجيل الدخول)
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (selectedPartner === 'local') {
            // تفعيل الوضع المحلي
            setActivePartner('local');
            toast({
                title: "تم التفعيل", 
                description: "تم تفعيل الوضع المحلي بنجاح",
                variant: 'success'
            });
            onOpenChange(false);
        } else if (selectedAccount) {
            // تفعيل حساب محفوظ
            setActivePartner(selectedPartner);
            toast({
                title: "تم التفعيل", 
                description: `تم تفعيل حساب ${selectedAccount.account_label || selectedAccount.account_username}`,
                variant: 'success'
            });
            onOpenChange(false);
        } else if (username && password && showAddForm) {
            // تسجيل دخول جديد
            try {
                const success = await waseetLogin(username, password, selectedPartner);
                if (success) {
                    toast({
                        title: "تم تسجيل الدخول", 
                        description: `تم تسجيل الدخول بنجاح إلى ${selectedPartner}`,
                        variant: 'success'
                    });
                    setUsername('');
                    setPassword('');
                    setShowAddForm(false);
                    // إعادة تحميل الحسابات
                    const accounts = await getUserDeliveryAccounts(user.id, selectedPartner);
                    const validAccounts = accounts.filter(account => account.token && account.token.trim() !== '');
                    setUserAccounts(validAccounts);
                    const defaultAccount = validAccounts.find(acc => acc.is_default);
                    setSelectedAccount(defaultAccount || validAccounts[0] || null);
                    onOpenChange(false);
                }
            } catch (error) {
                console.error('Login error:', error);
                toast({
                    title: "خطأ في تسجيل الدخول", 
                    description: error.message || "فشل في تسجيل الدخول",
                    variant: 'destructive'
                });
            }
        }
    };

    const handleSetDefaultAccount = async () => {
        if (!selectedAccount || !user?.id) return;
        
        const success = await setDefaultDeliveryAccount(user.id, selectedPartner, selectedAccount.account_username);
        if (success) {
            toast({
                title: "تم التحديث", 
                description: "تم تعيين الحساب كافتراضي", 
                variant: 'success'
            });
            // إعادة تحميل الحسابات
            const accounts = await getUserDeliveryAccounts(user.id, selectedPartner);
            const validAccounts = accounts.filter(account => account.token && account.token.trim() !== '');
            setUserAccounts(validAccounts);
        } else {
            toast({ 
                title: "خطأ", 
                description: "فشل في تعيين الحساب الافتراضي", 
                variant: 'destructive' 
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
        
        // تسجيل خروج الحساب (إلغاء التفعيل)
        const success = await deleteDeliveryAccount(user.id, selectedPartner, selectedAccount.account_username);
        if (success) {
            toast({
                title: "تم تسجيل الخروج",
                description: "تم تسجيل خروج الحساب بنجاح",
                variant: 'success'
            });
            // إعادة تحميل الحسابات
            const accounts = await getUserDeliveryAccounts(user.id, selectedPartner);
            const validAccounts = accounts.filter(account => account.token && account.token.trim() !== '');
            setUserAccounts(validAccounts);
            setSelectedAccount(validAccounts[0] || null);
        } else {
            toast({
                title: "خطأ",
                description: "فشل في تسجيل الخروج",
                variant: 'destructive'
            });
        }
    };

    const handlePermanentDelete = async () => {
        if (!selectedAccount || !user?.id) return;
        
        if (!confirm('هل أنت متأكد من حذف هذا الحساب نهائياً؟ لا يمكن التراجع عن هذا الإجراء.')) {
            return;
        }
        
        // حذف الحساب نهائياً
        const success = await permanentDeleteDeliveryAccount(user.id, selectedPartner, selectedAccount.account_username);
        if (success) {
            toast({
                title: "تم الحذف",
                description: "تم حذف الحساب نهائياً",
                variant: 'success'
            });
            // إعادة تحميل الحسابات
            const accounts = await getUserDeliveryAccounts(user.id, selectedPartner);
            const validAccounts = accounts.filter(account => account.token && account.token.trim() !== '');
            setUserAccounts(validAccounts);
            setSelectedAccount(validAccounts[0] || null);
        } else {
            toast({
                title: "خطأ",
                description: "فشل في حذف الحساب",
                variant: 'destructive'
            });
        }
    };

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

        const currentStatus = connectionStatus[selectedPartner];
        const hasAccounts = userAccounts.length > 0;

        if (hasAccounts && !showAddForm) {
            // عرض الحسابات المحفوظة
            return (
                <Card className="bg-green-500/10 border-green-500/30">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-green-600">
                            <CheckCircle className="w-5 h-5"/>
                            متصل - {selectedPartner}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>اختر الحساب:</Label>
                            <Select value={selectedAccount?.account_username || ''} onValueChange={(value) => {
                                const account = userAccounts.find(acc => acc.account_username === value);
                                setSelectedAccount(account);
                            }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="اختر حساب" />
                                </SelectTrigger>
                                <SelectContent>
                                    {userAccounts.map((account) => (
                                        <SelectItem key={account.account_username} value={account.account_username}>
                                            <div className="flex items-center gap-2">
                                                <span>{account.account_label || account.account_username}</span>
                                                {account.is_default && <Badge variant="secondary">افتراضي</Badge>}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="flex gap-2">
                            {selectedAccount && !selectedAccount.is_default && (
                                <Button 
                                    variant="secondary" 
                                    size="sm" 
                                    type="button" 
                                    onClick={handleSetDefaultAccount}
                                    className="flex-1"
                                >
                                    <Settings className="w-4 h-4 ml-2" />
                                    تعيين كافتراضي
                                </Button>
                            )}
                        </div>

                        {selectedAccount && (
                            <div className="flex gap-2 pt-2">
                                <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={handleAccountLogout}
                                    className="flex-1"
                                >
                                    <LogOut className="w-4 h-4 ml-2" />
                                    تسجيل خروج
                                </Button>
                                <Button 
                                    variant="destructive" 
                                    size="sm"
                                    onClick={handlePermanentDelete}
                                    className="flex-1"
                                >
                                    <Trash2 className="w-4 h-4 ml-2" />
                                    حذف نهائي
                                </Button>
                            </div>
                        )}

                        <Button 
                            variant="outline" 
                            size="sm" 
                            type="button" 
                            onClick={() => setShowAddForm(true)}
                            className="w-full"
                        >
                            <UserPlus className="w-4 h-4 ml-2" />
                            إضافة حساب جديد
                        </Button>
                    </CardContent>
                </Card>
            );
        } else {
            // عرض نموذج تسجيل الدخول
            return (
                <Card className="bg-yellow-500/10 border-yellow-500/30">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-yellow-600">
                            <AlertCircle className="w-5 h-5"/>
                            غير متصل - {selectedPartner}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="username">اسم المستخدم:</Label>
                            <Input
                                id="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="أدخل اسم المستخدم"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">كلمة المرور:</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="أدخل كلمة المرور"
                                required
                            />
                        </div>
                        
                        {hasAccounts && (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                type="button" 
                                onClick={() => setShowAddForm(false)}
                                className="w-full"
                            >
                                العودة للحسابات المحفوظة
                            </Button>
                        )}
                    </CardContent>
                </Card>
            );
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-right">إدارة شركاء التوصيل</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* اختيار شريك التوصيل */}
                    <div className="space-y-2">
                        <Label>شريك التوصيل:</Label>
                        <Select value={selectedPartner} onValueChange={setSelectedPartner}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {availablePartners.map(partner => (
                                    <SelectItem key={partner} value={partner}>
                                        {partner === 'local' ? 'محلي' : partner}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* محتوى الشريك */}
                    {renderPartnerContent()}

                    <DialogFooter className="flex gap-2 pt-4">
                        <Button 
                            type="submit" 
                            disabled={
                                selectedPartner === 'local' ? isCurrentPartnerSelected :
                                (showAddForm ? !username || !password : !selectedAccount)
                            }
                            className="flex-1"
                        >
                            {selectedPartner === 'local' ? 
                                (isCurrentPartnerSelected ? 'مفعل حالياً' : 'تفعيل الوضع المحلي') :
                                (showAddForm ? 'تسجيل الدخول' : (selectedAccount ? 'تفعيل الحساب' : 'اختر حساب'))
                            }
                        </Button>
                        
                        {isLoggedIn && (
                            <Button 
                                type="button" 
                                variant="outline" 
                                onClick={handleLogout}
                                className="flex-1"
                            >
                                <LogOut className="w-4 h-4 ml-2" />
                                تسجيل خروج شامل
                            </Button>
                        )}
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}