import { AKOMA_ACCENT } from './theme'

/**
 * Paleta de cor de categoria — só cores do Akoma (0.9.0).
 *
 * São as 11 paletas de accent do design system nos seus 5 shades. Os valores
 * estão aqui como literais porque só a paleta ativa vira token CSS vivo
 * (--accent-*): as outras dez existem no design system mas não têm token
 * disponível em runtime.
 *
 * Ao subir a versão do Akoma, rode `node scripts/remap-akoma-0.9.mjs` — ele
 * lê os valores de node_modules/@rafael_dias/akoma/src/styles/accent-palettes.css
 * e mostra o que mudou.
 */
export const AKOMA_PALETTE_FAMILIES = {
  clay: ['#e49f9a', '#d97c76', '#c65b58', '#aa4543', '#883534'],
  coral: ['#e4bba9', '#d69b81', '#cb7954', '#b46440', '#924e2f'],
  amber: ['#d4b583', '#c9a05e', '#b68639', '#9d712a', '#7c581e'],
  evergreen: ['#68b894', '#4ca67e', '#3c8866', '#2c6a4f', '#1d4c37'],
  sea: ['#9ccec0', '#73b8a6', '#469f8b', '#238571', '#146a59'],
  teal: ['#8abdc5', '#69acb6', '#4b99a4', '#377f88', '#286168'],
  ocean: ['#97b4cd', '#759cbe', '#5184b1', '#3a6a97', '#2b5176'],
  violet: ['#c5bee5', '#a59ad8', '#8375cc', '#6354bc', '#4d3f9c'],
  plum: ['#cfaed1', '#bf91c2', '#ab73af', '#905996', '#724477'],
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
  clay: 'Vermelho',
  coral: 'Coral',
  amber: 'Âmbar',
  evergreen: 'Verde',
  sea: 'Esmeralda',
  teal: 'Turquesa',
  ocean: 'Azul',
  violet: 'Violeta',
  plum: 'Ameixa',
  rose: 'Rosa',
  slate: 'Neutro',
}

/**
 * Tons que o usuário não escolhe:
 *
 * - o base do accent ativo é a cor do chrome (page label, nav ativa), e o
 *   guia do Akoma separa "system accent" de "category color" para um chip de
 *   entidade não se confundir com navegação;
 * - clay/dark fica a ΔE 3.7 do --danger, perto demais de estado de erro.
 */
const RESERVED: ReadonlySet<string> = new Set([`${AKOMA_ACCENT}/base`, 'clay/dark'])

export const categoryColorGroups = (
  Object.entries(AKOMA_PALETTE_FAMILIES) as [CategoryColorFamily, readonly string[]][]
).map(([family, shades]) => ({
  family,
  label: categoryColorFamilyLabels[family],
  colors: shades
    .map((hex, index) => ({ hex, shade: AKOMA_SHADE_NAMES[index]! }))
    .filter(({ shade }) => !RESERVED.has(`${family}/${shade}`)),
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
