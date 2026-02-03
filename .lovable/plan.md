

# خطة: تحسين عنوان تبويب فواتير شركات التوصيل

## التغيير المطلوب

| الحالي | المطلوب |
|--------|---------|
| `فواتير شركات التوصيل` + `Badge: الوسيط + مدن` | `فواتير شركات التوصيل` فقط بدون Badge |

## التعديل

**الملف:** `src/components/orders/AlWaseetInvoicesTab.jsx`

**السطور:** 351-354

**قبل:**
```jsx
<span className="text-right flex items-center gap-2">
  فواتير شركات التوصيل
  <Badge variant="outline" className="text-xs">الوسيط + مدن</Badge>
</span>
```

**بعد:**
```jsx
<span className="text-right text-lg font-bold">
  فواتير شركات التوصيل
</span>
```

## النتيجة

العنوان سيظهر بشكل أنظف وأجمل بدون Badge إضافي غير ضروري، مع الحفاظ على وضوح الغرض من التبويب.

