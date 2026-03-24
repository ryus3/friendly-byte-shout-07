

# خطة إصلاح خطأ IndexedDB في offlineSync.js

## المشكلة المكتشفة

خطأ واحد فقط في الكونسول:

```
❌ Sync failed: DataError: Failed to execute 'getAll' on 'IDBIndex': The parameter is not a valid key.
```

**السبب:** في `src/utils/offlineSync.js` سطر 72:
```javascript
const request = index.getAll(false); // ❌ false ليس مفتاح صالح في IndexedDB
```

IndexedDB لا يقبل `false` كمفتاح بحث - المفاتيح الصالحة هي: string, number, Date, ArrayBuffer فقط. القيمة `false` (boolean) غير مدعومة.

## الحل

تعديل `getPendingOperations()` لاستخدام `IDBKeyRange.only(0)` بدلاً من `false`، **وأيضاً** تعديل `savePendingOperation()` لتخزين `synced` كرقم (`0`/`1`) بدلاً من `true`/`false`:

```javascript
// عند الحفظ
synced: 0  // بدلاً من false

// عند البحث
const request = index.getAll(IDBKeyRange.only(0)); // بدلاً من false
```

وتعديل `updateOperationStatus()` لاستخدام `1` بدلاً من `true`.

## الملف المتأثر

| الملف | التعديل |
|-------|---------|
| `src/utils/offlineSync.js` | تحويل قيم `synced` من boolean إلى رقم (0/1) |

## ملاحظة
- المعاينة تعمل بشكل طبيعي، هذا الخطأ لا يمنع التحميل لكنه يمنع مزامنة العمليات المعلقة offline
- لا توجد أخطاء بناء أخرى

