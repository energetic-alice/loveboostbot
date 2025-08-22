import { Telegraf } from 'telegraf';
import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import middleware from 'i18next-http-middleware';

import config from './config.js';
import { info as logInfo } from './logger.js';
import { startHealthServer } from './health.js';
import { registerStart } from './handlers/start.js';
import { registerIdeas } from './handlers/ideas.js';
import { registerFeedback } from './handlers/feedback.js';
import { registerActions } from './handlers/actions.js';
import { registerCron } from './handlers/cron.js';

await new Promise((resolve, reject) => {
  i18next
    .use(Backend)
    .use(middleware.LanguageDetector)
    .init(
      {
        fallbackLng: 'ru',
        backend: {
          loadPath: './locales/{{lng}}.json',
        },
        detection: {
          order: ['querystring', 'cookie'],
          caches: ['cookie'],
        },
      },
      err => (err ? reject(err) : resolve()),
    );
});

logInfo('Locales loaded');

const bot = new Telegraf(config.botToken);

registerStart(bot);
registerIdeas(bot);
registerFeedback(bot);
registerActions(bot);
registerCron(bot);

try {
  await bot.telegram.setMyCommands([{ command: 'feedback', description: '💌' }]);
} catch (err) {
  logInfo('Could not set bot commands (Telegram API):', err.message);
}

if (config.isTestBot) {
  bot.launch();
  logInfo(i18next.t('bot_running'));
} else {
  startHealthServer();
  bot.launch({
    webhook: {
      domain: config.webhookUrl,
      port: config.port,
    },
  });
  logInfo(i18next.t('bot_running'));
}

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
