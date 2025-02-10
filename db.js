import sqlite3 from 'sqlite3';

const { Database } = sqlite3.verbose();
const db = new Database('database.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    profile TEXT,
    language TEXT DEFAULT 'en'
  )`);

  // Создание таблицы для хранения показанных идей
  db.run(`
    CREATE TABLE IF NOT EXISTS shown_ideas (
      user_id INTEGER,
      idea_id INTEGER,
      PRIMARY KEY (user_id, idea_id)
    )
  `);

  // 🔥 Новая таблица для хранения обратной связи
  db.run(`
    CREATE TABLE IF NOT EXISTS user_feedback (
      user_id INTEGER,
      idea_id INTEGER,
      feedback TEXT, -- 'like', 'dislike', 'done'
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, idea_id)
    )
  `);
});

// ✅ Сохраняем профиль
function saveProfile(userId, profile) {
  db.run(
    `INSERT INTO users (id, profile) VALUES (?, ?)
        ON CONFLICT(id) DO UPDATE SET profile = excluded.profile`,
    [userId, profile],
    err => {
      if (err) console.error('Error saving profile:', err);
    },
  );
}

// ✅ Исправлено сохранение языка
function saveLanguage(userId, language) {
  db.run(
    `INSERT INTO users (id, language) VALUES (?, ?)
        ON CONFLICT(id) DO UPDATE SET language = excluded.language`,
    [userId, language],
    err => {
      if (err) console.error('Error saving language:', err);
      console.log(`Language saved for user ${userId}: ${language}`);
    },
  );
}

// ✅ Получение языка
function getLanguage(userId, callback) {
  db.get(`SELECT language FROM users WHERE id = ?`, [userId], (err, row) => {
    if (err) {
      console.error('Error retrieving language:', err);
      callback('en'); // По умолчанию
    } else {
      console.log(`Language retrieved for user ${userId}: ${row ? row.language : 'en'}`);
      callback(row ? row.language : 'en');
    }
  });
}

// Получение всех пользователей
function getAllUsers(callback) {
  db.all(`SELECT id, language FROM users`, (err, rows) => {
    if (err) {
      console.error('Error retrieving users:', err);
      callback([]);
    } else {
      callback(rows);
    }
  });
}

// Сохраняем ID показанной идеи
function saveShownIdea(userId, ideaId) {
  db.run('INSERT OR IGNORE INTO shown_ideas (user_id, idea_id) VALUES (?, ?)', [userId, ideaId]);
}

// Проверяем, была ли идея уже показана
function wasIdeaShown(userId, ideaId, callback) {
  db.get('SELECT 1 FROM shown_ideas WHERE user_id = ? AND idea_id = ?', [userId, ideaId], (err, row) => {
    callback(!!row);
  });
}

db.run(`
  CREATE TABLE IF NOT EXISTS user_feedback (
    user_id INTEGER,
    idea_id TEXT,
    feedback TEXT, -- 'like', 'dislike', 'done'
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, idea_id)
  )
`);

function saveUserFeedback(userId, ideaId, feedback) {
  db.run(
    `INSERT OR REPLACE INTO user_feedback (user_id, idea_id, feedback) VALUES (?, ?, ?)`,
    [userId, ideaId, feedback],
    err => {
      if (err) console.error('Ошибка при сохранении обратной связи:', err);
    },
  );
}

function getUserFeedback(userId, callback) {
  db.all(`SELECT idea_id, feedback FROM user_feedback WHERE user_id = ?`, [userId], (err, rows) => {
    if (err) {
      console.error('Ошибка при получении обратной связи:', err);
      callback([]);
    } else {
      callback(rows);
    }
  });
}

function getTodayDislikeCount(userId, callback) {
  const today = new Date().toISOString().split('T')[0];
  db.get(
    `SELECT COUNT(*) as count 
     FROM user_feedback 
     WHERE user_id = ? AND feedback = 'dislike' AND DATE(timestamp) = ?`,
    [userId, today],
    (err, row) => {
      if (err) {
        console.error('Error fetching dislikes:', err);
        callback(0);
      } else {
        callback(row.count);
      }
    },
  );
}

export {
  saveProfile,
  saveLanguage,
  getLanguage,
  getAllUsers,
  saveShownIdea,
  wasIdeaShown,
  saveUserFeedback,
  getUserFeedback,
  getTodayDislikeCount,
};
