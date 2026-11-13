# خطة تذكيرات واتساب — Golden Touch

**الهدف:** رسالة واتساب تلقائية للزبون قبل موعده بـ 15 دقيقة (قابلة للتعديل)، مجانية وبلا حد تقني، عبر ربط رقم واتساب الصالون بالخادم كـ«جهاز مرتبط» (QR أو رمز ربط).

**المنفّذ:** Claude Code. **طريقة العمل:** 7 مراحل. نفّذ مرحلة واحدة كاملة، شغّل الفحص، حدّث «سجل التقدّم» أسفل الملف، **ثم توقّف** وانتظر الأمر بالبدء بالتالية. لا `git add/commit/push`. اقرأ `CLAUDE.md` في الجذر قبل أي مرحلة؛ قواعده (RTL، الألوان الدلالية، الحركة، التباين، رسائل عربية) سارية هنا دون تكرارها.

---

## 1. نتيجة دراسة الجدوى

**ممكن.** القرارات المحسومة (لا تُعِد فتحها):

| القرار             | الاختيار                                                                                    | السبب                                                                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| المكتبة            | **Baileys** (حزمة npm `baileys`)                                                            | تتصل ببروتوكول WhatsApp Web عبر WebSocket مباشرة بلا متصفح. `whatsapp-web.js` تحتاج Chromium (300MB+) ولا تتسع لها ذاكرة خطة Render المجانية مع Nuxt و NestJS.                   |
| حفظ الجلسة         | جدول في Supabase (لا ملفات)                                                                 | نظام ملفات Render المجاني مؤقت يُمسح عند كل إعادة تشغيل/نشر؛ بدون ذلك يلزم مسح QR بعد كل نشر.                                                                                    |
| الجدولة            | حلقة `setInterval` كل 60 ثانية تستعلم القاعدة (نفس نمط `KeepAliveService`)                  | لا مكتبة إضافية، وتتدارك ما فات تلقائياً بعد إعادة التشغيل.                                                                                                                      |
| منع الإرسال المكرر | «حجز» ذرّي للحجز في القاعدة (`updateMany ... WHERE reminderStatus = 'PENDING'`) قبل الإرسال | إرسال مرة واحدة على الأكثر حتى مع تداخل نسختين.                                                                                                                                  |
| نسخة واحدة متصلة   | «إيجار» (lease) بصف في القاعدة يُجدَّد كل 30ث                                               | أثناء النشر على Render تعمل النسخة القديمة والجديدة معاً لثوانٍ؛ جلستان بنفس البيانات تطرد إحداهما الأخرى. أقفال Postgres الاستشارية لا تعمل موثوقاً عبر مجمّع اتصالات Supabase. |
| QR على الموبايل    | QR **و** «رمز ربط برقم الهاتف» (pairing code)                                               | أغلب المستخدمين على الموبايل، ولا يمكن مسح QR معروض على شاشة الهاتف نفسه.                                                                                                        |

**المخاطر (يجب أن يعرفها صاحب الصالون — تُعرض في صفحة الربط باختصار):**

1. **غير رسمي:** الربط بمكتبة غير رسمية مخالف لشروط واتساب، وقد يُحظر الرقم. التخفيف: رقم مخصص للصالون (يفضّل WhatsApp Business) لا الرقم الشخصي، حجم إرسال صغير، فواصل عشوائية، عدم الإرسال لأرقام غير موجودة على واتساب، حد يومي.
2. **«بلا حد» تقنياً فقط:** لا رسوم ولا سقف من المكتبة، لكن الإرسال الكثيف يرفع خطر الحظر. حجم صالون (عشرات الرسائل يومياً) ضمن الآمن عملياً.
3. **الهاتف الأساسي:** الأجهزة المرتبطة تُفصل إن لم يُفتح واتساب على الهاتف قرابة 14 يوماً.
4. **صيانة:** تغييرات واتساب في البروتوكول تتطلب أحياناً تحديث نسخة Baileys.
5. البديل الرسمي (WhatsApp Cloud API) يتقاضى رسوماً على رسائل القوالب (التذكير منها) ويتطلب توثيق نشاط تجاري لدى Meta؛ لذا لا يحقق شرط «مجاني بالكامل».

