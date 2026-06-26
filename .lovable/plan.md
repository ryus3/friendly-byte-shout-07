
# خطة معدّلة — استبعاد 149922682 (تسليم جزئي وليس off-channel)

## التصحيح المهم
- **149922682**: تسليم جزئي — الوسيط دفع المبلغ الحقيقي للجزء المُسلَّم. لا يحتاج تأكيد مالك ولا تصنيف خارج قناة. **يُعامَل كطلب عادي بإيراد موجب مساوٍ لما حوّله الوسيط فعلاً.**
- **149922672 فقط** هو الـoff-channel الحقيقي (الوسيط = 0، الموظف استلم 20 ألف خارج القناة).

---

## قاعدة دخول الإيرادات (نهائية)

كل سطر في `delivery_invoice_orders` ⇒ **حركة نقد منفصلة باسم الطلب**:

| الحالة | amount | حركة النقد |
|---|---|---|
| بيع عادي | موجب (يساوي ما حوّله الوسيط) | `+in`, `إيراد طلب <tracking>` |
| **تسليم جزئي** | موجب (المبلغ الفعلي للجزء المُسلَّم) | `+in`, `إيراد طلب <tracking>` — **عادي تماماً** |
| إرجاع | **سالب** (خسارة منتج+توصيل) | `−out`, `استرجاع طلب <tracking>` (سالب يَخصم من القاصة) |
| off-channel (amount = 0 والطلب فعلاً مُسلَّم) | 0 | **لا حركة** حتى يضغط المالك "استلمت" |
| استبدال | حسب صافي الفرق | بنفس المنطق |

> الطلب الأصلي لا يُمَسّ أبداً. الإرجاع يدخل بحركة سالبة مستقلة باسمه.

---

## التنفيذ (3 خطوات)

### 1) تنظيف فوري (insert)
- حذف الحركة الوهمية `+20,000` للطلب **149922672 فقط**.
- **149922682 يبقى كما هو** (حركته الحالية إذا تطابق مع المبلغ الفعلي المحوَّل صحيحة — سأتحقق من قيمة `delivery_invoice_orders.amount` له قبل اللمس وأصلّحها لتساوي الفعلي).
- إنشاء حركة `−25,000` للطلب **149776372** (`reference_type='order_return'`, `reference_id=order_id`, وصف `استرجاع طلب 149776372`).
- حذف سجل `off_channel_collections` للطلب 149922682 إن وُجد، وإبقاء سجل 149922672 بحالة `pending_classification`.
- إعادة احتساب `balance_before/balance_after` تراكمياً لقاصة "احمد" + تحديث `cash_sources.current_balance`.

### 2) Migration للقواعد الدائمة
أ. **Trigger على `delivery_invoice_orders`** عند استلام الفاتورة:
   - `amount > 0` ⇒ INSERT حركة `+in` باسم الطلب (تشمل التسليم الجزئي تلقائياً).
   - `amount < 0` ⇒ INSERT حركة `−out` بـ `reference_type='order_return'`.
   - `amount = 0` فقط ⇒ تشغيل `auto_detect_off_channel` (يستثني `order_type IN ('return','partial')`).

ب. **`auto_detect_off_channel`** — يُنشئ سجل `pending_classification` فقط عندما `amount = 0` والطلب مُسلَّم فعلياً وليس إرجاعاً/جزئياً.

ج. **Trigger إشعار المالك** عند `status='pending_owner_confirmation'` ⇒ INSERT في `notifications` (نوع `off_channel_pending_confirmation`, link=`/off-channel-inbox?id=…`).

د. **Trigger تأكيد المالك** عند UPDATE إلى `status='settled'` ⇒ INSERT تلقائي حركة `+in` في قاصة المالك بـ `owner_due_amount` (`reference_type='off_channel_receipt'`).

### 3) تعديلات الكود
- `OffChannelOwnerInbox.jsx` — إزالة الـINSERT اليدوي لـ cash_movement (انتقل للـtrigger في د)، فتح السجل من `?id=`.
- `NotificationsHandler.jsx` + `NotificationHandler.jsx` — معالجة `off_channel_pending_confirmation` والتوجيه لـ `/off-channel-inbox`.
- `Layout.jsx` / `BottomNav.jsx` — شارة عدد التحصيلات المعلّقة للمالك (Realtime على `off_channel_collections`).
- `InvoiceSpecialOrdersList.jsx` — زر "تصنيف الدفع" يظهر **فقط** لطلبات `amount = 0` وغير إرجاع/جزئي.
- `InvoiceProfitsTab.jsx` + `invoiceProfitsCalc.js` + `useUnifiedFinancialSystem.js` — مصدر وحيد هو `cash_movements`:
  - **مستلم فعلياً** = SUM(in) − SUM(out) من cash_movements المرتبطة بالفاتورة ⇒ يُحتسب في الربح.
  - **بانتظار تأكيد المالك** = SUM(owner_due_amount) من off_channel pending ⇒ معروض، **لا يدخل الربح** حتى التأكيد.
  - **متوقع** = مجموع `delivery_invoice_orders.amount`.

---

## النتيجة على فاتورة 3623484
```text
cash_movements بعد الإصلاح:
  + 20,000  149682878 (بيع أصلي)
  − 25,000  149776372 (إرجاع — جديدة)
  +  X      149922682 (تسليم جزئي — موجبة عادية)
  + ...     باقي 38 طلب
  ─────────
  = 950,000 ✅ مطابق لما حوّله الوسيط

off_channel pending (للمالك فقط):
  149922672 → 20,000 بانتظار "استلمت"
```

أبدأ بترتيب: (أ) تنظيف ⇒ (ب) migration ⇒ (ج) كود؟
