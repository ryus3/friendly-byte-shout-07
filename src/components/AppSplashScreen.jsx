import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import logoBlue from '@/assets/ryus-logo-blue.png';

const AppSplashScreen = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 4;
      });
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const floatingElements = [
    { type: 'star', x: '10%', y: '15%', delay: 0 },
    { type: 'star', x: '85%', y: '25%', delay: 0.2 },
    { type: 'triangle', x: '75%', y: '10%', delay: 0.4 },
    { type: 'circle', x: '90%', y: '60%', delay: 0.6 },
    { type: 'star', x: '15%', y: '70%', delay: 0.8 },
    { type: 'circle', x: '5%', y: '40%', delay: 1 },
    { type: 'triangle', x: '20%', y: '85%', delay: 1.2 },
  ];

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #ec4899 0%, #a855f7 50%, #6366f1 100%)',
      }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
    >
      {/* Animated Wave Circles */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      >
        {[1, 2, 3, 4].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border-2 border-white/20"
            style={{
              width: `${i * 250}px`,
              height: `${i * 250}px`,
            }}
            animate={{
              scale: [1, 1.15, 1],
              opacity: [0.4, 0.1, 0.4],
            }}
            transition={{
              duration: 3,
              delay: i * 0.2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}
      </motion.div>

      {/* Floating Elements */}
      {floatingElements.map((element, index) => (
        <motion.div
          key={index}
          className="absolute"
          style={{ left: element.x, top: element.y }}
          initial={{ y: 0, opacity: 0 }}
          animate={{
            y: [-15, 15, -15],
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: 2.5,
            delay: element.delay,
            times: [0, 0.2, 0.8, 1],
          }}
        >
          {element.type === 'star' && (
            <div className="text-white text-4xl drop-shadow-lg">⭐</div>
          )}
          {element.type === 'triangle' && (
            <div className="text-green-300 text-3xl drop-shadow-lg">▲</div>
          )}
          {element.type === 'circle' && (
            <div className="w-4 h-4 rounded-full bg-white/60 shadow-lg"></div>
          )}
        </motion.div>
      ))}

      {/* Main Content */}
      <motion.div
        className="relative z-10 flex flex-col items-center px-6"
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{
          type: 'spring',
          stiffness: 200,
          damping: 15,
          duration: 1,
        }}
      >
        {/* Logo with Animation */}
        <motion.div
          className="w-48 h-48 mb-8 drop-shadow-2xl"
          animate={{
            rotate: [0, 5, -5, 0],
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <img
            src={logoBlue}
            alt="RYUS BRAND"
            className="w-full h-full object-contain drop-shadow-2xl"
          />
        </motion.div>

        {/* Title */}
        <motion.h1
          className="font-brand text-5xl font-bold text-white mb-3 drop-shadow-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          RYUS BRAND
        </motion.h1>

        {/* Description */}
        <motion.p
          className="text-white text-lg font-medium tracking-wide text-center max-w-md mb-10 drop-shadow-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
        >
          نظام إدارة الطلبات المدعوم بالذكاء الاصطناعي
        </motion.p>

        {/* Loading Bar */}
        <motion.div
          className="w-72 h-2 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.9 }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, #fff 0%, #f0abfc 50%, #fff 100%)',
              width: `${progress}%`,
            }}
            initial={{ width: '0%' }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        </motion.div>

        {/* Progress Text */}
        <motion.p
          className="text-white/80 text-sm mt-4 font-medium"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
        >
          جاري التحميل... {progress}%
        </motion.p>
      </motion.div>
    </motion.div>
  );
};

export default AppSplashScreen;
