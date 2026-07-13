import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import Database from 'better-sqlite3'

let db: Database.Database | undefined

function hasColumn(
  database: Database.Database,
  table: string,
  column: string,
) {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string
  }[]
  return columns.some((item) => item.name === column)
}

function addMonthsAnchored(date: string, months: number) {
  const [yearRaw, monthRaw, dayRaw] = date.split('-').map(Number)
  const total = yearRaw! * 12 + monthRaw! - 1 + months
  const year = Math.floor(total / 12)
  const month = (total % 12) + 1
  const day = Math.min(dayRaw!, new Date(year, month, 0).getDate())
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function migrateExpandedSeries(database: Database.Database) {
  const migrationKey = 'entries_parent_series_v2'
  const done = database
    .prepare('SELECT 1 FROM app_migrations WHERE key = ?')
    .get(migrationKey)

  if (done) return

  type LegacyRow = {
    id: number
    type: 'income' | 'expense'
    accountId: number
    categoryId: number | null
    description: string
    amount: number
    statementName: string | null
    notes: string | null
    recurrence: 'installment' | 'fixed'
    date: string
    endDate: string | null
    installmentCount: number | null
    installmentIndex: number | null
    groupId: string
    status: 'pending' | 'received' | 'paid'
    createdAt: string
  }

  const migrate = database.transaction(() => {
    const groupIds = database
      .prepare(
        `SELECT group_id AS groupId
         FROM entries
         WHERE group_id IS NOT NULL
           AND recurrence IN ('installment', 'fixed')
         GROUP BY group_id`,
      )
      .all() as { groupId: string }[]

    const selectRows = database.prepare(
      `SELECT
         id,
         type,
         account_id AS accountId,
         category_id AS categoryId,
         description,
         amount,
         statement_name AS statementName,
         notes,
         recurrence,
         date,
         end_date AS endDate,
         installment_count AS installmentCount,
         installment_index AS installmentIndex,
         group_id AS groupId,
         status,
         created_at AS createdAt
       FROM entries
       WHERE group_id = ?
       ORDER BY date ASC, id ASC`,
    )

    const insertException = database.prepare(
      `INSERT OR REPLACE INTO entry_occurrence_exceptions (
         entry_id, occurrence_month, action, due_date, amount,
         description, category_id, statement_name, notes, created_at
       ) VALUES (?, ?, 'edit', ?, ?, ?, ?, ?, ?, ?)`,
    )

    const insertPayment = database.prepare(
      `INSERT OR REPLACE INTO entry_occurrence_payments (
         entry_id, occurrence_month, state, payment_date, created_at, updated_at
       ) VALUES (?, ?, 'paid', ?, ?, ?)`,
    )

    for (const { groupId } of groupIds) {
      const rows = selectRows.all(groupId) as LegacyRow[]
      const parent = rows[0]
      if (!parent) continue

      const count =
        parent.recurrence === 'installment'
          ? parent.installmentCount ?? rows.length
          : null
      const endDate =
        parent.recurrence === 'installment'
          ? addMonthsAnchored(parent.date, Math.max((count ?? 1) - 1, 0))
          : parent.endDate ??
            (rows.length > 1 ? rows.at(-1)?.date ?? null : null)

      database
        .prepare(
          `UPDATE entries
           SET date = ?,
               end_date = ?,
               installment_count = ?,
               installment_index = NULL,
               payment_state = 'auto',
               payment_date = NULL
           WHERE id = ?`,
        )
        .run(parent.date, endDate, count, parent.id)

      for (const row of rows.slice(1)) {
        const month = row.date.slice(0, 7)
        const expectedDate = addMonthsAnchored(
          parent.date,
          Math.max((row.installmentIndex ?? rows.indexOf(row) + 1) - 1, 0),
        )

        if (
          row.amount !== parent.amount ||
          row.description !== parent.description ||
          row.categoryId !== parent.categoryId ||
          row.statementName !== parent.statementName ||
          row.notes !== parent.notes ||
          row.date !== expectedDate
        ) {
          insertException.run(
            parent.id,
            month,
            row.date,
            row.amount,
            row.description,
            row.categoryId,
            row.statementName,
            row.notes,
            row.createdAt,
          )
        }

        if (
          (row.status === 'paid' || row.status === 'received') &&
          row.date > todayLocal()
        ) {
          insertPayment.run(
            parent.id,
            month,
            row.createdAt,
            row.createdAt,
            row.createdAt,
          )
        }
      }

      if (rows.length > 1) {
        const ids = rows.slice(1).map((row) => row.id)
        const placeholders = ids.map(() => '?').join(', ')
        database
          .prepare(`DELETE FROM entries WHERE id IN (${placeholders})`)
          .run(...ids)
      }
    }

    database
      .prepare(
        `UPDATE entries
         SET payment_state = 'paid',
             payment_date = created_at
         WHERE recurrence = 'single'
           AND status IN ('paid', 'received')
           AND date > ?`,
      )
      .run(todayLocal())

    database
      .prepare(
        'INSERT INTO app_migrations (key, applied_at) VALUES (?, ?)',
      )
      .run(migrationKey, todayLocal())
  })

  migrate()
}

function migrateEntriesForCards(database: Database.Database) {
  const columns = database.prepare('PRAGMA table_info(entries)').all() as {
    name: string
    notnull: number
  }[]
  const accountColumn = columns.find((column) => column.name === 'account_id')
  const supportsCards =
    columns.some((column) => column.name === 'card_id') &&
    accountColumn?.notnull === 0

  if (supportsCards) return

  database.pragma('foreign_keys = OFF')
  try {
    database.transaction(() => {
      database.exec(`
        CREATE TABLE entries_card_v1 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
          account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
          card_id INTEGER REFERENCES cards(id) ON DELETE CASCADE,
          category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
          description TEXT NOT NULL,
          amount REAL NOT NULL,
          statement_name TEXT,
          notes TEXT,
          recurrence TEXT NOT NULL CHECK (recurrence IN ('single', 'installment', 'fixed')),
          date TEXT NOT NULL,
          end_date TEXT,
          installment_count INTEGER,
          installment_index INTEGER,
          group_id TEXT,
          status TEXT NOT NULL CHECK (status IN ('pending', 'received', 'paid')),
          created_at TEXT NOT NULL,
          payment_state TEXT NOT NULL DEFAULT 'auto',
          payment_date TEXT,
          month_end INTEGER NOT NULL DEFAULT 0,
          CHECK (
            (account_id IS NOT NULL AND card_id IS NULL) OR
            (account_id IS NULL AND card_id IS NOT NULL)
          )
        );

        INSERT INTO entries_card_v1 (
          id, type, account_id, card_id, category_id, description, amount,
          statement_name, notes, recurrence, date, end_date,
          installment_count, installment_index, group_id, status, created_at,
          payment_state, payment_date, month_end
        )
        SELECT
          id, type, account_id, NULL, category_id, description, amount,
          statement_name, notes, recurrence, date, end_date,
          installment_count, installment_index, group_id, status, created_at,
          payment_state, payment_date, month_end
        FROM entries;

        DROP TABLE entries;
        ALTER TABLE entries_card_v1 RENAME TO entries;

        CREATE INDEX idx_entries_account_date
          ON entries (account_id, date);
        CREATE INDEX idx_entries_card_date
          ON entries (card_id, date);
      `)
    })()
  } finally {
    database.pragma('foreign_keys = ON')
  }
}

function migrateEntryDestinationAccount(database: Database.Database) {
  const columns = database.prepare('PRAGMA table_info(entries)').all() as {
    name: string
  }[]
  if (columns.some((column) => column.name === 'destination_account_id')) {
    return
  }

  database.exec(`
    ALTER TABLE entries
      ADD COLUMN destination_account_id INTEGER
      REFERENCES accounts(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_entries_destination_date
      ON entries (destination_account_id, date);
  `)
}

function migrate(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      key TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS supercategories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      color TEXT NOT NULL,
      icon TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE,
      type TEXT NOT NULL CHECK (type IN ('expense', 'income', 'transfer')),
      color TEXT NOT NULL,
      icon TEXT NOT NULL,
      supercategory_id INTEGER REFERENCES supercategories(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      UNIQUE (name, type)
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bank_key TEXT NOT NULL,
      bank_name TEXT NOT NULL,
      name TEXT NOT NULL COLLATE NOCASE,
      initial_balance REAL NOT NULL DEFAULT 0,
      color TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (bank_name, name)
    );

    -- Cartões de crédito (sem compras/fatura nesta fase).
    -- closing_day = dia de FECHAMENTO da fatura (não “melhor dia p/ comprar”).
    -- due_day = dia de VENCIMENTO do boleto.
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE,
      bank_key TEXT NOT NULL,
      bank_name TEXT NOT NULL,
      color TEXT NOT NULL,
      last_four TEXT,
      credit_limit REAL NOT NULL DEFAULT 0,
      closing_day INTEGER NOT NULL CHECK (closing_day BETWEEN 1 AND 31),
      due_day INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      UNIQUE (bank_name, name)
    );

    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
      account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
      destination_account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
      card_id INTEGER REFERENCES cards(id) ON DELETE CASCADE,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      statement_name TEXT,
      notes TEXT,
      recurrence TEXT NOT NULL CHECK (recurrence IN ('single', 'installment', 'fixed')),
      date TEXT NOT NULL,
      end_date TEXT,
      installment_count INTEGER,
      installment_index INTEGER,
      group_id TEXT,
      status TEXT NOT NULL CHECK (status IN ('pending', 'received', 'paid')),
      created_at TEXT NOT NULL,
      CHECK (
        (account_id IS NOT NULL AND card_id IS NULL) OR
        (account_id IS NULL AND card_id IS NOT NULL)
      )
    );

    CREATE INDEX IF NOT EXISTS idx_entries_account_date
      ON entries (account_id, date);
  `)

  if (!hasColumn(database, 'entries', 'payment_state')) {
    database.exec(
      `ALTER TABLE entries
       ADD COLUMN payment_state TEXT NOT NULL DEFAULT 'auto'`,
    )
  }

  if (!hasColumn(database, 'entries', 'payment_date')) {
    database.exec('ALTER TABLE entries ADD COLUMN payment_date TEXT')
  }

  if (!hasColumn(database, 'entries', 'month_end')) {
    database.exec(
      'ALTER TABLE entries ADD COLUMN month_end INTEGER NOT NULL DEFAULT 0',
    )
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS entry_occurrence_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
      occurrence_month TEXT NOT NULL,
      state TEXT NOT NULL CHECK (state IN ('paid', 'unpaid')),
      payment_date TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (entry_id, occurrence_month)
    );

    CREATE TABLE IF NOT EXISTS entry_occurrence_exceptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
      occurrence_month TEXT NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('edit', 'exclude')),
      due_date TEXT,
      amount REAL,
      description TEXT,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      statement_name TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      UNIQUE (entry_id, occurrence_month)
    );

    CREATE INDEX IF NOT EXISTS idx_occurrence_payments_entry_month
      ON entry_occurrence_payments (entry_id, occurrence_month);

    CREATE INDEX IF NOT EXISTS idx_occurrence_exceptions_entry_month
      ON entry_occurrence_exceptions (entry_id, occurrence_month);
  `)

  migrateEntriesForCards(database)
  database.exec(
    'CREATE INDEX IF NOT EXISTS idx_entries_card_date ON entries (card_id, date)',
  )
  migrateEntryDestinationAccount(database)
  migrateExpandedSeries(database)
  migrateCardInvoiceAdjustments(database)
  migrateCardInvoicePayments(database)
}

