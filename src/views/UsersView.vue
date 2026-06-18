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
  NSelect,
  NPopconfirm,
  useMessage,
} from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import api from '../api/client'

interface Role {
  id: number
  code: string
  name: string
}

interface User {
  id: number
  email: string
  first_name: string
  last_name: string
  full_name: string
  status: string
  roles: Role[]
  created_at: string
}

const message = useMessage()
const users = ref<User[]>([])
const roles = ref<Role[]>([])
const loading = ref(false)
const showModal = ref(false)
const editingUser = ref<User | null>(null)

const form = ref({
  email: '',
  first_name: '',
  last_name: '',
  password: '',
  password_confirmation: '',
  role_ids: [] as number[],
})

const modalTitle = computed(() => (editingUser.value ? 'Edit User' : 'New User'))

const roleOptions = computed(() =>
  roles.value.map((r) => ({ label: r.name, value: r.id }))
)

const columns: DataTableColumns<User> = [
  { title: 'Name', key: 'full_name', sorter: 'default' },
  { title: 'Email', key: 'email', sorter: 'default' },
  {
    title: 'Roles',
    key: 'roles',
    render(row) {
      return h(NSpace, { size: 4 }, {
        default: () =>
          row.roles.map((r) =>
            h(NTag, { size: 'small', type: r.code === 'administrator' ? 'success' : 'default' }, { default: () => r.name })
          ),
      })
    },
  },
  {
    title: 'Status',
    key: 'status',
    width: 100,
    render(row) {
      return h(NTag, { type: row.status === 'active' ? 'success' : 'warning', size: 'small' }, { default: () => row.status })
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
            { onPositiveClick: () => deleteUser(row.id) },
            {
              trigger: () => h(NButton, { size: 'small', type: 'error' }, { default: () => 'Delete' }),
              default: () => `Delete ${row.full_name}?`,
            }
          ),
        ],
      })
    },
  },
]

function openNew() {
  editingUser.value = null
  form.value = { email: '', first_name: '', last_name: '', password: '', password_confirmation: '', role_ids: [] }
  showModal.value = true
}

function openEdit(user: User) {
  editingUser.value = user
  form.value = {
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    password: '',
    password_confirmation: '',
    role_ids: user.roles.map((r) => r.id),
  }
  showModal.value = true
}

async function saveUser() {
  try {
    if (editingUser.value) {
      await api.patch(`/users/${editingUser.value.id}`, form.value)
      message.success('User updated')
    } else {
      await api.post('/users', form.value)
      message.success('User created')
    }
    showModal.value = false
    await loadUsers()
  } catch (err: any) {
    const errors = err.response?.data?.errors
    message.error(Array.isArray(errors) ? errors.join(', ') : 'Failed to save user')
  }
}

async function deleteUser(id: number) {
  try {
    await api.delete(`/users/${id}`)
    message.success('User deleted')
    await loadUsers()
  } catch (err: any) {
    const errors = err.response?.data?.errors
    message.error(Array.isArray(errors) ? errors.join(', ') : 'Failed to delete user')
  }
}

async function loadUsers() {
  loading.value = true
  try {
    const { data } = await api.get('/users')
    users.value = data
  } catch {
    message.error('Failed to load users')
  } finally {
    loading.value = false
  }
}

async function loadRoles() {
  try {
    const { data } = await api.get('/roles')
    roles.value = data
  } catch {
    // ignore
  }
}

onMounted(async () => {
  await Promise.all([loadUsers(), loadRoles()])
})
</script>

<template>
  <div>
    <NSpace justify="space-between" align="center" style="margin-bottom: 16px">
      <NH2 style="margin: 0">Users</NH2>
      <NButton type="primary" @click="openNew">Add User</NButton>
    </NSpace>

    <NDataTable
      :columns="columns"
      :data="users"
      :loading="loading"
      :bordered="true"
      :single-line="false"
      :row-key="(row: User) => row.id"
    />

    <NModal v-model:show="showModal">
      <NCard :title="modalTitle" style="width: 500px" closable @close="showModal = false">
        <NForm @submit.prevent="saveUser">
          <NFormItem label="First Name">
            <NInput v-model:value="form.first_name" placeholder="John" />
          </NFormItem>
          <NFormItem label="Last Name">
            <NInput v-model:value="form.last_name" placeholder="Doe" />
          </NFormItem>
          <NFormItem label="Email">
            <NInput v-model:value="form.email" placeholder="john@example.com" />
          </NFormItem>
          <NFormItem :label="editingUser ? 'New Password (leave empty to keep)' : 'Password'">
            <NInput v-model:value="form.password" type="password" placeholder="Min. 8 characters" :input-props="{ autocomplete: 'new-password' }" />
          </NFormItem>
          <NFormItem label="Confirm Password">
            <NInput v-model:value="form.password_confirmation" type="password" placeholder="Repeat password" :input-props="{ autocomplete: 'new-password' }" />
          </NFormItem>
          <NFormItem label="Roles">
            <NSelect
              v-model:value="form.role_ids"
              :options="roleOptions"
              multiple
              placeholder="Select roles"
            />
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
