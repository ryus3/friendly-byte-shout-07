import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useNavigate, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { toast } from '@/components/ui/use-toast.js';
import { Lock, User, ArrowLeft, Mail, UserPlus } from 'lucide-react';
import { ThemeSwitcher } from '@/components/ThemeSwitcher.jsx';

const LoginPage = () => {
  const [view, setView] = useState('login'); // 'login', 'register', 'forgot'
  const { login, registerWithEmail, forgotPassword, loading, user } = useAuth();
  const navigate = useNavigate();

  // إذا كان المستخدم مسجل دخول بالفعل، توجيهه إلى الصفحة الرئيسية
  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const { loginIdentifier, password } = Object.fromEntries(formData.entries());
    
    if (!loginIdentifier || !password) {
        toast({ title: "خطأ", description: "الرجاء إدخال اسم المستخدم وكلمة المرور.", variant: "destructive" });
        return;
    }
    
    const result = await login(loginIdentifier, password);
    if (result.success) {
      toast({
        title: "تم تسجيل الدخول بنجاح",
        description: "مرحباً بك في نظام الإدارة",
      });
      navigate('/');
    } else {
      toast({
        title: "خطأ في تسجيل الدخول",
        description: result.error,
        variant: "destructive",
      });
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const { fullName, username, email, password } = Object.fromEntries(formData.entries());

    if (!fullName || !username || !email || !password) {
        toast({ title: "خطأ", description: "الرجاء ملء جميع الحقول.", variant: "destructive" });
        return;
    }

    if (username.includes('@')) {
        toast({ title: "خطأ", description: "اسم المستخدم لا يمكن أن يحتوي على الرمز @.", variant: "destructive" });
        return;
    }
    
    const result = await registerWithEmail(fullName, username, email, password);
    if (result.success) {
      setView('login');
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const { email } = Object.fromEntries(formData.entries());
    if (!email) {
      toast({ title: "خطأ", description: "الرجاء إدخال البريد الإلكتروني.", variant: "destructive" });
      return;
    }
    await forgotPassword(email);
  };

  const inputClass = "bg-background/80 dark:bg-zinc-800/50 border-2 border-border focus:border-primary focus:ring-0 h-12 text-base transition-colors placeholder:text-muted-foreground/80 text-foreground";

  const renderLogin = () => (
    <motion.div 
      key="login"
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-sm relative z-10"
    >
      <div className="glass-effect rounded-2xl p-8 shadow-2xl border-white/5 dark:border-white/10">
        <div className="text-center mb-8">
          <motion.div 
            initial={{ scale: 0 }} 
            animate={{ scale: 1 }} 
            transition={{ delay: 0.2, type: 'spring' }} 
            className="w-44 h-44 mx-auto mb-4 flex items-center justify-center"
          >
            <img className="w-full h-full object-contain hidden dark:block mix-blend-screen" alt="RYUS BRAND Logo Dark" src="https://storage.googleapis.com/hostinger-horizons-assets-prod/1f3b5d57-e29a-4462-965e-89e9a8cac3f1/2e94508b11f0bf0fa626aea4716f1658.png" />
            <img className="w-full h-full object-contain block dark:hidden mix-blend-multiply" alt="RYUS BRAND Logo Light" src="https://storage.googleapis.com/hostinger-horizons-assets-prod/1f3b5d57-e29a-4462-965e-89e9a8cac3f1/c5b1cd2be0f791e7e3cb0e078059203a.png" />
          </motion.div>
          <h1 className="font-brand text-4xl font-bold gradient-text mb-2">RYUS BRAND</h1>
          <p className="text-muted-foreground">نظام إدارة المخزون ومتابعة الطلبات</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative">
            <User className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input name="loginIdentifier" type="text" placeholder="اسم المستخدم أو البريد الإلكتروني" className={`${inputClass} pr-12`} required />
          </div>

          <div className="relative">
            <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input name="password" type="password" placeholder="كلمة المرور" className={`${inputClass} pr-12 pl-10`} required />
          </div>

          <Button type="submit" className="w-full h-12 text-lg font-bold text-white bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all duration-300" disabled={loading}>
            {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
          </Button>
        </form>

        <div className="mt-6 flex justify-between items-center text-sm">
          <Button variant="link" className="font-medium text-primary/80 hover:text-primary transition-colors p-0 h-auto focus:outline-none focus:ring-0" onClick={() => setView('forgot')}>
            هل نسيت كلمة المرور؟
          </Button>
          <Button variant="link" className="font-medium text-primary/80 hover:text-primary transition-colors p-0 h-auto focus:outline-none focus:ring-0" onClick={() => setView('register')}>
            تسجيل حساب جديد
          </Button>
        </div>
      </div>
    </motion.div>
  );

  const renderRegister = () => (
    <motion.div 
      key="register"
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-md relative z-10"
    >
      <div className="glass-effect rounded-2xl p-8 shadow-2xl border-white/5 dark:border-white/10">
        <div className="text-center mb-6">
          <h1 className="font-bold text-3xl gradient-text mb-2">إنشاء حساب جديد</h1>
          <p className="text-muted-foreground">انضم إلى فريقنا. سيقوم المدير بمراجعة طلبك.</p>
        </div>
        
        <form onSubmit={handleRegister} className="space-y-4">
           <div className="relative">
            <UserPlus className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input name="fullName" type="text" placeholder="الاسم الكامل" className={`${inputClass} pr-12`} required />
          </div>
          <div className="relative">
            <User className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input name="username" type="text" placeholder="اسم المستخدم (باللغة الإنجليزية)" className={`${inputClass} pr-12`} required />
          </div>
          <div className="relative">
            <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input name="email" type="email" placeholder="البريد الإلكتروني" className={`${inputClass} pr-12`} required />
          </div>
          <div className="relative">
            <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input name="password" type="password" placeholder="كلمة المرور" className={`${inputClass} pr-12`} required />
          </div>

          <Button type="submit" className="w-full h-12 text-lg font-bold text-white bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all duration-300" disabled={loading}>
            {loading ? 'جاري التسجيل...' : 'تسجيل حساب جديد'}
          </Button>
          <Button type="button" variant="ghost" className="w-full text-muted-foreground hover:text-foreground" onClick={() => setView('login')}>
            <ArrowLeft className="w-4 h-4 ml-2" /> العودة لتسجيل الدخول
          </Button>
        </form>
      </div>
    </motion.div>
  );

  const renderForgotPassword = () => (
    <motion.div 
      key="forgot"
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-md relative z-10"
    >
      <div className="glass-effect rounded-2xl p-8 shadow-2xl border-white/5 dark:border-white/10">
        <div className="text-center mb-8">
          <h1 className="font-bold text-3xl gradient-text mb-2">استعادة كلمة المرور</h1>
          <p className="text-muted-foreground">أدخل بريدك الإلكتروني وسنرسل لك رابطًا للاستعادة.</p>
        </div>
        <form onSubmit={handleForgotPassword} className="space-y-4">
          <div className="relative">
            <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input name="email" type="email" placeholder="البريد الإلكتروني" className={`${inputClass} pr-12`} required />
          </div>
          <Button type="submit" className="w-full h-12 text-lg font-bold text-white bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all duration-300" disabled={loading}>
            {loading ? 'جاري الإرسال...' : 'إرسال رابط الاستعادة'}
          </Button>
          <Button type="button" variant="ghost" className="w-full text-muted-foreground hover:text-foreground" onClick={() => setView('login')}>
            <ArrowLeft className="w-4 h-4 ml-2" /> العودة لتسجيل الدخول
          </Button>
        </form>
      </div>
    </motion.div>
  );

  return (
    <>
      <Helmet>
        <title>تسجيل الدخول - RYUS BRAND</title>
        <meta name="description" content="تسجيل الدخول إلى نظام إدارة المخزون والطلبات RYUS BRAND" />
      </Helmet>
      
      <div className="h-screen w-screen flex items-center justify-center p-4 relative overflow-hidden font-cairo">
        <div className="absolute top-5 right-5 z-20">
          <ThemeSwitcher />
        </div>

        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse-slow hidden dark:block"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse-slow hidden dark:block"></div>
          <div className="absolute -top-20 -right-40 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse-slow dark:hidden"></div>
          <div className="absolute -bottom-20 -left-40 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse-slow dark:hidden"></div>
        </div>

        <AnimatePresence mode="wait">
          {view === 'login' && renderLogin()}
          {view === 'register' && renderRegister()}
          {view === 'forgot' && renderForgotPassword()}
        </AnimatePresence>
      </div>
    </>
  );
};

export default LoginPage;