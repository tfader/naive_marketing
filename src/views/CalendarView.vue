<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  NButton,
  NSpace,
  NModal,
  NCard,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NDatePicker,
  NColorPicker,
  NSwitch,
  NInputNumber,
  NPopconfirm,
  useMessage,
} from 'naive-ui'
import type { SelectOption } from 'naive-ui'
import api from '../api/client'
import type { CalendarEvent, CampaignTypeRef, TemplateRef, StageRef } from '../types/calendar'
import CalendarYearTimeline from '../components/CalendarYearTimeline.vue'
import CalendarMonthGrid from '../components/CalendarMonthGrid.vue'

interface CampaignTypeFull extends CampaignTypeRef {
  default_process_template_id: number | null
  default_duration_days: number | null
  color: string | null
  has_pages: boolean
}

const COLOR_SWATCHES = [
  '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444',
  '#ec4899', '#f43f5e', '#8b5cf6', '#6366f1', '#f97316',
  '#64748b', '#111827',
]

const message = useMessage()
const router = useRouter()

// Launch-with-pages prompt (leaflet types)
const showLaunchModal = ref(false)
const launchRow = ref<CalendarEvent | null>(null)
const launchPages = ref<number>(8)
const events = ref<CalendarEvent[]>([])
const campaignTypes = ref<CampaignTypeFull[]>([])
const templates = ref<TemplateRef[]>([])
const formStages = ref<StageRef[]>([])
const loading = ref(false)
const showModal = ref(false)
const editingEvent = ref<CalendarEvent | null>(null)

// --- Filters ---
const currentYear = new Date().getFullYear()
const selectedYear = ref<number>(currentYear)
const selectedType = ref<number | null>(null)
const selectedStage = ref<string | null>(null)

// --- View mode ---
const viewMode = ref<'table' | 'calendar'>('table')
const calendarMode = ref<'year' | 'month'>('year')

function onYearChange(y: number) {
  selectedYear.value = y
  loadEvents()
}

const yearOptions: SelectOption[] = Array.from({ length: 3 }, (_, i) => {
  const y = currentYear - 1 + i
  return { label: String(y), value: y }
})

const typeOptions = computed<SelectOption[]>(() =>
  campaignTypes.value.map((t) => ({ label: t.name, value: t.id }))
)

const templateOptions = computed<SelectOption[]>(() =>
  templates.value.map((t) => ({ label: t.name, value: t.id }))
)

// Stage options for the form = stages of the currently selected template.
const formStageOptions = computed<SelectOption[]>(() =>
  formStages.value.map((s) => ({ label: `${s.position}. ${s.name}`, value: s.id }))
)

// Distinct current-stage names present in the loaded events → filter dropdown.
const stageFilterOptions = computed<SelectOption[]>(() => {
  const names = new Set<string>()
  events.value.forEach((e) => { if (e.current_stage) names.add(e.current_stage.name) })
  return [...names].map((n) => ({ label: n, value: n }))
})

const filteredEvents = computed(() =>
  events.value.filter((e) => {
    if (selectedType.value && e.campaign_type_id !== selectedType.value) return false
    if (selectedStage.value && e.current_stage?.name !== selectedStage.value) return false
    return true
  })
)

const form = ref({
  name: '',
  campaign_type_id: null as number | null,
  process_template_id: null as number | null,
  current_stage_id: null as number | null,
  start_date: null as string | null,
  end_date: null as string | null,
  cancelled: false,
  color: '#3b82f6' as string | null,
  description: '',
})

