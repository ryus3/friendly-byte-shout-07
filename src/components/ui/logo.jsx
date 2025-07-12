import React from 'react';
import { motion } from 'framer-motion';
import logo from '@/assets/logo.png';

const Logo = ({ className = "h-8 w-8", showText = true, variant = "default" }) => {
  const variants = {
    default: "text-primary",
    white: "text-white",
    dark: "text-gray-900"
  };

  return (
    <motion.div 
      className="flex items-center gap-3"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <motion.img 
        src={logo} 
        alt="RYUS Logo" 
        className={className}
        whileHover={{ scale: 1.05 }}
        transition={{ type: "spring", stiffness: 300 }}
      />
      {showText && (
        <motion.div 
          className="flex flex-col"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <span className={`font-bold text-xl ${variants[variant]}`}>
            RYUS
          </span>
          <span className={`text-xs opacity-75 ${variants[variant]}`}>
            نظام إدارة متكامل
          </span>
        </motion.div>
      )}
    </motion.div>
  );
};

export default Logo;