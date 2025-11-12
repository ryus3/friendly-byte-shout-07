import { MessageCircle, Send, Instagram, Facebook } from 'lucide-react';

const TrackingHeader = ({ employee }) => {
  const socialLinks = employee?.social_media || {};
  const businessName = employee?.business_page_name || 'متجرنا';

  return (
    <div className="bg-card border-b-2 border-border">
      <div className="max-w-3xl mx-auto px-4 py-4">
        <div className="flex flex-col items-center gap-3">
          {/* الشعار */}
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
            <span className="text-2xl font-bold text-white">R</span>
          </div>
          
          {/* الترحيب */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">أهلاً بك في</p>
            <h1 className="text-xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
              {businessName}
            </h1>
          </div>

          {/* أيقونات التواصل */}
          <div className="flex gap-2">
            {socialLinks.whatsapp && (
              <a
                href={socialLinks.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-colors shadow-md"
                aria-label="WhatsApp"
              >
                <MessageCircle className="w-4 h-4 text-white" />
              </a>
            )}
            
            {socialLinks.telegram && (
              <a
                href={socialLinks.telegram}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center transition-colors shadow-md"
                aria-label="Telegram"
              >
                <Send className="w-4 h-4 text-white" />
              </a>
            )}
            
            {socialLinks.instagram && (
              <a
                href={socialLinks.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 flex items-center justify-center transition-colors shadow-md"
                aria-label="Instagram"
              >
                <Instagram className="w-4 h-4 text-white" />
              </a>
            )}
            
            {socialLinks.facebook && (
              <a
                href={socialLinks.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center transition-colors shadow-md"
                aria-label="Facebook"
              >
                <Facebook className="w-4 h-4 text-white" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrackingHeader;
