import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, Phone, Package } from 'lucide-react';

const TrackingSearch = ({ onSearch, error }) => {
  const [searchValue, setSearchValue] = useState('');

  const handleSearch = () => {
    if (searchValue.trim()) {
      onSearch(searchValue.trim());
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50 dark:from-gray-900 dark:via-purple-950 dark:to-indigo-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-2 border-violet-200 dark:border-violet-800">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl">
              <Package className="w-12 h-12 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
            تتبع طلبك
          </CardTitle>
          <CardDescription>
            أدخل رقم الطلب أو رقم الهاتف لتتبع حالة طلبك
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <div className="relative">
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <Package className="w-4 h-4 text-muted-foreground" />
              </div>
              <Input
                placeholder="رقم الطلب أو رقم الهاتف"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="pr-20 h-12 border-2 border-violet-200 focus:border-violet-400"
              />
            </div>
          </div>
          
          <Button 
            onClick={handleSearch}
            className="w-full h-12 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
          >
            <Search className="w-4 h-4 ml-2" />
            بحث
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default TrackingSearch;
