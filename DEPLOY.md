# EduPlatform — Инструкция по деплою на reg.ru VDS

Домен: **sokolbla.ru** | Хостинг: **reg.ru VDS** | ОС: **Ubuntu 22.04 LTS**

> **Важно**: для работы EduPlatform нужен VDS (виртуальный сервер с root-доступом),
> а не виртуальный хостинг (Host-0/Host-1). На shared-хостинге Docker и Node.js не работают.

---

## Шаг 1 — Заказать VDS на reg.ru

1. Войди в [личный кабинет reg.ru](https://cp.reg.ru)
2. **Виртуальные серверы** → **Заказать VDS**
3. Параметры:

   | Параметр | Значение |
   |---|---|
   | Тариф | **VDS-2** (2 vCPU, 2 GB RAM, 40 GB SSD) — ~490 руб/мес |
   | ОС | **Ubuntu 22.04 LTS** |
   | Панель управления | **Без панели** (ISPmanager не нужен — всё через Docker) |
   | SSH-ключ | Добавь свой публичный ключ (см. ниже) |
   | Расположение | Москва |

   > Если бюджет ограничен, VDS-1 (1 vCPU, 1 GB RAM) тоже подойдёт для старта,
   > но при одновременной работе 20+ студентов лучше VDS-2.

4. После оплаты на почту придёт письмо с **IP-адресом** и **паролем root**
   (или сразу работает SSH-ключ, если добавлял).

### Как добавить SSH-ключ (если ещё нет)

```bash
# На своём компьютере (Windows: запусти в Git Bash или WSL)
ssh-keygen -t ed25519 -C "deploy@sokolbla.ru"
# Нажми Enter трижды (без passphrase)

# Скопируй публичный ключ:
cat ~/.ssh/id_ed25519.pub
```

Вставь содержимое этого файла в поле «SSH-ключ» при заказе VDS.

---

## Шаг 2 — Настроить DNS для sokolbla.ru

Домен уже на reg.ru — настройка в одной панели.

1. Личный кабинет → **Домены** → **sokolbla.ru**
2. **Управление** → **DNS-серверы и управление зоной**
3. **Добавить запись**:

   | Тип | Хост | Значение | TTL |
   |---|---|---|---|
   | A | `@` | `ВАШ_IP_VDS` | 300 |
   | A | `www` | `ВАШ_IP_VDS` | 300 |

4. Сохрани. Распространение DNS: обычно 15–30 минут для reg.ru.

Проверь, что DNS применился:
```bash
# В командной строке на своём компьютере
nslookup sokolbla.ru
# Должен вернуть IP твоего VDS
```

---

## Шаг 3 — Залить код на GitHub

CI/CD работает через GitHub — при пуше в `main` сервер автоматически обновляется.

```bash
# На своём компьютере, в папке проекта
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/ВАШ_АККАУНТ/eduplatform.git
git push -u origin main
```

> Репозиторий может быть приватным — GitHub Actions всё равно будет работать.

---

## Шаг 4 — Подключиться к VDS и запустить установку

```bash
# Подключись к серверу (пароль из письма reg.ru, или по SSH-ключу)
ssh root@ВАШ_IP_VDS
```

Запусти скрипт первоначальной настройки:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/ВАШ_АККАУНТ/eduplatform/main/scripts/setup-server.sh) \
  sokolbla.ru \
  https://github.com/ВАШ_АККАУНТ/eduplatform.git
```

Скрипт автоматически:
- Обновит пакеты Ubuntu
- Установит Docker и Docker Compose plugin
- Установит certbot
- Создаст пользователя `deploy` с доступом к Docker
- Запретит вход под root и парольную аутентификацию по SSH
- Настроит UFW (открыты только порты 22, 80, 443)
- Создаст папки `/app`, `/backups`, `/app/storage`
- Клонирует репозиторий в `/app`
- Получит SSL-сертификат Let's Encrypt для `sokolbla.ru`
- Настроит ежедневный бэкап БД в 3:00
- Запустит все Docker-контейнеры

**Продолжительность**: ~5–10 минут.

---

## Шаг 5 — Создать файл окружения

```bash
cp /app/.env.production.example /app/.env.production
nano /app/.env.production
```

Заполни все переменные. Минимально обязательные:

| Переменная | Что поставить |
|---|---|
| `POSTGRES_PASSWORD` | Придумай сложный пароль (мин. 20 символов) |
| `REDIS_PASSWORD` | Другой сложный пароль |
| `DATABASE_URL` | `postgresql://edu:ТОТ_ЖЕ_POSTGRES_PASSWORD@postgres:5432/eduplatform` |
| `REDIS_URL` | `redis://:ТОТ_ЖЕ_REDIS_PASSWORD@redis:6379` |
| `JWT_SECRET` | Запусти: `openssl rand -base64 64` — вставь результат |
| `FRONTEND_URL` | `https://sokolbla.ru` |
| `COOKIE_DOMAIN` | `sokolbla.ru` |
| `COOKIE_SECURE` | `true` |

