import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      
      setAuth: (token, user) => {
        set({ token, user, isAuthenticated: true })
      },
      
      clearAuth: () => {
        set({ token: null, user: null, isAuthenticated: false })
        localStorage.removeItem('auth-storage')
      },
      
      initializeAuth: () => {
        const stored = localStorage.getItem('auth-storage')
        if (stored) {
          try {
            const parsed = JSON.parse(stored)
            if (parsed.state?.token) {
              set({ 
                token: parsed.state.token, 
                user: parsed.state.user, 
                isAuthenticated: true 
              })
            }
          } catch (error) {
            console.error('Failed to parse stored auth:', error)
            get().clearAuth()
          }
        }
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token, user: state.user })
    }
  )
)
