import sqlite3 from 'sqlite3';
import config from '../config.js';
import { error as logError, info } from '../logger.js';

const { Database } = sqlite3.verbose();
const db = new Database(config.databaseUrl);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    profile TEXT,
    language TEXT DEFAULT 'en'
  )`);

  db.run(`
    CREATE TABLE IF NOT EXISTS user_ideas (
      user_id INTEGER,
      idea_id INTEGER,
      idea_text TEXT,
      feedback TEXT,
      type TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, idea_id)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_user_id ON user_ideas(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_feedback ON user_ideas(feedback)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_timestamp ON user_ideas(timestamp DESC)`);

  db.run(`CREATE TABLE IF NOT EXISTS snoozed_users (
    user_id INTEGER PRIMARY KEY,
    snooze_until DATETIME
  )`);
});

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, err => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

export async function saveProfile(userId, profile) {
  try {
    await run(
      `INSERT INTO users (id, profile) VALUES (?, ?)
       ON CONFLICT(id) DO UPDATE SET profile = excluded.profile`,
      [userId, profile],
    );
  } catch (err) {
    logError('Error saving profile:', err);
  }
}

export async function saveLanguage(userId, language) {
  try {
    await run(
      `INSERT INTO users (id, language) VALUES (?, ?)
       ON CONFLICT(id) DO UPDATE SET language = excluded.language`,
      [userId, language],
    );
    info(`Language saved for user ${userId}: ${language}`);
  } catch (err) {
    logError('Error saving language:', err);
  }
}

export async function getLanguage(userId) {
  try {
    const row = await get('SELECT language FROM users WHERE id = ?', [userId]);
    const lang = row?.language || 'en';
    info(`Language for user ${userId}: ${lang}`);
    return lang;
  } catch (err) {
    logError('Error getting language:', err);
    return 'en';
  }
}

export async function getAllUsers() {
  try {
    return await all('SELECT id, language FROM users');
  } catch (err) {
    logError('Error getting users:', err);
    return [];
  }
}

export async function saveUserIdea(userId, ideaId, ideaText, feedback, type) {
  try {
    await run(
      `INSERT INTO user_ideas (user_id, idea_id, idea_text, feedback, type, timestamp)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [userId, ideaId, ideaText, feedback, type],
    );
  } catch (err) {
    logError('Error saving idea:', err);
  }
}

export async function getUserFeedback(userId, type) {
  try {
    return await all('SELECT idea_text, feedback FROM user_ideas WHERE user_id = ? AND type = ?', [userId, type]);
  } catch (err) {
    logError('Error getting user feedback:', err);
    return [];
  }
}

export async function getTodayDislikeCount(userId) {
  const today = new Date().toISOString().split('T')[0];
  try {
    const row = await get(
      `SELECT COUNT(*) as count FROM user_ideas
       WHERE user_id = ? AND feedback = 'dislike' AND DATE(timestamp) = ?`,
      [userId, today],
    );
    return row?.count ?? 0;
  } catch (err) {
    logError('Error getting dislike count:', err);
    return 0;
  }
}

export async function getIdeaRequestCountInLast24h(userId) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  try {
    const row = await get(
      `SELECT COUNT(*) as count FROM user_ideas
       WHERE user_id = ? AND feedback = 'shown' AND timestamp >= ?`,
      [userId, since],
    );
    return row?.count ?? 0;
  } catch (err) {
    logError('Error getting idea request count:', err);
    return 0;
  }
}

export async function snoozeUserForWeek(userId) {
  const snoozeUntil = new Date();
  snoozeUntil.setDate(snoozeUntil.getDate() + 7);
  try {
    await run(
      `INSERT INTO snoozed_users (user_id, snooze_until) VALUES (?, ?)
       ON CONFLICT(user_id) DO UPDATE SET snooze_until = excluded.snooze_until`,
      [userId, snoozeUntil.toISOString()],
    );
  } catch (err) {
    logError('Error snoozing user:', err);
  }
}

export async function getSnoozeStatus(userId) {
  try {
    const row = await get('SELECT snooze_until FROM snoozed_users WHERE user_id = ?', [userId]);
    if (!row || new Date(row.snooze_until) < new Date()) {
      await run('DELETE FROM snoozed_users WHERE user_id = ?', [userId]);
      return false;
    }
    return true;
  } catch (err) {
    logError('Error getting snooze status:', err);
    return false;
  }
}

export async function unsnoozeUser(userId) {
  try {
    await run('DELETE FROM snoozed_users WHERE user_id = ?', [userId]);
    info(`User ${userId} unfrozen`);
  } catch (err) {
    logError('Error unsnoozing user:', err);
  }
}
