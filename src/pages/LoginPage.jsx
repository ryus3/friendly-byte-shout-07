import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { toast } from '@/components/ui/use-toast.js';

const LoginPage = () => {
  const [view, setView] = useState('login');
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    loginIdentifier: ''
  });
  const { signUp, signInWithUsername, loading } = useAuth();

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!formData.loginIdentifier || !formData.password) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال اسم المستخدم وكلمة المرور",
        variant: "destructive",
      });
      return;
    }

    const { error } = await signInWithUsername(formData.loginIdentifier, formData.password);
    
    if (error) {
      toast({
        title: "خطأ في تسجيل الدخول",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    
    if (!formData.fullName || !formData.username || !formData.email || !formData.password) {
      toast({
        title: "خطأ",
        description: "يرجى ملء جميع الحقول",
        variant: "destructive",
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: "خطأ",
        description: "كلمة المرور يجب أن تكون 6 أحرف على الأقل",
        variant: "destructive",
      });
      return;
    }

    const { error } = await signUp(formData.fullName, formData.username, formData.email, formData.password);
    
    if (error) {
      toast({
        title: "خطأ في إنشاء الحساب",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setView('login');
      setFormData({ ...formData, loginIdentifier: formData.username, password: '' });
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    // TODO: Implement forgot password
  };

  const renderLogin = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-md"
    >
      <div className="bg-card text-card-foreground rounded-lg shadow-lg p-8">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-primary mb-2">مرحباً بك</h1>
          <p className="text-muted-foreground">تسجيل الدخول إلى حسابك</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <Label htmlFor="loginIdentifier" className="text-sm font-medium">
              اسم المستخدم
            </Label>
            <Input
              id="loginIdentifier"
              name="loginIdentifier"
              type="text"
              value={formData.loginIdentifier}
              onChange={handleInputChange}
              placeholder="أدخل اسم المستخدم"
              className="mt-1"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="password" className="text-sm font-medium">
              كلمة المرور
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="أدخل كلمة المرور"
              className="mt-1"
              required
            />
          </div>
          
          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading}
          >
            {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
          </Button>
        </form>
        
        <div className="mt-6 text-center space-y-2">
          <Button
            variant="link"
            onClick={() => setView('forgot')}
            className="text-sm text-muted-foreground hover:text-primary"
          >
            نسيت كلمة المرور؟
          </Button>
          
          <div className="text-sm text-muted-foreground">
            ليس لديك حساب؟{' '}
            <Button
              variant="link"
              onClick={() => setView('register')}
              className="text-primary hover:underline p-0 h-auto"
            >
              إنشاء حساب جديد
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderRegister = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-md"
    >
      <div className="bg-card text-card-foreground rounded-lg shadow-lg p-8">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-primary mb-2">إنشاء حساب جديد</h1>
          <p className="text-muted-foreground">انضم إلينا اليوم</p>
        </div>
        
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <Label htmlFor="fullName" className="text-sm font-medium">
              الاسم الكامل
            </Label>
            <Input
              id="fullName"
              name="fullName"
              type="text"
              value={formData.fullName}
              onChange={handleInputChange}
              placeholder="أدخل اسمك الكامل"
              className="mt-1"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="username" className="text-sm font-medium">
              اسم المستخدم
            </Label>
            <Input
              id="username"
              name="username"
              type="text"
              value={formData.username}
              onChange={handleInputChange}
              placeholder="أدخل اسم المستخدم"
              className="mt-1"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="email" className="text-sm font-medium">
              البريد الإلكتروني
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="أدخل بريدك الإلكتروني"
              className="mt-1"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="password" className="text-sm font-medium">
              كلمة المرور
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="أدخل كلمة المرور"
              className="mt-1"
              required
            />
          </div>
          
          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading}
          >
            {loading ? 'جاري إنشاء الحساب...' : 'إنشاء حساب'}
          </Button>
        </form>
        
        <div className="mt-6 text-center">
          <div className="text-sm text-muted-foreground">
            لديك حساب بالفعل؟{' '}
            <Button
              variant="link"
              onClick={() => setView('login')}
              className="text-primary hover:underline p-0 h-auto"
            >
              تسجيل الدخول
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderForgotPassword = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-md"
    >
      <div className="bg-card text-card-foreground rounded-lg shadow-lg p-8">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-primary mb-2">استعادة كلمة المرور</h1>
          <p className="text-muted-foreground">أدخل بريدك الإلكتروني</p>
        </div>
        
        <form onSubmit={handleForgotPassword} className="space-y-4">
          <div>
            <Label htmlFor="email" className="text-sm font-medium">
              البريد الإلكتروني
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="أدخل بريدك الإلكتروني"
              className="mt-1"
              required
            />
          </div>
          
          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading}
          >
            {loading ? 'جاري الإرسال...' : 'إرسال رابط الاستعادة'}
          </Button>
        </form>
        
        <div className="mt-6 text-center">
          <Button
            variant="link"
            onClick={() => setView('login')}
            className="text-sm text-muted-foreground hover:text-primary"
          >
            العودة لتسجيل الدخول
          </Button>
        </div>
      </div>
    </motion.div>
  );

  return (
    <>
      <Helmet>
        <title>تسجيل الدخول - RYUS STORE</title>
        <meta name="description" content="تسجيل الدخول إلى متجر RYUS" />
      </Helmet>
      
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4 relative">
        <div className="absolute top-4 right-4">
          <ThemeSwitcher />
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