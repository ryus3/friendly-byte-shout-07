import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Zap, Brain, Users, TrendingUp, ShoppingBag } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import ryusLogo from '@/assets/ryus-logo.png';

const AppSplashScreen = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const { theme } = useTheme();
  
  // تحديد الثيم الفعلي
  const effectiveTheme = theme === 'system' 
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;
  
  const isDark = effectiveTheme === 'dark';

  useEffect(() => {
    const duration = 2800; // 2.8 seconds to match App.jsx transition
    const interval = 28; // Update every 28ms (2800/100 = 28ms per 1%)
    const step = 100 / (duration / interval);
    
    const timer = setInterval(() => {
      setProgress(prev => {
        const next = prev + step;
        if (next >= 100) {
          clearInterval(timer);
          return 100;
        }
        return next;
      });
    }, interval);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (progress === 100) {
      // انتقال فوري بدون تأخير (0 ثانية)
      const timer = setTimeout(() => {
        onComplete?.();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [progress, onComplete]);

  const iconVariants = {
    initial: { scale: 0, opacity: 0, rotate: -180 },
    animate: (i) => ({
      scale: 1,
      opacity: 0.15,
      rotate: 0,
      transition: {
        delay: i * 0.1,
        duration: 0.6,
        ease: "easeOut"
      }
    }),
    float: {
      y: [-10, 10, -10],
      transition: {
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  const gradientVariants = {
    initial: { opacity: 0, scale: 0.8 },
    animate: (i) => ({
      opacity: [0.1, 0.2, 0.1],
      scale: [0.8, 1.2, 0.8],
      transition: {
        delay: i * 0.15,
        duration: 4,
        repeat: Infinity,
        ease: "easeInOut"
      }
    })
  };

  // ألوان ديناميكية حسب الثيم
  const bgClass = isDark ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950' : 'bg-white';
  const primaryColor = isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.15)';
  const secondaryColor = isDark ? 'rgba(168, 85, 247, 0.3)' : 'rgba(168, 85, 247, 0.15)';
  const accentColor = isDark ? 'rgba(236, 72, 153, 0.2)' : 'rgba(236, 72, 153, 0.1)';
  const iconOpacity = isDark ? 0.25 : 0.15;

  return (
    <AnimatePresence>
      <motion.div
      initial={{ opacity: 0, scale: 1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, filter: 'blur(20px)' }}
      transition={{ duration: 1.2, ease: [0.43, 0.13, 0.23, 0.96] }}
        className={`fixed inset-0 z-[9999] flex items-center justify-center ${bgClass} overflow-hidden`}
      >
        {/* خلفية متحركة بتدرجات شفافة */}
        <div className="absolute inset-0">
          {/* تدرج أزرق - بنفسجي */}
          <motion.div
            custom={0}
            variants={gradientVariants}
            initial="initial"
            animate="animate"
            className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-3xl"
            style={{
              background: `radial-gradient(circle, ${primaryColor} 0%, transparent 70%)`
            }}
          />
          
          {/* تدرج بنفسجي - وردي */}
          <motion.div
            custom={1}
            variants={gradientVariants}
            initial="initial"
            animate="animate"
            className="absolute bottom-0 left-0 w-[700px] h-[700px] rounded-full blur-3xl"
            style={{
              background: `radial-gradient(circle, ${secondaryColor} 0%, transparent 70%)`
            }}
          />
          
          {/* تدرج وردي مركزي */}
          <motion.div
            custom={2}
            variants={gradientVariants}
            initial="initial"
            animate="animate"
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-3xl"
            style={{
              background: `radial-gradient(circle, ${accentColor} 0%, transparent 70%)`
            }}
          />

          {/* أشكال هندسية متحركة ناعمة */}
          <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#3b82f6', stopOpacity: 0.1 }} />
                <stop offset="100%" style={{ stopColor: '#a855f7', stopOpacity: 0.05 }} />
              </linearGradient>
              <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#a855f7', stopOpacity: 0.1 }} />
                <stop offset="100%" style={{ stopColor: '#ec4899', stopOpacity: 0.05 }} />
              </linearGradient>
            </defs>
            
            <motion.path
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.2 }}
              transition={{ duration: 2, ease: "easeInOut" }}
              d="M 100 200 Q 300 100 500 200 T 900 200"
              stroke="url(#grad1)"
              strokeWidth="2"
              fill="none"
            />
            
            <motion.circle
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.15 }}
              transition={{ delay: 0.3, duration: 1 }}
              cx="15%"
              cy="20%"
              r="100"
              fill="url(#grad1)"
            />
            
            <motion.circle
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.15 }}
              transition={{ delay: 0.5, duration: 1 }}
              cx="85%"
              cy="75%"
              r="120"
              fill="url(#grad2)"
            />
          </svg>
        </div>

        {/* العناصر المتحركة - الأيقونات */}
        <div className="absolute inset-0 pointer-events-none">
          {/* أيقونة الطلبات */}
          <motion.div
            custom={0}
            variants={iconVariants}
            initial="initial"
            animate={["animate", "float"]}
            className="absolute top-[15%] left-[10%]"
            style={{ opacity: iconOpacity }}
          >
            <Package className={`w-16 h-16 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} strokeWidth={1.5} />
          </motion.div>

          {/* أيقونة السرعة */}
          <motion.div
            custom={1}
            variants={iconVariants}
            initial="initial"
            animate={["animate", "float"]}
            className="absolute top-[20%] right-[15%]"
            style={{ opacity: iconOpacity }}
          >
            <Zap className={`w-20 h-20 ${isDark ? 'text-purple-400' : 'text-purple-500'}`} strokeWidth={1.5} />
          </motion.div>

          {/* أيقونة الذكاء الاصطناعي */}
          <motion.div
            custom={2}
            variants={iconVariants}
            initial="initial"
            animate={["animate", "float"]}
            className="absolute bottom-[20%] left-[12%]"
            style={{ opacity: iconOpacity }}
          >
            <Brain className={`w-18 h-18 ${isDark ? 'text-pink-400' : 'text-pink-500'}`} strokeWidth={1.5} />
          </motion.div>

          {/* أيقونة الموظفين */}
          <motion.div
            custom={3}
            variants={iconVariants}
            initial="initial"
            animate={["animate", "float"]}
            className="absolute bottom-[25%] right-[10%]"
            style={{ opacity: iconOpacity }}
          >
            <Users className={`w-16 h-16 ${isDark ? 'text-indigo-400' : 'text-indigo-500'}`} strokeWidth={1.5} />
          </motion.div>

          {/* أيقونة النمو */}
          <motion.div
            custom={4}
            variants={iconVariants}
            initial="initial"
            animate={["animate", "float"]}
            className="absolute top-[45%] left-[8%]"
            style={{ opacity: iconOpacity }}
          >
            <TrendingUp className={`w-14 h-14 ${isDark ? 'text-blue-300' : 'text-blue-400'}`} strokeWidth={1.5} />
          </motion.div>

          {/* أيقونة المبيعات */}
          <motion.div
            custom={5}
            variants={iconVariants}
            initial="initial"
            animate={["animate", "float"]}
            className="absolute top-[50%] right-[8%]"
            style={{ opacity: iconOpacity }}
          >
            <ShoppingBag className={`w-14 h-14 ${isDark ? 'text-purple-300' : 'text-purple-400'}`} strokeWidth={1.5} />
          </motion.div>
        </div>

        {/* المحتوى المركزي */}
        <div className="relative z-10 flex flex-col items-center justify-center space-y-8">
          {/* الشعار */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0, rotateY: -180 }}
            animate={{ scale: 1, opacity: 1, rotateY: 0 }}
            transition={{ 
              duration: 0.8, 
              ease: [0.34, 1.56, 0.64, 1],
              delay: 0.2
            }}
            className="relative"
          >
            {/* هالة خلف الشعار */}
            <motion.div
              animate={{
                opacity: [0.3, 0.6, 0.3],
                scale: [1, 1.1, 1]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="absolute inset-0 -z-10 blur-2xl rounded-full"
              style={{
                background: isDark 
                  ? 'radial-gradient(circle, rgba(59, 130, 246, 0.6) 0%, rgba(168, 85, 247, 0.4) 50%, transparent 70%)'
                  : 'radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, rgba(168, 85, 247, 0.2) 50%, transparent 70%)'
              }}
            />
            
            <img 
              src={ryusLogo} 
              alt="RYUS Logo" 
              className="w-40 h-40 object-contain drop-shadow-2xl"
              style={{ filter: 'drop-shadow(0 10px 30px rgba(59, 130, 246, 0.3))' }}
            />
          </motion.div>

          {/* النص */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="text-center space-y-2"
          >
            <h1 className={`text-3xl font-bold bg-gradient-to-r ${
              isDark 
                ? 'from-blue-400 via-purple-400 to-pink-400' 
                : 'from-blue-600 via-purple-600 to-pink-600'
            } bg-clip-text text-transparent`}>
              نظام RYUS
            </h1>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-muted-foreground'}`}>
              إدارة ذكية للمبيعات والمخزون
            </p>
          </motion.div>

          {/* شريط التقدم */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8, duration: 0.4 }}
            className="w-64 space-y-2"
          >
            {/* الخلفية */}
            <div className={`h-1 ${
              isDark 
                ? 'bg-gradient-to-r from-blue-900/50 via-purple-900/50 to-pink-900/50' 
                : 'bg-gradient-to-r from-blue-100 via-purple-100 to-pink-100'
            } rounded-full overflow-hidden`}>
              {/* الشريط المتحرك */}
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={`h-full ${
                  isDark
                    ? 'bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400'
                    : 'bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500'
                } rounded-full relative overflow-hidden`}
              >
                {/* تأثير اللمعان */}
                <motion.div
                  animate={{
                    x: ['-100%', '200%']
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                />
              </motion.div>
            </div>
            
            {/* نسبة التقدم */}
            <motion.p
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className={`text-center text-xs ${isDark ? 'text-slate-400' : 'text-muted-foreground'}`}
            >
              {Math.round(progress)}%
            </motion.p>
          </motion.div>
        </div>

        {/* جزيئات متحركة صغيرة */}
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ 
              opacity: 0,
              x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
              y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800)
            }}
            animate={{
              opacity: [0, 0.4, 0],
              y: [
                Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
                Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800) - 100,
                Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800)
              ]
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: i * 0.2,
              ease: "easeInOut"
            }}
            className="absolute w-1 h-1 rounded-full"
            style={{
              background: ['#3b82f6', '#a855f7', '#ec4899'][i % 3]
            }}
          />
        ))}
      </motion.div>
    </AnimatePresence>
  );
};

export default AppSplashScreen;