**الفشل آمن:** أي عطل في واتساب لا يمس الحجوزات ولا `/api/health` ولا `KeepAliveService`.

---

## 2. المعمارية

```
apps/api/src/modules/whatsapp/
  whatsapp.transport.ts      واجهة WhatsAppTransport (لا تستورد baileys)
  baileys.transport.ts       التنفيذ الوحيد الذي يستورد baileys (import ديناميكي)
  prisma-auth-state.ts       حفظ مفاتيح الجلسة في جدول whatsapp_auth
  whatsapp-lease.ts          منطق الإيجار (نقي قدر الإمكان)
  whatsapp.service.ts        دورة الحياة: إيجار ← اتصال ← إعادة اتصال ← حالة
  whatsapp.controller.ts     الحالة / ربط / رمز ربط / فصل / رسالة تجربة
  reminder.calc.ts           منطق نقي: الاستحقاق، القالب، رقم JID
  reminders.service.ts       الحلقة الدورية + طابور الإرسال
  dto/ + *.spec.ts
```

**قواعد معمارية (تُضاف إلى CLAUDE.md في المرحلة 7):**

- `baileys` يُستورد **فقط** في `baileys.transport.ts`، وبـ `await import('baileys')`. بقية الكود والاختبارات تتعامل مع `WhatsAppTransport`. (الـ API يُترجَم CommonJS و Jest يعمل بـ ts-jest؛ Baileys v7 حزمة ESM.)
- لا تعتمد على ذاكرتك في واجهات Baileys: **اقرأ أنواع النسخة المثبتة** في `node_modules/baileys/lib/**/*.d.ts` وكود `useMultiFileAuthState` فيها، فالواجهات تغيّرت بين الإصدارات (مثل عناوين LID في v7).
- `WHATSAPP_ENABLED` (افتراضياً `false`): محلياً لا يتصل الخادم بواتساب إلا إن فُعّل صراحة، كي لا تتنافس بيئة التطوير مع الإنتاج على الجلسة نفسها.

---

## 3. المراحل

### المرحلة 1 — قاعدة البيانات والمنطق النقي (بلا Baileys)

**المخرجات:**

1. **Prisma migration** (`npm run db:migrate:dev -- --create-only --name whatsapp_reminders`، ثم راجع الـ SQL يدوياً قبل التطبيق — **يجب ألا يحذف قيد `bookings_no_overlap` ولا امتداد `btree_gist`**):
   - `enum ReminderStatus { PENDING SENDING SENT FAILED SKIPPED }`.
   - في `Booking`: `reminderStatus ReminderStatus @default(PENDING)`، `reminderSentAt DateTime? @db.Timestamptz(3)`، `reminderAttempts Int @default(0)`، `reminderError String?` (رمز سبب قصير مثل `NO_PHONE`, `NO_WHATSAPP`, `OPTED_OUT`, `CREATED_LATE`, `MISSED`, `SEND_ERROR`, `UNKNOWN`)، و`@@index([reminderStatus, startAt])`.
   - داخل الـ migration: `UPDATE bookings SET "reminderStatus" = 'SKIPPED', "reminderError" = 'MISSED' WHERE "startAt" < now() OR status <> 'ACTIVE';` حتى لا تُعتبر الحجوزات القديمة معلّقة.
   - في `Customer`: `whatsappReminders Boolean @default(true)`.
   - في `ShopSettings`: `remindersEnabled Boolean @default(false)`، `reminderMinutesBefore Int @default(15)`، `reminderTemplate String @default("…")`، `phoneCountryCode String @default("963")`.
   - `model WhatsAppAuth { key String @id; value String; updatedAt @updatedAt }` ← `@@map("whatsapp_auth")` (القيمة نص JSON مسلسَل، لا `Json`، للحفاظ على Buffers).
   - `model WhatsAppSession { id Int @id @default(1); ownerId String?; leaseUntil DateTime? @db.Timestamptz(3); phone String?; name String?; updatedAt }` ← `@@map("whatsapp_session")`.
