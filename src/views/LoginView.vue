<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { NForm, NFormItem, NInput, NButton, useMessage } from 'naive-ui'
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
  <div class="login-bg">
    <div class="login-card">
      <div class="login-brand">
        <span class="login-mark">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
            <path d="M3.6 11.3 11.3 3.6a2 2 0 0 1 1.4-.6H19a2 2 0 0 1 2 2v6.3a2 2 0 0 1-.6 1.4l-7.7 7.7a2 2 0 0 1-2.8 0l-6.3-6.3a2 2 0 0 1 0-2.8Z" fill="#5b50d6" />
            <circle cx="16.2" cy="7.8" r="1.7" fill="#fff" />
          </svg>
        </span>
        <span class="login-word">Naive Marketing</span>
      </div>

      <h1 class="login-title">Sign in</h1>
      <p class="login-sub">Welcome back — sign in to your account.</p>

      <NForm @submit.prevent="handleLogin">
        <NFormItem label="Email">
          <NInput v-model:value="email" placeholder="admin@demo.com" type="text" />
        </NFormItem>
        <NFormItem label="Password">
          <NInput v-model:value="password" placeholder="Password" type="password" show-password-on="click" />
        </NFormItem>
        <NButton type="primary" block :loading="loading" attr-type="submit" class="login-btn">
          Sign in
        </NButton>
      </NForm>

      <p class="login-demo">Demo · <b>admin@demo.com</b> / <b>password123</b></p>
    </div>
  </div>
</template>

<style scoped>
.login-bg {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 24px;
  background: #eceef2;
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  color: #1a1d23;
}
.login-card {
  width: 400px;
  max-width: 100%;
  background: #fff;
  border: 1px solid #e7e9ee;
  border-top: 3px solid #5b50d6;
  border-radius: 16px;
  padding: 32px 30px;
  box-shadow: 0 18px 50px rgba(26, 29, 35, 0.08);
}
.login-brand {
  display: flex;
  align-items: center;
  gap: 11px;
  margin-bottom: 26px;
}
.login-mark {
  width: 38px;
  height: 38px;
  border-radius: 11px;
  background: #f0eefc;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}
.login-word {
  font-weight: 700;
  font-size: 17px;
  letter-spacing: -0.01em;
}
.login-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.login-sub {
  margin: 5px 0 22px;
  font-size: 13.5px;
  color: #6b7280;
}
.login-btn {
  width: 100%;
  margin-top: 6px;
}
.login-demo {
  margin: 20px 0 0;
  padding-top: 16px;
  border-top: 1px solid #f0f1f4;
  font-size: 12px;
  color: #9aa0ab;
  text-align: center;
}
.login-demo b {
  color: #6b7280;
  font-weight: 600;
}
</style>
