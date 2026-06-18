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
  NSwitch,
  NPopconfirm,
  useMessage,
} from 'naive-ui'
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

const sortedTypes = computed(() => [...types.value].sort((a, b) => a.sort_order - b.sort_order))

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
  <div class="cockpit-pt">
    <div class="pt-head">
      <div>
        <h1 class="pt-title">Promotion Types</h1>
        <span class="pt-total mono">{{ types.length }} types</span>
      </div>
      <button class="pt-add" @click="openNew">+ Add type</button>
    </div>

    <div v-if="loading" class="pt-empty">Loading…</div>
    <div v-else-if="!types.length" class="pt-empty">No promotion types yet.</div>
    <div v-else class="pt-grid">
      <div v-for="t in sortedTypes" :key="t.id" class="pt-card" :class="{ inactive: !t.active }">
        <div class="pt-card-head">
          <div class="pt-id">
            <span class="pt-name">{{ t.name }}</span>
            <span class="pt-code mono">{{ t.code }}</span>
          </div>
          <span class="pt-status" :class="t.active ? 'is-on' : 'is-off'">{{ t.active ? 'Active' : 'Inactive' }}</span>
        </div>

        <p v-if="t.description" class="pt-desc">{{ t.description }}</p>

        <div class="pt-preview">
          <PromotionSkeleton :layout="t.layout" />
        </div>

        <div class="pt-foot">
          <div class="pt-meta">
            <span class="pt-chip">min <b class="mono">{{ t.min_products }}</b></span>
            <span class="pt-chip">max <b class="mono">{{ t.max_products ?? '∞' }}</b></span>
          </div>
          <div class="pt-actions">
            <button class="pt-btn" @click="openEdit(t)">Edit</button>
            <NPopconfirm @positive-click="() => deleteType(t.id)">
              <template #trigger><button class="pt-btn danger">Delete</button></template>
              Delete "{{ t.name }}"?
            </NPopconfirm>
          </div>
        </div>
      </div>
    </div>

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

<style scoped>
.cockpit-pt {
  margin: -24px;
  padding: 24px;
  background: #eceef2;
  min-height: calc(100vh - 48px);
  box-sizing: border-box;
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  color: #1a1d23;
}
.mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; }

.pt-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.pt-title { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
.pt-total { font-size: 12.5px; color: #9aa0ab; }
.pt-add {
  display: inline-flex; align-items: center; gap: 6px;
  background: #5b50d6; border: none; border-radius: 9px;
  padding: 10px 16px; color: #fff; font-weight: 600; font-size: 13.5px;
  cursor: pointer; font-family: inherit;
}
.pt-add:hover { background: #4a40c2; }

.pt-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 14px; }
.pt-empty {
  background: #fff; border: 1px dashed #d7dae1; border-radius: 12px;
  padding: 40px; text-align: center; color: #9aa0ab;
}
.pt-card {
  background: #fff; border: 1px solid #e7e9ee; border-radius: 14px;
  padding: 16px 18px; display: flex; flex-direction: column; gap: 12px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.pt-card:hover { border-color: #cfd3da; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04); }
.pt-card.inactive { opacity: 0.62; }
.pt-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.pt-id { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.pt-name { font-size: 15px; font-weight: 700; letter-spacing: -0.01em; }
.pt-code { font-size: 11.5px; color: #9aa0ab; }
.pt-status { font-size: 11px; font-weight: 600; padding: 2px 9px; border-radius: 20px; white-space: nowrap; }
.pt-status.is-on { color: #0f7a4a; background: #e3f4ec; }
.pt-status.is-off { color: #9a6608; background: #f7eedb; }
.pt-desc { margin: 0; font-size: 13px; color: #6b7280; line-height: 1.5; }
.pt-preview {
  display: flex; align-items: center; justify-content: center;
  min-height: 92px; padding: 14px;
  background: #f6f7f9; border: 1px solid #eef0f3; border-radius: 10px;
}
.pt-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.pt-meta { display: flex; gap: 8px; }
.pt-chip { font-size: 12px; color: #6b7280; background: #f0f1f4; padding: 3px 10px; border-radius: 7px; }
.pt-chip b { color: #1a1d23; }
.pt-actions { display: flex; gap: 6px; }
.pt-btn {
  border: 1px solid #e7e9ee; background: #fff; cursor: pointer;
  font-family: inherit; font-size: 12.5px; font-weight: 600; color: #374151;
  padding: 6px 12px; border-radius: 8px;
}
.pt-btn:hover { border-color: #cfd3da; }
.pt-btn.danger { color: #b32630; border-color: #f1d6d8; }
.pt-btn.danger:hover { background: #fdf1f2; }
</style>
