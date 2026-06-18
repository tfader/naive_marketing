<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NTag, NCollapse, NCollapseItem, useMessage } from 'naive-ui'
import api from '../api/client'

interface StageRole {
  role_id: number
  role_name: string
  role_code: string
  capabilities: string[]
}

interface Stage {
  id: number
  name: string
  code: string
  position: number
  stage_type: string
  description: string
  is_gate: boolean
  roles: StageRole[]
}

interface ProcessTemplate {
  id: number
  name: string
  description: string
  stages: Stage[]
}

const message = useMessage()
const template = ref<ProcessTemplate | null>(null)
const loading = ref(false)

function stageTypeLabel(type: string) {
  const map: Record<string, string> = {
    in_system: 'In System',
    external: 'External',
    monitoring: 'Monitoring',
  }
  return map[type] || type
}

function stageTypeColor(type: string): 'success' | 'warning' | 'info' {
  const map: Record<string, 'success' | 'warning' | 'info'> = {
    in_system: 'success',
    external: 'warning',
    monitoring: 'info',
  }
  return map[type] || 'info'
}

function capabilityColor(cap: string): 'success' | 'warning' | 'error' | 'info' | 'default' {
  if (cap.includes('approve')) return 'error'
  if (cap.includes('edit') || cap.includes('propose') || cap.includes('correct')) return 'warning'
  if (cap.includes('view')) return 'success'
  return 'default'
}

async function loadProcess() {
  loading.value = true
  try {
    const { data: templates } = await api.get('/process_templates')
    if (templates.length > 0) {
      const { data } = await api.get(`/process_templates/${templates[0].id}`)
      template.value = data
    }
  } catch (err: any) {
    message.error('Failed to load process template')
  } finally {
    loading.value = false
  }
}

onMounted(loadProcess)
</script>

<template>
  <div class="cockpit-proc">
    <div class="p-head">
      <h1 class="p-title">Process</h1>
      <span v-if="template" class="p-name">{{ template.name }}</span>
    </div>

    <template v-if="template">
      <div v-if="template.description" class="p-desc">{{ template.description }}</div>

      <div class="p-stages">
        <div v-for="stage in template.stages" :key="stage.id" class="p-stage">
          <div class="p-rail">
            <span class="p-num" :class="{ gate: stage.is_gate }">{{ stage.position }}</span>
          </div>
          <div class="p-card">
            <div class="p-stage-head">
              <span class="p-stage-name">{{ stage.name }}</span>
              <NTag :type="stageTypeColor(stage.stage_type)" size="small" :bordered="false">{{ stageTypeLabel(stage.stage_type) }}</NTag>
              <NTag v-if="stage.is_gate" type="error" size="small" :bordered="false">GATE</NTag>
            </div>
            <p v-if="stage.description" class="p-stage-desc">{{ stage.description }}</p>

            <NCollapse v-if="stage.roles.length" class="p-roles">
              <NCollapseItem :title="`Roles & capabilities (${stage.roles.length})`" :name="stage.code">
                <div v-for="sr in stage.roles" :key="sr.role_id" class="p-role">
                  <span class="p-role-name">{{ sr.role_name }}</span>
                  <span class="p-caps">
                    <NTag
                      v-for="cap in sr.capabilities"
                      :key="cap"
                      :type="capabilityColor(cap)"
                      size="small"
                      round
                      :bordered="false"
                    >{{ cap.replace(/_/g, ' ') }}</NTag>
                  </span>
                </div>
              </NCollapseItem>
            </NCollapse>
          </div>
        </div>
      </div>
    </template>

    <div v-else-if="!loading" class="p-empty">No process template found.</div>
  </div>
</template>

<style scoped>
.cockpit-proc {
  margin: -24px;
  padding: 24px;
  background: #eceef2;
  min-height: calc(100vh - 48px);
  box-sizing: border-box;
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  color: #1a1d23;
}
.p-head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 16px; }
.p-title { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
.p-name { font-size: 13.5px; color: #6b7280; }
.p-desc {
  background: #fff; border: 1px solid #e7e9ee; border-radius: 12px;
  padding: 16px 18px; margin-bottom: 18px; font-size: 13.5px; color: #6b7280; line-height: 1.55;
}

.p-stages { display: flex; flex-direction: column; }
.p-stage { display: flex; gap: 16px; }
.p-rail { position: relative; flex: 0 0 auto; width: 30px; display: flex; justify-content: center; }
.p-stage:not(:last-child) .p-rail::after {
  content: ''; position: absolute; top: 32px; bottom: -10px; left: 50%;
  width: 2px; background: #e1e4ea; transform: translateX(-50%);
}
.p-num {
  position: relative; z-index: 1;
  width: 30px; height: 30px; border-radius: 50%;
  background: #5b50d6; color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 13px; font-weight: 600;
}
.p-num.gate { background: #d83a45; }
.p-card {
  flex: 1 1 auto; min-width: 0;
  background: #fff; border: 1px solid #e7e9ee; border-radius: 12px;
  padding: 15px 18px; margin-bottom: 12px;
}
.p-stage-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.p-stage-name { font-size: 15px; font-weight: 700; letter-spacing: -0.01em; }
.p-stage-desc { margin: 8px 0 0; font-size: 13px; color: #6b7280; line-height: 1.5; }
.p-roles { margin-top: 10px; }
.p-role {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  padding: 8px 0; border-bottom: 1px solid #f4f5f7;
}
.p-role:last-child { border-bottom: none; }
.p-role-name {
  flex: 0 0 auto; font-size: 12.5px; font-weight: 600; color: #1a1d23;
  background: #f0f1f4; padding: 3px 10px; border-radius: 6px;
}
.p-caps { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.p-empty {
  background: #fff; border: 1px dashed #d7dae1; border-radius: 12px;
  padding: 40px; text-align: center; color: #9aa0ab;
}
</style>
