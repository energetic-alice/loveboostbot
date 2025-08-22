import { Markup } from 'telegraf';
import i18next from 'i18next';
import * as db from '../services/db.js';
import { SUPPORTED_LANGUAGES } from '../constants/ideas.js';

async function t(userId, key) {
  const lang = await db.getLanguage(userId);
  return new Promise(resolve => {
    i18next.changeLanguage(lang, () => resolve(i18next.t(key)));
  });
}

export function registerStart(bot) {
  bot.start(ctx => {
    ctx.reply(
      i18next.t('choose_language'),
      Markup.inlineKeyboard([
        [Markup.button.callback('🇬🇧 English', 'set_lang_en')],
        [Markup.button.callback('🇷🇺 Русский', 'set_lang_ru')],
      ]),
    );
  });

  bot.action(/set_lang_(.+)/, async ctx => {
    const raw = ctx.match[1];
    const lang = SUPPORTED_LANGUAGES.includes(raw) ? raw : 'en';
    await db.saveLanguage(ctx.from.id, lang);
    const retrievedLang = await db.getLanguage(ctx.from.id);
    await new Promise(resolve => i18next.changeLanguage(retrievedLang, resolve));
    await ctx.reply(
      i18next.t('welcome'),
      Markup.inlineKeyboard([
        [Markup.button.callback(i18next.t('menu.girl'), 'set_profile_girl')],
        [Markup.button.callback(i18next.t('menu.boy'), 'set_profile_boy')],
        [Markup.button.callback(i18next.t('menu.couple'), 'set_profile_couple')],
        [Markup.button.callback(i18next.t('menu.change_language'), 'change_language')],
        [Markup.button.callback(i18next.t('menu.feedback'), 'show_feedback')],
      ]),
    );
  });

  bot.action('show_feedback', async ctx => {
    await ctx.reply(await t(ctx.from.id, 'feedback_message'));
  });

  bot.action('change_language', ctx => {
    ctx.reply(
      i18next.t('choose_language'),
      Markup.inlineKeyboard([
        [Markup.button.callback('🇬🇧 English', 'set_lang_en')],
        [Markup.button.callback('🇷🇺 Русский', 'set_lang_ru')],
      ]),
    );
  });

  bot.action(/set_profile_(.+)/, async ctx => {
    const profile = ctx.match[1];
    const userId = ctx.from.id;
    await db.saveProfile(userId, profile);
    const text = await t(userId, 'profile_set');
    await ctx.reply(text);
    const { sendIdea } = await import('./ideas.js');
    await sendIdea(ctx);
  });
}