const modalTitle = computed(() => (editingEvent.value ? 'Edit Event' : 'New Event'))

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function fmtDate(s: string | null): string {
  if (!s) return '—'
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return s
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`
}

// Launch a campaign from the event (or open the existing one).
// If the event's type is a leaflet (has pages), ask how many pages first.
function launchEvent(row: CalendarEvent) {
  if (row.campaign_id) {
    router.push({ name: 'CampaignDetail', params: { id: row.campaign_id } })
    return
  }
  const type = campaignTypes.value.find((t) => t.id === row.campaign_type_id)
  if (type?.has_pages) {
    launchRow.value = row
    launchPages.value = 8
    showLaunchModal.value = true
  } else {
    doLaunch(row, null)
  }
}

async function doLaunch(row: CalendarEvent, pagesCount: number | null) {
  try {
    const { data } = await api.post(`/calendar_events/${row.id}/launch`, { pages_count: pagesCount })
    message.success('Campaign launched')
    showLaunchModal.value = false
    await loadEvents()
    router.push({ name: 'CampaignDetail', params: { id: data.id } })
  } catch (err: any) {
    const errors = err.response?.data?.errors
    message.error(Array.isArray(errors) ? errors.join(', ') : 'Failed to launch')
  }
}

function confirmLaunch() {
  if (launchRow.value) doLaunch(launchRow.value, launchPages.value)
}

// Fetch the stages of a process template; default current_stage to the first one if unset/invalid.
async function loadFormStages(keepCurrent = false) {
  if (!form.value.process_template_id) {
    formStages.value = []
    form.value.current_stage_id = null
    return
  }
  try {
    const { data } = await api.get(`/process_templates/${form.value.process_template_id}`)
    formStages.value = data.stages ?? []
    const stillValid = formStages.value.some((s) => s.id === form.value.current_stage_id)
    if (!keepCurrent || !stillValid) {
      form.value.current_stage_id = formStages.value[0]?.id ?? null
    }
  } catch {
    message.error('Failed to load process stages')
    formStages.value = []
  }
}

// Add `days` to a "yyyy-MM-dd" string, returning the same format (timezone-safe, local).
function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${dt.getFullYear()}-${mm}-${dd}`
}

// Prefill end date from the selected type's default duration (inclusive: end = start + days - 1).
function applyDefaultDuration() {
  const type = campaignTypes.value.find((t) => t.id === form.value.campaign_type_id)
  if (type?.default_duration_days && form.value.start_date) {
    form.value.end_date = addDays(form.value.start_date, type.default_duration_days - 1)
  }
}

// Picking a type prefills the template from that type's default, sets the end date, then loads stages.
async function onTypeChange(typeId: number) {
  const type = campaignTypes.value.find((t) => t.id === typeId)
  form.value.process_template_id = type?.default_process_template_id ?? null
  if (type?.color) form.value.color = type.color
  applyDefaultDuration()
  await loadFormStages()
}

function onStartChange() {
  applyDefaultDuration()
}

// Overriding the template reloads stages and resets the current stage to the first.
async function onTemplateChange() {
  await loadFormStages()
}

async function openNew() {
  editingEvent.value = null
  const firstType = campaignTypes.value[0] ?? null
  form.value = {
    name: '',
    campaign_type_id: firstType?.id ?? null,
    process_template_id: firstType?.default_process_template_id ?? null,
    current_stage_id: null,
    start_date: null,
    end_date: null,
    cancelled: false,
    color: firstType?.color ?? '#3b82f6',
    description: '',
  }
  await loadFormStages()
  showModal.value = true
}

async function openEdit(event: CalendarEvent) {
  editingEvent.value = event
  form.value = {
    name: event.name,
    campaign_type_id: event.campaign_type_id,
    process_template_id: event.process_template_id,
    current_stage_id: event.current_stage_id,
    start_date: event.start_date,
    end_date: event.end_date,
    cancelled: event.cancelled,
    color: event.color ?? '#3b82f6',
    description: event.description ?? '',
  }
  await loadFormStages(true)
  showModal.value = true
}

