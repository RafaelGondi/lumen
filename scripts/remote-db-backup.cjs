const Database = require('better-sqlite3')

const stamp = process.argv[2]
if (!stamp) {
  console.error('stamp required')
  process.exit(1)
}

const src = '/app/.data/lumen.sqlite3'
const dst = `/tmp/lumen-pull-${stamp}.sqlite3`

const db = new Database(src, { readonly: true })
db.backup(dst)
  .then(() => {
    db.close()
    console.log(dst)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
