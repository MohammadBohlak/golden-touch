/**
 * تشغيل نسخة الإنتاج في خدمة واحدة (مثل Render):
 * - الواجهة (Nuxt) على المنفذ العام PORT الذي تحدده الاستضافة
 * - الـ API (NestJS) داخلياً على API_PORT (افتراضياً 4000)، والواجهة تمرّر له /api/**
 * إن توقفت إحدى العمليتين تُوقف الأخرى ويخرج السكربت بخطأ لتعيد الاستضافة التشغيل.
 * سكربت Node صرف (بلا bash) ليعمل على Windows و Linux.
 */
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const publicPort = process.env.PORT || '3000'
const requestedApiPort = process.env.API_PORT || '4000'
// حماية: إن تطابق المنفذان (مثلاً PORT=4000 منسوخ من .env إلى إعدادات الاستضافة) يفشل الـ API بـ EADDRINUSE
const apiPort = requestedApiPort === publicPort ? String(Number(publicPort) + 1) : requestedApiPort
if (apiPort !== requestedApiPort) {
  console.warn(
    `[start] API_PORT (${requestedApiPort}) equals the public PORT — using ${apiPort} for the API. ` +
      'Remove PORT from the host environment variables; the host sets it automatically.',
  )
}

const apps = [
  {
    name: 'api',
    // cwd داخل apps/api حتى يقرأ apps/api/.env محلياً (على Render المتغيرات من لوحة التحكم)
    cwd: 'apps/api',
    script: 'dist/main.js',
    // 127.0.0.1 فقط: منفذ داخلي لا يجب أن تكتشفه الاستضافة (Render توجّه الزوار لأول منفذ عام تجده)
    env: { PORT: apiPort, API_HOST: '127.0.0.1' },
  },
  {
    name: 'web',
    cwd: '.',
    script: 'apps/web/.output/server/index.mjs',
    env: {
      PORT: publicPort,
      NUXT_API_BASE_URL: process.env.NUXT_API_BASE_URL || `http://127.0.0.1:${apiPort}`,
    },
  },
]

let shuttingDown = false
const children = apps.map(({ name, cwd, script, env }) => {
  const child = spawn(process.execPath, [script], {
    cwd: join(root, cwd),
    env: { ...process.env, ...env },
    stdio: 'inherit',
  })
  child.on('exit', (code, signal) => {
    if (shuttingDown) return
    console.error(`[${name}] exited (${signal ?? code}) — stopping`)
    stop(code || 1)
  })
  return child
})

function stop(code = 0) {
  shuttingDown = true
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM')
  setTimeout(() => process.exit(code), 5000).unref()
  Promise.all(
    children.map((c) => (c.exitCode === null ? new Promise((r) => c.on('exit', r)) : null)),
  ).then(() => process.exit(code))
}

process.on('SIGTERM', () => stop(0))
process.on('SIGINT', () => stop(0))

console.log(`Golden Touch: web on :${publicPort}, api on 127.0.0.1:${apiPort}`)
