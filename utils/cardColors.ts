export type CardColorOption = {
  key: string
  label: string
  value: string
}

/** Paleta de cores do cartão (além da cor automática do banco). */
export const cardColorOptions: CardColorOption[] = [
  { key: 'bank', label: 'Banco', value: '' },
  { key: 'black', label: 'Preto', value: '#1a1a1a' },
  { key: 'navy', label: 'Marinho', value: '#0b2545' },
  { key: 'darkBlue', label: 'Azul escuro', value: '#12355b' },
  { key: 'blue', label: 'Azul', value: '#1f5da3' },
  { key: 'lightBlue', label: 'Azul claro', value: '#3d7ebd' },
  { key: 'cyan', label: 'Ciano', value: '#0e8a9a' },
  { key: 'green', label: 'Verde', value: '#1f6b4a' },
  { key: 'lime', label: 'Lima', value: '#5a8f2f' },
  { key: 'indigo', label: 'Índigo', value: '#3f3d9e' },
  { key: 'purple', label: 'Roxo', value: '#6b3fa0' },
  { key: 'pink', label: 'Rosa', value: '#b83280' },
  { key: 'red', label: 'Vermelho', value: '#a83232' },
  { key: 'orange', label: 'Laranja', value: '#c45c16' },
  { key: 'gold', label: 'Dourado', value: '#9a7b2f' },
  { key: 'silver', label: 'Prata', value: '#6b7280' },
]

export function resolveCardColor(
  selected: string,
  bankColor: string,
): string {
  if (!selected || selected === 'bank') return bankColor
  const match = cardColorOptions.find(
    (option) => option.key === selected || option.value === selected,
  )
  return match?.value || selected || bankColor
}
