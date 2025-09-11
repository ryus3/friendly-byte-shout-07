import React, { useState, useEffect } from 'react';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Truck, CheckCircle, XCircle, Server, LogOut } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from './ui/use-toast';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';

const DeliveryPartnerDialog = ({ open, onOpenChange }) => {
    const { 
        login, loading, deliveryPartners, activePartner, setActivePartner, 
        isLoggedIn, logout: waseetLogout, waseetUser,
        getUserDeliveryAccounts, setDefaultDeliveryAccount 
    } = useAlWaseet();
    const { user } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [userAccounts, setUserAccounts] = useState([]);
    const [selectedAccount, setSelectedAccount] = useState(null);
    
    const orderCreationMode = user?.order_creation_mode || 'choice';

    const availablePartners = orderCreationMode === 'local_only'
        ? { local: deliveryPartners.local }
        : orderCreationMode === 'partner_only'
        ? Object.fromEntries(Object.entries(deliveryPartners).filter(([key]) => key !== 'local'))
        : deliveryPartners;

    const [selectedPartner, setSelectedPartner] = useState(activePartner || Object.keys(availablePartners)[0]);

    // تحميل حسابات المستخدم عند فتح النافذة أو تغيير الشركة
    useEffect(() => {
        const loadUserAccounts = async () => {
            if (open && user?.id && selectedPartner && selectedPartner !== 'local') {
                const accounts = await getUserDeliveryAccounts(user.id, selectedPartner);
                setUserAccounts(accounts);
                
                // اختيار الحساب الافتراضي
                const defaultAccount = accounts.find(acc => acc.is_default);
                setSelectedAccount(defaultAccount || accounts[0] || null);
            } else {
                setUserAccounts([]);
                setSelectedAccount(null);
            }
        };

        if (open) {
            const initialPartner = activePartner || Object.keys(availablePartners)[0];
            setSelectedPartner(initialPartner);
            loadUserAccounts();
        }
    }, [activePartner, open, availablePartners, selectedPartner, user?.id, getUserDeliveryAccounts]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (selectedPartner === 'local') {
            setActivePartner('local');
            toast({ title: "تم تفعيل الوضع المحلي", description: "سيتم إنشاء الطلبات داخل النظام.", variant: 'success' });
            onOpenChange(false);
            return;
        }
        
        // التبديل إلى حساب موجود
        if (selectedAccount && !username && !password) {
            setActivePartner(selectedPartner);
            toast({ 
                title: "تم التبديل", 
                description: `تم التبديل إلى ${deliveryPartners[selectedPartner].name} - ${selectedAccount.account_label || selectedAccount.account_username}.`, 
                variant: 'success' 
            });
            onOpenChange(false);
            return;
        }
        
        // تسجيل دخول جديد
        const result = await login(username, password, selectedPartner);
        if (result.success) {
            onOpenChange(false);
            setUsername('');
            setPassword('');
            // إعادة تحميل الحسابات بعد تسجيل الدخول
            const accounts = await getUserDeliveryAccounts(user.id, selectedPartner);
            setUserAccounts(accounts);
        }
    };

    const handleSetDefaultAccount = async () => {
        if (!selectedAccount || !user?.id) return;
        
        const success = await setDefaultDeliveryAccount(user.id, selectedPartner, selectedAccount.account_username);
        if (success) {
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
    
    const handleLogout = () => {
        waseetLogout();
        // إعادة تعيين الحالة
        setUserAccounts([]);
        setSelectedAccount(null);
        setUsername('');
        setPassword('');
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

        // إظهار الحسابات المحفوظة إذا وُجدت
        if (userAccounts.length > 0) {
            return (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-green-500">
                            <CheckCircle className="w-5 h-5"/> الحسابات المحفوظة
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>اختر الحساب</Label>
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
                                <SelectContent>
                                    {userAccounts.map((account) => (
                                        <SelectItem key={account.account_username} value={account.account_username}>
                                            {account.account_label || account.account_username}
                                            {account.is_default && ' (افتراضي)'}
                                            {account.merchant_id && ` - ${account.merchant_id}`}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        {selectedAccount && !selectedAccount.is_default && (
                            <Button 
                                type="button" 
                                variant="outline" 
                                size="sm" 
                                onClick={handleSetDefaultAccount}
                                className="w-full"
                            >
                                تعيين كافتراضي
                            </Button>
                        )}
                        
                        <div className="border-t pt-4">
                            <p className="text-sm text-muted-foreground mb-2">أو سجل دخول بحساب جديد:</p>
                            <div className="space-y-2">
                                <Input 
                                    type="text" 
                                    value={username} 
                                    onChange={(e) => setUsername(e.target.value)} 
                                    placeholder="اسم المستخدم الجديد" 
                                />
                                <Input 
                                    type="password" 
                                    value={password} 
                                    onChange={(e) => setPassword(e.target.value)} 
                                    placeholder="كلمة المرور" 
                                />
                            </div>
                        </div>

                        <Button 
                            variant="destructive" 
                            size="sm" 
                            type="button" 
                            onClick={handleLogout} 
                            className="w-full"
                        >
                            <LogOut className="w-4 h-4 ml-2" />
                            تسجيل خروج جميع الحسابات
                        </Button>
                    </CardContent>
                </Card>
            );
        }

        if (isCurrentPartnerSelected && isLoggedIn) {
            return (
                <Card className="bg-green-500/10 border-green-500/30 text-foreground">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-green-500"><CheckCircle className="w-5 h-5"/> متصل</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground">أنت مسجل الدخول في <span className="font-bold text-foreground">{deliveryPartners[activePartner].name}</span>.</p>
                        <p className="text-xs text-muted-foreground">اسم المستخدم: {waseetUser?.username}</p>
                        <Button variant="destructive" size="sm" type="button" onClick={handleLogout} className="w-full">
                            <LogOut className="w-4 h-4 ml-2" />
                            تسجيل الخروج
                        </Button>
                    </CardContent>
                </Card>
            );
        }

        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive"><XCircle className="w-5 h-5"/> غير متصل</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="waseet-username">اسم المستخدم</Label>
                        <Input id="waseet-username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} required placeholder="username" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="waseet-password">كلمة المرور</Label>
                        <Input id="waseet-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="password" />
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
                     <div className="space-y-2">
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
                            <SelectContent>
                                {Object.entries(availablePartners).map(([key, partner]) => (
                                    <SelectItem key={key} value={key}>{partner.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                
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
                                : selectedAccount && !username
                                    ? `استخدام ${selectedAccount.account_label || selectedAccount.account_username}`
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