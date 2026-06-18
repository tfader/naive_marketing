<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { NCard, NForm, NFormItem, NInput, NButton, NSpace, useMessage } from 'naive-ui'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const message = useMessage()

const email = ref('admin@demo.com')
const password = ref('password123')
const loading = ref(false)

async function handleLogin() {
  if (!email.value || !password.value) {
    message.warning('Please fill in all fields')
    return
  }

  loading.value = true
  try {
    await auth.login(email.value, password.value)
    message.success('Welcome back!')
    router.push({ name: 'Dashboard' })
  } catch (err: any) {
    message.error(err.response?.data?.error || 'Login failed')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-container">
    <NCard title="Naive Marketing" class="login-card">
      <template #header-extra>
        <span class="login-subtitle">Sign in to your account</span>
      </template>
      <NForm @submit.prevent="handleLogin">
        <NFormItem label="Email">
          <NInput v-model:value="email" placeholder="admin@demo.com" type="text" />
        </NFormItem>
        <NFormItem label="Password">
          <NInput
            v-model:value="password"
            placeholder="Password"
            type="password"
            show-password-on="click"
          />
        </NFormItem>
        <NSpace justify="end">
          <NButton type="primary" :loading="loading" attr-type="submit">
            Sign In
          </NButton>
        </NSpace>
      </NForm>
    </NCard>
  </div>
</template>

<style scoped>
.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #f5f5f5;
}

.login-card {
  width: 400px;
}

.login-subtitle {
  font-size: 14px;
  color: #999;
  font-weight: normal;
}
</style>
