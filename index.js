import dotenv from 'dotenv';
import { Telegraf, Markup } from 'telegraf';
import * as db from './db.js';
import cron from 'node-cron';
import OpenAI from 'openai';
import { generatePersonalizedIdea } from './openai.js';
import { saveUserIdea } from './db.js';
import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import middleware from 'i18next-http-middleware';

// Сначала определяем, какой .env файл использовать
const ENV_FILE = process.env.TEST_BOT ? '.env.test' : '.env';
dotenv.config({ path: ENV_FILE });

console.log(process.env.BOT_TOKEN);

// Инициализация i18next
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
    async () => {
      console.log('🌍 Локализация загружена');
      await setBotCommands(); // ✅ Устанавливаем команды после загрузки локализации
    },
  );

// Используем переменные окружения
const bot = new Telegraf(process.env.BOT_TOKEN);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Функция для получения текста на выбранном языке
function t(userId, key, callback) {
  db.getLanguage(userId, lang => {
    i18next.changeLanguage(lang, () => {
      callback(i18next.t(key));
    });
  });
}

// Устанавливаем команды бота с локализацией
async function setBotCommands() {
  bot.telegram.setMyCommands([{ command: 'feedback', description: '💌' }]);
}

// Старт
bot.start(ctx => {
  ctx.reply(
    i18next.t('choose_language'),
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
    i18next.changeLanguage(retrievedLang, () => {
      ctx.reply(
        i18next.t('welcome'),
        Markup.inlineKeyboard([
          [Markup.button.callback(i18next.t('menu.girl'), 'set_profile_girl')],
          [Markup.button.callback(i18next.t('menu.boy'), 'set_profile_boy')],
          [Markup.button.callback(i18next.t('menu.couple'), 'set_profile_couple')],
          [Markup.button.callback(i18next.t('menu.change_language'), 'change_language')],
        ]),
      );
    });
  });
});

// Смена языка
bot.action('change_language', ctx => {
  ctx.reply(
    i18next.t('choose_language'),
    Markup.inlineKeyboard([
      [Markup.button.callback('🇬🇧 English', 'set_lang_en')],
      [Markup.button.callback('🇷🇺 Русский', 'set_lang_ru')],
    ]),
  );
});

// Установка профиля
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

bot.command('feedback', ctx => {
  t(ctx.from.id, 'feedback_message', text => {
    ctx.reply(i18next.t('feedback_message'));
  });
});

