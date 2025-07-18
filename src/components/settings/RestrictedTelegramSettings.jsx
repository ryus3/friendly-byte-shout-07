import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Shield, User } from 'lucide-react';
import usePermissionBasedData from '@/hooks/usePermissionBasedData';
import TelegramBotDialog from './TelegramBotDialog';

const RestrictedTelegramSettings = () => {
  const { canViewAllData, isAdmin, isEmployee, user } = usePermissionBasedData();
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <Card 
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => setIsOpen(true)}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-blue-600" />
            بوت التليجرام
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-2">
            {canViewAllData 
              ? 'إدارة بوت التليجرام ورموز الموظفين' 
              : 'عرض رمزك الشخصي للاتصال بالبوت'
            }
          </p>
          <Badge variant={isAdmin ? "default" : "secondary"}>
            {isAdmin ? (
              <>
                <Shield className="w-3 h-3 ml-1" />
                إدارة كاملة
              </>
            ) : (
              <>
                <User className="w-3 h-3 ml-1" />
                رمزي الشخصي
              </>
            )}
          </Badge>
        </CardContent>
      </Card>

      <TelegramBotDialog 
        open={isOpen} 
        onOpenChange={setIsOpen} 
      />
    </>
  );
};

export default RestrictedTelegramSettings;