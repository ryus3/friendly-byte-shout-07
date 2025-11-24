import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, Send, Instagram, Facebook, Store } from 'lucide-react';
import { formatWhatsAppLink } from '@/utils/phoneUtils';

const EmployeeContactCard = ({ employee }) => {
  if (!employee) return null;

  const socialLinks = employee.social_media || {};
  const businessLinks = employee.business_links || [];

  return (
    <Card className="border-2 border-green-200 dark:border-green-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Store className="w-5 h-5" />
          تواصل معنا
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-center p-4 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20 rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">من</p>
            <p className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
              {employee.business_page_name || 'متجرنا'}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2 justify-center">
            {socialLinks.whatsapp && (
              <a 
                href={formatWhatsAppLink(socialLinks.whatsapp)} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
              >
                <MessageCircle className="w-5 h-5" />
                <span className="font-medium">WhatsApp</span>
              </a>
            )}
            
            {socialLinks.telegram && (
              <a 
                href={socialLinks.telegram} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
              >
                <Send className="w-5 h-5" />
                <span className="font-medium">Telegram</span>
              </a>
            )}
            
            {socialLinks.instagram && (
              <a 
                href={socialLinks.instagram} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-lg hover:from-pink-600 hover:to-rose-600 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
              >
                <Instagram className="w-5 h-5" />
                <span className="font-medium">Instagram</span>
              </a>
            )}
            
            {socialLinks.facebook && (
              <a 
                href={socialLinks.facebook} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
              >
                <Facebook className="w-5 h-5" />
                <span className="font-medium">Facebook</span>
              </a>
            )}
          </div>

          {businessLinks.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">روابط إضافية:</p>
              <div className="flex flex-wrap gap-2">
                {businessLinks.map((link, index) => {
                  // Format WhatsApp links, keep others as-is
                  const href = link.type === 'whatsapp' || link.url?.includes('whatsapp') || link.url?.includes('wa.me')
                    ? formatWhatsAppLink(link.url)
                    : link.url;
                  
                  return (
                    <a
                      key={index}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-lg hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors text-sm"
                    >
                      {link.label || link.title || `رابط ${index + 1}`}
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default EmployeeContactCard;