async function saveEvent() {
  try {
    if (editingEvent.value) {
      await api.patch(`/calendar_events/${editingEvent.value.id}`, form.value)
      message.success('Event updated')
    } else {
      await api.post('/calendar_events', form.value)
      message.success('Event created')
    }
    showModal.value = false
    await loadEvents()
  } catch (err: any) {
    const errors = err.response?.data?.errors
    message.error(Array.isArray(errors) ? errors.join(', ') : 'Failed to save')
  }
}

async function deleteEvent(id: number) {
  try {
    await api.delete(`/calendar_events/${id}`)
    message.success('Event deleted')
    await loadEvents()
  } catch {
    message.error('Failed to delete')
  }
}

async function loadEvents() {
  loading.value = true
  try {
    const { data } = await api.get('/calendar_events', { params: { year: selectedYear.value } })
    events.value = data
  } catch {
    message.error('Failed to load events')
  } finally {
    loading.value = false
  }
}

async function loadLookups() {
  try {
    const [typesRes, templatesRes] = await Promise.all([
      api.get('/campaign_types'),
      api.get('/process_templates'),
    ])
    campaignTypes.value = typesRes.data
    templates.value = templatesRes.data
  } catch {
    message.error('Failed to load lookups')
  }
}

onMounted(async () => {
  await loadLookups()
  await loadEvents()
})
</script>

