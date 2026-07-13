export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  modules: ['@nuxt/fonts'],
  fonts: {
    defaults: {
      weights: [400, 500, 600, 700],
    },
  },
  css: ['~/assets/css/tokens.css', '~/assets/css/main.css'],
  typescript: {
    strict: true,
    typeCheck: true,
  },
  build: {
    transpile: ['@edusites/bancos-brasil'],
  },
  vite: {
    optimizeDeps: {
      include: ['@edusites/bancos-brasil'],
    },
  },
  nitro: {
    externals: {
      external: ['better-sqlite3'],
    },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'pt-BR' },
      title: 'Lumen — Gestão financeira',
      meta: [
        {
          name: 'description',
          content: 'Dashboard de gestão financeira da Lumen.',
        },
      ],
    },
  },
})
