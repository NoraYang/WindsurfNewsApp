import cors from 'cors'
import express from 'express'

export function createApp({ sources, newsService, corsOrigins }) {
  const app = express()
  app.use(cors({ origin: corsOrigins }))

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

  app.get('/api/sources', (_req, res) =>
    res.json(sources.map(({ id, name, category }) => ({ id, name, category }))),
  )

  app.get('/api/news', async (req, res, next) => {
    try {
      const sourceIds = req.query.source ? String(req.query.source).split(',').filter(Boolean) : []
      const unknown = sourceIds.filter((id) => !sources.some((s) => s.id === id))
      if (unknown.length) return res.status(400).json({ error: `Unknown source: ${unknown.join(', ')}` })

      const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 200)
      const result = await newsService.getNews({
        sourceIds,
        query: req.query.q ? String(req.query.q).trim() : '',
        limit,
        force: req.query.refresh === 'true',
      })
      if (result.items.length === 0 && result.errors.length > 0) return res.status(502).json(result)
      res.json(result)
    } catch (err) {
      next(err)
    }
  })

  app.use((err, _req, res, _next) => {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  })

  return app
}
