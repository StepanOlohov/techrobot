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

    console.log('✅ Таблицы базы данных готовы');
  } finally {
    conn.release();
  }
}

module.exports = { connect, getPool, initTables };
