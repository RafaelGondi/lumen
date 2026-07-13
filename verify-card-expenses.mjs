import Database from 'better-sqlite3'

const base = 'http://127.0.0.1:3003'

async function api(path, options = {}) {
  const response = await fetch(base + path, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers ?? {}),
    },
  })
  const text = await response.text()
  const data = text ? JSON.parse(text) : null
  if (!response.ok) {
    throw new Error(`${response.status} ${path}: ${JSON.stringify(data)}`)
  }
  return data
}

function assert(value, message) {
  if (!value) throw new Error(message)
}

let cardId = null
try {
  const accountsBefore = await api('/api/accounts')
  const before = JSON.stringify(
    accountsBefore.map((account) => [account.id, account.balance]),
  )
  const card = await api('/api/cards', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Teste corte 25',
      bankKey: 'itau',
      bankName: 'Itaú',
      color: '#14508f',
      lastFour: '2525',
      creditLimit: 5000,
      closingDay: 25,
      dueDay: 1,
      active: true,
    }),
  })
  cardId = card.id
  const create = (
    description,
    amount,
    date,
    recurrence = 'single',
    installmentCount = null,
  ) =>
    api(`/api/cards/${cardId}/expenses`, {
      method: 'POST',
      body: JSON.stringify({
        description,
        amount,
        categoryId: null,
        statementName: null,
        notes: null,
        recurrence,
        date,
        endDate: null,
        installmentCount,
        useMonthEnd: false,
      }),
    })

  const jul09 = await create('Compra 09/07', 10, '2026-07-09')
  const jul26 = await create('Compra 26/07', 20, '2026-07-26')
  await create('Limite inicial 26/06', 30, '2026-06-26')
  await create('Limite final 25/07', 40, '2026-07-25')
  await create('Fora da janela 26/07', 50, '2026-07-26')
  await create('Parcelada 3x', 100, '2026-07-09', 'installment', 3)

  const july = await api(`/api/cards/${cardId}/invoice?month=2026-07`)
  const august = await api(`/api/cards/${cardId}/invoice?month=2026-08`)
  const september = await api(`/api/cards/${cardId}/invoice?month=2026-09`)
  const october = await api(`/api/cards/${cardId}/invoice?month=2026-10`)

  assert(
    !july.entries.some((entry) => entry.description === 'Compra 09/07'),
    '09/07 apareceu em julho',
  )
  assert(
    august.entries.some((entry) => entry.description === 'Compra 09/07'),
    '09/07 não apareceu em agosto',
  )
  assert(
    !august.entries.some((entry) => entry.description === 'Compra 26/07'),
    '26/07 apareceu em agosto',
  )
  assert(
    september.entries.some((entry) => entry.description === 'Compra 26/07'),
    '26/07 não apareceu em setembro',
  )
  assert(
    august.entries.every(
      (entry) => entry.date >= '2026-06-26' && entry.date <= '2026-07-25',
    ),
    'Agosto contém item fora da janela',
  )
  assert(
    august.entries.some(
      (entry) => entry.description === 'Limite inicial 26/06',
    ) &&
      august.entries.some(
        (entry) => entry.description === 'Limite final 25/07',
      ) &&
      !august.entries.some(
        (entry) => entry.description === 'Fora da janela 26/07',
      ),
    'Janela 26/06..25/07 incorreta',
  )
  assert(
    august.entries.some(
      (entry) =>
        entry.description === 'Parcelada 3x' &&
        entry.installmentIndex === 1,
    ),
    'Parcela 1 ausente em agosto',
  )
  assert(
    september.entries.some(
      (entry) =>
        entry.description === 'Parcelada 3x' &&
        entry.installmentIndex === 2,
    ),
    'Parcela 2 ausente em setembro',
  )
  assert(
    october.entries.some(
      (entry) =>
        entry.description === 'Parcelada 3x' &&
        entry.installmentIndex === 3,
    ),
    'Parcela 3 ausente em outubro',
  )

  await api(`/api/cards/${cardId}/expenses/${jul09.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      occurrenceMonth: '2026-07',
      scope: 'series',
      description: 'Compra 09/07 editada',
      amount: 15,
      categoryId: null,
      statementName: null,
      notes: null,
      date: '2026-07-09',
    }),
  })
  const edited = await api(`/api/cards/${cardId}/invoice?month=2026-08`)
  assert(
    edited.entries.some(
      (entry) =>
        entry.description === 'Compra 09/07 editada' && entry.amount === 15,
    ),
    'Edição não refletiu na fatura',
  )

  await api(
    `/api/cards/${cardId}/expenses/${jul26.id}?scope=series&occurrenceMonth=2026-07`,
    { method: 'DELETE' },
  )
  const deleted = await api(`/api/cards/${cardId}/invoice?month=2026-09`)
  assert(
    !deleted.entries.some((entry) => entry.description === 'Compra 26/07'),
    'Exclusão não refletiu na fatura',
  )

  const accountsAfter = await api('/api/accounts')
  const after = JSON.stringify(
    accountsAfter.map((account) => [account.id, account.balance]),
  )
  assert(before === after, 'Saldo das contas mudou')

  const db = new Database('.data/lumen.sqlite3', { readonly: true })
  const persisted = db
    .prepare('SELECT COUNT(*) AS count FROM entries WHERE card_id = ?')
    .get(cardId).count
  db.close()
  assert(persisted === 5, `Persistência SQLite inesperada: ${persisted}`)

  console.log(
    JSON.stringify(
      {
        julyTotal: july.total,
        augustTotal: august.total,
        septemberTotal: september.total,
        octoberTotal: october.total,
        augustWindow: august.entries.map((entry) => entry.date),
        installments: [1, 2, 3],
        editOk: true,
        deleteOk: true,
        persistedRows: persisted,
        accountBalancesUnchanged: true,
      },
      null,
      2,
    ),
  )
} finally {
  if (cardId) {
    await api(`/api/cards/${cardId}`, { method: 'DELETE' }).catch(() => {})
  }
}

