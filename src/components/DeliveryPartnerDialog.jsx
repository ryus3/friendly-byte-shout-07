import React, { useState, useEffect } from 'react';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Truck, CheckCircle, XCircle, Server, LogOut } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from './ui/use-toast';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';

const DeliveryPartnerDialog = ({ open, onOpenChange }) => {
    const { login, loading, deliveryPartners, activePartner, setActivePartner, isLoggedIn, logout: waseetLogout, waseetUser, loggedInPartners, switchPartner } = useAlWaseet();
    const { user } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    
    const orderCreationMode = user?.order_creation_mode || 'choice';

    // الحصول على الشركاء المتاحة (المسجل دخول إليها + جميع الشركاء)
    const getAvailablePartners = () => {
        // إضافة خيار "محلي" دائماً في وضع choice
        const basePartners = orderCreationMode === 'local_only'
            ? { local: deliveryPartners.local }
            : orderCreationMode === 'partner_only'
            ? Object.fromEntries(Object.entries(deliveryPartners).filter(([key]) => key !== 'local'))
            : deliveryPartners;

        // إضافة خيار "إضافة شركة جديدة" للشركاء غير المسجل دخول إليها
        const availableOptions = { ...basePartners };
        
        Object.keys(basePartners).forEach(key => {
            if (key !== 'local' && !loggedInPartners[key]) {
                availableOptions[`new_${key}`] = { 
                    name: `${basePartners[key].name} (إضافة جديد)`,
                    isNew: true,
                    originalKey: key
                };
                delete availableOptions[key];
            }
        });

        return availableOptions;
    };

    const availablePartners = getAvailablePartners();

    const [selectedPartner, setSelectedPartner] = useState(activePartner || Object.keys(availablePartners)[0]);

    useEffect(() => {
        if (open) {
            const initialPartner = activePartner || Object.keys(availablePartners)[0];
            setSelectedPartner(initialPartner);
        }
    }, [activePartner, open, availablePartners]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (selectedPartner === 'local') {
            switchPartner('local');
            onOpenChange(false);
            return;
        }

        // إذا كان الشريك مسجل دخول بالفعل، قم بالتبديل إليه
        if (loggedInPartners[selectedPartner]) {
            switchPartner(selectedPartner);
            onOpenChange(false);
            return;
        }

        // إذا كان خيار "إضافة جديد"، استخدم المفتاح الأصلي
        const actualPartner = selectedPartner.startsWith('new_') 
            ? selectedPartner.replace('new_', '') 
            : selectedPartner;

        const result = await login(username, password, actualPartner);
        if (result.success) {
            onOpenChange(false);
            setUsername('');
            setPassword('');
        }
    };
    
    const handleLogout = () => {
        waseetLogout();
    }

    const isCurrentPartnerSelected = activePartner === selectedPartner;

    const shouldDisableSubmit = () => {
        if (selectedPartner === 'local') return false;
        if (loggedInPartners[selectedPartner]) return false; // متصل مسبقاً
        if (selectedPartner.startsWith('new_')) return !username || !password;
        return !username || !password;
    };

    const getSubmitButtonText = () => {
        if (selectedPartner === 'local') return 'تفعيل الوضع المحلي';
        if (loggedInPartners[selectedPartner]) return 'تبديل إلى هذه الشركة';
        if (selectedPartner.startsWith('new_')) return 'تسجيل دخول جديد';
        if (isCurrentPartnerSelected && isLoggedIn) return 'إعادة تسجيل الدخول';
        return 'تسجيل الدخول';
    };

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

        // إذا كان الشريك مسجل دخول بالفعل
        if (loggedInPartners[selectedPartner]) {
            const partnerData = loggedInPartners[selectedPartner];
            const partnerName = deliveryPartners[selectedPartner]?.name || 'شركة التوصيل';
            
            return (
                <Card className="bg-green-500/10 border-green-500/30 text-foreground">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-green-500"><CheckCircle className="w-5 h-5"/> متصل مسبقاً</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex items-center gap-2">
                            <p className="text-sm text-muted-foreground">أنت مسجل الدخول في <span className="font-bold text-foreground">{partnerName}</span>.</p>
                            <Badge variant="success" className="text-xs">{partnerData.userData?.username}</Badge>
                        </div>
                        <div className="text-xs text-green-600">✓ سيتم التبديل إلى هذه الشركة مباشرة</div>
                    </CardContent>
                </Card>
            );
        }

        // إذا كان الشريك النشط وهو مسجل دخول
        if (isCurrentPartnerSelected && isLoggedIn) {
            return (
                <Card className="bg-green-500/10 border-green-500/30 text-foreground">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-green-500"><CheckCircle className="w-5 h-5"/> متصل حالياً</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex items-center gap-2 mb-2">
                            <p className="text-sm text-muted-foreground">أنت مسجل الدخول في <span className="font-bold text-foreground">{deliveryPartners[activePartner].name}</span>.</p>
                            <Badge variant="success" className="text-xs">{waseetUser?.username}</Badge>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="destructive" size="sm" type="button" onClick={handleLogout} className="flex-1">
                                <LogOut className="w-4 h-4 ml-2" />
                                تسجيل الخروج
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            );
        }

        // نموذج تسجيل الدخول للشركاء الجدد
        const isNewPartner = selectedPartner.startsWith('new_');
        const partnerName = isNewPartner 
            ? availablePartners[selectedPartner]?.name 
            : deliveryPartners[selectedPartner]?.name;

        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive">
                        <XCircle className="w-5 h-5"/> 
                        {isNewPartner ? 'تسجيل دخول جديد' : 'غير متصل'}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isNewPartner && (
                        <div className="text-sm text-muted-foreground mb-3">
                            سجل دخول إلى <span className="font-bold text-foreground">{partnerName?.replace(' (إضافة جديد)', '')}</span>
                        </div>
                    )}
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
                        <Select value={selectedPartner} onValueChange={setSelectedPartner} disabled={Object.keys(availablePartners).length === 1}>
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
                        <Button type="submit" disabled={loading || shouldDisableSubmit()} className="w-full">
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {getSubmitButtonText()}
                        </Button>
                    </DialogFooter>
                </form>

            </DialogContent>
        </Dialog>
    );
};

export default DeliveryPartnerDialog;