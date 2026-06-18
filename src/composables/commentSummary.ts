import { ref } from 'vue'
import api from '../api/client'

export interface CommentStat {
  total: number
  unread: number
}
type SummaryMap = Record<string, Record<string, Record<string, CommentStat>>>

export interface SummaryTarget {
  ref_model: string
  ref_ids: number[]
}

const summary = ref<SummaryMap>({})

export async function loadSummary(targets: SummaryTarget[]): Promise<void> {
  const filtered = targets.filter((t) => t.ref_ids.length)
  if (!filtered.length) {
    summary.value = {}
    return
  }
  try {
    const { data } = await api.post('/comments/summary', { targets: filtered })
    summary.value = data
  } catch {
    /* keep previous */
  }
}

export function summaryFor(refModel: string, refId: number, attribute: string | null): CommentStat | null {
  return summary.value[refModel]?.[String(refId)]?.[attribute ?? '__whole__'] ?? null
}

export { summary }
