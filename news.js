import Parser from 'rss-parser'

const SUMMARY_MAX = 280

function pickImage(item) {
  const media = item['media:thumbnail'] ?? item['media:content']
  const first = Array.isArray(media) ? media[0] : media
  return first?.$?.url ?? (item.enclosure?.type?.startsWith('image/') ? item.enclosure.url : null)
}

function truncate(text) {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim()
  return clean.length > SUMMARY_MAX ? `${clean.slice(0, SUMMARY_MAX - 1).trimEnd()}…` : clean
}

export function normalizeItem(item, source) {
  const date = new Date(item.isoDate ?? item.pubDate ?? '')
  return {
    id: `${source.id}:${item.guid ?? item.link}`,
    title: (item.title ?? '').trim(),
    link: item.link,
    summary: source.summary === false ? '' : truncate(item.contentSnippet ?? item.summary),
    image: pickImage(item),
    publishedAt: Number.isNaN(date.getTime()) ? null : date.toISOString(),
    source: { id: source.id, name: source.name, category: source.category },
  }
}

export function createNewsService({
  sources,
  ttlMs = 5 * 60 * 1000,
  parser = new Parser({
    timeout: 10_000,
    headers: { 'User-Agent': 'news-app/1.0' },
    customFields: { item: [['media:thumbnail', 'media:thumbnail'], ['media:content', 'media:content']] },
  }),
  now = () => Date.now(),
}) {
  const cache = new Map()

  async function fetchSource(source, { force = false } = {}) {
    const hit = cache.get(source.id)
    if (!force && hit && now() - hit.fetchedAt < ttlMs) return hit
    try {
      const feed = await parser.parseURL(source.url)
      const entry = {
        fetchedAt: now(),
        items: feed.items.map((item) => normalizeItem(item, source)).filter((i) => i.title && i.link),
      }
      cache.set(source.id, entry)
      return entry
    } catch (err) {
      if (hit) return { ...hit, stale: true }
      throw new Error(`Failed to fetch ${source.name}: ${err.message}`)
    }
  }

  async function getNews({ sourceIds, query, limit = 50, force = false } = {}) {
    const selected = sourceIds?.length ? sources.filter((s) => sourceIds.includes(s.id)) : sources
    const results = await Promise.allSettled(selected.map((s) => fetchSource(s, { force })))

    const errors = []
    let items = []
    let updatedAt = 0
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        items.push(...r.value.items)
        updatedAt = Math.max(updatedAt, r.value.fetchedAt)
      } else {
        errors.push({ source: selected[i].id, message: r.reason.message })
      }
    })

    if (query) {
      const q = query.toLowerCase()
      items = items.filter((i) => i.title.toLowerCase().includes(q) || i.summary.toLowerCase().includes(q))
    }
    items.sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))

    return {
      items: items.slice(0, limit),
      total: items.length,
      updatedAt: updatedAt ? new Date(updatedAt).toISOString() : null,
      errors,
    }
  }

  return { getNews }
}
