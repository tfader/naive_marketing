<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NH2, NDataTable, NTag, useMessage } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import api from '../api/client'

interface Permission {
  id: number
  code: string
  name: string
  group_name: string
}

interface Role {
  id: number
  name: string
  code: string
  description: string
  system_role: boolean
  permissions: Permission[]
  users_count: number
}

const message = useMessage()
const roles = ref<Role[]>([])
const loading = ref(false)

const columns: DataTableColumns<Role> = [
  { title: 'Name', key: 'name', width: 180, sorter: 'default' },
  { title: 'Code', key: 'code', width: 140 },
  {
    title: 'Type',
    key: 'system_role',
    width: 100,
    render(row) {
      return h(NTag, { type: row.system_role ? 'info' : 'default', size: 'small' }, {
        default: () => row.system_role ? 'System' : 'Custom',
      })
    },
  },
  { title: 'Description', key: 'description', ellipsis: { tooltip: true } },
  {
    title: 'Permissions',
    key: 'permissions',
    width: 120,
    render(row) {
      return `${row.permissions.length}`
    },
  },
  {
    title: 'Users',
    key: 'users_count',
    width: 80,
  },
]

async function loadRoles() {
  loading.value = true
  try {
    const { data } = await api.get('/roles')
    roles.value = data
  } catch (err: any) {
    message.error('Failed to load roles')
  } finally {
    loading.value = false
  }
}

onMounted(loadRoles)

// For render function
import { h } from 'vue'
</script>

<template>
  <div>
    <NH2>Roles</NH2>
    <NDataTable
      :columns="columns"
      :data="roles"
      :loading="loading"
      :bordered="true"
      :single-line="false"
      :row-key="(row: Role) => row.id"
    />
  </div>
</template>
