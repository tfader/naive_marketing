<script setup lang="ts">
import { ref, onMounted, h, computed } from 'vue'
import {
  NH2,
  NDataTable,
  NButton,
  NSpace,
  NTag,
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
import type { DataTableColumns, SelectOption } from 'naive-ui'
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

const columns: DataTableColumns<CampaignType> = [
  { title: '#', key: 'sort_order', width: 60, sorter: 'default' },
  {
    title: 'Color',
    key: 'color',
    width: 70,
    render: (row) => h('span', {
      style: `display: inline-block; width: 14px; height: 14px; border-radius: 3px; background: ${row.color || '#cbd5e1'}`,
    }),
  },
  { title: 'Name', key: 'name', sorter: 'default' },
  { title: 'Code', key: 'code', width: 130 },
  {
    title: 'Duration',
    key: 'default_duration_days',
    width: 100,
    render: (row) => row.default_duration_days ? `${row.default_duration_days}d` : h('span', { style: 'color: #aaa' }, '—'),
  },
  {
    title: 'Leaflet',
    key: 'has_pages',
    width: 90,
    render: (row) => row.has_pages
      ? h(NTag, { size: 'small', type: 'info' }, { default: () => 'Pages' })
      : h('span', { style: 'color: #aaa' }, '—'),
  },
  {
    title: 'Default Flow',
    key: 'default_process_template',
    width: 220,
    render(row) {
      return row.default_process_template
        ? h(NTag, { size: 'small', type: 'info' }, { default: () => row.default_process_template!.name })
        : h('span', { style: 'color: #aaa' }, '—')
    },
  },
  {
    title: 'Status',
    key: 'active',
    width: 100,
    render(row) {
      return h(NTag, { type: row.active ? 'success' : 'warning', size: 'small' }, { default: () => row.active ? 'Active' : 'Inactive' })
    },
  },
  {
    title: 'Actions',
    key: 'actions',
    width: 160,
    render(row) {
      return h(NSpace, { size: 8 }, {
        default: () => [
          h(NButton, { size: 'small', onClick: () => openEdit(row) }, { default: () => 'Edit' }),
          h(
            NPopconfirm,
            { onPositiveClick: () => deleteType(row.id) },
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
  <div>
    <NSpace justify="space-between" align="center" style="margin-bottom: 16px">
      <NH2 style="margin: 0">Campaign Types</NH2>
      <NButton type="primary" @click="openNew">Add Type</NButton>
    </NSpace>

    <NDataTable
      :columns="columns"
      :data="types"
      :loading="loading"
      :bordered="true"
      :single-line="false"
      :row-key="(row: CampaignType) => row.id"
    />

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
