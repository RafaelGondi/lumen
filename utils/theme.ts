/**
 * Configuração do Akoma para o Lumen. Fica em módulo próprio porque tanto o
 * nuxt.config (htmlAttrs) quanto os componentes que abrem um subtree de tema
 * escuro precisam dos mesmos valores — e um divergir do outro quebra em
 * silêncio, caindo no accent padrão do design system.
 */
export const AKOMA_MOOD = 'site'
export const AKOMA_ACCENT = 'ocean'
