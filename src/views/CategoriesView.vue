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
  NSwitch,
  NPopconfirm,
  useMessage,
} from 'naive-ui'
import type { DataTableColumns, SelectOption } from 'naive-ui'
import api from '../api/client'
import type { Category } from '../types/category'

interface CategoryRow extends Category {
  children?: CategoryRow[]
}

const message = useMessage()
const categories = ref<Category[]>([])
const loading = ref(false)
const showModal = ref(false)
const editingCategory = ref<Category | null>(null)

const form = ref({
  name: '',
  code: '',
  parent_id: null as number | null,
  sort_order: 0,
  active: true,
})

const modalTitle = computed(() => (editingCategory.value ? 'Edit Category' : 'New Category'))

// Build a 2-level tree from the flat list (top-level rows with their children).
const treeData = computed<CategoryRow[]>(() => {
  const roots = categories.value.filter((c) => !c.parent_id)
  return roots.map((r) => {
    const children = categories.value.filter((c) => c.parent_id === r.id)
    return children.length ? { ...r, children } : { ...r }
  })
})

// Parent options = top-level categories (excluding the one being edited).
const parentOptions = computed<SelectOption[]>(() =>
  categories.value
    .filter((c) => !c.parent_id && c.id !== editingCategory.value?.id)
    .map((c) => ({ label: c.name, value: c.id }))
)

const columns: DataTableColumns<CategoryRow> = [
  { title: 'Name', key: 'name' },
  { title: 'Code', key: 'code', width: 240 },
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
    width: 200,
    render(row) {
      return h(NSpace, { size: 8 }, {
        default: () => [
          h(NButton, { size: 'small', onClick: () => openNew(row.id) }, { default: () => '+ Sub' }),
          h(NButton, { size: 'small', onClick: () => openEdit(row) }, { default: () => 'Edit' }),
          h(
            NPopconfirm,
            { onPositiveClick: () => deleteCategory(row.id) },
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

function openNew(parentId: number | null = null) {
  editingCategory.value = null
  form.value = { name: '', code: '', parent_id: parentId, sort_order: 0, active: true }
  showModal.value = true
}

function openEdit(c: Category) {
  editingCategory.value = c
  form.value = { name: c.name, code: c.code, parent_id: c.parent_id, sort_order: c.sort_order, active: c.active }
  showModal.value = true
}

async function saveCategory() {
  try {
    if (editingCategory.value) {
      await api.patch(`/categories/${editingCategory.value.id}`, form.value)
      message.success('Category updated')
    } else {
      await api.post('/categories', form.value)
      message.success('Category created')
    }
    showModal.value = false
    await loadCategories()
  } catch (err: any) {
    const errors = err.response?.data?.errors
    message.error(Array.isArray(errors) ? errors.join(', ') : 'Failed to save')
  }
}

async function deleteCategory(id: number) {
  try {
    await api.delete(`/categories/${id}`)
    message.success('Category deleted')
    await loadCategories()
  } catch {
    message.error('Failed to delete')
  }
}

async function loadCategories() {
  loading.value = true
  try {
    const { data } = await api.get('/categories')
    categories.value = data
  } catch {
    message.error('Failed to load categories')
  } finally {
    loading.value = false
  }
}

onMounted(loadCategories)
</script>

<template>
  <div>
    <NSpace justify="space-between" align="center" style="margin-bottom: 16px">
      <NH2 style="margin: 0">Product Categories</NH2>
      <NButton type="primary" @click="openNew()">Add Category</NButton>
    </NSpace>

    <NDataTable
      :columns="columns"
      :data="treeData"
      :loading="loading"
      :bordered="true"
      :single-line="false"
      :row-key="(row: CategoryRow) => row.id"
    />

    <NModal v-model:show="showModal">
      <NCard :title="modalTitle" style="width: 460px" closable @close="showModal = false">
        <NForm @submit.prevent="saveCategory">
          <NFormItem label="Name">
            <NInput v-model:value="form.name" placeholder="e.g. Dairy" />
          </NFormItem>
          <NFormItem label="Code">
            <NInput v-model:value="form.code" placeholder="e.g. dairy" />
          </NFormItem>
          <NFormItem label="Parent category">
            <NSelect
              v-model:value="form.parent_id"
              :options="parentOptions"
              placeholder="None (top-level department)"
              clearable
            />
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
