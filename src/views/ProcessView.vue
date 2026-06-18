<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  NH2,
  NCard,
  NTimeline,
  NTimelineItem,
  NTag,
  NSpace,
  NCollapse,
  NCollapseItem,
  NText,
  useMessage,
} from 'naive-ui'
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
  <div>
    <NH2>Process Template</NH2>

    <template v-if="template">
      <NCard :title="template.name" style="margin-bottom: 24px">
        <NText depth="3">{{ template.description }}</NText>
      </NCard>

      <NTimeline>
        <NTimelineItem
          v-for="stage in template.stages"
          :key="stage.id"
          :title="`${stage.position}. ${stage.name}`"
          :type="stage.is_gate ? 'error' : stageTypeColor(stage.stage_type)"
        >
          <NSpace vertical :size="12">
            <NSpace>
              <NTag :type="stageTypeColor(stage.stage_type)" size="small">
                {{ stageTypeLabel(stage.stage_type) }}
              </NTag>
              <NTag v-if="stage.is_gate" type="error" size="small">GATE</NTag>
            </NSpace>

            <NText depth="3">{{ stage.description }}</NText>

            <NCollapse>
              <NCollapseItem title="Roles & Capabilities" :name="stage.code">
                <div v-for="sr in stage.roles" :key="sr.role_id" class="stage-role-row">
                  <NSpace align="center" :wrap="true">
                    <NTag size="small" strong>{{ sr.role_name }}</NTag>
                    <NTag
                      v-for="cap in sr.capabilities"
                      :key="cap"
                      :type="capabilityColor(cap)"
                      size="small"
                      round
                    >
                      {{ cap.replace(/_/g, ' ') }}
                    </NTag>
                  </NSpace>
                </div>
              </NCollapseItem>
            </NCollapse>
          </NSpace>
        </NTimelineItem>
      </NTimeline>
    </template>

    <NCard v-else-if="!loading">
      <NText>No process template found.</NText>
    </NCard>
  </div>
</template>

<style scoped>
.stage-role-row {
  margin-bottom: 10px;
}
</style>

