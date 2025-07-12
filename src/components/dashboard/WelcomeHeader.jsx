import React from 'react';
import { motion } from 'framer-motion';

const WelcomeHeader = ({ user, currentTime }) => {

  const formattedDate = new Intl.DateTimeFormat('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(currentTime);
  const formattedTime = new Intl.DateTimeFormat('ar-EG', { hour: 'numeric', minute: '2-digit', hour12: true }).format(currentTime);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="glass-effect rounded-2xl p-6"
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text mb-2">مرحباً، {user?.full_name || user?.email}</h1>
          <p className="text-muted-foreground">إليك نظرة سريعة على أداء متجرك</p>
        </div>
        <div className="text-center sm:text-right bg-secondary/50 dark:bg-secondary/20 p-4 rounded-lg">
          <p className="text-lg font-semibold gradient-text">{formattedDate}</p>
          <p className="text-2xl font-bold text-foreground tabular-nums">{formattedTime}</p>
        </div>
      </div>
    </motion.div>
  );
};

export default WelcomeHeader;