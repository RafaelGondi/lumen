import { Akoma } from '@rafael_dias/akoma'

/**
 * Registra os componentes Ak* globalmente. O mood/accent ficam em htmlAttrs
 * (nuxt.config) para valerem já no HTML servido — evita flash de tema na
 * hidratação.
 */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(Akoma)
})