2. **الصلاحية** `whatsapp.manage` («إدارة ربط واتساب والتذكيرات») في `prisma/seed.ts` — للمدير فقط (ليست في `STAFF_PERMISSIONS`).
3. **`common/utils/phone.ts`**: `toInternationalPhone(phone, countryCode)` (نقل منطق `apps/web/app/utils/format.ts` حرفياً: `+` و`00` و`0` البادئة) و`toWhatsAppJid(phone, countryCode)` ← `"9639xxxxxxxx@s.whatsapp.net"` أو `null` لرقم غير صالح (أقل من 8 أرقام أو أكثر من 15). مع اختبارات `phone.spec.ts`.
4. **`modules/whatsapp/reminder.calc.ts`** (نقي) مع `reminder.calc.spec.ts`:
   - `REMINDER_PLACEHOLDERS = ['الاسم', 'الوقت', 'الخدمة', 'الصالون']`، `renderReminder(template, { name, time, service, shop })` يستبدل `{الاسم}` إلخ، و`unknownPlaceholders(template)` للتحقق.
   - القالب الافتراضي: `مرحباً {الاسم}،\nنذكّرك بموعدك في {الصالون} اليوم الساعة {الوقت} ({الخدمة}).`
   - **توافق مع الحجوزات الدورية** (`docs/RECURRING_BOOKINGS_PLAN.md` D14): تُولَّد حجوزاتها قبل أسابيع بحالة تذكير `PENDING` الافتراضية فلا يصيبها `CREATED_LATE` (أُنشئت قبل نافذة التذكير بكثير)، وتعديل السلسلة يعيد إنشاء مواعيد جديدة بحالة `PENDING`؛ لا تغيير مطلوب في منطق التذكير.
   - **لا يُضاف عنصر `{السعر}` ولا أي مبلغ إلى `REMINDER_PLACEHOLDERS` أبداً**: التذكير يُرسَل للزبون، ويُعدَّل قالبه من إعدادات قد يصل إليها مشرف لا يرى المال (قرار `docs/STAFF_RESTRICTIONS_PLAN.md`).
   - `reminderDecision(booking, now, settings)` ← `'WAIT' | 'SEND' | { skip: reason }`:
     - `SEND` إن `startAt - minutesBefore <= now < startAt - 2min`.
     - `skip CREATED_LATE` إن أُنشئ الحجز بعد بداية نافذة التذكير (زبون حاضر أو اتصل للتو).
     - `skip MISSED` إن `now >= startAt - 2min` والحالة ما زالت `PENDING`.
     - `skip NO_PHONE` / `OPTED_OUT` / `NO_WHATSAPP` (الأخير من الناقل لاحقاً).
     - اختبر حدود النافذة بدقة (قبلها بثانية، عندها، آخرها)، وتغيّر التوقيت الصيفي لا يؤثر لأن الحساب بلحظات UTC.
5. **`BookingsService`**: عند تغيّر `startAt` أو الزبون في `update()`، وعند `reopen()`: أعد `reminderStatus = PENDING`, `reminderAttempts = 0`, `reminderError = null`, `reminderSentAt = null`. أي تعديل آخر (ملاحظات، سعر) لا يمسّ حقول التذكير.
6. **الإعدادات:** حقول جديدة في `UpdateSettingsDto` برسائل عربية: `remindersEnabled` (Boolean)، `reminderMinutesBefore` (`IsIn([5,10,15,20,30,60])`)، `reminderTemplate` (1–500 حرف، وارفض العناصر المجهولة بـ `errors.reminderTemplate`)، `phoneCountryCode` (`^\d{1,4}$`). وحدّثها في `SettingsService.update`.
7. **أنواع الواجهة** في `apps/web/app/types/api.ts`: `ShopSettings`, `Booking`, `Customer` لتطابق Swagger.

