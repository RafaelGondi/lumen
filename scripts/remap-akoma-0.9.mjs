/**
 * Recalcula o mapeamento de cor de categoria para a paleta do Akoma 0.9.
 *
 * Duas coisas mudaram: entraram clay, sea e plum, e o coral foi deslocado —
 * então os hex de coral gravados no banco não existem mais na paleta.
 *
 * O cálculo parte das cores ORIGINAIS do Lumen, não das já migradas: com 11
 * famílias disponíveis a atribuição ótima é outra, e remapear a partir do
 * resultado antigo herdaria escolhas feitas quando só havia 8.
 *
 *   node scripts/remap-akoma-0.9.mjs            # dry-run
 *   node scripts/remap-akoma-0.9.mjs --apply    # grava
 */
import fs from 'node:fs'
import Database from 'better-sqlite3'

/** Mapeamento aplicado na migração anterior: original -> paleta de 8. */
const PREVIOUS = {
  '#7ba616': '#68b894', '#9333b5': '#4d3f9c', '#c62828': '#b96246',
  '#8e1b1b': '#974d36', '#0f9b8e': '#4b99a4', '#1d4ed8': '#3a6a97',
  '#5b5bd6': '#8375cc', '#c2337f': '#ac5468', '#d9541e': '#ce7659',
  '#c2a018': '#c9a05e', '#96591c': '#9d712a', '#1990c9': '#759cbe',
  '#6b4423': '#7c581e', '#2f9e4f': '#4ca67e', '#d98e0b': '#b68639',
  '#1e3a6b': '#2b5176', '#2f6fce': '#5184b1', '#e0526f': '#c36d80',
  '#5d6570': '#475d76', '#166534': '#2c6a4f', '#8a8f98': '#7e93a9',
  '#44484f': '#36485a', '#7c4dc4': '#6354bc', '#188a66': '#3c8866',
}

const SHADES = ['lighter', 'light', 'base', 'dark', 'darker']

/** Lê a paleta direto do pacote instalado — sem hex transcrito à mão. */
function readPalettes() {
  const css = fs.readFileSync(
    'node_modules/@rafael_dias/akoma/src/styles/accent-palettes.css',
    'utf8',
  )
  const ids = [...css.matchAll(/^\[data-accent='([a-z]+)'\] \{/gm)].map((m) => m[1])
  const out = {}
  for (const id of ids) {
    const start = css.indexOf(`[data-accent='${id}'] {`)
    const body = css.slice(start, css.indexOf('}', start))
    out[id] = SHADES.map((s) => {
      const varName = s === 'base' ? '--accent' : `--accent-${s}`
      const m = body.match(new RegExp(`^\\s*${varName}\\s*:\\s*([^;]+);`, 'm'))
      return m[1].trim()
    })
  }
  return out
}

/**
 * Tons reservados, fora da escolha do usuário:
 * - slate/base é o --accent do sistema (chrome, nav ativa)
 * - clay/dark fica a ΔE 3.7 do --danger, confundível com estado de erro
 */
const RESERVED = new Set(['slate/base', 'clay/dark'])

const PALETTES = readPalettes()
const palette = []
for (const [family, hexes] of Object.entries(PALETTES)) {
  hexes.forEach((hex, i) => {
    const key = `${family}/${SHADES[i]}`
    if (!RESERVED.has(key)) palette.push({ hex, family, shade: SHADES[i] })
  })
}

/* ---------- cor ---------- */

const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16))

function rgb2lab([r, g, b]) {
  const [rr, gg, bb] = [r, g, b].map((v) => {
    v /= 255
    return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92
  })
  const x = (rr * 0.4124 + gg * 0.3576 + bb * 0.1805) / 0.95047
  const y = rr * 0.2126 + gg * 0.7152 + bb * 0.0722
  const z = (rr * 0.0193 + gg * 0.1192 + bb * 0.9505) / 1.08883
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]
}

function deltaE(hex1, hex2) {
  const [L1, a1, b1] = rgb2lab(hex2rgb(hex1))
  const [L2, a2, b2] = rgb2lab(hex2rgb(hex2))
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
  let dhp = h2p - h1p
  if (Math.abs(dhp) > 180) dhp += dhp > 0 ? -360 : 360
  const dLp = L2 - L1
  const dCp = C2p - C1p
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * rad) / 2)
  const avghp = Math.abs(h1p - h2p) > 180 ? (h1p + h2p + 360) / 2 : (h1p + h2p) / 2
  const T =
    1 - 0.17 * Math.cos((avghp - 30) * rad) + 0.24 * Math.cos(2 * avghp * rad) +
    0.32 * Math.cos((3 * avghp + 6) * rad) - 0.2 * Math.cos((4 * avghp - 63) * rad)
  const SL = 1 + (0.015 * Math.pow(avgL - 50, 2)) / Math.sqrt(20 + Math.pow(avgL - 50, 2))
  const SC = 1 + 0.045 * avgCp
  const SH = 1 + 0.015 * avgCp * T
  const expo = Math.exp(-Math.pow((avghp - 275) / 25, 2))
  const RT =
    -2 * Math.sqrt(Math.pow(avgCp, 7) / (Math.pow(avgCp, 7) + Math.pow(25, 7))) *
    Math.sin(60 * expo * rad)
  return Math.sqrt(
    Math.pow(dLp / SL, 2) + Math.pow(dCp / SC, 2) + Math.pow(dHp / SH, 2) + RT * (dCp / SC) * (dHp / SH),
  )
}

