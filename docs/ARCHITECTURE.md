# ARCHITECTURE.md

## Технический стек

| Слой | Технология | Версия |
|------|-----------|--------|
| Frontend | React + TypeScript + Vite | React 18 |
| UI Kit | shadcn/ui + Tailwind CSS | latest |
| PDF-просмотр | @react-pdf-viewer/core | latest |
| Backend | Node.js + Express | Node 20, Express 5 |
| БД | PostgreSQL | 16 |
| ORM | Prisma | latest |
| Аутентификация | Passport.js (Google OAuth 2.0) | latest |
| Сессии | express-session + connect-pg-simple | — |
| Хранилище файлов | MinIO (S3-совместимый) | latest |
| Email | Nodemailer + SMTP | — |
| Безопасность | helmet, express-rate-limit | — |
| Контейнеризация | Docker + Docker Compose | — |
| Reverse proxy | Nginx | alpine |

---

## Структура проекта

```
ib-portal/
├── CLAUDE.md
├── docs/
│   ├── ARCHITECTURE.md   ← этот файл
│   ├── API.md
│   ├── ADMIN.md
│   └── SECURITY.md
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── src/
│   │   ├── app.ts
│   │   ├── config/
│   │   │   ├── database.ts      # Prisma client singleton
│   │   │   ├── passport.ts      # Google OAuth + domain check
│   │   │   ├── minio.ts         # MinIO client + presigned URL helper
│   │   │   └── mailer.ts        # Nodemailer транспорт
│   │   ├── middleware/
│   │   │   ├── auth.ts          # isAuthenticated, isAdmin
│   │   │   └── audit.ts         # writeAuditLog helper
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── documents.ts
│   │   │   ├── tests.ts
│   │   │   └── admin.ts
│   │   └── services/
│   │       ├── documentService.ts
│   │       ├── testService.ts
│   │       └── notificationService.ts   # email-рассылки
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/LoginPage.tsx
│   │   │   ├── documents/
│   │   │   │   ├── DocumentList.tsx
│   │   │   │   ├── DocumentViewer.tsx   # PDF viewer + кнопка ознакомления
│   │   │   │   └── AcknowledgeButton.tsx
│   │   │   ├── tests/
│   │   │   │   ├── TestList.tsx
│   │   │   │   ├── TestRunner.tsx
│   │   │   │   └── TestResults.tsx
│   │   │   └── admin/
│   │   │       ├── Dashboard.tsx
│   │   │       ├── DocumentUpload.tsx
│   │   │       ├── QuestionEditor.tsx
│   │   │       └── ComplianceReport.tsx
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   └── useDocuments.ts
│   │   └── lib/api.ts           # Axios instance с credentials
│   └── package.json
└── nginx/nginx.conf
```

---

## Схема БД (Prisma)

```prisma
enum Role { EMPLOYEE  ADMIN }

model User {
  id           String    @id @default(cuid())
  email        String    @unique
  name         String
  googleId     String    @unique
  avatarUrl    String?
  role         Role      @default(EMPLOYEE)
  isActive     Boolean   @default(true)
  createdAt    DateTime  @default(now())
  lastLoginAt  DateTime?

  acknowledgments DocumentAcknowledgment[]
  testAttempts    TestAttempt[]
  auditLogs       AuditLog[]
}

model Document {
  id          String    @id @default(cuid())
  title       String
  description String?
  version     String    @default("1.0")
  category    String
  fileKey     String    // ключ в MinIO
  fileName    String
  fileSize    Int
  isPublished Boolean   @default(false)
  publishedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  createdBy   String    // email admin

  acknowledgments DocumentAcknowledgment[]
  tests           Test[]
}

// При загрузке новой версии документа — старые acknowledgments остаются,
// но version != Document.version, поэтому статус = "требует переознакомления"
model DocumentAcknowledgment {
  id         String   @id @default(cuid())
  userId     String
  documentId String
  version    String
  createdAt  DateTime @default(now())

  user     User     @relation(fields: [userId], references: [id])
  document Document @relation(fields: [documentId], references: [id])

  @@unique([userId, documentId, version])
}

model Test {
  id           String  @id @default(cuid())
  documentId   String
  title        String
  description  String?
  passingScore Int     @default(80)   // % для зачёта
  timeLimit    Int?                   // минуты; null = без ограничения
  maxAttempts  Int     @default(3)
  periodDays   Int     @default(365)  // периодичность повторной сдачи
  isActive     Boolean @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  document  Document      @relation(fields: [documentId], references: [id])
  questions Question[]
  attempts  TestAttempt[]
}

model Question {
  id         String  @id @default(cuid())
  testId     String
  text       String
  orderIndex Int
  explanation String?   // показывается после сдачи теста

  test    Test       @relation(fields: [testId], references: [id])
  options Option[]
  answers TestAnswer[]
}

model Option {
  id         String  @id @default(cuid())
  questionId String
  text       String
  isCorrect  Boolean @default(false)
  orderIndex Int

  question Question @relation(fields: [questionId], references: [id])
}

model TestAttempt {
  id          String    @id @default(cuid())
  userId      String
  testId      String
  score       Int?
  isPassed    Boolean?
  startedAt   DateTime  @default(now())
  completedAt DateTime?

  user    User         @relation(fields: [userId], references: [id])
  test    Test         @relation(fields: [testId], references: [id])
  answers TestAnswer[]
}

model TestAnswer {
  id          String   @id @default(cuid())
  attemptId   String
  questionId  String
  selectedIds String[]

  attempt  TestAttempt @relation(fields: [attemptId], references: [id])
  question Question    @relation(fields: [questionId], references: [id])
}

model AuditLog {
  id        String   @id @default(cuid())
  userId    String?
  action    String   // LOGIN | LOGOUT | VIEW_DOC | ACK_DOC | START_TEST | COMPLETE_TEST | UPLOAD_DOC
  entityId  String?
  metadata  Json?
  ipAddress String?
  createdAt DateTime @default(now())

  user User? @relation(fields: [userId], references: [id])
}
```

---

## Ключевые бизнес-правила БД

- Тест нельзя начать, пока нет актуального `DocumentAcknowledgment` (версия совпадает с `Document.version`)
- `Test.maxAttempts` — сброс только администратором
- `AuditLog` хранится 90 дней: cron `DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days'`

---

## Docker Compose (сокращённо)

```yaml
services:
  postgres:
    image: postgres:16-alpine
    volumes: [postgres_data:/var/lib/postgresql/data]

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    volumes: [minio_data:/data]
    # порт 9001 (console) — НЕ открывать наружу

  backend:
    build: ./backend
    depends_on: [postgres, minio]
    env_file: .env

  frontend:
    build: ./frontend

  nginx:
    image: nginx:alpine
    ports: ["443:443"]
    volumes: [./nginx/nginx.conf:/etc/nginx/nginx.conf:ro]

volumes:
  postgres_data:
  minio_data:
```

---

## .env.example

```env
ALLOWED_EMAIL_DOMAINS=crystalspring.kz

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=https://your-domain/auth/google/callback

DATABASE_URL=postgresql://user:pass@postgres:5432/awareness_db
SESSION_SECRET=min_64_random_chars
SESSION_MAX_AGE=28800000

MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=
MINIO_SECRET_KEY=
MINIO_BUCKET=documents

SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@crystalspring.kz

FRONTEND_URL=https://your-domain
```
