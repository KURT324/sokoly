#!/bin/bash
# EduPlatform — Первоначальная настройка VDS на reg.ru (Ubuntu 22.04)
#
# Запуск от root:
#   bash setup-server.sh sokolbla.ru https://github.com/ВАШ_АККАУНТ/eduplatform.git
#
# Что делает скрипт:
#   1. Обновляет систему и ставит Docker
#   2. Создаёт пользователя deploy с доступом к Docker
#   3. Ужесточает SSH (запрет root + паролей)
#   4. Настраивает UFW (22, 80, 443)
#   5. Клонирует репозиторий в /app
#   6. Получает SSL-сертификат Let's Encrypt через certbot
#   7. Настраивает cron бэкапа (3:00 ежедневно)
#   8. Собирает и запускает Docker-контейнеры

set -e

DOMAIN="${1:?Использование: $0 <домен> <git-репозиторий>}"
REPO_URL="${2:?Использование: $0 <домен> <git-репозиторий>}"
DEPLOY_USER="deploy"
APP_DIR="/app"

echo "==================================================================="
echo "  EduPlatform — Настройка сервера reg.ru VDS"
echo "  Домен:  $DOMAIN"
echo "  Репо:   $REPO_URL"
echo "==================================================================="

# --- 1. Обновление системы ---
echo ""
echo "==> [1/8] Обновление пакетов Ubuntu..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"
apt-get install -y curl git ufw unzip wget

# Убрать snapd если есть (reg.ru иногда ставит, занимает RAM)
apt-get remove -y snapd --purge 2>/dev/null || true

# --- 2. Docker ---
echo ""
echo "==> [2/8] Установка Docker..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable docker
systemctl start docker

# Проверка Docker Compose plugin
docker compose version || { echo "ОШИБКА: Docker Compose plugin не установился"; exit 1; }

# --- 3. Certbot ---
echo ""
echo "==> [3/8] Установка certbot..."
apt-get install -y certbot

# --- 4. Пользователь deploy ---
echo ""
echo "==> [4/8] Создание пользователя deploy..."
if ! id "$DEPLOY_USER" &>/dev/null; then
  useradd -m -s /bin/bash "$DEPLOY_USER"
fi
usermod -aG docker "$DEPLOY_USER"
usermod -aG sudo "$DEPLOY_USER"

# sudo без пароля для deploy
echo "${DEPLOY_USER} ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/deploy
chmod 440 /etc/sudoers.d/deploy

# Скопировать авторизованные ключи root → deploy (чтобы можно было зайти)
if [ -f /root/.ssh/authorized_keys ]; then
  mkdir -p /home/${DEPLOY_USER}/.ssh
  cp /root/.ssh/authorized_keys /home/${DEPLOY_USER}/.ssh/authorized_keys
  chmod 700 /home/${DEPLOY_USER}/.ssh
  chmod 600 /home/${DEPLOY_USER}/.ssh/authorized_keys
  chown -R "${DEPLOY_USER}:${DEPLOY_USER}" /home/${DEPLOY_USER}/.ssh
  echo "    SSH-ключи root скопированы для пользователя deploy"
fi

# --- 5. Ужесточение SSH ---
echo ""
echo "==> [5/8] Настройка SSH..."
# Отключаем вход root и парольную аутентификацию
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
# Порт оставляем 22 (reg.ru VDS стандартный)
systemctl reload ssh 2>/dev/null || systemctl reload sshd 2>/dev/null || true
echo "    ВНИМАНИЕ: root-вход по SSH теперь отключён."
echo "    Для входа используй: ssh deploy@$DOMAIN"

# --- 6. Файрвол UFW ---
echo ""
echo "==> [6/8] Настройка UFW..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   comment 'SSH'
ufw allow 80/tcp   comment 'HTTP'
ufw allow 443/tcp  comment 'HTTPS'
ufw --force enable
ufw status numbered

# --- 7. Директории и репозиторий ---
echo ""
echo "==> [7/8] Подготовка директорий и клонирование репозитория..."
mkdir -p ${APP_DIR} /backups ${APP_DIR}/storage /var/www/certbot
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" ${APP_DIR} /backups

if [ -d "${APP_DIR}/.git" ]; then
  echo "    Репозиторий уже существует, выполняю git pull..."
  sudo -u "$DEPLOY_USER" git -C ${APP_DIR} pull origin master
