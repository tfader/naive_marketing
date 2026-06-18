<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { NH2, NText, NCard, NSwitch, NSpin, useMessage } from 'naive-ui'
import api from '../api/client'
import { loadStatusable } from '../composables/statusable'

interface StatusableAttr {
  name: string
  label: string
  enabled: boolean
}
interface StatusableModel {
  model: string
  label: string
  whole_enabled: boolean
  attributes: StatusableAttr[]
}

const message = useMessage()
const loading = ref(false)
const models = ref<StatusableModel[]>([])

async function load() {
  loading.value = true
  try {
    const { data } = await api.get('/statusable_settings')
    models.value = data
  } catch {
    message.error('Failed to load statusable settings')
  } finally {
    loading.value = false
  }
}

async function toggle(model: StatusableModel, attribute: StatusableAttr | null, enabled: boolean) {
  try {
    await api.post('/statusable_settings/toggle', {
      ref_model: model.model,
      ref_attribute: attribute?.name ?? null,
      enabled,
    })
    if (attribute) attribute.enabled = enabled
    else model.whole_enabled = enabled
    await loadStatusable(true)
  } catch {
    message.error('Failed to update')
    await load()
  }
}

onMounted(load)
</script>

<template>
  <div>
    <NH2>Statusable</NH2>
    <NText depth="3">Choose which objects (as a whole) or which attributes can carry a status. Scope: Campaign and its dependents.</NText>

    <NSpin :show="loading">
      <div class="sa-grid">
        <NCard v-for="model in models" :key="model.model" :title="model.label" size="small" class="sa-card">
          <template #header-extra>
            <div class="sa-whole">
              <span class="sa-whole-lbl">Whole object</span>
              <NSwitch :value="model.whole_enabled" @update:value="(v: boolean) => toggle(model, null, v)" />
            </div>
          </template>

          <div class="sa-attrs">
            <div v-for="attr in model.attributes" :key="attr.name" class="sa-attr">
              <div class="sa-attr-info">
                <span class="sa-attr-label">{{ attr.label }}</span>
                <span class="sa-attr-name">{{ attr.name }}</span>
              </div>
              <NSwitch size="small" :value="attr.enabled" @update:value="(v: boolean) => toggle(model, attr, v)" />
            </div>
            <div v-if="!model.attributes.length" class="sa-empty">No statusable attributes.</div>
          </div>
        </NCard>
      </div>
    </NSpin>
  </div>
</template>

<style scoped>
.sa-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 16px;
  margin-top: 16px;
}
.sa-whole {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sa-whole-lbl {
  font-size: 12px;
  color: #888;
}
.sa-attrs {
  display: flex;
  flex-direction: column;
}
.sa-attr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 9px 2px;
  border-bottom: 1px solid #f3f3f6;
}
.sa-attr:last-child {
  border-bottom: none;
}
.sa-attr-info {
  display: flex;
  flex-direction: column;
}
.sa-attr-label {
  font-weight: 600;
  color: #2b2b33;
}
.sa-attr-name {
  font-size: 11px;
  color: #aab;
  font-family: ui-monospace, monospace;
}
.sa-empty {
  color: #bbb;
  font-style: italic;
  padding: 8px 0;
}
</style>