**لا تفعل في هذه المرحلة:** تثبيت أي حزمة، أو أي واجهة رسومية.

**القبول:** الفحص الكامل يمر؛ اختبارات جديدة للهاتف والاستحقاق والقالب؛ Swagger يعرض الحقول الجديدة.

---

### المرحلة 2 — الاتصال بواتساب (الناقل + الجلسة في القاعدة)

**الخطوة الأولى (تجربة إثبات، قبل أي كود آخر):**

1. ثبّت **نسخة محددة بلا `^`**: `npm i baileys@<آخر نسخة مستقرة> qrcode -w @golden-touch/api` و`npm i -D @types/qrcode -w @golden-touch/api`. لا تثبّت الإضافات الاختيارية (`sharp`, `jimp`, `link-preview-js`).
2. تحقق أن `import('baileys')` الديناميكي يعمل في `npm run start:dev -w @golden-touch/api` **وفي** `node dist/main.js` بعد `nest build`، وأن `npm test` لا يتأثر. استيراد الأنواع من ملف CommonJS يحتاج غالباً: `import type { WASocket } from 'baileys' with { 'resolution-mode': 'import' }`.
3. تحقق أن `npm ci` من الصفر ينجح (Baileys قد يعتمد على حزمة من GitHub).
4. إن فشل أي مما سبق: توقّف واكتب السبب في سجل التقدّم ولا تلتفّ عليه بحل مرتجل.

**المخرجات:**

1. **`whatsapp.transport.ts`** — واجهة مستقلة عن المكتبة:
   ```ts
   type WaState =
     'DISABLED' | 'IDLE' | 'CONNECTING' | 'QR' | 'CONNECTED' | 'LOGGED_OUT' | 'STANDBY' | 'ERROR'
   interface WhatsAppTransport {
     start(handlers: {
       onQr(qr: string): void
       onOpen(me: { phone: string; name?: string }): void
       onClose(reason: 'LOGGED_OUT' | 'REPLACED' | 'RECONNECT' | 'FATAL', detail?: string): void
     }): Promise<void>
     requestPairingCode(phoneDigits: string): Promise<string>
     sendText(jid: string, text: string): Promise<{ id: string }>
     isOnWhatsApp(jid: string): Promise<boolean>
     stop(): Promise<void> // يغلق المقبس دون تسجيل خروج
     logout(): Promise<void> // يفصل الجهاز المرتبط فعلياً
   }
   ```
   مع رمز حقن (`WHATSAPP_TRANSPORT`) كي تستبدله الاختبارات بنسخة وهمية.
