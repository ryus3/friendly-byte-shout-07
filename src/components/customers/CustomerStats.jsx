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
      colors: ['from-primary/20', 'to-blue-500/20'],
      iconBg: 'bg-gradient-to-br from-primary to-blue-500',
      textColor: 'text-primary'
    },
    {
      id: 'with_phone',
      title: 'عملاء مع أرقام هواتف',
      value: customers.filter(c => c.phone).length,
      icon: Phone,
      colors: ['from-green-500/20', 'to-emerald-500/20'],
      iconBg: 'bg-gradient-to-br from-green-500 to-emerald-500',
      textColor: 'text-green-600'
    },
    {
      id: 'with_points',
      title: 'عملاء مع نقاط',
      value: customers.filter(c => c.customer_loyalty?.total_points > 0).length,
      icon: Star,
      colors: ['from-yellow-500/20', 'to-orange-500/20'],
      iconBg: 'bg-gradient-to-br from-yellow-500 to-orange-500',
      textColor: 'text-yellow-600'
    },
    {
      id: 'total_points',
      title: 'إجمالي النقاط',
      value: customers.reduce((sum, c) => sum + (c.customer_loyalty?.total_points || 0), 0).toLocaleString('ar'),
      icon: TrendingUp,
      colors: ['from-purple-500/20', 'to-pink-500/20'],
      iconBg: 'bg-gradient-to-br from-purple-500 to-pink-500',
      textColor: 'text-purple-600'
    },
    {
      id: 'total_sales',
      title: 'إجمالي المبيعات',
      value: customers.reduce((sum, c) => sum + (c.customer_loyalty?.total_spent || 0), 0).toLocaleString('ar') + ' د.ع',
      icon: ShoppingBag,
      colors: ['from-indigo-500/20', 'to-blue-600/20'],
      iconBg: 'bg-gradient-to-br from-indigo-500 to-blue-600',
      textColor: 'text-indigo-600'
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
              bg-gradient-to-br ${stat.colors.join(' ')}
              border border-border/50
              hover:shadow-xl hover:shadow-primary/10
              transition-all duration-300
              hover:border-primary/30
            `}
            onClick={() => onStatClick && onStatClick(stat.id)}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </p>
                  <motion.p 
                    className={`text-2xl font-bold ${stat.textColor}`}
                    initial={{ scale: 1 }}
                    whileHover={{ scale: 1.05 }}
                    transition={{ duration: 0.2 }}
                  >
                    {stat.value}
                  </motion.p>
                </div>
                
                <motion.div
                  className={`
                    p-3 rounded-xl ${stat.iconBg}
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
              
              {/* خط تدرج في الأسفل */}
              <motion.div 
                className={`
                  absolute bottom-0 left-0 h-1 bg-gradient-to-r ${stat.iconBg}
                  w-0 group-hover:w-full transition-all duration-500
                `}
                initial={{ width: 0 }}
                whileHover={{ width: "100%" }}
              />
              
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