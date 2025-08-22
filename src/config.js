import dotenv from 'dotenv';

const ENV_FILE = process.env.TEST_BOT ? '.env.test' : '.env';
dotenv.config({ path: ENV_FILE });

const requiredEnv = ['BOT_TOKEN', 'OPENAI_API_KEY', 'DATABASE_URL'];
const missing = requiredEnv.filter(key => !process.env[key]);
if (missing.length) {
  console.error('Missing required env:', missing.join(', '));
  process.exit(1);
}

if (!process.env.TEST_BOT && !process.env.WEBHOOK_URL) {
  console.error('WEBHOOK_URL is required for production');
  process.exit(1);
}

const config = {
  botToken: process.env.BOT_TOKEN,
  openaiApiKey: process.env.OPENAI_API_KEY,
  databaseUrl: process.env.DATABASE_URL,
  webhookUrl: process.env.WEBHOOK_URL,
  port: Number(process.env.PORT) || 3000,
  isTestBot: Boolean(process.env.TEST_BOT),

  dislikeLimitPerDay: 3,
  ideaRequestLimitPerDay: Number(process.env.IDEA_REQUEST_LIMIT_PER_DAY) || 30,
  cronDaily: '0 9 * * *',
  openaiMaxTokens: 120,
  openaiModel: process.env.OPENAI_MODEL || 'gpt-5-mini',

  healthPort: Number(process.env.HEALTH_PORT) || (Number(process.env.PORT) || 3000) + 1,
};

export default config;