2. **`prisma-auth-state.ts`** — مكافئ `useMultiFileAuthState` لكن على جدول `whatsapp_auth`: انسخ منطق النسخة المثبتة (المفاتيح `creds` و`<type>-<id>`، التسلسل بـ `BufferJSON.replacer/reviver`، معالجة `app-state-sync-key` عبر `proto…fromObject`). الكتابات الجماعية في `$transaction` واحدة (upsert للقيم، delete لـ `null`). غلّف المفاتيح بـ `makeCacheableSignalKeyStore` لتقليل الاستعلامات. دالة `clearAuthState()` تحذف كل الصفوف.
3. **`baileys.transport.ts`**: `makeWASocket` بخيارات خفيفة: `syncFullHistory: false`, `markOnlineOnConnect: false`, `shouldSyncHistoryMessage: () => false`, `generateHighQualityLinkPreview: false`, `getMessage: async () => undefined`، ونسخة الويب من `fetchLatestBaileysVersion()` (مع بديل إن فشلت). لا مخزن ذاكرة للرسائل. Logger: محوّل صغير بواجهة pino المطلوبة يمرّر `warn/error` فقط إلى `Logger` من Nest. حوّل `DisconnectReason` إلى `onClose`: `loggedOut` ← `LOGGED_OUT`، `connectionReplaced` ← `REPLACED`، `restartRequired`/انقطاع شبكة ← `RECONNECT`.
4. **`whatsapp.service.ts`** (`OnApplicationBootstrap`/`OnModuleDestroy`):
   - إن `WHATSAPP_ENABLED !== 'true'` ← الحالة `DISABLED` ولا شيء آخر.
   - عند الإقلاع: إن وُجدت `creds` في القاعدة ← اتصال تلقائي (بعد الإيجار — المرحلة 3). إن لم توجد ← `IDLE` حتى يطلب المدير الربط.
   - إعادة الاتصال بتراجع أُسّي (2ث ← 4 ← … حتى 5 دقائق) لـ `RECONNECT`. عند `LOGGED_OUT`: `clearAuthState()` والحالة `LOGGED_OUT` بلا إعادة محاولة. عند `REPLACED`: لا إعادة اتصال فوري (نسخة أخرى تملك الجلسة).
   - يحتفظ بآخر QR (يُحوَّل إلى data URL بـ `qrcode` عند الطلب فقط) وآخر خطأ ورقم الحساب المتصل.
   - `onModuleDestroy`: `transport.stop()` (ليس `logout`). `enableShutdownHooks` مفعّل أصلاً في `setup-app.ts`.
5. `AppConfig.whatsappEnabled` + المتغير في `env.validation.ts` (`Joi.boolean().default(false)`).
6. اختبارات `prisma-auth-state.spec.ts` (تسلسل/استرجاع Buffers بلا قاعدة: اعزل دالتي serialize/deserialize) و`whatsapp.service.spec.ts` (ناقل وهمي: تراجع، logout يمسح الجلسة، DISABLED لا يتصل).

**تحقق يدوي (يُطلب من المستخدم، لا تدّعِ تنفيذه):** `WHATSAPP_ENABLED=true` محلياً على قاعدة تطوير، طباعة QR مؤقتاً في السجل، الربط، إعادة تشغيل الخادم والتأكد من الاتصال دون مسح جديد. سجّل `process.memoryUsage().rss` بعد الاتصال في سجل التقدّم.

**القبول:** الفحص يمر؛ لا ملف خارج `baileys.transport.ts` يستورد `baileys`؛ `grep -r "from 'baileys'" apps/api/src` يعيد ملفاً واحداً (أو صفراً مع الاستيراد الديناميكي + `import type`).

---

### المرحلة 3 — الإيجار ونقاط الـ API

**المخرجات:**

1. **`whatsapp-lease.ts`**: `ownerId = randomUUID()` لكل عملية. الاستحواذ: `updateMany({ where: { id: 1, OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }, { ownerId }] }, data: { ownerId, leaseUntil: now + 90s } })` (مع `upsert` للصف إن لم يوجد) — النجاح = `count === 1`. التجديد كل 30ث؛ إن فشل التجديد ← `transport.stop()` والحالة `STANDBY`. غير المالك يحاول كل 30ث. عند الإغلاق: `leaseUntil = now` إن كنت المالك. اختبر منطق القرار كدالة نقية.
2. **`whatsapp.controller.ts`** — كلها `@RequirePermissions('whatsapp.manage')`، وأوصاف Swagger عربية، و DTOs برسائل عربية:
   - `GET /whatsapp/status` ← `{ enabled, state, phone, name, qr: string | null (data URL), lastError, sentToday }`.
   - `POST /whatsapp/connect` ← يبدأ الاتصال لإنتاج QR (409 إن كان متصلاً، 503 برسالة عربية إن كان `DISABLED` أو `STANDBY`).
   - `POST /whatsapp/pairing-code` `{ phone }` ← `{ code }` (الرقم يُطبَّع بـ `toInternationalPhone` من إعدادات رمز الدولة).
   - `POST /whatsapp/logout` ← يفصل ويمسح الجلسة.
   - `POST /whatsapp/test` `{ phone }` ← يرسل رسالة تجربة قصيرة (409 إن لم يكن متصلاً، 422 `NO_WHATSAPP` إن لم يكن الرقم على واتساب).
   - اضبط throttling: مسار الحالة يُستطلع كل 3ث (20/دقيقة) — ضمن الحد العام؛ ضع `@Throttle` أشد على `pairing-code` و`test` (5/دقيقة).
