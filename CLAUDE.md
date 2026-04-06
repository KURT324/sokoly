# CLAUDE.md — EduPlatform

## Проект

**Название:** EduPlatform  
**Назначение:** Закрытая образовательная платформа для авиационных курсантов. Поддерживает три роли: администратор, преподаватель, курсант. Вся работа ведётся через браузер.  
**Домен:** sokolbla.ru  
**Сервер:** 194.67.122.181

---

## Стек

| Слой | Технологии |
|------|-----------|
| Frontend | React 18, Vite, TypeScript, TailwindCSS v4, React Router v6 |
| Backend | Fastify, TypeScript, Prisma ORM |
| БД | PostgreSQL 16 |
| Кэш/сессии | Redis 7 |
| Реального времени | Socket.IO |
| Инфра | Docker Compose, nginx, Let's Encrypt |
| Монорепо | npm workspaces (`apps/backend`, `apps/frontend`, `packages/shared`) |

---

## Структура монорепо

```
/
├── apps/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── index.ts              # точка входа, регистрация маршрутов, Socket.IO
│   │   │   ├── db.ts                 # Prisma client singleton
│   │   │   ├── middleware/authGuard.ts
│   │   │   ├── socket.ts             # Socket.IO handlers
│   │   │   ├── services/
│   │   │   │   ├── watermark.ts      # наложение водяных знаков на PDF/изображения
│   │   │   │   └── docxParser.ts     # парсинг .docx в вопросы теста
│   │   │   └── routes/
│   │   │       ├── auth/             # /api/auth
│   │   │       ├── admin/users.ts    # /api/admin/users
│   │   │       ├── admin/cohorts.ts  # /api/admin/cohorts
│   │   │       ├── cohorts.ts        # /api/cohorts
│   │   │       ├── days/             # /api/days (материалы, просмотр)
│   │   │       ├── tests/            # /api/tests
│   │   │       ├── materials/        # /api/materials (публичная отдача файлов)
│   │   │       ├── material-library/ # /api/material-library
│   │   │       ├── card-tasks/       # /api/card-tasks
│   │   │       ├── card-folders/     # /api/card-folders
│   │   │       ├── analytics/        # /api/analytics
│   │   │       ├── chats/            # /api/chats
│   │   │       └── direct-chats/     # /api/direct-chats
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/           # SQL-файлы, применяются через prisma db push
│   │   ├── Dockerfile                # production multi-stage build
│   │   └── Dockerfile.dev
│   └── frontend/
│       ├── src/
│       │   ├── api/                  # axios клиенты (tests.ts, days.ts, ...)
│       │   ├── components/Layout.tsx # общий layout с навигацией (mobile hamburger)
│       │   └── pages/
│       │       ├── admin/            # Dashboard, Cohorts, Users, Analytics
│       │       ├── teacher/          # Dashboard, Days, DayDetail, Tests, TestCreate,
│       │       │                     # TestResults, Students, Analytics, Cards, MaterialLibrary,
│       │       │                     # DirectChatsPage (личные сообщения инструктора)
│       │       ├── student/          # Dashboard, DayDetail, TestPage, Cards
│       │       ├── chat/             # AdminChat, GroupChat, TeacherChat
│       │       ├── LoginPage.tsx
│       │       └── ChangePasswordPage.tsx
│       ├── Dockerfile
│       └── Dockerfile.dev
├── packages/shared/                  # общие типы (если используются)
├── nginx/
│   ├── nginx.conf                    # dev
│   └── nginx.prod.conf               # production (HTTPS, ^~ /api/, socket.io)
├── docker-compose.yml                # dev (hot reload, порты 3000/5173 наружу)
├── docker-compose.prod.yml           # production
└── CLAUDE.md                         # этот файл
```

---

## Реализованные функции

### Аутентификация
- Вход по email/паролю → JWT в httpOnly cookie (7 дней)
- Выход (clear cookie)
- Смена пароля: принудительная при первом входе (`must_change_password`), добровольная с проверкой старого
- `GET /api/auth/me` — текущий пользователь

