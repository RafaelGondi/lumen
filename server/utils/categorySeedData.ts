import type { CategoryType } from '~/types/category'

export interface SeedSupercategory {
  name: string
  color: string
  icon: string
}

export interface SeedCategory {
  name: string
  type: CategoryType
  color: string
  icon: string
  supercategory: string | null
}

export const seedSupercategories: SeedSupercategory[] = [
  { name: 'Assinatura', color: '#d9541e', icon: 'repeat' },
  { name: 'Carro', color: '#2f6fce', icon: 'car' },
  { name: 'Casa', color: '#6b4423', icon: 'house' },
  { name: 'Comida', color: '#c62828', icon: 'utensils' },
  { name: 'Dívida / juros', color: '#8e1b1b', icon: 'wallet' },
  { name: 'Livros', color: '#188a66', icon: 'graduation-cap' },
  { name: 'Saúde', color: '#2f9e4f', icon: 'stethoscope' },
  { name: 'Vestuário', color: '#d98e0b', icon: 'shirt' },
]

export const seedCategories: SeedCategory[] = [
  // Receitas
  { name: 'Ajuste (entrada)', type: 'income', color: '#2f6fce', icon: 'circle-dollar', supercategory: null },
  { name: 'Ajuste de contas em grupo', type: 'income', color: '#0f9b8e', icon: 'handshake', supercategory: null },
  { name: 'Cashback', type: 'income', color: '#166534', icon: 'coins', supercategory: null },
  { name: 'Décimo terceiro', type: 'income', color: '#2f9e4f', icon: 'banknote', supercategory: null },
  { name: 'Empréstimo (entrada)', type: 'income', color: '#7ba616', icon: 'handshake', supercategory: null },
  { name: 'Freela', type: 'income', color: '#1990c9', icon: 'briefcase', supercategory: null },
  { name: 'Rendimento', type: 'income', color: '#c2a018', icon: 'sparkles', supercategory: null },
  { name: 'Restituição do imposto de renda', type: 'income', color: '#1e3a6b', icon: 'landmark', supercategory: null },
  { name: 'Salário', type: 'income', color: '#188a66', icon: 'banknote', supercategory: null },
  { name: 'VA', type: 'income', color: '#c2337f', icon: 'utensils', supercategory: null },

  // Despesas
  { name: 'Academia', type: 'expense', color: '#c62828', icon: 'dumbbell', supercategory: null },
  { name: 'Ajuste', type: 'expense', color: '#d9541e', icon: 'wallet', supercategory: 'Dívida / juros' },
  { name: 'Ajuste de contas em grupo (saída)', type: 'expense', color: '#1990c9', icon: 'handshake', supercategory: null },
  { name: 'App música', type: 'expense', color: '#7c4dc4', icon: 'music', supercategory: null },
  { name: 'Assinatura', type: 'expense', color: '#d98e0b', icon: 'repeat', supercategory: null },
  { name: 'Bebida', type: 'expense', color: '#96591c', icon: 'coffee', supercategory: null },
  { name: 'Calçado', type: 'expense', color: '#6b4423', icon: 'footprints', supercategory: 'Vestuário' },
  { name: 'Celular', type: 'expense', color: '#5b5bd6', icon: 'phone', supercategory: null },
  { name: 'Consulta', type: 'expense', color: '#2f9e4f', icon: 'stethoscope', supercategory: 'Saúde' },
  { name: 'Consórcio do carro', type: 'expense', color: '#188a66', icon: 'car', supercategory: 'Carro' },
  { name: 'Curso', type: 'expense', color: '#1990c9', icon: 'graduation-cap', supercategory: null },
  { name: 'Eletrodoméstico', type: 'expense', color: '#44484f', icon: 'refrigerator', supercategory: null },
  { name: 'Empréstimo', type: 'expense', color: '#d98e0b', icon: 'wallet', supercategory: 'Dívida / juros' },
  { name: 'Energia', type: 'expense', color: '#d98e0b', icon: 'zap', supercategory: 'Casa' },
  { name: 'Energético', type: 'expense', color: '#c2a018', icon: 'flame', supercategory: null },
  { name: 'Estacionamento', type: 'expense', color: '#c2a018', icon: 'parking', supercategory: 'Carro' },
  { name: 'Farmácia', type: 'expense', color: '#c62828', icon: 'pill', supercategory: 'Saúde' },
  { name: 'Feira', type: 'expense', color: '#c2a018', icon: 'shopping-cart', supercategory: 'Casa' },
  { name: 'Financiamento do carro', type: 'expense', color: '#2f6fce', icon: 'car', supercategory: 'Carro' },
  { name: 'Games', type: 'expense', color: '#5b5bd6', icon: 'gamepad', supercategory: null },
  { name: 'Gasolina', type: 'expense', color: '#d9541e', icon: 'fuel', supercategory: 'Carro' },
  { name: 'IA', type: 'expense', color: '#7c4dc4', icon: 'sparkles', supercategory: null },
  { name: 'IPVA', type: 'expense', color: '#1d4ed8', icon: 'receipt', supercategory: 'Carro' },
  { name: 'Ifood', type: 'expense', color: '#c62828', icon: 'utensils', supercategory: 'Comida' },
  { name: 'Internet', type: 'expense', color: '#2f6fce', icon: 'wifi', supercategory: 'Casa' },
  { name: 'Itens pra casa', type: 'expense', color: '#6b4423', icon: 'house', supercategory: 'Casa' },
  { name: 'Jantar fora', type: 'expense', color: '#e0526f', icon: 'utensils', supercategory: 'Comida' },
  { name: 'Juros', type: 'expense', color: '#c62828', icon: 'wallet', supercategory: 'Dívida / juros' },
  { name: 'Lanche', type: 'expense', color: '#8e1b1b', icon: 'pizza', supercategory: 'Comida' },
  { name: 'Lava-jato', type: 'expense', color: '#1990c9', icon: 'droplet', supercategory: 'Carro' },
  { name: 'Livro', type: 'expense', color: '#2f9e4f', icon: 'book', supercategory: 'Livros' },
  { name: 'Livro técnico', type: 'expense', color: '#c2a018', icon: 'book', supercategory: 'Livros' },
  { name: 'Manutenção do carro', type: 'expense', color: '#5d6570', icon: 'wrench', supercategory: 'Carro' },
  { name: 'Moradia', type: 'expense', color: '#96591c', icon: 'house', supercategory: 'Casa' },
  { name: 'Não identificado', type: 'expense', color: '#8a8f98', icon: 'tag', supercategory: null },
  { name: 'Padaria', type: 'expense', color: '#d9541e', icon: 'coffee', supercategory: 'Comida' },
  { name: 'Pet', type: 'expense', color: '#d98e0b', icon: 'dog', supercategory: null },
  { name: 'Presentes', type: 'expense', color: '#c2337f', icon: 'gift', supercategory: null },
  { name: 'Roupas', type: 'expense', color: '#9333b5', icon: 'shirt', supercategory: 'Vestuário' },
  { name: 'Streaming', type: 'expense', color: '#1e3a6b', icon: 'tv', supercategory: null },
  { name: 'Taxas', type: 'expense', color: '#e0526f', icon: 'receipt', supercategory: 'Dívida / juros' },
  { name: 'Terapia', type: 'expense', color: '#1990c9', icon: 'brain', supercategory: 'Saúde' },
  { name: 'Whishlist', type: 'expense', color: '#7c4dc4', icon: 'sparkles', supercategory: null },
]
