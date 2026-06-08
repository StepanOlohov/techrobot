/**
 * TECHROBOT — Модуль базы данных
 * Подключение к MySQL, создание таблиц
 */

'use strict';

const mysql = require('mysql2/promise');

// Конфигурация (можно переопределить через переменные окружения)
const DB_CONFIG = {
  host:     process.env.DB_HOST     || 'localhost',
  user:     process.env.DB_USER     || 'techrobot',
  password: process.env.DB_PASSWORD || 'TechRobot2024!',
  database: process.env.DB_NAME     || 'techrobot',
  charset:  'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10
};

let pool;

/**
 * Создаёт пул соединений
 */
async function connect() {
  pool = mysql.createPool(DB_CONFIG);
  // Проверяем подключение
  const conn = await pool.getConnection();
  conn.release();
  console.log('✅ Подключение к MySQL установлено');
  return pool;
}

/**
 * Возвращает пул соединений
 */
function getPool() {
  return pool;
}

/**
 * Создаёт таблицы если их нет
 */
async function initTables() {
  const conn = await pool.getConnection();
  try {
    // Таблица пользователей
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        name       VARCHAR(100) NOT NULL,
        email      VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        avatar     VARCHAR(500) DEFAULT '',
        bio        TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Таблица избранного
    await conn.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        user_id    INT NOT NULL,
        article_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_fav (user_id, article_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Таблица истории просмотров
    await conn.query(`
      CREATE TABLE IF NOT EXISTS view_history (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        user_id    INT NOT NULL,
        article_id INT NOT NULL,
        viewed_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Таблица обращений через форму обратной связи
    await conn.query(`
      CREATE TABLE IF NOT EXISTS contact_messages (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        name       VARCHAR(100) NOT NULL,
        email      VARCHAR(255) NOT NULL,
        subject    VARCHAR(50)  NOT NULL DEFAULT 'other',
        message    TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Миграция: добавить колонку is_admin в users, если её ещё нет.
    // `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` поддерживается не во всех
    // версиях MySQL 8.0, поэтому проверяем через INFORMATION_SCHEMA.
    const [[{ has_admin }]] = await conn.query(`
      SELECT COUNT(*) AS has_admin
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'is_admin'
    `);
    if (!has_admin) {
      await conn.query(`
        ALTER TABLE users
        ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0
      `);
      console.log('🔧 Добавлена колонка users.is_admin');
    }

    // Таблица пользовательских статей (блог сообщества с премодерацией).
    // Категории совпадают с обычными статьями: ai/robotics/iot/vrar/biotech/drones.
    await conn.query(`
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
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_status (status),
        INDEX idx_user_status (user_id, status),
        INDEX idx_created (created_at DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('✅ Таблицы базы данных готовы');
  } finally {
    conn.release();
  }
}

module.exports = { connect, getPool, initTables };
