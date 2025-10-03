import React, { useState, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const BulkAliasInput = ({ 
  value = [], 
  onChange, 
  existingAliases = [], 
  placeholder = "أدخل المرادفات (كل مرادف في سطر منفصل)" 
}) => {
  const [textValue, setTextValue] = useState('');
  const [duplicates, setDuplicates] = useState([]);
  const [validAliases, setValidAliases] = useState([]);

  useEffect(() => {
    // تحليل النص إلى مرادفات
    const lines = textValue
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    const normalizedExisting = existingAliases.map(a => 
      a.alias_name?.toLowerCase().trim() || a.toLowerCase().trim()
    );

    const duplicatesList = [];
    const validList = [];

    lines.forEach(line => {
      const normalized = line.toLowerCase().trim();
      if (normalizedExisting.includes(normalized)) {
        duplicatesList.push({
          text: line,
          existingAlias: existingAliases.find(
            a => (a.alias_name?.toLowerCase().trim() || a.toLowerCase().trim()) === normalized
          )
        });
      } else {
        validList.push(line);
      }
    });

    setDuplicates(duplicatesList);
    setValidAliases(validList);
    
    // تحديث القيمة الخارجية
    onChange(validList);
  }, [textValue, existingAliases, onChange]);

  const handleTextChange = (e) => {
    setTextValue(e.target.value);
  };

  return (
    <div className="space-y-3">
      <Textarea
        value={textValue}
        onChange={handleTextChange}
        placeholder={placeholder}
        className="min-h-[150px] font-arabic"
        dir="rtl"
      />

      {/* عرض الإحصائيات */}
      <div className="flex items-center gap-4 text-sm">
        {validAliases.length > 0 && (
          <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            <span>{validAliases.length} مرادف صالح</span>
          </div>
        )}
        {duplicates.length > 0 && (
          <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-4 w-4" />
            <span>{duplicates.length} مرادف مكرر</span>
          </div>
        )}
      </div>

      {/* عرض المرادفات الصالحة */}
      {validAliases.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            المرادفات الصالحة:
          </p>
          <div className="flex flex-wrap gap-2">
            {validAliases.map((alias, index) => (
              <Badge key={index} variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-600" />
                {alias}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* تنبيهات المرادفات المكررة */}
      {duplicates.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="space-y-2">
            <p className="font-medium">المرادفات التالية موجودة مسبقاً:</p>
            <div className="space-y-1">
              {duplicates.map((dup, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <XCircle className="h-3 w-3 flex-shrink-0" />
                  <span className="font-medium">{dup.text}</span>
                  {dup.existingAlias && (
                    <span className="text-muted-foreground">
                      (موجود للمدينة: {dup.existingAlias.city_name || 'غير محدد'})
                    </span>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs mt-2">
              سيتم تجاهل المرادفات المكررة تلقائياً
            </p>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
