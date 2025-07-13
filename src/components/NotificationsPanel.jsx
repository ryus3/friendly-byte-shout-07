import React, { useState } from 'react';
import { Bell, Package, CheckCircle, AlertTriangle, Trash2, Check, Eye, UserPlus, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/components/ui/use-toast';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useNotificationsSystem } from '@/contexts/NotificationsSystemContext';
import PendingRegistrations from './dashboard/PendingRegistrations';
import AiOrdersManager from './dashboard/AiOrdersManager';
import { formatDistanceToNowStrict } from 'date-fns';
import { ar } from 'date-fns/locale';

const iconMap = {
  AlertTriangle,
  Package,
  CheckCircle,
  UserPlus,
  Bot,
  Bell,
};

const colorClasses = {
  orange: 'border-orange-500/80',
  blue: 'border-blue-500/80',
  green: 'border-green-500/80',
  purple: 'border-purple-500/80',
  default: 'border-gray-500/80',
};

const iconColorClasses = {
  orange: 'text-orange-400',
  blue: 'text-blue-400',
  green: 'text-green-400',
  purple: 'text-purple-400',
  default: 'text-gray-400',
};

const NotificationsPanel = () => {
  const { notifications, markAsRead, markAllAsRead, clearAll, deleteNotification } = useNotifications();
  const { notifications: systemNotifications, markAsRead: markSystemAsRead, markAllAsRead: markAllSystemAsRead, deleteNotification: deleteSystemNotification } = useNotificationsSystem();
  const [isOpen, setIsOpen] = useState(false);
  const [showPendingRegistrations, setShowPendingRegistrations] = useState(false);
  const [showAiOrdersManager, setShowAiOrdersManager] = useState(false);
  const navigate = useNavigate();

  const handleNotificationClick = (e, notification) => {
    e.stopPropagation();
    
    // تحديد الإشعار كمقروء
    if (!notification.is_read) {
      if (notification.related_entity_type) {
        // إشعار من النظام الجديد
        markSystemAsRead(notification.id);
      } else {
        // إشعار من النظام القديم
        markAsRead(notification.id);
      }
    }
    
    // التنقل حسب نوع الإشعار
    if (notification.type === 'new_registration') {
      setShowPendingRegistrations(true);
    } else if (notification.type === 'new_ai_order') {
      setShowAiOrdersManager(true);
    } else if (notification.related_entity_type) {
      // إشعارات النظام الجديد - التنقل حسب نوع الكيان
      switch (notification.related_entity_type) {
        case 'order':
          navigate(`/orders?highlight=${notification.related_entity_id}`);
          break;
        case 'settlement_request':
          navigate(`/employee-follow-up`);
          break;
        case 'settlement_invoice':
          navigate(`/profits-summary?invoice=${notification.related_entity_id}`);
          break;
        case 'product':
          navigate(`/inventory?product=${notification.related_entity_id}`);
          break;
        default:
          toast({
            title: `إشعار: ${notification.title}`,
            description: notification.message
          });
      }
    } else if (notification.link && notification.link !== '#') {
      navigate(notification.link);
    } else {
      toast({
        title: `إشعار: ${notification.title}`,
        description: notification.message
      });
    }
    setIsOpen(false);
  };

  const handleMarkAsRead = (e, id) => {
    e.stopPropagation();
    markAsRead(id);
    toast({ title: "تم تحديد الإشعار كمقروء" });
  };

  const handleMarkAllAsRead = (e) => {
    e.stopPropagation();
    markAllAsRead();
    toast({ title: "تم تحديد الكل كمقروء" });
  };

  const handleClearAll = (e) => {
    e.stopPropagation();
    clearAll();
    toast({ title: "تم حذف جميع الإشعارات" });
  };

  const formatRelativeTime = (dateString) => {
    try {
      // Make time shorter
      const time = formatDistanceToNowStrict(new Date(dateString), { addSuffix: false, locale: ar });
      return time
        .replace(/دقيقة|دقائق/, 'د')
        .replace(/ساعة|ساعات/, 'س')
        .replace(/يوم|أيام/, 'ي')
        .replace(/أسبوع|أسابيع/, 'أ')
        .replace(/شهر|أشهر/, 'ش')
        .replace(/سنة|سنوات/, 'سنة');
    } catch (error) {
      return 'منذ فترة';
    }
  };

  // دمج الإشعارات من النظامين
  const allNotifications = [
    ...notifications.filter(n => n.type !== 'welcome'),
    ...systemNotifications
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  const unreadFilteredCount = allNotifications.filter(n => !n.is_read && !n.read).length;

  return (
    <>
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadFilteredCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
            >
              <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 justify-center rounded-full p-0">
                {unreadFilteredCount}
              </Badge>
            </motion.div>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 md:w-96 glass-effect p-2" align="end">
        <DropdownMenuLabel className="flex justify-between items-center px-2 py-1.5">
          <span className="font-bold">الإشعارات</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate('/notifications')} title="عرض كل الإشعارات">
              <Eye className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleMarkAllAsRead} title="تحديد الكل كمقروء" disabled={unreadFilteredCount === 0}>
              <Check className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={handleClearAll} title="حذف الكل" disabled={allNotifications.length === 0}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-80">
          <AnimatePresence>
            {allNotifications.length > 0 ? (
              allNotifications.slice(0, 8).map(notification => {
                const borderColorClass = colorClasses[notification.color] || colorClasses.default;
                const iconColor = iconColorClasses[notification.color] || iconColorClasses.default;
                const IconComponent = iconMap[notification.icon] || Bell;
                return (
                  <motion.div
                    key={notification.id}
                    layout
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                    className="relative group"
                  >
                    <DropdownMenuItem 
                      className={cn(
                        "flex items-start gap-3 p-3 cursor-pointer transition-all duration-300 my-1 rounded-lg", 
                        "border-r-4",
                        borderColorClass,
                        (notification.is_read || notification.read) ? "bg-background/50 opacity-60" : "bg-secondary/80 hover:bg-secondary",
                        !(notification.is_read || notification.read) && "bg-primary/10",
                      )}
                      onClick={(e) => handleNotificationClick(e, notification)}
                    >
                      <IconComponent className={cn("w-5 h-5 mt-1 shrink-0", iconColor)} />
                      <div className="flex-1">
                        <p className={cn("font-semibold text-sm", !(notification.is_read || notification.read) && "text-foreground")}>{notification.title}</p>
                        <p className="text-xs text-muted-foreground">{notification.message}</p>
                        <p className="text-[10px] text-muted-foreground/70 mt-1">{formatRelativeTime(notification.created_at)}</p>
                      </div>
                      {!(notification.is_read || notification.read) && (
                        <div className="absolute top-1/2 -translate-y-1/2 right-2 w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                      )}
                    </DropdownMenuItem>
                     {!(notification.is_read || notification.read) && (
                      <div className="absolute top-1/2 -translate-y-1/2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7"
                          title="وضع كمقروء"
                          onClick={(e) => handleMarkAsRead(e, notification.id)}
                        >
                          <Eye className="w-4 h-4 text-primary" />
                        </Button>
                      </div>
                    )}
                  </motion.div>
                )
              })
            ) : (
              <div className="text-center text-muted-foreground py-10 px-4">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-50"/>
                <p>لا توجد إشعارات جديدة.</p>
              </div>
            )}
          </AnimatePresence>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
    <AnimatePresence>
      {showPendingRegistrations && (
        <PendingRegistrations onClose={() => setShowPendingRegistrations(false)} />
      )}
      {showAiOrdersManager && (
        <AiOrdersManager onClose={() => setShowAiOrdersManager(false)} />
      )}
    </AnimatePresence>
    </>
  );
};

export default NotificationsPanel;