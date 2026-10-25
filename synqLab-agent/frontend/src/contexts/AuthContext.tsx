import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { apiFetch, ApiError, setApiAuthToken } from '@/lib/api'

const TOKEN_KEY = 'synqlab_token'

export interface AuthUser {
  id: string
  email: string
  full_name: string
  avatar_url: string | null
  professional_title?: string | null
  short_bio?: string | null
  linkedin_url?: string | null
  scholar_url?: string | null
  skills?: string | null
  is_admin?: boolean
}

interface AuthResponse {
  access_token: string
  token_type: 'bearer'
  user: AuthUser
}

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, fullName: string) => Promise<void>
  updateProfile: (payload: {
    full_name?: string
    email?: string
    current_password?: string
    new_password?: string
    avatar_url?: string | null
    professional_title?: string | null
    short_bio?: string | null
    linkedin_url?: string | null
    scholar_url?: string | null
    skills?: string | null
  }) => Promise<void>
  uploadAvatar: (file: File) => Promise<void>
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') {
      return null
    }
    return localStorage.getItem(TOKEN_KEY)
  })
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setApiAuthToken(token)
  }, [token])

  useEffect(() => {
    let cancelled = false

    async function validateSession(): Promise<void> {
      if (!token) {
        if (!cancelled) {
          setUser(null)
          setIsLoading(false)
        }
        return
      }

      try {
        const response = await apiFetch('/auth/me')
        const payload = (await response.json()) as AuthUser
        if (!cancelled) {
          setUser(payload)
        }
      } catch {
        if (!cancelled) {
          localStorage.removeItem(TOKEN_KEY)
          setToken(null)
          setUser(null)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    setIsLoading(true)
    validateSession()

    return () => {
      cancelled = true
    }
  }, [token])

  const applyAuthPayload = useCallback((payload: AuthResponse) => {
    localStorage.setItem(TOKEN_KEY, payload.access_token)
    setApiAuthToken(payload.access_token)   // sync — so child routes can fetch immediately
    setToken(payload.access_token)
    setUser(payload.user)
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const response = await apiFetch('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        })
        const payload = (await response.json()) as AuthResponse
        applyAuthPayload(payload)
      } catch (error) {
        if (error instanceof ApiError) {
          throw new Error(error.message)
        }
        throw error
      }
    },
    [applyAuthPayload],
  )

  const signup = useCallback(
    async (email: string, password: string, fullName: string) => {
      try {
        const response = await apiFetch('/auth/signup', {
          method: 'POST',
          body: JSON.stringify({ email, password, full_name: fullName }),
        })
        const payload = (await response.json()) as AuthResponse
        applyAuthPayload(payload)
      } catch (error) {
        if (error instanceof ApiError) {
          throw new Error(error.message)
        }
        throw error
      }
    },
    [applyAuthPayload],
  )

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setApiAuthToken(null)                   // sync — clear immediately
    setToken(null)
    setUser(null)
  }, [])

  const updateProfile = useCallback(
    async (payload: {
      full_name?: string
      email?: string
      current_password?: string
      new_password?: string
      avatar_url?: string | null
      professional_title?: string | null
      short_bio?: string | null
      linkedin_url?: string | null
      scholar_url?: string | null
      skills?: string | null
    }) => {
      const response = await apiFetch('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      const nextUser = (await response.json()) as AuthUser
      setUser(nextUser)
    },
    [],
  )

  const uploadAvatar = useCallback(async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await apiFetch('/auth/me/avatar-upload', {
      method: 'POST',
      body: formData,
    })
    const nextUser = (await response.json()) as AuthUser
    setUser(nextUser)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      login,
      signup,
      updateProfile,
      uploadAvatar,
      logout,
      isLoading,
    }),
    [user, token, login, signup, updateProfile, uploadAvatar, logout, isLoading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.')
  }
  return context
}
