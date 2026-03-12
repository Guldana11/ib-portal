# CLAUDE.md — ИБ-Портал

## Что это

Корпоративный портал осведомлённости по ИБ для ТОО «Crystal Spring» (БИН 070440012644).

**Два типа пользователей:**
- **Сотрудник** — читает регламенты, подтверждает ознакомление, проходит тесты
- **Администратор** — загружает документы, редактирует тесты, смотрит отчёты, рассылает напоминания по email

**Авторизация** — только корпоративный Google OAuth. Допустимые домены задаются через `ALLOWED_EMAIL_DOMAINS` в `.env`. Сторонние почты блокируются на уровне OAuth callback.

---

## Структура документации

| Файл | Содержит |
|------|----------|
| `CLAUDE.md` | Точка входа, правила для Claude |
| `docs/ARCHITECTURE.md` | Стек, структура проекта, схема БД, Docker |
| `docs/API.md` | Все маршруты API с описанием |
| `docs/ADMIN.md` | Функционал администратора и email-уведомления |
| `docs/SECURITY.md` | Правила безопасности при разработке |

---

## Правила — читать перед каждой задачей

1. **Стек** — только open source из `docs/ARCHITECTURE.md`. Ничего не добавлять без явного запроса.
2. **TypeScript strict** — `any` только с комментарием-обоснованием.
3. **Язык UI** — русский.
4. **Ошибки** — централизованный Express error middleware, формат `{ error: string, code: string }`.
5. **Секреты** — не логировать никогда. AuditLog пишет только факты действий.
6. **Правильные ответы теста** — никогда не включать в GET-ответы. Оценка только на сервере.
7. **Документы** — только через MinIO presigned URL (TTL 15 мин). Не проксировать через Node.
8. **Сессии** — httpOnly cookie. Не localStorage, не sessionStorage.
9. **Компоненты UI** — shadcn/ui + Tailwind. Загрузка → Skeleton, ошибки → toast (Sonner).
10. **Формы** — React Hook Form + Zod.

---

## Шаблон endpoint (копировать как основу)

```typescript
router.get('/path', isAuthenticated, async (req, res, next) => {
  try {
    const result = await someService.doSomething(req.user!.id);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});
```

---

## Жёсткие запреты

- ❌ Форма логин/пароль — только Google OAuth
- ❌ Хранить файлы в FS сервера — только MinIO
- ❌ Отдавать `isCorrect` до завершения теста
- ❌ JWT в localStorage / sessionStorage
- ❌ Открывать MinIO Admin Console (порт 9001) публично
- ❌ Внешние CDN в production
