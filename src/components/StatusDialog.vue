<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NModal, NCard, NButton, NTag, NText, NSwitch, useMessage } from 'naive-ui'
import api from '../api/client'
import { statusTarget, showStatusDialog, bumpStatus } from '../composables/statuses'
import { useAuthStore } from '../stores/auth'

interface HistoryRow {
  id: number
  status: { id: number; name: string; color: string } | null
  user: { id: number; name: string } | null
  seen: boolean
  created_at: string
}
interface SettableStatus {
  id: number
  name: string
  color: string
}

const CHARS_PER_SEC = 15
const MIN_READ_MS = 600

const message = useMessage()
const auth = useAuthStore()
const currentUserId = computed(() => auth.user?.id ?? null)

const history = ref<HistoryRow[]>([])
const options = ref<SettableStatus[]>([])
const loading = ref(false)
const onlyNew = ref(true)
let openedAt = 0

const displayed = computed(() => (onlyNew.value ? history.value.filter((r) => !r.seen) : history.value))

function readingMs(text: string): number {
  return Math.max(MIN_READ_MS, (text.length / CHARS_PER_SEC) * 1000)
}

async function load() {
  const t = statusTarget.value
  if (!t) return
  loading.value = true
  try {
    const [h, s] = await Promise.all([
      api.get('/status_assignments', { params: { ref_model: t.refModel, ref_id: t.refId, ref_attribute: t.attribute } }),
      api.get('/statuses/settable'),
    ])
    history.value = h.data
    options.value = s.data
  } catch {
    history.value = []
    options.value = []
  } finally {
    loading.value = false
    openedAt = Date.now()
  }
}

async function setStatus(statusId: number) {
  const t = statusTarget.value
  if (!t) return
  try {
    await api.post('/status_assignments', { ref_model: t.refModel, ref_id: t.refId, ref_attribute: t.attribute, status_id: statusId })
    showStatusDialog.value = false // nothing more to do here — close
    bumpStatus()
  } catch (err: any) {
    const errors = err.response?.data?.errors
    message.error(Array.isArray(errors) ? errors.join(', ') : 'Failed to set status')
  }
}

// On close: mark others' unseen status changes as seen if the dialog was open long enough.
async function markSeenOnClose() {
  const elapsed = Date.now() - openedAt
  const markable = history.value.filter((r) => !r.seen && r.user?.id !== currentUserId.value)
  let cumulative = 0
  const ids: number[] = []
  for (const r of markable) {
    cumulative += readingMs(r.status?.name ?? '')
    if (elapsed >= cumulative) ids.push(r.id)
  }
  if (ids.length) {
    try {
      await api.post('/status_assignments/mark_seen', { status_assignment_ids: ids })
      bumpStatus()
    } catch {
      /* best-effort */
    }
  }
}

function when(ts: string): string {
  return ts ? ts.slice(0, 16).replace('T', ' ') : ''
}

watch(showStatusDialog, async (val, old) => {
  if (val && !old) {
    onlyNew.value = true
    await load()
  } else if (!val && old) {
    await markSeenOnClose()
  }
})
watch(statusTarget, () => {
  if (showStatusDialog.value) load()
})
</script>

<template>
  <NModal v-model:show="showStatusDialog">
    <NCard
      v-if="statusTarget"
      :title="`Status — ${statusTarget.label}`"
      style="width: 520px"
      closable
      @close="showStatusDialog = false"
    >
      <template #header-extra>
        <div class="sd-toggle">
          <span class="sd-toggle-lbl">Only new</span>
          <NSwitch v-model:value="onlyNew" size="small" />
        </div>
      </template>

      <div class="sd-set">
        <NText depth="3" style="font-size:12px">Set status</NText>
        <div class="sd-options">
          <NButton
            v-for="o in options"
            :key="o.id"
            size="small"
            :style="`border-color:${o.color};color:${o.color}`"
            @click="setStatus(o.id)"
          >
            {{ o.name }}
          </NButton>
          <NText v-if="!options.length" depth="3" style="font-size:12px">No statuses you can set.</NText>
        </div>
      </div>

      <div class="sd-title">History</div>
      <div v-if="!displayed.length && !loading" class="sd-empty">{{ onlyNew ? 'No new changes.' : 'No status changes yet.' }}</div>
      <div v-for="row in displayed" :key="row.id" class="sd-row">
        <NTag v-if="row.status" size="small" :style="`background:${row.status.color};color:#fff`" :bordered="false">
          {{ row.status.name }}
        </NTag>
        <NTag v-else size="small">(removed)</NTag>
        <NTag v-if="!row.seen" size="small" type="success" :bordered="false">new</NTag>
        <span class="sd-by">{{ row.user?.name ?? 'Unknown' }}</span>
        <span class="sd-when">{{ when(row.created_at) }}</span>
      </div>
    </NCard>
  </NModal>
</template>

<style scoped>
.sd-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sd-toggle-lbl {
  font-size: 12px;
  color: #888;
}
.sd-set {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}
.sd-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.sd-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #98a0ad;
  margin-bottom: 8px;
}
.sd-empty {
  color: #bbb;
  font-style: italic;
}
.sd-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 2px;
  border-bottom: 1px solid #f3f3f6;
}
.sd-row:last-child {
  border-bottom: none;
}
.sd-by {
  font-weight: 600;
  font-size: 13px;
  color: #2b2b33;
}
.sd-when {
  font-size: 11px;
  color: #9aa0ab;
  margin-left: auto;
}
</style>
