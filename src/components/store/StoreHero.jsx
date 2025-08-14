import React from 'react';
import { motion } from 'framer-motion';
import { 
  Sparkles, 
  Star, 
  ArrowLeft,
  Crown,
  Zap,
  Heart,
  ShoppingBag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const StoreHero = () => {
  return (
    <section id="hero" className="relative min-h-[80vh] flex items-center overflow-hidden">
      
      {/* خلفية متدرجة مبهرة */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-purple-500/5 to-pink-500/5" />
      
      {/* عناصر خلفية متحركة */}
      <div className="absolute inset-0 overflow-hidden">
        {/* دوائر متحركة */}
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-4 h-4 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-full"
            animate={{
              x: [0, 100, 0],
              y: [0, -100, 0],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 8 + i * 2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.5
            }}
            style={{
              left: `${10 + i * 12}%`,
              top: `${20 + (i % 3) * 30}%`,
            }}
          />
        ))}
        
        {/* نجوم متلألئة */}
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={`star-${i}`}
            className="absolute"
            animate={{
              scale: [0.5, 1.2, 0.5],
              opacity: [0.3, 1, 0.3],
              rotate: [0, 180, 360]
            }}
            transition={{
              duration: 4 + i,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.3
            }}
            style={{
              left: `${5 + i * 8}%`,
              top: `${10 + (i % 4) * 25}%`,
            }}
          >
            <Sparkles className="w-3 h-3 text-primary/40" />
          </motion.div>
        ))}
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          
          {/* المحتوى النصي */}
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center lg:text-right space-y-8"
          >
            
            {/* شارة ترحيبية */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex justify-center lg:justify-start"
            >
              <Badge className="bg-gradient-to-r from-primary/20 to-purple-500/20 text-primary border-0 px-6 py-2 rounded-full text-sm font-medium">
                <Crown className="w-4 h-4 ml-2" />
                مرحباً بك في متجر RYUS
              </Badge>
            </motion.div>

            {/* العنوان الرئيسي */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-4"
            >
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight">
                <span className="bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
                  تسوق بأناقة
                </span>
                <br />
                <span className="text-foreground">
                  واستمتع بالتميز
                </span>
              </h1>
              
              <p className="text-xl text-muted-foreground max-w-lg mx-auto lg:mx-0 leading-relaxed">
                اكتشف مجموعتنا الحصرية من أفضل المنتجات العصرية بجودة استثنائية وأسعار مناسبة
              </p>
            </motion.div>

            {/* إحصائيات سريعة */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="flex justify-center lg:justify-start gap-8 text-center"
            >
              <div className="space-y-1">
                <div className="text-2xl font-bold text-primary">500+</div>
                <div className="text-sm text-muted-foreground">منتج حصري</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-primary">10K+</div>
                <div className="text-sm text-muted-foreground">عميل سعيد</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-primary">24/7</div>
                <div className="text-sm text-muted-foreground">دعم فني</div>
              </div>
            </motion.div>

            {/* أزرار العمل */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
            >
              <Button 
                size="lg"
                className="bg-gradient-to-r from-primary via-purple-500 to-pink-500 text-white px-8 py-4 rounded-full shadow-lg hover:shadow-xl hover:shadow-primary/30 transition-all duration-500 transform hover:-translate-y-1"
              >
                <ShoppingBag className="w-5 h-5 ml-2" />
                تسوق الآن
                <ArrowLeft className="w-5 h-5 mr-2" />
              </Button>
              
              <Button 
                variant="outline"
                size="lg"
                className="px-8 py-4 rounded-full border-2 border-primary/30 hover:border-primary/60 transition-all duration-300"
              >
                <Heart className="w-5 h-5 ml-2" />
                المنتجات المميزة
              </Button>
            </motion.div>

            {/* تقييمات العملاء */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
              className="flex items-center justify-center lg:justify-start gap-4 pt-4"
            >
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <span className="text-sm font-medium">4.9 من 5</span>
              <span className="text-sm text-muted-foreground">(2,847 تقييم)</span>
            </motion.div>
          </motion.div>

          {/* الصورة التفاعلية */}
          <motion.div 
            initial={{ opacity: 0, x: 50, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="relative"
          >
            <div className="relative max-w-lg mx-auto">
              
              {/* صورة رئيسية - يمكن تخصيصها حسب نوع المتجر */}
              <div className="aspect-square bg-gradient-to-br from-primary/20 via-purple-500/20 to-pink-500/20 rounded-3xl p-8 backdrop-blur-sm border border-white/20">
                <div className="w-full h-full bg-gradient-to-br from-primary/10 to-purple-500/10 rounded-2xl flex items-center justify-center">
                  <motion.div
                    animate={{ 
                      rotate: [0, 5, -5, 0],
                      scale: [1, 1.05, 1]
                    }}
                    transition={{ 
                      duration: 6,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className="text-8xl"
                  >
                    🛍️
                  </motion.div>
                </div>
              </div>

              {/* عناصر تفاعلية طافية */}
              <motion.div
                animate={{ y: [-10, 10, -10] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-6 -right-6 bg-gradient-to-br from-primary to-purple-500 text-white p-4 rounded-2xl shadow-xl"
              >
                <div className="text-center">
                  <Zap className="w-6 h-6 mx-auto mb-1" />
                  <div className="text-xs font-bold">خصم 50%</div>
                </div>
              </motion.div>

              <motion.div
                animate={{ y: [10, -10, 10] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute -bottom-6 -left-6 bg-gradient-to-br from-pink-500 to-red-500 text-white p-4 rounded-2xl shadow-xl"
              >
                <div className="text-center">
                  <Heart className="w-6 h-6 mx-auto mb-1" />
                  <div className="text-xs font-bold">الأكثر حباً</div>
                </div>
              </motion.div>

              <motion.div
                animate={{ 
                  scale: [1, 1.1, 1],
                  rotate: [0, 10, 0]
                }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                className="absolute top-1/2 -left-8 bg-gradient-to-br from-green-500 to-emerald-500 text-white p-3 rounded-xl shadow-lg"
              >
                <Crown className="w-5 h-5" />
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* موجة في الأسفل */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg 
          viewBox="0 0 1200 120" 
          preserveAspectRatio="none" 
          className="w-full h-16 fill-current text-background"
        >
          <path d="M0,0V120H1200V0C1200,0,1075,120,600,120S0,0,0,0Z"/>
        </svg>
      </div>
    </section>
  );
};

export default StoreHero;