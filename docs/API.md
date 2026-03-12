# API.md — Маршруты API

## Auth

```
GET  /auth/google              → редирект на Google OAuth
GET  /auth/google/callback     → обработка callback, установка сессии
POST /auth/logout              → уничтожение сессии
GET  /auth/me                  → { id, email, name, role, avatarUrl }
```

Ошибка неверного домена: `401 { error: "Доступ запрещён: недопустимый домен", code: "DOMAIN_NOT_ALLOWED" }`

---

## Documents — Сотрудник

```
GET  /api/documents
     → список опубликованных документов + статус ознакомления текущего пользователя
     response: { data: Document & { ackStatus: 'acknowledged' | 'outdated' | 'pending' } [] }

GET  /api/documents/:id
     → метаданные документа + статус ознакомления

GET  /api/documents/:id/file
     → { url: string }  — MinIO presigned URL, TTL 15 мин
     Пишет AuditLog: VIEW_DOC

POST /api/documents/:id/acknowledge
     → подтвердить ознакомление с текущей версией
     Пишет AuditLog: ACK_DOC
     Ответ: 200 | 409 (уже ознакомлен с этой версией)
```

---

## Tests — Сотрудник

```
GET  /api/tests
     → тесты для документов, с которыми пользователь ознакомлен
     response: { data: Test & { status: 'available' | 'passed' | 'failed' | 'expired' | 'no_ack' }[] }

GET  /api/tests/:id
     → данные теста + вопросы + варианты ответов (БЕЗ isCorrect и explanation)

POST /api/tests/:id/start
     → создаёт TestAttempt, возвращает attemptId
     Проверки: есть ли актуальное ознакомление, не исчерпаны ли попытки
     Пишет AuditLog: START_TEST

POST /api/tests/:id/submit
     body: { attemptId: string, answers: { questionId: string, selectedIds: string[] }[] }
     → оценивает на сервере, сохраняет результат
     response: { score: number, isPassed: boolean, answers: { questionId, isCorrect, explanation }[] }
     Пишет AuditLog: COMPLETE_TEST

GET  /api/tests/:id/history
     → история попыток текущего пользователя (без деталей ответов)
```

---

## Admin — Документы

```
GET    /api/admin/documents
       → все документы (включая черновики)

POST   /api/admin/documents
       → multipart/form-data: { title, category, version, description?, file }
       Сохраняет в MinIO, создаёт Document с isPublished: false

PATCH  /api/admin/documents/:id
       body: { title?, category?, description?, isPublished?, version? }
       При isPublished: true → триггер email-рассылки (новый документ)
       При смене version → триггер email-рассылки (обновление)

DELETE /api/admin/documents/:id
       → мягкое удаление (isPublished: false), файл в MinIO остаётся
```

---

## Admin — Тесты

```
GET    /api/admin/tests/:documentId
       → тест для документа (с вопросами и вариантами, включая isCorrect)

POST   /api/admin/tests
       body: { documentId, title, description?, passingScore?, timeLimit?, maxAttempts?, periodDays? }

PUT    /api/admin/tests/:id
       body: полный объект теста с вопросами и вариантами

DELETE /api/admin/tests/:id
       → деактивация (isActive: false)
```

---

## Admin — Пользователи

```
GET    /api/admin/users
       → список всех пользователей с краткой статистикой

PATCH  /api/admin/users/:id
       body: { isActive?, role? }

POST   /api/admin/users/:id/reset-attempts
       body: { testId: string }
       → удаляет все TestAttempt пользователя для данного теста
```

---

## Admin — Отчёты

```
GET  /api/admin/reports/compliance
     query: { documentId?, status?, testStatus?, dateFrom?, dateTo? }
     → отфильтрованный список строк отчёта

GET  /api/admin/reports/export
     query: те же фильтры
     → Content-Type: text/csv; attachment; filename="compliance_{date}.csv"

POST /api/admin/reports/send-email
     body: { to: string, filters?: object }
     → формирует CSV и отправляет письмом

POST /api/admin/notifications/remind
     body: { testId?: string, userIds?: string[] }
     → рассылает напоминание о тесте (всем или выбранным)
```

---

## Коды ошибок

| code | HTTP | Значение |
|------|------|---------|
| `NOT_AUTHENTICATED` | 401 | Нет сессии |
| `FORBIDDEN` | 403 | Недостаточно прав |
| `DOMAIN_NOT_ALLOWED` | 401 | Недопустимый email-домен |
| `NOT_FOUND` | 404 | Ресурс не найден |
| `NO_ACKNOWLEDGMENT` | 403 | Нет актуального ознакомления с документом |
| `MAX_ATTEMPTS_REACHED` | 409 | Исчерпаны попытки |
| `ALREADY_ACKNOWLEDGED` | 409 | Уже ознакомлен с этой версией |
| `TEST_IN_PROGRESS` | 409 | Есть незавершённая попытка |
| `INVALID_FILE_TYPE` | 400 | Загружен не PDF |
| `FILE_TOO_LARGE` | 400 | Файл > 50 МБ |
