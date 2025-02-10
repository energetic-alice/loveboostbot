import 'dotenv/config';
import { Telegraf, Markup } from 'telegraf';
import * as db from './db.js';
import * as ideas from './ideas.js';
import fs from 'fs';
import cron from 'node-cron';
import OpenAI from 'openai';
import { generatePersonalizedIdea } from './openai.js';
import { saveUserFeedback } from './db.js';

// Используем переменные окружения
const bot = new Telegraf(process.env.BOT_TOKEN);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Загрузка переводов
const locales = {
  en: JSON.parse(fs.readFileSync('./locales/en.json')),
  ru: JSON.parse(fs.readFileSync('./locales/ru.json')),
};

// Функция для получения текста на выбранном языке
function t(userId, key, callback) {
  db.getLanguage(userId, lang => {
    callback(locales[lang][key] || key);
  });
}

// Старт
bot.start(ctx => {
  ctx.reply(
    locales.en.choose_language,
    Markup.inlineKeyboard([
      [Markup.button.callback('🇬🇧 English', 'set_lang_en')],
      [Markup.button.callback('🇷🇺 Русский', 'set_lang_ru')],
    ]),
  );
});

// Установка языка
bot.action(/set_lang_(.+)/, ctx => {
  const lang = ctx.match[1];
  db.saveLanguage(ctx.from.id, lang);

  db.getLanguage(ctx.from.id, retrievedLang => {
    //console.log(`Language after save: ${retrievedLang}`);
    ctx.reply(
      locales[retrievedLang].welcome,
      Markup.inlineKeyboard([
        [Markup.button.callback(locales[retrievedLang].menu.girl, 'set_profile_girl')],
        [Markup.button.callback(locales[retrievedLang].menu.boy, 'set_profile_boy')],
        [Markup.button.callback(locales[retrievedLang].menu.couple, 'set_profile_couple')],
        [Markup.button.callback(locales[retrievedLang].menu.change_language, 'change_language')],
      ]),
    );
  });
});

// Смена языка
bot.action('change_language', ctx => {
  ctx.reply(
    locales.en.choose_language,
    Markup.inlineKeyboard([
      [Markup.button.callback('🇬🇧 English', 'set_lang_en')],
      [Markup.button.callback('🇷🇺 Русский', 'set_lang_ru')],
    ]),
  );
});

//Установка профиля
bot.action(/set_profile_(.+)/, async ctx => {
  const profile = ctx.match[1];
  const userId = ctx.from.id;

  db.saveProfile(userId, profile);

  t(userId, 'profile_set', async text => {
    await ctx.reply(text); // ✅ Сообщение о том, что профиль установлен

    // 🚀 Сразу отправляем первую идею
    await sendIdea(ctx);
  });
});

// Отправка идеи
bot.command('idea', ctx => {
  db.getLanguage(ctx.from.id, lang => {
    sendIdea(ctx, lang); // Вынесем логику в отдельную функцию
  });
});

async function sendIdea(ctx, type = null) {
  const userId = ctx.from.id;
  const waitingMessage = await ctx.reply('⏳ Генерируем новую идею…');

  db.getLanguage(userId, async lang => {
    try {
      if (type === 'romantic' || type === 'spicy') {
        // ✅ Генерация только одной идеи нужного типа
        const idea = await generatePersonalizedIdea(userId, type, lang);
        await ctx.deleteMessage(waitingMessage.message_id);

        await ctx.reply(
          `${type === 'romantic' ? '💖 Романтическая идея' : '🔥 Идея 18+'}:\n${idea}`,
          Markup.inlineKeyboard([
            [
              Markup.button.callback('❤️', `like_${type}`),
              Markup.button.callback('❌', `dislike_${type}`),
              Markup.button.callback('✔️', `done_${type}`),
            ],
          ]),
        );
      } else {
        // ✅ Генерация обеих идей при обычном запросе
        const romanticIdea = await generatePersonalizedIdea(userId, 'romantic', lang);
        const spicyIdea = await generatePersonalizedIdea(userId, 'spicy', lang);

        await ctx.deleteMessage(waitingMessage.message_id);

        await ctx.reply(
          `💖 ${lang === 'ru' ? 'Романтическая идея' : 'Romantic Idea'}:\n${romanticIdea}`,
          Markup.inlineKeyboard([
            [
              Markup.button.callback('❤️', `like_romantic`),
              Markup.button.callback('❌', `dislike_romantic`),
              Markup.button.callback('✔️', `done_romantic`),
            ],
          ]),
        );

        await ctx.reply(
          `🔥 ${lang === 'ru' ? 'Идея 18+' : 'Spicy Idea'}:\n${spicyIdea}`,
          Markup.inlineKeyboard([
            [
              Markup.button.callback('❤️', `like_spicy`),
              Markup.button.callback('❌', `dislike_spicy`),
              Markup.button.callback('✔️', `done_spicy`),
            ],
          ]),
        );
      }
    } catch (error) {
      console.error('Ошибка при отправке идей:', error);
      await ctx.reply(lang === 'ru' ? 'Произошла ошибка. Попробуйте снова.' : 'An error occurred. Please try again.');
      await ctx.deleteMessage(waitingMessage.message_id);
    }
  });
}

