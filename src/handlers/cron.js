import cron from 'node-cron';
import { Markup } from 'telegraf';
import i18next from 'i18next';
import * as db from '../services/db.js';
import config from '../config.js';
import { info as logInfo, error as logError } from '../logger.js';

async function t(userId, key) {
  const lang = await db.getLanguage(userId);
  return new Promise(resolve => {
    i18next.changeLanguage(lang, () => resolve(i18next.t(key)));
  });
}

export function registerCron(bot) {
  cron.schedule(config.cronDaily, async () => {
    logInfo('Scheduled ideas run at', new Date().toISOString());

    let users = [];
    try {
      users = await db.getAllUsers();
    } catch (err) {
      logError('Error loading users for cron:', err);
      return;
    }

    logInfo(`Users to notify: ${users.length}`);

    for (const user of users) {
      try {
        const isSnoozed = await db.getSnoozeStatus(user.id);
        if (isSnoozed) {
          logInfo(`User ${user.id} paused, skipping`);
          continue;
        }

        const text = await t(user.id, 'daily_question');
        logInfo(`Asking user ${user.id} for idea`);

        await bot.telegram.sendMessage(
          user.id,
          text,
          Markup.inlineKeyboard([
            [Markup.button.callback(i18next.t('button_yes'), 'send_idea')],
            [Markup.button.callback(i18next.t('button_skip'), 'skip_idea')],
            [Markup.button.callback(i18next.t('button_snooze'), 'snooze_week')],
          ]),
        );
      } catch (err) {
        logError(`Error sending daily message to user ${user.id}:`, err);
      }
    }
    logInfo(i18next.t('daily_reminders_sent'));
  });
}
