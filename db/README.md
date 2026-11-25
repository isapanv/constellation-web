# База данных «Созвездия»

PostgreSQL, схема v03. Чистый SQL без привязки к языку backend: подойдёт для Node, Python, Kotlin, Go и любой ORM. Prisma, Drizzle, SQLAlchemy умеют прочитать готовую схему из базы.

```
db/
  migrations/
    0001_init.sql              схема: 34 таблицы, перечисления, ограничения, индексы, триггеры
    0002_style_embeddings.sql  эмбеддинги стиля, нужен pgvector (можно применить позже)
    0003_matching_filters.sql  функция candidates_for_slot — жёсткие фильтры подбора
    0004_auth_otp.sql          коды из SMS для входа через API
    0005_media.sql             картинки в БД (media_files) и аватар профиля: медведица или своё фото
    0006_admin.sql             админка: роли сотрудников, блокировка, журнал действий
  seeds/
    0001_dictionaries.sql      города, роли, форматы, теги (коды как во фронте)
    0002_demo.sql              500 специалистов (39 «ручных» + 461 синтетический), заказчик, пример брифа, отзывы (сгенерирован)
    0003_demo_staff.sql        демо-сотрудники для локальной админки (на стенд и в прод не применять)
  scripts/grant-staff.sql      выдать роль сотрудника по телефону — так появляется первый админ
  scripts/gen-demo-seed.ts     генератор 0002_demo.sql: src/mocks/specialists.ts + scripts/synthetic.ts
  tests/constraints.sql        44 проверки правил целостности
```

Проверено на PostgreSQL 16: всё применяется с нуля, все 34 проверки проходят, а фильтры подбора на примере брифа выдают тех же кандидатов, что демо на фронте.

## 1. Поставить PostgreSQL (Windows)

1. Скачайте установщик с https://www.postgresql.org/download/windows/ (сборка EDB), версию 17 или 18.
2. В мастере оставьте компоненты PostgreSQL Server, pgAdmin и Command Line Tools. Stack Builder не нужен.
3. Задайте пароль пользователю `postgres` и запомните его. Порт оставьте 5432.
4. Добавьте `C:\Program Files\PostgreSQL\<версия>\bin` в PATH и перезапустите терминал. Проверка: `psql --version`.

Docker для этого не нужен. Если позже backend-разработчик даст `docker-compose.yml`, база поднимется в контейнере теми же файлами.

## 2. Создать базу и применить схему

Из корня `constellation-web` в PowerShell:

```powershell
$env:PGUSER = "postgres"; $env:PGPASSWORD = "ваш_пароль"
createdb sozvezdie
psql -d sozvezdie -v ON_ERROR_STOP=1 -f db/migrations/0001_init.sql
psql -d sozvezdie -v ON_ERROR_STOP=1 -f db/migrations/0003_matching_filters.sql
psql -d sozvezdie -v ON_ERROR_STOP=1 -f db/migrations/0004_auth_otp.sql
psql -d sozvezdie -v ON_ERROR_STOP=1 -f db/migrations/0005_media.sql
psql -d sozvezdie -v ON_ERROR_STOP=1 -f db/migrations/0006_admin.sql
psql -d sozvezdie -v ON_ERROR_STOP=1 -f db/seeds/0001_dictionaries.sql
psql -d sozvezdie -v ON_ERROR_STOP=1 -f db/seeds/0002_demo.sql
psql -d sozvezdie -v ON_ERROR_STOP=1 -f db/seeds/0003_demo_staff.sql
```

`0002_style_embeddings.sql` пока пропустите: без расширения pgvector он упадёт. Когда дойдёте до эмбеддингов, уточните у хостинга, можно ли включить pgvector в управляемом PostgreSQL.

Пересоздать базу с нуля: `dropdb sozvezdie`, затем те же команды.

**Демо-входы** (код в режиме разработки — 1234): заказчик с примером брифа — `+7 999 100-99-99`; специалисты — `+7 999 100-00-01` … `+7 999 100-05-00` (например, Фича Багова, оператор, — `+7 999 100-00-07`; Иван Т., режиссёр, — `+7 999 100-00-01`).

## 3. Проверить

```powershell
psql -d sozvezdie -f db/tests/constraints.sql          # в конце: passed 44, failed 0 (на свежей базе, до запуска подбора)
psql -d sozvezdie -c "SELECT r.code, c.display_name, c.cost, c.relaxed FROM role_slots s JOIN roles r ON r.id = s.role_id CROSS JOIN LATERAL candidates_for_slot(s.id, 1) c ORDER BY s.sort_order, c.cost"
```

