import { ref } from 'vue'
import api from '../api/client'

export interface Parameter {
  id: number
  key: string
  label: string
  value: string | null
  value_type: 'string' | 'number' | 'boolean' | 'select'
  options: string[] | null
  description: string | null
  position: number
}

// Module-level cache so any component can read parameters reactively.
const parameters = ref<Parameter[]>([])
let loaded = false

export async function loadParameters(force = false): Promise<void> {
  if (loaded && !force) return
  const { data } = await api.get('/parameters')
  parameters.value = data
  loaded = true
}

export function paramValue(key: string): string | null {
  return parameters.value.find((p) => p.key === key)?.value ?? null
}

export function currency(): string {
  return paramValue('currency') || 'PLN'
}

// Locale drives separators: en-US → "1,234.56", de-DE → "1.234,56".
export function numberLocale(): string {
  return paramValue('number_format') === '1.234,56' ? 'de-DE' : 'en-US'
}

// For NInputNumber :format / :parse — honour the configured decimal separator.
export function formatNumberInput(value: number | null): string {
  if (value == null) return ''
  const s = String(value)
  return numberLocale() === 'de-DE' ? s.replace('.', ',') : s
}
export function parseNumberInput(input: string): number | null {
  if (input == null) return null
  const s = String(input).trim()
  if (s === '') return null
  const normalized = numberLocale() === 'de-DE' ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  const n = Number(normalized)
  return Number.isNaN(n) ? null : n
}

// Money formatted with the configured currency (e.g. "PLN 1,234.56").
export function formatMoney(v: string | number | null | undefined): string {
  if (v == null || v === '') return '—'
  const n = Number(v)
  if (Number.isNaN(n)) return '—'
  try {
    return new Intl.NumberFormat(numberLocale(), {
      style: 'currency',
      currency: currency(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n)
  } catch {
    return n.toFixed(2)
  }
}

// Plain number with thousands separators (for volumes, counts).
export function formatNumber(v: string | number | null | undefined, maxDigits = 2): string {
  if (v == null || v === '') return '—'
  const n = Number(v)
  if (Number.isNaN(n)) return '—'
  return new Intl.NumberFormat(numberLocale(), { minimumFractionDigits: 0, maximumFractionDigits: maxDigits }).format(n)
}

export { parameters }