3. لا تجعل `/api/health` يعتمد على واتساب. يمكن إضافة `whatsapp: state` إليه كمعلومة فقط إن لم يغيّر رمز الاستجابة أبداً.

**القبول:** الفحص يمر؛ Swagger يعرض المسارات تحت وسم `whatsapp`؛ نسختان محلياً على نفس القاعدة (منفذان مختلفان) ← واحدة فقط تتصل والأخرى `STANDBY`، وإيقاف الأولى يجعل الثانية تتصل خلال ~90ث.

---

### المرحلة 4 — محرّك التذكيرات

**المخرجات — `reminders.service.ts`:**

1. حلقة كل 60ث (لا تعمل إن `DISABLED`، وتتخطى الإرسال إن لم يكن الاتصال `CONNECTED` أو الإيجار ليس لهذه النسخة، أو `remindersEnabled = false`). أول دورة بعد 15ث من الإقلاع.
2. كل دورة:
   - اجلب `ACTIVE` + `PENDING` + `startAt` بين `now - 1 يوم` و`now + minutesBefore + 1 دقيقة`، مع الزبون (`take: 50`، ترتيب `startAt`).
   - طبّق `reminderDecision`. `skip` ← حدّث الحالة `SKIPPED` مع السبب.
   - `SEND` ← احجز ذرياً: `updateMany({ where: { id, reminderStatus: 'PENDING' }, data: { reminderStatus: 'SENDING', reminderAttempts: { increment: 1 } } })`؛ إن `count === 0` تخطَّ.
   - أدخله طابوراً **تسلسلياً**: فاصل عشوائي 4–10ث بين الرسائل؛ `isOnWhatsApp` قبل الإرسال (لا ← `SKIPPED NO_WHATSAPP`)؛ نص من `renderReminder` بالوقت عبر `formatTime` الموجود وبتوقيت الصالون.
   - نجاح ← `SENT` + `reminderSentAt`. فشل ← إن `reminderAttempts < 3` والنافذة ما زالت مفتوحة ← `PENDING` مع `reminderError = 'SEND_ERROR'`، وإلا `FAILED`.
   - صفوف `SENDING` أقدم من 5 دقائق (توقف أثناء الإرسال) ← `FAILED UNKNOWN` **دون** إعادة إرسال (مرة واحدة على الأكثر أهم من التكرار).
   - قبل كل إرسال أعد التحقق أن الحجز ما زال `ACTIVE` وبنفس `startAt` (قد يُلغى أثناء الانتظار في الطابور).
3. **حد يومي** `WHATSAPP_DAILY_LIMIT` (افتراضياً 150) بتوقيت الصالون؛ عند بلوغه ← تسجيل تحذير والتوقف حتى الغد (الحجوزات تبقى `PENDING` ثم تُصنَّف `MISSED`).
4. **إرسال يدوي:** `POST /bookings/:id/remind` بصلاحية `bookings.update` — يتجاوز نافذة الوقت لا الحالة (`ACTIVE` فقط)، ويمر عبر نفس الطابور، ويعيد الحجز المحدّث.
5. سطر سجل واحد لكل إرسال: `Reminder sent booking=<id> in <ms>ms` — **لا** تكتب رقم الهاتف أو نص الرسالة في السجلات.
6. اختبارات `reminders.service.spec.ts` بناقل وهمي و Prisma مقلّد (أو اعزل المنطق في دوال نقية): لا إرسال مزدوج عند دورتين متداخلتين، الإلغاء أثناء الطابور، الحد اليومي، المحاولات الثلاث، المهلة لـ `SENDING`.

