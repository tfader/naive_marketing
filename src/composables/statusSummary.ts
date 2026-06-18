import { ref } from 'vue'
import api from '../api/client'

export interface StatusValue {
  id: number
  name: string
  color: string
}
type SummaryMap = Record<string, Record<string, Record<string, StatusValue | null>>>

export interface SummaryTarget {
  ref_model: string
  ref_ids: number[]
}

const summary = ref<SummaryMap>({})

export async function loadStatusSummary(targets: SummaryTarget[]): Promise<void> {
  const filtered = targets.filter((t) => t.ref_ids.length)
  if (!filtered.length) {
    summary.value = {}
    return
  }
  try {
    const { data } = await api.post('/status_assignments/summary', { targets: filtered })
    summary.value = data
  } catch {
    /* keep previous */
  }
}

export function statusFor(refModel: string, refId: number, attribute: string | null): StatusValue | null {
  return summary.value[refModel]?.[String(refId)]?.[attribute ?? '__whole__'] ?? null
}

export { summary }