<template>
  <div class="cockpit-cal">
    <div class="cal-head">
      <h1 class="cal-title">Marketing Calendar</h1>
      <button class="cal-add" @click="openNew">+ Add Event</button>
    </div>

    <div class="cal-toolbar">
      <div class="cal-filters">
        <NSelect v-model:value="selectedYear" :options="yearOptions" style="width: 110px" @update:value="loadEvents" />
        <NSelect v-model:value="selectedType" :options="typeOptions" placeholder="All types" clearable style="width: 200px" />
        <NSelect v-model:value="selectedStage" :options="stageFilterOptions" placeholder="All stages" clearable style="width: 220px" />
      </div>
      <div class="cal-views">
        <div class="seg">
          <button class="seg-btn" :class="{ active: viewMode === 'table' }" @click="viewMode = 'table'">Table</button>
          <button class="seg-btn" :class="{ active: viewMode === 'calendar' }" @click="viewMode = 'calendar'">Calendar</button>
        </div>
        <div v-if="viewMode === 'calendar'" class="seg">
          <button class="seg-btn" :class="{ active: calendarMode === 'year' }" @click="calendarMode = 'year'">Year</button>
          <button class="seg-btn" :class="{ active: calendarMode === 'month' }" @click="calendarMode = 'month'">Month</button>
        </div>
      </div>
    </div>

    <!-- Table view -> redesigned event list -->
    <div v-if="viewMode === 'table'" class="cal-list">
      <div v-if="loading" class="cal-empty">Loading…</div>
      <div v-else-if="!filteredEvents.length" class="cal-empty">No events for {{ selectedYear }}.</div>
      <div v-for="e in filteredEvents" :key="e.id" class="cal-row">
        <span class="cal-bar" :style="{ background: e.color || '#cbd5e1' }"></span>
        <div class="cal-row-main">
          <div class="cal-row-l1">
            <span class="cal-name">{{ e.name }}</span>
            <span class="cal-type">{{ e.campaign_type.name }}</span>
            <span v-if="e.cancelled" class="cal-tag is-cancel">Cancelled</span>
            <span v-else-if="e.current_stage" class="cal-tag is-stage">{{ e.current_stage.position }}. {{ e.current_stage.name }}</span>
          </div>
          <div class="cal-row-l2">
            <span class="cal-flow">{{ e.process_template ? e.process_template.name : '—' }}</span>
            <span class="cal-sep">·</span>
            <span class="cal-dates mono">{{ fmtDate(e.start_date) }} → {{ fmtDate(e.end_date) }}</span>
            <span class="cal-days mono">{{ e.duration_days }}d</span>
          </div>
        </div>
        <div class="cal-row-actions">
          <button class="cal-btn" :class="{ primary: !e.campaign_id }" @click="launchEvent(e)">{{ e.campaign_id ? 'Open' : 'Launch' }}</button>
          <button class="cal-btn" @click="openEdit(e)">Edit</button>
          <NPopconfirm @positive-click="() => deleteEvent(e.id)">
            <template #trigger><button class="cal-btn danger">Delete</button></template>
            Delete "{{ e.name }}"?
          </NPopconfirm>
        </div>
      </div>
    </div>

    <div v-else-if="calendarMode === 'year'" class="cal-canvas">
      <CalendarYearTimeline :events="filteredEvents" :year="selectedYear" @event-click="openEdit" />
    </div>
    <div v-else class="cal-canvas">
      <CalendarMonthGrid :events="filteredEvents" :year="selectedYear" @event-click="openEdit" @year-change="onYearChange" />
    </div>

    <NModal v-model:show="showLaunchModal">
      <NCard title="Launch leaflet campaign" style="width: 420px" closable @close="showLaunchModal = false">
        <NForm @submit.prevent="confirmLaunch">
          <NFormItem label="Number of pages">
            <NInputNumber v-model:value="launchPages" :min="1" style="width: 100%" />
          </NFormItem>
          <NSpace justify="end">
            <NButton @click="showLaunchModal = false">Cancel</NButton>
            <NButton type="primary" attr-type="submit">Launch</NButton>
          </NSpace>
        </NForm>
      </NCard>
    </NModal>

    <NModal v-model:show="showModal">
      <NCard :title="modalTitle" style="width: 560px" closable @close="showModal = false">
        <NForm @submit.prevent="saveEvent">
          <NFormItem label="Name">
            <NInput v-model:value="form.name" placeholder="e.g. Easter Campaign" />
          </NFormItem>
          <NFormItem label="Campaign Type">
            <NSelect
              v-model:value="form.campaign_type_id"
              :options="typeOptions"
              placeholder="Select type"
              @update:value="onTypeChange"
            />
          </NFormItem>
          <NFormItem label="Process Flow">
            <NSelect
              v-model:value="form.process_template_id"
              :options="templateOptions"
              placeholder="Select process template"
              @update:value="onTemplateChange"
            />
          </NFormItem>
          <NFormItem label="Current Stage (status)">
            <NSelect
              v-model:value="form.current_stage_id"
              :options="formStageOptions"
              placeholder="Select stage"
              :disabled="!form.process_template_id"
            />
          </NFormItem>
          <NSpace>
            <NFormItem label="Start Date">
              <NDatePicker
                v-model:formatted-value="form.start_date"
                value-format="yyyy-MM-dd"
                type="date"
                @update:formatted-value="onStartChange"
              />
            </NFormItem>
            <NFormItem label="End Date">
              <NDatePicker v-model:formatted-value="form.end_date" value-format="yyyy-MM-dd" type="date" />
            </NFormItem>
          </NSpace>
          <NFormItem label="Cancelled">
            <NSwitch v-model:value="form.cancelled" />
          </NFormItem>
          <NFormItem label="Color">
            <NColorPicker v-model:value="form.color" :modes="['hex']" :show-alpha="false" :swatches="COLOR_SWATCHES" />
          </NFormItem>
          <NFormItem label="Description">
            <NInput v-model:value="form.description" type="textarea" placeholder="Optional notes" :rows="2" />
          </NFormItem>
          <NSpace justify="end">
            <NButton @click="showModal = false">Cancel</NButton>
            <NButton type="primary" attr-type="submit">Save</NButton>
          </NSpace>
        </NForm>
      </NCard>
    </NModal>
  </div>
</template>

<style scoped>
.cockpit-cal {
  margin: -24px;
  padding: 24px;
  background: #eceef2;
  min-height: calc(100vh - 48px);
  box-sizing: border-box;
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  color: #1a1d23;
}
.mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; }

