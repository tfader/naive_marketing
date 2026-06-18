import { ref } from 'vue'
import api from '../api/client'

interface SchemaAttr {
  name: string
  label: string
  enabled: boolean
}
interface SchemaModel {
  model: string
  label: string
  whole_enabled: boolean
  attributes: SchemaAttr[]
}

// Loaded once; drives whether a comment affordance shows up anywhere in the app.
const schema = ref<SchemaModel[]>([])
let loaded = false

export async function loadCommentable(force = false): Promise<void> {
  if (loaded && !force) return
  try {
    const { data } = await api.get('/commentable_settings')
    schema.value = data
    loaded = true
  } catch {
    /* leave empty — nothing commentable */
  }
}

export function isCommentable(refModel: string, attribute?: string | null): boolean {
  const m = schema.value.find((s) => s.model === refModel)
  if (!m) return false
  if (attribute == null) return m.whole_enabled
  return m.attributes.some((a) => a.name === attribute && a.enabled)
}

export { schema }
