# Love Bot

Telegram bot for couples: personalized romantic and date ideas, powered by OpenAI. Supports English and Russian.

## Stack

- **Runtime:** Node.js (ES modules)
- **Bot:** Telegraf
- **AI:** OpenAI API (GPT)
- **Database:** SQLite
- **i18n:** i18next, locales in `locales/` (en, ru)

## Setup

1. Clone and install:

   ```bash
   npm install
   ```

2. Create `.env` (and optionally `.env.test` for test bot):

   ```
   BOT_TOKEN=your_telegram_bot_token
   OPENAI_API_KEY=your_openai_api_key
   DATABASE_URL=./loveboost.db
   ```

   For production with webhook:

   ```
   WEBHOOK_URL=https://your-domain.com
   PORT=3000
   ```

   Optional: `OPENAI_MODEL` (default: `gpt-5-mini`), `IDEA_REQUEST_LIMIT_PER_DAY` (default: 30), `HEALTH_PORT` (default: PORT+1).

3. Run:

   ```bash
   npm start
   ```

   Test bot (long polling):

   ```bash
   npm run start:test
   ```

## Architecture & decisions

- **SQLite** — Single process, no concurrent writers; SQLite is enough for small & simple project. No migrations: schema is created on startup (`CREATE TABLE IF NOT EXISTS`). For 10k+ users or multiple app instances, I’d switch to PostgreSQL and a proper migration flow.
- **Single process + node-cron** — Daily job runs in the same process. Simple and fine for current load. At scale we’d move scheduled tasks to a queue (e.g. Bull + Redis) or a separate worker.
- **OpenAI** — Model is configurable (`OPENAI_MODEL`, default `gpt-5-mini`; e.g. `gpt-5.2` for flagship). Requests are retried on 429/5xx and network errors (exponential backoff). Idea type and language are validated against `IDEA_TYPES` and `SUPPORTED_LANGUAGES` at the boundary.
- **Rate limits** — Per user: up to 3 “dislike” actions per day; up to `IDEA_REQUEST_LIMIT_PER_DAY` generated ideas per 24h (default 30). Protects OpenAI usage and avoids abuse.
- **Health check** — In production (webhook mode), a separate HTTP server listens on `HEALTH_PORT` (default `PORT+1`) and serves `GET /health` with `{ status, db }`. Returns 503 if DB is unreachable.
