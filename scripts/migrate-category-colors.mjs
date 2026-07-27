/**
 * Mapeia as cores atuais de categorias/supercategorias para a cor mais
 * próxima da paleta do Akoma, por distância perceptual (CIEDE2000).
 *
 * Sem --apply é dry-run: só imprime a tabela.
 */
import Database from 'better-sqlite3'

const AKOMA = {
  violet: ['#c5bee5', '#a59ad8', '#8375cc', '#6354bc', '#4d3f9c'],
  evergreen: ['#68b894', '#4ca67e', '#3c8866', '#2c6a4f', '#1d4c37'],
  teal: ['#8abdc5', '#69acb6', '#4b99a4', '#377f88', '#286168'],
  ocean: ['#97b4cd', '#759cbe', '#5184b1', '#3a6a97', '#2b5176'],
  amber: ['#d4b583', '#c9a05e', '#b68639', '#9d712a', '#7c581e'],
  rose: ['#ddb3bc', '#cf919f', '#c36d80', '#ac5468', '#8d4254'],
  coral: ['#e4b9ab', '#d99b86', '#ce7659', '#b96246', '#974d36'],
  slate: ['#9faebd', '#7e93a9', '#5e7894', '#475d76', '#36485a'],
}
const SHADES = ['lighter', 'light', 'base', 'dark', 'darker']

/**
 * O tom base do accent ativo fica fora: é a cor do chrome do sistema (page
 * label, nav ativa), e o guia do Akoma separa "system accent" de "category
 * color" justamente para um chip de entidade não se confundir com navegação.
 * Os outros shades do slate seguem disponíveis — as categorias neutras
 * ("Não identificado", "Eletrodoméstico") precisam deles.
 */
const SYSTEM_ACCENT = 'slate'

const palette = []
for (const [family, hexes] of Object.entries(AKOMA)) {
  hexes.forEach((hex, i) => {
    if (family === SYSTEM_ACCENT && SHADES[i] === 'base') return
    palette.push({ hex, family, shade: SHADES[i] })
  })
}

function hexToRgb(h) {
  const s = h.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16))
}