### Администратор
- **Пользователи** — CRUD: создание с автогенерацией `watermark_id` для курсантов; активация/деактивация; удаление с каскадным удалением всех данных через транзакцию
- **Группы (Cohort)** — создание (автосоздаёт 11 дней + 3 чата), удаление с полным каскадом (chat → card → test → material → day → users → cohort)
- **Аналитика** — обзор всех групп, CSV-экспорт (`/api/analytics/export`)

### Преподаватель
- **Дни** — список дней по группе; открыть/закрыть день (LOCKED↔OPEN) с уведомлением курсантов через Socket.IO (`day:opened` / `day:closed`). Статус ARCHIVED заблокирован от переключения. История открытий/закрытий отображается на странице дня (`GET /api/days/:id/activity`)
- **Материалы дня** — загрузка PDF/DOC/DOCX/изображений/видео/ссылок; удаление; предпросмотр прямо на странице (inline для DOC через mammoth, video player, кнопка открыть в новой вкладке для PDF на мобильном)
- **Библиотека материалов** — хранилище файлов независимо от дней; прикрепление к дням (`/attach`); предпросмотр
- **Тесты** — создание с вариантами, вопросами (SINGLE/MULTIPLE/OPEN_TEXT/DRAWING), назначением вариантов курсантам, лимитом времени; редактирование; удаление; открыть/закрыть тест (`is_open`); просмотр результатов; ручная оценка. История открытий/закрытий доступна через кнопку «История» в таблице тестов (`GET /api/tests/:id/activity`)
- **Импорт тестов из .docx** — парсинг Word-шаблона в массив вопросов
- **Карточки (задания)** — библиотека карточек с изображениями и инструкциями; папки для организации; назначение курсантам; проверка попыток (PENDING → AWAITING_REVIEW → COMPLETED/RETURNED)
- **Курсанты** — список курсантов группы со статистикой (тесты сданы, карточки выполнены, последний вход)
- **Аналитика** — таблица результатов тестов по группе (оценки в формате "X из Y"); таблица прогресса по карточкам (% с первой попытки, среднее попыток)
- **Чат** — список всех чатов всех групп; отправка сообщений (текст + файлы до 10 МБ); пагинация истории; отметка прочитанных
- **Личные сообщения** (`/direct-chats`) — текстовый чат между инструкторами/администраторами. Real-time через Socket.IO (`direct:message`). Личные комнаты: `user:<id>`

### Курсант
- **Дашборд** — карта дней (сетка), список доступных тестов, список карточек
- **День** — просмотр материалов открытого дня с водяными знаками (PDF/изображения). Видео стримится с Range requests. DOC конвертируется в HTML на лету. На мобильном PDF открывается в новой вкладке
- **Тест** — прохождение назначенного варианта (таймер, canvas для drawing-вопросов), показ результата сразу если `show_result_immediately`
- **Карточки** — просмотр заданий, отправка аннотации с комментарием, история попыток
- **Чат** — GROUP (общий чат группы), STUDENT_TEACHER, STUDENT_ADMIN

### Прочее
- Водяные знаки на PDF и изображениях при просмотре курсантом (`callsign` + `watermark_id`)
- Socket.IO: real-time чат (`chat:message`), уведомления об открытии/закрытии дней
- Rate limiting на логин (10 req/min)
- Публичные эндпоинты для файлов `/api/materials/file/:filename` и `/api/materials/view/:materialId` — без авторизации, для iframe/video

---

## База данных

### Модели

