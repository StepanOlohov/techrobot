-- =====================================================================
-- Миграция 001 — Блог сообщества с премодерацией
-- =====================================================================
-- Применить:
--   mysql -u techrobot -p techrobot < server/migrations/001_blog.sql
--
-- Или из MySQL CLI:
--   USE techrobot;
--   SOURCE server/migrations/001_blog.sql;
--
-- Применение идемпотентно (CREATE IF NOT EXISTS + проверка колонки).
-- Эти же изменения автоматически выполняются при старте сервера через
-- server/db.js → initTables() — миграция нужна для ручного применения.
-- =====================================================================

USE techrobot;

-- ----------------------------------------
-- 1. users.is_admin (флаг администратора)
-- ----------------------------------------
SET @has_admin := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'users'
    AND COLUMN_NAME  = 'is_admin'
);

SET @sql := IF(
  @has_admin = 0,
  'ALTER TABLE users ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT "users.is_admin уже существует" AS info'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ----------------------------------------
-- 2. blog_posts — пользовательские статьи
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS blog_posts (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  user_id          INT NOT NULL,
  title            VARCHAR(200) NOT NULL,
  cover_url        VARCHAR(500),
  category         VARCHAR(50) NOT NULL,
  excerpt          VARCHAR(500) NOT NULL,
  content          MEDIUMTEXT NOT NULL,
  status           ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  rejection_reason VARCHAR(500),
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at      TIMESTAMP NULL,
  reviewed_by      INT NULL,
  views            INT NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_status      (status),
  INDEX idx_user_status (user_id, status),
  INDEX idx_created     (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------
-- 3. Назначение администратора (раскомментировать и подставить email)
-- ----------------------------------------
-- UPDATE users SET is_admin = 1 WHERE email = 'admin@example.com';
