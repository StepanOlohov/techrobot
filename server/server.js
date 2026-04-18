/**
 * TECHROBOT — REST API сервер
 * Express + MySQL + bcrypt + JWT
 *
 * Эндпоинты:
 *   POST   /api/register           — регистрация
 *   POST   /api/login              — вход
 *   GET    /api/me                 — текущий пользователь (проверка токена)
 *   PUT    /api/profile            — обновление профиля
 *   POST   /api/favorites/:id      — добавить / убрать из избранного
 *   POST   /api/history/:id        — добавить в историю просмотров
 *   DELETE /api/history             — очистить историю
 */

'use strict';

const express  = require('express');
const cors     = require('cors');
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const db       = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

// Секрет для JWT (в продакшене — через переменную окружения)
const JWT_SECRET     = process.env.JWT_SECRET || 'TechRobot_JWT_Secret_2024!';
const JWT_EXPIRES_IN = '7d';
const BCRYPT_ROUNDS  = 10;

/* =============================================
   Middleware
   ============================================= */
app.use(cors());
app.use(express.json());

/**
 * Middleware проверки JWT-токена
 */
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Не авторизован' });
  }

  try {
    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Токен недействителен' });
  }
}

/* =============================================
   Хелпер: собрать полные данные пользователя
   ============================================= */

/**
 * Возвращает объект пользователя с избранным и историей
 * @param {number} userId
 * @returns {Object|null}
 */
async function getUserData(userId) {
  const pool = db.getPool();

  const [[user]] = await pool.query(
    'SELECT id, name, email, avatar, bio, created_at FROM users WHERE id = ?',
    [userId]
  );
  if (!user) return null;

  // Избранные статьи (массив ID)
  const [favRows] = await pool.query(
    'SELECT article_id FROM favorites WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );

  // История просмотров (последние 50, массив ID)
  const [histRows] = await pool.query(
    'SELECT article_id FROM view_history WHERE user_id = ? ORDER BY viewed_at DESC LIMIT 50',
    [userId]
  );

  return {
    id:           user.id,
    name:         user.name,
    email:        user.email,
    avatar:       user.avatar || '',
    bio:          user.bio || '',
    registeredAt: user.created_at,
    favorites:    favRows.map(r => r.article_id),
    history:      histRows.map(r => r.article_id)
  };
}

/* =============================================
   POST /api/register — Регистрация
   ============================================= */
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Валидация
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Заполните все поля' });
    }
    if (name.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Имя должно содержать не менее 2 символов' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Введите корректный email' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Пароль должен содержать не менее 6 символов' });
    }

    const pool = db.getPool();

    // Проверяем уникальность email
    const [[existing]] = await pool.query(
      'SELECT id FROM users WHERE email = ?', [email.toLowerCase()]
    );
    if (existing) {
      return res.status(409).json({ success: false, message: 'Пользователь с таким email уже существует' });
    }

    // Хешируем пароль через bcrypt
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Создаём запись
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name.trim(), email.toLowerCase().trim(), passwordHash]
    );

    // Генерируем JWT
    const token = jwt.sign({ userId: result.insertId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const userData = await getUserData(result.insertId);

    res.status(201).json({ success: true, message: 'Регистрация успешна!', token, user: userData });

  } catch (err) {
    console.error('Ошибка регистрации:', err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/* =============================================
   POST /api/login — Вход
   ============================================= */
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Введите email и пароль' });
    }

    const pool = db.getPool();
    const [[user]] = await pool.query(
      'SELECT id, password_hash FROM users WHERE email = ?',
      [email.toLowerCase()]
    );

    if (!user) {
      return res.status(401).json({ success: false, message: 'Пользователь не найден' });
    }

    // Сравниваем пароль
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Неверный пароль' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const userData = await getUserData(user.id);

    res.json({ success: true, message: `Добро пожаловать, ${userData.name}!`, token, user: userData });

  } catch (err) {
    console.error('Ошибка входа:', err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/* =============================================
   GET /api/me — Текущий пользователь
   ============================================= */
app.get('/api/me', auth, async (req, res) => {
  try {
    const userData = await getUserData(req.userId);
    if (!userData) {
      return res.status(404).json({ success: false, message: 'Пользователь не найден' });
    }
    res.json({ success: true, user: userData });
  } catch (err) {
    console.error('Ошибка /api/me:', err);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

/* =============================================
   PUT /api/profile — Обновление профиля
   ============================================= */
app.put('/api/profile', auth, async (req, res) => {
  try {
    const { name, bio, avatar } = req.body;
    const pool = db.getPool();

    const fields = [];
    const values = [];

    if (name && name.trim().length >= 2) { fields.push('name = ?');   values.push(name.trim()); }
    if (bio !== undefined)               { fields.push('bio = ?');    values.push(bio.trim());  }
    if (avatar !== undefined)            { fields.push('avatar = ?'); values.push(avatar);      }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'Нечего обновлять' });
    }

    values.push(req.userId);
    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);

    const userData = await getUserData(req.userId);
    res.json({ success: true, message: 'Профиль обновлён', user: userData });

  } catch (err) {
    console.error('Ошибка обновления профиля:', err);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

/* =============================================
   POST /api/favorites/:articleId — Переключить избранное
   ============================================= */
app.post('/api/favorites/:articleId', auth, async (req, res) => {
  try {
    const articleId = parseInt(req.params.articleId, 10);
    const pool = db.getPool();

    // Проверяем, есть ли запись
    const [[existing]] = await pool.query(
      'SELECT id FROM favorites WHERE user_id = ? AND article_id = ?',
      [req.userId, articleId]
    );

    let added;
    if (existing) {
      await pool.query('DELETE FROM favorites WHERE id = ?', [existing.id]);
      added = false;
    } else {
      await pool.query(
        'INSERT INTO favorites (user_id, article_id) VALUES (?, ?)',
        [req.userId, articleId]
      );
      added = true;
    }

    res.json({ success: true, added });

  } catch (err) {
    console.error('Ошибка избранного:', err);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

/* =============================================
   POST /api/history/:articleId — Добавить в историю
   ============================================= */
app.post('/api/history/:articleId', auth, async (req, res) => {
  try {
    const articleId = parseInt(req.params.articleId, 10);
    const pool = db.getPool();

    // Удаляем старую запись (чтобы переместить наверх)
    await pool.query(
      'DELETE FROM view_history WHERE user_id = ? AND article_id = ?',
      [req.userId, articleId]
    );

    // Вставляем новую
    await pool.query(
      'INSERT INTO view_history (user_id, article_id) VALUES (?, ?)',
      [req.userId, articleId]
    );

    res.json({ success: true });

  } catch (err) {
    console.error('Ошибка истории:', err);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

/* =============================================
   DELETE /api/history — Очистить историю
   ============================================= */
app.delete('/api/history', auth, async (req, res) => {
  try {
    const pool = db.getPool();
    await pool.query('DELETE FROM view_history WHERE user_id = ?', [req.userId]);
    res.json({ success: true, message: 'История очищена' });
  } catch (err) {
    console.error('Ошибка очистки истории:', err);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

/* =============================================
   Запуск сервера
   ============================================= */
async function start() {
  try {
    await db.connect();
    await db.initTables();

    app.listen(PORT, () => {
      console.log(`🚀 TechRobot API запущен: http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Не удалось запустить сервер:', err);
    process.exit(1);
  }
}

start();
