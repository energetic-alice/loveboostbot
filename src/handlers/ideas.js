import { Markup } from 'telegraf';
import i18next from 'i18next';
import * as db from '../services/db.js';
import { generatePersonalizedIdea } from '../services/openai.js';
import config from '../config.js';
import { IDEA_TYPES } from '../constants/ideas.js';
import { error as logError } from '../logger.js';

async function getLang(userId) {
  return db.getLanguage(userId);
}

export async function sendIdea(ctx, type = null) {
  const userId = ctx.from?.id;
  if (!userId) return;

  try {
    const count = await db.getIdeaRequestCountInLast24h(userId);
    if (count >= config.ideaRequestLimitPerDay) {
      await ctx.reply(i18next.t('idea_limit_reached'));
      return;
    }
  } catch (err) {
    logError('Error checking idea limit:', err);
  }

  let waitingMessage;
  try {
    waitingMessage = await ctx.reply(i18next.t('generating_idea'));
  } catch (err) {
    logError('Error sending waiting message:', err);
    return;
  }

  try {
    const lang = await getLang(userId);
    const safeType = type && IDEA_TYPES.includes(type) ? type : null;

    if (safeType === 'romantic' || safeType === 'spicy') {
      const idea = await generatePersonalizedIdea(userId, safeType, lang);
      await ctx.deleteMessage(waitingMessage.message_id).catch(() => {});
      await ctx.reply(
        `${i18next.t(safeType === 'romantic' ? 'romantic_idea' : 'spicy_idea')}:\n${idea}`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback('❤️', `like_${safeType}`),
            Markup.button.callback('❌', `dislike_${safeType}`),
            Markup.button.callback('✔️', `done_${safeType}`),
          ],
        ]),
      );
    } else {
      const romanticIdea = await generatePersonalizedIdea(userId, 'romantic', lang);
      const spicyIdea = await generatePersonalizedIdea(userId, 'spicy', lang);
      await ctx.deleteMessage(waitingMessage.message_id).catch(() => {});

      await ctx.reply(
        `💖 ${i18next.t('romantic_idea')}:\n${romanticIdea}`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback('❤️', 'like_romantic'),
            Markup.button.callback('❌', 'dislike_romantic'),
            Markup.button.callback('✔️', 'done_romantic'),
          ],
        ]),
      );
      await ctx.reply(
        `🔥 ${i18next.t('spicy_idea')}:\n${spicyIdea}`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback('❤️', 'like_spicy'),
            Markup.button.callback('❌', 'dislike_spicy'),
            Markup.button.callback('✔️', 'done_spicy'),
          ],
        ]),
      );
    }
  } catch (error) {
    logError('Error sending ideas:', error);
    await ctx.reply(i18next.t('error_occurred')).catch(() => {});
    await ctx.deleteMessage(waitingMessage.message_id).catch(() => {});
  }
}

export function registerIdeas(bot) {
  bot.command('idea', async ctx => {
    try {
      await sendIdea(ctx);
    } catch (err) {
      logError('Error in /idea:', err);
      await ctx.reply(i18next.t('error_occurred')).catch(() => {});
    }
  });
}