/** Húngaro: atribuição de custo mínimo, um destino por cor de origem. */
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
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0 }
        if (minv[j] < delta) { delta = minv[j]; j1 = j }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta }
        else minv[j] -= delta
      }
      j0 = j1
    } while (p[j0] !== 0)
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1 } while (j0)
  }
  const res = new Array(n).fill(-1)
  for (let j = 1; j <= m; j++) if (p[j] > 0) res[p[j] - 1] = j - 1
  return res
}

/* ---------- mapeamento ---------- */

const originals = Object.keys(PREVIOUS)
const cost = originals.map((o) => palette.map((p) => deltaE(o, p.hex)))
const assign = hungarian(cost, originals.length, palette.length)

const rows = originals.map((from, i) => ({
  original: from,
  antes: PREVIOUS[from],
  agora: palette[assign[i]].hex,
  familia: `${palette[assign[i]].family}/${palette[assign[i]].shade}`,
  dNovo: cost[i][assign[i]],
  dAntes: deltaE(from, PREVIOUS[from]),
}))

rows.sort((a, b) => b.dAntes - b.dNovo - (a.dAntes - a.dNovo))

console.log(`paleta: ${Object.keys(PALETTES).length} famílias, ${palette.length} tons disponíveis`)
console.log(`reservados: ${[...RESERVED].join(', ')}\n`)
console.log('original   antes -> agora      família              ΔE antes  ΔE agora')
console.log('-'.repeat(76))
for (const r of rows) {
  const ganho = r.dAntes - r.dNovo
  const marca = r.antes !== r.agora ? (ganho > 0.5 ? '  melhorou' : '  ajuste') : ''
  console.log(
    `${r.original}  ${r.antes} -> ${r.agora}  ${r.familia.padEnd(18)} ${r.dAntes.toFixed(1).padStart(6)}  ${r.dNovo.toFixed(1).padStart(7)}${marca}`,
  )
}
const mAntes = rows.reduce((s, r) => s + r.dAntes, 0) / rows.length
const mAgora = rows.reduce((s, r) => s + r.dNovo, 0) / rows.length
console.log('-'.repeat(76))
console.log(`ΔE médio: ${mAntes.toFixed(1)} -> ${mAgora.toFixed(1)}`)
console.log(`mudam de cor: ${rows.filter((r) => r.antes !== r.agora).length} de ${rows.length}`)

/* ---------- aplicação ---------- */

const apply = process.argv.includes('--apply')
const dbArg = process.argv.find((a) => a.startsWith('--db='))
const dbPath = dbArg ? dbArg.slice('--db='.length) : '.data/lumen.sqlite3'

/** O banco guarda o resultado da migração anterior, então a chave é `antes`. */
const dbMap = rows.filter((r) => r.antes !== r.agora)

if (!apply) {
  console.log(`\n(dry-run — ${dbMap.length} cores a trocar no banco; use --apply)`)
  process.exit(0)
}

const db = new Database(dbPath, { fileMustExist: true })

/**
 * O banco pode estar em dois estados: com as cores originais (nunca migrado)
 * ou com o resultado da paleta de 8. Detectar em vez de assumir — local e
 * produção divergiram, e aplicar a chave errada não casaria nenhuma linha e
 * passaria silenciosamente como sucesso.
 */
const presentes = new Set(
  db
    .prepare(
      'SELECT color FROM categories WHERE color IS NOT NULL UNION SELECT color FROM supercategories WHERE color IS NOT NULL',
    )
    .all()
    .map((r) => r.color),
)
const contaOriginais = rows.filter((r) => presentes.has(r.original)).length
const contaAnteriores = rows.filter((r) => presentes.has(r.antes)).length
const deOriginal = contaOriginais > contaAnteriores

console.log(
  `\nbanco: ${dbPath} — ${deOriginal ? 'cores originais' : 'paleta de 8'} ` +
    `(${deOriginal ? contaOriginais : contaAnteriores} de ${rows.length} reconhecidas)`,
)

const chave = deOriginal ? 'original' : 'antes'
const paraAplicar = rows.filter((r) => r[chave] !== r.agora)

for (const table of ['categories', 'supercategories']) {
  const upd = db.prepare(`UPDATE ${table} SET color = ? WHERE color = ?`)
  let n = 0
  const tx = db.transaction((ms) => ms.forEach((m) => { n += upd.run(m.agora, m[chave]).changes }))
  tx(paraAplicar)
  console.log(`>> ${table}: ${n} linhas atualizadas`)
}
db.close()

/* Seed: parte das cores originais, então usa o mapeamento completo. */
const seedFiles = ['server/utils/categorySeedData.ts', 'server/utils/cardInvoice.ts']
for (const file of seedFiles) {
  let text = fs.readFileSync(file, 'utf8')
  let n = 0
  for (const r of rows) {
    const re = new RegExp(r.antes, 'gi')
    const hits = (text.match(re) ?? []).length
    if (hits) { text = text.replace(re, r.agora); n += hits }
  }
  fs.writeFileSync(file, text)
  console.log(`>> ${file}: ${n} cores atualizadas`)
}
