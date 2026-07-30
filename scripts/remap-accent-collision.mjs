/**
 * Tira categorias de cima do tom base do accent ativo.
 *
 * O guia do Akoma separa "system accent" de "category color": um chip de
 * entidade na cor do chrome se confunde com botão e nav ativa. O seletor já
 * reserva esse tom, mas cores gravadas antes de uma troca de accent ficam.
 *
 *   node scripts/remap-accent-collision.mjs            # dry-run
 *   node scripts/remap-accent-collision.mjs --apply    # grava
 *   ... --db=/caminho/para.sqlite3
 */
import fs from 'node:fs'
import Database from 'better-sqlite3'
import { AKOMA_ACCENT } from '../utils/theme.ts'

const SHADES = ['lighter', 'light', 'base', 'dark', 'darker']

function readPalettes() {
  const arg = process.argv.find((a) => a.startsWith('--palette='))
  const css = fs.readFileSync(
    arg
      ? arg.slice('--palette='.length)
      : 'node_modules/@rafael_dias/akoma/src/styles/accent-palettes.css',
    'utf8',
  )
  const ids = [...css.matchAll(/^\[data-accent='([a-z]+)'\] \{/gm)].map((m) => m[1])
  const out = {}
  for (const id of ids) {
    const start = css.indexOf(`[data-accent='${id}'] {`)
    const body = css.slice(start, css.indexOf('}', start))
    out[id] = SHADES.map((s) => {
      const varName = s === 'base' ? '--accent' : `--accent-${s}`
      return body.match(new RegExp(`^\\s*${varName}\\s*:\\s*([^;]+);`, 'm'))[1].trim()
    })
  }
  return out
}

const PALETTES = readPalettes()
const RESERVED = new Set([`${AKOMA_ACCENT}/base`, 'clay/dark'])

const palette = []
for (const [family, hexes] of Object.entries(PALETTES)) {
  hexes.forEach((hex, i) => {
    const key = `${family}/${SHADES[i]}`
    if (!RESERVED.has(key)) palette.push({ hex, family, shade: SHADES[i], key })
  })
}
const colisao = PALETTES[AKOMA_ACCENT][SHADES.indexOf('base')]

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

/* ---------- estado do banco ---------- */

const apply = process.argv.includes('--apply')
const dbArg = process.argv.find((a) => a.startsWith('--db='))
const dbPath = dbArg ? dbArg.slice('--db='.length) : '.data/lumen.sqlite3'

const db = new Database(dbPath, { readonly: !apply, fileMustExist: true })
console.log(`banco: ${dbPath}${apply ? ' (ESCRITA)' : ' (somente leitura)'}`)
console.log(`accent ativo: ${AKOMA_ACCENT} — tom em conflito: ${colisao}\n`)

const alvos = []
const emUso = new Set()
for (const table of ['categories', 'supercategories']) {
  for (const r of db.prepare(`SELECT id, name, color FROM ${table} WHERE color IS NOT NULL`).all()) {
    if (r.color === colisao) alvos.push({ table, id: r.id, name: r.name })
    else emUso.add(r.color)
  }
}

if (!alvos.length) {
  console.log('nenhuma categoria no tom do accent — nada a fazer.')
  db.close()
  process.exit(0)
}

/**
 * Destinos livres: fora dos reservados e fora do que já está em uso. Reusar
 * uma cor ocupada resolveria a colisão com o chrome e criaria outra entre
 * duas categorias, que é o problema que a paleta existe para evitar.
 */
/**
 * Tons `base` ficam fora como destino automático — não do seletor, onde
 * seguem válidos.
 *
 * O base de qualquer paleta é o que vira chrome se o accent mudar, e foi
 * exatamente uma troca de accent que criou esta colisão. Mandar as afetadas
 * para outro base só adiaria o mesmo problema.
 */
const livres = palette.filter(
  (p) => !emUso.has(p.hex) && p.shade !== 'base',
)
console.log(`${alvos.length} a remapear | ${livres.length} tons livres de ${palette.length}\n`)

/** Húngaro: custo mínimo global, um destino por categoria. */
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

/**
 * Por padrão as afetadas vão todas para o mesmo tom livre mais próximo.
 *
 * Elas já eram da mesma cor — herdada de um único hex legado —, então
 * mantê-las juntas conserta a colisão com o chrome sem recolorir a lista.
 * `--spread` dá a cada uma um tom próprio, o que as distingue melhor entre
 * si mas afasta bastante do que estava (chega a ΔE 18 e muda de família).
 */
const spread = process.argv.includes('--spread')

let plano
if (spread) {
  const cost = alvos.map(() => livres.map((l) => deltaE(colisao, l.hex)))
  const assign = hungarian(cost, alvos.length, livres.length)
  plano = alvos.map((a, i) => ({ ...a, ...livres[assign[i]], d: cost[i][assign[i]] }))
} else {
  const melhor = livres
    .map((l) => ({ ...l, d: deltaE(colisao, l.hex) }))
    .sort((a, b) => a.d - b.d)[0]
  plano = alvos.map((a) => ({ ...a, ...melhor }))
}

console.log(spread ? 'modo: um tom por categoria (--spread)\n' : 'modo: todas para o mesmo tom\n')

console.log('de       -> para      família              ΔE   categoria')
for (const p of plano) {
  console.log(
    `${colisao} -> ${p.hex}  ${p.key.padEnd(18)} ${p.d.toFixed(1).padStart(4)}  ${p.name}`,
  )
}

if (!apply) {
  console.log('\n(dry-run — use --apply para gravar)')
  db.close()
  process.exit(0)
}

for (const table of ['categories', 'supercategories']) {
  const itens = plano.filter((p) => p.table === table)
  const upd = db.prepare(`UPDATE ${table} SET color = ? WHERE id = ?`)
  db.transaction((xs) => xs.forEach((x) => upd.run(x.hex, x.id)))(itens)
  console.log(`>> ${table}: ${itens.length} linhas atualizadas`)
}
db.close()
