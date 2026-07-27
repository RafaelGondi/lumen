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
  { name: 'Assinatura', color: '#ce7659', icon: 'repeat' },
  { name: 'Carro', color: '#5184b1', icon: 'car' },
  { name: 'Casa', color: '#7c581e', icon: 'house' },
  { name: 'Comida', color: '#b96246', icon: 'utensils' },
  { name: 'Dívida / juros', color: '#974d36', icon: 'wallet' },
  { name: 'Livros', color: '#3c8866', icon: 'graduation-cap' },
  { name: 'Saúde', color: '#4ca67e', icon: 'stethoscope' },
  { name: 'Vestuário', color: '#b68639', icon: 'shirt' },
]

export const seedCategories: SeedCategory[] = [
  // Receitas
  { name: 'Ajuste (entrada)', type: 'income', color: '#5184b1', icon: 'circle-dollar', supercategory: null },
  { name: 'Ajuste de contas em grupo', type: 'income', color: '#4b99a4', icon: 'handshake', supercategory: null },
  { name: 'Cashback', type: 'income', color: '#2c6a4f', icon: 'coins', supercategory: null },
  { name: 'Décimo terceiro', type: 'income', color: '#4ca67e', icon: 'banknote', supercategory: null },
  { name: 'Empréstimo (entrada)', type: 'income', color: '#68b894', icon: 'handshake', supercategory: null },
  { name: 'Freela', type: 'income', color: '#759cbe', icon: 'briefcase', supercategory: null },
  { name: 'Rendimento', type: 'income', color: '#c9a05e', icon: 'sparkles', supercategory: null },
  { name: 'Restituição do imposto de renda', type: 'income', color: '#2b5176', icon: 'landmark', supercategory: null },
  { name: 'Salário', type: 'income', color: '#3c8866', icon: 'banknote', supercategory: null },
  { name: 'VA', type: 'income', color: '#ac5468', icon: 'utensils', supercategory: null },

  // Despesas
  { name: 'Academia', type: 'expense', color: '#b96246', icon: 'dumbbell', supercategory: null },
  { name: 'Ajuste', type: 'expense', color: '#ce7659', icon: 'wallet', supercategory: 'Dívida / juros' },
  { name: 'Ajuste de contas em grupo (saída)', type: 'expense', color: '#759cbe', icon: 'handshake', supercategory: null },
  { name: 'App música', type: 'expense', color: '#6354bc', icon: 'music', supercategory: null },
  { name: 'Assinatura', type: 'expense', color: '#b68639', icon: 'repeat', supercategory: null },
  { name: 'Bebida', type: 'expense', color: '#9d712a', icon: 'coffee', supercategory: null },
  { name: 'Calçado', type: 'expense', color: '#7c581e', icon: 'footprints', supercategory: 'Vestuário' },
  { name: 'Celular', type: 'expense', color: '#8375cc', icon: 'phone', supercategory: null },
  { name: 'Consulta', type: 'expense', color: '#4ca67e', icon: 'stethoscope', supercategory: 'Saúde' },
  { name: 'Consórcio do carro', type: 'expense', color: '#3c8866', icon: 'car', supercategory: 'Carro' },
  { name: 'Curso', type: 'expense', color: '#759cbe', icon: 'graduation-cap', supercategory: null },
  { name: 'Eletrodoméstico', type: 'expense', color: '#36485a', icon: 'refrigerator', supercategory: null },
  { name: 'Empréstimo', type: 'expense', color: '#b68639', icon: 'wallet', supercategory: 'Dívida / juros' },
  { name: 'Energia', type: 'expense', color: '#b68639', icon: 'zap', supercategory: 'Casa' },
  { name: 'Energético', type: 'expense', color: '#c9a05e', icon: 'flame', supercategory: null },
  { name: 'Estacionamento', type: 'expense', color: '#c9a05e', icon: 'parking', supercategory: 'Carro' },
  { name: 'Farmácia', type: 'expense', color: '#b96246', icon: 'pill', supercategory: 'Saúde' },
  { name: 'Feira', type: 'expense', color: '#c9a05e', icon: 'shopping-cart', supercategory: 'Casa' },
  { name: 'Financiamento do carro', type: 'expense', color: '#5184b1', icon: 'car', supercategory: 'Carro' },
  { name: 'Games', type: 'expense', color: '#8375cc', icon: 'gamepad', supercategory: null },
  { name: 'Gasolina', type: 'expense', color: '#ce7659', icon: 'fuel', supercategory: 'Carro' },
  { name: 'IA', type: 'expense', color: '#6354bc', icon: 'sparkles', supercategory: null },
  { name: 'IPVA', type: 'expense', color: '#3a6a97', icon: 'receipt', supercategory: 'Carro' },
  { name: 'Ifood', type: 'expense', color: '#b96246', icon: 'utensils', supercategory: 'Comida' },
  { name: 'Internet', type: 'expense', color: '#5184b1', icon: 'wifi', supercategory: 'Casa' },
  { name: 'Itens pra casa', type: 'expense', color: '#7c581e', icon: 'house', supercategory: 'Casa' },
  { name: 'Jantar fora', type: 'expense', color: '#c36d80', icon: 'utensils', supercategory: 'Comida' },
  { name: 'Juros', type: 'expense', color: '#b96246', icon: 'wallet', supercategory: 'Dívida / juros' },
  { name: 'Lanche', type: 'expense', color: '#974d36', icon: 'pizza', supercategory: 'Comida' },
  { name: 'Lava-jato', type: 'expense', color: '#759cbe', icon: 'droplet', supercategory: 'Carro' },
  { name: 'Livro', type: 'expense', color: '#4ca67e', icon: 'book', supercategory: 'Livros' },
  { name: 'Livro técnico', type: 'expense', color: '#c9a05e', icon: 'book', supercategory: 'Livros' },
  { name: 'Manutenção do carro', type: 'expense', color: '#475d76', icon: 'wrench', supercategory: 'Carro' },
  { name: 'Moradia', type: 'expense', color: '#9d712a', icon: 'house', supercategory: 'Casa' },
  { name: 'Não identificado', type: 'expense', color: '#7e93a9', icon: 'tag', supercategory: null },
  { name: 'Padaria', type: 'expense', color: '#ce7659', icon: 'coffee', supercategory: 'Comida' },
  { name: 'Pet', type: 'expense', color: '#b68639', icon: 'dog', supercategory: null },
  { name: 'Presentes', type: 'expense', color: '#ac5468', icon: 'gift', supercategory: null },
  { name: 'Roupas', type: 'expense', color: '#4d3f9c', icon: 'shirt', supercategory: 'Vestuário' },
  { name: 'Streaming', type: 'expense', color: '#2b5176', icon: 'tv', supercategory: null },
  { name: 'Taxas', type: 'expense', color: '#c36d80', icon: 'receipt', supercategory: 'Dívida / juros' },
  { name: 'Terapia', type: 'expense', color: '#759cbe', icon: 'brain', supercategory: 'Saúde' },
  { name: 'Whishlist', type: 'expense', color: '#6354bc', icon: 'sparkles', supercategory: null },
]
