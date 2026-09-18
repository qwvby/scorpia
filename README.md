# Scorpia — Backend API

Node.js + TypeScript + Express + Prisma + PostgreSQL. Реалізує ту саму бізнес-логіку,
що й у прототипі (каскадна синхронізація дедлайнів Subtask → Task → Project,
автоматичний прогрес, health-статуси), тепер над справжньою базою даних, з
реальною автентифікацією та REST API, готовим приймати запити від багатьох
користувачів одночасно.

## Структура проєкту

```
src/
  config/db.ts           — Prisma-клієнт
  middleware/             — auth (JWT), обробка помилок
  services/businessLogic.ts — каскади дедлайнів/прогресу, activity, notifications
  controllers/            — логіка кожного ресурсу
  routes/                 — REST-маршрути
  app.ts, index.ts        — збірка застосунку
prisma/
  schema.prisma            — модель бази даних
  seed.ts                   — тестові дані (3 користувачі, 1 проєкт)
```

## 1. Локальний запуск

Знадобиться Node.js 18+ і PostgreSQL (локально або через Docker).

```bash
# 1. Встановити залежності
npm install

# 2. Підняти PostgreSQL локально (якщо немає) — простий варіант через Docker:
docker run --name scorpia-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=scorpia -p 5432:5432 -d postgres:16

# 3. Скопіювати .env та заповнити
cp .env.example .env
# відкрийте .env і вставте свій DATABASE_URL та JWT_SECRET
# (JWT_SECRET можна згенерувати командою нижче)
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 4. Застосувати схему БД
npx prisma migrate dev --name init

# 5. (опційно) Заповнити тестовими даними
npm run seed

# 6. Запустити сервер розробки
npm run dev
```

API стартує на `http://localhost:4000`. Перевірка: `GET http://localhost:4000/health`.

## 2. Основні ендпоінти

```
POST   /api/auth/register        { name, email, password }
POST   /api/auth/login           { email, password }
GET    /api/auth/me              (потрібен Authorization: Bearer <token>)

GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
PATCH  /api/projects/:id
DELETE /api/projects/:id
POST   /api/projects/:id/members { userId, role }

GET    /api/tasks?projectId=...&responsibleId=...&status=...
POST   /api/tasks
GET    /api/tasks/:id
PATCH  /api/tasks/:id
DELETE /api/tasks/:id

POST   /api/dependencies         { fromTaskId, toTaskId, type }
DELETE /api/dependencies/:id

GET    /api/comments?entityType=task&entityId=...
POST   /api/comments             { entityType, entityId, content }

GET    /api/notifications
POST   /api/notifications/:id/read
POST   /api/notifications/read-all

GET    /api/activity?entityType=project&entityId=...
```

Усі маршрути, крім `/api/auth/register` і `/api/auth/login`, потребують заголовок
`Authorization: Bearer <token>`, отриманий після логіну.

## 3. Як залити на GitHub

```bash
git init
git add .
git commit -m "Initial commit: Scorpia backend"

# створіть порожній репозиторій на github.com (без README), потім:
git remote add origin https://github.com/<ваш-акаунт>/scorpia-backend.git
git branch -M main
git push -u origin main
```

`.env` не потрапить у репозиторій — він у `.gitignore`. На кожному новому
середовищі (включно з хостингом) змінні задаються окремо.

## 4. Деплой на Railway (найпростіший варіант)

1. Зайдіть на [railway.app](https://railway.app), увійдіть через GitHub.
2. **New Project → Deploy from GitHub repo** → оберіть `scorpia-backend`.
3. **+ New → Database → Add PostgreSQL** у тому ж проєкті — Railway сам додасть
   змінну `DATABASE_URL` вашому сервісу.
4. У сервісі backend, у вкладці **Variables**, додайте:
   - `JWT_SECRET` — згенерований довгий рядок
   - `JWT_EXPIRES_IN` — `7d`
   - `CORS_ORIGIN` — адреса вашого фронтенду (можна поставити `*` на старті)
5. У **Settings → Deploy**:
   - Build command: `npm run build`
   - Start command: `npm run migrate && npm start`
   (`migrate` застосовує міграції на продакшн-базі перед стартом сервера)
6. Railway задеплоїть автоматично при кожному `git push` у `main`.

Альтернатива — [render.com](https://render.com): аналогічний флоу (Web Service +
managed PostgreSQL), Build command `npm run build`, Start command `npm run migrate && npm start`.

## 5. Наступні кроки

- Підключити фронтенд (React-прототип) до цього API замість `window.storage`.
- Додати робочі простори (Workspace) для реальної багатокомандної роботи.
- Додати email-сервіс (Resend/SendGrid) для підтвердження пошти й скидання пароля.
- Написати тести для каскадної логіки дедлайнів/прогресу (`src/services/businessLogic.ts`)
  — це найкритичніша частина системи.
