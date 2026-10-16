import type { Directive } from 'vue'

type PermValue = string | string[]

/**
 * v-perm="'users.create'" أو v-perm="['a', 'b']"
 * يزيل العنصر من الـ DOM إن لم يملك المستخدم واحدة منها على الأقل.
 * (للعناصر داخل القوائم المتغيرة استخدم v-if مع usePermission().has)
 */
export default defineNuxtPlugin({
  name: 'permission',
  dependsOn: ['api'],
  setup(nuxtApp) {
    const { has } = usePermission()

    const directive: Directive<HTMLElement, PermValue> = {
      mounted(el, binding) {
        if (!has(binding.value)) el.replaceWith(document.createComment(' v-perm '))
      },
      getSSRProps(binding) {
        return has(binding.value) ? {} : { style: 'display:none', 'aria-hidden': 'true' }
      },
    }

    nuxtApp.vueApp.directive('perm', directive)
  },
})
