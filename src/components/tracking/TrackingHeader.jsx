import { MessageCircle, Send, Instagram, Facebook } from 'lucide-react';
import ryusLogo from '@/assets/ryus-logo.png';
import { formatWhatsAppLink } from '@/utils/phoneUtils';

const TrackingHeader = ({ employee }) => {
  const socialMedia = employee?.social_media || {};
  const businessName = employee?.business_page_name || 'RYUS BRAND';

  return (
    <header className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 border-b-4 border-violet-400/50 dark:border-violet-700/50 shadow-2xl">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex flex-col items-center gap-4">
          {/* Logo الاحترافي */}
          <div className="w-24 h-24 rounded-full bg-white/10 backdrop-blur-sm border-4 border-white/30 shadow-2xl flex items-center justify-center p-2">
            <img 
              src={ryusLogo} 
              alt={businessName} 
              className="w-full h-full object-contain"
            />
          </div>

          {/* Welcome Message - بدون كلمة "صفحة" */}
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-1">
              أهلاً بك في {businessName}
            </h1>
            <p className="text-sm text-violet-100">تتبع طلبك بكل سهولة</p>
          </div>

          {/* Social Media Icons */}
          {(socialMedia.whatsapp || socialMedia.telegram || socialMedia.instagram || socialMedia.facebook) && (
            <div className="flex items-center gap-3 mt-2">
              {socialMedia.whatsapp && (
                <a
                  href={formatWhatsAppLink(socialMedia.whatsapp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-11 h-11 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-all flex items-center justify-center text-white shadow-lg hover:scale-110 border-2 border-white/30"
                  title="واتساب"
                >
                  <MessageCircle className="w-5 h-5" />
                </a>
              )}
              {socialMedia.telegram && (
                <a
                  href={socialMedia.telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-11 h-11 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-all flex items-center justify-center text-white shadow-lg hover:scale-110 border-2 border-white/30"
                  title="تليغرام"
                >
                  <Send className="w-5 h-5" />
                </a>
              )}
              {socialMedia.instagram && (
                <a
                  href={socialMedia.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-11 h-11 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-all flex items-center justify-center text-white shadow-lg hover:scale-110 border-2 border-white/30"
                  title="انستقرام"
                >
                  <Instagram className="w-5 h-5" />
                </a>
              )}
              {socialMedia.facebook && (
                <a
                  href={socialMedia.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-11 h-11 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-all flex items-center justify-center text-white shadow-lg hover:scale-110 border-2 border-white/30"
                  title="فيسبوك"
                >
                  <Facebook className="w-5 h-5" />
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default TrackingHeader;
