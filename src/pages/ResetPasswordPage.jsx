import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';

const ResetPasswordPage = () => {
    const navigate = useNavigate();

    return (
        <>
            <Helmet>
                <title>استعادة كلمة المرور - RYUS BRAND</title>
                <meta name="description" content="استعادة كلمة المرور الخاصة بك في نظام RYUS BRAND" />
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
                            <h1 className="font-bold text-3xl gradient-text mb-4">استعادة كلمة المرور</h1>
                            <p className="text-muted-foreground mb-6">
                                يبدو أن رابط استعادة كلمة المرور قد انتهت صلاحيته أو أنه غير صحيح.
                            </p>
                            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6">
                                <p className="text-yellow-600 dark:text-yellow-400 text-sm">
                                    يرجى طلب رابط جديد لاستعادة كلمة المرور من صفحة تسجيل الدخول.
                                </p>
                            </div>
                            <button
                                onClick={() => navigate('/login')}
                                className="w-full h-12 text-lg font-bold text-white bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all duration-300 rounded-lg"
                            >
                                العودة إلى تسجيل الدخول
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </>
    );
};

export default ResetPasswordPage;