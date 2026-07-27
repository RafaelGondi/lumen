import { fileURLToPath } from 'node:url'

/**
 * O @sysvale/cuida-icons (dependência de ícones do Akoma) publica só `dist/*`,
 * mas o package.json da raiz aponta `main` para um `index.js` que não existe
 * no pacote. Apontamos direto para o entry real — Vite e Nitro resolvem
 * separadamente, então o alias precisa estar nos dois.
 */
const cuidaIconsEntry = fileURLToPath(
  new URL('./node_modules/@sysvale/cuida-icons/dist/index.js', import.meta.url),
)

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  modules: ['@nuxt/fonts'],
  fonts: {
    defaults: {
      weights: [400, 500, 600, 700],
    },
  },
  css: [
    '@rafael_dias/akoma/style.css',
    '~/assets/css/tokens.css',
    '~/assets/css/main.css',
  ],
  typescript: {
    strict: true,
    typeCheck: true,
  },
  build: {
    /**
     * O akoma precisa passar pelo Vite no SSR: externalizado, o Node resolve
     * `@sysvale/cuida-icons` sozinho e o alias abaixo não se aplica.
     */
    transpile: ['@edusites/bancos-brasil', '@rafael_dias/akoma'],
  },
  alias: {
    '@sysvale/cuida-icons': cuidaIconsEntry,
  },
  vite: {
    optimizeDeps: {
      include: ['@edusites/bancos-brasil'],
    },
  },
  nitro: {
    alias: {
      '@sysvale/cuida-icons': cuidaIconsEntry,
    },
    externals: {
      external: ['better-sqlite3'],
    },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'pt-BR', 'data-mood': 'site', 'data-accent': 'slate' },
      title: 'Lumen — Gestão financeira',
      meta: [
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1',
        },
        {
          name: 'description',
          content: 'Dashboard de gestão financeira da Lumen.',
        },
      ],
    },
  },
})
