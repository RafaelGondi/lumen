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
  { name: 'Assinatura', color: '#b46440', icon: 'repeat' },
  { name: 'Carro', color: '#3a6a97', icon: 'car' },
  { name: 'Casa', color: '#924e2f', icon: 'house' },
  { name: 'Comida', color: '#c65b58', icon: 'utensils' },
  { name: 'Dívida / juros', color: '#883534', icon: 'wallet' },
  { name: 'Livros', color: '#3c8866', icon: 'graduation-cap' },
  { name: 'Saúde', color: '#4ca67e', icon: 'stethoscope' },
  { name: 'Vestuário', color: '#b68639', icon: 'shirt' },
]

export const seedCategories: SeedCategory[] = [
  // Receitas
  { name: 'Ajuste (entrada)', type: 'income', color: '#3a6a97', icon: 'circle-dollar', supercategory: null },
  { name: 'Ajuste de contas em grupo', type: 'income', color: '#469f8b', icon: 'handshake', supercategory: null },
  { name: 'Cashback', type: 'income', color: '#2c6a4f', icon: 'coins', supercategory: null },
  { name: 'Décimo terceiro', type: 'income', color: '#4ca67e', icon: 'banknote', supercategory: null },
  { name: 'Empréstimo (entrada)', type: 'income', color: '#68b894', icon: 'handshake', supercategory: null },
  { name: 'Freela', type: 'income', color: '#5184b1', icon: 'briefcase', supercategory: null },
  { name: 'Rendimento', type: 'income', color: '#c9a05e', icon: 'sparkles', supercategory: null },
  { name: 'Restituição do imposto de renda', type: 'income', color: '#2b5176', icon: 'landmark', supercategory: null },
  { name: 'Salário', type: 'income', color: '#3c8866', icon: 'banknote', supercategory: null },
  { name: 'VA', type: 'income', color: '#ac5468', icon: 'utensils', supercategory: null },

  // Despesas
  { name: 'Academia', type: 'expense', color: '#c65b58', icon: 'dumbbell', supercategory: null },
  { name: 'Ajuste', type: 'expense', color: '#b46440', icon: 'wallet', supercategory: 'Dívida / juros' },
  { name: 'Ajuste de contas em grupo (saída)', type: 'expense', color: '#5184b1', icon: 'handshake', supercategory: null },
  { name: 'App música', type: 'expense', color: '#6354bc', icon: 'music', supercategory: null },
  { name: 'Assinatura', type: 'expense', color: '#b68639', icon: 'repeat', supercategory: null },
  { name: 'Bebida', type: 'expense', color: '#7c581e', icon: 'coffee', supercategory: null },
  { name: 'Calçado', type: 'expense', color: '#924e2f', icon: 'footprints', supercategory: 'Vestuário' },
  { name: 'Celular', type: 'expense', color: '#8375cc', icon: 'phone', supercategory: null },
  { name: 'Consulta', type: 'expense', color: '#4ca67e', icon: 'stethoscope', supercategory: 'Saúde' },
  { name: 'Consórcio do carro', type: 'expense', color: '#3c8866', icon: 'car', supercategory: 'Carro' },
  { name: 'Curso', type: 'expense', color: '#5184b1', icon: 'graduation-cap', supercategory: null },
  { name: 'Eletrodoméstico', type: 'expense', color: '#36485a', icon: 'refrigerator', supercategory: null },
  { name: 'Empréstimo', type: 'expense', color: '#b68639', icon: 'wallet', supercategory: 'Dívida / juros' },
  { name: 'Energia', type: 'expense', color: '#b68639', icon: 'zap', supercategory: 'Casa' },
  { name: 'Energético', type: 'expense', color: '#c9a05e', icon: 'flame', supercategory: null },
  { name: 'Estacionamento', type: 'expense', color: '#c9a05e', icon: 'parking', supercategory: 'Carro' },
  { name: 'Farmácia', type: 'expense', color: '#c65b58', icon: 'pill', supercategory: 'Saúde' },
  { name: 'Feira', type: 'expense', color: '#c9a05e', icon: 'shopping-cart', supercategory: 'Casa' },
  { name: 'Financiamento do carro', type: 'expense', color: '#3a6a97', icon: 'car', supercategory: 'Carro' },
  { name: 'Games', type: 'expense', color: '#8375cc', icon: 'gamepad', supercategory: null },
  { name: 'Gasolina', type: 'expense', color: '#b46440', icon: 'fuel', supercategory: 'Carro' },
  { name: 'IA', type: 'expense', color: '#6354bc', icon: 'sparkles', supercategory: null },
  { name: 'IPVA', type: 'expense', color: '#4d3f9c', icon: 'receipt', supercategory: 'Carro' },
  { name: 'Ifood', type: 'expense', color: '#c65b58', icon: 'utensils', supercategory: 'Comida' },
  { name: 'Internet', type: 'expense', color: '#3a6a97', icon: 'wifi', supercategory: 'Casa' },
  { name: 'Itens pra casa', type: 'expense', color: '#924e2f', icon: 'house', supercategory: 'Casa' },
  { name: 'Jantar fora', type: 'expense', color: '#c36d80', icon: 'utensils', supercategory: 'Comida' },
  { name: 'Juros', type: 'expense', color: '#c65b58', icon: 'wallet', supercategory: 'Dívida / juros' },
  { name: 'Lanche', type: 'expense', color: '#883534', icon: 'pizza', supercategory: 'Comida' },
  { name: 'Lava-jato', type: 'expense', color: '#5184b1', icon: 'droplet', supercategory: 'Carro' },
  { name: 'Livro', type: 'expense', color: '#4ca67e', icon: 'book', supercategory: 'Livros' },
  { name: 'Livro técnico', type: 'expense', color: '#c9a05e', icon: 'book', supercategory: 'Livros' },
  { name: 'Manutenção do carro', type: 'expense', color: '#475d76', icon: 'wrench', supercategory: 'Carro' },
  { name: 'Moradia', type: 'expense', color: '#7c581e', icon: 'house', supercategory: 'Casa' },
  { name: 'Não identificado', type: 'expense', color: '#7e93a9', icon: 'tag', supercategory: null },
  { name: 'Padaria', type: 'expense', color: '#b46440', icon: 'coffee', supercategory: 'Comida' },
  { name: 'Pet', type: 'expense', color: '#b68639', icon: 'dog', supercategory: null },
  { name: 'Presentes', type: 'expense', color: '#ac5468', icon: 'gift', supercategory: null },
  { name: 'Roupas', type: 'expense', color: '#905996', icon: 'shirt', supercategory: 'Vestuário' },
  { name: 'Streaming', type: 'expense', color: '#2b5176', icon: 'tv', supercategory: null },
  { name: 'Taxas', type: 'expense', color: '#c36d80', icon: 'receipt', supercategory: 'Dívida / juros' },
  { name: 'Terapia', type: 'expense', color: '#5184b1', icon: 'brain', supercategory: 'Saúde' },
  { name: 'Whishlist', type: 'expense', color: '#6354bc', icon: 'sparkles', supercategory: null },
]
