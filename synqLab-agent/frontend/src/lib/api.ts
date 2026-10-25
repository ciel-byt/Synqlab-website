const TOKEN_KEY = 'synqlab_token'
const ORG_ID_KEY = 'synqlab_org_id'

let authToken: string | null = typeof window !== 'undefined'
  ? localStorage.getItem(TOKEN_KEY)
  : null
let activeOrgId: string | null = typeof window !== 'undefined' 
  ? localStorage.getItem(ORG_ID_KEY) 
  : null

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `HTTP ${status}`)
    this.status = status
    this.body = body
  }
}

export function setApiAuthToken(token: string | null): void {
  authToken = token
}

export function getApiAuthToken(): string | null {
  return authToken
}

export function setApiOrgId(orgId: string | null): void {
  activeOrgId = orgId
  if (typeof window !== 'undefined') {
    if (orgId) {
      localStorage.setItem(ORG_ID_KEY, orgId)
    } else {
      localStorage.removeItem(ORG_ID_KEY)
    }
  }
}

function extractErrorMessage(body: unknown, status: number): string | undefined {
  if (typeof body === 'string') {
    const trimmed = body.trim()
    return trimmed || undefined
  }

  if (typeof body !== 'object' || body === null) {
    return undefined
  }

  if ('detail' in body) {
    const detail = (body as { detail?: unknown }).detail
    if (typeof detail === 'string' && detail.trim()) {
      return detail.trim()
    }
    if (Array.isArray(detail)) {
      const messages = detail
        .map((entry) => {
          if (typeof entry !== 'object' || entry === null) return null
          const msg = typeof (entry as { msg?: unknown }).msg === 'string' ? (entry as { msg: string }).msg : null
          if (!msg) return null
          const locRaw = (entry as { loc?: unknown }).loc
          const loc = Array.isArray(locRaw)
            ? locRaw
                .filter((part) => typeof part === 'string' && part !== 'body')
                .join('.')
            : ''
          return loc ? `${loc}: ${msg}` : msg
        })
        .filter((item): item is string => Boolean(item))
      if (messages.length > 0) {
        return messages.join('; ')
      }
    }
  }

  if (typeof (body as { message?: unknown }).message === 'string') {
    const message = (body as { message: string }).message.trim()
    if (message) return message
  }

  return `HTTP ${status}`
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers ?? {})
  if (!headers.has('Content-Type') && options.body != null && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`)
  }
  if (activeOrgId) {
    headers.set('X-Org-Id', activeOrgId)
  }

  const response = await fetch(path, { ...options, headers })
  if (response.ok) {
    return response
  }

  let body: unknown = null
  try {
    body = await response.clone().json()
  } catch {
    try {
      body = await response.text()
    } catch {
      body = null
    }
  }
  throw new ApiError(response.status, body, extractErrorMessage(body, response.status))
}
