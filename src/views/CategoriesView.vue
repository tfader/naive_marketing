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
  NSwitch,
  NPopconfirm,
  useMessage,
} from 'naive-ui'
import type { SelectOption } from 'naive-ui'
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
  <div class="cockpit-cat">
    <div class="cat-head">
      <div>
        <h1 class="cat-title">Product Categories</h1>
        <span class="cat-total mono">{{ categories.length }} total</span>
      </div>
      <button class="cat-add" @click="openNew()">+ Add category</button>
    </div>

    <div v-if="loading" class="cat-empty">Loading…</div>
    <div v-else-if="!treeData.length" class="cat-empty">No categories yet.</div>
    <div v-else class="cat-list">
      <div v-for="dept in treeData" :key="dept.id" class="cat-dept">
        <div class="cat-dept-head">
          <span class="cat-name">{{ dept.name }}</span>
          <span class="cat-code mono">{{ dept.code }}</span>
          <span class="cat-status" :class="dept.active ? 'is-on' : 'is-off'">{{ dept.active ? 'Active' : 'Inactive' }}</span>
          <span v-if="dept.children?.length" class="cat-count mono">{{ dept.children.length }} sub</span>
          <span class="cat-spacer"></span>
          <div class="cat-actions">
            <button class="cat-btn" @click="openNew(dept.id)">+ Sub</button>
            <button class="cat-btn" @click="openEdit(dept)">Edit</button>
            <NPopconfirm @positive-click="() => deleteCategory(dept.id)">
              <template #trigger><button class="cat-btn danger">Delete</button></template>
              Delete "{{ dept.name }}"?
            </NPopconfirm>
          </div>
        </div>

        <div v-if="dept.children?.length" class="cat-children">
          <div v-for="ch in dept.children" :key="ch.id" class="cat-child">
            <span class="cat-child-dot"></span>
            <span class="cat-child-name">{{ ch.name }}</span>
            <span class="cat-code mono">{{ ch.code }}</span>
            <span v-if="!ch.active" class="cat-status is-off">Inactive</span>
            <span class="cat-spacer"></span>
            <div class="cat-actions">
              <button class="cat-btn" @click="openEdit(ch)">Edit</button>
              <NPopconfirm @positive-click="() => deleteCategory(ch.id)">
                <template #trigger><button class="cat-btn danger">Delete</button></template>
                Delete "{{ ch.name }}"?
              </NPopconfirm>
            </div>
          </div>
        </div>
        <div v-else class="cat-nochild">No subcategories</div>
      </div>
    </div>

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

<style scoped>
.cockpit-cat {
  margin: -24px;
  padding: 24px;
  background: #eceef2;
  min-height: calc(100vh - 48px);
  box-sizing: border-box;
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  color: #1a1d23;
}
.mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; }

.cat-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.cat-title { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
.cat-total { font-size: 12.5px; color: #9aa0ab; }
.cat-add {
  display: inline-flex; align-items: center; gap: 6px;
  background: #5b50d6; border: none; border-radius: 9px;
  padding: 10px 16px; color: #fff; font-weight: 600; font-size: 13.5px;
  cursor: pointer; font-family: inherit;
}
.cat-add:hover { background: #4a40c2; }

.cat-list { display: flex; flex-direction: column; gap: 12px; }
.cat-empty {
  background: #fff; border: 1px dashed #d7dae1; border-radius: 12px;
  padding: 40px; text-align: center; color: #9aa0ab;
}
.cat-dept { background: #fff; border: 1px solid #e7e9ee; border-radius: 12px; overflow: hidden; }
.cat-dept-head {
  display: flex; align-items: center; gap: 11px;
  padding: 14px 18px; border-bottom: 1px solid #f0f1f4; background: #fafbfc;
}
.cat-name { font-size: 15px; font-weight: 700; letter-spacing: -0.01em; }
.cat-code { font-size: 11.5px; color: #9aa0ab; }
.cat-status { font-size: 11px; font-weight: 600; padding: 2px 9px; border-radius: 20px; white-space: nowrap; }
.cat-status.is-on { color: #0f7a4a; background: #e3f4ec; }
.cat-status.is-off { color: #9a6608; background: #f7eedb; }
.cat-count { font-size: 11.5px; color: #9aa0ab; }
.cat-spacer { flex: 1; }
.cat-actions { display: flex; gap: 6px; }
.cat-btn {
  border: 1px solid #e7e9ee; background: #fff; cursor: pointer;
  font-family: inherit; font-size: 12.5px; font-weight: 600; color: #374151;
  padding: 5px 11px; border-radius: 8px;
}
.cat-btn:hover { border-color: #cfd3da; }
.cat-btn.danger { color: #b32630; border-color: #f1d6d8; }
.cat-btn.danger:hover { background: #fdf1f2; }

.cat-children { display: flex; flex-direction: column; }
.cat-child {
  display: flex; align-items: center; gap: 11px;
  padding: 11px 18px 11px 22px; border-bottom: 1px solid #f4f5f7;
}
.cat-child:last-child { border-bottom: none; }
.cat-child:hover { background: #fafbfc; }
.cat-child-dot { width: 6px; height: 6px; border-radius: 2px; background: #cdd1d8; flex: 0 0 auto; }
.cat-child-name { font-size: 13.5px; font-weight: 600; }
.cat-nochild { padding: 12px 18px; font-size: 12.5px; color: #b8bdc7; font-style: italic; }
</style>
