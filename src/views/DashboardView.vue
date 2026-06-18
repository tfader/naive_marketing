<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import api from '../api/client'
import { useAuthStore } from '../stores/auth'
import type { Campaign } from '../types/campaign'
import type { CalendarEvent } from '../types/calendar'

const router = useRouter()
const message = useMessage()
const auth = useAuthStore()

const campaigns = ref<Campaign[]>([])
const events = ref<CalendarEvent[]>([])
const loading = ref(false)

// --- Current quarter window ---
const now = new Date()
const currentYear = now.getFullYear()
const qIndex = Math.floor(now.getMonth() / 3)
const QNAMES = ['Q1', 'Q2', 'Q3', 'Q4']
const quarterLabel = `${QNAMES[qIndex]} ${currentYear}`
const qEnd = new Date(currentYear, qIndex * 3 + 3, 0)
const todayMid = new Date(currentYear, now.getMonth(), now.getDate())

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function toDate(s: string | null): Date | null {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}
function fmtDate(s: string | null): string {
  const d = toDate(s)
  return d ? `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}` : '—'
}
function dayNum(s: string | null): string {
  const d = toDate(s)
  return d ? String(d.getDate()) : '—'
}
function monShort(s: string | null): string {
  const d = toDate(s)
  return d ? MONTHS_SHORT[d.getMonth()] : ''
}
function daysUntil(s: string | null): number | null {
  const d = toDate(s)
  if (!d) return null
  return Math.round((d.getTime() - todayMid.getTime()) / 86_400_000)
}
function untilLabel(s: string | null): string {
  const n = daysUntil(s)
  if (n == null) return ''
  if (n <= 0) return 'today'
  if (n === 1) return 'tomorrow'
  return `in ${n} days`
}

const counts = computed(() => {
  const c = { active: 0, completed: 0, cancelled: 0, total: campaigns.value.length }
  for (const x of campaigns.value) {
    if (x.status === 'active') c.active++
    else if (x.status === 'completed') c.completed++
    else if (x.status === 'cancelled') c.cancelled++
  }
  return c
})

const activeCampaigns = computed(() => campaigns.value.filter((c) => c.status === 'active'))

const upcoming = computed(() =>
  events.value
    .filter((e) => {
      if (e.cancelled) return false
      const d = toDate(e.start_date)
      return !!d && d >= todayMid && d <= qEnd
    })
    .sort((a, b) => (a.start_date < b.start_date ? -1 : 1))
)

const statusBar = computed(() => {
  const t = counts.value.total || 1
  return {
    active: (counts.value.active / t) * 100,
    completed: (counts.value.completed / t) * 100,
    cancelled: (counts.value.cancelled / t) * 100,
  }
})

function openCampaign(id: number) {
  router.push({ name: 'CampaignDetail', params: { id } })
}
function openEvent(e: CalendarEvent) {
  if (e.campaign_id) router.push({ name: 'CampaignDetail', params: { id: e.campaign_id } })
  else router.push({ name: 'Calendar' })
}

async function load() {
  loading.value = true
  try {
    const [c, ev] = await Promise.all([
      api.get('/campaigns'),
      api.get('/calendar_events', { params: { year: currentYear } }),
    ])
    campaigns.value = c.data
    events.value = ev.data
  } catch {
    message.error('Failed to load dashboard')
  } finally {
    loading.value = false
  }
}
onMounted(load)
</script>

