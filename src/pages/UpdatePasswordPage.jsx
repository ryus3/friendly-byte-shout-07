import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { Lock } from 'lucide-react';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';

const UpdatePasswordPage = () => {
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        // Supabase redirects with the access token in the hash
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "PASSWORD_RECOVERY") {
                // This event confirms the user is in password recovery mode
            }
        });

        return () => {
            subscription?.unsubscribe();
        };
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            toast({ title: "خطأ", description: "كلمتا المرور غير متطابقتين.", variant: "destructive" });
            return;
        }
        if (password.length < 6) {
            toast({ title: "خطأ", description: "يجب أن تكون كلمة المرور 6 أحرف على الأقل.", variant: "destructive" });
            return;
        }

        setLoading(true);
        const { error } = await supabase.auth.updateUser({ password });
        setLoading(false);

        if (error) {
            toast({ title: "خطأ", description: error.message, variant: "destructive" });
        } else {
            toast({ title: "نجاح!", description: "تم تحديث كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول." });
            navigate('/login');
        }
    };
    
    if (!isMounted) return null;

    const inputClass = "bg-background/80 dark:bg-zinc-800/50 border-2 border-border focus:border-primary focus:ring-0 h-12 text-base transition-colors placeholder:text-muted-foreground/80 text-foreground";

    return (
        <>
            <Helmet>
                <title>تحديث كلمة المرور - RYUS BRAND</title>
                <meta name="description" content="تحديث كلمة المرور الخاصة بك في نظام RYUS BRAND" />
            </Helmet>

            <div className="h-screen w-screen flex items-center justify-center p-4 relative overflow-hidden font-cairo">
                <div className="absolute top-5 right-5 z-20">
                    <ThemeSwitcher />
                </div>

                <div className="absolute inset-0 -z-10 overflow-hidden">
                    <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse-slow hidden dark:block"></div>
                    <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse-slow hidden dark:block"></div>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-md relative z-10"
                >
                    <div className="glass-effect rounded-2xl p-8 shadow-2xl border-white/5 dark:border-white/10">
                        <div className="text-center mb-8">
                            <h1 className="font-bold text-3xl gradient-text mb-2">تحديث كلمة المرور</h1>
                            <p className="text-muted-foreground">أدخل كلمة المرور الجديدة الخاصة بك.</p>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="relative">
                                <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                <Input 
                                    name="password" 
                                    type="password" 
                                    placeholder="كلمة المرور الجديدة" 
                                    className={`${inputClass} pr-12`} 
                                    required 
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                            <div className="relative">
                                <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                <Input 
                                    name="confirmPassword" 
                                    type="password" 
                                    placeholder="تأكيد كلمة المرور الجديدة" 
                                    className={`${inputClass} pr-12`} 
                                    required 
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                            </div>
                            <Button type="submit" className="w-full h-12 text-lg font-bold text-white bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all duration-300" disabled={loading}>
                                {loading ? 'جاري التحديث...' : 'تحديث كلمة المرور'}
                            </Button>
                        </form>
                    </div>
                </motion.div>
            </div>
        </>
    );
};

export default UpdatePasswordPage;