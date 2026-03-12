# SECURITY.md — Правила безопасности при разработке

## Аутентификация и сессии

```typescript
// config/passport.ts — обязательная проверка домена
const ALLOWED_DOMAINS = process.env.ALLOWED_EMAIL_DOMAINS!.split(',');

passport.use(new GoogleStrategy(options, async (_, __, profile, done) => {
  const email = profile.emails?.[0].value ?? '';
  const domain = email.split('@')[1]?.toLowerCase();
  if (!ALLOWED_DOMAINS.includes(domain)) {
    return done(null, false, { message: 'DOMAIN_NOT_ALLOWED' });
  }
  // ...upsert user
}));

// app.ts — настройки сессии
app.use(session({
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  store: new PgStore({ pool }),
  cookie: {
    httpOnly: true,      // недоступно JS
    secure: true,        // только HTTPS
    sameSite: 'strict',
    maxAge: Number(process.env.SESSION_MAX_AGE), // 8 ч
  }
}));
```

---

## HTTP-заголовки безопасности

```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https://lh3.googleusercontent.com"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true }
}));

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));
```

---

## Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

// Auth endpoints
app.use('/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }));

// API в целом
app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 200 }));

// Загрузка файлов
app.use('/api/admin/documents', rateLimit({ windowMs: 60 * 1000, max: 10 }));
```

---

## Загрузка файлов (MinIO)

```typescript
// Разрешённые MIME-типы
const ALLOWED_MIME = ['application/pdf'];
const MAX_SIZE = 50 * 1024 * 1024; // 50 МБ

// При сохранении — переименовать в UUID
const fileKey = `documents/${cuid()}.pdf`;

// Presigned URL — TTL строго 15 минут
const url = await minioClient.presignedGetObject(BUCKET, fileKey, 900);
```

---

## Тесты — защита ответов

```typescript
// НИКОГДА не включать в GET /api/tests/:id
// Prisma select — явно исключить:
const test = await prisma.test.findUnique({
  where: { id },
  include: {
    questions: {
      include: {
        options: {
          select: {
            id: true,
            text: true,
            orderIndex: true,
            // isCorrect — НЕ включать
          }
        }
      }
    }
  }
});

// Оценка — только в POST /api/tests/:id/submit на сервере
// Варианты с isCorrect загружать отдельным запросом только внутри testService
```

---

## Аудит лог

```typescript
// middleware/audit.ts
export async function writeAuditLog(params: {
  userId?: string;
  action: string;
  entityId?: string;
  metadata?: object;
  req: Request;
}) {
  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      entityId: params.entityId,
      metadata: params.metadata as any,
      ipAddress: params.req.ip,
    }
  });
}

// Допустимые значения action:
// LOGIN | LOGOUT | VIEW_DOC | ACK_DOC | START_TEST | COMPLETE_TEST | UPLOAD_DOC | UPDATE_DOC | RESET_ATTEMPTS
```

---

## Очистка старых данных (cron)

```typescript
// Запускать еженедельно (node-cron или внешний cron)
import cron from 'node-cron';

// Очистка AuditLog старше 90 дней
cron.schedule('0 3 * * 0', async () => {
  await prisma.$executeRaw`
    DELETE FROM "AuditLog"
    WHERE "createdAt" < NOW() - INTERVAL '90 days'
  `;
});

// Напоминания о просроченных тестах — каждый понедельник в 09:00
cron.schedule('0 9 * * 1', async () => {
  await notificationService.sendOverdueTestReminders();
});
```

---

## Checklist перед PR

- [ ] Нет `console.log` с пользовательскими данными
- [ ] Все admin-маршруты за `isAdmin` middleware
- [ ] Presigned URL с TTL ≤ 900 сек
- [ ] `isCorrect` не попадает в клиентский ответ
- [ ] Валидация входящих данных через Zod на каждом endpoint
- [ ] Файл загружается под новым UUID-именем
- [ ] Нет хардкода доменов/секретов в коде