Второй запрос показывает кандидатов по каждой роли примера брифа. Колорист проходит только с `relaxed = true`: сеньоры заняты в окне постпродакшна, поэтому в интерфейсе эта роль уходит в ручной подбор.

## 4. Демо-данные после изменения моков

Если поменяли `src/mocks/specialists.ts` или пример брифа:

```powershell
npx tsx db/scripts/gen-demo-seed.ts
```

## Правила работы со схемой

- **Применённую миграцию не правим.** Любое изменение оформляется новым файлом `0004_….sql`, `0005_….sql`. Как только база появится у backend-разработчика или на стенде, правка старого файла разведёт схемы.
- Инструмент применения миграций (golang-migrate, dbmate, Flyway, миграции ORM) выбирает backend-разработчик. Файлы уже в формате «по одному на версию» и подходят любому из них.
- Пароли и строки подключения в репозиторий не коммитим. Используйте `.env.local`, он уже в `.gitignore` у Next.js.
- Персональные данные пользователей хранятся только на российском хостинге (152-ФЗ). Локальная база — только для демо-данных.

## Обновление уже поднятой базы

База живёт в установленном PostgreSQL, а не в папке проекта: при замене папки она не теряется. Новые миграции применяйте по одной, по номеру, только те, что ещё не применяли:

```powershell
$env:PGUSER = "postgres"; $env:PGPASSWORD = "ваш_пароль"
psql -d sozvezdie -v ON_ERROR_STOP=1 -f db/migrations/0006_admin.sql
psql -d sozvezdie -v ON_ERROR_STOP=1 -f db/seeds/0003_demo_staff.sql   # только локально
```

## Медиафайлы (0005)

- Картинки хранятся в таблице `media_files`, байты — в колонке `data` (bytea). Видео в базу не кладём: для него ссылка на VK Видео / Rutube.
- Каждую картинку сервер пересобирает (sharp): проверяет, что это правда картинка, поворачивает по EXIF, удаляет все метаданные (включая GPS), сжимает в WebP. Аватар — 512×512, картинка портфолио — до 2000 px по длинной стороне.
- Аватар профиля: `profiles.avatar_preset` (одна из 12 медведиц из `public/avatars`) или `profiles.avatar_media_id` (своё фото). Оба сразу — нельзя. Старое фото при смене аватара удаляется.
- Переезд в объектное хранилище (Yandex Object Storage, Selectel): `data = NULL`, путь в `storage_key`. Код меняется только в `src/server/media.ts`.
- Сколько места занято: `SELECT purpose, count(*), pg_size_pretty(sum(size_bytes)) FROM media_files GROUP BY purpose;`

## Админка (0006)

Режим администратора — для сотрудников платформы, не для владельцев организаций. Адрес — `/admin`.

| Роль | Что может |
|---|---|
| `admin` | всё: роли сотрудников, ручная смена статуса проекта, журнал действий |
| `moderator` | пользователи (блокировка), аватары |
| `matcher` | очередь ручного подбора: взять заявку, пригласить специалиста, закрыть с итогом |

Права по ролям — в `src/lib/admin.ts` (`PERMISSIONS`), проверка — в `src/server/admin/access.ts`. Не сотрудник видит на `/admin` и `/api/admin/*` обычную 404.

**Первый админ.** Через интерфейс админом стать нельзя. Человек регистрируется на сайте по своему номеру, потом:

```powershell
psql -d sozvezdie -v phone=+79991234567 -v role=admin -f db/scripts/grant-staff.sql
```

Дальше роли выдаёт сам админ на `/admin/staff`. Себе роль поменять нельзя, последнего админа снять нельзя.

**Локально** `0003_demo_staff.sql` создаёт трёх сотрудников (код 1234): админ `+7 999 100-99-98`, модератор `+7 999 100-99-97`, подборщик `+7 999 100-99-96`.

**Журнал** `admin_audit_log` пишет каждое изменение и каждый просмотр карточки с телефоном (152-ФЗ: кто смотрел чьи данные). Записи нельзя изменить или удалить — это запрещает триггер.

**Блокировка** (`users.status = 'blocked'`): сессии отзываются, приглашения без ответа отзываются, вход по SMS отвечает «Аккаунт заблокирован». Принятые приглашения остаются: решение по конкретному проекту принимает сотрудник.
