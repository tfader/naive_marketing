<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import {
  NButton,
  NSpace,
  NModal,
  NCard,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSelect,
  NColorPicker,
  NSwitch,
  NPopconfirm,
  useMessage,
} from 'naive-ui'
import type { SelectOption } from 'naive-ui'
import api from '../api/client'

const COLOR_SWATCHES = [
  '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444',
  '#ec4899', '#f43f5e', '#8b5cf6', '#6366f1', '#f97316',
  '#64748b', '#111827',
]

interface TemplateRef {
  id: number
  name: string
}

interface CampaignType {
  id: number
  name: string
  code: string
  description: string
  active: boolean
  sort_order: number
  color: string | null
  has_pages: boolean
  default_duration_days: number | null
  default_process_template_id: number | null
  default_process_template: TemplateRef | null
}

const message = useMessage()
const types = ref<CampaignType[]>([])
const templates = ref<TemplateRef[]>([])
const loading = ref(false)
const showModal = ref(false)
const editingType = ref<CampaignType | null>(null)

const form = ref({
  name: '',
  code: '',
  description: '',
  active: true,
  sort_order: 0,
  color: '#3b82f6' as string | null,
  has_pages: false,
  default_duration_days: null as number | null,
  default_process_template_id: null as number | null,
})

const templateOptions = computed<SelectOption[]>(() =>
  templates.value.map((t) => ({ label: t.name, value: t.id }))
)

const modalTitle = computed(() => (editingType.value ? 'Edit Campaign Type' : 'New Campaign Type'))

const sortedTypes = computed(() => [...types.value].sort((a, b) => a.sort_order - b.sort_order))

function openNew() {
  editingType.value = null
  form.value = { name: '', code: '', description: '', active: true, sort_order: 0, color: '#3b82f6', has_pages: false, default_duration_days: null, default_process_template_id: null }
  showModal.value = true
}

function openEdit(ct: CampaignType) {
  editingType.value = ct
  form.value = {
    name: ct.name,
    code: ct.code,
    description: ct.description,
    active: ct.active,
    sort_order: ct.sort_order,
    color: ct.color ?? '#3b82f6',
    has_pages: ct.has_pages,
    default_duration_days: ct.default_duration_days,
    default_process_template_id: ct.default_process_template_id,
  }
  showModal.value = true
}

async function saveType() {
  try {
    if (editingType.value) {
      await api.patch(`/campaign_types/${editingType.value.id}`, form.value)
      message.success('Campaign type updated')
    } else {
      await api.post('/campaign_types', form.value)
      message.success('Campaign type created')
    }
    showModal.value = false
    await loadTypes()
  } catch (err: any) {
    const errors = err.response?.data?.errors
    message.error(Array.isArray(errors) ? errors.join(', ') : 'Failed to save')
  }
}

async function deleteType(id: number) {
  try {
    await api.delete(`/campaign_types/${id}`)
    message.success('Campaign type deleted')
    await loadTypes()
  } catch (err: any) {
    message.error('Failed to delete')
  }
}

async function loadTypes() {
  loading.value = true
  try {
    const { data } = await api.get('/campaign_types')
    types.value = data
  } catch {
    message.error('Failed to load campaign types')
  } finally {
    loading.value = false
  }
}

async function loadTemplates() {
  try {
    const { data } = await api.get('/process_templates')
    templates.value = data
  } catch {
    message.error('Failed to load process templates')
  }
}

onMounted(async () => {
  await loadTemplates()
  await loadTypes()
})
</script>