| Модель | Описание |
|--------|----------|
| `User` | Пользователи (ADMIN/TEACHER/STUDENT). Курсант имеет `cohort_id` и `watermark_id` |
| `Cohort` | Учебная группа (`is_active`, `started_at`) |
| `Day` | День обучения в группе. Статус: LOCKED/OPEN/ARCHIVED |
| `Material` | Материал привязан к `Day`. Типы: PDF/DOC/IMAGE/VIDEO/LINK |
| `MaterialLibrary` | Библиотека материалов (без привязки к дню, может иметь `folder`) |
| `Test` | Тест: `is_open` (виден ли курсантам), `time_limit_min`, `show_result_immediately` |
| `TestVariant` | Вариант теста (cascade от Test) |
| `TestVariantAssignment` | Назначение варианта конкретному курсанту (unique: test+student) |
| `TestQuestion` | Вопрос: SINGLE/MULTIPLE/OPEN_TEXT/DRAWING, `image_path` |
| `TestAnswer` | Вариант ответа с `is_correct` |
| `TestSubmission` | Ответы курсанта, `auto_score` (% от SINGLE/MULTIPLE), `manual_score` |
| `CardFolder` | Папка библиотеки карточек |
| `CardLibrary` | Карточка-шаблон с изображением и инструкцией |
| `CardTask` | Задание курсанту. Статус: PENDING/AWAITING_REVIEW/RETURNED/COMPLETED |
| `CardAttempt` | Попытка курсанта: annotated image + комментарии + `is_correct` |
| `ActivityLog` | Лог открытий/закрытий дней и тестов: `entity_type` (DAY/TEST), `entity_id`, `action` (OPENED/CLOSED), `actor_id` |
| `Chat` | Чат группы (GROUP/STUDENT_TEACHER/STUDENT_ADMIN) |
| `ChatMessage` | Сообщение с `attachments_json` |
| `DirectChat` | Личный чат между двумя инструкторами/админами. `@@unique([user1_id, user2_id])`, пара нормализована через `.sort()` |
| `DirectMessage` | Сообщение в личном чате. `is_read`, cascade от DirectChat |

### Ключевые связи
- `User → Cohort` (M:1, nullable для ADMIN/TEACHER)
- `Day → Cohort` (M:1)
- `Material → Day` (M:1); `Material → MaterialLibrary` (M:1, nullable)
- `Test → Cohort`, `Test → Day` (nullable)
- `TestVariant → Test` (cascade delete)
- `TestQuestion → TestVariant` (cascade), `TestAnswer → TestQuestion` (cascade)
- `TestVariantAssignment` — unique(test_id, student_id)
- `TestSubmission` — unique(test_id, student_id); нет cascade от Test (намеренно)
- `CardTask → User (student)`, `CardAttempt → CardTask` — нет cascade (ручное удаление)
- `Chat → Cohort`; `ChatMessage → Chat, User`

### Хранилище файлов (`/app/storage`)
```
/app/storage/
├── <uuid>.pdf/.docx/.mp4/...   # материалы дней и библиотеки
├── questions/<uuid>.png        # фоны для drawing-вопросов
├── drawings/<uuid>.png         # рисунки курсантов в тестах
├── cards/<uuid>.png/.jpg       # изображения карточек
├── annotations/<uuid>.png      # аннотированные карточки курсантов
└── chat-files/<uuid>.*         # вложения в чат
```

---

## Docker и инфраструктура

### Контейнеры (production)
| Контейнер | Образ | Порты |
|-----------|-------|-------|
| `eduplatform_postgres` | postgres:16-alpine | внутренний |
| `eduplatform_redis` | redis:7-alpine | внутренний |
| `eduplatform_backend` | custom build | внутренний :3000 |
| `eduplatform_frontend` | custom build (nginx) | внутренний :80 |
| `eduplatform_nginx` | nginx:alpine | **80, 443** → наружу |

### nginx (nginx.prod.conf)
- HTTP → HTTPS redirect (кроме `/.well-known/acme-challenge/`)
- `location ^~ /api/` — proxy на backend:3000. **`^~` обязателен** — предотвращает перехват regex-локацией статики
- `location ^~ /socket.io/` — WebSocket proxy (Upgrade header)
- `location ~* \.(js|css|...)$` — статика с кэшем 1y (Vite hash names)
- `location /` — SPA fallback на frontend:80
- `client_max_body_size 512m` (загрузка видео)
- `proxy_request_buffering off` на `/api/` (стриминг multipart)

