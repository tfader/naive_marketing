<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { NInputNumber, useMessage } from 'naive-ui'
import api from '../api/client'

interface Category {
  id: number
  name: string
  code: string
  parent_id: number | null
  sort_order: number
}
interface PromotionType {
  id: number
  name: string
  code: string
  sort_order: number
}
interface Entry {
  id: number
  category_id: number
  promotion_type_id: number
  promotion_factor: number
}

const DEFAULT_FACTOR = 200

const message = useMessage()
const loading = ref(false)
const categories = ref<Category[]>([])
const types = ref<PromotionType[]>([])
const entries = ref<Entry[]>([])

// key = `${categoryId}:${typeId}` → entry
const entryMap = computed(() => {
  const m = new Map<string, Entry>()
  for (const e of entries.value) m.set(`${e.category_id}:${e.promotion_type_id}`, e)
  return m
})

// Categories grouped into 2-level tree (department → subcategories), preserving sort.
interface Row {
  category: Category
  isChild: boolean
}
const rows = computed<Row[]>(() => {
  const sorted = [...categories.value].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
  const depts = sorted.filter((c) => !c.parent_id)
  const out: Row[] = []
  for (const d of depts) {
    out.push({ category: d, isChild: false })
    for (const ch of sorted.filter((c) => c.parent_id === d.id)) out.push({ category: ch, isChild: true })
  }
  return out
})

const sortedTypes = computed(() =>
  [...types.value].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
)

function factorFor(catId: number, typeId: number): number {
  return entryMap.value.get(`${catId}:${typeId}`)?.promotion_factor ?? DEFAULT_FACTOR
}

async function saveCell(catId: number, typeId: number, value: number | null) {
  if (value == null) return
  const key = `${catId}:${typeId}`
  const existing = entryMap.value.get(key)
  try {
    if (existing) {
      const { data } = await api.patch(`/category_promotion_types/${existing.id}`, { promotion_factor: value })
      const idx = entries.value.findIndex((e) => e.id === existing.id)
      if (idx >= 0) entries.value[idx] = data
    } else {
      const { data } = await api.post('/category_promotion_types', {
        category_id: catId,
        promotion_type_id: typeId,
        promotion_factor: value,
      })
      entries.value.push(data)
    }
  } catch (err: any) {
    const errors = err.response?.data?.errors
    message.error(Array.isArray(errors) ? errors.join(', ') : 'Failed to save factor')
  }
}

async function loadAll() {
  loading.value = true
  try {
    const [c, t, e] = await Promise.all([
      api.get('/categories'),
      api.get('/promotion_types'),
      api.get('/category_promotion_types'),
    ])
    categories.value = c.data
    types.value = t.data
    entries.value = e.data
  } catch {
    message.error('Failed to load data')
  } finally {
    loading.value = false
  }
}

onMounted(loadAll)
</script>

<template>
  <div class="cockpit-cpt">
    <div class="cpt-head">
      <div>
        <h1 class="cpt-title">Category Promotion Factors</h1>
        <span class="cpt-sub">expected sales uplift (%) per category × promotion type — default {{ DEFAULT_FACTOR }}</span>
      </div>
    </div>

    <div v-if="loading" class="cpt-empty">Loading…</div>
    <div v-else-if="!rows.length" class="cpt-empty">No categories yet.</div>
    <div v-else class="cpt-table-wrap">
      <table class="cpt-table">
        <thead>
          <tr>
            <th class="cpt-cat-col">Category</th>
            <th v-for="t in sortedTypes" :key="t.id" class="cpt-type-col">{{ t.name }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.category.id" :class="{ 'is-dept': !row.isChild }">
            <td class="cpt-cat-cell" :class="{ child: row.isChild }">
              <span v-if="row.isChild" class="cpt-dot"></span>{{ row.category.name }}
            </td>
            <td v-for="t in sortedTypes" :key="t.id" class="cpt-factor-cell">
              <NInputNumber
                :value="factorFor(row.category.id, t.id)"
                :min="0"
                :show-button="false"
                size="small"
                style="width: 76px"
                @update:value="(v: number | null) => saveCell(row.category.id, t.id, v)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.cockpit-cpt {
  margin: -24px;
  padding: 24px;
  background: #eceef2;
  min-height: calc(100vh - 48px);
  box-sizing: border-box;
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  color: #1a1d23;
}
.cpt-head { margin-bottom: 16px; }
.cpt-title { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
.cpt-sub { font-size: 12.5px; color: #9aa0ab; }
.cpt-empty {
  background: #fff; border: 1px dashed #d7dae1; border-radius: 12px;
  padding: 40px; text-align: center; color: #9aa0ab;
}
.cpt-table-wrap {
  background: #fff; border: 1px solid #e7e9ee; border-radius: 12px;
  overflow: auto; max-height: calc(100vh - 150px);
}
.cpt-table { border-collapse: separate; border-spacing: 0; width: 100%; }
.cpt-table th, .cpt-table td { white-space: nowrap; }
.cpt-table thead th {
  position: sticky; top: 0; z-index: 2;
  background: #fafbfc; border-bottom: 1px solid #e7e9ee;
  padding: 11px 12px; font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.04em; color: #9aa0ab; text-align: center;
}
.cpt-cat-col, .cpt-cat-cell {
  position: sticky; left: 0; z-index: 1; background: #fff;
  text-align: left; min-width: 200px;
  border-right: 1px solid #eef0f3;
}
.cpt-table thead .cpt-cat-col { z-index: 3; background: #fafbfc; }
.cpt-cat-cell {
  padding: 6px 14px; font-size: 13.5px; font-weight: 600; color: #374151;
}
.cpt-cat-cell.child { font-weight: 500; padding-left: 22px; color: #555b66; }
.cpt-dot { display: inline-block; width: 5px; height: 5px; border-radius: 2px; background: #cdd1d8; margin-right: 8px; vertical-align: middle; }
.is-dept .cpt-cat-cell { background: #f7f8fa; }
.cpt-factor-cell { padding: 4px 8px; text-align: center; border-bottom: 1px solid #f4f5f7; }
.cpt-cat-cell { border-bottom: 1px solid #f4f5f7; }
</style>