<template>
  <div class="cockpit-ct">
    <div class="ct-head">
      <div>
        <h1 class="ct-title">Campaign Types</h1>
        <span class="ct-total mono">{{ types.length }} types</span>
      </div>
      <button class="ct-add" @click="openNew">+ Add type</button>
    </div>

    <div v-if="loading" class="ct-empty">Loading…</div>
    <div v-else-if="!types.length" class="ct-empty">No campaign types yet.</div>
    <div v-else class="ct-grid">
      <div
        v-for="t in sortedTypes"
        :key="t.id"
        class="ct-card"
        :class="{ inactive: !t.active }"
        :style="{ borderLeftColor: t.color || '#cbd5e1' }"
      >
        <div class="ct-card-head">
          <div class="ct-id">
            <span class="ct-swatch" :style="{ background: t.color || '#cbd5e1' }"></span>
            <div class="ct-id-text">
              <span class="ct-name">{{ t.name }}</span>
              <span class="ct-code mono">{{ t.code }}</span>
            </div>
          </div>
          <span class="ct-status" :class="t.active ? 'is-on' : 'is-off'">{{ t.active ? 'Active' : 'Inactive' }}</span>
        </div>

        <p v-if="t.description" class="ct-desc">{{ t.description }}</p>

        <div class="ct-meta">
          <span class="ct-chip">Duration <b class="mono">{{ t.default_duration_days ? t.default_duration_days + 'd' : '—' }}</b></span>
          <span v-if="t.has_pages" class="ct-chip is-leaflet">Leaflet · pages</span>
          <span class="ct-chip">Flow <b>{{ t.default_process_template ? t.default_process_template.name : '—' }}</b></span>
        </div>

        <div class="ct-actions">
          <button class="ct-btn" @click="openEdit(t)">Edit</button>
          <NPopconfirm @positive-click="() => deleteType(t.id)">
            <template #trigger><button class="ct-btn danger">Delete</button></template>
            Delete "{{ t.name }}"?
          </NPopconfirm>
        </div>
      </div>
    </div>

    <NModal v-model:show="showModal">
      <NCard :title="modalTitle" style="width: 500px" closable @close="showModal = false">
        <NForm @submit.prevent="saveType">
          <NFormItem label="Name">
            <NInput v-model:value="form.name" placeholder="e.g. Promotional Leaflet" />
          </NFormItem>
          <NFormItem label="Code">
            <NInput v-model:value="form.code" placeholder="e.g. leaflet" />
          </NFormItem>
          <NFormItem label="Description">
            <NInput v-model:value="form.description" type="textarea" placeholder="Short description" :rows="2" />
          </NFormItem>
          <NFormItem label="Color">
            <NColorPicker v-model:value="form.color" :modes="['hex']" :show-alpha="false" :swatches="COLOR_SWATCHES" />
          </NFormItem>
          <NFormItem label="Default Duration (days)">
            <NInputNumber v-model:value="form.default_duration_days" :min="1" placeholder="e.g. 14" style="width: 100%" />
          </NFormItem>
          <NFormItem label="Default Flow">
            <NSelect
              v-model:value="form.default_process_template_id"
              :options="templateOptions"
              placeholder="Select default process template"
              clearable
            />
          </NFormItem>
          <NFormItem label="Sort Order">
            <NInputNumber v-model:value="form.sort_order" :min="0" />
          </NFormItem>
          <NFormItem label="Leaflet (has pages)">
            <NSwitch v-model:value="form.has_pages" />
          </NFormItem>
          <NFormItem label="Active">
            <NSwitch v-model:value="form.active" />
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
.cockpit-ct {
  margin: -24px;
  padding: 24px;
  background: #eceef2;
  min-height: calc(100vh - 48px);
  box-sizing: border-box;
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  color: #1a1d23;
}
.mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; }

.ct-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.ct-title { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
.ct-total { font-size: 12.5px; color: #9aa0ab; }
.ct-add {
  display: inline-flex; align-items: center; gap: 6px;
  background: #5b50d6; border: none; border-radius: 9px;
  padding: 10px 16px; color: #fff; font-weight: 600; font-size: 13.5px;
  cursor: pointer; font-family: inherit;
}
.ct-add:hover { background: #4a40c2; }

.ct-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 14px; }
.ct-empty {
  background: #fff; border: 1px dashed #d7dae1; border-radius: 12px;
  padding: 40px; text-align: center; color: #9aa0ab;
}
.ct-card {
  background: #fff; border: 1px solid #e7e9ee; border-left: 4px solid #cbd5e1; border-radius: 12px;
  padding: 16px 18px; display: flex; flex-direction: column; gap: 12px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.ct-card:hover { box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05); }
.ct-card.inactive { opacity: 0.62; }
.ct-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.ct-id { display: flex; align-items: center; gap: 10px; min-width: 0; }
.ct-swatch { width: 14px; height: 14px; border-radius: 4px; flex: 0 0 auto; }
.ct-id-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ct-name { font-size: 15px; font-weight: 700; letter-spacing: -0.01em; }
.ct-code { font-size: 11.5px; color: #9aa0ab; }
.ct-status { font-size: 11px; font-weight: 600; padding: 2px 9px; border-radius: 20px; white-space: nowrap; }
.ct-status.is-on { color: #0f7a4a; background: #e3f4ec; }
.ct-status.is-off { color: #9a6608; background: #f7eedb; }
.ct-desc { margin: 0; font-size: 13px; color: #6b7280; line-height: 1.5; }
.ct-meta { display: flex; flex-wrap: wrap; gap: 8px; }
.ct-chip { font-size: 12px; color: #6b7280; background: #f0f1f4; padding: 3px 10px; border-radius: 7px; }
.ct-chip b { color: #1a1d23; }
.ct-chip.is-leaflet { color: #3f37a8; background: #f0eefc; font-weight: 600; }
.ct-actions { display: flex; gap: 6px; }
.ct-btn {
  border: 1px solid #e7e9ee; background: #fff; cursor: pointer;
  font-family: inherit; font-size: 12.5px; font-weight: 600; color: #374151;
  padding: 6px 12px; border-radius: 8px;
}
.ct-btn:hover { border-color: #cfd3da; }
.ct-btn.danger { color: #b32630; border-color: #f1d6d8; }
.ct-btn.danger:hover { background: #fdf1f2; }
</style>
