<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { NH2, NCard, NInput, NInputNumber, NSelect, NSwitch, NText, NSpin, useMessage } from 'naive-ui'
import api from '../api/client'
import { loadParameters, parameters, type Parameter } from '../composables/parameters'

const message = useMessage()
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    await loadParameters(true)
  } finally {
    loading.value = false
  }
})

async function saveParam(param: Parameter, value: string) {
  try {
    await api.patch(`/parameters/${param.id}`, { value })
    param.value = value
    message.success(`${param.label} saved`)
  } catch {
    message.error('Failed to save parameter')
    await loadParameters(true)
  }
}

function selectOptions(param: Parameter) {
  return (param.options ?? []).map((o) => ({ label: o, value: o }))
}
</script>

<template>
  <div>
    <NH2>Parameters</NH2>
    <NText depth="3">Tenant-wide configuration used across the app.</NText>

    <NSpin :show="loading">
      <NCard style="margin-top: 16px; max-width: 720px">
        <div v-for="param in parameters" :key="param.id" class="param-row">
          <div class="param-info">
            <div class="param-label">{{ param.label }}</div>
            <div v-if="param.description" class="param-desc">{{ param.description }}</div>
          </div>
          <div class="param-control">
            <NSelect
              v-if="param.value_type === 'select'"
              :value="param.value"
              :options="selectOptions(param)"
              style="width: 160px"
              @update:value="(v: string) => saveParam(param, v)"
            />
            <NSwitch
              v-else-if="param.value_type === 'boolean'"
              :value="param.value === 'true'"
              @update:value="(v: boolean) => saveParam(param, v ? 'true' : 'false')"
            />
            <NInputNumber
              v-else-if="param.value_type === 'number'"
              :value="param.value == null || param.value === '' ? null : Number(param.value)"
              style="width: 160px"
              @update:value="(v: number | null) => saveParam(param, v == null ? '' : String(v))"
            />
            <NInput
              v-else
              :value="param.value ?? ''"
              style="width: 220px"
              @change="(v: string) => saveParam(param, v)"
            />
          </div>
        </div>
        <div v-if="!loading && !parameters.length" class="param-empty">No parameters defined.</div>
      </NCard>
    </NSpin>
  </div>
</template>

<style scoped>
.param-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 14px 4px;
  border-bottom: 1px solid #f0f0f4;
}
.param-row:last-child {
  border-bottom: none;
}
.param-label {
  font-weight: 600;
  color: #2b2b33;
}
.param-desc {
  font-size: 12px;
  color: #9aa0ab;
  margin-top: 2px;
}
.param-control {
  flex: 0 0 auto;
}
.param-empty {
  color: #bbb;
  font-style: italic;
  padding: 8px 4px;
}
</style>
