import React from 'react';
import { Zap, Gift, Truck } from 'lucide-react';

const AnnouncementBar = () => {
  const announcements = [
    { icon: Zap, text: 'عروض حصرية - خصم حتى 70%', color: 'from-purple-600 via-pink-600 to-red-600' },
    { icon: Truck, text: 'شحن مجاني للطلبات فوق 50,000 د.ع', color: 'from-blue-600 via-cyan-600 to-teal-600' },
    { icon: Gift, text: 'اشتري 2 واحصل على 1 مجاناً', color: 'from-emerald-600 via-green-600 to-lime-600' },
  ];

  const [currentIndex, setCurrentIndex] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % announcements.length);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const current = announcements[currentIndex];
  const Icon = current.icon;

  return (
    <div className={`w-full bg-gradient-to-r ${current.color} text-white py-3 overflow-hidden relative`}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-center gap-3 animate-in fade-in slide-in-from-top-2 duration-500">
          <Icon className="w-5 h-5 animate-bounce" />
          <p className="font-bold text-sm md:text-base">{current.text}</p>
        </div>
      </div>

      {/* Progress Dots */}
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1.5">
        {announcements.map((_, idx) => (
          <div
            key={idx}
            className={`h-1 rounded-full transition-all duration-300 ${
              idx === currentIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/50'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default AnnouncementBar;
