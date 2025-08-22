import { Markup } from 'telegraf';
import i18next from 'i18next';
import * as db from '../services/db.js';
import { generatePersonalizedIdea } from '../services/openai.js';
import { sendIdea } from './ideas.js';
import config from '../config.js';
import { IDEA_TYPES, SUPPORTED_LANGUAGES } from '../constants/ideas.js';
import { info as logInfo, error as logError } from '../logger.js';

async function t(userId, key) {
  const lang = await db.getLanguage(userId);
  return new Promise(resolve => {
    i18next.changeLanguage(lang, () => resolve(i18next.t(key)));
  });
}

export function registerActions(bot) {
  bot.action(/^like_(romantic|spicy)$/, async ctx => {
    const rawType = ctx.match[1];
    const ideaType = IDEA_TYPES.includes(rawType) ? rawType : 'romantic';
    const ideaText = ctx.update.callback_query.message.text.split('\n').slice(1).join('\n').trim();
    db.saveUserIdea(ctx.from.id, new Date().getTime(), ideaText, 'like', ideaType);
    await ctx.reply(await t(ctx.from.id, 'like'));
  });

  bot.action(/dislike_(.+)/, async ctx => {
    const userId = ctx.from.id;
    const ideaText = ctx.update.callback_query.message.text.split('\n').slice(1).join('\n').trim();
    const rawType = ctx.match[1];
    const ideaType = IDEA_TYPES.includes(rawType) ? rawType : 'romantic';

    try {
      const count = await db.getTodayDislikeCount(userId);
      if (count >= config.dislikeLimitPerDay) {
        await ctx.reply(await t(userId, 'dislike_limit_reached'));
        return;
      }

      await db.saveUserIdea(userId, new Date().getTime(), ideaText, 'dislike', ideaType);
      await ctx.reply(await t(userId, 'dislike'));

      const lang = await db.getLanguage(userId);
      const safeLang = SUPPORTED_LANGUAGES.includes(lang) ? lang : 'en';
      const newIdea = await generatePersonalizedIdea(userId, ideaType, safeLang);
      const nextText = await t(userId, 'next');
      const titleKey = ideaType === 'romantic' ? 'romantic_idea' : 'spicy_idea';
      const title = (ideaType === 'romantic' ? '💖 ' : '🔥 ') + (await t(userId, titleKey));
      await ctx.reply(
        `${nextText}\n\n${title}:\n${newIdea}`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback('❤️', `like_${ideaType}`),
            Markup.button.callback('❌', `dislike_${ideaType}`),
            Markup.button.callback('✔️', `done_${ideaType}`),
          ],
        ]),
      );
    } catch (err) {
      logError('Error in dislike handler:', err);
      await ctx.reply(i18next.t('error_occurred')).catch(() => {});
    }
  });

  bot.action(/done_(romantic|spicy)$/, async ctx => {
    await ctx.reply(await t(ctx.from.id, 'done'));
  });

  bot.action('send_idea', async ctx => {
    const userId = ctx.from.id;
    try {
      const isSnoozed = await db.getSnoozeStatus(userId);
      if (isSnoozed) {
        logInfo(`User ${userId} unfreeze requested`);
        await db.unsnoozeUser(userId);
        await ctx.reply(await t(userId, 'unsnoozed'));
      } else {
        await ctx.reply(await t(userId, 'daily_reminder'));
      }
      await sendIdea(ctx);
    } catch (err) {
      logError('Error in send_idea:', err);
      await ctx.reply(i18next.t('error_occurred')).catch(() => {});
    }
  });

  bot.action('skip_idea', async ctx => {
    logInfo(`User ${ctx.from.id} declined idea today`);
    await ctx.reply(await t(ctx.from.id, 'idea_skipped'));
  });

  bot.action('snooze_week', async ctx => {
    const userId = ctx.from.id;
    logInfo(`User ${userId} paused ideas for a week`);
    try {
      await db.snoozeUserForWeek(userId);
      await ctx.reply(
        await t(userId, 'snoozed_for_week'),
        Markup.inlineKeyboard([
          [Markup.button.callback(await t(userId, 'restore_subscription'), 'restore_subscription')],
        ]),
      );
    } catch (err) {
      logError('Error snoozing user:', err);
      await ctx.reply(i18next.t('error_occurred')).catch(() => {});
    }
  });

  bot.action('restore_subscription', async ctx => {
    const userId = ctx.from.id;
    try {
      await db.unsnoozeUser(userId);
      await ctx.reply(await t(userId, 'subscription_restored'));
    } catch (err) {
      logError('Error restoring subscription:', err);
      await ctx.reply(i18next.t('error_occurred')).catch(() => {});
    }
  });
}
