<script setup lang="ts">
import { ref, watch } from 'vue'
import { NModal, NCard, NButton, NTag, NText, useMessage } from 'naive-ui'
import api from '../api/client'
import { statusTarget, showStatusDialog, bumpStatus } from '../composables/statuses'

interface HistoryRow {
  id: number
  status: { id: number; name: string; color: string } | null
  user: { id: number; name: string } | null
  created_at: string
}
interface SettableStatus {
  id: number
  name: string
  color: string
}

const message = useMessage()
const history = ref<HistoryRow[]>([])
const options = ref<SettableStatus[]>([])
const loading = ref(false)

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
  }
}

async function setStatus(statusId: number) {
  const t = statusTarget.value
  if (!t) return
  try {
    await api.post('/status_assignments', { ref_model: t.refModel, ref_id: t.refId, ref_attribute: t.attribute, status_id: statusId })
    await load()
    bumpStatus()
  } catch (err: any) {
    const errors = err.response?.data?.errors
    message.error(Array.isArray(errors) ? errors.join(', ') : 'Failed to set status')
  }
}

function when(ts: string): string {
  return ts ? ts.slice(0, 16).replace('T', ' ') : ''
}

watch([showStatusDialog, statusTarget], () => {
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
      <div v-if="!history.length && !loading" class="sd-empty">No status changes yet.</div>
      <div v-for="row in history" :key="row.id" class="sd-row">
        <NTag v-if="row.status" size="small" :color="{ color: '#fff', textColor: '#fff', borderColor: row.status.color }" :style="`background:${row.status.color}`">
          {{ row.status.name }}
        </NTag>
        <NTag v-else size="small">(removed)</NTag>
        <span class="sd-by">{{ row.user?.name ?? 'Unknown' }}</span>
        <span class="sd-when">{{ when(row.created_at) }}</span>
      </div>
    </NCard>
  </NModal>
</template>

<style scoped>
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