// Обработка реакций

bot.action(/^like_(romantic|spicy)$/, ctx => {
  const ideaText = ctx.update.callback_query.message.text;
  saveUserFeedback(ctx.from.id, ideaText, 'like');
  ctx.reply('❤️ Рад, что понравилось!');
});

// Объединённая кнопка "Дислайк/Следующая"
bot.action(/dislike_(.+)/, async ctx => {
  console.log('Кнопка "Дислайк/Следующая" нажата'); // ✅ Проверка срабатывания
  const userId = ctx.from.id;
  const ideaText = ctx.update.callback_query.message.text;
  const ideaType = ctx.match[1]; // romantic или spicy

  db.getTodayDislikeCount(userId, count => {
    console.log(`Количество дизлайков сегодня: ${count}`); // ✅ Проверка лимита
    if (count < 3) {
      saveUserFeedback(userId, ideaText, 'dislike'); // ✅ Сохраняем дизлайк
      ctx.reply('😕 Попробуем что-то другое...');

      // ✅ Отправляем новую идею ТОЛЬКО того же типа
      db.getLanguage(userId, async lang => {
        const newIdea = await generatePersonalizedIdea(userId, ideaType, lang);
        ctx.reply(
          `${ideaType === 'romantic' ? '💖' : '🔥'} ${
            lang === 'ru'
              ? ideaType === 'romantic'
                ? 'Романтическая идея'
                : 'Идея 18+'
              : ideaType === 'romantic'
                ? 'Romantic Idea'
                : 'Spicy Idea'
          }:\n${newIdea}`,
          Markup.inlineKeyboard([
            [
              Markup.button.callback('❤️', `like_${ideaType}`),
              Markup.button.callback('❌', `dislike_or_next_${ideaType}`),
              Markup.button.callback('✔️', `done_${ideaType}`),
            ],
          ]),
        );
      });
    } else {
      t(userId, 'dislike_limit_reached', text => ctx.reply(text)); // ✅ Лимит достигнут
    }
  });
});

bot.action(/done_(.+)/, ctx => {
  ctx.reply('✅ Здорово, что вы это сделали!');
});

// Ежедневная рассылка идей в 9:00 утра
cron.schedule('0 9 * * *', () => {
  //cron.schedule('*/2 * * * *', () => {
  // Каждые 2 минуты для теста
  db.getAllUsers(users => {
    users.forEach(user => {
      t(user.id, 'daily_reminder', text => {
        const idea = ideas.getRandomIdea(user.language);
        bot.telegram.sendMessage(
          user.id,
          `${text}\n\n${idea.text}`,
          Markup.inlineKeyboard([
            [Markup.button.callback('❤️', 'like')],
            [Markup.button.callback('❌', 'dislike')],
            [Markup.button.callback('✔️', 'done')],
          ]),
        );
      });
    });
  });
  console.log('✅ Daily reminders sent!');
});

bot.launch({
  webhook: {
    domain: 'https://loveboostbot.onrender.com',
    port: process.env.PORT || 3000,
  },
});

console.log('🚀 LoveBoostBot is running...');
