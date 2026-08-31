import { ensureMonthlyCashFlowSnapshot } from '../utils/cashFlow'

const CHECK_INTERVAL_MS = 30_000
const RECOVERY_WINDOW_LAST_DAY = 2
const BAHIA_TIME_ZONE = 'America/Bahia'

const bahiaDateTime = new Intl.DateTimeFormat('en-CA', {
  timeZone: BAHIA_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

function bahiaClock(now = new Date()) {
  const parts = Object.fromEntries(
    bahiaDateTime
      .formatToParts(now)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )
  const date = `${parts.year}-${parts.month}-${parts.day}`
  return {
    date,
    dateTime: `${date}T${parts.hour}:${parts.minute}:${parts.second}`,
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  }
}

/**
 * Captura a curva esperada logo após a virada do mês. O processo roda no
 * fuso America/Bahia, sem alterar o fuso global usado pelo restante do app.
 *
 * O índice único de `snapshot_month` mantém a operação idempotente. Se o
 * processo reiniciar no começo do mês, a recuperação preenche uma eventual
 * lacuna e registra explicitamente que não foi a captura agendada.
 */
export default defineNitroPlugin((nitroApp) => {
  let completedMonth: string | null = null

  const capture = (
    kind: 'scheduled' | 'recovery',
    clock = bahiaClock(),
  ) => {
    const month = clock.date.slice(0, 7)
    if (completedMonth === month) return

    try {
      ensureMonthlyCashFlowSnapshot(
        useDb(),
        kind,
        clock.date,
        clock.dateTime,
      )
      completedMonth = month
    } catch (error) {
      console.error('[cash-flow-snapshot] Falha ao capturar curva mensal.', error)
    }
  }

  const startedAt = bahiaClock()
  if (startedAt.day <= RECOVERY_WINDOW_LAST_DAY) {
    const onSchedule =
      startedAt.day === 1 && startedAt.hour === 0 && startedAt.minute < 5
    capture(onSchedule ? 'scheduled' : 'recovery', startedAt)
  }

  const timer = setInterval(() => {
    const now = bahiaClock()
    if (now.day !== 1) return
    const onSchedule = now.hour === 0 && now.minute < 5
    capture(onSchedule ? 'scheduled' : 'recovery', now)
  }, CHECK_INTERVAL_MS)
  timer.unref()

  nitroApp.hooks.hook('close', () => clearInterval(timer))
})
