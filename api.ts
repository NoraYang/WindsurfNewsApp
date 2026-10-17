export interface Source {
  id: string
  name: string
  category: string
}

export interface Article {
  id: string
  title: string
  link: string
  summary: string
  image: string | null
  publishedAt: string | null
  source: Source
}

export interface NewsResponse {
  items: Article[]
  total: number
  updatedAt: string | null
  errors: { source: string; message: string }[]
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`/api${path}`, { signal })
  const body = await res.json().catch(() => null)
  if (!res.ok && !(body && 'items' in body)) {
    throw new Error(body?.error ?? `${res.status} ${res.statusText}`)
  }
  return body as T
}

export const api = {
  sources: () => get<Source[]>('/sources'),
  news: (params: { source?: string; q?: string; refresh?: boolean }, signal?: AbortSignal) => {
    const qs = new URLSearchParams({ limit: '60' })
    if (params.source) qs.set('source', params.source)
    if (params.q) qs.set('q', params.q)
    if (params.refresh) qs.set('refresh', 'true')
    return get<NewsResponse>(`/news?${qs}`, signal)
  },
}
