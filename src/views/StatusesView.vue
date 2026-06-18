<script setup lang="ts">
import { h, onMounted, ref } from 'vue'
import {
  NH2,
  NText,
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
  NSelect,
  NColorPicker,
  NDataTable,
  NPopconfirm,
  useMessage,
} from 'naive-ui'
import type { DataTableColumns, SelectOption } from 'naive-ui'
import api from '../api/client'

interface StatusRow {
  id: number
  name: string
  color: string
  sort_order: number
  active: boolean
  role_ids: number[]
  roles: { id: number; name: string }[]
}

const message = useMessage()
const statuses = ref<StatusRow[]>([])
const roleOptions = ref<SelectOption[]>([])
const loading = ref(false)
const showModal = ref(false)
const editingId = ref<number | null>(null)
const form = ref({ name: '', color: '#9aa1ad', sort_order: 0, active: true, role_ids: [] as number[] })

async function load() {
  loading.value = true
  try {
    const [s, r] = await Promise.all([api.get('/statuses'), api.get('/roles')])
    statuses.value = s.data
    roleOptions.value = r.data.map((role: { id: number; name: string }) => ({ label: role.name, value: role.id }))
  } catch {
    message.error('Failed to load statuses')
  } finally {
    loading.value = false
  }
}

function openNew() {
  editingId.value = null
  form.value = { name: '', color: '#9aa1ad', sort_order: (statuses.value.length + 1), active: true, role_ids: [] }
  showModal.value = true
}
function openEdit(row: StatusRow) {
  editingId.value = row.id
  form.value = { name: row.name, color: row.color, sort_order: row.sort_order, active: row.active, role_ids: [...row.role_ids] }
  showModal.value = true
}
async function save() {
  try {
    if (editingId.value) {
      await api.patch(`/statuses/${editingId.value}`, form.value)
    } else {
      await api.post('/statuses', form.value)
    }
    message.success('Status saved')
    showModal.value = false
    await load()
  } catch (err: any) {
    const errors = err.response?.data?.errors
    message.error(Array.isArray(errors) ? errors.join(', ') : 'Failed to save status')
  }
}
async function remove(row: StatusRow) {
  try {
    await api.delete(`/statuses/${row.id}`)
    message.success('Status removed')
    await load()
  } catch {
    message.error('Failed to remove status')
  }
}

const columns: DataTableColumns<StatusRow> = [
  {
    title: 'Status',
    key: 'name',
    render: (row) =>
      h('span', { style: 'display:inline-flex;align-items:center;gap:8px' }, [
        h('span', { style: `width:12px;height:12px;border-radius:3px;background:${row.color};display:inline-block` }),
        h('span', { style: 'font-weight:600' }, row.name),
      ]),
  },
  {
    title: 'Who can set',
    key: 'roles',
    render: (row) =>
      row.roles.length
        ? h(NSpace, { size: 4 }, () => row.roles.map((r) => h(NTag, { size: 'small' }, () => r.name)))
        : h(NText, { depth: 3 }, () => 'Anyone'),
  },
  {
    title: 'Active',
    key: 'active',
    width: 90,
    render: (row) => h(NTag, { size: 'small', type: row.active ? 'success' : 'default' }, () => (row.active ? 'Active' : 'Off')),
  },
  {
    title: '',
    key: 'actions',
    width: 140,
    render: (row) =>
      h(NSpace, { size: 'small', justify: 'end' }, () => [
        h(NButton, { size: 'small', tertiary: true, onClick: () => openEdit(row) }, () => 'Edit'),
        h(
          NPopconfirm,
          { onPositiveClick: () => remove(row) },
          { trigger: () => h(NButton, { size: 'small', tertiary: true, type: 'error' }, () => 'Delete'), default: () => 'Remove this status?' }
        ),
      ]),
  },
]

onMounted(load)
</script>

<template>
  <div>
    <NSpace justify="space-between" align="center" style="margin-bottom: 12px">
      <div>
        <NH2 style="margin: 0">Statuses</NH2>
        <NText depth="3">Status dictionary. Restrict who can set each status by role (empty = anyone).</NText>
      </div>
      <NButton type="primary" @click="openNew">+ Status</NButton>
    </NSpace>

    <NDataTable :columns="columns" :data="statuses" :loading="loading" :row-key="(r) => r.id" />

    <NModal v-model:show="showModal">
      <NCard :title="editingId ? 'Edit status' : 'New status'" style="width: 460px" closable @close="showModal = false">
        <NForm @submit.prevent="save">
          <NFormItem label="Name">
            <NInput v-model:value="form.name" placeholder="e.g. Approved" />
          </NFormItem>
          <NFormItem label="Color">
            <NColorPicker v-model:value="form.color" :show-alpha="false" :modes="['hex']" />
          </NFormItem>
          <NFormItem label="Who can set (roles)">
            <NSelect v-model:value="form.role_ids" :options="roleOptions" multiple filterable placeholder="Anyone (leave empty)" />
          </NFormItem>
          <NSpace>
            <NFormItem label="Sort order">
              <NInputNumber v-model:value="form.sort_order" :min="0" style="width: 120px" />
            </NFormItem>
            <NFormItem label="Active">
              <NSwitch v-model:value="form.active" />
            </NFormItem>
          </NSpace>
          <NSpace justify="end">
            <NButton @click="showModal = false">Cancel</NButton>
            <NButton type="primary" attr-type="submit">Save</NButton>
          </NSpace>
        </NForm>
      </NCard>
    </NModal>
  </div>
</template>
