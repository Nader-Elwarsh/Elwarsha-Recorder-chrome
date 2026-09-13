# Work Order Lifecycle — Approved

## Main work-order statuses
- جديد
- جاري التنفيذ
- مكتمل
- ملغي

## Status transitions
- جديد -> جاري التنفيذ
- جديد -> ملغي
- جاري التنفيذ -> مكتمل
- جاري التنفيذ -> ملغي
- ملغي -> جديد (إعادة فتح)
- مكتمل -> جاري التنفيذ (إعادة فتح عند الحاجة)

Every status change must be recorded with date/time. Cancellation keeps the order and records its cancellation reason.
A new independent maintenance job creates a new work order; the old completed order is not reused.

## Workshop status
- غير مطلوب
- تم السحب
- تم التسليم

Priority is not used in the work-order flow.

Financial calculations are intentionally unchanged.
