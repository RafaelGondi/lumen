/**
 * Aplica aos arquivos de seed o mesmo mapeamento que migrate-category-colors
 * gravou no banco. Sem isso, uma base criada do zero nasceria com a paleta
 * antiga e o app voltaria a ter cores fora do Akoma.
 *
 * A tabela é o resultado da atribuição ótima (CIEDE2000 + húngaro) rodada
 * sobre as 24 cores originais — fixa aqui de propósito, para o seed não
 * depender do estado do banco.
 */
import fs from 'node:fs'

const MAPPING = {
  '#7ba616': '#68b894', // evergreen/lighter
  '#9333b5': '#4d3f9c', // violet/darker
  '#c62828': '#b96246', // coral/dark
  '#8e1b1b': '#974d36', // coral/darker
  '#0f9b8e': '#4b99a4', // teal/base
  '#1d4ed8': '#3a6a97', // ocean/dark
  '#5b5bd6': '#8375cc', // violet/base
  '#c2337f': '#ac5468', // rose/dark
  '#d9541e': '#ce7659', // coral/base
  '#c2a018': '#c9a05e', // amber/light
  '#96591c': '#9d712a', // amber/dark
  '#1990c9': '#759cbe', // ocean/light
  '#6b4423': '#7c581e', // amber/darker
  '#2f9e4f': '#4ca67e', // evergreen/light
  '#d98e0b': '#b68639', // amber/base
  '#1e3a6b': '#2b5176', // ocean/darker
  '#2f6fce': '#5184b1', // ocean/base
  '#e0526f': '#c36d80', // rose/base
  '#5d6570': '#475d76', // slate/dark
  '#166534': '#2c6a4f', // evergreen/dark
  '#8a8f98': '#7e93a9', // slate/light
  '#44484f': '#36485a', // slate/darker
  '#7c4dc4': '#6354bc', // violet/dark
  '#188a66': '#3c8866', // evergreen/base
}

/**
 * bankCatalog.ts fica de fora: cor de banco é identidade de marca externa
 * (ou fallback para banco custom), não cor de categoria.
 */
const FILES = ['server/utils/categorySeedData.ts', 'server/utils/cardInvoice.ts']

const apply = process.argv.includes('--apply')

for (const file of FILES) {
  const before = fs.readFileSync(file, 'utf8')
  let after = before
  const hits = {}
  for (const [from, to] of Object.entries(MAPPING)) {
    const re = new RegExp(from, 'gi')
    const n = (after.match(re) ?? []).length
    if (n) {
      hits[from] = `${to} (${n}x)`
      after = after.replace(re, to)
    }
  }
  console.log(`\n=== ${file} ===`)
  console.log(Object.keys(hits).length ? Object.entries(hits).map(([k, v]) => `  ${k} -> ${v}`).join('\n') : '  nada a trocar')
  if (apply && after !== before) {
    fs.writeFileSync(file, after)
    console.log('  >> gravado')
  }
}

if (!apply) console.log('\n(dry-run — rode com --apply para gravar)')
