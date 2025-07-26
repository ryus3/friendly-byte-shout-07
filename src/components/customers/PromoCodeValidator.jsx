import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Copy } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';

const PromoCodeValidator = ({ onPromoCodeApplied }) => {
  const [promoCode, setPromoCode] = useState('');
  const [validationResult, setValidationResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const validatePromoCode = async () => {
    if (!promoCode.trim()) {
      toast({
        title: 'خطأ',
        description: 'يرجى إدخال برومو كود',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('validate_promo_code', {
        promo_code_param: promoCode.trim()
      });

      if (error) throw error;

      setValidationResult(data);
      
      if (data.valid) {
        toast({
          title: 'برومو كود صالح',
          description: data.message
        });
        
        // إشعار المكون الأب
        if (onPromoCodeApplied) {
          onPromoCodeApplied({
            promoCode: promoCode.trim(),
            customerId: data.customer_id,
            customerName: data.customer_name,
            discountPercentage: data.discount_percentage,
            tierName: data.tier_name
          });
        }
      } else {
        toast({
          title: 'برومو كود غير صالح',
          description: data.message,
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error validating promo code:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ في التحقق من البروموكود',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'تم النسخ',
      description: 'تم نسخ البروموكود'
    });
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-right">التحقق من البروموكود</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="أدخل البروموكود (مثال: RY0024GO)"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            className="text-right"
            dir="rtl"
          />
          <Button 
            onClick={validatePromoCode}
            disabled={loading}
            className="shrink-0"
          >
            {loading ? 'جاري التحقق...' : 'تحقق'}
          </Button>
        </div>

        {validationResult && (
          <div className={`p-4 rounded-lg border ${
            validationResult.valid 
              ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800/50' 
              : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/50'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {validationResult.valid ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              <span className={`font-medium ${
                validationResult.valid ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
              }`}>
                {validationResult.valid ? 'برومو كود صالح' : 'برومو كود غير صالح'}
              </span>
            </div>
            
            <p className={`text-sm ${
              validationResult.valid ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
            }`}>
              {validationResult.message}
            </p>

            {validationResult.valid && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">العميل:</span>
                  <Badge variant="outline">{validationResult.customer_name}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">المستوى:</span>
                  <Badge variant="secondary">{validationResult.tier_name}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">الخصم:</span>
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                    {validationResult.discount_percentage}%
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(promoCode)}
                  className="w-full mt-2"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  نسخ البروموكود
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="text-xs text-muted-foreground text-right">
          <p>البروموكود يبدأ بـ RY متبوعاً بآخر 4 أرقام من الهاتف ومستوى العضوية</p>
          <p>مثال: RY0024GO (للعضوية الذهبية)</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default PromoCodeValidator;