<template>
  <div class="cockpit-dash">
    <!-- Header -->
    <div class="d-head">
      <div>
        <h1 class="d-title">Welcome back, {{ auth.user?.first_name || 'there' }}</h1>
        <p class="d-sub">Here's your {{ quarterLabel }} overview</p>
      </div>
      <div class="d-head-actions">
        <button class="d-btn" @click="router.push({ name: 'Campaigns' })">All campaigns</button>
        <button class="d-btn primary" @click="router.push({ name: 'Calendar' })">Open calendar</button>
      </div>
    </div>

    <!-- KPI strip -->
    <div class="d-kpis">
      <div class="d-kpi accent">
        <span class="d-kpi-l">Active campaigns</span>
        <span class="d-kpi-v mono">{{ counts.active }}</span>
      </div>
      <div class="d-kpi">
        <span class="d-kpi-l">Completed</span>
        <span class="d-kpi-v mono">{{ counts.completed }}</span>
      </div>
      <div class="d-kpi">
        <span class="d-kpi-l">Cancelled</span>
        <span class="d-kpi-v mono">{{ counts.cancelled }}</span>
      </div>
      <div class="d-kpi">
        <span class="d-kpi-l">Upcoming · {{ quarterLabel }}</span>
        <span class="d-kpi-v mono">{{ upcoming.length }}</span>
      </div>
    </div>

    <!-- Status overview bar -->
    <div class="d-card d-status">
      <div class="d-card-head">
        <span class="d-card-title">Campaign status</span>
        <span class="d-muted">{{ counts.total }} total</span>
      </div>
      <div class="d-bar">
        <span class="d-bar-seg" :style="{ width: statusBar.active + '%', background: '#5b50d6' }"></span>
        <span class="d-bar-seg" :style="{ width: statusBar.completed + '%', background: '#cbd0d8' }"></span>
        <span class="d-bar-seg" :style="{ width: statusBar.cancelled + '%', background: '#e6868d' }"></span>
      </div>
      <div class="d-legend">
        <span class="d-leg"><span class="d-leg-dot" style="background:#5b50d6"></span>Active <b class="mono">{{ counts.active }}</b></span>
        <span class="d-leg"><span class="d-leg-dot" style="background:#cbd0d8"></span>Completed <b class="mono">{{ counts.completed }}</b></span>
        <span class="d-leg"><span class="d-leg-dot" style="background:#e6868d"></span>Cancelled <b class="mono">{{ counts.cancelled }}</b></span>
      </div>
    </div>

    <!-- Two columns: active campaigns + upcoming launches -->
    <div class="d-cols">
      <div class="d-card">
        <div class="d-card-head">
          <span class="d-card-title">Active campaigns</span>
          <span class="d-muted">{{ activeCampaigns.length }}</span>
        </div>
        <div v-if="loading" class="d-empty">Loading…</div>
        <div v-else-if="!activeCampaigns.length" class="d-empty">No active campaigns.</div>
        <div v-else class="d-list">
          <div v-for="c in activeCampaigns" :key="c.id" class="d-item" @click="openCampaign(c.id)">
            <span class="d-dot" :style="{ background: c.campaign_type?.color || '#cbd5e1' }"></span>
            <div class="d-item-main">
              <div class="d-item-l1">
                <span class="d-name">{{ c.name }}</span>
                <span v-if="c.campaign_type" class="d-type">{{ c.campaign_type.name }}</span>
              </div>
              <div class="d-item-l2">
                <span v-if="c.current_stage" class="d-tag is-stage">{{ c.current_stage.position }}. {{ c.current_stage.name }}</span>
                <span class="d-dates mono">{{ fmtDate(c.start_date) }} → {{ fmtDate(c.end_date) }}</span>
              </div>
            </div>
            <span class="d-open">Open →</span>
          </div>
        </div>
      </div>

      <div class="d-card">
        <div class="d-card-head">
          <span class="d-card-title">Upcoming launches</span>
          <span class="d-muted">{{ quarterLabel }}</span>
        </div>
        <div v-if="loading" class="d-empty">Loading…</div>
        <div v-else-if="!upcoming.length" class="d-empty">Nothing scheduled for {{ quarterLabel }}.</div>
        <div v-else class="d-list">
          <div v-for="e in upcoming" :key="e.id" class="d-up" @click="openEvent(e)">
            <div class="d-date" :style="{ borderColor: (e.color || '#5b50d6') }">
              <span class="d-date-d mono">{{ dayNum(e.start_date) }}</span>
              <span class="d-date-m">{{ monShort(e.start_date) }}</span>
            </div>
            <div class="d-item-main">
              <div class="d-item-l1"><span class="d-name">{{ e.name }}</span></div>
              <div class="d-item-l2">
                <span class="d-type">{{ e.campaign_type.name }}</span>
                <span class="d-sep">·</span>
                <span class="d-until">{{ untilLabel(e.start_date) }}</span>
              </div>
            </div>
            <span class="d-pill" :class="e.campaign_id ? 'is-open' : 'is-launch'">{{ e.campaign_id ? 'Open' : 'Launch' }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cockpit-dash {
  margin: -24px;
  padding: 24px;
  background: #eceef2;
  min-height: calc(100vh - 48px);
  box-sizing: border-box;
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  color: #1a1d23;
}
.mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; }

