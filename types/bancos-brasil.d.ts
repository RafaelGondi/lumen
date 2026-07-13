declare module '@edusites/bancos-brasil' {
  export interface SvgBancoOptions {
    nome: string
    formato?: 'quadrado' | 'circulo' | string
    cor?: string
    fundo?: string
    tamanho?: number
  }

  export function svgBanco(options: SvgBancoOptions): Promise<string>
  export function listarBancos(): string[]
  export function obterPreset(nome: string): Record<string, unknown> | undefined
}