Сохрани (`Ctrl+O`, `Enter`, `Ctrl+X`) и перезапусти бэкенд:

```bash
cd /app
docker compose -f docker-compose.prod.yml up -d --no-deps backend
```

---

## Шаг 6 — Проверить, что всё работает

```bash
# Все 5 контейнеров должны быть Up
docker compose -f /app/docker-compose.prod.yml ps

# Проверить HTTPS
curl -I https://sokolbla.ru/health
# Ожидаемый ответ: HTTP/2 200

# Логи в реальном времени
docker compose -f /app/docker-compose.prod.yml logs -f
```

Открой в браузере `https://sokolbla.ru` — должна появиться страница входа.

---

## Шаг 7 — Настроить автодеплой через GitHub Actions

При каждом `git push origin main` сервер автоматически обновится за 2–3 минуты.

### Добавить секреты в GitHub

Перейди в репозиторий → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Секрет | Значение |
|---|---|
| `SERVER_HOST` | IP-адрес твоего VDS (из письма reg.ru) |
| `SERVER_USER` | `deploy` |
| `SERVER_SSH_KEY` | Содержимое файла `~/.ssh/id_ed25519` (приватный ключ) |

> Приватный ключ на Windows: `type %USERPROFILE%\.ssh\id_ed25519`
> На Mac/Linux: `cat ~/.ssh/id_ed25519`
>
> Копируй **весь** текст включая строки `-----BEGIN...` и `-----END...`

### Добавить публичный ключ на сервер

Чтобы GitHub Actions мог заходить под пользователем `deploy`:

```bash
# На сервере (залогинься под deploy или root)
su - deploy
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo "ВСТАВЬ_СЮДА_ПУБЛИЧНЫЙ_КЛЮЧ_id_ed25519.pub" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### Проверить автодеплой

```bash
# На своём компьютере — внеси любое изменение и запушь
git add .
git commit -m "test: trigger auto-deploy"
git push origin main
```

Перейди в GitHub → **Actions** → смотри прогресс деплоя. Через ~2–3 минуты изменение будет на `sokolbla.ru`.

---

## Финальный чеклист

| # | Проверка |
|---|---|
| 1 | `https://sokolbla.ru` открывается без ошибок SSL |
| 2 | Вход как admin — все разделы работают |
| 3 | Вход как teacher — доступны Тесты, Карточки, Аналитика |
| 4 | Вход как student — нет доступа к admin-разделам |
| 5 | Водяной знак на PDF с ФИО и датой |
| 6 | ПКМ и Ctrl+S заблокированы на PDF |
| 7 | Тест с автопроверкой показывает результат сразу |
| 8 | Canvas-рисование работает в тесте и карточке |
| 9 | Цикл карточки: назначить → нарисовать → проверить |
| 10 | Чат: сообщение приходит без перезагрузки страницы |
| 11 | Браузерное уведомление при открытии нового дня |
| 12 | Аналитика показывает реальные данные |
| 13 | Push в main → автодеплой за 2–3 минуты |
| 14 | `/backups/` содержит файл `backup_*.sql.gz` |

---

## Управление сервером

### Ручной бэкап
```bash
bash /app/scripts/backup.sh
ls -lh /backups/
```

### Миграции БД вручную
```bash
docker exec eduplatform_backend npx prisma migrate deploy
```

### Логи сервисов
```bash
docker compose -f /app/docker-compose.prod.yml logs -f backend
docker compose -f /app/docker-compose.prod.yml logs -f nginx
```

### Перезапуск одного сервиса
```bash
docker compose -f /app/docker-compose.prod.yml restart backend
```

### Обновление SSL вручную
```bash
# Останови nginx, обнови сертификат, запусти обратно
docker compose -f /app/docker-compose.prod.yml stop nginx
certbot renew --standalone
docker compose -f /app/docker-compose.prod.yml start nginx
```

### Полный перезапуск
```bash
cd /app
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

### Обновить приложение вручную (без GitHub Actions)
```bash
cd /app
git pull origin main
docker compose -f docker-compose.prod.yml build --no-cache backend frontend
docker compose -f docker-compose.prod.yml up -d --no-deps backend frontend
docker exec eduplatform_backend npx prisma migrate deploy
docker image prune -f
```

---

## Стоимость в месяц

| Ресурс | Стоимость |
|---|---|
| reg.ru VDS-2 (2 vCPU, 2 GB RAM) | ~490 руб/мес |
| Домен sokolbla.ru (уже оплачен) | — |
| SSL (Let's Encrypt) | **Бесплатно** |
| **Итого** | **~490 руб/мес** |
