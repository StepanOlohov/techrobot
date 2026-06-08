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
 *   POST   /api/contact            — форма обратной связи
 */

'use strict';

const express      = require('express');
const cors         = require('cors');
const bcrypt       = require('bcrypt');
const jwt          = require('jsonwebtoken');
const sanitizeHtml = require('sanitize-html');
const rateLimit    = require('express-rate-limit');
const db           = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

// Секрет для JWT (в продакшене — через переменную окружения)
const JWT_SECRET     = process.env.JWT_SECRET || 'TechRobot_JWT_Secret_2024!';
const JWT_EXPIRES_IN = '7d';
const BCRYPT_ROUNDS  = 10;

// Доступные категории для статей блога (совпадают с data/articles.json).
const BLOG_CATEGORIES = ['ai', 'robotics', 'iot', 'vrar', 'biotech', 'drones'];

// Whitelist HTML-тегов для контента блог-постов.
const SANITIZE_OPTIONS = {
  allowedTags: [
    'p', 'h2', 'h3', 'h4', 'strong', 'em', 'u', 'a',
    'ul', 'ol', 'li', 'img', 'code', 'pre', 'blockquote', 'br'
  ],
  allowedAttributes: {
    a:   ['href', 'class'],
    img: ['src', 'alt', 'class'],
    '*': ['class']
  },
  allowedSchemes: ['http', 'https'],
  allowedSchemesByTag: { img: ['https'] },
  // Удаляет вложенный контент <script>/<style> вместе с тегом
  disallowedTagsMode: 'discard'
};

/* =============================================
   Middleware
   ============================================= */
app.use(cors());
app.use(express.json({ limit: '1mb' })); // под MEDIUMTEXT с запасом

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

/**
 * Middleware проверки прав администратора.
 * Выполняется ПОСЛЕ auth (req.userId должен быть установлен).
 */
async function requireAdmin(req, res, next) {
  try {
    const pool = db.getPool();
    const [[user]] = await pool.query(
      'SELECT is_admin FROM users WHERE id = ?', [req.userId]
    );
    if (!user || !user.is_admin) {
      return res.status(403).json({ success: false, message: 'Доступ запрещён' });
    }
    next();
  } catch (err) {
    console.error('Ошибка requireAdmin:', err);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
}

/**
 * Rate limit: не более 5 публикаций в час с одного пользователя.
 * Ключом служит userId (а не IP — пользователи могут быть за общим NAT).
 */
const blogCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `user:${req.userId || req.ip}`,
  message: { success: false, message: 'Слишком много публикаций. Повторите попытку через час.' }
});

/**
 * Валидация тела блог-поста (для create/update).
 * Возвращает { ok, errors, data } где data — очищенные поля.
 */