### Переменные окружения (`.env.production`)
```env
DATABASE_URL=postgresql://...
REDIS_URL=redis://:password@redis:6379
JWT_SECRET=...
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://sokolbla.ru,https://www.sokolbla.ru
STORAGE_PATH=/app/storage
NODE_ENV=production
POSTGRES_USER=...
POSTGRES_PASSWORD=...
POSTGRES_DB=...
REDIS_PASSWORD=...
```

---

## Деплой на сервер 194.67.122.181

### Первый запуск
```bash
ssh user@194.67.122.181
git clone <repo> /opt/eduplatform
cd /opt/eduplatform
cp .env.production.example .env.production  # заполнить секреты
docker compose -f docker-compose.prod.yml up -d --build
```

### Обновление (обычный деплой)
```bash
ssh user@194.67.122.181
cd /opt/eduplatform
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

### Полезные команды
```bash
# Логи бэкенда в реальном времени
docker compose -f docker-compose.prod.yml logs -f backend

# Применить схему БД вручную (если нужно)
docker compose -f docker-compose.prod.yml exec backend npx prisma db push --skip-generate

# Перезапустить один контейнер
docker compose -f docker-compose.prod.yml restart nginx

# Открыть psql
docker compose -f docker-compose.prod.yml exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB

# SSL через certbot (если истёк)
certbot renew --nginx
docker compose -f docker-compose.prod.yml restart nginx
```

---

## Важные правила

### Миграции БД
- В production `CMD` в `Dockerfile` запускает `prisma db push --skip-generate` при каждом старте контейнера — схема синхронизируется автоматически
- Файлы в `prisma/migrations/` — SQL-справочники для документации и ручного применения; они **не применяются** автоматически через `prisma migrate deploy`
- При добавлении нового поля: обновить `schema.prisma` + создать SQL-файл в `migrations/<timestamp>_<name>/migration.sql`

### nginx — `^~` обязателен
Локация `/api/` ДОЛЖНА использовать `^~` (не просто `location /api/`):
```nginx
location ^~ /api/ { ... }
```
Без `^~` regex-локация `~* \.(js|css|png|...)$` может перехватить запросы типа `/api/tests/question-images/abc.png`.

### Удаление данных
- Нет Prisma cascade на `TestSubmission`, `CardTask`, `CardAttempt` — удалять вручную в транзакции
- Порядок при удалении пользователя: `CardAttempt → CardTask → TestSubmission → ChatMessage → TestVariantAssignment → User`
- Порядок при удалении группы: `ChatMessage → Chat → CardAttempt → CardTask → TestVariantAssignment → TestSubmission → TestAnswer → TestQuestion → Test → Material → Day → Users → Cohort`

### Публичные vs защищённые эндпоинты для файлов
- `/api/days/:id/materials/:matId/view` — **с авторизацией**, применяет водяные знаки
- `/api/materials/view/:materialId` — **без авторизации** (для iframe/video в браузере, нет водяных знаков)
- `/api/materials/file/:filename/html` — **без авторизации**, конвертирует .docx → HTML через mammoth
- Изображения карточек и аннотации — только с авторизацией

### Socket.IO события
| Событие | Направление | Данные |
|---------|-------------|--------|
| `chat:message` | server → clients in `chat:<id>` | `{ chatId, message }` |
| `day:opened` | server → clients in `cohort:<id>` | `{ dayId, dayNumber }` |
| `day:closed` | server → clients in `cohort:<id>` | `{ dayId, dayNumber }` |

### Push
```bash
git add -A && git commit -m "feat: ..." && git push
```
После push — деплоить командой `docker compose -f docker-compose.prod.yml up -d --build` на сервере.
