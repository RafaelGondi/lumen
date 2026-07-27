import { AKOMA_ACCENT } from './theme'

/**
 * Paleta de cor de categoria — só cores do Akoma.
 *
 * São as 8 paletas de accent do design system nos seus 5 shades. Os valores
 * estão aqui como literais porque só a paleta ativa vira token CSS vivo
 * (--accent-*): as outras sete existem no design system mas não têm token
 * disponível em runtime. Se o Akoma revisar uma paleta, isto precisa ser
 * regerado — o script scripts/migrate-category-colors.mjs extrai os valores
 * de node_modules/@rafael_dias/akoma/src/styles/accent-palettes.css.
 */
export const AKOMA_PALETTE_FAMILIES = {
  coral: ['#e4b9ab', '#d99b86', '#ce7659', '#b96246', '#974d36'],
  amber: ['#d4b583', '#c9a05e', '#b68639', '#9d712a', '#7c581e'],
  evergreen: ['#68b894', '#4ca67e', '#3c8866', '#2c6a4f', '#1d4c37'],
  teal: ['#8abdc5', '#69acb6', '#4b99a4', '#377f88', '#286168'],
  ocean: ['#97b4cd', '#759cbe', '#5184b1', '#3a6a97', '#2b5176'],
  violet: ['#c5bee5', '#a59ad8', '#8375cc', '#6354bc', '#4d3f9c'],
  rose: ['#ddb3bc', '#cf919f', '#c36d80', '#ac5468', '#8d4254'],
  slate: ['#9faebd', '#7e93a9', '#5e7894', '#475d76', '#36485a'],
} as const

export const AKOMA_SHADE_NAMES = [
  'lighter',
  'light',
  'base',
  'dark',
  'darker',
] as const

export type CategoryColorFamily = keyof typeof AKOMA_PALETTE_FAMILIES

export const categoryColorFamilyLabels: Record<CategoryColorFamily, string> = {
  coral: 'Coral',
  amber: 'Âmbar',
  evergreen: 'Verde',
  teal: 'Turquesa',
  ocean: 'Azul',
  violet: 'Violeta',
  rose: 'Rosa',
  slate: 'Neutro',
}

/**
 * O tom base do accent ativo não entra: é a cor do chrome (page label, nav
 * ativa). O guia do Akoma separa "system accent" de "category color" para um
 * chip de entidade não se confundir com navegação. Os demais shades do slate
 * continuam disponíveis — categorias neutras precisam deles.
 */
function isSystemAccentBase(family: CategoryColorFamily, shadeIndex: number) {
  return family === AKOMA_ACCENT && AKOMA_SHADE_NAMES[shadeIndex] === 'base'
}

export const categoryColorGroups = (
  Object.entries(AKOMA_PALETTE_FAMILIES) as [CategoryColorFamily, readonly string[]][]
).map(([family, shades]) => ({
  family,
  label: categoryColorFamilyLabels[family],
  colors: shades
    .map((hex, index) => ({ hex, shade: AKOMA_SHADE_NAMES[index]! }))
    .filter((_, index) => !isSystemAccentBase(family, index)),
}))

/**
 * Lista plana na ordem das famílias. O seletor mostra só os quadrados, sem
 * rótulo, mas a ordem preserva as faixas de matiz e o nome sobrevive no
 * aria-label — quem navega por leitor de tela ainda ouve "Azul dark".
 */
export const categoryColorSwatches = categoryColorGroups.flatMap((g) =>
  g.colors.map((c) => ({ ...c, family: g.family, label: `${g.label} ${c.shade}` })),
)

export const categoryColorPalette = categoryColorSwatches.map((c) => c.hex)
