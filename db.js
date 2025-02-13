import sqlite3 from 'sqlite3';
import 'dotenv/config';

const { Database } = sqlite3.verbose();
const db = new Database(process.env.DATABASE_URL);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    profile TEXT,
    language TEXT DEFAULT 'en'
  )`);

  // Объединенная таблица для хранения показанных идей и обратной связи
  db.run(`
    CREATE TABLE IF NOT EXISTS user_ideas (
      user_id INTEGER,
      idea_id INTEGER,
      idea_text TEXT,
      feedback TEXT, -- 'like', 'dislike', 'done'
      type TEXT, -- 'romantic' или 'spicy'
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, idea_id)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_user_id ON user_ideas(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_feedback ON user_ideas(feedback)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_timestamp ON user_ideas(timestamp DESC)`);
});

// Сохраняем профиль пользователя
function saveProfile(userId, profile) {
  db.run(
    `INSERT INTO users (id, profile) VALUES (?, ?)
        ON CONFLICT(id) DO UPDATE SET profile = excluded.profile`,
    [userId, profile],
    err => {
      if (err) console.error('Ошибка при сохранении профиля:', err);
    },
  );
}

// Сохраняем язык пользователя
function saveLanguage(userId, language) {
  db.run(
    `INSERT INTO users (id, language) VALUES (?, ?)
        ON CONFLICT(id) DO UPDATE SET language = excluded.language`,
    [userId, language],
    err => {
      if (err) console.error('Ошибка при сохранении языка:', err);
      console.log(`Язык сохранен для пользователя ${userId}: ${language}`);
    },
  );
}

// Получаем язык пользователя
function getLanguage(userId, callback) {
  db.get(`SELECT language FROM users WHERE id = ?`, [userId], (err, row) => {
    if (err) {
      console.error('Ошибка при получении языка:', err);
      callback('en'); // Значение по умолчанию
    } else {
      console.log(`Язык получен для пользователя ${userId}: ${row ? row.language : 'en'}`);
      callback(row ? row.language : 'en');
    }
  });
}

// Получаем всех пользователей
function getAllUsers(callback) {
  db.all(`SELECT id, language FROM users`, (err, rows) => {
    if (err) {
      console.error('Ошибка при получении пользователей:', err);
      callback([]);
    } else {
      callback(rows);
    }
  });
}

// Сохраняем показанную идею и обратную связь
function saveUserIdea(userId, ideaId, ideaText, feedback, type) {
  db.run(
    `INSERT INTO user_ideas (user_id, idea_id, idea_text, feedback, type, timestamp) 
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [userId, ideaId, ideaText, feedback, type],
    err => {
      if (err) console.error('❌ Ошибка при сохранении идеи:', err);
    },
  );
}

// Проверяем, была ли идея уже показана
function wasIdeaShown(userId, ideaId, callback) {
  db.get('SELECT 1 FROM user_ideas WHERE user_id = ? AND idea_id = ?', [userId, ideaId], (err, row) => {
    callback(!!row);
  });
}

// Получаем обратную связь пользователя по конкретному типу идеи
function getUserFeedback(userId, type, callback) {
  db.all(`SELECT idea_text, feedback FROM user_ideas WHERE user_id = ? AND type = ?`, [userId, type], (err, rows) => {
    if (err) {
      console.error('❌ Ошибка при проверке данных в БД:', err);
    } else {
      callback(rows);
    }
  });
}

// Получаем количество дизлайков за сегодня
function getTodayDislikeCount(userId, callback) {
  const today = new Date().toISOString().split('T')[0];
  db.get(
    `SELECT COUNT(*) as count 
     FROM user_ideas 
     WHERE user_id = ? AND feedback = 'dislike' AND DATE(timestamp) = ?`,
    [userId, today],
    (err, row) => {
      if (err) {
        console.error('Ошибка при получении количества дизлайков:', err);
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
  saveUserIdea,
  wasIdeaShown,
  getUserFeedback,
  getTodayDislikeCount,
};
