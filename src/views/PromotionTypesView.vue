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
  NSwitch,
  NPopconfirm,
  useMessage,
} from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import api from '../api/client'
import type { PromotionType } from '../types/campaign'
import PromotionSkeleton from '../components/PromotionSkeleton.vue'

const message = useMessage()
const types = ref<PromotionType[]>([])
const loading = ref(false)
const showModal = ref(false)
const editingType = ref<PromotionType | null>(null)

const form = ref({
  name: '',
  code: '',
  description: '',
  active: true,
  sort_order: 0,
  min_products: 1,
  max_products: null as number | null,
})

const modalTitle = computed(() => (editingType.value ? 'Edit Promotion Type' : 'New Promotion Type'))

const columns: DataTableColumns<PromotionType> = [
  { title: '#', key: 'sort_order', width: 60, sorter: 'default' },
  { title: 'Name', key: 'name', sorter: 'default' },
  { title: 'Code', key: 'code', width: 150 },
  { title: 'Min. products', key: 'min_products', width: 100 },
  { title: 'Max. products', key: 'max_products', width: 100, render: (row) => row.max_products ?? '∞' },
  {
    title: 'Preview (skeleton)',
    key: 'layout',
    width: 300,
    render: (row) => h(PromotionSkeleton, { layout: row.layout }),
  },
  {
    title: 'Status',
    key: 'active',
    width: 100,
    render(row) {
      return h(NTag, { type: row.active ? 'success' : 'warning', size: 'small' }, { default: () => (row.active ? 'Active' : 'Inactive') })
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
  form.value = { name: '', code: '', description: '', active: true, sort_order: 0, min_products: 1, max_products: null }
  showModal.value = true
}

function openEdit(ct: PromotionType) {
  editingType.value = ct
  form.value = {
    name: ct.name,
    code: ct.code,
    description: ct.description,
    active: ct.active,
    sort_order: ct.sort_order,
    min_products: ct.min_products,
    max_products: ct.max_products,
  }
  showModal.value = true
}

async function saveType() {
  try {
    if (editingType.value) {
      await api.patch(`/promotion_types/${editingType.value.id}`, form.value)
      message.success('Promotion type updated')
    } else {
      await api.post('/promotion_types', form.value)
      message.success('Promotion type created')
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
    await api.delete(`/promotion_types/${id}`)
    message.success('Promotion type deleted')
    await loadTypes()
  } catch (err: any) {
    const errors = err.response?.data?.errors
    message.error(Array.isArray(errors) ? errors.join(', ') : 'Failed to delete')
  }
}

async function loadTypes() {
  loading.value = true
  try {
    const { data } = await api.get('/promotion_types')
    types.value = data
  } catch {
    message.error('Failed to load promotion types')
  } finally {
    loading.value = false
  }
}

onMounted(loadTypes)
</script>

<template>
  <div>
    <NSpace justify="space-between" align="center" style="margin-bottom: 16px">
      <NH2 style="margin: 0">Promotion Types</NH2>
      <NButton type="primary" @click="openNew">Add Type</NButton>
    </NSpace>

    <NDataTable
      :columns="columns"
      :data="types"
      :loading="loading"
      :bordered="true"
      :single-line="false"
      :row-key="(row: PromotionType) => row.id"
    />

    <NModal v-model:show="showModal">
      <NCard :title="modalTitle" style="width: 500px" closable @close="showModal = false">
        <NForm @submit.prevent="saveType">
          <NFormItem label="Name">
            <NInput v-model:value="form.name" placeholder="e.g. Simple (old → new price)" />
          </NFormItem>
          <NFormItem label="Code">
            <NInput v-model:value="form.code" placeholder="e.g. simple" />
          </NFormItem>
          <NFormItem label="Description">
            <NInput v-model:value="form.description" type="textarea" placeholder="Short description" :rows="2" />
          </NFormItem>
          <NFormItem label="Min. products">
            <NInputNumber v-model:value="form.min_products" :min="1" />
          </NFormItem>
          <NFormItem label="Max. products (empty = no limit)">
            <NInputNumber v-model:value="form.max_products" :min="1" clearable />
          </NFormItem>
          <NFormItem label="Sort Order">
            <NInputNumber v-model:value="form.sort_order" :min="0" />
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
