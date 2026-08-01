/**
 * Escolhe tinta clara ou escura para um fundo arbitrário.
 *
 * Existe porque cor de banco/cartão é dado do usuário, não token: vai de
 * `#1a1a1a` a `#00bcff` e nenhuma tinta fixa serve para as duas pontas.
 * Um limiar de luminância chutado erra nas cores saturadas — `#00bcff` lê
 * como "escuro" em fórmulas simples e mesmo assim reprova com branco
 * (2,18:1). Aqui a decisão sai do contraste WCAG de fato calculado.
 */

const LIGHT_INK = '#ffffff'
const DARK_INK = '#17201b'

function relativeLuminance(hex: string) {
  const value = hex.replace('#', '')
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value

  const channels = [0, 2, 4].map((offset) => {
    const raw = Number.parseInt(full.slice(offset, offset + 2), 16) / 255
    return raw <= 0.03928 ? raw / 12.92 : Math.pow((raw + 0.055) / 1.055, 2.4)
  })

  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!
}

function contrast(a: string, b: string) {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/** A tinta que contrasta melhor com `background`. */
export function inkOn(background: string) {
  return contrast(LIGHT_INK, background) >= contrast(DARK_INK, background)
    ? LIGHT_INK
    : DARK_INK
}

/** `true` quando a tinta escolhida é escura — útil para ajustar overlays. */
export function needsDarkInk(background: string) {
  return inkOn(background) === DARK_INK
}

function toRgb(hex: string) {
  const value = hex.replace('#', '')
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value
  return [0, 2, 4].map((o) => Number.parseInt(full.slice(o, o + 2), 16))
}

const toHex = (rgb: number[]) =>
  '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')

/**
 * Aproxima o fundo até a tinta escolhida passar em contraste.
 *
 * Algumas cores de banco não têm saída: `#3d7ebd` fica em 4,27:1 com branco
 * e pior ainda com tinta escura — nenhuma das duas alcança 4,5. Nesses casos
 * escurecer (ou clarear) o fundo alguns por cento resolve sem descaracterizar
 * a marca; o teto de 45% existe para o cartão continuar reconhecível.
 */
export function legibleSurface(background: string, minRatio = 4.5) {
  const ink = inkOn(background)
  if (contrast(ink, background) >= minRatio) return background

  const target = ink === LIGHT_INK ? [0, 0, 0] : [255, 255, 255]
  const base = toRgb(background)

  for (let mix = 0.05; mix <= 0.45; mix += 0.05) {
    const blended = toHex(base.map((c, i) => c + (target[i]! - c) * mix))
    if (contrast(ink, blended) >= minRatio) return blended
  }

  return toHex(base.map((c, i) => c + (target[i]! - c) * 0.45))
}