.cal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.cal-title { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
.cal-add {
  display: inline-flex; align-items: center; gap: 6px;
  background: #5b50d6; border: none; border-radius: 9px;
  padding: 10px 16px; color: #fff; font-weight: 600; font-size: 13.5px;
  cursor: pointer; font-family: inherit;
}
.cal-add:hover { background: #4a40c2; }
.cal-add:focus-visible { outline: 2px solid #5b50d6; outline-offset: 2px; }

.cal-toolbar {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  flex-wrap: wrap;
  background: #fff; border: 1px solid #e7e9ee; border-radius: 12px;
  padding: 12px 14px; margin-bottom: 16px;
}
.cal-filters { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.cal-views { display: flex; align-items: center; gap: 10px; }
.seg { display: inline-flex; background: #f0f1f4; border-radius: 9px; padding: 3px; gap: 2px; }
.seg-btn {
  border: none; background: transparent; cursor: pointer;
  font-family: inherit; font-size: 13px; font-weight: 600; color: #6b7280;
  padding: 6px 14px; border-radius: 7px;
}
.seg-btn:hover { color: #1a1d23; }
.seg-btn.active { background: #fff; color: #3f37a8; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08); }
.seg-btn:focus-visible { outline: 2px solid #5b50d6; outline-offset: 2px; }

.cal-list { display: flex; flex-direction: column; gap: 10px; }
.cal-empty {
  background: #fff; border: 1px dashed #d7dae1; border-radius: 12px;
  padding: 40px; text-align: center; color: #9aa0ab;
}
.cal-row {
  display: flex; align-items: center; gap: 16px;
  background: #fff; border: 1px solid #e7e9ee; border-radius: 12px;
  padding: 14px 18px 14px 0; overflow: hidden;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.cal-row:hover { border-color: #cfd3da; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04); }
.cal-bar { align-self: stretch; width: 4px; flex: 0 0 auto; }
.cal-row-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 5px; padding-left: 14px; }
.cal-row-l1 { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.cal-name { font-size: 15px; font-weight: 700; letter-spacing: -0.01em; white-space: nowrap; }
.cal-type { font-size: 12.5px; color: #6b7280; }
.cal-tag { font-size: 11.5px; font-weight: 600; padding: 2px 9px; border-radius: 6px; white-space: nowrap; }
.cal-tag.is-stage { color: #3f37a8; background: #f0eefc; }
.cal-tag.is-cancel { color: #b32630; background: #fbe7e8; }
.cal-row-l2 { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 12.5px; color: #9aa0ab; }
.cal-flow { color: #6b7280; }
.cal-sep { color: #cfd3da; }
.cal-dates { color: #374151; white-space: nowrap; }
.cal-days { color: #9aa0ab; }
.cal-row-actions { display: flex; align-items: center; gap: 6px; flex: 0 0 auto; }
.cal-btn {
  border: 1px solid #e7e9ee; background: #fff; cursor: pointer;
  font-family: inherit; font-size: 12.5px; font-weight: 600; color: #374151;
  padding: 6px 12px; border-radius: 8px;
}
.cal-btn:hover { border-color: #cfd3da; }
.cal-btn.primary { background: #5b50d6; border-color: #5b50d6; color: #fff; }
.cal-btn.primary:hover { background: #4a40c2; }
.cal-btn.danger { color: #b32630; border-color: #f1d6d8; }
.cal-btn.danger:hover { background: #fdf1f2; }
.cal-btn:focus-visible { outline: 2px solid #5b50d6; outline-offset: 2px; }

.cal-canvas { background: #fff; border: 1px solid #e7e9ee; border-radius: 12px; padding: 14px; overflow: hidden; }

@media (max-width: 900px) {
  .cal-toolbar { flex-direction: column; align-items: stretch; }
  .cal-row { flex-wrap: wrap; }
  .cal-row-actions { width: 100%; padding-left: 18px; }
}
</style>
