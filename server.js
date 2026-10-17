import { createApp } from './app.js'
import { createNewsService } from './news.js'
import { SOURCES } from './sources.js'

const PORT = Number(process.env.PORT ?? 8000)
const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',')

const app = createApp({ sources: SOURCES, newsService: createNewsService({ sources: SOURCES }), corsOrigins })

app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`))
