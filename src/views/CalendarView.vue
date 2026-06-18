<script setup lang="ts">
import { ref, onMounted, h, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  NH2,
  NDataTable,
  NButton,
  NSpace,
  NTag,
  NText,
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
  NRadioGroup,
  NRadioButton,
  NPopconfirm,
  useMessage,
} from 'naive-ui'
import type { DataTableColumns, SelectOption } from 'naive-ui'
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

const columns: DataTableColumns<CalendarEvent> = [
  { title: 'Name', key: 'name', sorter: 'default' },
  {
    title: 'Type',
    key: 'campaign_type',
    width: 180,
    render(row) {
      return h('div', { style: 'display: flex; align-items: center; gap: 8px' }, [
        h('span', {
          style: `display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: ${row.color || '#cbd5e1'}`,
        }),
        h('span', null, row.campaign_type.name),
      ])
    },
  },
  {
    title: 'Flow',
    key: 'process_template',
    width: 170,
    render: (row) => row.process_template
      ? h(NText, { depth: 3 }, { default: () => row.process_template!.name })
      : h('span', { style: 'color: #aaa' }, '—'),
  },
  {
    title: 'Status (stage)',
    key: 'current_stage',
    width: 200,
    render(row) {
      if (row.cancelled) {
        return h(NTag, { type: 'error', size: 'small' }, { default: () => 'Cancelled' })
      }
      if (!row.current_stage) {
        return h('span', { style: 'color: #aaa' }, '—')
      }
      return h(NTag, { type: 'info', size: 'small' }, {
        default: () => `${row.current_stage!.position}. ${row.current_stage!.name}`,
      })
    },
  },
  { title: 'Start', key: 'start_date', width: 110, sorter: 'default' },
  { title: 'End', key: 'end_date', width: 110 },
  { title: 'Days', key: 'duration_days', width: 70, render: (row) => `${row.duration_days}d` },
  {
    title: 'Actions',
    key: 'actions',
    width: 230,
    render(row) {
      return h(NSpace, { size: 8 }, {
        default: () => [
          h(NButton, {
            size: 'small',
            type: row.campaign_id ? 'default' : 'primary',
            onClick: () => launchEvent(row),
          }, { default: () => (row.campaign_id ? 'Open' : 'Launch') }),
          h(NButton, { size: 'small', onClick: () => openEdit(row) }, { default: () => 'Edit' }),
          h(
            NPopconfirm,
            { onPositiveClick: () => deleteEvent(row.id) },
            {
              trigger: () => h(NButton, { size: 'small', type: 'error' }, { default: () => 'Delete' }),
              default: () => `Delete "${row.name}"?`,
            }
          ),
        ],
      })
    },
  },
]

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
  <div>
    <NSpace justify="space-between" align="center" style="margin-bottom: 16px">
      <NH2 style="margin: 0">Marketing Calendar</NH2>
      <NButton type="primary" @click="openNew">Add Event</NButton>
    </NSpace>

    <NSpace align="center" justify="space-between" style="margin-bottom: 16px">
      <NSpace align="center">
        <NSelect
          v-model:value="selectedYear"
          :options="yearOptions"
          style="width: 120px"
          @update:value="loadEvents"
        />
        <NSelect
          v-model:value="selectedType"
          :options="typeOptions"
          placeholder="All types"
          clearable
          style="width: 200px"
        />
        <NSelect
          v-model:value="selectedStage"
          :options="stageFilterOptions"
          placeholder="All stages"
          clearable
          style="width: 220px"
        />
      </NSpace>

      <NSpace align="center">
        <NRadioGroup v-model:value="viewMode" size="small">
          <NRadioButton value="table">Table</NRadioButton>
          <NRadioButton value="calendar">Calendar</NRadioButton>
        </NRadioGroup>
        <NRadioGroup v-if="viewMode === 'calendar'" v-model:value="calendarMode" size="small">
          <NRadioButton value="year">Year</NRadioButton>
          <NRadioButton value="month">Month</NRadioButton>
        </NRadioGroup>
      </NSpace>
    </NSpace>

    <NDataTable
      v-if="viewMode === 'table'"
      :columns="columns"
      :data="filteredEvents"
      :loading="loading"
      :bordered="true"
      :single-line="false"
      :row-key="(row: CalendarEvent) => row.id"
    />
    <CalendarYearTimeline
      v-else-if="calendarMode === 'year'"
      :events="filteredEvents"
      :year="selectedYear"
      @event-click="openEdit"
    />
    <CalendarMonthGrid
      v-else
      :events="filteredEvents"
      :year="selectedYear"
      @event-click="openEdit"
      @year-change="onYearChange"
    />

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
