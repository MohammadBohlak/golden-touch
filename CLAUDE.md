# CLAUDE.md — اتفاقيات مشروع Golden Touch

نظام مواعيد داخلي لصالون حلاقة. Monorepo بـ npm workspaces: `apps/api` (NestJS + Prisma + Supabase PostgreSQL) و `apps/web` (Nuxt 4 + Pinia + Tailwind 4). الواجهة عربية RTL، ثيم فاتح فقط، Mobile-first (أغلب المستخدمين على الموبايل).

## قواعد صارمة

- **لا تنفّذ** `git add` أو `git commit` أو `git push`.
- **لا Docker** إطلاقاً. قاعدة البيانات على Supabase.
- بيئة التطوير Windows 11: السكربتات بلا أوامر bash فقط (استخدم `cross-env` أو Node).
- لا مكتبات UI جاهزة، ولا axios (استخدم `$api` المبني على ofetch). لا مكتبات تواريخ — استخدم `Intl` عبر الأدوات الموجودة.
- لا ثيم داكن.

## العقد بين الواجهة والـ API

- **Swagger هو العقد**: `http://localhost:4000/api/docs`. أنواع الواجهة في `apps/web/app/types/api.ts` يجب أن تطابقه.
- كل استدعاء API في الواجهة عبر `$api` (plugin) و `useApiState` للحالة (loading/error/data، إلغاء تلقائي، كاش اختياري). اعرض الحالات بـ `LoadingState` / `ErrorState` / `EmptyState`.
- شكل الأخطاء الموحّد: `{ statusCode, message, errors? }` برسائل عربية. حوّلها في الواجهة بـ `toApiError()` و `fieldErrors()` ثم `setErrors` في vee-validate.

## الـ Backend

- بنية حسب الوحدات `src/modules/<name>/` (controller + service + dto + module). المنطق النقي القابل للاختبار في ملفات منفصلة (`schedule.ts`، `stats.calc.ts`).
- الصلاحيات بصيغة `resource.action` (مثل `bookings.complete`) تُعرَّف في `prisma/seed.ts` وتُفرض بـ `@RequirePermissions(...)`. كل المسارات محمية افتراضياً إلا `@Public()`.
- رسائل class-validator بالعربية دائماً.
- **منع تداخل الحجوزات**: فحص في `BookingsService.assertNoOverlap` + قيد `bookings_no_overlap` (EXCLUDE gist) في migration الأولى. الحالة `CANCELLED` لا تحجز الوقت. لا تحذف القيد.
- الأوقات UTC في القاعدة؛ "اليوم" وساعات الدوام بتوقيت `ShopSettings.timezone` عبر `common/utils/time.ts`.
- المبالغ أعداد صحيحة بالليرة السورية. الحجز يحفظ لقطة من الخدمة (`serviceName`, `price`, `durationMinutes`).
- الخدمات المرتبطة بحجوزات تُؤرشف (`archivedAt`) ولا تُحذف.

## الواجهة

- **خصائص RTL المنطقية فقط**: `ms-/me-/ps-/pe-/start-/end-/text-start/border-s`. لا `ml/mr/left/right`.
- الأيقونات من `AppIcon` (`app/utils/icons.ts`)؛ اكتب الأيقونات الاتجاهية بمعناها في LTR (السابق = `chevron-left`) وستُعكس تلقائياً.
- الألوان من الأسماء الدلالية في `assets/css/main.css` (`canvas`, `surface`, `fg`, `fg-muted`, `line`, `gold-*`, `ink-*`) — لا قيم hex داخل المكوّنات.
- كل مكوّن UI يقبل `class` ويدمجها عبر `cn()`.
- **حالة الحوارات محلية في الصفحة** وليست في الـ store.
- النماذج: vee-validate + yup، مع `FormField` (يعرض الخطأ بعد اللمس). الحقول الرقمية/المالية تقبل الأرقام العربية (`parseInteger`).
- الصفحات تعلن صلاحيتها بـ `definePageMeta({ permission })`؛ القوائم من `config/navigation.ts`؛ الأزرار بـ `v-perm` أو `usePermission().has`.
- أهداف اللمس ≥ 44px، حقول بارتفاع 48px ونص 16px (يمنع تكبير iOS).

## النشر

- Render (الخطة المجانية) عبر `render.yaml`: خدمة واحدة يشغّلها `scripts/start-prod.mjs` (الواجهة على PORT العام، الـ API داخلياً على API_PORT).
- `KeepAliveService` يطلب `/api/health` عبر الرابط العام كل 10 دقائق لمنع إطفاء الخادم — لا تحذفه ولا تجعل `/api/health` محمياً أو خاضعاً للـ throttling.
- `build.transpile: ['pinia']` في nuxt.config ضروري: بدونه يُنتج بناء الإنتاج نسختين من Pinia (خطأ 500).

## الفحص قبل التسليم

```
npm run lint && npm run typecheck && npm test && npm run build
```
