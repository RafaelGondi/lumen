export default defineEventHandler(async (event) => {
  const payload = parseAssetPayload(await readBody(event))
  const now = new Date().toISOString()
  const result = useDb().prepare(
    `INSERT INTO assets (
       type, name, current_balance, monthly_contribution,
       annual_yield_rate, balance_date, notes, active, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
  ).run(
    payload.type,
    payload.name,
    payload.currentBalance,
    payload.monthlyContribution,
    payload.annualYieldRate,
    payload.balanceDate,
    payload.notes,
    now,
    now,
  )
  setResponseStatus(event, 201)
  return { id: Number(result.lastInsertRowid) }
})
