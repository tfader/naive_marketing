import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../api/client'

interface User {
  id: number
  email: string
  first_name: string
  last_name: string
  full_name: string
  status: string
  roles: { id: number; code: string; name: string }[]
  permissions: string[]
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem('token'))

  const isAuthenticated = computed(() => !!token.value && !!user.value)

  async function login(email: string, password: string) {
    const { data } = await api.post('/auth/login', { email, password })
    token.value = data.token
    localStorage.setItem('token', data.token)
    await fetchUser()
  }

  async function fetchUser() {
    try {
      const { data } = await api.get('/me')
      user.value = data
    } catch {
      logout()
    }
  }

  function logout() {
    user.value = null
    token.value = null
    localStorage.removeItem('token')
  }

  function hasPermission(code: string): boolean {
    return user.value?.permissions?.includes(code) ?? false
  }

  function hasRole(code: string): boolean {
    return user.value?.roles?.some((r) => r.code === code) ?? false
  }

  return { user, token, isAuthenticated, login, fetchUser, logout, hasPermission, hasRole }
})