function migrateCardInvoiceAdjustments(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS card_invoice_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      invoice_month TEXT NOT NULL,
      amount REAL NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (card_id, invoice_month)
    );

    CREATE INDEX IF NOT EXISTS idx_card_invoice_adj_card_month
      ON card_invoice_adjustments (card_id, invoice_month);
  `)
}

function migrateCardInvoicePayments(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS card_invoice_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      invoice_month TEXT NOT NULL,
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      entry_id INTEGER NOT NULL REFERENCES entries(id),
      entries_subtotal REAL NOT NULL,
      adjustment REAL NOT NULL DEFAULT 0,
      total_paid REAL NOT NULL,
      payment_date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (card_id, invoice_month)
    );

    CREATE INDEX IF NOT EXISTS idx_card_invoice_pay_card_month
      ON card_invoice_payments (card_id, invoice_month);
  `)
}

export function useDb() {
  if (!db) {
    // Arquivo persistente fora do .output; sobrescreva com LUMEN_DB_PATH se necessário.
    const file =
      process.env.LUMEN_DB_PATH ?? join(process.cwd(), '.data', 'lumen.sqlite3')

    mkdirSync(dirname(file), { recursive: true })

    db = new Database(file)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    migrate(db)
    seedCategoriesIfEmpty(db)
    seedAccountsIfEmpty(db)
  }

  return db
}

/** Data local no formato YYYY-MM-DD (sem UTC). */
export function todayLocal(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  return `${now.getFullYear()}-${month}-${day}`
}

export function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE'
  )
}
