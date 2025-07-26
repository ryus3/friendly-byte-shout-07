import React from 'react';
import { motion } from 'framer-motion';
import { Users, Phone, Star, TrendingUp, ShoppingBag } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const CustomerStats = ({ customers, onStatClick }) => {
  const stats = [
    {
      id: 'total',
      title: 'إجمالي العملاء',
      value: customers.length,
      icon: Users,
      gradient: 'from-indigo-600 via-purple-600 to-pink-600',
      shadow: 'shadow-purple-500/25',
      glow: 'hover:shadow-purple-500/40',
      iconBg: 'bg-white/15',
      textColor: 'text-white'
    },
    {
      id: 'with_phone',
      title: 'عملاء مع أرقام هواتف',
      value: customers.filter(c => c.phone).length,
      icon: Phone,
      gradient: 'from-blue-500 via-cyan-500 to-teal-500',
      shadow: 'shadow-blue-500/20',
      glow: 'hover:shadow-blue-500/30',
      iconBg: 'bg-white/10',
      textColor: 'text-white'
    },
    {
      id: 'with_points',
      title: 'عملاء مع نقاط',
      value: customers.filter(c => c.customer_loyalty?.total_points > 0).length,
      icon: Star,
      gradient: 'from-orange-600 via-red-500 to-pink-500',
      shadow: 'shadow-orange-500/25',
      glow: 'hover:shadow-orange-500/35',
      iconBg: 'bg-white/15',
      textColor: 'text-white'
    },
    {
      id: 'total_points',
      title: 'إجمالي النقاط',
      value: customers.reduce((sum, c) => sum + (c.customer_loyalty?.total_points || 0), 0).toLocaleString('ar'),
      icon: TrendingUp,
      gradient: 'from-purple-500 via-violet-500 to-pink-500',
      shadow: 'shadow-purple-500/20',
      glow: 'hover:shadow-purple-500/30',
      iconBg: 'bg-white/10',
      textColor: 'text-white'
    },
    {
      id: 'total_sales',
      title: 'إجمالي المبيعات',
      value: customers.reduce((sum, c) => sum + (c.customer_loyalty?.total_spent || 0), 0).toLocaleString('ar') + ' د.ع',
      icon: ShoppingBag,
      gradient: 'from-rose-500 via-pink-500 to-purple-500',
      shadow: 'shadow-rose-500/20',
      glow: 'hover:shadow-rose-500/30',
      iconBg: 'bg-white/10',
      textColor: 'text-white'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ 
            duration: 0.5, 
            delay: index * 0.1,
            ease: "easeOut"
          }}
          whileHover={{ 
            y: -5,
            transition: { duration: 0.2 }
          }}
        >
          <Card 
            className={`
              relative overflow-hidden cursor-pointer group
              bg-gradient-to-br ${stat.gradient} text-white
              border-0 shadow-xl ${stat.shadow}
              hover:shadow-2xl ${stat.glow}
              transition-all duration-500
              hover:scale-[1.02] hover:-translate-y-1
              min-h-[140px] flex
              backdrop-blur-sm
            `}
            onClick={() => onStatClick && onStatClick(stat.id)}
          >
            <CardContent className="p-6 flex flex-col justify-between h-full w-full">
              <div className="flex items-center justify-between h-full">
                <div className="space-y-2 flex-1">
                  <p className="text-sm font-medium text-white/90 leading-tight">
                    {stat.title}
                  </p>
                  <motion.p 
                    className="text-xl font-bold text-white leading-tight"
                    initial={{ scale: 1 }}
                    whileHover={{ scale: 1.05 }}
                    transition={{ duration: 0.2 }}
                  >
                    {stat.value}
                  </motion.p>
                </div>
                
                <motion.div
                  className={`
                    p-3 rounded-xl ${stat.iconBg} backdrop-blur-sm
                    shadow-lg
                  `}
                  initial={{ rotate: 0, scale: 1 }}
                  whileHover={{ 
                    rotate: 5, 
                    scale: 1.1,
                    transition: { duration: 0.3, ease: "easeOut" }
                  }}
                  whileTap={{ scale: 0.95 }}
                >
                  <stat.icon className="h-6 w-6 text-white" />
                </motion.div>
              </div>
              
              {/* تأثيرات الخلفية */}
              <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-white/5 rounded-full"></div>
              <div className="absolute -top-2 -left-2 w-12 h-12 bg-white/5 rounded-full"></div>
              
              {/* تأثير الضوء */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
};

export default CustomerStats;