function rgbToLab([r, g, b]) {
  let [rr, gg, bb] = [r, g, b].map((v) => {
    v /= 255
    return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92
  })
  const x = (rr * 0.4124 + gg * 0.3576 + bb * 0.1805) / 0.95047
  const y = (rr * 0.2126 + gg * 0.7152 + bb * 0.0722) / 1.0
  const z = (rr * 0.0193 + gg * 0.1192 + bb * 0.9505) / 1.08883
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const [fx, fy, fz] = [f(x), f(y), f(z)]
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

/** CIEDE2000 — a métrica que corresponde a "parece a mesma cor" para o olho. */
function deltaE00(lab1, lab2) {
  const [L1, a1, b1] = lab1
  const [L2, a2, b2] = lab2
  const avgL = (L1 + L2) / 2
  const C1 = Math.hypot(a1, b1)
  const C2 = Math.hypot(a2, b2)
  const avgC = (C1 + C2) / 2
  const G = 0.5 * (1 - Math.sqrt(Math.pow(avgC, 7) / (Math.pow(avgC, 7) + Math.pow(25, 7))))
  const a1p = a1 * (1 + G)
  const a2p = a2 * (1 + G)
  const C1p = Math.hypot(a1p, b1)
  const C2p = Math.hypot(a2p, b2)
  const avgCp = (C1p + C2p) / 2
  const rad = Math.PI / 180
  let h1p = (Math.atan2(b1, a1p) * 180) / Math.PI
  if (h1p < 0) h1p += 360
  let h2p = (Math.atan2(b2, a2p) * 180) / Math.PI
  if (h2p < 0) h2p += 360
  let deltahp = h2p - h1p
  if (Math.abs(deltahp) > 180) deltahp += deltahp > 0 ? -360 : 360
  const deltaLp = L2 - L1
  const deltaCp = C2p - C1p
  const deltaHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((deltahp * rad) / 2)
  let avghp = Math.abs(h1p - h2p) > 180 ? (h1p + h2p + 360) / 2 : (h1p + h2p) / 2
  const T =
    1 -
    0.17 * Math.cos((avghp - 30) * rad) +
    0.24 * Math.cos(2 * avghp * rad) +
    0.32 * Math.cos((3 * avghp + 6) * rad) -
    0.2 * Math.cos((4 * avghp - 63) * rad)
  const SL = 1 + (0.015 * Math.pow(avgL - 50, 2)) / Math.sqrt(20 + Math.pow(avgL - 50, 2))
  const SC = 1 + 0.045 * avgCp
  const SH = 1 + 0.015 * avgCp * T
  const RT =
    -2 *
    Math.sqrt(Math.pow(avgCp, 7) / (Math.pow(avgCp, 7) + Math.pow(25, 7))) *
    Math.sin(60 * Math.exp(-Math.pow((avghp - 275) / 25, 2)) * rad)
  return Math.sqrt(
    Math.pow(deltaLp / SL, 2) +
      Math.pow(deltaCp / SC, 2) +
      Math.pow(deltaHp / SH, 2) +
      RT * (deltaCp / SC) * (deltaHp / SH),
  )
}

const labCache = new Map()
const lab = (hex) => {
  if (!labCache.has(hex)) labCache.set(hex, rgbToLab(hexToRgb(hex)))
  return labCache.get(hex)
}

const apply = process.argv.includes('--apply')
const db = new Database('.data/lumen.sqlite3', { readonly: !apply })

const TABLES = ['categories', 'supercategories']

/**
 * Uso por cor somando as duas tabelas: o mapeamento é global de propósito,
 * para uma supercategoria e suas filhas não divergirem de cor.
 */
const usage = new Map()
for (const table of TABLES) {
  for (const r of db.prepare(`SELECT color, COUNT(*) c FROM ${table} WHERE color IS NOT NULL GROUP BY color`).all()) {
    usage.set(r.color, (usage.get(r.color) ?? 0) + r.c)
  }
}
const sources = [...usage.keys()]

/**
 * Algoritmo húngaro: atribuição de custo mínimo global, um destino por cor.
 *
 * Duas abordagens mais simples falharam antes desta. Vizinho-mais-próximo
 * independente colidia (quatro roxos distintos viravam a mesma cor, e cor de
 * categoria existe para distinguir entidades numa lista). Guloso por ΔE
 * crescente resolvia a colisão mas encadeava mal: um azul tomava violet/base
 * e empurrava um roxo para teal, do outro lado da roda de cores. Só o ótimo
 * global evita esse efeito dominó.
 */
function hungarian(cost, n, m) {
  const u = new Array(n + 1).fill(0)
  const v = new Array(m + 1).fill(0)
  const p = new Array(m + 1).fill(0)
  const way = new Array(m + 1).fill(0)

  for (let i = 1; i <= n; i++) {
    p[0] = i
    let j0 = 0
    const minv = new Array(m + 1).fill(Infinity)
    const used = new Array(m + 1).fill(false)
    do {
      used[j0] = true
      const i0 = p[j0]
      let delta = Infinity
      let j1 = 0
      for (let j = 1; j <= m; j++) {
        if (used[j]) continue
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j]
        if (cur < minv[j]) {
          minv[j] = cur
          way[j] = j0
        }
        if (minv[j] < delta) {
          delta = minv[j]
          j1 = j
        }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) {
          u[p[j]] += delta
          v[j] -= delta
        } else {
          minv[j] -= delta
        }
      }
      j0 = j1
    } while (p[j0] !== 0)
    do {
      const j1 = way[j0]
      p[j0] = p[j1]
      j0 = j1
    } while (j0)
  }

  const result = new Array(n).fill(-1)
  for (let j = 1; j <= m; j++) if (p[j] > 0) result[p[j] - 1] = j - 1
  return result
}

const cost = sources.map((from) => palette.map((p) => deltaE00(lab(from), lab(p.hex))))
const assignment = hungarian(cost, sources.length, palette.length)

const mapping = sources
  .map((from, i) => ({ from, ...palette[assignment[i]], d: cost[i][assignment[i]] }))
  .sort((a, b) => b.d - a.d)
const takenTargets = new Set(mapping.map((m) => m.hex))

console.log(`=== ${mapping.length} cores distintas -> ${takenTargets.size} destinos únicos ===\n`)
for (const m of mapping) {
  const flag = m.d > 15 ? '  <-- salto grande' : ''
  console.log(
    `${m.from} -> ${m.hex}  ${(m.family + '/' + m.shade).padEnd(20)} ΔE ${m.d.toFixed(1).padStart(5)}  (${usage.get(m.from)}x)${flag}`,
  )
}

const dup = mapping.length - new Set(mapping.map((m) => m.hex)).size
console.log(`\ncolisões: ${dup}`)
console.log(`ΔE médio: ${(mapping.reduce((s, m) => s + m.d, 0) / mapping.length).toFixed(1)}`)

if (apply) {
  for (const table of TABLES) {
    const upd = db.prepare(`UPDATE ${table} SET color = ? WHERE color = ?`)
    const tx = db.transaction((ms) => ms.forEach((m) => upd.run(m.hex, m.from)))
    tx(mapping)
    console.log(`>> aplicado em ${table}`)
  }
} else {
  console.log('\n(dry-run — rode com --apply para gravar)')
}
db.close()