function validateBlogPayload(body) {
  const errors = [];
  const title    = (body.title    || '').trim();
  const category = (body.category || '').trim();
  const excerpt  = (body.excerpt  || '').trim();
  const content  = (body.content  || '').trim();
  const coverUrl = (body.cover_url || '').trim();

  if (title.length < 5 || title.length > 200) {
    errors.push('Заголовок: 5–200 символов');
  }
  if (!BLOG_CATEGORIES.includes(category)) {
    errors.push('Категория должна быть одной из: ' + BLOG_CATEGORIES.join(', '));
  }
  if (excerpt.length < 20 || excerpt.length > 500) {
    errors.push('Краткое описание: 20–500 символов');
  }
  if (content.length < 100 || content.length > 50000) {
    errors.push('Контент: 100–50000 символов');
  }
  if (coverUrl && !/^https:\/\/\S+$/i.test(coverUrl)) {
    errors.push('Ссылка на обложку должна начинаться с https://');
  }

  return {
    ok: errors.length === 0,
    errors,
    data: {
      title, category, excerpt,
      content:   sanitizeHtml(content, SANITIZE_OPTIONS),
      cover_url: coverUrl || null
    }
  };
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
    'SELECT id, name, email, avatar, bio, is_admin, created_at FROM users WHERE id = ?',
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
    isAdmin:      Boolean(user.is_admin),
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
   POST /api/contact — Форма обратной связи
   ============================================= */
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: 'Заполните обязательные поля' });
    }
    if (name.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Имя должно содержать не менее 2 символов' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Введите корректный email' });
    }
    if (message.trim().length < 10) {
      return res.status(400).json({ success: false, message: 'Сообщение должно содержать не менее 10 символов' });
    }
    if (message.length > 1000) {
      return res.status(400).json({ success: false, message: 'Сообщение слишком длинное (макс. 1000 символов)' });
    }

    const allowedSubjects = ['question', 'suggestion', 'error', 'cooperation', 'other'];
    const safeSubject = allowedSubjects.includes(subject) ? subject : 'other';

    const pool = db.getPool();
    await pool.query(
      'INSERT INTO contact_messages (name, email, subject, message) VALUES (?, ?, ?, ?)',
      [name.trim(), email.toLowerCase().trim(), safeSubject, message.trim()]
    );

    res.status(201).json({ success: true, message: 'Сообщение отправлено' });

  } catch (err) {
    console.error('Ошибка /api/contact:', err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/* =============================================
   БЛОГ СООБЩЕСТВА с премодерацией
   =============================================
   Порядок маршрутов важен: статические сегменты (/my, /pending)
   объявляются ДО параметризованных (/:id), иначе Express попытается
   распарсить "my" как :id.
   ============================================= */

const BLOG_SELECT_BASE = `
  SELECT bp.id, bp.user_id, bp.title, bp.cover_url, bp.category,
         bp.excerpt, bp.content, bp.status, bp.rejection_reason,
         bp.created_at, bp.reviewed_at, bp.views,
         u.name AS author_name, u.avatar AS author_avatar
  FROM blog_posts bp
  JOIN users u ON bp.user_id = u.id
`;

/* GET /api/blog/my — свои статьи всех статусов (для личного кабинета).
   ВАЖНО: объявлен до /api/blog/:id чтобы "my" не парсился как id. */
app.get('/api/blog/my', auth, async (req, res) => {
  try {
    const pool = db.getPool();
    const [rows] = await pool.query(
      `${BLOG_SELECT_BASE}
       WHERE bp.user_id = ?
       ORDER BY bp.created_at DESC`,
      [req.userId]
    );
    res.json({ success: true, posts: rows });
  } catch (err) {
    console.error('Ошибка /api/blog/my:', err);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

/* GET /api/admin/blog/pending — очередь модерации (старые первыми). */
app.get('/api/admin/blog/pending', auth, requireAdmin, async (req, res) => {
  try {
    const pool = db.getPool();
    const [rows] = await pool.query(
      `${BLOG_SELECT_BASE}
       WHERE bp.status = 'pending'
       ORDER BY bp.created_at ASC`
    );
    res.json({ success: true, posts: rows });
  } catch (err) {
    console.error('Ошибка /api/admin/blog/pending:', err);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

/* GET /api/blog — публичный список одобренных, пагинация. */
app.get('/api/blog', async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const offset = (page - 1) * limit;
    const category = req.query.category;

    const where  = ["bp.status = 'approved'"];
    const params = [];

    if (category && BLOG_CATEGORIES.includes(category)) {
      where.push('bp.category = ?');
      params.push(category);
    }

    const pool = db.getPool();

    // Общее количество — для пагинации
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM blog_posts bp WHERE ${where.join(' AND ')}`,
      params
    );

    const [rows] = await pool.query(
      `${BLOG_SELECT_BASE}
       WHERE ${where.join(' AND ')}
       ORDER BY bp.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      posts: rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error('Ошибка /api/blog:', err);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

/* POST /api/blog — создать черновик (rate-limited, 5/час). */
app.post('/api/blog', auth, blogCreateLimiter, async (req, res) => {
  try {
    const { ok, errors, data } = validateBlogPayload(req.body);
    if (!ok) {
      return res.status(400).json({ success: false, message: errors.join('. ') });
    }

    const pool = db.getPool();
    const [result] = await pool.query(
      `INSERT INTO blog_posts (user_id, title, cover_url, category, excerpt, content, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [req.userId, data.title, data.cover_url, data.category, data.excerpt, data.content]
    );

    res.status(201).json({
      success: true,
      message: 'Статья отправлена на модерацию',
      postId: result.insertId
    });
  } catch (err) {
    console.error('Ошибка POST /api/blog:', err);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

/* GET /api/blog/:id — одна статья. Видна публично если approved,
   автору на любом статусе, админу — любая. Инкремент views только для approved. */
app.get('/api/blog/:id', async (req, res) => {
  try {
    const postId = parseInt(req.params.id, 10);
    if (!postId) return res.status(400).json({ success: false, message: 'Неверный ID' });

    const pool = db.getPool();
    const [[post]] = await pool.query(
      `${BLOG_SELECT_BASE} WHERE bp.id = ?`,
      [postId]
    );
    if (!post) return res.status(404).json({ success: false, message: 'Статья не найдена' });

    // Если не approved — проверяем что зашёл автор или админ
    if (post.status !== 'approved') {
      const header = req.headers.authorization;
      let viewerId = null, viewerIsAdmin = false;
      if (header && header.startsWith('Bearer ')) {
        try {
          const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
          viewerId = decoded.userId;
          const [[u]] = await pool.query('SELECT is_admin FROM users WHERE id = ?', [viewerId]);
          viewerIsAdmin = u && u.is_admin === 1;
        } catch { /* invalid token */ }
      }
      if (viewerId !== post.user_id && !viewerIsAdmin) {
        return res.status(404).json({ success: false, message: 'Статья не найдена' });
      }
    } else {
      // approved — инкремент просмотров
      await pool.query('UPDATE blog_posts SET views = views + 1 WHERE id = ?', [postId]);
      post.views += 1;
    }

    res.json({ success: true, post });
  } catch (err) {
    console.error('Ошибка GET /api/blog/:id:', err);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

/* PUT /api/blog/:id — автор редактирует свою статью (pending/rejected).
   После редактирования статус сбрасывается в pending для повторной модерации. */
app.put('/api/blog/:id', auth, async (req, res) => {
  try {
    const postId = parseInt(req.params.id, 10);
    if (!postId) return res.status(400).json({ success: false, message: 'Неверный ID' });

    const pool = db.getPool();
    const [[post]] = await pool.query(
      'SELECT user_id, status FROM blog_posts WHERE id = ?',
      [postId]
    );
    if (!post) return res.status(404).json({ success: false, message: 'Статья не найдена' });
    if (post.user_id !== req.userId) {
      return res.status(403).json({ success: false, message: 'Это не ваша статья' });
    }
    if (post.status === 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Опубликованную статью изменить нельзя — удалите и создайте новую'
      });
    }

    const { ok, errors, data } = validateBlogPayload(req.body);
    if (!ok) {
      return res.status(400).json({ success: false, message: errors.join('. ') });
    }

    await pool.query(
      `UPDATE blog_posts
       SET title=?, cover_url=?, category=?, excerpt=?, content=?,
           status='pending', rejection_reason=NULL, reviewed_at=NULL, reviewed_by=NULL
       WHERE id = ?`,
      [data.title, data.cover_url, data.category, data.excerpt, data.content, postId]
    );

    res.json({ success: true, message: 'Статья обновлена и отправлена на модерацию' });
  } catch (err) {
    console.error('Ошибка PUT /api/blog/:id:', err);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

/* DELETE /api/blog/:id — удалить (автор или админ). */
app.delete('/api/blog/:id', auth, async (req, res) => {
  try {
    const postId = parseInt(req.params.id, 10);
    if (!postId) return res.status(400).json({ success: false, message: 'Неверный ID' });

    const pool = db.getPool();
    const [[post]] = await pool.query(
      'SELECT user_id FROM blog_posts WHERE id = ?', [postId]
    );
    if (!post) return res.status(404).json({ success: false, message: 'Статья не найдена' });

    const [[me]] = await pool.query('SELECT is_admin FROM users WHERE id = ?', [req.userId]);
    const isAdmin = me && me.is_admin === 1;

    if (post.user_id !== req.userId && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Нет прав на удаление' });
    }

    await pool.query('DELETE FROM blog_posts WHERE id = ?', [postId]);
    res.json({ success: true, message: 'Статья удалена' });
  } catch (err) {
    console.error('Ошибка DELETE /api/blog/:id:', err);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

/* POST /api/admin/blog/:id/review — одобрить или отклонить. */
app.post('/api/admin/blog/:id/review', auth, requireAdmin, async (req, res) => {
  try {
    const postId = parseInt(req.params.id, 10);
    if (!postId) return res.status(400).json({ success: false, message: 'Неверный ID' });

    const { action, reason } = req.body || {};
    if (action !== 'approve' && action !== 'reject') {
      return res.status(400).json({ success: false, message: 'action должно быть approve или reject' });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    let rejectionReason = null;

    if (action === 'reject') {
      rejectionReason = (reason || '').trim();
      if (rejectionReason.length < 5 || rejectionReason.length > 500) {
        return res.status(400).json({
          success: false,
          message: 'Причина отклонения: 5–500 символов'
        });
      }
    }

    const pool = db.getPool();
    const [result] = await pool.query(
      `UPDATE blog_posts
       SET status = ?, rejection_reason = ?, reviewed_at = NOW(), reviewed_by = ?
       WHERE id = ?`,
      [newStatus, rejectionReason, req.userId, postId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Статья не найдена' });
    }

    res.json({
      success: true,
      message: action === 'approve' ? 'Статья одобрена' : 'Статья отклонена'
    });
  } catch (err) {
    console.error('Ошибка /api/admin/blog/:id/review:', err);
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
