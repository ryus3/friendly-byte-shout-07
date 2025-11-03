import React from 'react';
import { motion } from 'framer-motion';
import { Package, Cpu, Sparkles } from 'lucide-react';

const SplashScreen = () => {
  // Floating particles configuration
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    size: Math.random() * 8 + 4,
    x: Math.random() * 100,
    y: Math.random() * 100,
    duration: Math.random() * 3 + 2,
    delay: Math.random() * 2,
  }));

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        background: 'linear-gradient(135deg, hsl(210, 100%, 97%) 0%, hsl(250, 100%, 98%) 50%, hsl(300, 100%, 98%) 100%)',
      }}
    >
      {/* Floating particles */}
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full opacity-30"
          style={{
            width: particle.size,
            height: particle.size,
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--chart-2)) 100%)',
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, Math.random() * 20 - 10, 0],
            scale: [1, 1.2, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Main content container */}
      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Animated logo container */}
        <motion.div
          className="relative"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            type: 'spring',
            stiffness: 200,
            damping: 20,
            delay: 0.1,
          }}
        >
          {/* Glow effect */}
          <motion.div
            className="absolute inset-0 rounded-full blur-3xl opacity-40"
            style={{
              background: 'radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)',
            }}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />

          {/* Logo icon */}
          <motion.div
            className="relative bg-gradient-to-br from-primary to-chart-2 p-6 rounded-3xl shadow-2xl"
            animate={{
              rotateY: [0, 360],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'linear',
              repeatDelay: 1,
            }}
          >
            <Package className="w-16 h-16 text-white" strokeWidth={2} />
          </motion.div>
        </motion.div>

        {/* Brand name with elegant font */}
        <motion.div
          className="flex flex-col items-center gap-3"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <h1 className="font-brand text-6xl font-bold bg-gradient-to-r from-primary via-chart-2 to-chart-3 bg-clip-text text-transparent">
            RYUS BRAND
          </h1>

          {/* Subtitle with icons */}
          <motion.div
            className="flex items-center gap-2 text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <Cpu className="w-4 h-4 text-primary" />
            <p className="text-sm font-medium tracking-wide">
              نظام الإدارة المدعوم بالذكاء الاصطناعي
            </p>
            <Sparkles className="w-4 h-4 text-chart-2" />
          </motion.div>

          {/* Animated tagline */}
          <motion.p
            className="text-xs text-muted-foreground/70 mt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.7] }}
            transition={{ delay: 0.7, duration: 1.5 }}
          >
            إدارة احترافية للمخزون والطلبات
          </motion.p>
        </motion.div>

        {/* Loading progress bar */}
        <motion.div
          className="w-64 h-1 bg-muted/30 rounded-full overflow-hidden mt-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, hsl(var(--primary)) 0%, hsl(var(--chart-2)) 50%, hsl(var(--chart-3)) 100%)',
            }}
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 2.5, ease: 'easeInOut' }}
          />
        </motion.div>
      </div>

      {/* Bottom gradient overlay */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{
          background: 'linear-gradient(to top, hsl(210, 100%, 97%), transparent)',
        }}
      />
    </motion.div>
  );
};

export default SplashScreen;
