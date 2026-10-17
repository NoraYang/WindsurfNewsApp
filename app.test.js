import assert from 'node:assert/strict'
import { test } from 'node:test'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { createNewsService, normalizeItem } from '../src/news.js'

const sources = [
  { id: 'a', name: 'Source A', category: 'World', url: 'https://a.example/rss' },
  { id: 'b', name: 'Source B', category: 'Tech', url: 'https://b.example/rss', summary: false },
]

const feeds = {
  'https://a.example/rss': {
    items: [
      { title: 'Older world story', link: 'https://a.example/1', guid: '1', isoDate: '2026-01-01T00:00:00Z', contentSnippet: 'Elections update' },
      { title: 'Newer world story', link: 'https://a.example/2', guid: '2', isoDate: '2026-01-03T00:00:00Z', contentSnippet: 'Weather' },
    ],
  },
  'https://b.example/rss': {
    items: [{ title: 'Tech story', link: 'https://b.example/1', guid: '1', isoDate: '2026-01-02T00:00:00Z', contentSnippet: 'noise' }],
  },
}

function fakeParser({ failing = [] } = {}) {
  const calls = []
  return {
    calls,
    parseURL: async (url) => {
      calls.push(url)
      if (failing.includes(url)) throw new Error('boom')
      return feeds[url]
    },
  }
}

function makeApp(parser, opts = {}) {
  return createApp({ sources, newsService: createNewsService({ sources, parser, ...opts }), corsOrigins: '*' })
}

test('GET /api/sources lists sources', async () => {
  const res = await request(makeApp(fakeParser())).get('/api/sources')
  assert.equal(res.status, 200)
  assert.deepEqual(res.body.map((s) => s.id), ['a', 'b'])
  assert.equal(res.body[0].url, undefined)
})

test('GET /api/news merges all sources newest first', async () => {
  const res = await request(makeApp(fakeParser())).get('/api/news')
  assert.equal(res.status, 200)
  assert.deepEqual(res.body.items.map((i) => i.title), ['Newer world story', 'Tech story', 'Older world story'])
  assert.equal(res.body.items[1].summary, '')
  assert.deepEqual(res.body.errors, [])
})

test('GET /api/news filters by source, query and limit', async () => {
  const app = makeApp(fakeParser())
  const bySource = await request(app).get('/api/news?source=b')
  assert.deepEqual(bySource.body.items.map((i) => i.source.id), ['b'])

  const byQuery = await request(app).get('/api/news?q=election')
  assert.deepEqual(byQuery.body.items.map((i) => i.title), ['Older world story'])

  const limited = await request(app).get('/api/news?limit=1')
  assert.equal(limited.body.items.length, 1)
  assert.equal(limited.body.total, 3)
})

test('GET /api/news rejects unknown sources', async () => {
  const res = await request(makeApp(fakeParser())).get('/api/news?source=zzz')
  assert.equal(res.status, 400)
})

test('partial failures are reported, total failure returns 502', async () => {
  const partial = await request(makeApp(fakeParser({ failing: ['https://b.example/rss'] }))).get('/api/news')
  assert.equal(partial.status, 200)
  assert.equal(partial.body.items.length, 2)
  assert.equal(partial.body.errors[0].source, 'b')

  const total = await request(makeApp(fakeParser({ failing: Object.keys(feeds) }))).get('/api/news')
  assert.equal(total.status, 502)
})

test('feeds are cached until TTL expires or refresh is forced', async () => {
  let time = 0
  const parser = fakeParser()
  const app = makeApp(parser, { ttlMs: 1000, now: () => time })

  await request(app).get('/api/news?source=a')
  await request(app).get('/api/news?source=a')
  assert.equal(parser.calls.length, 1)

  await request(app).get('/api/news?source=a&refresh=true')
  assert.equal(parser.calls.length, 2)

  time = 2000
  await request(app).get('/api/news?source=a')
  assert.equal(parser.calls.length, 3)
})

test('normalizeItem extracts media thumbnail and truncates summary', () => {
  const item = normalizeItem(
    { title: ' T ', link: 'l', 'media:thumbnail': { $: { url: 'img.jpg' } }, contentSnippet: 'x'.repeat(500) },
    sources[0],
  )
  assert.equal(item.title, 'T')
  assert.equal(item.image, 'img.jpg')
  assert.equal(item.summary.length, 280)
  assert.equal(item.publishedAt, null)
})
