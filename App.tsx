import { useEffect, useRef, useState } from 'react'
import { api, type Article, type NewsResponse, type Source } from './api'

const AUTO_REFRESH_MS = 5 * 60 * 1000

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(iso).toLocaleDateString()
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return debounced
}

function ArticleCard({ article }: { article: Article }) {
  return (
    <a className="card" href={article.link} target="_blank" rel="noreferrer">
      {article.image && <img src={article.image} alt="" loading="lazy" />}
      <div className="card-body">
        <div className="meta">
          <span className="badge">{article.source.name}</span>
          <span>{timeAgo(article.publishedAt)}</span>
        </div>
        <h2>{article.title}</h2>
        {article.summary && <p>{article.summary}</p>}
      </div>
    </a>
  )
}

export default function App() {
  const [sources, setSources] = useState<Source[]>([])
  const [source, setSource] = useState('')
  const [search, setSearch] = useState('')
  const query = useDebounced(search.trim(), 300)
  const key = `${source}|${query}`
  const [data, setData] = useState<NewsResponse | null>(null)
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const loading = refreshing || loadedKey !== key
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const forceRefresh = useRef(false)

  useEffect(() => {
    api.sources().then(setSources).catch(() => setSources([]))
  }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    const fetchNews = (refresh: boolean) =>
      api
        .news({ source, q: query, refresh }, ctrl.signal)
        .then((result) => {
          setData(result)
          setError(null)
        })
        .catch((e: Error) => {
          if (e.name !== 'AbortError') setError(e.message)
        })
        .finally(() => {
          if (!ctrl.signal.aborted) {
            setLoadedKey(key)
            setRefreshing(false)
          }
        })

    fetchNews(forceRefresh.current)
    forceRefresh.current = false
    const id = setInterval(() => fetchNews(false), AUTO_REFRESH_MS)
    return () => {
      ctrl.abort()
      clearInterval(id)
    }
  }, [source, query, key, refreshToken])

  const refresh = () => {
    forceRefresh.current = true
    setRefreshing(true)
    setRefreshToken((t) => t + 1)
  }

  const sourceName = (id: string) => sources.find((s) => s.id === id)?.name ?? id

  return (
    <div className="page">
      <header>
        <div className="title-row">
          <h1>News Updates</h1>
          <button onClick={refresh} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
        <p className="muted">
          {data?.updatedAt ? `Updated ${timeAgo(data.updatedAt)}` : 'Fetching latest headlines…'}
        </p>
        <div className="controls">
          <nav className="tabs" aria-label="Sources">
            <button className={source === '' ? 'active' : ''} onClick={() => setSource('')}>
              All
            </button>
            {sources.map((s) => (
              <button key={s.id} className={source === s.id ? 'active' : ''} onClick={() => setSource(s.id)}>
                {s.name}
              </button>
            ))}
          </nav>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search headlines…"
            aria-label="Search headlines"
          />
        </div>
      </header>

      {error && <p className="error">Could not load news: {error}</p>}
      {data && data.errors.length > 0 && (
        <p className="warning">Unavailable: {data.errors.map((e) => sourceName(e.source)).join(', ')}</p>
      )}

      {data && data.items.length === 0 && !loading && !error ? (
        <p className="muted empty">No articles found{query ? ` for "${query}"` : ''}.</p>
      ) : (
        <main className={`grid ${loading && data ? 'dimmed' : ''}`}>
          {data?.items.map((a) => <ArticleCard key={a.id} article={a} />)}
        </main>
      )}
    </div>
  )
}
