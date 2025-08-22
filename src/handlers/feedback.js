import i18next from 'i18next';
import * as db from '../services/db.js';
import { error as logError } from '../logger.js';

async function t(userId, key) {
  const lang = await db.getLanguage(userId);
  return new Promise(resolve => {
    i18next.changeLanguage(lang, () => resolve(i18next.t(key)));
  });
}

export function registerFeedback(bot) {
  bot.command('feedback', async ctx => {
    try {
      const text = await t(ctx.from.id, 'feedback_message');
      await ctx.reply(text);
    } catch (err) {
      logError('Error in feedback command:', err);
      await ctx.reply(i18next.t('error_occurred')).catch(() => {});
    }
  });
}
