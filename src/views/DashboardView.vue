<script setup lang="ts">
import { NCard, NGrid, NGridItem, NStatistic, NH2, NText } from 'naive-ui'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
</script>

<template>
  <div>
    <NH2>Dashboard</NH2>
    <NText depth="3" style="margin-bottom: 24px; display: block">
      Welcome back, {{ auth.user?.first_name }}!
    </NText>

    <NGrid :x-gap="16" :y-gap="16" :cols="4">
      <NGridItem>
        <NCard>
          <NStatistic label="Your Roles" :value="auth.user?.roles?.length || 0" />
        </NCard>
      </NGridItem>
      <NGridItem>
        <NCard>
          <NStatistic label="Your Permissions" :value="auth.user?.permissions?.length || 0" />
        </NCard>
      </NGridItem>
      <NGridItem>
        <NCard>
          <NStatistic label="Tenant" value="demo" />
        </NCard>
      </NGridItem>
      <NGridItem>
        <NCard>
          <NStatistic label="Status" :value="auth.user?.status || '-'" />
        </NCard>
      </NGridItem>
    </NGrid>
  </div>
</template>
