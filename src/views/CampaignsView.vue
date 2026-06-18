<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
import { useRouter } from 'vue-router'
import { NH2, NDataTable, NButton, NTag, useMessage } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import api from '../api/client'
import type { Campaign } from '../types/campaign'

const STATUS_TAG: Record<string, 'success' | 'default' | 'error'> = {
  active: 'success',
  completed: 'default',
  cancelled: 'error',
}

const router = useRouter()
const message = useMessage()
const campaigns = ref<Campaign[]>([])
const loading = ref(false)

const columns: DataTableColumns<Campaign> = [
  { title: 'Name', key: 'name', sorter: 'default' },
  {
    title: 'Type',
    key: 'campaign_type',
    width: 180,
    render(row) {
      if (!row.campaign_type) return h('span', { style: 'color:#aaa' }, '—')
      return h('div', { style: 'display:flex;align-items:center;gap:8px' }, [
        h('span', {
          style: `display:inline-block;width:10px;height:10px;border-radius:2px;background:${row.campaign_type.color || '#cbd5e1'}`,
        }),
        h('span', null, row.campaign_type.name),
      ])
    },
  },
  {
    title: 'Current Stage',
    key: 'current_stage',
    width: 220,
    render: (row) =>
      row.current_stage
        ? h(NTag, { type: 'info', size: 'small' }, { default: () => `${row.current_stage!.position}. ${row.current_stage!.name}` })
        : h('span', { style: 'color:#aaa' }, '—'),
  },
  {
    title: 'Status',
    key: 'status',
    width: 110,
    render: (row) =>
      h(NTag, { type: STATUS_TAG[row.status] ?? 'default', size: 'small' }, {
        default: () => row.status.charAt(0).toUpperCase() + row.status.slice(1),
      }),
  },
  { title: 'Start', key: 'start_date', width: 110 },
  { title: 'End', key: 'end_date', width: 110 },
  {
    title: 'Actions',
    key: 'actions',
    width: 100,
    render: (row) =>
      h(NButton, { size: 'small', onClick: () => router.push({ name: 'CampaignDetail', params: { id: row.id } }) }, { default: () => 'Open' }),
  },
]

async function loadCampaigns() {
  loading.value = true
  try {
    const { data } = await api.get('/campaigns')
    campaigns.value = data
  } catch {
    message.error('Failed to load campaigns')
  } finally {
    loading.value = false
  }
}

onMounted(loadCampaigns)
</script>

<template>
  <div>
    <NH2 style="margin: 0 0 16px">Campaigns</NH2>
    <NDataTable
      :columns="columns"
      :data="campaigns"
      :loading="loading"
      :bordered="true"
      :single-line="false"
      :row-key="(row: Campaign) => row.id"
    />
  </div>
</template>
