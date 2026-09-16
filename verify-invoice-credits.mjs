const base =
  process.env.LUMEN_CARD_TEST_BASE_URL ?? 'http://127.0.0.1:3003'

async function api(path, options = {}, expectedStatus = null) {
  const response = await fetch(base + path, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers ?? {}),
    },
  })
  const text = await response.text()
  const data = text ? JSON.parse(text) : null
  if (expectedStatus !== null) {
    if (response.status !== expectedStatus) {
      throw new Error(
        `${response.status} ${path}; esperado ${expectedStatus}: ${text}`,
      )
    }
    return data
  }
  if (!response.ok) {
    throw new Error(`${response.status} ${path}: ${text}`)
  }
  return data
}

function assert(value, message) {
  if (!value) throw new Error(message)
}

let cardId = null
let paymentEntryId = null

try {
  const accountsBefore = await api('/api/accounts')
  const balancesBefore = JSON.stringify(
    accountsBefore.map((account) => [account.id, account.balance]),
  )
  const accountId = accountsBefore[0]?.id
  assert(accountId, 'Nenhuma conta disponível para validar o pagamento')

  const card = await api('/api/cards', {
    method: 'POST',
    body: JSON.stringify({
      name: `Auditoria estorno ${Date.now()}`,
      bankKey: 'custom',
      bankName: 'Auditoria',
      color: '#315c4c',
      lastFour: null,
      creditLimit: 2000,
      closingDay: 25,
      dueDay: 10,
      active: true,
    }),
  })
  cardId = card.id

  const expense = await api(`/api/cards/${cardId}/expenses`, {
    method: 'POST',
    body: JSON.stringify({
      description: 'Compra para validar estorno',
      amount: 500,
      categoryId: null,
      statementName: null,
      notes: null,
      recurrence: 'single',
      date: '2026-08-01',
      endDate: null,
      installmentCount: null,
      useMonthEnd: false,
    }),
  })
  const month = expense.invoiceMonth

  const before = await api(`/api/cards/${cardId}/invoice?month=${month}`)
  assert(before.total === 500, 'Total inicial da fatura incorreto')
  assert(before.creditsTotal === 0, 'Fatura iniciou com estorno')

  const credit = await api(`/api/cards/${cardId}/invoice/credits`, {
    method: 'POST',
    body: JSON.stringify({
      month,
      description: 'Estorno de teste',
      creditAmount: 150,
      creditedAt: '2026-08-10',
      notes: 'Validação automática',
    }),
  })

  const credited = await api(`/api/cards/${cardId}/invoice?month=${month}`)
  assert(credited.total === 350, 'Estorno não reduziu o total da fatura')
  assert(credited.creditsTotal === 150, 'Total de estornos incorreto')
  assert(
    credited.credits.some((item) => item.id === credit.id),
    'Estorno não apareceu entre os lançamentos da fatura',
  )
  assert(
    credited.projection.find((item) => item.month === month)?.amount === 350,
    'Estorno não reduziu a projeção do cartão',
  )

  await api(
    `/api/cards/${cardId}/invoice/credits`,
    {
      method: 'POST',
      body: JSON.stringify({
        month,
        description: 'Estorno acima da fatura',
        creditAmount: 351,
        creditedAt: '2026-08-10',
        notes: null,
      }),
    },
    400,
  )

  await api(`/api/cards/${cardId}/invoice/credits/${credit.id}`, {
    method: 'DELETE',
  })
  const removed = await api(`/api/cards/${cardId}/invoice?month=${month}`)
  assert(removed.total === 500, 'Remoção do estorno não restaurou a fatura')

  await api(`/api/cards/${cardId}/invoice/credits`, {
    method: 'POST',
    body: JSON.stringify({
      month,
      description: 'Estorno definitivo de teste',
      creditAmount: 100,
      creditedAt: '2026-08-10',
      notes: null,
    }),
  })
  const payment = await api(`/api/cards/${cardId}/invoice/payment`, {
    method: 'POST',
    body: JSON.stringify({
      month,
      accountId,
      paymentDate: '2026-09-10',
      adjustment: null,
      rewardCurrencyRate: null,
      notes: 'Pagamento descartável da auditoria',
    }),
  })
  paymentEntryId = payment.entryId
  assert(payment.invoice.total === 400, 'Pagamento ignorou o estorno')

  await api(
    `/api/cards/${cardId}/invoice/credits`,
    {
      method: 'POST',
      body: JSON.stringify({
        month,
        description: 'Estorno após pagamento',
        creditAmount: 10,
        creditedAt: '2026-09-10',
        notes: null,
      }),
    },
    400,
  )

  await api(`/api/cards/${cardId}`, { method: 'DELETE' })
  cardId = null
  await api(`/api/entries/${paymentEntryId}?scope=series`, {
    method: 'DELETE',
  })
  paymentEntryId = null

  const accountsAfter = await api('/api/accounts')
  const balancesAfter = JSON.stringify(
    accountsAfter.map((account) => [account.id, account.balance]),
  )
  assert(
    balancesBefore === balancesAfter,
    'A auditoria deixou alteração no saldo das contas',
  )

  console.log(
    JSON.stringify(
      {
        invoiceMonth: month,
        initialTotal: 500,
        creditedTotal: 350,
        paidTotal: 400,
        projectionUpdated: true,
        paidInvoiceProtected: true,
        accountBalancesUnchanged: true,
      },
      null,
      2,
    ),
  )
} finally {
  if (cardId) {
    await fetch(`${base}/api/cards/${cardId}`, { method: 'DELETE' })
  }
  if (paymentEntryId) {
    await fetch(`${base}/api/entries/${paymentEntryId}?scope=series`, {
      method: 'DELETE',
    })
  }
}
