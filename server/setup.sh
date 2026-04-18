#!/bin/bash
# =============================================
# TECHROBOT — Скрипт установки на VPS (Ubuntu)
# Запуск: bash setup.sh
# =============================================

set -e

echo "🚀 Установка TechRobot..."

# 1. Обновление системы
echo "📦 Обновление пакетов..."
apt update && apt upgrade -y

# 2. Установка Nginx
echo "📦 Установка Nginx..."
apt install -y nginx
systemctl enable nginx

# 3. Установка Node.js 20.x
echo "📦 Установка Node.js..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"

# 4. Установка MySQL
echo "📦 Установка MySQL..."
apt install -y mysql-server
systemctl enable mysql
systemctl start mysql

# 5. Создание базы данных и пользователя
echo "🗄️ Настройка базы данных..."
mysql -u root <<EOF
CREATE DATABASE IF NOT EXISTS techrobot
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'techrobot'@'localhost'
  IDENTIFIED BY 'TechRobot2024!';

GRANT ALL PRIVILEGES ON techrobot.* TO 'techrobot'@'localhost';
FLUSH PRIVILEGES;
EOF
echo "✅ База данных techrobot создана"

# 6. Установка PM2 (менеджер процессов)
echo "📦 Установка PM2..."
npm install -g pm2

# 7. Установка npm-зависимостей сервера
echo "📦 Установка зависимостей API..."
cd /var/www/html/server
npm install

# 8. Запуск API через PM2
echo "🚀 Запуск API-сервера..."
pm2 stop techrobot 2>/dev/null || true
pm2 start server.js --name techrobot
pm2 save
pm2 startup

# 9. Настройка Nginx
echo "⚙️ Настройка Nginx..."
cat > /etc/nginx/sites-available/techrobot <<'NGINX'
server {
    listen 80;
    server_name _;

    root /var/www/html;
    index index.html;

    # Статические файлы сайта
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Проксирование API на Node.js
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Кэширование статики
    location ~* \.(css|js|json|jpg|jpeg|png|gif|svg|ico|woff2?)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
NGINX

# Активируем конфиг
ln -sf /etc/nginx/sites-available/techrobot /etc/nginx/sites-enabled/techrobot
rm -f /etc/nginx/sites-enabled/default

# Проверяем и перезапускаем Nginx
nginx -t && systemctl reload nginx

echo ""
echo "============================================="
echo "✅ Установка завершена!"
echo "============================================="
echo ""
echo "  Сайт:  http://$(hostname -I | awk '{print $1}')"
echo "  API:   http://$(hostname -I | awk '{print $1}')/api/"
echo ""
echo "  PM2 статус:  pm2 status"
echo "  PM2 логи:    pm2 logs techrobot"
echo "  Nginx логи:  tail -f /var/log/nginx/error.log"
echo ""
echo "⚠️  Не забудьте сменить пароль root: passwd"
echo "============================================="
