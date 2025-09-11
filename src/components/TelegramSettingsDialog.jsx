import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, Bot, Settings, AlertTriangle } from "lucide-react";

export function TelegramSettingsDialog({ open, onOpenChange }) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [profile, setProfile] = useState(null);
    const [telegramCode, setTelegramCode] = useState('');
    const [autoApprove, setAutoApprove] = useState(false);
    const [defaultDestination, setDefaultDestination] = useState('local');

    // تحميل بيانات المستخدم
    useEffect(() => {
        if (open && user?.id) {
            loadUserProfile();
        }
    }, [open, user?.id]);

    const loadUserProfile = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('employee_code, auto_approve_ai_orders, default_ai_order_destination')
                .eq('user_id', user.id)
                .single();

            if (error) {
                console.error('Error loading profile:', error);
                return;
            }

            setProfile(data);
            setTelegramCode(data.employee_code || '');
            setAutoApprove(data.auto_approve_ai_orders || false);
            setDefaultDestination(data.default_ai_order_destination || 'local');
        } catch (error) {
            console.error('Error in loadUserProfile:', error);
        }
    };

    const handleSave = async () => {
        if (!user?.id) return;
        
        setLoading(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    auto_approve_ai_orders: autoApprove,
                    default_ai_order_destination: defaultDestination,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', user.id);

            if (error) {
                console.error('Error updating profile:', error);
                toast({
                    title: "خطأ",
                    description: "فشل في حفظ الإعدادات",
                    variant: 'destructive'
                });
                return;
            }

            toast({
                title: "تم الحفظ",
                description: "تم حفظ إعدادات التليغرام بنجاح",
                variant: 'success'
            });

            onOpenChange(false);
        } catch (error) {
            console.error('Error in handleSave:', error);
            toast({
                title: "خطأ",
                description: "حدث خطأ أثناء حفظ الإعدادات",
                variant: 'destructive'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <MessageCircle className="w-5 h-5 text-blue-500" />
                        إعدادات بوت التليغرام
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* معلومات البوت */}
                    <Card className="bg-blue-50 border-blue-200">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Bot className="w-4 h-4" />
                                معلومات البوت
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">اسم البوت:</span>
                                <Badge variant="outline">@Ryusiq_bot</Badge>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">الرمز الشخصي:</span>
                                <Badge variant="secondary">{telegramCode || 'غير محدد'}</Badge>
                            </div>
                        </CardContent>
                    </Card>

                    <Separator />

                    {/* إعدادات الموافقة التلقائية */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Settings className="w-4 h-4 text-gray-500" />
                            <h3 className="font-medium">إعدادات المعالجة التلقائية</h3>
                        </div>

                        {/* مفتاح الموافقة التلقائية */}
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="space-y-1">
                                <Label className="text-sm font-medium">الموافقة التلقائية</Label>
                                <p className="text-xs text-muted-foreground">
                                    تحويل طلبات التليغرام الصحيحة إلى طلبات فورية بدون مراجعة
                                </p>
                            </div>
                            <Switch
                                checked={autoApprove}
                                onCheckedChange={setAutoApprove}
                            />
                        </div>

                        {/* وجهة الطلبات الافتراضية */}
                        {autoApprove && (
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">وجهة الطلبات الافتراضية</Label>
                                <Select value={defaultDestination} onValueChange={setDefaultDestination}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="local">طلب محلي</SelectItem>
                                        <SelectItem value="alwaseet">الوسيط</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    سيتم إنشاء الطلبات تلقائياً في الوجهة المحددة
                                </p>
                            </div>
                        )}

                        {/* تحذير */}
                        {autoApprove && (
                            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />
                                <div className="text-xs text-amber-700">
                                    <p className="font-medium">تنبيه مهم:</p>
                                    <p>عند تفعيل الموافقة التلقائية، ستتم معالجة الطلبات الصحيحة فوراً بدون مراجعة. تأكد من صحة المنتجات والعناوين.</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* أزرار الحفظ والإلغاء */}
                    <div className="flex gap-2 pt-4">
                        <Button 
                            onClick={handleSave} 
                            disabled={loading}
                            className="flex-1"
                        >
                            {loading ? "جاري الحفظ..." : "حفظ الإعدادات"}
                        </Button>
                        <Button 
                            variant="outline" 
                            onClick={() => onOpenChange(false)}
                            className="flex-1"
                        >
                            إلغاء
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}