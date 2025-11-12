import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin } from 'lucide-react';

const TrackingMap = ({ order }) => {
  // خريطة العراق التفاعلية - المحافظات
  const governorates = {
    'بغداد': { x: 50, y: 45 },
    'البصرة': { x: 60, y: 85 },
    'الموصل': { x: 45, y: 15 },
    'نينوى': { x: 45, y: 15 },
    'أربيل': { x: 55, y: 20 },
    'كربلاء': { x: 48, y: 52 },
    'النجف': { x: 48, y: 58 },
    'الأنبار': { x: 35, y: 45 },
    'ديالى': { x: 58, y: 42 },
    'ذي قار': { x: 52, y: 75 },
    'القادسية': { x: 50, y: 65 },
    'المثنى': { x: 48, y: 70 },
    'ميسان': { x: 62, y: 70 },
    'واسط': { x: 55, y: 58 },
    'صلاح الدين': { x: 50, y: 35 },
    'كركوك': { x: 55, y: 30 },
    'بابل': { x: 50, y: 52 },
    'السليمانية': { x: 62, y: 25 },
    'دهوك': { x: 42, y: 10 }
  };

  const location = governorates[order.customer_governorate] || governorates[order.customer_city] || { x: 50, y: 50 };

  return (
    <Card className="border-2 border-blue-200 dark:border-blue-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          الموقع
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative w-full h-64 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 rounded-lg overflow-hidden">
          {/* خريطة العراق المبسطة */}
          <svg viewBox="0 0 100 100" className="w-full h-full">
            {/* حدود العراق */}
            <path 
              d="M 30 10 L 65 10 L 68 25 L 62 30 L 60 45 L 65 60 L 62 75 L 55 90 L 45 90 L 40 75 L 35 60 L 30 45 L 28 30 Z" 
              fill="hsl(var(--violet-100) / 0.3)"
              stroke="hsl(var(--violet-500))"
              strokeWidth="0.5"
              className="dark:fill-violet-950/30"
            />
            
            {/* نقطة الموقع */}
            <circle 
              cx={location.x} 
              cy={location.y} 
              r="3" 
              fill="hsl(var(--destructive))"
              className="animate-pulse"
            />
            <circle 
              cx={location.x} 
              cy={location.y} 
              r="6" 
              fill="hsl(var(--destructive) / 0.3)"
              className="animate-ping"
            />
          </svg>

          {/* اسم المحافظة */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 px-4 py-2 rounded-full shadow-lg border-2 border-violet-200 dark:border-violet-800">
            <p className="font-bold text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4 text-destructive" />
              {order.customer_governorate || order.customer_city || 'موقع غير محدد'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TrackingMap;