async function sendIdea(ctx, type = null) {
  const userId = ctx.from.id;
  const waitingMessage = await ctx.reply(i18next.t('generating_idea'));

  db.getLanguage(userId, async lang => {
    try {
      if (type === 'romantic' || type === 'spicy') {
        // ✅ Генерация только одной идеи нужного типа
        const idea = await generatePersonalizedIdea(userId, type, lang);
        await ctx.deleteMessage(waitingMessage.message_id);

        await ctx.reply(
          `${i18next.t(type === 'romantic' ? 'romantic_idea' : 'spicy_idea')}:\n${idea}`,
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
          `💖 ${i18next.t('romantic_idea')}:\n${romanticIdea}`,
          Markup.inlineKeyboard([
            [
              Markup.button.callback('❤️', `like_romantic`),
              Markup.button.callback('❌', `dislike_romantic`),
              Markup.button.callback('✔️', `done_romantic`),
            ],
          ]),
        );

        await ctx.reply(
          `🔥 ${i18next.t('spicy_idea')}:\n${spicyIdea}`,
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
      await ctx.reply(i18next.t('error_occurred'));
      await ctx.deleteMessage(waitingMessage.message_id);
    }
  });
}

// Обработка реакций

bot.action(/^like_(romantic|spicy)$/, ctx => {
  const ideaText = ctx.update.callback_query.message.text.split('\n').slice(1).join('\n').trim();
  saveUserIdea(ctx.from.id, new Date().getTime(), ideaText, 'like', ctx.match[1]);
  ctx.reply(i18next.t('like_response'));
});

// Объединённая кнопка "Дислайк/Следующая"
bot.action(/dislike_(.+)/, async ctx => {
  const userId = ctx.from.id;
  const ideaText = ctx.update.callback_query.message.text.split('\n').slice(1).join('\n').trim();
  const ideaType = ctx.match[1]; // romantic или spicy

  db.getTodayDislikeCount(userId, count => {
    if (count < 3) {
      saveUserIdea(userId, new Date().getTime(), ideaText, 'dislike', ideaType); // ✅ Сохраняем дизлайк
      ctx.reply(i18next.t('dislike_response'));

      // ✅ Отправляем новую идею ТОЛЬКО того же типа
      db.getLanguage(userId, async lang => {
        const newIdea = await generatePersonalizedIdea(userId, ideaType, lang);
        ctx.reply(
          `${ideaType === 'romantic' ? '💖' : '🔥'} ${i18next.t(ideaType === 'romantic' ? 'romantic_idea' : 'spicy_idea')}:\n${newIdea}`,
          Markup.inlineKeyboard([
            [
              Markup.button.callback('❤️', `like_${ideaType}`),
              Markup.button.callback('❌', `dislike_${ideaType}`),
              Markup.button.callback('✔️', `done_${ideaType}`),
            ],
          ]),
        );
      });
    } else {
      ctx.reply(i18next.t('dislike_limit_reached')); // ✅ Лимит достигнут
    }
  });
});

bot.action(/done_(.+)/, ctx => {
  ctx.reply(i18next.t('done_response'));
});

// Пользователь хочет идею
bot.action('send_idea', async ctx => {
  const userId = ctx.from.id;

  // Если пользователь был в заморозке, размораживаем его
  db.getSnoozeStatus(userId, isSnoozed => {
    if (isSnoozed) {
      console.log(`⏳ Пользователь ${userId} размораживается вручную`);
      db.unsnoozeUser(userId);
      ctx.reply(i18next.t('unsnoozed')); // "Ты снова в игре! Вот твоя идея: 🎉"
    }

    db.getLanguage(userId, async lang => {
      sendIdea(ctx, lang);
    });
  });
});

// Пользователь пропускает только сегодня
bot.action('skip_idea', ctx => {
  console.log(`❌ Пользователь ${ctx.from.id} отказался от идеи сегодня`);
  ctx.reply(i18next.t('idea_skipped')); // "Ок! Не буду присылать сегодня. 😊"
});

// Пользователь откладывает идеи на неделю
bot.action('snooze_week', ctx => {
  const userId = ctx.from.id;
  console.log(`⏳ Пользователь ${userId} отложил идеи на неделю`);

  db.snoozeUserForWeek(userId);
  ctx.reply(
    i18next.t('snoozed_for_week'),
    Markup.inlineKeyboard([[Markup.button.callback(i18next.t('restore_subscription'), 'restore_subscription')]]),
  );
});

// Пользователь хочет возобновить рассылку
bot.action('restore_subscription', async ctx => {
  const userId = ctx.from.id;

  db.unsnoozeUser(userId); // ❄️ Снимаем заморозку

  ctx.reply(i18next.t('subscription_restored')); // "Ты снова будешь получать ежедневные идеи! 😊"
});

// Ежедневная проверка перед отправкой
cron.schedule('0 9 * * *', () => {
  console.log('⏰ Рассылка предложений запущена! Время:', new Date().toLocaleString());

  db.getAllUsers(users => {
    console.log(`👥 Найдено пользователей: ${users.length}`);

    users.forEach(user => {
      db.getSnoozeStatus(user.id, isSnoozed => {
        if (!isSnoozed) {
          t(user.id, 'daily_question', text => {
            console.log(`📩 Спрашиваем пользователя ${user.id}, хочет ли он идею`);

            bot.telegram.sendMessage(
              user.id,
              text, // "Хочешь получить новую идею сегодня? 💡"
              Markup.inlineKeyboard([
                [Markup.button.callback(i18next.t('button_yes'), `send_idea`)],
                [Markup.button.callback(i18next.t('button_no'), `skip_idea`)],
                [Markup.button.callback(i18next.t('button_snooze'), `snooze_week`)],
              ]),
            );
          });
        } else {
          console.log(`⏳ Пользователь ${user.id} отложил идеи на неделю, пропускаем.`);
        }
      });
    });
  });
});

if (process.env.TEST_BOT) {
  // Тестовый бот работает через long polling
  bot.launch();
  console.log('🚀 Test bot is running in long polling mode...');
} else {
  bot.launch({
    webhook: {
      domain: process.env.WEBHOOK_URL,
      port: process.env.PORT || 3000,
    },
  });
  console.log('🚀 Production bot is running via Webhook...');
}
