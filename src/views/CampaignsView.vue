<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import api from '../api/client'
import type { Campaign } from '../types/campaign'

const router = useRouter()
const message = useMessage()
const campaigns = ref<Campaign[]>([])
const loading = ref(false)

type StatusFilter = 'all' | 'active' | 'completed' | 'cancelled'
const statusFilter = ref<StatusFilter>('all')

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function fmtDate(s: string | null): string {
  if (!s) return '—'
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return s
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`
}
function statusLabel(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const counts = computed(() => {
  const c = { all: campaigns.value.length, active: 0, completed: 0, cancelled: 0 }
  for (const x of campaigns.value) {
    if (x.status === 'active') c.active++
    else if (x.status === 'completed') c.completed++
    else if (x.status === 'cancelled') c.cancelled++
  }
  return c
})

const filtered = computed(() =>
  statusFilter.value === 'all'
    ? campaigns.value
    : campaigns.value.filter((c) => c.status === statusFilter.value)
)

const filterTabs = computed(() => [
  { key: 'all' as StatusFilter, label: 'All', n: counts.value.all },
  { key: 'active' as StatusFilter, label: 'Active', n: counts.value.active },
  { key: 'completed' as StatusFilter, label: 'Completed', n: counts.value.completed },
  { key: 'cancelled' as StatusFilter, label: 'Cancelled', n: counts.value.cancelled },
])

function open(id: number) {
  router.push({ name: 'CampaignDetail', params: { id } })
}

async function loadCampaigns() {
  loading.value = true
  try {
    const { data } = await api.get('/campaigns')
    campaigns.value = data
  } catch {
    message.error('Failed to load campaigns')
  } finally {
    loading.value = false
  }
}
onMounted(loadCampaigns)
</script>

<template>
  <div class="cockpit-camps">
    <div class="c-head">
      <h1 class="c-title">Campaigns</h1>
      <span class="c-total mono">{{ counts.all }} total</span>
    </div>

    <div class="c-toolbar">
      <div class="seg">
        <button
          v-for="t in filterTabs"
          :key="t.key"
          class="seg-btn"
          :class="{ active: statusFilter === t.key }"
          @click="statusFilter = t.key"
        >
          {{ t.label }}<span class="seg-n">{{ t.n }}</span>
        </button>
      </div>
    </div>

    <div v-if="loading" class="c-empty">Loading…</div>
    <div v-else-if="!filtered.length" class="c-empty">No campaigns to show.</div>
    <div v-else class="c-list">
      <div v-for="c in filtered" :key="c.id" class="c-row" @click="open(c.id)">
        <span class="c-bar" :style="{ background: c.campaign_type?.color || '#cbd5e1' }"></span>
        <div class="c-main">
          <div class="c-l1">
            <span class="c-name">{{ c.name }}</span>
            <span v-if="c.campaign_type" class="c-type">{{ c.campaign_type.name }}</span>
            <span class="c-status" :class="`is-${c.status}`">{{ statusLabel(c.status) }}</span>
          </div>
          <div class="c-l2">
            <span v-if="c.current_stage" class="c-tag is-stage">{{ c.current_stage.position }}. {{ c.current_stage.name }}</span>
            <span v-else class="c-muted">No stage</span>
            <span class="c-sep">·</span>
            <span class="c-dates mono">{{ fmtDate(c.start_date) }} → {{ fmtDate(c.end_date) }}</span>
          </div>
        </div>
        <span class="c-open">Open →</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cockpit-camps {
  margin: -24px;
  padding: 24px;
  background: #eceef2;
  min-height: calc(100vh - 48px);
  box-sizing: border-box;
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  color: #1a1d23;
}
.mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; }

.c-head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 16px; }
.c-title { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
.c-total { font-size: 12.5px; color: #9aa0ab; }

.c-toolbar { margin-bottom: 16px; }
.seg { display: inline-flex; background: #fff; border: 1px solid #e7e9ee; border-radius: 10px; padding: 4px; gap: 2px; }
.seg-btn {
  display: inline-flex; align-items: center; gap: 7px;
  border: none; background: transparent; cursor: pointer;
  font-family: inherit; font-size: 13px; font-weight: 600; color: #6b7280;
  padding: 7px 14px; border-radius: 7px;
}
.seg-btn:hover { color: #1a1d23; }
.seg-btn.active { background: #f3f2fd; color: #3f37a8; }
.seg-btn:focus-visible { outline: 2px solid #5b50d6; outline-offset: 2px; }
.seg-n {
  font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 11px;
  background: #f0f1f4; color: #6b7280; padding: 1px 7px; border-radius: 10px;
}
.seg-btn.active .seg-n { background: #e4e1f7; color: #3f37a8; }

.c-list { display: flex; flex-direction: column; gap: 10px; }
.c-empty {
  background: #fff; border: 1px dashed #d7dae1; border-radius: 12px;
  padding: 40px; text-align: center; color: #9aa0ab;
}
.c-row {
  display: flex; align-items: center; gap: 16px;
  background: #fff; border: 1px solid #e7e9ee; border-radius: 12px;
  padding: 14px 18px 14px 0; overflow: hidden; cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.c-row:hover { border-color: #cfd3da; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04); }
.c-bar { align-self: stretch; width: 4px; flex: 0 0 auto; }
.c-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 5px; padding-left: 14px; }
.c-l1 { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.c-name { font-size: 15px; font-weight: 700; letter-spacing: -0.01em; white-space: nowrap; }
.c-type { font-size: 12.5px; color: #6b7280; }
.c-status { font-size: 11px; font-weight: 600; padding: 2px 9px; border-radius: 20px; white-space: nowrap; }
.c-status.is-active { color: #3f37a8; background: #f0eefc; }
.c-status.is-completed { color: #5a6472; background: #eef0f3; }
.c-status.is-cancelled { color: #b32630; background: #fbe7e8; }
.c-l2 { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 12.5px; color: #9aa0ab; }
.c-tag { font-size: 11px; font-weight: 600; padding: 2px 9px; border-radius: 6px; white-space: nowrap; }
.c-tag.is-stage { color: #3f37a8; background: #f0eefc; }
.c-muted { color: #b8bdc7; }
.c-sep { color: #cfd3da; }
.c-dates { color: #374151; white-space: nowrap; }
.c-open { font-size: 12.5px; font-weight: 600; color: #5b50d6; flex: 0 0 auto; white-space: nowrap; opacity: 0; transition: opacity 0.12s; }
.c-row:hover .c-open { opacity: 1; }

@media (max-width: 760px) {
  .c-row { flex-wrap: wrap; }
  .c-open { opacity: 1; padding-left: 18px; }
}
</style>