/* header */
.d-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
.d-title { margin: 0; font-size: 25px; font-weight: 700; letter-spacing: -0.02em; }
.d-sub { margin: 4px 0 0; font-size: 13.5px; color: #6b7280; }
.d-head-actions { display: flex; gap: 8px; }
.d-btn {
  border: 1px solid #e7e9ee; background: #fff; cursor: pointer;
  font-family: inherit; font-size: 13px; font-weight: 600; color: #374151;
  padding: 9px 15px; border-radius: 9px;
}
.d-btn:hover { border-color: #cfd3da; }
.d-btn.primary { background: #5b50d6; border-color: #5b50d6; color: #fff; }
.d-btn.primary:hover { background: #4a40c2; }
.d-btn:focus-visible { outline: 2px solid #5b50d6; outline-offset: 2px; }

/* KPI strip */
.d-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 16px; }
.d-kpi {
  background: #fff; border: 1px solid #e7e9ee; border-radius: 14px;
  padding: 18px 20px; display: flex; flex-direction: column; gap: 10px;
}
.d-kpi.accent { border-top: 3px solid #5b50d6; }
.d-kpi-l { font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase; color: #9aa0ab; font-weight: 600; }
.d-kpi-v { font-size: 30px; font-weight: 600; letter-spacing: -0.02em; line-height: 1; }
.d-kpi.accent .d-kpi-v { color: #5b50d6; }

/* cards */
.d-card { background: #fff; border: 1px solid #e7e9ee; border-radius: 14px; padding: 18px 20px; }
.d-card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.d-card-title { font-size: 11px; letter-spacing: 0.07em; text-transform: uppercase; color: #9aa0ab; font-weight: 600; }
.d-muted { font-size: 12.5px; color: #9aa0ab; font-family: 'IBM Plex Mono', ui-monospace, monospace; }

/* status bar */
.d-status { margin-bottom: 16px; }
.d-bar { display: flex; height: 12px; border-radius: 7px; overflow: hidden; background: #f0f1f4; }
.d-bar-seg { display: block; height: 100%; }
.d-legend { display: flex; gap: 22px; margin-top: 12px; flex-wrap: wrap; }
.d-leg { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; color: #6b7280; }
.d-leg b { color: #1a1d23; margin-left: 2px; }
.d-leg-dot { width: 9px; height: 9px; border-radius: 3px; }

/* two columns */
.d-cols { display: grid; grid-template-columns: 1.4fr 1fr; gap: 16px; }

.d-list { display: flex; flex-direction: column; }
.d-empty { padding: 28px; text-align: center; color: #9aa0ab; border: 1px dashed #e2e5ea; border-radius: 10px; }

.d-item { display: flex; align-items: center; gap: 13px; padding: 12px 6px; border-bottom: 1px solid #f4f5f7; cursor: pointer; border-radius: 8px; }
.d-item:last-child { border-bottom: none; }
.d-item:hover { background: #fafbfc; }
.d-dot { width: 10px; height: 10px; border-radius: 3px; flex: 0 0 auto; }
.d-item-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.d-item-l1 { display: flex; align-items: center; gap: 10px; }
.d-name { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.d-type { font-size: 12px; color: #9aa0ab; white-space: nowrap; }
.d-item-l2 { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.d-tag { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 6px; white-space: nowrap; }
.d-tag.is-stage { color: #3f37a8; background: #f0eefc; }
.d-dates { font-size: 12px; color: #6b7280; white-space: nowrap; }
.d-open { font-size: 12.5px; font-weight: 600; color: #5b50d6; flex: 0 0 auto; white-space: nowrap; opacity: 0; transition: opacity 0.12s; }
.d-item:hover .d-open { opacity: 1; }

/* upcoming */
.d-up { display: flex; align-items: center; gap: 14px; padding: 11px 6px; border-bottom: 1px solid #f4f5f7; cursor: pointer; border-radius: 8px; }
.d-up:last-child { border-bottom: none; }
.d-up:hover { background: #fafbfc; }
.d-date {
  flex: 0 0 auto; width: 46px; height: 46px; border-radius: 10px;
  background: #f7f8fa; border: 1px solid #eef0f3; border-left: 3px solid #5b50d6;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.d-date-d { font-size: 16px; font-weight: 700; line-height: 1; }
.d-date-m { font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: #9aa0ab; font-weight: 600; margin-top: 2px; }
.d-until { font-size: 12px; color: #9aa0ab; }
.d-sep { color: #cfd3da; }
.d-pill { flex: 0 0 auto; font-size: 12px; font-weight: 600; padding: 5px 11px; border-radius: 8px; white-space: nowrap; }
.d-pill.is-launch { color: #fff; background: #5b50d6; }
.d-pill.is-open { color: #374151; background: #f0f1f4; }

@media (max-width: 1080px) {
  .d-kpis { grid-template-columns: repeat(2, 1fr); }
  .d-cols { grid-template-columns: 1fr; }
}
</style>
