import type {
  CategoryPayload,
  CategoryType,
  SupercategoryPayload,
} from '~/types/category'

const CATEGORY_TYPES: CategoryType[] = ['expense', 'income', 'transfer']
const HEX_COLOR = /^#[0-9a-f]{6}$/i

function badRequest(message: string): never {
  throw createError({ statusCode: 400, statusMessage: message })
}

function parseName(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    badRequest('Informe um nome.')
  }

  const name = value.trim()

  if (name.length > 60) {
    badRequest('O nome deve ter no máximo 60 caracteres.')
  }

  return name
}

function parseColor(value: unknown): string {
  if (typeof value !== 'string' || !HEX_COLOR.test(value)) {
    badRequest('Cor inválida.')
  }

  return value.toLowerCase()
}

function parseIcon(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 40) {
    badRequest('Ícone inválido.')
  }

  return value
}

export function parseCategoryPayload(body: unknown): CategoryPayload {
  if (!body || typeof body !== 'object') {
    badRequest('Corpo da requisição inválido.')
  }

  const raw = body as Record<string, unknown>

  if (!CATEGORY_TYPES.includes(raw.type as CategoryType)) {
    badRequest('Tipo inválido.')
  }

  let supercategoryId: number | null = null

  if (raw.supercategoryId !== null && raw.supercategoryId !== undefined) {
    if (
      typeof raw.supercategoryId !== 'number' ||
      !Number.isInteger(raw.supercategoryId)
    ) {
      badRequest('Supercategoria inválida.')
    }

    supercategoryId = raw.supercategoryId
  }

  return {
    name: parseName(raw.name),
    type: raw.type as CategoryType,
    color: parseColor(raw.color),
    icon: parseIcon(raw.icon),
    supercategoryId,
  }
}

export function parseSupercategoryPayload(body: unknown): SupercategoryPayload {
  if (!body || typeof body !== 'object') {
    badRequest('Corpo da requisição inválido.')
  }

  const raw = body as Record<string, unknown>

  return {
    name: parseName(raw.name),
    color: parseColor(raw.color),
    icon: parseIcon(raw.icon),
  }
}

export function parseIdParam(value: string | undefined): number {
  const id = Number(value)

  if (!Number.isInteger(id) || id <= 0) {
    badRequest('Identificador inválido.')
  }

  return id
}
