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
- **زر الرجوع (موبايل):** كل حوار/ورقة/تراكب يمرّ عبر `AppModal` فقط (لا حوارات مخصّصة) — فيصير تلقائياً طبقة في سجل المتصفح (`utils/back-stack.ts`): الرجوع يغلقه ولا يغادر الصفحة، وبالرجوع من أول صفحة يظهر `ExitConfirmDialog`. أي تراكب جديد خارج `AppModal` يجب أن يستعمل `openBackLayer()` ويستدعي `release()` عند إغلاقه. لا تلمس `history.pushState/back` يدوياً، والتنقل البرمجي (`navigateTo`) آمن أثناء وجود حوارات (الحارس `prepareNavigation`). اختبار: `tests/back-stack.test.ts`.
- النماذج: vee-validate + yup، مع `FormField` (يعرض الخطأ بعد اللمس). الحقول الرقمية/المالية تقبل الأرقام العربية (`parseInteger`).
- الصفحات تعلن صلاحيتها بـ `definePageMeta({ permission })`؛ القوائم من `config/navigation.ts`؛ الأزرار بـ `v-perm` أو `usePermission().has`.
- أهداف اللمس ≥ 44px، حقول بارتفاع 48px ونص 16px (يمنع تكبير iOS).

## الحركة (Motion)

كل انتقال وظهور/اختفاء وإجراء في الواجهة بحركة سلسة. الخطة والسجل في `docs/MOTION_PLAN.md`. بلا مكتبات: CSS + `<Transition>` + WAAPI.

- **الرموز:** مدد ومنحنيات في `main.css` (`--motion-*`, `--ease-*`) ومرآتها في `app/utils/motion.ts` (`MOTION`, `EASING`) — يتحقق `tests/motion.test.ts` من تطابقهما. الخروج ≈ 65% من الدخول. لا مدد خام (`duration-200`): استعمل `duration-(--motion-base)`.
- **لا تبديل عارٍ:** أي `v-if`/`v-else` يتغيّر أثناء ظهور العنصر يُغلَّف بأحد:
  - `ExpandTransition` — عنصر `v-if` (ارتفاع/عرض + تعويض `gap` الأب). أول خيار لرسائل الخطأ والتلميحات والشرائط.
  - `Collapse` — قسم دائم الحضور يُفتح ويُطوى (`inert` عند الإغلاق). الهوامش داخله لا عليه.
  - `FadeTransition` — تبديل حالات (تحميل ⇄ محتوى ⇄ خطأ ⇄ فراغ): فرع بجذر واحد و`key`، **وبلا تعليقات HTML بين الفروع**.
  - `ListTransition` — قوائم: FLIP وتثبيت العنصر المغادر. الحاوية `relative`. للصفوف `<tr>`: `:pin="false"`.
  - `AutoHeight` — تبدّل محتوى دفعة واحدة (أوضاع). `Disclosure` بدل `<details>`.
  - ما كان ثابتاً طوال عمر النسخة (صلاحيات، slots، props) لا يحتاج غلافاً.
- **SSR:** لا تضع `ListTransition` (أو أي غلاف حول `TransitionGroup`) فيما يُرسم على الخادم — يحدث hydration mismatch؛ استعمل `TransitionGroup` مباشرة مع `pinElement` (انظر `ToastViewport`). لا `appear` على محتوى يصل مع الصفحة؛ يُستخدم فقط لما يصل بعد التركيب.
- **الصفحات:** الاتجاه من عمق المسار (`utils/route-motion.ts`)؛ الإزاحة تُضرب في `--dir-end` (RTL) و`--motion-distance`. جذر كل صفحة/تخطيط عنصر واحد بلا تعليقات.
- **تقليل الحركة:** تبقى تلاشيات قصيرة بلا إزاحة. أي حركة برمجية تتحقق من `prefersReducedMotion()`، وأي `scrollIntoView` يمرّر `behavior` حسبه.
- **الأداء:** حرّك `transform`/`opacity` فقط؛ لا `transition-all`؛ لا `will-change` دائم. الارتفاع/العرض عبر المكوّنات أعلاه حصراً.
- **تحديث بعد جلب:** `useApiState` يعرض `refreshing`؛ اعتّم المحتوى بـ `loading && !refreshing` فقط كي لا يومض التحديث الصامت.
- **الحوارات:** `AppModal` يدير الدخول/الخروج والسحب للإغلاق وقفل التمرير (عدّاد مشترك في `utils/scroll-lock.ts`) — لا تقفل التمرير يدوياً.
- لا تغيّر الألوان/التباين لأجل الحركة (قاعدة ضعاف البصر).

## النشر

- Render (الخطة المجانية) عبر `render.yaml`: خدمة واحدة يشغّلها `scripts/start-prod.mjs` (الواجهة على PORT العام، الـ API داخلياً على API_PORT).
- `KeepAliveService` يطلب `/api/health` عبر الرابط العام كل 10 دقائق لمنع إطفاء الخادم — لا تحذفه ولا تجعل `/api/health` محمياً أو خاضعاً للـ throttling.
- `build.transpile: ['pinia']` في nuxt.config ضروري: بدونه يُنتج بناء الإنتاج نسختين من Pinia (خطأ 500).

## الفحص قبل التسليم

```
npm run lint && npm run typecheck && npm test && npm run build
```