**القبول:** الفحص يمر؛ تجربة يدوية: حجز بعد 17 دقيقة لرقم تجربة ← رسالة بعد دقيقتين تقريباً، والحجز يظهر `SENT` في Swagger.

---

### المرحلة 5 — الواجهة: صفحة واتساب

**المخرجات:**

1. صفحة `pages/whatsapp.vue` بـ `definePageMeta({ title: 'واتساب', permission: 'whatsapp.manage' })`، وعنصر في `config/navigation.ts` (`placement: ['sidebar', 'more']`، وصف: «الربط وتذكيرات المواعيد»). أضف أيقونة مناسبة في `utils/icons.ts` إن لم توجد.
2. **قسم الاتصال** — حالة واحدة معروضة بـ `FadeTransition` (فرع بجذر واحد و`key` لكل حالة):
   - `DISABLED`: «الخدمة غير مفعّلة على الخادم».
   - `IDLE` / `LOGGED_OUT`: زر «ربط رقم الصالون».
   - `QR`: صورة QR (خلفية بيضاء وهامش، ≥ 240px، `alt` وصفي) + بديل ظاهر **«الربط برقم الهاتف»** (حقل رقم ← يعرض الرمز بخط كبير أحادي المسافة قابل للنسخ). خطوات مرقّمة قصيرة: واتساب ← الأجهزة المرتبطة ← ربط جهاز.
   - `CONNECTED`: الرقم والاسم + «إرسال رسالة تجربة» + «فصل الربط» (عبر `useConfirm`).
   - `STANDBY` / `ERROR`: نص الحالة + آخر خطأ.
   - استطلاع `GET /whatsapp/status` كل 3ث فقط في `CONNECTING`/`QR` وكل 30ث غير ذلك؛ يتوقف عند `document.hidden` وعند مغادرة الصفحة. استعمل `refreshing` من `useApiState` كي لا يومض المحتوى.
3. **قسم التذكيرات** (نموذج vee-validate + yup، يحفظ عبر `PATCH /settings`): `AppSwitch` للتفعيل، `AppSelect` للمدة (5/10/15/20/30/60 دقيقة)، `AppTextarea` للقالب مع أزرار إدراج العناصر (`{الاسم}`…) ومعاينة حية بأسماء تجريبية، وحقل رمز الدولة. أخطاء الخادم ← `fieldErrors()` ← `setErrors`.
4. ملاحظة المخاطر (نقطتان أو ثلاث، نص رسمي قصير): رقم مخصص للصالون، وفتح واتساب على الهاتف دورياً.
5. الالتزام: تباين ≥ 7:1 للنصوص الصغيرة و ≥ 4.5:1 للنص الأبيض على الأزرار (احسبه)، الحالة بنص وأيقونة لا باللون وحده، أهداف لمس ≥ 44px، حقول 48px ونص 16px، خصائص RTL المنطقية فقط، الحركة عبر المكوّنات الموجودة.

**القبول:** الفحص يمر؛ تجربة يدوية على عرض موبايل (375px) لكل الحالات.

---

### المرحلة 6 — الواجهة: الحالة في الحجوزات والزبائن

**المخرجات:**

1. مؤشر حالة التذكير في `BookingSheet.vue` (وفي `BookingCard.vue` بشكل مختصر: أيقونة + وقت فقط) — أيقونة + نص:
   - `SENT`: «أُرسل التذكير · 10:45».
   - `PENDING` مع رقم هاتف وتذكيرات مفعّلة: «سيُرسل التذكير · 10:45».
   - `FAILED` / `SKIPPED` (الأسباب ذات المعنى فقط: `NO_WHATSAPP`, `NO_PHONE`, `OPTED_OUT`, `FAILED`): نص السبب بالعربية. لا تعرض `CREATED_LATE`/`MISSED` (ضجيج).
   - ضع خريطة الأسباب ← النصوص في `utils/` مع اختبار في `apps/web/tests/`.
