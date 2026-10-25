/**
 * Theme context — provides light/dark/system mode toggle + named theme presets.
 *
 * Persists mode to localStorage under `synqlab-theme`.
 * Persists preset to localStorage under `synqlab-theme-preset`.
 *
 * Applies `.dark` class + `data-theme` attribute on `<html>` so Tailwind
 * dark: variants and CSS variable overrides in tokens.css / themes.css
 * activate automatically.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

export type Theme = 'light' | 'dark' | 'system'

/** Available theme presets — matches [data-theme] selectors in themes.css */
export const THEME_PRESETS = [
  { id: 'firooze', label: 'Firooze',  hue: '180 72% 38%',  desc: 'Persian turquoise' },
  { id: 'zinc',    label: 'Zinc',     hue: '240 5.9% 10%', desc: 'Clean, minimal' },
  { id: 'slate',   label: 'Slate',    hue: '215 16% 47%',  desc: 'Professional' },
  { id: 'rose',    label: 'Rose',     hue: '347 77% 50%',  desc: 'Warm, energetic' },
  { id: 'blue',    label: 'Blue',     hue: '221 83% 53%',  desc: 'Classic, trustworthy' },
  { id: 'green',   label: 'Green',    hue: '142 76% 36%',  desc: 'Fresh, natural' },
  { id: 'orange',  label: 'Orange',   hue: '25 95% 53%',   desc: 'Bold, creative' },
  { id: 'violet',  label: 'Violet',   hue: '262 83% 58%',  desc: 'Modern, premium' },
] as const

export type ThemePreset = (typeof THEME_PRESETS)[number]['id']

interface ThemeCtx {
  theme: Theme
  resolved: 'light' | 'dark'
  preset: ThemePreset
  setTheme: (t: Theme) => void
  setPreset: (p: ThemePreset) => void
}

const ThemeContext = createContext<ThemeCtx>({
  theme: 'light',
  resolved: 'light',
  preset: 'firooze',
  setTheme: () => {},
  setPreset: () => {},
})

const STORAGE_KEY = 'synqlab-theme'
const PRESET_KEY = 'synqlab-theme-preset'

function getSystemPreference(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolve(theme: Theme): 'light' | 'dark' {
  return theme === 'system' ? getSystemPreference() : theme
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system'
    return (localStorage.getItem(STORAGE_KEY) as Theme) ?? 'light'
  })

  const [preset, setPresetState] = useState<ThemePreset>(() => {
    if (typeof window === 'undefined') return 'firooze'
    return (localStorage.getItem(PRESET_KEY) as ThemePreset) ?? 'firooze'
  })

  const resolved = resolve(theme)

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    localStorage.setItem(STORAGE_KEY, t)
  }, [])

  const setPreset = useCallback((p: ThemePreset) => {
    setPresetState(p)
    localStorage.setItem(PRESET_KEY, p)
  }, [])

  // Apply .dark class on <html>
  useEffect(() => {
    const root = document.documentElement
    if (resolved === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [resolved])

  // Apply data-theme attribute on <html>
  // Firooze is the base palette in tokens.css — all others override via data-theme
  useEffect(() => {
    const root = document.documentElement
    if (preset === 'firooze') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', preset)
    }
  }, [preset])

  // Listen for OS preference changes when theme is 'system'
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => setThemeState('system') // re-render to pick up new resolved
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, resolved, preset, setTheme, setPreset }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