else
  sudo -u "$DEPLOY_USER" git clone "$REPO_URL" ${APP_DIR}
fi
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" ${APP_DIR}

# Подставить домен в nginx конфиг и env-шаблон
sed -i "s/YOUR_DOMAIN/${DOMAIN}/g" ${APP_DIR}/nginx/nginx.prod.conf
echo "    Домен $DOMAIN прописан в nginx/nginx.prod.conf"

# Создать .env.production из шаблона с уже подставленным доменом
cp ${APP_DIR}/.env.production.example ${APP_DIR}/.env.production
sed -i "s/YOUR_DOMAIN/${DOMAIN}/g" ${APP_DIR}/.env.production
echo "    Домен $DOMAIN подставлен в .env.production (FRONTEND_URL, COOKIE_DOMAIN)"

# --- .env.production ---
echo ""
echo "==================================================================="
echo "  ДЕЙСТВИЕ ТРЕБУЕТСЯ: заполни оставшиеся секреты в файле окружения"
echo ""
echo "  nano ${APP_DIR}/.env.production"
echo ""
echo "  Обязательно замени:"
echo "    POSTGRES_PASSWORD, REDIS_PASSWORD, JWT_SECRET"
echo "  FRONTEND_URL и COOKIE_DOMAIN уже содержат домен: ${DOMAIN}"
echo ""
echo "  Нажми Enter после того как заполнишь .env.production..."
echo "==================================================================="
read -p ""

# --- 8. SSL-сертификат ---
echo ""
echo "==> [8/8] Получение SSL-сертификата Let's Encrypt для $DOMAIN..."
echo "    (DNS A-запись должна уже указывать на IP этого сервера)"
echo "    Проверка: nslookup $DOMAIN должна вернуть $(hostname -I | awk '{print $1}')"
echo ""
read -p "Нажми Enter для получения сертификата (Ctrl+C — пропустить и сделать вручную): "

certbot certonly --standalone \
  --non-interactive \
  --agree-tos \
  --email "admin@${DOMAIN}" \
  -d "$DOMAIN" \
  -d "www.${DOMAIN}" || {
    echo ""
    echo "  Не удалось получить сертификат автоматически."
    echo "  Получи вручную после запуска:"
    echo "  certbot certonly --standalone -d $DOMAIN -d www.$DOMAIN"
    echo ""
  }

# Автообновление SSL (certbot standalone — нужно остановить nginx)
cat > /etc/cron.d/certbot-renew << EOF
0 2 * * * root docker compose -f ${APP_DIR}/docker-compose.prod.yml stop nginx && certbot renew --standalone --quiet && docker compose -f ${APP_DIR}/docker-compose.prod.yml start nginx
EOF
echo "    Автообновление SSL: ежедневно в 2:00"

# --- Cron бэкапа ---
echo "0 3 * * * ${DEPLOY_USER} /app/scripts/backup.sh >> /var/log/eduplatform-backup.log 2>&1" > /etc/cron.d/eduplatform-backup
chmod +x ${APP_DIR}/scripts/backup.sh
echo "    Бэкап БД: ежедневно в 3:00 → /backups/"

# --- Запуск приложения ---
echo ""
echo "==> Сборка и запуск Docker-контейнеров..."
cd ${APP_DIR}
sudo -u "$DEPLOY_USER" docker compose -f docker-compose.prod.yml build
sudo -u "$DEPLOY_USER" docker compose -f docker-compose.prod.yml up -d

echo ""
echo "==> Ожидание готовности базы данных..."
sleep 10

echo "==> Применение миграций Prisma..."
docker exec eduplatform_backend npx prisma migrate deploy || echo "  (миграции можно применить позже вручную)"

echo ""
echo "==================================================================="
echo "  Установка завершена!"
echo ""
echo "  Сайт:   https://$DOMAIN"
echo "  Статус: docker compose -f ${APP_DIR}/docker-compose.prod.yml ps"
echo "  Логи:   docker compose -f ${APP_DIR}/docker-compose.prod.yml logs -f"
echo ""
echo "  Следующий шаг — добавить GitHub Secrets для автодеплоя:"
echo "  SERVER_HOST  = $(hostname -I | awk '{print $1}')"
echo "  SERVER_USER  = deploy"
echo "  SERVER_SSH_KEY = содержимое ~/.ssh/id_ed25519 (приватный ключ)"
echo "==================================================================="