2. زر «إرسال تذكير الآن» في `BookingSheet` (بـ `v-perm="'bookings.update'"`، يظهر فقط لحجز `ACTIVE` لزبون له هاتف وعندما واتساب متصل) ← `POST /bookings/:id/remind`، وتوست بالنتيجة.
3. `CustomerFormDialog.vue`: `AppSwitch` «تذكيرات واتساب» (`whatsappReminders`)، مع تحديث DTOs الزبون في الـ API (`customers/dto`) برسائل عربية.
4. أي ظهور/اختفاء للمؤشر أو الزر عبر `ExpandTransition`/`FadeTransition`.

**القبول:** الفحص يمر؛ الحالات تظهر صحيحة بعد إرسال تجريبي وبعد تعديل موعد الحجز (تعود «سيُرسل»).

---

### المرحلة 7 — النشر والتوثيق والتدقيق

**المخرجات:**

1. `render.yaml`: `WHATSAPP_ENABLED: 'true'`، `WHATSAPP_DAILY_LIMIT: '150'` مع تعليق عربي قصير.
2. سطر ذاكرة: أضف `rss=<MB>` إلى سطر نجاح `KeepAliveService` الموجود (دون تغيير سلوكه أو اختباراته إلا بالحد الأدنى) لمراقبة الذاكرة على Render.
3. `docs/WHATSAPP.md` (دليل تشغيل قصير بالعربية): الربط لأول مرة، ما يحدث عند النشر (إعادة اتصال تلقائية حتى ~90ث)، الفصل وإعادة الربط، المهلة 14 يوماً، ماذا تفعل إن حُظر الرقم، كيفية تحديث Baileys (نسخة محددة + تجربة محلية قبل النشر).
4. `CLAUDE.md`: قسم «واتساب» بالقواعد المعمارية في §2 هنا + «لا تُرسل أكثر من مرة: الحجز الذري قبل الإرسال» + «لا أرقام هواتف أو نصوص رسائل في السجلات».
5. تدقيق ذاتي: `grep` لاستيرادات `baileys`، أي `console.log`، أي hex في المكوّنات، أي `ml-/mr-/left/right`، أي مدد حركة خام؛ مراجعة كل الرسائل العربية.

**القبول:** `npm run lint && npm run typecheck && npm test && npm run build` يمر، و`npm ci` من الصفر يمر.

---

## 4. بروتوكول كل مرحلة

1. اقرأ هذا الملف و`CLAUDE.md` والملفات التي ستعدّلها كاملة قبل البدء.
2. نفّذ مخرجات المرحلة فقط — لا تسبق المراحل التالية ولا توسّع النطاق.
3. شغّل: `npm run lint && npm run typecheck && npm test && npm run build`. أصلح كل فشل؛ لا تعطّل قواعد lint ولا تتخطَّ اختبارات.
4. ما يحتاج رقم واتساب حقيقياً أو Render: اكتبه في سجل التقدّم كـ«تحقق يدوي مطلوب» بخطوات واضحة للمستخدم — **لا تدّعِ أنه نُفّذ**.
5. حدّث «سجل التقدّم» أدناه: ما نُفّذ، الملفات، نتائج الفحص، أي انحراف عن الخطة وسببه.
6. توقّف وانتظر الأمر بالمرحلة التالية.

---

## 5. سجل التقدّم

| المرحلة                         | الحالة  | ملاحظات |
| ------------------------------- | ------- | ------- |
| 1 — القاعدة والمنطق النقي       | لم تبدأ |         |
| 2 — الناقل والجلسة              | لم تبدأ |         |
| 3 — الإيجار ونقاط الـ API       | لم تبدأ |         |
| 4 — محرّك التذكيرات             | لم تبدأ |         |
| 5 — صفحة واتساب                 | لم تبدأ |         |
| 6 — الحالة في الحجوزات والزبائن | لم تبدأ |         |
| 7 — النشر والتوثيق              | لم تبدأ |         |
